import { Router } from "express";
import {
  getRetentionPolicy,
  updateRetentionPolicy,
  runArchival,
  restoreTender,
  getArchivedTenders
} from "../controllers/retention.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

export const retentionRouter = Router();

retentionRouter.get("/policy", requireAuth, requireRole(["admin"]), getRetentionPolicy);
retentionRouter.put("/policy", requireAuth, requireRole(["admin"]), updateRetentionPolicy);
retentionRouter.post("/run", requireAuth, requireRole(["admin"]), runArchival);
retentionRouter.get("/archived", requireAuth, getArchivedTenders);
retentionRouter.post("/restore/:tenderId", requireAuth, requireRole(["admin"]), restoreTender);
