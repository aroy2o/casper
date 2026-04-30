import { Router } from "express";
import { voiceQuery } from "../controllers/voice.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { voiceQuerySchema } from "../schemas/voice.schema.js";

export const voiceRouter = Router();

voiceRouter.post("/query", requireAuth, validate(voiceQuerySchema), voiceQuery);
