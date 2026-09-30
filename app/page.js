"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { GeminiLiveClient, AgentState } from "@/lib/gemini-live";
import { getAllOrders } from "@/lib/order-database";

// ─── State Label Map ───
const stateLabels = {
  [AgentState.IDLE]: "Ready",
  [AgentState.CONNECTING]: "Connecting...",
  [AgentState.LISTENING]: "Listening",
  [AgentState.THINKING]: "Thinking",
  [AgentState.SPEAKING]: "Speaking",
  [AgentState.ERROR]: "Error",
};

// ─── Status Class Map ───
const stateClassMap = {
  [AgentState.IDLE]: "",
  [AgentState.CONNECTING]: "thinking",
  [AgentState.LISTENING]: "listening",
  [AgentState.THINKING]: "thinking",
  [AgentState.SPEAKING]: "speaking",
  [AgentState.ERROR]: "error",
};

export default function Home() {
  const [agentState, setAgentState] = useState(AgentState.IDLE);
  const [transcript, setTranscript] = useState([]);
  const [callSummary, setCallSummary] = useState(null);
  const [error, setError] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);

  const clientRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const orders = getAllOrders();

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcript]);

  // Start call
  const handleStartCall = useCallback(async () => {
    setError(null);
    setCallSummary(null);
    setTranscript([]);
    setIsCallActive(true);

    const client = new GeminiLiveClient({
      onStateChange: (newState) => setAgentState(newState),
      onTranscriptUpdate: (newTranscript) => setTranscript(newTranscript),
      onError: (errorMsg) => setError(errorMsg),
    });

    clientRef.current = client;
    await client.startSession();
  }, []);

  // End call
  const handleEndCall = useCallback(() => {
    if (clientRef.current) {
      const summary = clientRef.current.endSession();
      setCallSummary(summary);
      clientRef.current = null;
    }
    setIsCallActive(false);
  }, []);

  const isActive = isCallActive && agentState !== AgentState.IDLE && agentState !== AgentState.ERROR;
  const stateClass = stateClassMap[agentState] || "";

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-logo">
          <div className="brand-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 1L14.8 9.2L23 12L14.8 14.8L12 23L9.2 14.8L1 12L9.2 9.2L12 1Z" fill="url(#aura_grad)"/>
              <defs>
                <linearGradient id="aura_grad" x1="1" y1="1" x2="23" y2="23" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#ffffff" />
                  <stop offset="1" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1>Aura Skincare</h1>
            <span>AI Voice Support</span>
          </div>
        </div>
        <div className={`state-indicator ${stateClass}`}>
          <span className="state-dot"></span>
          {stateLabels[agentState]}
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Left Panel - Voice Agent */}
        <section className="agent-panel">
          <div className="agent-visualizer">
            {/* Animated Orb with Agent Avatar */}
            <div className="orb-container">
              <div className={`orb ${stateClass}`}></div>
              {isActive && (
                <>
                  <div className={`orb-ring ${stateClass === "listening" ? "active" : ""}`}></div>
                  <div className={`orb-ring ${stateClass === "listening" ? "active" : ""}`}></div>
                  <div className={`orb-ring ${stateClass === "listening" ? "active" : ""}`}></div>
                </>
              )}
            </div>

            {/* Agent Info */}
            <div className="agent-info">
              <div className="agent-name">Aria</div>
              <div className="agent-role">Aura Skincare Support</div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="error-banner">
                ⚠️ {error}
              </div>
            )}

            {/* Call Controls */}
            <div className="call-controls">
              {!isCallActive ? (
                <button
                  className="btn btn-start"
                  onClick={handleStartCall}
                  id="start-call-btn"
                >
                  Start Call
                </button>
              ) : (
                <button
                  className="btn btn-end"
                  onClick={handleEndCall}
                  id="end-call-btn"
                >
                  End Call
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Right Panel - Orders + Transcript + Summary */}
        <aside className="side-panel">
          {/* Test Orders */}
          <div className="panel-section">
            <div className="panel-section-title">📦 Test Orders</div>
            {orders.map((order) => (
              <div className="order-card" key={order.orderId}>
                <div className="order-card-header">
                  <span className="order-id">{order.orderId}</span>
                  <span
                    className={`order-status ${
                      order.status === "Processing"
                        ? "status-processing"
                        : order.status === "Out for Delivery"
                        ? "status-out-for-delivery"
                        : "status-delivered"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
                <div className="order-detail">
                  <div><strong>{order.customerName}</strong> — {order.product}</div>
                  <div>₹{order.value}{order.courier ? ` · ${order.courier}` : ""}{order.trackingId ? ` — ${order.trackingId}` : ""}</div>
                  <div className="order-note">{order.notes}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Transcript */}
          <div className="panel-section" style={{ flex: 1, display: "flex", flexDirection: "column", borderBottom: "none" }}>
            <div className="panel-section-title">
              {callSummary ? "📝 Call Transcript" : "💬 Live Transcript"}
            </div>

            <div className="transcript-container">
              {transcript.length === 0 && !callSummary ? (
                <div className="transcript-empty">
                  <span style={{ fontSize: "1.5rem", opacity: 0.5 }}>💬</span>
                  <span>Start a call to see the conversation here</span>
                </div>
              ) : (
                transcript.map((entry, index) => (
                  <div className="transcript-entry" key={index}>
                    <div className={`transcript-avatar ${entry.role}`}>
                      {entry.role === "user" ? "U" : entry.role === "agent" ? "A" : "⚡"}
                    </div>
                    <div className="transcript-bubble">
                      <div className="transcript-role">
                        {entry.role === "user" ? "Customer" : entry.role === "agent" ? "Aria" : "System"}
                      </div>
                      <div className={`transcript-text ${entry.role === "system" ? "system-text" : ""}`}>
                        {entry.text}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          {/* Call Summary (shown after call ends) */}
          {callSummary && (
            <div className="call-summary">
              <div className="panel-section-title">📊 Call Summary</div>
              <div className="summary-json">
                {JSON.stringify(callSummary.summary, null, 2)}
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
