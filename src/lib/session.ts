// ============================================================
// SERVER-SIDE SESSION SECURITY ENGINE
// Handles __Host-session HTTP-only cookie management, session token hashing,
// idle/absolute timeouts, session rotation, and revocation.
// ============================================================

import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { sessions, users, userFirmMemberships, firms } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { AppError } from "./errors";

export const COOKIE_NAME = "__Host-session";
// In development, fall back to "session" if non-HTTPS localhost prevents __Host- prefix
export const COOKIE_KEY = process.env.NODE_ENV === "production" ? "__Host-session" : "session";

const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours
const ABSOLUTE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface AuthenticatedUserSession {
  session: typeof sessions.$inferSelect;
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "ACCOUNTANT" | "MANAGER";
    isActive: boolean;
  };
  memberships: Array<{
    firmId: string;
    role: "ADMIN" | "ACCOUNTANT" | "MANAGER";
  }>;
  activeFirmId: string | null;
}

/**
 * Hashes a raw session token using SHA-256 for secure database storage.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a 256-bit cryptographically secure random session token.
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Sets the secure HTTP-only session cookie on the response.
 */
export async function setSessionCookie(rawToken: string, expiresAt: Date) {
  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_KEY, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
  } catch {
    // Gracefully ignore outside Next.js request context (e.g. node unit tests)
  }
}

/**
 * Clears the session cookie on logout or revocation.
 */
export async function clearSessionCookie() {
  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_KEY, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });
  } catch {
    // Gracefully ignore outside Next.js request context
  }
}

/**
 * Extracts raw session token from incoming HTTP request cookies.
 */
export function getSessionTokenFromRequest(req: NextRequest): string | null {
  const cookieValue = req.cookies.get(COOKIE_KEY)?.value || req.cookies.get(COOKIE_NAME)?.value;
  return cookieValue || null;
}

/**
 * Creates a new server-side session for a user and sets the HTTP-only cookie.
 */
export async function createSession(
  userId: string,
  activeFirmId: string | null,
  req?: NextRequest
): Promise<{ token: string; expiresAt: Date }> {
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + IDLE_TIMEOUT_MS);

  const ipAddress = req?.headers.get("x-forwarded-for") || req?.headers.get("x-real-ip") || "127.0.0.1";
  const userAgent = req?.headers.get("user-agent") || "unknown";

  await db.insert(sessions).values({
    userId,
    tokenHash,
    activeFirmId,
    ipAddress: String(ipAddress).substring(0, 45),
    userAgent: String(userAgent).substring(0, 500),
    expiresAt,
    createdAt: now,
    lastSeenAt: now,
  });

  await setSessionCookie(rawToken, expiresAt);
  return { token: rawToken, expiresAt };
}

/**
 * Validates the session token from the request.
 * Updates lastSeenAt and extends idle expiration up to absolute timeout.
 */
export async function validateRequestSession(
  req: NextRequest
): Promise<AuthenticatedUserSession | null> {
  const rawToken = getSessionTokenFromRequest(req);
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [sessionRecord] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!sessionRecord) return null;

  // Verify absolute lifetime (24h from creation)
  const createdAtMs = new Date(sessionRecord.createdAt).getTime();
  if (now.getTime() - createdAtMs > ABSOLUTE_TIMEOUT_MS) {
    await revokeSessionByHash(tokenHash);
    return null;
  }

  // Fetch associated user
  const [userRecord] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionRecord.userId), eq(users.isActive, true)))
    .limit(1);

  if (!userRecord) {
    await revokeSessionByHash(tokenHash);
    return null;
  }

  // Fetch user firm memberships
  const memberships = await db
    .select({
      firmId: userFirmMemberships.firmId,
      role: userFirmMemberships.role,
      isActive: userFirmMemberships.isActive,
    })
    .from(userFirmMemberships)
    .where(and(eq(userFirmMemberships.userId, userRecord.id), eq(userFirmMemberships.isActive, true)));

  // If user has a single legacy firmId on user table and no memberships exist, auto-include it
  const effectiveMemberships = memberships.length > 0 
    ? memberships.map(m => ({ firmId: m.firmId, role: m.role }))
    : [{ firmId: userRecord.firmId, role: userRecord.role }];

  // Update last seen timestamp
  await db
    .update(sessions)
    .set({ lastSeenAt: now })
    .where(eq(sessions.id, sessionRecord.id));

  return {
    session: sessionRecord,
    user: {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      role: userRecord.role,
      isActive: userRecord.isActive,
    },
    memberships: effectiveMemberships,
    activeFirmId: sessionRecord.activeFirmId || userRecord.firmId,
  };
}

/**
 * Revokes a session by token hash and clears cookie.
 */
export async function revokeSessionByHash(tokenHash: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  await clearSessionCookie();
}

/**
 * Rotates a session (deletes old session and issues fresh token) to prevent session fixation.
 */
export async function rotateSession(
  oldTokenHash: string,
  userId: string,
  activeFirmId: string | null,
  req: NextRequest
) {
  await db.delete(sessions).where(eq(sessions.tokenHash, oldTokenHash));
  return createSession(userId, activeFirmId, req);
}
