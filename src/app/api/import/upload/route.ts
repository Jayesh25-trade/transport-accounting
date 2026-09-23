import { createApiHandler } from "@/lib/api-context";
import { db } from "@/db";
import { createAndStageImportBatch } from "@/services/import.service";
import { AppError } from "@/lib/errors";

export const POST = createApiHandler(async (req, { firmId }) => {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const financialYear = (formData.get("financialYear") as string) || "2024-25";
  const sheetName = (formData.get("sheetName") as string) || "";
  const headerRowIndex = Number(formData.get("headerRowIndex") || 0);

  if (!file) {
    throw new AppError("No file provided in form upload", "MISSING_FILE");
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  return await createAndStageImportBatch(db, firmId, {
    originalFileName: file.name,
    financialYear,
    sheetName,
    fileBuffer,
    headerRowIndex,
  });
});
