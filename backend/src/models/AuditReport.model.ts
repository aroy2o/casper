import { Document, Schema, Types, model } from "mongoose";

export type ReportType = "tender" | "vendor" | "item" | "regional";
export type ReportFormat = "pdf" | "csv";

export interface IAuditReport extends Document {
  reportType: ReportType;
  referenceId: string;
  referenceName: string;
  format: ReportFormat;
  filePath: string | null;
  downloadURL: string | null;
  generatedBy: Types.ObjectId;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IAuditReport>(
  {
    reportType: { type: String, enum: ["tender", "vendor", "item", "regional"], required: true },
    referenceId: { type: String, required: true },
    referenceName: { type: String, required: true },
    format: { type: String, enum: ["pdf", "csv"], required: true },
    filePath: { type: String, default: null },
    downloadURL: { type: String, default: null },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

schema.index({ generatedBy: 1, createdAt: -1 });
schema.index({ reportType: 1, referenceId: 1 });

export const AuditReportModel = model<IAuditReport>("AuditReport", schema);
