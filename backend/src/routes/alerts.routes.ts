import { Router } from "express";
import { markAlertRead, markAllAlertsRead, streamAlerts } from "../controllers/alerts.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const alertsRouter = Router();

alertsRouter.get("/", requireAuth, streamAlerts);
alertsRouter.patch("/:id/read", requireAuth, markAlertRead);
alertsRouter.patch("/read-all", requireAuth, markAllAlertsRead);
