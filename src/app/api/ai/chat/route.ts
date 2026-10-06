/**
 * POST /api/ai/chat
 * ─────────────────────────────────────────────────────────────────────────────
 * Transport Accounting AI assistant endpoint.
 *
 * SECURITY:
 *  • Protected by createApiHandler — requires valid session + firm membership.
 *  • Per-user rate limit: 20 requests per 60 seconds (in-memory).
 *  • The Groq API key is NEVER returned in responses or logs.
 *  • Groq 429 is re-raised as 503.
 *  • This endpoint is READ-ONLY — no writes to any table.
 *
 * REQUEST (POST JSON):
 *  { message: string, history?: {role, content}[] }
 *
 * RESPONSE (200):
 *  { answer: string, modelUsed: string, tokensUsed?: number, intent: string }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { askAI } from "@/services/ai.service";
import { checkAIRateLimit } from "@/lib/ai-rate-limiter";
import { firms } from "@/db/schema";
import { eq } from "drizzle-orm";

// ── Input validation schema ───────────────────────────────────────────────────
const ChatRequestSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message is too long (max 2000 characters)"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        // Each individual history turn is capped at 2000 chars
        content: z.string().max(2000, "History message too long"),
      })
    )
    // F4: Cap at 10 turns (5 exchanges) — service already uses only last 6
    .max(10, "History too long (max 10 turns)")
    .optional()
    .default([]),
});

// ── Structured audit logger (F5) ──────────────────────────────────────────────
/**
 * Writes a structured AI request audit record to server logs.
 * Message content is intentionally NOT logged for privacy.
 */
function logAIRequest(params: {
  userId: string;
  userEmail: string;
  firmId: string;
  intent: string;
  tokensUsed?: number;
  durationMs: number;
  status: "success" | "rate_limited" | "error";
  errorCode?: string;
}): void {
  console.log(
    JSON.stringify({
      type: "AI_REQUEST",
      timestamp: new Date().toISOString(),
      userId: params.userId,
      userEmail: params.userEmail,
      firmId: params.firmId,
      intent: params.intent,
      tokensUsed: params.tokensUsed ?? null,
      durationMs: params.durationMs,
      status: params.status,
      errorCode: params.errorCode ?? null,
    })
  );
}

// ── Route handler ─────────────────────────────────────────────────────────────
export const POST = createApiHandler(async (req: NextRequest, { firmId, user }) => {
  const startMs = Date.now();

  // 1. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { message: "Invalid JSON body", code: "BAD_REQUEST" } },
      { status: 400 }
    );
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      },
      { status: 400 }
    );
  }

  const { message, history } = parsed.data;
  const userId = user?.id || "anonymous";
  const userEmail = user?.email || "unknown";

  // 2. F1 — Per-user rate limit check
  const rateCheck = checkAIRateLimit(userId);
  if (!rateCheck.allowed) {
    logAIRequest({
      userId,
      userEmail,
      firmId,
      intent: "unknown",
      durationMs: Date.now() - startMs,
      status: "rate_limited",
      errorCode: "AI_RATE_LIMITED",
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Too many requests. Please wait a moment before asking again.",
          code: "AI_RATE_LIMITED",
          retryAfterSeconds: Math.ceil((rateCheck.retryAfterMs || 60000) / 1000),
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // 3. Fetch firm name for personalised AI prompt
  let firmName = "Your Transport Firm";
  try {
    const [firm] = await db
      .select({ name: firms.name })
      .from(firms)
      .where(eq(firms.id, firmId))
      .limit(1);
    if (firm?.name) firmName = firm.name;
  } catch {
    // Non-fatal — continue with default name
  }

  // 4. Call AI service
  try {
    const result = await askAI(db, {
      message,
      history,
      firmId,
      firmName,
    });

    // F5 — Log successful AI request (no message content logged)
    logAIRequest({
      userId,
      userEmail,
      firmId,
      intent: result.intent,
      tokensUsed: result.tokensUsed,
      durationMs: Date.now() - startMs,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      data: {
        answer: result.answer,
        modelUsed: result.modelUsed,
        tokensUsed: result.tokensUsed,
        intent: result.intent,
      },
    });
  } catch (err: any) {
    const errMsg: string = err?.message || "";

    // Key not configured
    if (errMsg.includes("GROQ_API_KEY")) {
      console.error("[AI Route] Groq API key not configured");
      logAIRequest({
        userId,
        userEmail,
        firmId,
        intent: "unknown",
        durationMs: Date.now() - startMs,
        status: "error",
        errorCode: "AI_NOT_CONFIGURED",
      });
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "AI service is not configured. Please contact the administrator.",
            code: "AI_NOT_CONFIGURED",
          },
        },
        { status: 503 }
      );
    }

    // Groq rate limit
    if (err?.status === 429 || errMsg.includes("rate limit")) {
      logAIRequest({
        userId,
        userEmail,
        firmId,
        intent: "unknown",
        durationMs: Date.now() - startMs,
        status: "rate_limited",
        errorCode: "GROQ_RATE_LIMITED",
      });
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "AI service is temporarily busy. Please try again in a moment.",
            code: "AI_RATE_LIMITED",
          },
        },
        { status: 503 }
      );
    }

    // Unexpected error
    console.error("[AI Route] Unexpected error:", errMsg);
    logAIRequest({
      userId,
      userEmail,
      firmId,
      intent: "unknown",
      durationMs: Date.now() - startMs,
      status: "error",
      errorCode: "AI_ERROR",
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "AI service encountered an error. Please try again.",
          code: "AI_ERROR",
        },
      },
      { status: 500 }
    );
  }
});
