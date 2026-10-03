import { eq } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { firmBillSettings, bankAccounts } from "../db/schema";
import {
  firmBillSettingsSchema,
  type FirmBillSettingsInput,
} from "../validators/bill-settings";

export async function getFirmBillSettings(
  db: NodePgDatabase<any>,
  firmId: string
) {
  const rows = await db
    .select()
    .from(firmBillSettings)
    .where(eq(firmBillSettings.firmId, firmId))
    .limit(1);

  if (rows.length > 0) {
    return rows[0];
  }

  // If no custom settings exist yet, return firm defaults
  // Check if a default bank account is marked in bank_accounts table
  const defaultBankRows = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.firmId, firmId))
    .limit(1);

  const defaultBankId = defaultBankRows.find((b) => b.isDefaultForBills)?.id || defaultBankRows[0]?.id || null;

  return {
    firmId,
    defaultBankAccountId: defaultBankId,
    defaultPaymentTerms: "30 Days",
    defaultTermsAndConditions: "Payment to be made within 30 days. Subject to local jurisdiction.",
    defaultRemarks: "Bill for transportation charges.",
    showBankDetails: true,
    showPaymentTerms: true,
    showDueDate: true,
    showAmountInWords: true,
    showRemarks: true,
    showTermsAndConditions: true,
    showAuthorisedSignature: true,
    showVehicleType: false,
    showGstDetails: false,
    showReverseCharge: false,
    showPlaceOfSupply: false,
  };
}

export async function updateFirmBillSettings(
  db: NodePgDatabase<any>,
  firmId: string,
  rawInput: FirmBillSettingsInput
) {
  const input = firmBillSettingsSchema.parse(rawInput);

  const existing = await db
    .select()
    .from(firmBillSettings)
    .where(eq(firmBillSettings.firmId, firmId))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(firmBillSettings)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(firmBillSettings.firmId, firmId))
      .returning();

    return updated;
  } else {
    const [created] = await db
      .insert(firmBillSettings)
      .values({
        ...input,
        firmId,
      })
      .returning();

    return created;
  }
}
