import { z } from "zod";

export const dailyEntryInputSchema = z.object({
  firmId: z.string().uuid("Firm ID is required"),
  srNo: z.number().int().positive("Sr No must be a positive integer"),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  truckId: z.string().uuid().optional().nullable(),
  truckNumberRaw: z.string().max(30).optional().nullable(),
  lrNumber: z.string().max(50).optional().nullable(),
  fromLocationId: z.string().uuid().optional().nullable(),
  fromLocationRaw: z.string().max(255).optional().nullable(),
  toLocationId: z.string().uuid().optional().nullable(),
  toLocationRaw: z.string().max(255).optional().nullable(),
  nWeight: z.number().nonnegative("N-Weight cannot be negative").optional().nullable(),
  rWeight: z.number().nonnegative("R-Weight cannot be negative").optional().nullable(),
  advance: z.number().nonnegative("Advance cannot be negative").optional().nullable(),
  rate: z.number().nonnegative("Rate cannot be negative").optional().nullable(),
  cash: z.number().nonnegative("Cash cannot be negative").optional().nullable(),
  diesel: z.number().nonnegative("Diesel cannot be negative").optional().nullable(),
  ac: z.number().nonnegative("A/c cannot be negative").optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  companyNameRaw: z.string().max(255).optional().nullable(),
  partyId: z.string().uuid().optional().nullable(),
  partyNameRaw: z.string().max(255).optional().nullable(),
  customerRate: z.number().nonnegative("Customer Rate cannot be negative").optional().nullable(),
  isReceived: z.boolean().default(false),
  remarks: z.string().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
});

export type DailyEntryInput = z.infer<typeof dailyEntryInputSchema>;
