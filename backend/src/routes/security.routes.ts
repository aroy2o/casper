import { Router } from "express";
import {
  listIncidents,
  getIncident,
  createIncident,
  updateIncident,
  getAuditLogs,
  getSOC2Report
} from "../controllers/security.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

export const securityRouter = Router();

// SOC 2 report — admin only
securityRouter.get("/soc2-report", requireAuth, requireRole(["admin"]), getSOC2Report);

// Audit logs — admin only
securityRouter.get("/audit-logs", requireAuth, requireRole(["admin"]), getAuditLogs);

// Incidents — all authed users can view; create is analyst+; update/close is admin
securityRouter.get("/incidents", requireAuth, listIncidents);
securityRouter.get("/incidents/:id", requireAuth, getIncident);
securityRouter.post("/incidents", requireAuth, requireRole(["admin", "analyst"]), createIncident);
securityRouter.patch("/incidents/:id", requireAuth, requireRole(["admin"]), updateIncident);
