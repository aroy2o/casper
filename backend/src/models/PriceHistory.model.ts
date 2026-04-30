import { Document, Schema, model } from "mongoose";

export interface IPriceHistoryPoint {
  date: Date;
  priceINR: number;
  source: string;
}

export interface IPriceHistory extends Document {
  material: string;
  region: string;
  state: string | null;
  stateCode: string | null;
  district: string | null;
  districtCode: string | null;
  dataPoints: IPriceHistoryPoint[];
}

const priceHistoryPointSchema = new Schema<IPriceHistoryPoint>(
  {
    date: { type: Date, required: true },
    priceINR: { type: Number, required: true },
    source: { type: String, required: true }
  },
  { _id: false }
);

const priceHistorySchema = new Schema<IPriceHistory>(
  {
    material: { type: String, required: true, index: true },
    region: { type: String, required: true, index: true },
    state: { type: String, default: null, index: true },
    stateCode: { type: String, default: null, index: true },
    district: { type: String, default: null },
    districtCode: { type: String, default: null },
    dataPoints: { type: [priceHistoryPointSchema], default: [] }
  },
  { timestamps: true }
);

priceHistorySchema.index({ material: 1, region: 1 }, { unique: true });
priceHistorySchema.index({ material: 1, stateCode: 1 });

export const PriceHistoryModel = model<IPriceHistory>("PriceHistory", priceHistorySchema);
