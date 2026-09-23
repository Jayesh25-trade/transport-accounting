/**
 * Public endpoint: returns the list of registered firms.
 * This route does NOT require x-firm-id header — it IS the source
 * from which the frontend resolves firm UUIDs for further requests.
 *
 * Only safe, non-sensitive firm metadata is returned (id, name, code).
 */
import { NextResponse } from "next/server";
import { db } from "@/db";
import { firms } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const result = await db
      .select({
        id: firms.id,
        name: firms.name,
        code: firms.code,
      })
      .from(firms)
      .where(eq(firms.isActive, true));

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[API_FIRMS]", err);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load firms", code: "INTERNAL_SERVER_ERROR" } },
      { status: 500 }
    );
  }
}
