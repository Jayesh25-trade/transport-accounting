/**
 * GET  /api/firms/[id] — Return full firm details (name, code, address, phone, pan, gstin).
 *                         Used by the in-app Bill Preview to render the firm header.
 * PATCH /api/firms/[id] — Edit a specific firm or deactivate it.
 * ADMIN only for PATCH. GET is available to all authenticated users in the firm.
 */

import { NextRequest } from "next/server";
import { db } from "@/db";
import { firms, bills, trips } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { createApiHandler } from "@/lib/api-context";
import { z } from "zod";

// ─── GET: full firm details for authenticated users ──────────
export const GET = createApiHandler(async (req, ctx) => {
  const firmId = ctx.params?.id as string;
  if (!firmId) throw new Error("Firm ID required");

  const [firm] = await db
    .select({
      id: firms.id,
      name: firms.name,
      code: firms.code,
      pan: firms.pan,
      phone: firms.phone,
      address: firms.address,
      isActive: firms.isActive,
    })
    .from(firms)
    .where(eq(firms.id, firmId))
    .limit(1);

  if (!firm) throw new Error("Firm not found");
  return firm;
});

const PatchFirmSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  pan: z.string().max(20).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const PATCH = createApiHandler(
  async (req, ctx) => {
    const firmId = ctx.params?.id as string;
    if (!firmId) throw new Error("Firm ID required");

    const body = await req.json();
    const data = PatchFirmSchema.parse(body);

    // Deactivation guard: cannot deactivate a firm with financial history
    if (data.isActive === false) {
      const [billCount] = await db
        .select({ count: count() })
        .from(bills)
        .where(eq(bills.firmId, firmId));

      const [tripCount] = await db
        .select({ count: count() })
        .from(trips)
        .where(eq(trips.firmId, firmId));

      if (Number(billCount?.count || 0) > 0 || Number(tripCount?.count || 0) > 0) {
        throw new Error(
          "Cannot deactivate a firm that has existing bills or trip records. Financial history must be preserved."
        );
      }
    }

    const updates: Record<string, any> = {};
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.pan !== undefined) updates.pan = data.pan;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.address !== undefined) updates.address = data.address;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    updates.updatedAt = new Date();

    await db.update(firms).set(updates).where(eq(firms.id, firmId));

    return { message: "Firm updated successfully" };
  },
  { requiredRoles: ["ADMIN"] }
);
