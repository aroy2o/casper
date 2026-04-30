import { Document, Schema, model } from "mongoose";

export interface IPrice extends Document {
  material: string;
  unit: string;
  priceINR: number;
  source: string;
  sourceURL: string;
  region: string;
  state: string | null;
  stateCode: string | null;
  district: string | null;
  districtCode: string | null;
  scrapedAt: Date;
  isActive: boolean;
}

const priceSchema = new Schema<IPrice>(
  {
    material: { type: String, required: true, index: true },
    unit: { type: String, required: true },
    priceINR: { type: Number, required: true, min: 0 },
    source: { type: String, required: true },
    sourceURL: { type: String, required: true },
    region: { type: String, required: true, index: true },
    state: { type: String, default: null, index: true },
    stateCode: { type: String, default: null, index: true },
    district: { type: String, default: null },
    districtCode: { type: String, default: null },
    scrapedAt: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

priceSchema.index({ material: 1, region: 1, isActive: 1 });
priceSchema.index({ material: 1, stateCode: 1, districtCode: 1, isActive: 1 });
priceSchema.index({ stateCode: 1, scrapedAt: -1 });

export const PriceModel = model<IPrice>("Price", priceSchema);
