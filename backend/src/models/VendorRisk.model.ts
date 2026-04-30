import { Document, Schema, model } from "mongoose";

export interface IStatePresence {
  stateCode: string;
  stateName: string;
  tenderCount: number;
  winCount: number;
  flaggedCount: number;
  avgInflationPct: number;
}

export interface IVendorRisk extends Document {
  vendorName: string;
  vendorNameNormalized: string;
  nationalRiskScore: number;
  stateRiskScores: Record<string, number>;
  statePresence: IStatePresence[];
  totalTenders: number;
  totalWins: number;
  totalFlagged: number;
  avgBidINR: number;
  crossStateCartel: boolean;
  collusionFlags: number;
  bidSuppression: boolean;
  repeatWinRate: number;
  lastSeenAt: Date;
  computedAt: Date;
}

const statePresenceSchema = new Schema<IStatePresence>(
  {
    stateCode: { type: String, required: true },
    stateName: { type: String, required: true },
    tenderCount: { type: Number, default: 0 },
    winCount: { type: Number, default: 0 },
    flaggedCount: { type: Number, default: 0 },
    avgInflationPct: { type: Number, default: 0 }
  },
  { _id: false }
);

const vendorRiskSchema = new Schema<IVendorRisk>(
  {
    vendorName: { type: String, required: true },
    vendorNameNormalized: { type: String, required: true },
    nationalRiskScore: { type: Number, default: 0, min: 0, max: 100, index: true },
    stateRiskScores: { type: Map, of: Number, default: {} },
    statePresence: { type: [statePresenceSchema], default: [] },
    totalTenders: { type: Number, default: 0 },
    totalWins: { type: Number, default: 0 },
    totalFlagged: { type: Number, default: 0 },
    avgBidINR: { type: Number, default: 0 },
    crossStateCartel: { type: Boolean, default: false, index: true },
    collusionFlags: { type: Number, default: 0 },
    bidSuppression: { type: Boolean, default: false },
    repeatWinRate: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: Date.now },
    computedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

vendorRiskSchema.index({ vendorNameNormalized: 1 }, { unique: true });
vendorRiskSchema.index({ nationalRiskScore: -1 });
vendorRiskSchema.index({ crossStateCartel: 1, nationalRiskScore: -1 });

export const VendorRiskModel = model<IVendorRisk>("VendorRisk", vendorRiskSchema);
