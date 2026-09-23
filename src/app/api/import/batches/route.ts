import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { listImportBatches } from "@/services/import.service";

export const GET = createApiHandler(async (req, { firmId }) => {
  return await listImportBatches(db, firmId);
});
