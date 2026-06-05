# Shyam Venkatraman - RAG-Grounded AI Representative & Scheduler

An end-to-end intelligent representative system designed to represent Shyam Venkatraman to recruiters and hiring managers. Grounded directly in Shyam's resume and his **23 public GitHub repositories**, the system operates simultaneously across a **Voice Agent** (telephony-enabled) and a **Chat/Scheduling Web Console** to handle professional inquiries and schedule interview slots autonomously.

---

## 🚀 Live Demo & Telephony Testing

You can evaluate the system immediately through any of the active channels below:

*   📞 **Voice Dial-in**: Call **`+1 (239) 663-4873`** (Direct US line from any phone).
*   💬 **Interactive Chat & Scheduler**: Access the live dark glassmorphic web dashboard at [https://scaler-assignment-shyam.onrender.com/).
*   📊 **Real-time Telemetry Tracing**: Open the web dashboard, submit queries, and expand the *RAG Telemetry & Debug Console* at the bottom to watch latency values and exact matched document sources.

*Note: The backend is actively running on a local development server on port 4000 and exposed via a secure Cloudflare Tunnel.*

---

## 🛠️ Core Features & Capabilities

### 1. High-Fidelity Voice Agent (Vapi + Twilio)
*   **Natural Conversational Flows**: Greets users, sets context, and represents Shyam professionally.
*   **Barge-in / Interruption Handling**: Instantly stops speaking when a recruiter interrupts mid-sentence, resetting dialogue buffers dynamically.
*   **Structured Voice Webhooks**: Translates natural speech queries into calendar availability checks and booking transactions.

### 2. Semantic RAG Grounding (Resume + 23 GitHub Repos)
*   **Vector Search Matching**: Queries are compared against 18 chunked text records indexing Shyam's vitals, projects, and repo structure using cosine similarity.
*   **Metadata Filtering**: Specifically isolates source contexts (e.g. searching "EduBot" queries only against EduBot documents) to prevent hallucinatory noise.
*   **Strict Grounding Defenses**: If a query is off-topic or information is missing, the agent gracefully redirects rather than guessing or hallucinating facts.

### 3. Glassmorphic Booking Interface
*   **Interactive Calendar Grid**: Fetches free slots from the Express database and displays them.
*   **Autonomous Double-Booking Protection**: Validates timestamps upon submission to guarantee scheduling integrity.
*   **Visual Debug Console**: Exposes the search latency profile, LLM response latency, and chunk counts directly inside the chat panel.

---

## 🏗️ System Architecture

```
                     +----------------------------+
                     |    Voice Call (Telephony)  |
                     +--------------+-------------+
                                    |
                                    v (Phone Stream)
                     +--------------+-------------+
                     |     Vapi Orchestrator      |
                     +-------+------------+-------+
            Deepgram |       |            | ElevenLabs
            (STT)    |       |            | (TTS)
                     v       v            v
                   +---------+-------------+
                   |  GPT-4o-mini Agent   |
                   +---------+-------------+
                             | (Tool Webhook Call)
                             v
                     +-------+-------------+
                     | Express API Server  | <==== (Serves Chat Front-end)
                     +---+----+--------+---+
                         |    |        |
         (RAG Retrieval) |    |        | (Scheduling API)
                         v    |        v
        +----------------+--+ |   +----+--------------------+
        |  Memory Vector    | |   |      Cal.com API        |
        |  Store (Local)    | |   +----+--------------------+
        +----------------+--+ |        |
                         |    |        v
     (Crawls Resume PDF  |    |   +----+--------------------+
      & Public GitHub)   |    +-->|  Recruiter Calendar     |
                         |        |  (Real Booking Sync)    |
                         v        +-------------------------+
        +----------------+--+
        |   data/           |
        |   vector_db.json  |
        +-------------------+
```

---

## 💰 Cost Breakdown (Free Tier Configured)

This system is configured to run entirely on the **free and trial tiers** of all providers, requiring **$0.00** out-of-pocket costs to host and test:

*   **Vapi.ai**: Uses Vapi's **$10.00 free starting credit** (provides ~200 minutes of browser calling/voice routing).
*   **Twilio**: Uses Twilio's **$15.00 free trial credit** (covers the US phone number rental and call routing).
*   **OpenAI API / RAG**: Generates embeddings and LLM responses. If the API key runs out of credit, the system automatically falls back to the local bag-of-words similarity matching to prevent any downtime or cost.

### Production Cost Estimates (If scaled to Paid Tiers)
Should the system be migrated to commercial paid tiers, the operational cost metrics are extremely low:

1.  **Voice Calls**: **~$0.08 / minute**
    *   *Vapi Orchestration*: $0.05 / min
    *   *Twilio Telephony (US)*: $0.013 / min
    *   *ElevenLabs TTS (Flash)*: $0.015 / min
    *   *Deepgram STT (Nova-2)*: $0.0043 / min
    *   *OpenAI LLM (GPT-4o-mini)*: ~$0.001 / min (~1000 input/output tokens)
2.  **Chat Sessions**: **~$0.002 / session**
    *   *OpenAI LLM (GPT-4o-mini)*: ~$0.0004 per message response (~3,000 token context window).
    *   *Embedding Ingestion*: $0.00003 (One-time cost to embed Shyam's resume + 23 repos).

---

## ⚙️ Local Installation & Development

To run this project on your local environment:

### 1. Clone the Repository
```bash
git clone https://github.com/shyam1444/Scaler_Assignment_ShyamV.git
cd Scaler_Assignment_ShyamV
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory (you can copy `.env.example` as a starting point):
```env
PORT=4000
OPENAI_API_KEY=your-openai-api-key
GITHUB_USERNAME=shyam1444
CAL_USERNAME=shyamv1444
RESUME_PATH=C:\path\to\your\resume.pdf
```
*(Note: If no Cal.com API keys are provided, the system automatically falls back to a high-fidelity local JSON database stored in `data/bookings.json`).*

### 3. Run RAG Ingest
Parse your local resume PDF and crawl public GitHub metadata:
```bash
npm run ingest
```

### 4. Start the Application
```bash
npm run dev
```
Open `http://localhost:4000` in your web browser to access the local client console.

---

## 🧪 System Verification

### Automated Tests
Run the automated test suite to verify the scheduling engine's reservation validation and RAG index loading:
```bash
npm test
```
