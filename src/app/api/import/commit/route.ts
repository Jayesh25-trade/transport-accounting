import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { commitImportBatch } from "@/services/import.service";
import { AppError } from "@/lib/errors";

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  const { batchId } = body;

  if (!batchId) {
    throw new AppError("batchId is required", "MISSING_PARAM");
  }

  return await commitImportBatch(db, firmId, batchId);
});
