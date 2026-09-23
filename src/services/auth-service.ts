// ============================================================
// AUTHENTICATION & CREDENTIAL SERVICE
// Handles login verification, brute-force lockout, and authentication audit logs.
// Plaintext passwords are never stored or logged.
// ============================================================

import { db } from "@/db";
import { users, auditLogs, userFirmMemberships } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyPassword } from "@/lib/password";
import { AppError } from "@/lib/errors";
import { z } from "zod";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface LoginResult {
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "ACCOUNTANT" | "MANAGER";
    firmId: string;
  };
}

/**
 * Logs authentication events to audit_logs table cleanly without storing passwords.
 */
export async function logAuthEvent(
  action: "LOGIN_SUCCESS" | "LOGIN_FAILED" | "LOGOUT" | "ACCOUNT_LOCKED",
  userId: string | null,
  email: string,
  firmId: string | null,
  ipAddress: string,
  details?: any
) {
  try {
    let mappedAction: "LOGIN" | "LOGOUT" | "UPDATE" = "LOGIN";
    if (action === "LOGOUT") mappedAction = "LOGOUT";
    if (action === "ACCOUNT_LOCKED") mappedAction = "UPDATE";

    const isUuid = (val?: string | null) => val && z.string().uuid().safeParse(val).success;
    const validUserId = isUuid(userId) ? userId : null;
    const validFirmId = isUuid(firmId) ? firmId : null;

    await db.insert(auditLogs).values({
      firmId: validFirmId,
      entityName: "AUTH",
      entityId: validUserId,
      userEmail: email,
      action: mappedAction,
      userId: validUserId,
      newValues: {
        event: action,
        email,
        ipAddress,
        ...details,
      },
      ipAddress: ipAddress ? String(ipAddress).substring(0, 45) : undefined,
    });
  } catch (err: any) {
    console.error("[AUTH_AUDIT_ERROR]", err?.message || err);
  }
}

/**
 * Verifies user credentials securely.
 * Enforces brute-force protection (lockout after 5 failed attempts for 15m).
 * Returns generic error message to prevent username enumeration.
 */
export async function authenticateCredentials(
  emailInput: string,
  passwordInput: string,
  ipAddress: string = "127.0.0.1"
): Promise<LoginResult> {
  const email = String(emailInput || "").trim().toLowerCase();
  const password = String(passwordInput || "");

  if (!email || !password) {
    throw new AppError("Invalid email or password", "INVALID_CREDENTIALS");
  }

  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!userRecord) {
    await logAuthEvent("LOGIN_FAILED", null, email, null, ipAddress, { reason: "UNKNOWN_USER" });
    throw new AppError("Invalid email or password", "INVALID_CREDENTIALS");
  }

  if (!userRecord.isActive) {
    await logAuthEvent("LOGIN_FAILED", userRecord.id, email, userRecord.firmId, ipAddress, { reason: "INACTIVE_USER" });
    throw new AppError("Account is disabled", "ACCOUNT_DISABLED");
  }

  // Check account lockout
  const now = new Date();
  if (userRecord.lockedUntil && new Date(userRecord.lockedUntil) > now) {
    await logAuthEvent("LOGIN_FAILED", userRecord.id, email, userRecord.firmId, ipAddress, { reason: "ACCOUNT_LOCKED" });
    throw new AppError("Account is temporarily locked due to multiple failed login attempts. Please try again later.", "ACCOUNT_LOCKED");
  }

  // Verify password hash
  const isValid = verifyPassword(password, userRecord.passwordHash);

  if (!isValid) {
    const newFailedAttempts = userRecord.failedLoginAttempts + 1;
    let lockedUntil: Date | null = null;

    if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
      await logAuthEvent("ACCOUNT_LOCKED", userRecord.id, email, userRecord.firmId, ipAddress, { attempts: newFailedAttempts });
    }

    await db
      .update(users)
      .set({
        failedLoginAttempts: newFailedAttempts,
        lockedUntil,
      })
      .where(eq(users.id, userRecord.id));

    await logAuthEvent("LOGIN_FAILED", userRecord.id, email, userRecord.firmId, ipAddress, { attempts: newFailedAttempts });
    throw new AppError("Invalid email or password", "INVALID_CREDENTIALS");
  }

  // Reset failed login attempts on successful authentication
  await db
    .update(users)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: now,
    })
    .where(eq(users.id, userRecord.id));

  await logAuthEvent("LOGIN_SUCCESS", userRecord.id, email, userRecord.firmId, ipAddress);

  return {
    user: {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      role: userRecord.role,
      firmId: userRecord.firmId,
    },
  };
}
