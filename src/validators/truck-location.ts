import { z } from "zod";

// ─── Truck Validator ────────────────────────────────────────
export const truckInputSchema = z.object({
  firmId: z.string().uuid("Firm ID is required"),
  truckNumber: z
    .string()
    .min(1, "Truck number is required")
    .max(30, "Truck number must be 30 characters or fewer")
    .transform((v) => v.toUpperCase().trim()),
  ownerName: z.string().max(255).optional().nullable(),
  ownerPhone: z.string().max(20).optional().nullable(),
  capacityTons: z.string().max(20).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ─── Location Validator ─────────────────────────────────────
export const locationInputSchema = z.object({
  firmId: z.string().uuid("Firm ID is required"),
  name: z
    .string()
    .min(1, "Location name is required")
    .max(255)
    .transform((v) => v.toUpperCase().trim()),
  state: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type TruckInput = z.infer<typeof truckInputSchema>;
export type LocationInput = z.infer<typeof locationInputSchema>;
