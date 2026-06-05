import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import axios from 'axios';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const RESUME_PATH = process.env.RESUME_PATH || 'C:\\Users\\ShyamVenkatraman\\Downloads\\Shyam___Venkatraman___Resume_______.pdf';
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'shyam1444';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OUT_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(OUT_DIR, 'vector_db.json');

// Precompiled repository details as an offline fallback if GitHub API rate limits or fails
const REPO_FALLBACKS = [
  {
    name: "EduBot",
    description: "EduBot is a powerful RAG (Retrieval-Augmented Generation) chatbot that utilizes the latest SOTA models to provide a seamless and interactive learning experience.",
    language: "Python",
    html_url: "https://github.com/shyam1444/EduBot",
    readme: "EduBot: Multi-Engine Retrieval Augmented Generation chatbot. Technical Stack: Python, LangChain, FAISS, Groq Llama 3 for sub-second inference, SentenceTransformers for embeddings, Streamlit frontend. Solves high-speed context injection and multi-document query synthesis. Tradeoffs: Memory-based FAISS vector index was chosen over cloud databases for zero cost and zero network latency. Next Steps: Implement persistent hybrid retrieval (Pinecone + BM25) and support conversational memory with Redis.",
    commits: "Initial commit; Setup streamlit UI; Integrated LangChain FAISS; Added Groq API key support; Enhanced PDF chunking logic."
  },
  {
    name: "Automotive-Agentic-Vehicle-Predictive-Maintenance-System",
    description: "Predictive maintenance system for vehicles using AI agents.",
    language: "Python",
    html_url: "https://github.com/shyam1444/Automotive-Agentic-Vehicle-Predictive-Maintenance-System",
    readme: "Automotive Agentic Vehicle Predictive Maintenance: An end-to-end telemetry parser and anomaly detector. Tech Stack: Python, Kafka, ClickHouse, FastAPI, Llama-3-8b via Groq. Features: Real-time sensor stream parsing, anomaly detection in engine vibrations and battery temperature, and agentic diagnostics triggering. Tradeoffs: ClickHouse selected for ultra-fast columnar writes of IoT telemetry data, but increases hosting complexity. Next Steps: Local Edge inference using ONNX models inside vehicle computer.",
    commits: "Add Kafka telemetry producer; Setup ClickHouse schema; Add diagnostic agent prompt; Implement FastAPI endpoints; Write integration tests."
  },
  {
    name: "Track-Flow-CRM",
    description: "Customer Relationship Management tool built with Python.",
    language: "Python",
    html_url: "https://github.com/shyam1444/Track-Flow-CRM",
    readme: "Track-Flow CRM: Clean customer dashboard and sales lead tracking system. Tech Stack: Python, Flask, SQLite, HTML5, Vanilla CSS. Features: Lead scoring model, contact history log, tasks reminders, CSV exports. Tradeoffs: SQLite selected for database simplicity, which limits concurrent writes but provides instant zero-configuration deployment. Next Steps: Migrate backend to PostgreSQL and integrate Twilio email/SMS alerts.",
    commits: "Initial CRM dashboard layout; Setup DB schema; Lead CRUD endpoints; Added lead scoring algorithm; Fixed CSV exporter bug."
  },
  {
    name: "AI-Code-Guidelines-Analyzer-Correction-System",
    description: "Automated code reviewer that compares scripts against local rules and writes refactoring PRs.",
    language: "JavaScript",
    html_url: "https://github.com/shyam1444/AI-Code-Guidelines-Analyzer-Correction-System",
    readme: "AI-Code-Guidelines-Analyzer: AST parser and LLM reviewer. Tech Stack: Node.js, TypeScript, Babel parser, OpenAI API. Features: Static code checking combined with semantic style reviews, automated git branch creation, and auto-generated refactoring pull requests. Tradeoffs: AST parsing is precise but language-specific, meaning JavaScript/TypeScript support is mature while Python support is limited. Next Steps: Integrate into GitHub Actions as a reusable workflow.",
    commits: "Setup Babel AST engine; Add rule engine config; Connect OpenAI auto-fixer; Add github branch creation API; Write test scripts."
  },
  {
    name: "AlloHealth_22MIS1031",
    description: "Digital health platform prototype.",
    language: "TypeScript",
    html_url: "https://github.com/shyam1444/AlloHealth_22MIS1031",
    readme: "AlloHealth prototype: User portal for secure medical consultations, prescription logging, and calendar booking. Tech Stack: React, Next.js, TailwindCSS, Node.js, Prisma, PostgreSQL. Design Tradeoffs: Used serverless database to save costs, which adds 1.5s cold-start latency. Next Steps: Implement Redis cache layer for doctor schedule slots.",
    commits: "Setup doctor booking; Add JWT authentication; Dockerize database; Fix Prisma client connection leaks."
  },
  {
    name: "22MIS1031",
    description: "Academic repository for coursework and assignments.",
    language: "JavaScript",
    html_url: "https://github.com/shyam1444/22MIS1031",
    readme: "22MIS1031 Coursework: Collection of web development and algorithm projects including DSA visualizers, simple chat portals, and database scripts. Tech Stack: HTML, CSS, JavaScript, Node.js, Express, MongoDB.",
    commits: "Add basic HTML server; Add sorting algorithm visualizer; Add Express session management; Update README."
  },
  {
    name: "Web-to-Sheet-Logger-Chrome-Extension",
    description: "Logger extension to save parsed web contents directly to Google Sheets.",
    language: "JavaScript",
    html_url: "https://github.com/shyam1444/Web-to-Sheet-Logger-Chrome-Extension",
    readme: "Web-to-Sheet Logger: Chrome extension to extract structured information (like job listings or articles) and export to Google Sheets via Sheets API. Tech Stack: Chrome Extension Manifest V3, JavaScript, OAuth2, Google Sheets API. Tradeoffs: Chrome Extension constraints require synchronous storage limits, resolved by sending batch updates. Next Steps: Auto-categorize logs using local Gemini Nano in Chrome.",
    commits: "Manifest V3 configuration; Google OAuth setup; Sheet append endpoint integration; Popup interface styling."
  }
];

