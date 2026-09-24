// ============================================================
// API ROUTE: POST /api/auth/login
// Public endpoint for user credential verification and session creation.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateCredentials } from "@/services/auth-service";
import { createSession } from "@/lib/session";
import { AppError } from "@/lib/errors";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
  activeFirmId: z.string().uuid("Invalid firm ID").optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.parse(body);

    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const authResult = await authenticateCredentials(parsed.email, parsed.password, String(ipAddress));

    const selectedFirmId = parsed.activeFirmId || authResult.user.firmId;
    await createSession(authResult.user.id, selectedFirmId, req);

    return NextResponse.json({
      success: true,
      data: {
        user: authResult.user,
        activeFirmId: selectedFirmId,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Invalid email or password input", code: "VALIDATION_ERROR" },
        },
        { status: 400 }
      );
    }
    if (err instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          error: { message: err.message, code: err.code },
        },
        { status: err.code === "ACCOUNT_DISABLED" ? 403 : 401 }
      );
    }
    console.error("[LOGIN_ERROR]", err?.message || err);
    return NextResponse.json(
      {
        success: false,
        error: { message: "An unexpected error occurred during login", code: "INTERNAL_SERVER_ERROR" },
      },
      { status: 500 }
    );
  }
}
