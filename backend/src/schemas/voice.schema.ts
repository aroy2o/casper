import { z } from "zod";

export const voiceQuerySchema = z.object({
  transcript: z.string().min(1)
});
