/**
 * Gemini Live API Client
 * 
 * Manages the WebSocket connection to Gemini Live API,
 * handles audio streaming, function calling, and state management.
 * 
 * Architecture:
 * 1. Client requests ephemeral token from /api/session
 * 2. Opens WebSocket to Gemini with the token
 * 3. Sends setup message with system prompt + tool declarations
 * 4. Streams microphone audio as base64 PCM chunks
 * 5. Receives audio responses and function calls
 * 6. Plays audio through speakers
 * 7. Executes function calls via /api/tools
 */

import { SYSTEM_PROMPT, TOOL_DECLARATIONS } from "./system-prompt";

const MODEL_NAME = "gemini-3.8-live";
const WS_BASE_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

// Agent states
export const AgentState = {
  IDLE: "idle",
  CONNECTING: "connecting",
  LISTENING: "listening",
  THINKING: "thinking",
  SPEAKING: "speaking",
  ERROR: "error",
};

export class GeminiLiveClient {
  constructor(callbacks = {}) {
    this.ws = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.workletNode = null;
    this.state = AgentState.IDLE;
    this.transcript = [];
    this.isSetupComplete = false;

    // Audio playback queue
    this.audioQueue = [];
    this.isPlaying = false;
    this.currentSource = null;

    // Callbacks for UI updates
    this.onStateChange = callbacks.onStateChange || (() => {});
    this.onTranscriptUpdate = callbacks.onTranscriptUpdate || (() => {});
    this.onError = callbacks.onError || (() => {});
    this.onAudioLevel = callbacks.onAudioLevel || (() => {});
  }

