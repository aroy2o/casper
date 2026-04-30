import { z } from "zod";

export const benchmarkQuerySchema = z.object({
  type: z.enum(["road", "bridge", "railway", "building", "drainage", "other"]),
  region: z.string().min(1).max(64),
  lengthKm: z.coerce.number().positive().max(10000),
  year: z.coerce.number().int().min(2020).max(2030)
});
