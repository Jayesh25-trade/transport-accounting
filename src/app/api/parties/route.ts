import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { createParty, listParties } from "@/services/party.service";

export const GET = createApiHandler(async (req, { firmId }) => {
  return await listParties(db, firmId);
});

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  return await createParty(db, { ...body, firmId });
});
