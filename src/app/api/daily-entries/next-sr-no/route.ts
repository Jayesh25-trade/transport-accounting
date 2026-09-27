import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getNextSrNo } from "@/services/daily-entry.service";

export const GET = createApiHandler(async (req, { firmId }) => {
  const nextSrNo = await getNextSrNo(db, firmId);
  return { nextSrNo };
});
