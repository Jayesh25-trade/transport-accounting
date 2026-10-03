import { z } from "zod";

export const firmBillSettingsSchema = z.object({
  defaultBankAccountId: z.string().uuid().optional().nullable(),
  defaultPaymentTerms: z.string().max(100).optional().nullable(),
  defaultTermsAndConditions: z.string().optional().nullable(),
  defaultRemarks: z.string().optional().nullable(),
  showBankDetails: z.boolean().default(true),
  showPaymentTerms: z.boolean().default(true),
  showDueDate: z.boolean().default(true),
  showAmountInWords: z.boolean().default(true),
  showRemarks: z.boolean().default(true),
  showTermsAndConditions: z.boolean().default(true),
  showAuthorisedSignature: z.boolean().default(true),
  showVehicleType: z.boolean().default(false),
  showGstDetails: z.boolean().default(false),
  showReverseCharge: z.boolean().default(false),
  showPlaceOfSupply: z.boolean().default(false),
});

export type FirmBillSettingsInput = z.infer<typeof firmBillSettingsSchema>;
