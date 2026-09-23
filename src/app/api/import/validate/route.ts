import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { validateAndMapImportBatch } from "@/services/import.service";
import { AppError } from "@/lib/errors";

export const POST = createApiHandler(async (req, { firmId }) => {
  const body = await req.json();
  const { batchId, columnMapping, masterMapping } = body;

  if (!batchId) {
    throw new AppError("batchId is required", "MISSING_PARAM");
  }
  if (!columnMapping) {
    throw new AppError("columnMapping is required", "MISSING_PARAM");
  }

  return await validateAndMapImportBatch(
    db,
    firmId,
    batchId,
    columnMapping,
    masterMapping || {}
  );
});
