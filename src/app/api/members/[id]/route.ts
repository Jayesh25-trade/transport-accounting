/**
 * /api/members/[id] — Individual member management
 * PATCH: Update member role or deactivate (ADMIN only)
 */

import { NextRequest } from "next/server";
import { db } from "@/db";
import { users, userFirmMemberships } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createApiHandler } from "@/lib/api-context";
import { z } from "zod";

const PatchSchema = z.object({
  role: z.enum(["ADMIN", "ACCOUNTANT", "MANAGER"]).optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = createApiHandler(
  async (req, ctx) => {
    const memberId = ctx.params?.id as string;
    if (!memberId) throw new Error("Member ID required");

    const body = await req.json();
    const data = PatchSchema.parse(body);

    // Prevent self-deactivation
    if (data.isActive === false && ctx.user?.id === memberId) {
      throw new Error("You cannot deactivate your own account.");
    }

    // Verify member belongs to this firm
    const membership = await db
      .select({ id: userFirmMemberships.id })
      .from(userFirmMemberships)
      .where(
        and(
          eq(userFirmMemberships.userId, memberId),
          eq(userFirmMemberships.firmId, ctx.firmId)
        )
      );

    if (membership.length === 0) {
      throw new Error("Member not found in this firm.");
    }

    // Update membership
    const updates: Partial<typeof userFirmMemberships.$inferInsert> = {};
    if (data.role !== undefined) updates.role = data.role;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    if (Object.keys(updates).length > 0) {
      await db
        .update(userFirmMemberships)
        .set({ ...updates, updatedAt: new Date() })
        .where(
          and(
            eq(userFirmMemberships.userId, memberId),
            eq(userFirmMemberships.firmId, ctx.firmId)
          )
        );
    }

    return { message: "Member updated successfully" };
  },
  { requiredRoles: ["ADMIN"] }
);
