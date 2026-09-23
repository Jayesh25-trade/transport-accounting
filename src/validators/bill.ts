import { z } from "zod";

export const billCreateInputSchema = z.object({
  firmId: z.string().uuid("Firm ID is required"),
  partyId: z.string().uuid("Party ID is required"),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  tripIds: z.array(z.string().uuid()).min(1, "At least one trip must be selected for billing"),
  appliedTdsSection: z.string().max(20).optional().nullable(),
  appliedTdsPercentage: z.number().min(0).max(100).optional().nullable(),
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
  notes: z.string().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
});

export type BillCreateInput = z.infer<typeof billCreateInputSchema>;
export type BillEditInput = z.infer<typeof billEditInputSchema>;