  /**
   * Start a voice conversation session.
   */
  async startSession() {
    try {
      this._setState(AgentState.CONNECTING);

      // 1. Get ephemeral token from our backend
      const tokenResponse = await fetch("/api/session", { method: "POST" });
      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        throw new Error(error.error || "Failed to get session token");
      }
      const { token } = await tokenResponse.json();

      // 2. Initialize audio context and microphone
      await this._initAudio();

      // 3. Connect WebSocket to Gemini
      const wsUrl = `${WS_BASE_URL}?access_token=${token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("[Gemini] WebSocket connected");
        this._sendSetup();
      };

      this.ws.onmessage = async (event) => {
        try {
          let data = event.data;
          if (data instanceof Blob) {
            data = await data.text();
          }
          this._handleMessage(JSON.parse(data));
        } catch (err) {
          console.error("[Gemini] Error parsing message:", err);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[Gemini] WebSocket error:", error);
        this._setState(AgentState.ERROR);
        this.onError("Connection error. Please try again.");
      };

      this.ws.onclose = (event) => {
        console.log("[Gemini] WebSocket closed:", event.code, event.reason);
        if (this.state !== AgentState.IDLE) {
          this._cleanup();
        }
      };
    } catch (error) {
      console.error("[Gemini] Failed to start session:", error);
      this._setState(AgentState.ERROR);
      this.onError(error.message);
      this._cleanup();
    }
  }

  /**
   * End the current voice session.
   * @returns {object} Call summary data
   */
  endSession() {
    const summary = this._generateSummary();
    this._cleanup();
    return summary;
  }

  /**
   * Send the initial setup/configuration message.
   */
  _sendSetup() {
    const setupMessage = {
      setup: {
        model: `models/${MODEL_NAME}`,
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        tools: [
          {
            functionDeclarations: TOOL_DECLARATIONS,
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          temperature: 0.3,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Leda",
              },
            },
            languageCode: "en-IN",
          },
        },
      },
    };

    this.ws.send(JSON.stringify(setupMessage));
    console.log("[Gemini] Setup message sent");
  }

  /**
   * Handle incoming messages from Gemini.
   */
  _handleMessage(message) {
    // Setup complete confirmation
    if (message.setupComplete) {
      console.log("[Gemini] Setup complete");
      this.isSetupComplete = true;
      this._setState(AgentState.LISTENING);
      this._startAudioCapture();
      
      // Trigger initial greeting — consistent every time
      this.ws.send(JSON.stringify({
        clientContent: {
          turns: [{ role: "user", parts: [{ text: "The call has just connected. Greet the customer now by saying exactly: 'Hello! Welcome to Aura Skincare. My name is Aria, and I am here to help you today. How can I assist you?'" }] }],
          turnComplete: true
        }
      }));
      return;
    }

    // Tool call request from Gemini
    if (message.toolCall) {
      this._setState(AgentState.THINKING);
      this._handleToolCall(message.toolCall);
      return;
    }

    // Server content (audio response, text, etc.)
    if (message.serverContent) {
      const content = message.serverContent;

      // Check if model is done speaking (turn complete)
      if (content.turnComplete) {
        console.log("[Gemini] Turn complete");
        // Don't change to LISTENING immediately — wait for audio to finish playing
        if (!this.isPlaying && this.audioQueue.length === 0) {
          this._setState(AgentState.LISTENING);
        }
        return;
      }

      // Check if model was interrupted (barge-in)
      if (content.interrupted) {
        console.log("[Gemini] Interrupted by user");
        this._stopAudioPlayback();
        this._setState(AgentState.LISTENING);
        return;
      }

      // Process model output parts
      if (content.modelTurn && content.modelTurn.parts) {
        for (const part of content.modelTurn.parts) {
          // Audio response
          if (part.inlineData && part.inlineData.mimeType?.startsWith("audio/")) {
            this._setState(AgentState.SPEAKING);
            this._queueAudio(part.inlineData.data);
          }

          // Text response (for transcript)
          if (part.text) {
            this._addToTranscript("agent", part.text);
          }
        }
      }

      // Input transcription (what the user said)
      if (content.inputTranscription && content.inputTranscription.text) {
        this._addToTranscript("user", content.inputTranscription.text);
      }

      // Output transcription (what the agent said, as text)
      if (content.outputTranscription && content.outputTranscription.text) {
        this._addToTranscript("agent", content.outputTranscription.text);
      }
    }
  }

  /**
   * Handle a tool/function call from Gemini.
   */
  async _handleToolCall(toolCall) {
    console.log("[Gemini] Tool call received:", toolCall);

    const results = [];

    for (const fc of toolCall.functionCalls) {
      console.log(`[Gemini] Executing function: ${fc.name}`, fc.args);

      try {
        // Execute the function via our server API
        const response = await fetch("/api/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            functionName: fc.name,
            args: fc.args,
          }),
        });

        const data = await response.json();

        results.push({
          id: fc.id,
          name: fc.name,
          response: { result: data.result },
        });

        // Add tool usage to transcript
        this._addToTranscript("system", `[Tool: ${fc.name}(${JSON.stringify(fc.args)})]`);
      } catch (error) {
        console.error(`[Gemini] Tool execution error:`, error);
        results.push({
          id: fc.id,
          name: fc.name,
          response: {
            result: {
              success: false,
              error: "Failed to execute this function. Please try again.",
            },
          },
        });
      }
    }

    // Send tool results back to Gemini
    const toolResponseMessage = {
      toolResponse: {
        functionResponses: results,
      },
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(toolResponseMessage));
      console.log("[Gemini] Tool response sent");
    }
  }

  /**
   * Initialize audio context and request microphone permission.
   */
  async _initAudio() {
    // Create AudioContext at 16kHz for Gemini's expected input
    this.audioContext = new AudioContext({ sampleRate: 16000 });

    // Request microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Load and register the audio worklet
    await this.audioContext.audioWorklet.addModule("/audio-worklet.js");
  }

  /**
   * Start capturing audio from the microphone and sending to Gemini.
   */
  _startAudioCapture() {
    if (!this.audioContext || !this.mediaStream) return;

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    this.workletNode = new AudioWorkletNode(
      this.audioContext,
      "audio-capture-processor"
    );

    this.workletNode.port.onmessage = (event) => {
      if (event.data.type === "audio" && this.ws?.readyState === WebSocket.OPEN) {
        // Convert ArrayBuffer to base64
        const base64Data = this._arrayBufferToBase64(event.data.data);

        // Send audio chunk to Gemini
        const audioMessage = {
          realtimeInput: {
            audio: {
              data: base64Data,
              mimeType: "audio/pcm;rate=16000",
            },
          },
        };

        this.ws.send(JSON.stringify(audioMessage));
      }
    };

    source.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);

    console.log("[Audio] Microphone capture started");
  }

  /**
   * Queue audio data for playback.
   */
  _queueAudio(base64Data) {
    this.audioQueue.push(base64Data);
    if (!this.isPlaying) {
      this._playNextAudio();
    }
  }

  /**
   * Play the next audio chunk from the queue.
   */
  async _playNextAudio() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      // If we were speaking and queue is empty, switch to listening
      if (this.state === AgentState.SPEAKING) {
        this._setState(AgentState.LISTENING);
      }
      return;
    }

    this.isPlaying = true;
    const base64Data = this.audioQueue.shift();

    try {
      // Create a separate AudioContext for playback at 24kHz (Gemini output rate)
      if (!this.playbackContext || this.playbackContext.state === "closed") {
        this.playbackContext = new AudioContext({ sampleRate: 24000 });
      }

      // Decode base64 to PCM Int16
      const pcmData = this._base64ToInt16Array(base64Data);
      
      // Convert Int16 to Float32 for Web Audio API
      const float32Data = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        float32Data[i] = pcmData[i] / 32768;
      }

      // Create audio buffer
      const audioBuffer = this.playbackContext.createBuffer(
        1, // mono
        float32Data.length,
        24000 // Gemini outputs at 24kHz
      );
      audioBuffer.getChannelData(0).set(float32Data);

      // Play the audio
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);

      source.onended = () => {
        this._playNextAudio();
      };

      this.currentSource = source;
      source.start();
    } catch (error) {
      console.error("[Audio] Playback error:", error);
      this._playNextAudio(); // Try next chunk
    }
  }

  /**
   * Stop any currently playing audio (for barge-in).
   */
  _stopAudioPlayback() {
    this.audioQueue = [];
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
  }

  /**
   * Add a message to the transcript.
   */
  _addToTranscript(role, text) {
    if (!text || text.trim() === "") return;

    // Avoid duplicate consecutive entries
    const lastEntry = this.transcript[this.transcript.length - 1];
    if (lastEntry && lastEntry.role === role && lastEntry.text === text.trim()) {
      return;
    }

    // If same role, append to the last entry
    if (lastEntry && lastEntry.role === role && role !== "system") {
      lastEntry.text += " " + text.trim();
      lastEntry.timestamp = new Date().toISOString();
    } else {
      this.transcript.push({
        role,
        text: text.trim(),
        timestamp: new Date().toISOString(),
      });
    }

    this.onTranscriptUpdate([...this.transcript]);
  }

  /**
   * Generate a structured call summary.
   */
  _generateSummary() {
    const userMessages = this.transcript
      .filter((t) => t.role === "user")
      .map((t) => t.text)
      .join(" ");

    const toolCalls = this.transcript
      .filter((t) => t.role === "system")
      .map((t) => t.text);

    // Extract order IDs mentioned
    const orderIdMatches = userMessages.match(/ORD-\d+/gi) || [];
    const orderIds = [...new Set(orderIdMatches.map((id) => id.toUpperCase()))];

    // Determine customer intent
    let customerIntent = "GENERAL_INQUIRY";
    const lowerText = userMessages.toLowerCase();
    if (lowerText.includes("track") || lowerText.includes("where") || lowerText.includes("status") || lowerText.includes("delivery")) {
      customerIntent = "ORDER_TRACKING";
    } else if (lowerText.includes("cancel")) {
      customerIntent = "ORDER_CANCELLATION";
    } else if (lowerText.includes("return") || lowerText.includes("refund")) {
      customerIntent = "RETURN_REFUND";
    } else if (lowerText.includes("product") || lowerText.includes("recommend")) {
      customerIntent = "PRODUCT_INQUIRY";
    } else if (lowerText.includes("shipping") || lowerText.includes("deliver")) {
      customerIntent = "SHIPPING_INQUIRY";
    }

    // Build summary text
    const agentMessages = this.transcript
      .filter((t) => t.role === "agent")
      .map((t) => t.text)
      .join(" ");

    const allText = userMessages + " " + agentMessages;
    const summaryText =
      allText.length > 200 ? allText.substring(0, 200) + "..." : allText;

    return {
      transcript: [...this.transcript],
      summary: {
        customer_intent: customerIntent,
        order_id: orderIds.length > 0 ? orderIds.join(", ") : null,
        resolution_status: toolCalls.length > 0 ? "RESOLVED" : "INFORMATIONAL",
        tools_used: toolCalls.map((t) => t.replace("[Tool: ", "").replace("]", "")),
        call_duration_seconds: this.transcript.length > 0
          ? Math.round(
              (new Date(this.transcript[this.transcript.length - 1].timestamp) -
                new Date(this.transcript[0].timestamp)) /
                1000
            )
          : 0,
        call_summary: summaryText,
      },
    };
  }

  /**
   * Set the current state and notify callback.
   */
  _setState(newState) {
    this.state = newState;
    this.onStateChange(newState);
  }

  /**
   * Clean up all resources.
   */
  _cleanup() {
    // Close WebSocket
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    // Stop audio playback
    this._stopAudioPlayback();

    // Close playback context
    if (this.playbackContext && this.playbackContext.state !== "closed") {
      this.playbackContext.close();
      this.playbackContext = null;
    }

    // Stop microphone
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isSetupComplete = false;
    this._setState(AgentState.IDLE);
  }

  // ─── Utility Methods ───────────────────────────────────────

  _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  _base64ToInt16Array(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }
}
