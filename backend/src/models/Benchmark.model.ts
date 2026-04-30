import { Document, Schema, model } from "mongoose";

export type BenchmarkProjectType = "road" | "bridge" | "building" | "other";

export interface IBenchmark extends Document {
  projectId: string;
  projectName: string;
  projectType: BenchmarkProjectType;
  region: string;
  totalCostINR: number;
  lengthKm: number | null;
  costPerKmINR: number | null;
  approvalYear: number;
  source: "worldbank";
  fetchedAt: Date;
}

const benchmarkSchema = new Schema<IBenchmark>(
  {
    projectId: { type: String, required: true },
    projectName: { type: String, required: true },
    projectType: { type: String, enum: ["road", "bridge", "building", "other"], required: true, index: true },
    region: { type: String, required: true, index: true },
    totalCostINR: { type: Number, required: true, min: 0 },
    lengthKm: { type: Number, default: null, min: 0 },
    costPerKmINR: { type: Number, default: null, min: 0 },
    approvalYear: { type: Number, required: true, index: true },
    source: { type: String, enum: ["worldbank"], default: "worldbank", index: true },
    fetchedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

benchmarkSchema.index({ projectId: 1 }, { unique: true });

export const BenchmarkModel = model<IBenchmark>("Benchmark", benchmarkSchema);

