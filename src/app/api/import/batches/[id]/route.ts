import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { getImportBatchPreview } from "@/services/import.service";

export const GET = createApiHandler(async (req, { firmId, params }) => {
  const { id } = await params;
  return await getImportBatchPreview(db, firmId, id);
});
