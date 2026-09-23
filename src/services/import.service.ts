import * as XLSX from "xlsx";
import { sql, eq, and, inArray, desc } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  importBatches,
  rawImportRecords,
  importErrors,
  dailyEntries,
  trips,
  parties,
  companies,
  trucks,
  locations,
} from "../db/schema";
import { verifyPartyInFirm, verifyCompanyInFirm } from "./firm.service";
import { DomainValidationError, FirmIsolationError, EntityNotFoundError } from "../lib/errors";

export interface ColumnMapping {
  srNo?: string;
  entryDate?: string;
  truckNumber?: string;
  lrNumber?: string;
  fromLocation?: string;
  toLocation?: string;
  nWeight?: string;
  rWeight?: string;
  advance?: string;
  rate?: string;
  cash?: string;
  diesel?: string;
  account?: string;
  companyName?: string;
  partyName?: string;
  customerRate?: string;
  remarks?: string;
  isReceived?: string;
}

export interface MasterMapping {
  partyMapping?: Record<string, string>;   // Excel party name -> system partyId
  companyMapping?: Record<string, string>; // Excel company name -> system companyId
  truckMapping?: Record<string, string>;   // Excel truck raw -> system truckId
  locationMapping?: Record<string, string>;// Excel location raw -> system locationId
}

/**
 * Normalizes any date value (Excel serial number, ISO string, DD/MM/YYYY) to YYYY-MM-DD.
 */
export function parseImportDate(val: any): string | null {
  if (val === null || val === undefined || val === "") return null;

  // 1. If it's an Excel numeric date serial (e.g. 45556)
  if (typeof val === "number") {
    const parsedDate = XLSX.SSF.parse_date_code(val);
    if (parsedDate) {
      const y = parsedDate.y;
      const m = String(parsedDate.m).padStart(2, "0");
      const d = String(parsedDate.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // 2. ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  // 3. Indian format DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 4. Fallback JavaScript Date parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }

  return null;
}

/**
 * Parses an Excel / CSV buffer and extracts sheet metadata, row counts, and header row previews.
 */
export function inspectExcelWorkbook(fileBuffer: Buffer) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new DomainValidationError("Uploaded file buffer is empty");
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
  } catch (err: any) {
    throw new DomainValidationError("Failed to read Excel/CSV file workbook: " + err.message);
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new DomainValidationError("Workbook contains no readable sheets");
  }

  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    const rowCount = range.e.r - range.s.r + 1;
    const colCount = range.e.c - range.s.c + 1;

    // Convert sheet to JSON matrix (header + preview rows)
    const jsonRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });

    const headerRowIndex = 0;
    const headers = (jsonRows[0] || []).map((h: any) => String(h).trim());
    const previewRows = jsonRows.slice(1, 6);

    return {
      sheetName,
      rowCount,
      colCount,
      headers,
      previewRows,
      isEmpty: rowCount === 0 || headers.length === 0,
    };
  });

  if (sheets.every((s) => s.isEmpty)) {
    throw new DomainValidationError("Workbook contains only empty sheets");
  }

  return {
    sheetCount: sheets.length,
    sheets,
  };
}

/**
 * Creates an import batch and stages raw Excel rows into raw_import_records.
 */
