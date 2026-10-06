/**
 * ai-client.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Singleton Groq SDK client for the Transport Accounting AI assistant.
 *
 * SECURITY RULES (DO NOT CHANGE):
 *  1. The API key is ONLY read from process.env.GROQ_API_KEY.
 *  2. The key value is NEVER logged, returned in responses, or exported.
 *  3. This module must remain server-side only (no "use client" directive).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Groq from "groq-sdk";

// ── Singleton instance ────────────────────────────────────────────────────────
let _groqClient: Groq | null = null;

/**
 * Returns a cached Groq client. Throws if GROQ_API_KEY is not set.
 * Call this lazily (inside request handlers), never at module initialisation
 * time, so that missing-key errors surface at runtime rather than build time.
 */
export function getGroqClient(): Groq {
  if (_groqClient) return _groqClient;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to .env.local and restart the dev server."
    );
  }

  _groqClient = new Groq({ apiKey });
  return _groqClient;
}

// ── Model configuration ───────────────────────────────────────────────────────
/** Primary Groq model. Uses process.env.GROQ_MODEL if set, or active supported model on Groq. */
export const AI_MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

/** Max tokens the model may generate in a single response. */
export const AI_MAX_TOKENS = 1024;

/** Temperature: 0.3 keeps answers factual and deterministic for accounting data. */
export const AI_TEMPERATURE = 0.3;
