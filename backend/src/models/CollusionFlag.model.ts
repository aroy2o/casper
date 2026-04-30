import { Document, Schema, Types, model } from "mongoose";

export type CollusionType =
  | "cross_state_repeat_winner"
  | "bid_cluster"
  | "threshold_bid"
  | "price_spike"
  | "cross_state_vendor_risk"
  | "single_bidder"
  | "sequential_wins";

export interface ICollusionFlag extends Document {
  tenderId: Types.ObjectId | null;
  tenderNumber: string | null;
  type: CollusionType;
  description: string;
  vendorsInvolved: string[];
  statesInvolved: string[];
  riskScore: number;
  severity: "low" | "medium" | "high" | "critical";
  details: Record<string, unknown>;
  resolvedAt: Date | null;
  computedAt: Date;
}

const collusionFlagSchema = new Schema<ICollusionFlag>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: "Tender", default: null, index: true },
    tenderNumber: { type: String, default: null },
    type: {
      type: String,
      enum: ["cross_state_repeat_winner", "bid_cluster", "threshold_bid", "price_spike", "cross_state_vendor_risk", "single_bidder", "sequential_wins"],
      required: true,
      index: true
    },
    description: { type: String, required: true },
    vendorsInvolved: { type: [String], default: [] },
    statesInvolved: { type: [String], default: [] },
    riskScore: { type: Number, default: 0, min: 0, max: 100, index: true },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "low", index: true },
    details: { type: Schema.Types.Mixed, default: {} },
    resolvedAt: { type: Date, default: null },
    computedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

collusionFlagSchema.index({ severity: 1, computedAt: -1 });
collusionFlagSchema.index({ vendorsInvolved: 1 });
collusionFlagSchema.index({ statesInvolved: 1 });

export const CollusionFlagModel = model<ICollusionFlag>("CollusionFlag", collusionFlagSchema);
