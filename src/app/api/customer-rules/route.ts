import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { upsertCustomerRule, getCustomerRuleByParty } from "@/services/party.service";
import { AppError } from "@/lib/errors";

export const GET = createApiHandler(async (req, { firmId }) => {
  const partyId = req.nextUrl.searchParams.get("partyId");
  if (!partyId) {
    throw new AppError("Query parameter 'partyId' is required", "MISSING_PARAM");
  }
  return await getCustomerRuleByParty(db, partyId, firmId);
});

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  return await upsertCustomerRule(db, { ...body, firmId });
});
