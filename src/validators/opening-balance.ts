import { z } from "zod";

export const openingBalanceInputSchema = z.object({
  firmId: z.string().uuid("Firm ID is required"),
  partyId: z.string().uuid("Party ID is required"),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, "Invalid financial year format (e.g. 2024-25)"),
  amount: z.number().nonnegative("Opening balance amount cannot be negative"),
  balanceType: z.enum(["DEBIT", "CREDIT"]).default("DEBIT"),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  notes: z.string().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
});

export type OpeningBalanceInput = z.infer<typeof openingBalanceInputSchema>;
