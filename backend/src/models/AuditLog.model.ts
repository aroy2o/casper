import { Document, Schema, model } from "mongoose";

export type AuditAction =
  | "login_success"
  | "login_failed"
  | "logout"
  | "register"
  | "password_change"
  | "role_change"
  | "tender_view"
  | "tender_upload"
  | "tender_delete"
  | "tender_export"
  | "report_download"
  | "report_export"
  | "audit_view"
  | "flag_challenge"
  | "admin_action"
  | "retention_run"
  | "security_incident_create"
  | "security_incident_update"
  | "api_access";

export interface IAuditLog extends Document {
  action: AuditAction;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  ip: string | null;
  userAgent: string | null;
  resource: string | null;
  resourceId: string | null;
  outcome: "success" | "failure" | "warning";
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      enum: [
        "login_success", "login_failed", "logout", "register", "password_change", "role_change",
        "tender_view", "tender_upload", "tender_delete", "tender_export",
        "report_download", "report_export", "audit_view", "flag_challenge",
        "admin_action", "retention_run", "security_incident_create", "security_incident_update", "api_access"
      ],
      required: true,
      index: true
    },
    userId: { type: String, default: null, index: true },
    userEmail: { type: String, default: null },
    userRole: { type: String, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    resource: { type: String, default: null },
    resourceId: { type: String, default: null },
    outcome: { type: String, enum: ["success", "failure", "warning"], default: "success", index: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, capped: { size: 50 * 1024 * 1024, max: 100000 } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLogModel = model<IAuditLog>("AuditLog", auditLogSchema);
