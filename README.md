# Shyam Venkatraman - AI Representative (Voice, Chat, and Scheduler)

This repository contains the source code and configuration details for **Shyam's AI Representative**, an end-to-end system capable of introducing Shyam, discussing his technical background and GitHub repositories, and booking confirmed interviews autonomously with no human in the loop.

---

## 🚀 Live Demo & Telephony Testing

You can interact with Shyam's AI Representative immediately using any of the public access channels:

*   📞 **Voice Dial-In**: Call **`+1 (239) 663-4873`** (Direct US dial-in from any mobile network).
*   💬 **Web Chat & Calendar Scheduler**: Access the live glassmorphic client interface at [https://renaissance-taken-vendor-rochester.trycloudflare.com](https://renaissance-taken-vendor-rochester.trycloudflare.com).
*   🌐 **Interactive RAG Telemetry**: The web page features a real-time console showing source matches, token counts, and retrieval latencies as you chat.

*Note: Since the backend is running via a Cloudflare Tunnel for grading purposes, the web client and voice hooks route directly to the active Express server on port 4000.*

---

## 🏗️ System Architecture

The project is built on a consolidated TypeScript/Node.js stack that handles PDF extraction, repository crawling, vector searching, backend APIs, and serves a premium glassmorphic chat interface.

```
                     +----------------------------+
                     |  Twilio Recruiter Call     |
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

## ⚡ Latency Engineering (Sub-2s Responses)
- **Groq/OpenAI (GPT-4o-mini)**: Leveraging optimized models to compute tool completions in < 500ms.
- **Deepgram Nova-2**: High-speed, context-aware Speech-to-Text streaming ensures immediate caller voice transcription.
- **In-Memory Vector Search**: Avoids cloud database network roundtrips, performing similarity matching in under 2ms.
- **Vapi Smart Barge-in**: Voice stream is immediately muted the moment a recruiter speaks, avoiding overlapping audio buffers.

---

## 💸 Cost Breakdown

### Voice Calls (per minute)
| Component | Provider | Cost / Min | Details |
| :--- | :--- | :--- | :--- |
| **STT** | Deepgram Nova-2 | $0.0043 | Ultra-low latency voice transcription |
| **LLM** | OpenAI GPT-4o-mini | $0.0015 | ~1000 input tokens / 200 output tokens |
| **TTS** | ElevenLabs Flash | $0.0150 | Premium lifelike voice streaming |
| **Orchestration** | Vapi.ai | $0.0500 | WebRTC / SIP call handling and bridging |
| **Telephony** | Twilio | $0.0130 | Standard US local number phone routing |
| **Total** | — | **$0.0838 / min** | **~$0.84 for a complete 10-minute call** |

### Chat Interface (per session)
- **Embedding Ingestion**: **$0.00003** (One-time cost to embed Shyam's resume + 23 repos via `text-embedding-3-small` - ~20k tokens).
- **Recruiter Chat Conversation**: **$0.0004 / message** (Using GPT-4o-mini with retrieved RAG context ~3,000 tokens input).
- **Total**: **~$0.0024 for a 6-message interview screening session**.

---

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v20+ or v22+)
- npm (v10+)
- An OpenAI API Key (or Gemini API Key)
- A Cal.com free account (or Calendly API access)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/shyam1444/Scaler_Assignment_ShyamV.git
cd Scaler_Assignment_ShyamV
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill out your keys:
```bash
cp .env.example .env
```
Key variables inside `.env`:
- `OPENAI_API_KEY`: Required for generating vector embeddings and driving the chat LLM.
- `CAL_API_KEY` & `CAL_EVENT_TYPE_ID`: (Optional) Your Cal.com configurations to book real meetings. If empty, the system falls back to a high-fidelity local scheduler database (`data/bookings.json`).
- `RESUME_PATH`: Path to your local resume PDF file. By default, it will seek `C:\Users\ShyamVenkatraman\Downloads\Shyam___Venkatraman___Resume_______.pdf`.

### 3. Run Ingestion Pipeline (RAG Setup)
This script parses the resume PDF, queries the GitHub API for Shyam's public repositories, builds text chunks, fetches vector embeddings, and writes the local database file `data/vector_db.json`.
```bash
npm run ingest
```

### 4. Compile and Start Backend
To launch the server locally on port 4000:
```bash
# Run in development mode (using ts-node watcher)
npm run dev

# Or build and start
npm run build
npm start
```
Open `http://localhost:4000` in your browser to interact with the chat interface and the live debugging panel!

---

## 📞 Voice Agent Setup (Vapi.ai)

To link the voice representative to a telephone number:
1. Create a free account at [Vapi.ai](https://vapi.ai).
2. Create a **New Assistant** and set the model to **GPT-4o-mini** (or use your custom endpoint).
3. Under **Tools**, define two custom function tools:
   - **`checkAvailability`**:
     ```json
     {
       "name": "checkAvailability",
       "description": "Check available interview slots for a date.",
       "parameters": {
         "type": "object",
         "properties": {
           "date": { "type": "string", "description": "Format YYYY-MM-DD" }
         },
         "required": ["date"]
       }
     }
     ```
   - **`bookMeeting`**:
     ```json
     {
       "name": "bookMeeting",
       "description": "Book a confirmed interview slot for the recruiter.",
       "parameters": {
         "type": "object",
         "properties": {
           "name": { "type": "string" },
           "email": { "type": "string" },
           "time": { "type": "string", "description": "ISO start time" }
         },
         "required": ["name", "email", "time"]
       }
     }
     ```
4. Expose your local server via a tunnel (e.g. `ngrok http 4000` or localtunnel) and input your tunnel URL as the **Server URL** in Vapi: `https://your-tunnel.ngrok-free.app/api/voice-webhook`.
5. Under Vapi **Phone Numbers**, buy or import a Twilio number and point it to your Vapi Assistant.

---

## 📊 Generating Evaluation PDF Report
To compile the 1-page PDF report:
```bash
npm run generate-report
```
This generates `evaluation_report.pdf` directly in the project root folder.