export async function createAndStageImportBatch(
  db: NodePgDatabase<any>,
  firmId: string,
  input: {
    originalFileName: string;
    financialYear: string; // e.g. "2024-25"
    dataType?: "DAILY_ENTRIES" | "BILLS" | "PAYMENTS" | "LEDGER" | "MIXED";
    sheetName: string;
    fileBuffer: Buffer;
    headerRowIndex?: number;
    userId?: string;
  }
) {
  if (!input.originalFileName) {
    throw new DomainValidationError("Original file name is required");
  }
  if (!input.financialYear) {
    throw new DomainValidationError("Financial Year is required (e.g. 2024-25)");
  }

  const extension = input.originalFileName.split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls", "csv"].includes(extension || "")) {
    throw new DomainValidationError(`Unsupported file extension '.${extension}'. Only .xlsx, .xls, .csv files are supported.`);
  }

  const inspection = inspectExcelWorkbook(input.fileBuffer);
  const targetSheet = inspection.sheets.find((s) => s.sheetName === input.sheetName) || inspection.sheets[0];

  if (!targetSheet || targetSheet.isEmpty) {
    throw new DomainValidationError(`Sheet '${input.sheetName}' is empty or not found`);
  }

  const workbook = XLSX.read(input.fileBuffer, { type: "buffer", cellDates: true });
  const worksheet = workbook.Sheets[targetSheet.sheetName];

  // Parse rows with header row index
  const rawMatrix = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
  const headerIdx = input.headerRowIndex ?? 0;

  if (headerIdx >= rawMatrix.length) {
    throw new DomainValidationError(`Header row index ${headerIdx} exceeds total row count ${rawMatrix.length}`);
  }

  const headers = (rawMatrix[headerIdx] || []).map((h: any) => String(h).trim());
  const dataRows = rawMatrix.slice(headerIdx + 1);

  if (dataRows.length === 0) {
    throw new DomainValidationError("Excel file contains headers but zero data rows");
  }

  return await db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(importBatches)
      .values({
        firmId,
        uploadedBy: input.userId || null,
        originalFileName: input.originalFileName,
        financialYear: input.financialYear,
        dataType: input.dataType || "DAILY_ENTRIES",
        status: "UPLOADED",
        totalRows: dataRows.length,
        validRows: 0,
        errorRows: 0,
        committedRows: 0,
      })
      .returning();

    // Convert matrix rows to object records using headers
    const rawRecordValues = dataRows.map((rowArr, idx) => {
      const rowObj: Record<string, any> = {};
      headers.forEach((h, colIdx) => {
        if (h) rowObj[h] = rowArr[colIdx] ?? "";
      });

      return {
        batchId: batch.id,
        rowNumber: headerIdx + 2 + idx, // 1-indexed row number from Excel
        rawData: rowObj,
        isValid: null,
        isDuplicate: false,
        isCommitted: false,
      };
    });

    // Batch insert into raw_import_records
    await tx.insert(rawImportRecords).values(rawRecordValues);

    return {
      batchId: batch.id,
      originalFileName: batch.originalFileName,
      financialYear: batch.financialYear,
      totalRows: dataRows.length,
      headers,
    };
  });
}

/**
 * Validates staged raw records against mapping rules, master lookups, numeric constraints, and duplicate checks.
 * Updates raw_import_records status and records detailed error entries in import_errors.
 */
