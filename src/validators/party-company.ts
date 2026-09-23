import { z } from "zod";

export const partyInputSchema = z.object({
  firmId: z.string().uuid("Firm ID is required"),
  name: z.string().min(1, "Party name is required").max(255),
  tradeName: z.string().max(255).optional().nullable(),
  contactPerson: z.string().max(255).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email("Invalid email format").optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  pincode: z.string().max(10).optional().nullable(),
  pan: z.string().max(20).optional().nullable(),
  gstin: z.string().max(20).optional().nullable(),
});

export const companyInputSchema = z.object({
  firmId: z.string().uuid("Firm ID is required"),
  name: z.string().min(1, "Company name is required").max(255),
  address: z.string().optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  contactPerson: z.string().max(255).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
});

export const customerRuleInputSchema = z.object({
  firmId: z.string().uuid("Firm ID is required"),
  partyId: z.string().uuid("Party ID is required"),
  freightBasis: z.enum(["R_WEIGHT", "N_WEIGHT", "FIXED"]).default("R_WEIGHT"),
  shortageApplicable: z.boolean().default(false),
  shortageAllowanceType: z.enum(["PERCENTAGE", "FIXED_KG"]).optional().nullable(),
  shortageAllowanceValue: z.number().nonnegative("Allowance value cannot be negative").optional().nullable(),
  shortageRuleType: z.enum(["EXCESS_ONLY", "FULL_SHORTAGE"]).optional().nullable(),
  materialRatePerTon: z.number().nonnegative("Material rate cannot be negative").optional().nullable(),
  tdsApplicable: z.boolean().default(false),
  tdsSection: z.string().max(20).optional().nullable(),
  tdsPercentage: z.number().min(0).max(100).optional().nullable(),
});

export type PartyInput = z.infer<typeof partyInputSchema>;
export type CompanyInput = z.infer<typeof companyInputSchema>;
export type CustomerRuleInput = z.infer<typeof customerRuleInputSchema>;