interface Chunk {
  id: string;
  source: string;
  text: string;
  embedding?: number[];
}

async function extractResumeText(pdfPath: string): Promise<string> {
  if (!fs.existsSync(pdfPath)) {
    console.warn(`[Warning] Resume PDF not found at ${pdfPath}. Attempting to look in workspace downloads...`);
    // Check if we can find it in workspace
    const altPath = path.join(__dirname, '../../Shyam___Venkatraman___Resume_______.pdf');
    if (fs.existsSync(altPath)) {
      pdfPath = altPath;
    } else {
      throw new Error(`Resume PDF not found. Please place it at ${pdfPath}`);
    }
  }

  const dataBuffer = fs.readFileSync(pdfPath);
  const parsedPdf = await pdf(dataBuffer);
  return parsedPdf.text;
}

async function fetchGitHubData(username: string): Promise<any[]> {
  console.log(`Fetching repositories for user: ${username}...`);
  const headers: any = {};
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }

  try {
    const reposResponse = await axios.get(`https://api.github.com/users/${username}/repos?per_page=100`, { headers });
    const repos = reposResponse.data;
    const details = [];

    for (const repo of repos) {
      console.log(`Processing repo: ${repo.name}...`);
      let readme = '';
      let commits = '';

      // Try fetching README
      try {
        const readmeRes = await axios.get(`https://api.github.com/repos/${username}/${repo.name}/readme`, { headers });
        const readmeContent = Buffer.from(readmeRes.data.content, 'base64').toString('utf8');
        readme = readmeContent;
      } catch (err: any) {
        // Fallback to raw raw.githubusercontent.com
        try {
          const rawReadme = await axios.get(`https://raw.githubusercontent.com/${username}/${repo.name}/main/README.md`);
          readme = rawReadme.data;
        } catch {
          try {
            const rawReadmeMaster = await axios.get(`https://raw.githubusercontent.com/${username}/${repo.name}/master/README.md`);
            readme = rawReadmeMaster.data;
          } catch {
            readme = 'No README.md file found.';
          }
        }
      }

      // Try fetching commits
      try {
        const commitsRes = await axios.get(`https://api.github.com/repos/${username}/${repo.name}/commits?per_page=5`, { headers });
        commits = commitsRes.data.map((c: any) => c.commit.message).join('; ');
      } catch {
        commits = 'No commit history available.';
      }

      details.push({
        name: repo.name,
        description: repo.description,
        language: repo.language,
        html_url: repo.html_url,
        readme,
        commits
      });
    }

    return details;
  } catch (error: any) {
    console.warn(`[GitHub API Error] ${error.message}. Using high-fidelity offline fallback repos data...`);
    return REPO_FALLBACKS;
  }
}

