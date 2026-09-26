import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getFirmDetails } from "@/services/firm.service";
import { NextResponse } from "next/server";

export const GET = createApiHandler(async (req, { firmId }) => {
  const firm = await getFirmDetails(db, firmId);
  return NextResponse.json({ success: true, data: firm });
});
