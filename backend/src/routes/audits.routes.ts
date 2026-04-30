import { Router } from "express";
import { draftRtiLetter, getAuditByTenderId, getAuditExplanation, getAuditReport, getAuditSummary } from "../controllers/audits.controller.js";
import {
  getSimilarTenders,
  getItemDrillDown,
  getItemTimeline,
  getVendorTimeline,
  exportReport,
  downloadReport,
  getReportHistory,
  challengeFlag
} from "../controllers/advanced-audit.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const auditsRouter = Router();

// Static paths must come BEFORE the /:tenderId wildcard

// Existing
auditsRouter.get("/summary", requireAuth, getAuditSummary);

// New: item + vendor timelines (no tenderId)
auditsRouter.get("/item-timeline", requireAuth, getItemTimeline);
auditsRouter.get("/vendor-timeline", requireAuth, getVendorTimeline);

// New: report history and export
auditsRouter.get("/reports", requireAuth, getReportHistory);
auditsRouter.get("/reports/:reportId/download", requireAuth, downloadReport);
auditsRouter.post("/export", requireAuth, exportReport);

// Per-tender routes (/:tenderId wildcard — must come after static paths above)
auditsRouter.get("/:tenderId/similar", requireAuth, getSimilarTenders);
auditsRouter.get("/:tenderId/item-drill-down", requireAuth, getItemDrillDown);
auditsRouter.post("/:tenderId/challenge-flag", requireAuth, challengeFlag);

// Existing per-tender routes
auditsRouter.get("/:tenderId", requireAuth, getAuditByTenderId);
auditsRouter.get("/:tenderId/report", requireAuth, getAuditReport);
auditsRouter.get("/:tenderId/explanation", requireAuth, getAuditExplanation);
auditsRouter.post("/:tenderId/draft-rti", requireAuth, draftRtiLetter);
