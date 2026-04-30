import { Document, Schema, model } from "mongoose";

export interface IPrediction extends Document {
  material: string;
  stateCode: string;
  stateName: string;
  districtCode: string | null;
  districtName: string | null;
  predictedPriceINR: number;
  lowerBoundINR: number;
  upperBoundINR: number;
  currentPriceINR: number;
  deviationPct: number;
  forecastMonth: string;
  modelVersion: string;
  confidence: number;
  dataPointsUsed: number;
  fallbackLevel: "district" | "state" | "national";
  computedAt: Date;
}

const predictionSchema = new Schema<IPrediction>(
  {
    material: { type: String, required: true, index: true },
    stateCode: { type: String, required: true, index: true },
    stateName: { type: String, required: true },
    districtCode: { type: String, default: null },
    districtName: { type: String, default: null },
    predictedPriceINR: { type: Number, required: true, min: 0 },
    lowerBoundINR: { type: Number, required: true, min: 0 },
    upperBoundINR: { type: Number, required: true, min: 0 },
    currentPriceINR: { type: Number, required: true, min: 0 },
    deviationPct: { type: Number, default: 0 },
    forecastMonth: { type: String, required: true },
    modelVersion: { type: String, required: true },
    confidence: { type: Number, default: 0, min: 0, max: 1 },
    dataPointsUsed: { type: Number, default: 0 },
    fallbackLevel: { type: String, enum: ["district", "state", "national"], default: "national" },
    computedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

predictionSchema.index({ material: 1, stateCode: 1, forecastMonth: 1, districtCode: 1 }, { unique: true });
predictionSchema.index({ stateCode: 1, forecastMonth: 1 });
predictionSchema.index({ computedAt: -1 });

export const PredictionModel = model<IPrediction>("Prediction", predictionSchema);
