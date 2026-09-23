import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getPartyById, updateParty } from "@/services/party.service";

export const GET = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  return await getPartyById(db, id, firmId);
});

export const PUT = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  const body = await req.json();
  return await updateParty(db, id, { ...body, firmId });
});
