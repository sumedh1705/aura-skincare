/**
 * API Route: POST /api/session
 * 
 * Generates an ephemeral token for the Gemini Live API.
 * This keeps the actual API key on the server and only sends
 * a short-lived token to the client.
 */

import { NextResponse } from "next/server";

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    // Create ephemeral token via REST API
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uses: 1,
          expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
          newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 min
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to create ephemeral token:", errorText);
      return NextResponse.json(
        { error: "Failed to create session token.", details: errorText },
        { status: response.status }
      );
    }

    const tokenData = await response.json();

    return NextResponse.json({
      token: tokenData.name, // The ephemeral token string
      expiresAt: tokenData.expireTime,
    });
  } catch (error) {
    console.error("Error creating ephemeral token:", error);
    return NextResponse.json(
      { error: "Internal server error while creating session." },
      { status: 500 }
    );
  }
}
