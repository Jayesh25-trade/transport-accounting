import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getCompanyById, updateCompany, deleteCompany } from "@/services/party.service";

export const GET = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  return await getCompanyById(db, id, firmId);
});

export const PUT = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  const body = await req.json();
  return await updateCompany(db, id, { ...body, firmId });
});

export const DELETE = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  return await deleteCompany(db, id, firmId);
});
