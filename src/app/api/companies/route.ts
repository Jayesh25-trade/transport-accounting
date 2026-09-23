import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { createCompany, listCompanies } from "@/services/party.service";

export const GET = createApiHandler(async (req, { firmId }) => {
  return await listCompanies(db, firmId);
});

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  return await createCompany(db, { ...body, firmId });
});
