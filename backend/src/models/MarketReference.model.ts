import { Document, Schema, model } from "mongoose";

export type MarketReferenceSource = "WPI" | "CPWD" | "GeM" | "PWD" | "NIC" | "IOCL" | "SAIL";

export interface IMarketReference extends Document {
  itemName: string;
  itemCategory: string;
  unit: string;
  priceINR: number;
  state: string | null;
  stateCode: string | null;
  source: MarketReferenceSource;
  sourceDescription: string;
  sourceURL: string | null;
  referenceDate: Date;
  validUntil: Date | null;
  notes: string | null;
}

const schema = new Schema<IMarketReference>(
  {
    itemName: { type: String, required: true, index: true },
    itemCategory: { type: String, required: true, index: true },
    unit: { type: String, required: true },
    priceINR: { type: Number, required: true, min: 0 },
    state: { type: String, default: null },
    stateCode: { type: String, default: null, index: true },
    source: { type: String, enum: ["WPI", "CPWD", "GeM", "PWD", "NIC", "IOCL", "SAIL"], required: true },
    sourceDescription: { type: String, required: true },
    sourceURL: { type: String, default: null },
    referenceDate: { type: Date, required: true },
    validUntil: { type: Date, default: null },
    notes: { type: String, default: null }
  },
  { timestamps: true }
);

schema.index({ itemName: 1, stateCode: 1, source: 1 });
schema.index({ itemCategory: 1, stateCode: 1 });

export const MarketReferenceModel = model<IMarketReference>("MarketReference", schema);
