import { z } from "zod";

export const manualPriceSchema = z.object({
  material: z.string().min(2),
  unit: z.string().min(2),
  priceINR: z.number().nonnegative(),
  source: z.string().min(2),
  sourceURL: z.string().url(),
  region: z.string().min(2)
});
