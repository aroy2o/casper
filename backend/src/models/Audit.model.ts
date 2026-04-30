import { Document, Schema, Types, model } from "mongoose";
import { RiskLevel } from "../types/index.js";

export interface IAuditFlag {
  lineItemDescription: string;
  quotedRateINR: number;
  marketRateINR: number;
  inflationPct: number;
  confidence: number;
  explanation: string;
  humanSummary?: string | null;
  verdict?: string | null;
  topFactors?: Array<{ feature: string; impact: number; direction: string }>;
  riskContribution?: number | null;
}

export interface IAudit extends Document {
  tenderId: Types.ObjectId;
  auditedAt: Date;
  overallInflationPct: number;
  totalOverpricedINR: number;
  riskLevel: RiskLevel;
  flags: IAuditFlag[];
  mlModelVersion: string;
  reportURL: string | null;
  claudeVerdict: string | null;
  summary: string | null;
  riskSignals: string[];
  recommendation: string | null;
  imagekitUrl: string | null;
  plainEnglishSummary?: string | null;
  overallVerdict?: string | null;
  explanationVersion?: string | null;
}

const auditFlagSchema = new Schema<IAuditFlag>(
  {
    lineItemDescription: { type: String, required: true },
    quotedRateINR: { type: Number, required: true },
    marketRateINR: { type: Number, required: true },
    inflationPct: { type: Number, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    explanation: { type: String, required: true },
    humanSummary: { type: String, default: null },
    verdict: { type: String, default: null },
    topFactors: {
      type: [
        {
          feature: { type: String, required: true },
          impact: { type: Number, required: true },
          direction: { type: String, required: true }
        }
      ],
      default: []
    },
    riskContribution: { type: Number, default: null }
  },
  { _id: false }
);

const auditSchema = new Schema<IAudit>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: "Tender", required: true },
    auditedAt: { type: Date, default: Date.now },
    overallInflationPct: { type: Number, required: true },
    totalOverpricedINR: { type: Number, required: true },
    riskLevel: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
    flags: { type: [auditFlagSchema], default: [] },
    mlModelVersion: { type: String, required: true },
    reportURL: { type: String, default: null },
    claudeVerdict: { type: String, default: null },
    summary: { type: String, default: null },
    riskSignals: { type: [String], default: [] },
    recommendation: { type: String, default: null },
    imagekitUrl: { type: String, default: null },
    plainEnglishSummary: { type: String, default: null },
    overallVerdict: { type: String, default: null },
    explanationVersion: { type: String, default: null }
  },
  { timestamps: true }
);

auditSchema.index({ tenderId: 1 }, { unique: true });

export const AuditModel = model<IAudit>("Audit", auditSchema);
