# Aura Skincare - AI Voice CX Agent

This is a browser-based AI Voice Customer Support Agent built for Aura Skincare, designed to handle natural voice conversations, look up order details, and strictly adhere to brand policies.

## Tech Stack & Architecture

- **Frontend:** Next.js (App Router), React, CSS Modules (Glassmorphism UI)
- **Voice AI:** Google Gemini 3.8 Live API (Multimodal)
- **Audio Pipeline:** Web Audio API + AudioWorklet (for real-time PCM 16kHz audio processing)
- **Security:** Ephemeral Tokens (REST API) to keep the master Gemini API key secure on the server


## Local Setup Instructions

1. **Clone or download the repository**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up Environment Variables:**
   - Copy `.env.example` to `.env.local`
   - Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
   - Add your key to `.env.local`: `GEMINI_API_KEY=your_api_key_here`
4. **Run the development server:**
   ```bash
   npm run dev
   ```
5. **Open [http://localhost:3000](http://localhost:3000)** in your browser. (Ensure you grant microphone permissions when prompted).

## Features Implemented
- **Barge-in (Interruptability):** Supported natively via the Gemini Live WebSocket connection. When the user speaks while the agent is speaking, the WebSocket sends a `serverContent.interrupted` flag, and the client instantly halts audio playback.
- **Hinglish Support:** The system prompt explicitly instructs Aria to understand and speak Hinglish natively for a relatable D2C brand feel.
- **Low-latency Voice Interactions:** Achieved by bypassing STT/TTS middleware and streaming raw PCM audio directly to the Gemini Multimodal model.
- **Premium UI:** Custom dark-theme glassmorphism interface featuring a dynamic, state-reactive glowing energy aura.
- **Order Lookup:** Live order status checks and policy-compliant cancellation/return logic handled deterministically via function calling.

## Assessment Questions

**1. Why did you choose your particular architecture and technology stack?**  
I chose Next.js (App Router) for the frontend because it seamlessly integrates secure server-side logic (generating ephemeral API tokens and executing tool calls safely) alongside a robust React UI. For voice intelligence, I chose the **Gemini 3.8 Multimodal Live API via direct WebSockets**. Instead of a traditional, latency-heavy sequential pipeline (Speech-to-Text → LLM → Text-to-Speech), this architecture allows the AI to natively ingest raw audio and stream audio back. This drastically reduces latency, enables natural conversational flow, and natively supports "barge-in" (interrupting the AI mid-sentence).

**2. What was the most difficult part of the assignment, and how did you solve it?**  
The most challenging part was managing the real-time, bi-directional audio pipeline in the browser — specifically capturing 16kHz PCM audio without distortion and cleanly playing back the raw PCM streams received from the Gemini API. I solved this by implementing a custom Web Audio API `AudioWorklet` processor. This runs audio capture on a separate thread, preventing main-thread UI blocking, ensuring ultra-low latency, and allowing for instant audio interruption during a barge-in event.

**3. If you had one more week to work on this, what would you improve first and why?**  
I would implement **Retrieval-Augmented Generation (RAG)** for the brand's knowledge base. Right now, Aura Skincare's policies are hardcoded into the system prompt. Moving the knowledge base to a vector database would allow the agent to support thousands of products, FAQs, and complex changing policies without overflowing the system context window. Secondly, I would connect the mock `order-database.js` to a real PostgreSQL database with proper error handling for network timeouts.

**4. Imagine this agent is handling 1,000 customer conversations a day. What do you think would need to change or improve?**  
To scale to 1,000 daily conversations, three things must improve:
- **Infrastructure:** Relying on the client browser to maintain direct, long-lived WebSockets with the AI provider can be flaky on poor mobile networks. I would move the connection termination to a dedicated WebRTC infrastructure (like LiveKit or Twilio Media Streams) to handle network drops gracefully.
- **Observability:** We would need robust analytics—logging transcripts, running sentiment analysis on the generated summaries, and tracking tool-call failure rates to continuously fine-tune the prompt.
- **Human Handoff:** There must be an automated, graceful routing mechanism to transfer the call to a human agent (e.g., via Zendesk) if the AI detects high customer frustration or fails to resolve the issue after a certain number of turns.
