// ============================================================
// AUTHENTICATION & CREDENTIAL SERVICE
// Handles login verification and authentication audit logs.
// Plaintext passwords are never stored or logged.
// ============================================================

import { db } from "@/db";
import { users, auditLogs, userFirmMemberships } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyPassword } from "@/lib/password";
import { AppError } from "@/lib/errors";
import { z } from "zod";

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
  action: "LOGIN_SUCCESS" | "LOGIN_FAILED" | "LOGOUT",
  userId: string | null,
  email: string,
  firmId: string | null,
  ipAddress: string,
  details?: any
) {
  try {
    let mappedAction: "LOGIN" | "LOGOUT" | "UPDATE" = "LOGIN";
    if (action === "LOGOUT") mappedAction = "LOGOUT";

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
 * Returns generic error message ("Invalid email or password") on credential failure.
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

  // Verify password hash
  const isValid = verifyPassword(password, userRecord.passwordHash);

  if (!isValid) {
    await logAuthEvent("LOGIN_FAILED", userRecord.id, email, userRecord.firmId, ipAddress, { reason: "INVALID_PASSWORD" });
    throw new AppError("Invalid email or password", "INVALID_CREDENTIALS");
  }

  // Update last login timestamp on successful authentication
  const now = new Date();
  await db
    .update(users)
    .set({
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

