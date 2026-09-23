// ============================================================
// API ROUTE: GET /api/auth/me
// Returns profile and firm membership context for current authenticated session.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { validateRequestSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const sessionCtx = await validateRequestSession(req);

  if (!sessionCtx) {
    return NextResponse.json(
      {
        success: false,
        error: { message: "Unauthenticated", code: "UNAUTHENTICATED" },
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      user: sessionCtx.user,
      memberships: sessionCtx.memberships,
      activeFirmId: sessionCtx.activeFirmId,
    },
  });
}
