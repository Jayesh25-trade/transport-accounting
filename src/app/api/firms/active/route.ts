/**
 * PATCH /api/firms/active — Update the currently active firm's profile details.
 * Restricted to ADMIN role members of the firm.
 * Only updates the columns that currently exist in the database schema.
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { firms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getFirmDetails } from "@/services/firm.service";
import { z } from "zod";

const FirmUpdateSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  pan: z.string().max(20).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
});

export const GET = createApiHandler(async (req, { firmId }) => {
  const firm = await getFirmDetails(db, firmId);
  return NextResponse.json({ success: true, data: firm });
});

export const PATCH = createApiHandler(
  async (req, { firmId, user }) => {
    const body = await req.json();
    const data = FirmUpdateSchema.parse(body);

    const updates: Record<string, any> = {};
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.pan !== undefined) updates.pan = data.pan;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.address !== undefined) updates.address = data.address;
    updates.updatedAt = new Date();

    await db.update(firms).set(updates).where(eq(firms.id, firmId));

    const updated = await getFirmDetails(db, firmId);
    return NextResponse.json({ success: true, data: updated });
  },
  { requiredRoles: ["ADMIN"] }
);
