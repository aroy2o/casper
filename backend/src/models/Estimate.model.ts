import { Document, Schema, model } from "mongoose";

export type ProjectType = "ROAD" | "BRIDGE" | "BUILDING" | "DRAINAGE";
export type ConfidenceLevel = "High" | "Medium" | "Low";
export type FlagColor = "GREEN" | "AMBER" | "RED";

export interface EstimateCostBreakdown {
  materials_cr: number;
  labour_equipment_cr: number;
  earthwork_cr: number;
  structures_cr: number;
  finishing_cr: number;
  profit_cr: number;
  contingency_cr: number;
  gst_cr: number;
}

export interface EstimateRiskFactor {
  factor: string;
  impact: string;
  severity: "High" | "Medium" | "Low";
}

export interface ComparableProject {
  name: string;
  location: string;
  year: number;
  cost_cr: number;
  source: string;
}

export interface AIEstimateResult {
  total_cost_cr: number;
  confidence_level: ConfidenceLevel;
  confidence_pct: number;
  unit_rate: { value: number; unit: string };
  sor_reference: string;
  cost_breakdown: EstimateCostBreakdown;
  assumptions: string[];
  risk_factors: EstimateRiskFactor[];
  comparable_projects: ComparableProject[];
  anomaly_flags: string[];
  region_adjustment: { state: string; multiplier: number; reason: string };
}

export interface CostHeadComparison {
  head: string;
  fair_cr: number;
  tender_cr: number;
  variance_pct: number;
  suspicious: boolean;
}

export interface TenderCompareResult {
  tender_quoted_cr: number;
  variance_pct: number;
  flag: FlagColor;
  anomaly_analysis: string;
  cost_head_comparison: CostHeadComparison[];
}

export interface IEstimate extends Document {
  project_name: string;
  district: string;
  state: string;
  financial_year: string;
  project_type: ProjectType;
  inputs: Record<string, unknown>;
  inputs_hash: string;
  ml_estimate_cr: number | null;
  ml_model_version: string | null;
  ai_result: AIEstimateResult;
  total_cost_cr: number;
  confidence_level: ConfidenceLevel;
  confidence_pct: number;
  claude_model_used: string;
  user_id: string | null;
  tender_comparison: TenderCompareResult | null;
  created_at: Date;
  updated_at: Date;
}

const costBreakdownSchema = new Schema<EstimateCostBreakdown>(
  {
    materials_cr: { type: Number, default: 0 },
    labour_equipment_cr: { type: Number, default: 0 },
    earthwork_cr: { type: Number, default: 0 },
    structures_cr: { type: Number, default: 0 },
    finishing_cr: { type: Number, default: 0 },
    profit_cr: { type: Number, default: 0 },
    contingency_cr: { type: Number, default: 0 },
    gst_cr: { type: Number, default: 0 }
  },
  { _id: false }
);

const aiResultSchema = new Schema<AIEstimateResult>(
  {
    total_cost_cr: { type: Number, required: true },
    confidence_level: { type: String, enum: ["High", "Medium", "Low"], required: true },
    confidence_pct: { type: Number, required: true },
    unit_rate: { value: { type: Number }, unit: { type: String } },
    sor_reference: { type: String, required: true },
    cost_breakdown: { type: costBreakdownSchema, required: true },
    assumptions: [{ type: String }],
    risk_factors: [
      {
        factor: String,
        impact: String,
        severity: { type: String, enum: ["High", "Medium", "Low"] }
      }
    ],
    comparable_projects: [
      {
        name: String,
        location: String,
        year: Number,
        cost_cr: Number,
        source: String
      }
    ],
    anomaly_flags: [{ type: String }],
    region_adjustment: {
      state: String,
      multiplier: Number,
      reason: String
    }
  },
  { _id: false }
);

const tenderCompareSchema = new Schema<TenderCompareResult>(
  {
    tender_quoted_cr: { type: Number, required: true },
    variance_pct: { type: Number, required: true },
    flag: { type: String, enum: ["GREEN", "AMBER", "RED"], required: true },
    anomaly_analysis: { type: String, required: true },
    cost_head_comparison: [
      {
        head: String,
        fair_cr: Number,
        tender_cr: Number,
        variance_pct: Number,
        suspicious: Boolean
      }
    ]
  },
  { _id: false }
);

const estimateSchema = new Schema<IEstimate>(
  {
    project_name: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true, index: true },
    financial_year: { type: String, required: true },
    project_type: {
      type: String,
      enum: ["ROAD", "BRIDGE", "BUILDING", "DRAINAGE"],
      required: true,
      index: true
    },
    inputs: { type: Schema.Types.Mixed, required: true },
    inputs_hash: { type: String, required: true },
    ml_estimate_cr: { type: Number, default: null },
    ml_model_version: { type: String, default: null },
    ai_result: { type: aiResultSchema, required: true },
    total_cost_cr: { type: Number, required: true },
    confidence_level: { type: String, enum: ["High", "Medium", "Low"], required: true },
    confidence_pct: { type: Number, required: true },
    claude_model_used: { type: String, required: true },
    user_id: { type: String, default: null, index: true },
    tender_comparison: { type: tenderCompareSchema, default: null }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

estimateSchema.index({ created_at: -1 });
estimateSchema.index({ project_type: 1, state: 1, created_at: -1 });
estimateSchema.index({ user_id: 1, created_at: -1 });

export const EstimateModel = model<IEstimate>("Estimate", estimateSchema);
