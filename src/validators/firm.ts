import { z } from "zod";

export const firmContextSchema = z.object({
  firmId: z.string().uuid("Invalid firm context ID"),
});

export type FirmContextInput = z.infer<typeof firmContextSchema>;
