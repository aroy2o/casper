import { z } from "zod";

export const auditQuerySchema = z.object({
  tenderId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId")
});