export async function validateAndMapImportBatch(
  db: NodePgDatabase<any>,
  firmId: string,
  batchId: string,
  columnMapping: ColumnMapping,
  masterMapping: MasterMapping = {}
) {
  return await db.transaction(async (tx) => {
    // 1. Fetch batch & verify firm isolation
    const [batch] = await tx
      .select()
      .from(importBatches)
      .where(and(eq(importBatches.id, batchId), eq(importBatches.firmId, firmId)))
      .limit(1);

    if (!batch) {
      throw new FirmIsolationError(`Import batch '${batchId}' not found for active firm '${firmId}'`);
    }

    // Update batch status to VALIDATING
    await tx
      .update(importBatches)
      .set({ status: "VALIDATING" })
      .where(eq(importBatches.id, batchId));

    // Clear previous errors if re-validating
    await tx.delete(importErrors).where(eq(importErrors.batchId, batchId));

    // 2. Fetch existing parties, companies, trucks, locations for firm lookup
    const firmParties = await tx.select().from(parties).where(eq(parties.firmId, firmId));
    const firmCompanies = await tx.select().from(companies).where(eq(companies.firmId, firmId));
    const firmTrucks = await tx.select().from(trucks).where(eq(trucks.firmId, firmId));
    const firmLocations = await tx.select().from(locations).where(eq(locations.firmId, firmId));

    const partyMapByName = new Map(firmParties.map((p) => [p.name.trim().toLowerCase(), p.id]));
    const partyMapById = new Map(firmParties.map((p) => [p.id, p.id]));

    const companyMapByName = new Map(firmCompanies.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const companyMapById = new Map(firmCompanies.map((c) => [c.id, c.id]));

    // Fetch existing daily entries for duplicate detection
    const existingEntries = await tx
      .select({
        id: dailyEntries.id,
        entryDate: dailyEntries.entryDate,
        srNo: dailyEntries.srNo,
        truckNumberRaw: dailyEntries.truckNumberRaw,
        lrNumber: dailyEntries.lrNumber,
      })
      .from(dailyEntries)
      .where(eq(dailyEntries.firmId, firmId));

    const existingKeys = new Set(
      existingEntries.map(
        (e) => `${e.entryDate}_${e.srNo ?? ""}_${(e.truckNumberRaw || "").trim().toUpperCase()}_${(e.lrNumber || "").trim()}`
      )
    );

    // 3. Fetch staged raw records
    const rawRecords = await tx
      .select()
      .from(rawImportRecords)
      .where(eq(rawImportRecords.batchId, batchId))
      .orderBy(rawImportRecords.rowNumber);

    let validCount = 0;
    let errorCount = 0;
    const stagedKeysInBatch = new Set<string>();

    for (const record of rawRecords) {
      const rawData = record.rawData as Record<string, any>;
      const rowErrors: Array<{ fieldName: string; rawValue: string; errorMessage: string; severity: "ERROR" | "WARNING" }> = [];

      // Extract values based on column mapping
      const getRawVal = (sysField?: string) => (sysField ? String(rawData[sysField] ?? "").trim() : "");

      const rawSrNo = getRawVal(columnMapping.srNo);
      const rawDate = getRawVal(columnMapping.entryDate);
      const rawTruck = getRawVal(columnMapping.truckNumber);
      const rawLrNo = getRawVal(columnMapping.lrNumber);
      const rawFrom = getRawVal(columnMapping.fromLocation);
      const rawTo = getRawVal(columnMapping.toLocation);
      const rawNWeight = getRawVal(columnMapping.nWeight);
      const rawRWeight = getRawVal(columnMapping.rWeight);
      const rawAdvance = getRawVal(columnMapping.advance);
      const rawRate = getRawVal(columnMapping.rate);
      const rawCompany = getRawVal(columnMapping.companyName);
      const rawParty = getRawVal(columnMapping.partyName);
      const rawRemarks = getRawVal(columnMapping.remarks);
      const rawReceived = getRawVal(columnMapping.isReceived);

      // Validate Date
      const parsedDate = parseImportDate(rawDate);
      if (!parsedDate) {
        rowErrors.push({
          fieldName: "entryDate",
          rawValue: rawDate,
          errorMessage: "Invalid or missing Date format. Must be YYYY-MM-DD or DD/MM/YYYY.",
          severity: "ERROR",
        });
      }

      // Validate Sr No (numeric)
      let parsedSrNo: number | null = null;
      if (rawSrNo) {
        parsedSrNo = Number(rawSrNo);
        if (isNaN(parsedSrNo)) {
          rowErrors.push({
            fieldName: "srNo",
            rawValue: rawSrNo,
            errorMessage: "Sr No must be a numeric integer.",
            severity: "ERROR",
          });
        }
      }

      // Validate N-Weight & R-Weight
      const nWeightNum = rawNWeight !== "" ? Number(rawNWeight) : 0;
      const rWeightNum = rawRWeight !== "" ? Number(rawRWeight) : 0;

      if (rawNWeight !== "" && (isNaN(nWeightNum) || nWeightNum < 0)) {
        rowErrors.push({
          fieldName: "nWeight",
          rawValue: rawNWeight,
          errorMessage: "N-Weight must be a non-negative numeric value.",
          severity: "ERROR",
        });
      }
      if (rawRWeight !== "" && (isNaN(rWeightNum) || rWeightNum < 0)) {
        rowErrors.push({
          fieldName: "rWeight",
          rawValue: rawRWeight,
          errorMessage: "R-Weight must be a non-negative numeric value.",
          severity: "ERROR",
        });
      }

      if (rWeightNum > nWeightNum && nWeightNum > 0) {
        rowErrors.push({
          fieldName: "rWeight",
          rawValue: rawRWeight,
          errorMessage: `R-Weight (${rWeightNum}) is greater than N-Weight (${nWeightNum}). Verify received weight.`,
          severity: "WARNING",
        });
      }

      // Validate Rate & Advance
      const rateNum = rawRate !== "" ? Number(rawRate) : 0;
      const advanceNum = rawAdvance !== "" ? Number(rawAdvance) : 0;

      if (rawRate !== "" && (isNaN(rateNum) || rateNum < 0)) {
        rowErrors.push({
          fieldName: "rate",
          rawValue: rawRate,
          errorMessage: "Rate must be a non-negative numeric amount.",
          severity: "ERROR",
        });
      }

      // Resolve Party Master Mapping
      let resolvedPartyId: string | null = null;
      if (rawParty) {
        // Check explicit user master mapping first, then exact name match
        const explicitId = masterMapping.partyMapping?.[rawParty];
        if (explicitId && partyMapById.has(explicitId)) {
          resolvedPartyId = explicitId;
        } else {
          resolvedPartyId = partyMapByName.get(rawParty.toLowerCase()) || null;
        }

        if (!resolvedPartyId) {
          rowErrors.push({
            fieldName: "partyName",
            rawValue: rawParty,
            errorMessage: `Customer Party '${rawParty}' is not mapped to an existing Party master.`,
            severity: "ERROR",
          });
        }
      } else {
        rowErrors.push({
          fieldName: "partyName",
          rawValue: "",
          errorMessage: "Party Name is required for Daily Book entry.",
          severity: "ERROR",
        });
      }

      // Resolve Company Master Mapping
      let resolvedCompanyId: string | null = null;
      if (rawCompany) {
        const explicitId = masterMapping.companyMapping?.[rawCompany];
        if (explicitId && companyMapById.has(explicitId)) {
          resolvedCompanyId = explicitId;
        } else {
          resolvedCompanyId = companyMapByName.get(rawCompany.toLowerCase()) || null;
        }

        if (!resolvedCompanyId) {
          rowErrors.push({
            fieldName: "companyName",
            rawValue: rawCompany,
            errorMessage: `Company '${rawCompany}' is not mapped to an existing Company master.`,
            severity: "ERROR",
          });
        }
      }

      // Duplicate Check (Firm + Date + Sr No + Truck + LR No)
      const truckNorm = rawTruck.toUpperCase().trim();
      const lrNorm = rawLrNo.trim();
      const dupKey = `${parsedDate || ""}_${parsedSrNo ?? ""}_${truckNorm}_${lrNorm}`;

      let isDuplicate = false;
      if (parsedDate && (existingKeys.has(dupKey) || stagedKeysInBatch.has(dupKey))) {
        isDuplicate = true;
        rowErrors.push({
          fieldName: "duplicate",
          rawValue: dupKey,
          errorMessage: `Possible duplicate record detected matching Date '${parsedDate}', SrNo '${rawSrNo}', Truck '${rawTruck}'.`,
          severity: "WARNING",
        });
      }
      if (parsedDate) {
        stagedKeysInBatch.add(dupKey);
      }

      const hasFatalError = rowErrors.some((e) => e.severity === "ERROR");
      const isValid = !hasFatalError;

      if (isValid) validCount++;
      else errorCount++;

      // Construct mapped data object
      const mappedData = {
        srNo: parsedSrNo,
        entryDate: parsedDate,
        truckNumberRaw: rawTruck,
        lrNumber: rawLrNo,
        fromLocationRaw: rawFrom,
        toLocationRaw: rawTo,
        nWeight: nWeightNum,
        rWeight: rWeightNum,
        advance: advanceNum,
        rate: rateNum,
        partyId: resolvedPartyId,
        companyId: resolvedCompanyId,
        partyName: rawParty,
        companyName: rawCompany,
        remarks: rawRemarks,
        isReceived: rawReceived === "" ? true : ["YES", "TRUE", "RECEIVED", "1"].includes(rawReceived.toUpperCase()),
      };

      // Update raw record status
      await tx
        .update(rawImportRecords)
        .set({
          mappedData,
          isValid,
          isDuplicate,
        })
        .where(eq(rawImportRecords.id, record.id));

      // Insert error records
      if (rowErrors.length > 0) {
        await tx.insert(importErrors).values(
          rowErrors.map((err) => ({
            batchId,
            rawRecordId: record.id,
            rowNumber: record.rowNumber,
            fieldName: err.fieldName,
            rawValue: err.rawValue,
            errorMessage: err.errorMessage,
            severity: err.severity,
          }))
        );
      }
    }

    // Update batch status
    const finalStatus = errorCount > 0 ? "ERRORS" : "VALIDATED";
    await tx
      .update(importBatches)
      .set({
        status: finalStatus,
        validRows: validCount,
        errorRows: errorCount,
        updatedAt: new Date(),
      })
      .where(eq(importBatches.id, batchId));

    return {
      batchId,
      status: finalStatus,
      totalRows: rawRecords.length,
      validRows: validCount,
      errorRows: errorCount,
    };
  });
}

/**
 * Returns full preview details for an import batch, including summary metrics, staged raw records, errors, and mappings.
 */
export async function getImportBatchPreview(db: NodePgDatabase<any>, firmId: string, batchId: string) {
  const [batch] = await db
    .select()
    .from(importBatches)
    .where(and(eq(importBatches.id, batchId), eq(importBatches.firmId, firmId)))
    .limit(1);

  if (!batch) {
    throw new FirmIsolationError(`Import batch '${batchId}' not found for active firm '${firmId}'`);
  }

  const rawRecords = await db
    .select()
    .from(rawImportRecords)
    .where(eq(rawImportRecords.batchId, batchId))
    .orderBy(rawImportRecords.rowNumber);

  const errors = await db
    .select()
    .from(importErrors)
    .where(eq(importErrors.batchId, batchId))
    .orderBy(importErrors.rowNumber);

  // Group errors by rawRecordId
  const errorsByRecordId = new Map<string, typeof errors>();
  errors.forEach((err) => {
    if (!err.rawRecordId) return;
    const list = errorsByRecordId.get(err.rawRecordId) || [];
    list.push(err);
    errorsByRecordId.set(err.rawRecordId, list);
  });

  return {
    batch,
    records: rawRecords.map((r) => ({
      ...r,
      errors: errorsByRecordId.get(r.id) || [],
    })),
    errors,
  };
}

/**
 * Lists all import batches for the active firm (Import History).
 */
export async function listImportBatches(db: NodePgDatabase<any>, firmId: string) {
  return await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.firmId, firmId))
    .orderBy(desc(importBatches.createdAt));
}

