import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

const DB_PATH = path.join(__dirname, '../../data/vector_db.json');

export interface Chunk {
  id: string;
  source: string;
  text: string;
  embedding: number[];
}

export class VectorStore {
  private chunks: Chunk[] = [];

  constructor() {
    this.loadDatabase();
  }

  private loadDatabase() {
    if (!fs.existsSync(DB_PATH)) {
      console.warn(`[Warning] Vector database not found at ${DB_PATH}. Please run the ingestion script: npm run ingest.`);
      this.chunks = [];
      return;
    }
    try {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      this.chunks = JSON.parse(data);
      console.log(`Loaded ${this.chunks.length} text chunks into memory vector store.`);
    } catch (error) {
      console.error(`Error reading vector store file:`, error);
      this.chunks = [];
    }
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private magnitude(a: number[]): number {
    return Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const magA = this.magnitude(a);
    const magB = this.magnitude(b);
    if (magA === 0 || magB === 0) return 0;
    return this.dotProduct(a, b) / (magA * magB);
  }

  private generateMockEmbedding(text: string): number[] {
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

  public async getQueryEmbedding(openai: OpenAI, query: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query
      });
      return response.data[0].embedding;
    } catch (err: any) {
      if (err.status === 429 || err.code === 'insufficient_quota') {
        console.warn("[Warning] OpenAI API quota exceeded. Falling back to local bag-of-words query embedding.");
        return this.generateMockEmbedding(query);
      }
      throw err;
    }
  }

  private detectRepoFilter(query: string): string | null {
    const q = query.toLowerCase();
    if (q.includes('edubot')) return 'GitHub_EduBot';
    if (q.includes('predictive') || q.includes('automotive') || q.includes('maintenance') || q.includes('telemetry')) {
      return 'GitHub_Automotive-Agentic-Vehicle-Predictive-Maintenance-System';
    }
    if (q.includes('track-flow') || q.includes('crm') || q.includes('track flow')) {
      return 'GitHub_Track-Flow-CRM';
    }
    if (q.includes('guidelines') || q.includes('analyzer') || q.includes('correction')) {
      return 'GitHub_AI-Code-Guidelines-Analyzer-Correction-System';
    }
    if (q.includes('allohealth')) {
      return 'GitHub_AlloHealth_22MIS1031';
    }
    if (q.includes('logger') || q.includes('chrome-extension') || q.includes('sheet')) {
      return 'GitHub_Web-to-Sheet-Logger-Chrome-Extension';
    }
    if (q.includes('resume') || q.includes('vit') || q.includes('education') || q.includes('gpa') || q.includes('grades') || q.includes('academic')) {
      return 'Resume';
    }
    return null;
  }

  public search(queryEmbedding: number[], topK: number = 4, filterSource?: string | null): { chunk: Chunk; score: number }[] {
    if (this.chunks.length === 0) {
      this.loadDatabase();
    }

    let targets = this.chunks;
    if (filterSource) {
      const filtered = this.chunks.filter(chunk => chunk.source === filterSource);
      if (filtered.length > 0) {
        targets = filtered;
      }
    }

    const scored = targets.map(chunk => {
      const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      return { chunk, score };
    });

    // Sort by descending score
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  public async retrieveContext(openai: OpenAI, query: string, topK: number = 5): Promise<{ contextText: string; sources: string[]; debug: any[] }> {
    try {
      const queryEmbedding = await this.getQueryEmbedding(openai, query);
      const filterSource = this.detectRepoFilter(query);
      const results = this.search(queryEmbedding, topK, filterSource);

      const contextChunks: string[] = [];
      const sources: string[] = [];
      const debugInfo: any[] = [];

      for (const res of results) {
        contextChunks.push(`[Source: ${res.chunk.source}] (Similarity: ${res.score.toFixed(3)})\n${res.chunk.text}`);
        if (!sources.includes(res.chunk.source)) {
          sources.push(res.chunk.source);
        }
        debugInfo.push({
          source: res.chunk.source,
          score: res.score,
          textExcerpt: res.chunk.text.substring(0, 100) + '...'
        });
      }

      return {
        contextText: contextChunks.join('\n\n---\n\n'),
        sources,
        debug: debugInfo
      };
    } catch (error: any) {
      console.error(`RAG retrieval failed:`, error);
      return {
        contextText: 'RAG error: Could not retrieve context.',
        sources: [],
        debug: []
      };
    }
  }
}