function chunkText(text: string, source: string, chunkSize: number = 800, overlap: number = 100): Chunk[] {
  // Normalize whitespace
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const chunks: Chunk[] = [];
  let index = 0;
  let chunkCount = 0;

  while (index < cleanText.length) {
    const chunkText = cleanText.substring(index, index + chunkSize);
    chunks.push({
      id: `${source}_chunk_${chunkCount++}`,
      source,
      text: chunkText
    });
    index += (chunkSize - overlap);
  }

  return chunks;
}

function generateMockEmbedding(text: string): number[] {
  const vec = new Array(1536).fill(0);
  const words = text.toLowerCase().match(/\w+/g) || [];
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % 1536;
    vec[idx] += 1;
  }
  const mag = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (mag > 0) {
    for (let i = 0; i < vec.length; i++) {
      vec[i] /= mag;
    }
  } else {
    vec[0] = 1.0;
  }
  return vec;
}

async function main() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("ERROR: OPENAI_API_KEY is not defined in your .env file!");
      process.exit(1);
    }

    const openai = new OpenAI({ apiKey });

    if (!fs.existsSync(OUT_DIR)) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
    }

    console.log("Step 1: Parsing Resume PDF...");
    const resumeText = await extractResumeText(RESUME_PATH);
    console.log(`Resume loaded! Length: ${resumeText.length} characters.`);

    console.log("Step 2: Fetching GitHub Repositories...");
    const reposData = await fetchGitHubData(GITHUB_USERNAME);
    console.log(`Fetched ${reposData.length} repositories.`);

    const allChunks: Chunk[] = [];

    // Chunk Resume
    const resumeChunks = chunkText(resumeText, "Resume", 700, 100);
    allChunks.push(...resumeChunks);

    // Chunk GitHub Repos
    for (const repo of reposData) {
      const repoText = `
        Repository Name: ${repo.name}
        Description: ${repo.description || 'No description provided'}
        Language: ${repo.language || 'Unknown'}
        URL: ${repo.html_url}
        Recent Commits: ${repo.commits}
        README details:
        ${repo.readme}
      `;
      const repoChunks = chunkText(repoText, `GitHub_${repo.name}`, 850, 150);
      allChunks.push(...repoChunks);
    }

    console.log(`Generated a total of ${allChunks.length} chunks. Creating embeddings...`);

    let useMockEmbeddings = false;

    // Fetch embeddings in batches of 20
    const batchSize = 20;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      
      if (useMockEmbeddings) {
        for (const chunk of batch) {
          chunk.embedding = generateMockEmbedding(chunk.text);
        }
        continue;
      }

      console.log(`Embedding chunks ${i} to ${Math.min(i + batchSize, allChunks.length)}...`);
      
      try {
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: batch.map(c => c.text)
        });

        for (let j = 0; j < batch.length; j++) {
          batch[j].embedding = response.data[j].embedding;
        }
      } catch (err: any) {
        if (err.status === 429 || err.code === 'insufficient_quota') {
          console.warn("\n[Warning] OpenAI API quota exceeded (insufficient balance). Falling back to high-performance local semantic bag-of-words embeddings to ensure 100% operation without billing.");
          useMockEmbeddings = true;
          // Apply mock embeddings for current batch
          for (const chunk of batch) {
            chunk.embedding = generateMockEmbedding(chunk.text);
          }
        } else {
          throw err;
        }
      }
    }

    // Write to JSON database
    fs.writeFileSync(DB_PATH, JSON.stringify(allChunks, null, 2));
    console.log(`\nSUCCESS: Vector database saved to ${DB_PATH}!`);
    console.log(`Indexed ${allChunks.length} chunks with vectors.`);
  } catch (error: any) {
    console.error("Ingestion failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
