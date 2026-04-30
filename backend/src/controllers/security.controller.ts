import { Request, Response } from "express";
import { SecurityIncidentModel, type IncidentSeverity, type IncidentStatus, type IncidentType } from "../models/SecurityIncident.model.js";
import { AuditLogModel } from "../models/AuditLog.model.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import { logSecurityEvent } from "../services/auditLog.service.js";

// ─── Incidents ────────────────────────────────────────────────────────────────

export const listIncidents = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.incidentType) filter.incidentType = req.query.incidentType;

    const [incidents, total] = await Promise.all([
      SecurityIncidentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SecurityIncidentModel.countDocuments(filter)
    ]);

    return sendSuccess(res, { incidents, total, page, pages: Math.ceil(total / limit) });
  } catch {
    return sendError(res, { code: "INCIDENTS_FETCH_FAILED", message: "Unable to fetch incidents" }, 500);
  }
};

export const getIncident = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const incident = await SecurityIncidentModel.findById(req.params.id).lean();
    if (!incident) return sendError(res, { code: "NOT_FOUND", message: "Incident not found" }, 404);
    return sendSuccess(res, incident);
  } catch {
    return sendError(res, { code: "INCIDENT_FETCH_FAILED", message: "Unable to fetch incident" }, 500);
  }
};

export const createIncident = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const user = (req as any).user;
    const {
      title, description, incidentType, severity, affectedResource,
      affectedUsers, sourceIp, mitigationSteps, referenceId
    } = req.body as {
      title: string;
      description: string;
      incidentType: IncidentType;
      severity: IncidentSeverity;
      affectedResource?: string;
      affectedUsers?: string[];
      sourceIp?: string;
      mitigationSteps?: string[];
      referenceId?: string;
    };

    if (!title || !description || !incidentType || !severity) {
      return sendError(res, { code: "MISSING_FIELDS", message: "title, description, incidentType, and severity are required" }, 400);
    }

    const incident = await SecurityIncidentModel.create({
      title, description, incidentType, severity,
      reportedBy: user?.email ?? "unknown",
      affectedResource: affectedResource ?? null,
      affectedUsers: affectedUsers ?? [],
      sourceIp: sourceIp ?? null,
      mitigationSteps: mitigationSteps ?? [],
      referenceId: referenceId ?? null
    });

    await logSecurityEvent({
      action: "security_incident_create",
      req,
      resource: "security_incident",
      resourceId: incident._id.toString(),
      metadata: { severity, incidentType, title }
    });

    return sendSuccess(res, incident, 201);
  } catch {
    return sendError(res, { code: "INCIDENT_CREATE_FAILED", message: "Unable to create incident" }, 500);
  }
};

export const updateIncident = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const allowed = ["status", "assignedTo", "resolutionNotes", "mitigationSteps", "severity"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    if ((updates.status as IncidentStatus) === "resolved" && !updates.resolvedAt) {
      updates.resolvedAt = new Date();
    }

    const incident = await SecurityIncidentModel.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
    if (!incident) return sendError(res, { code: "NOT_FOUND", message: "Incident not found" }, 404);

    await logSecurityEvent({
      action: "security_incident_update",
      req,
      resource: "security_incident",
      resourceId: String(req.params.id),
      metadata: { updates }
    });

    return sendSuccess(res, incident);
  } catch {
    return sendError(res, { code: "INCIDENT_UPDATE_FAILED", message: "Unable to update incident" }, 500);
  }
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const getAuditLogs = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.outcome) filter.outcome = req.query.outcome;
    if (req.query.dateFrom || req.query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (req.query.dateFrom) dateFilter.$gte = new Date(String(req.query.dateFrom));
      if (req.query.dateTo) dateFilter.$lte = new Date(String(req.query.dateTo));
      filter.createdAt = dateFilter;
    }

    const [logs, total] = await Promise.all([
      AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLogModel.countDocuments(filter)
    ]);

    return sendSuccess(res, { logs, total, page, pages: Math.ceil(total / limit) });
  } catch {
    return sendError(res, { code: "AUDIT_LOG_FETCH_FAILED", message: "Unable to fetch audit logs" }, 500);
  }
};

// ─── SOC 2 Report ─────────────────────────────────────────────────────────────

export const getSOC2Report = async (_req: Request, res: Response): Promise<Response | void> => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [
      totalIncidents,
      openIncidents,
      criticalIncidents,
      resolvedLast30Days,
      incidentsByType,
      incidentsBySeverity,
      loginFailures,
      totalExports,
      adminActions,
      recentIncidents
    ] = await Promise.all([
      SecurityIncidentModel.countDocuments({}),
      SecurityIncidentModel.countDocuments({ status: { $in: ["open", "investigating"] } }),
      SecurityIncidentModel.countDocuments({ severity: "critical", status: { $ne: "closed" } }),
      SecurityIncidentModel.countDocuments({ status: "resolved", resolvedAt: { $gte: thirtyDaysAgo } }),
      SecurityIncidentModel.aggregate([{ $group: { _id: "$incidentType", count: { $sum: 1 } } }]),
      SecurityIncidentModel.aggregate([{ $group: { _id: "$severity", count: { $sum: 1 } } }]),
      AuditLogModel.countDocuments({ action: "login_failed", createdAt: { $gte: ninetyDaysAgo } }),
      AuditLogModel.countDocuments({ action: { $in: ["report_export", "tender_export"] }, createdAt: { $gte: ninetyDaysAgo } }),
      AuditLogModel.countDocuments({ action: "admin_action", createdAt: { $gte: ninetyDaysAgo } }),
      SecurityIncidentModel.find({ status: { $in: ["open", "investigating"] } })
        .sort({ severity: -1, createdAt: -1 })
        .limit(5)
        .select("title severity status incidentType createdAt")
        .lean()
    ]);

    const report = {
      generatedAt: new Date().toISOString(),
      period: "last 90 days",
      incidents: {
        total: totalIncidents,
        open: openIncidents,
        critical: criticalIncidents,
        resolvedLast30Days,
        byType: Object.fromEntries(incidentsByType.map((x) => [x._id, x.count])),
        bySeverity: Object.fromEntries(incidentsBySeverity.map((x) => [x._id, x.count]))
      },
      activity: {
        loginFailures,
        dataExports: totalExports,
        adminActions
      },
      openIncidents: recentIncidents,
      controls: {
        accessControl: openIncidents === 0 ? "pass" : criticalIncidents > 0 ? "fail" : "warning",
        dataIntegrity: criticalIncidents === 0 ? "pass" : "fail",
        auditLogging: "pass",
        incidentResponse: openIncidents < 5 ? "pass" : "warning"
      }
    };

    return sendSuccess(res, report);
  } catch {
    return sendError(res, { code: "SOC2_REPORT_FAILED", message: "Unable to generate SOC 2 report" }, 500);
  }
};
