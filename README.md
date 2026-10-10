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


