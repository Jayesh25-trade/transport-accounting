/**
 * POST /api/auth/change-password — Change the authenticated user's password.
 * Requires current password for verification before updating.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateRequestSession } from "@/lib/session";
import { verifyPassword, hashPassword } from "@/lib/password";
import { z } from "zod";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Confirm password is required"),
});

export async function POST(req: NextRequest) {
  try {
    // Verify session
    const session = await validateRequestSession(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Authentication required", code: "UNAUTHENTICATED" } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const data = ChangePasswordSchema.parse(body);

    if (data.newPassword !== data.confirmPassword) {
      return NextResponse.json(
        { success: false, error: { message: "New password and confirm password do not match", code: "PASSWORD_MISMATCH" } },
        { status: 400 }
      );
    }

    // Fetch current user record
    const [userRecord] = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: { message: "User not found", code: "USER_NOT_FOUND" } },
        { status: 404 }
      );
    }

    // Verify current password
    const isValid = verifyPassword(data.currentPassword, userRecord.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: { message: "Current password is incorrect", code: "INVALID_CURRENT_PASSWORD" } },
        { status: 400 }
      );
    }

    // Hash and save new password
    const newHash = hashPassword(data.newPassword);
    await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, userRecord.id));

    return NextResponse.json({ success: true, data: { message: "Password changed successfully" } });
  } catch (err: any) {
    if (err?.issues) {
      return NextResponse.json(
        { success: false, error: { message: err.issues[0]?.message || "Validation failed", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }
    console.error("[CHANGE_PASSWORD]", err?.message || err);
    return NextResponse.json(
      { success: false, error: { message: "An unexpected error occurred", code: "INTERNAL_SERVER_ERROR" } },
      { status: 500 }
    );
  }
}
