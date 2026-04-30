import { Request } from "express";
import { AuditLogModel, type AuditAction } from "../models/AuditLog.model.js";

interface LogParams {
  action: AuditAction;
  req?: Request;
  userId?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  resource?: string;
  resourceId?: string;
  outcome?: "success" | "failure" | "warning";
  metadata?: Record<string, unknown>;
}

const getIp = (req: Request): string | null => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() ?? null;
  return req.socket?.remoteAddress ?? null;
};

export const logSecurityEvent = async (params: LogParams): Promise<void> => {
  try {
    const user = (params.req as any)?.user;
    await AuditLogModel.create({
      action: params.action,
      userId: params.userId ?? user?._id?.toString() ?? null,
      userEmail: params.userEmail ?? user?.email ?? null,
      userRole: params.userRole ?? user?.role ?? null,
      ip: params.req ? getIp(params.req) : null,
      userAgent: params.req?.headers["user-agent"] ?? null,
      resource: params.resource ?? null,
      resourceId: params.resourceId ?? null,
      outcome: params.outcome ?? "success",
      metadata: params.metadata ?? {}
    });
  } catch {
    // audit logging must never crash the main request
  }
};
