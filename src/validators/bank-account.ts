import { z } from "zod";

export const bankAccountCreateSchema = z.object({
  accountDisplayName: z.string().min(1, "Account display name is required").max(255),
  bankName: z.string().min(1, "Bank name is required").max(255),
  accountNumber: z.string().min(1, "Account number is required").max(100),
  ifscCode: z.string().min(1, "IFSC code is required").max(20),
  branch: z.string().max(255).optional().nullable(),
  accountType: z.string().max(50).default("CURRENT"),
  upiId: z.string().max(100).optional().nullable(),
  isDefaultForBills: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const bankAccountUpdateSchema = bankAccountCreateSchema.partial();

export type BankAccountCreateInput = z.infer<typeof bankAccountCreateSchema>;
export type BankAccountUpdateInput = z.infer<typeof bankAccountUpdateSchema>;
