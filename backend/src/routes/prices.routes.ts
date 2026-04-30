import { Router } from "express";
import { createManualPrice, getPriceHistory, getPrices } from "../controllers/prices.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { manualPriceSchema } from "../schemas/price.schema.js";

export const pricesRouter = Router();

pricesRouter.get("/", getPrices);
pricesRouter.get("/:material/history", getPriceHistory);
pricesRouter.post("/manual", requireAuth, requireRole(["admin"]), validate(manualPriceSchema), createManualPrice);
