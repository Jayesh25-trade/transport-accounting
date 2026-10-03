import { z } from "zod";

export const displayOptionsSchema = z.object({
  showBankDetails: z.boolean().optional(),
  showPaymentTerms: z.boolean().optional(),
  showDueDate: z.boolean().optional(),
  showAmountInWords: z.boolean().optional(),
  showRemarks: z.boolean().optional(),
  showTermsAndConditions: z.boolean().optional(),
  showAuthorisedSignature: z.boolean().optional(),
  showVehicleType: z.boolean().optional(),
  showGstDetails: z.boolean().optional(),
  showReverseCharge: z.boolean().optional(),
  showPlaceOfSupply: z.boolean().optional(),
});

export const billCreateInputSchema = z.object({
  firmId: z.string().uuid("Firm ID is required"),
  partyId: z.string().uuid("Party ID is required"),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  tripIds: z.array(z.string().uuid()).min(1, "At least one trip must be selected for billing"),
  appliedTdsSection: z.string().max(20).optional().nullable(),
  appliedTdsPercentage: z.number().min(0).max(100).optional().nullable(),
  bankAccountId: z.string().uuid().optional().nullable(),
  paymentTerms: z.string().max(100).optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  displayOptions: displayOptionsSchema.optional().nullable(),
  notes: z.string().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
});

export const billEditInputSchema = z.object({
  firmId: z.string().uuid("Firm ID is required"),
  billId: z.string().uuid("Bill ID is required"),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  tripIds: z.array(z.string().uuid()).min(1, "At least one trip must remain on the bill"),
  appliedTdsSection: z.string().max(20).optional().nullable(),
  appliedTdsPercentage: z.number().min(0).max(100).optional().nullable(),
  bankAccountId: z.string().uuid().optional().nullable(),
  paymentTerms: z.string().max(100).optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  displayOptions: displayOptionsSchema.optional().nullable(),
  notes: z.string().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
});

export type DisplayOptionsInput = z.infer<typeof displayOptionsSchema>;
export type BillCreateInput = z.infer<typeof billCreateInputSchema>;
export type BillEditInput = z.infer<typeof billEditInputSchema>;
