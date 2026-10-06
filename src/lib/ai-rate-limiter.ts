/**
 * ai-rate-limiter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * In-memory per-user rate limiter for the AI chat endpoint.
 *
 * Limits: 20 requests per user per 60-second sliding window.
 *
 * NOTE: This is an in-memory implementation suitable for single-instance
 * deployments (dev, single-server prod). For multi-instance deployments,
 * replace with a Redis-backed implementation using the same interface.
 *
 * RULES (DO NOT CHANGE):
 *  • Keys are userId strings — never firmId or IP address alone.
 *  • No user data is stored — only count and window reset timestamp.
 *  • Stale entries are pruned on every check to prevent memory growth.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Milliseconds until window resets (only set when allowed=false) */
  retryAfterMs?: number;
}

interface WindowEntry {
  count: number;
  resetAt: number; // Unix ms
}

// ── Configuration ─────────────────────────────────────────────────────────────
const WINDOW_MS = 60 * 1000;   // 60-second window
const MAX_REQUESTS = 20;        // requests per user per window

// ── State (module-level singleton) ────────────────────────────────────────────
const _windowMap = new Map<string, WindowEntry>();

/** Prune expired entries to prevent unbounded memory growth. */
function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of _windowMap) {
    if (now > entry.resetAt) {
      _windowMap.delete(key);
    }
  }
}

/**
 * Checks and records a request for the given userId.
 * Returns whether the request is allowed and how many remain.
 */
export function checkAIRateLimit(userId: string): RateLimitResult {
  pruneExpired();

  const now = Date.now();
  const existing = _windowMap.get(userId);

  // New window or expired window → reset
  if (!existing || now > existing.resetAt) {
    _windowMap.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  // Within window — check count
  if (existing.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: existing.resetAt - now,
    };
  }

  existing.count++;
  return { allowed: true, remaining: MAX_REQUESTS - existing.count };
}
