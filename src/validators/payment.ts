import { z } from "zod";

export const paymentCreateInputSchema = z.object({
  firmId: z.string().uuid("Firm ID is required"),
  partyId: z.string().uuid("Party ID is required"),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  paymentType: z.enum(["AGAINST_BILL", "ADVANCE"]),
  paymentMode: z.enum(["CASH", "BANK_ACCOUNT", "BANK_AC", "CHEQUE", "UTR", "NEFT", "RTGS", "UPI", "OTHER"]),
  referenceNumber: z.string().max(100).optional().nullable(),
  bankName: z.string().max(255).optional().nullable(),
  amount: z.number().positive("Payment amount must be greater than 0"),
  billId: z.string().uuid().optional().nullable(),
  remarks: z.string().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
});

export const paymentAllocationInputSchema = z.object({
  firmId: z.string().uuid("Firm ID is required"),
  paymentId: z.string().uuid("Payment ID is required"),
  billId: z.string().uuid("Bill ID is required"),
  allocatedAmount: z.number().positive("Allocation amount must be greater than 0"),
  allocationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  remarks: z.string().optional().nullable(),
});

export type PaymentCreateInput = z.infer<typeof paymentCreateInputSchema>;
export type PaymentAllocationInput = z.infer<typeof paymentAllocationInputSchema>;
