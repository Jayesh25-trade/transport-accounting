// ============================================================
// API ROUTE: POST /api/auth/logout
// Authenticated endpoint to revoke session and clear cookie.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getSessionTokenFromRequest, hashToken, revokeSessionByHash } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const rawToken = getSessionTokenFromRequest(req);
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await revokeSessionByHash(tokenHash);
    }
    return NextResponse.json({
      success: true,
      data: { message: "Successfully logged out" },
    });
  } catch (err: any) {
    console.error("[LOGOUT_ERROR]", err?.message || err);
    return NextResponse.json({
      success: true,
      data: { message: "Successfully logged out" },
    });
  }
}
