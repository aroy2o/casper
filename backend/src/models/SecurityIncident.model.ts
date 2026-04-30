import { Document, Schema, model } from "mongoose";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "resolved" | "closed";
export type IncidentType =
  | "unauthorized_access"
  | "data_breach"
  | "permission_escalation"
  | "suspicious_activity"
  | "data_export"
  | "brute_force"
  | "policy_violation"
  | "system_anomaly"
  | "other";

export interface ISecurityIncident extends Document {
  title: string;
  description: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  reportedBy: string;
  assignedTo: string | null;
  affectedResource: string | null;
  affectedUsers: string[];
  sourceIp: string | null;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
  mitigationSteps: string[];
  referenceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const securityIncidentSchema = new Schema<ISecurityIncident>(
  {
    title: { type: String, required: true, maxlength: 300 },
    description: { type: String, required: true, maxlength: 5000 },
    incidentType: {
      type: String,
      enum: ["unauthorized_access", "data_breach", "permission_escalation", "suspicious_activity", "data_export", "brute_force", "policy_violation", "system_anomaly", "other"],
      required: true,
      index: true
    },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], required: true, index: true },
    status: { type: String, enum: ["open", "investigating", "resolved", "closed"], default: "open", index: true },
    reportedBy: { type: String, required: true },
    assignedTo: { type: String, default: null },
    affectedResource: { type: String, default: null },
    affectedUsers: { type: [String], default: [] },
    sourceIp: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNotes: { type: String, default: null },
    mitigationSteps: { type: [String], default: [] },
    referenceId: { type: String, default: null }
  },
  { timestamps: true }
);

securityIncidentSchema.index({ createdAt: -1 });
securityIncidentSchema.index({ severity: 1, status: 1 });

export const SecurityIncidentModel = model<ISecurityIncident>("SecurityIncident", securityIncidentSchema);
