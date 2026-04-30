import { Document, Schema, Types, model } from "mongoose";
import { RiskLevel } from "../types/index.js";

export interface IExtensionAuditFlag {
  lineItemDescription: string;
  quotedRateINR: number;
  marketRateINR: number;
  inflationPct: number;
  confidence: number;
  explanation: string;
}

export interface IExtensionAudit extends Document {
  sourceURL: string;
  pageTitle: string;
  extractedText: string;
  tenderNumber: string | null;
  department: string | null;
  riskLevel: RiskLevel;
  overallInflationPct: number;
  totalOverpricedINR: number;
  flags: IExtensionAuditFlag[];
  summary: string | null;
  recommendation: string | null;
  riskSignals: string[];
  claudeVerdict: string | null;
  mlModelVersion: string;
  triggeredBy: Types.ObjectId;
}

const flagSchema = new Schema<IExtensionAuditFlag>(
  {
    lineItemDescription: { type: String, required: true },
    quotedRateINR: { type: Number, required: true },
    marketRateINR: { type: Number, required: true },
    inflationPct: { type: Number, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    explanation: { type: String, required: true }
  },
  { _id: false }
);

const extensionAuditSchema = new Schema<IExtensionAudit>(
  {
    sourceURL: { type: String, required: true },
    pageTitle: { type: String, required: true },
    extractedText: { type: String, required: true },
    tenderNumber: { type: String, default: null },
    department: { type: String, default: null },
    riskLevel: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
    overallInflationPct: { type: Number, required: true },
    totalOverpricedINR: { type: Number, required: true },
    flags: { type: [flagSchema], default: [] },
    summary: { type: String, default: null },
    recommendation: { type: String, default: null },
    riskSignals: { type: [String], default: [] },
    claudeVerdict: { type: String, default: null },
    mlModelVersion: { type: String, required: true },
    triggeredBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

extensionAuditSchema.index({ triggeredBy: 1, createdAt: -1 });
extensionAuditSchema.index({ sourceURL: 1 });

export const ExtensionAuditModel = model<IExtensionAudit>("ExtensionAudit", extensionAuditSchema);
