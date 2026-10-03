/**
 * /api/members — Firm Team Member Management
 * GET: List all members of the active firm (all roles)
 * POST: Create/invite a new member to the firm (ADMIN only)
 *
 * Server-side firm isolation: only members of the current firm
 * are ever returned. New members are bound to the active firm.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, userFirmMemberships } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createApiHandler } from "@/lib/api-context";
import { z } from "zod";
import { hashPassword } from "@/lib/password";

// ─── GET: List members of the active firm ────────────────────
export const GET = createApiHandler(async (req, ctx) => {
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: userFirmMemberships.role,
      isActive: userFirmMemberships.isActive,
      userIsActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: userFirmMemberships.createdAt,
    })
    .from(userFirmMemberships)
    .innerJoin(users, eq(users.id, userFirmMemberships.userId))
    .where(eq(userFirmMemberships.firmId, ctx.firmId))
    .orderBy(userFirmMemberships.createdAt);

  return members;
});

// ─── POST: Invite new member (ADMIN only) ────────────────────
const InviteSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(["ADMIN", "ACCOUNTANT", "MANAGER"]).default("ACCOUNTANT"),
  password: z.string().min(8).max(128),
});

export const POST = createApiHandler(
  async (req, ctx) => {
    const body = await req.json();
    const data = InviteSchema.parse(body);

    // Check email uniqueness
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()));

    if (existing.length > 0) {
      const existingUser = existing[0];
      // Check if already a member of this firm
      const alreadyMember = await db
        .select({ id: userFirmMemberships.id })
        .from(userFirmMemberships)
        .where(
          and(
            eq(userFirmMemberships.userId, existingUser.id),
            eq(userFirmMemberships.firmId, ctx.firmId)
          )
        );
      if (alreadyMember.length > 0) {
        throw new Error("This email is already a member of this firm.");
      }
      // Add existing user as member of this firm
      await db.insert(userFirmMemberships).values({
        userId: existingUser.id,
        firmId: ctx.firmId,
        role: data.role,
        isActive: true,
      });
      return { message: "Existing user added to firm", userId: existingUser.id };
    }

    // Create new user
    const passwordHash = hashPassword(data.password);
    const [newUser] = await db
      .insert(users)
      .values({
        firmId: ctx.firmId,
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash,
        role: data.role,
        isActive: true,
      })
      .returning({ id: users.id });

    // Create membership
    await db.insert(userFirmMemberships).values({
      userId: newUser.id,
      firmId: ctx.firmId,
      role: data.role,
      isActive: true,
    });

    return {
      message: "Team member created successfully",
      userId: newUser.id,
    };
  },
  { requiredRoles: ["ADMIN"] }
);
