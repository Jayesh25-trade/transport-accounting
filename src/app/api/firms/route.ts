/**
 * POST /api/firms — Create a new firm (ADMIN only).
 * Automatically creates a membership for the requesting user as ADMIN of the new firm.
 *
 * GET /api/firms — Lists active firms (public, used by firm-context).
 * Existing logic preserved.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { firms, userFirmMemberships } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createApiHandler } from "@/lib/api-context";
import { z } from "zod";

// ─── GET: public firm list ────────────────────────────────────
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

// ─── POST: Create a new firm ──────────────────────────────────
const NewFirmSchema = z.object({
  name: z.string().min(2).max(255),
  code: z.string().min(2).max(50).toUpperCase(),
  pan: z.string().max(20).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
});

export const POST = createApiHandler(
  async (req, { user }) => {
    const body = await req.json();
    const data = NewFirmSchema.parse(body);

    // Check code uniqueness
    const existing = await db
      .select({ id: firms.id })
      .from(firms)
      .where(eq(firms.code, data.code.toUpperCase()));

    if (existing.length > 0) {
      throw new Error(`Firm code '${data.code}' is already in use. Choose a unique code.`);
    }

    const [newFirm] = await db
      .insert(firms)
      .values({
        name: data.name.trim(),
        code: data.code.toUpperCase(),
        pan: data.pan || null,
        phone: data.phone || null,
        address: data.address || null,
        isActive: true,
      })
      .returning({ id: firms.id, name: firms.name, code: firms.code });

    // Auto-assign the requesting user as ADMIN of the new firm
    if (user?.id) {
      await db.insert(userFirmMemberships).values({
        userId: user.id,
        firmId: newFirm.id,
        role: "ADMIN",
        isActive: true,
      });
    }

    return { message: "Firm created successfully", firm: newFirm };
  },
  { requiredRoles: ["ADMIN"] }
);