/**
 * Atomic transactional commit engine.
 * Inserts valid staged records into daily_entries and trips within a single db.transaction.
 * If ANY error occurs, the transaction rolls back cleanly!
 *
 * NOTE: Historical trip import does NOT automatically generate Bills, Payments, or Ledger entries!
 */
export async function commitImportBatch(
  db: NodePgDatabase<any>,
  firmId: string,
  batchId: string,
  userId?: string
) {
  return await db.transaction(async (tx) => {
    const [batch] = await tx
      .select()
      .from(importBatches)
      .where(and(eq(importBatches.id, batchId), eq(importBatches.firmId, firmId)))
      .limit(1);

    if (!batch) {
      throw new FirmIsolationError(`Import batch '${batchId}' not found for active firm '${firmId}'`);
    }

    if (batch.status === "COMMITTED") {
      throw new DomainValidationError(`Import batch '${batchId}' has already been committed`);
    }

    const validRecords = await tx
      .select()
      .from(rawImportRecords)
      .where(and(eq(rawImportRecords.batchId, batchId), eq(rawImportRecords.isValid, true)));

    if (validRecords.length === 0) {
      throw new DomainValidationError("No valid records found in batch to commit");
    }

    let committedCount = 0;

    for (const record of validRecords) {
      const mapped = record.mappedData as any;
      if (!mapped || !mapped.entryDate || !mapped.partyId) continue;

      // Create Daily Entry
      const [entry] = await tx
        .insert(dailyEntries)
        .values({
          firmId,
          srNo: mapped.srNo || null,
          entryDate: mapped.entryDate,
          truckNumberRaw: mapped.truckNumberRaw || "UNKNOWN",
          lrNumber: mapped.lrNumber || null,
          fromLocationRaw: mapped.fromLocationRaw || null,
          toLocationRaw: mapped.toLocationRaw || null,
          nWeight: mapped.nWeight ? mapped.nWeight.toString() : null,
          rWeight: mapped.rWeight ? mapped.rWeight.toString() : null,
          advance: mapped.advance ? mapped.advance.toString() : "0",
          rate: mapped.rate ? mapped.rate.toString() : "0",
          companyNameRaw: mapped.companyName || null,
          partyNameRaw: mapped.partyName || null,
          customerRate: mapped.customerRate ? mapped.customerRate.toString() : null,
          remarks: mapped.remarks || null,
          isReceived: mapped.isReceived ?? true,
          createdBy: userId || null,
        })
        .returning();

      // Create Trip
      const [trip] = await tx
        .insert(trips)
        .values({
          firmId,
          dailyEntryId: entry.id,
          partyId: mapped.partyId,
          isReceived: mapped.isReceived ?? true,
          isBilled: false,
        })
        .returning();

      // Update raw record commit status
      await tx
        .update(rawImportRecords)
        .set({
          isCommitted: true,
          productionRecordId: entry.id,
          productionTableName: "daily_entries",
        })
        .where(eq(rawImportRecords.id, record.id));

      committedCount++;
    }

    // Update batch to COMMITTED
    await tx
      .update(importBatches)
      .set({
        status: "COMMITTED",
        committedRows: committedCount,
        committedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(importBatches.id, batchId));

    return {
      batchId,
      status: "COMMITTED",
      committedRows: committedCount,
    };
  });
}
