import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getAuditLogs } from "@/services/audit.service";
import { NextResponse } from "next/server";

export const GET = createApiHandler(async (req, { user, firmId }) => {
  // Security Enforcement: ADMIN Role Only
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Access Denied: Audit logs are restricted to ADMIN users only.",
          code: "FORBIDDEN",
        },
      },
      { status: user ? 403 : 401 }
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || undefined;
  const entityName = url.searchParams.get("entityName") || undefined;
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);

  const result = await getAuditLogs(db, firmId, {
    action,
    entityName,
    startDate,
    endDate,
    page,
    limit,
  });

  return NextResponse.json({ success: true, ...result });
});
