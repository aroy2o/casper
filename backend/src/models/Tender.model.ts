import { Document, Schema, Types, model } from "mongoose";
import { ProjectType, TenderStatus } from "../types/index.js";

export interface ITenderLineItem {
  description: string;
  quantity: number;
  unit: string;
  quotedRateINR: number;
  totalCostINR?: number;
  marketRateINR: number | null;
  inflationPct: number | null;
  flagged: boolean;
  flagReason: string | null;
}

export interface ITenderCostBreakdown {
  materialsCostINR: number;
  labourCostINR: number;
  machineryCostINR: number;
  overheadCostINR: number;
  contractorProfitINR: number;
  contingencyINR: number;
  cgstINR: number;
  sgstINR: number;
  igstINR: number;
}

export interface ITender extends Document {
  title: string;
  department: string;
  state: string;
  stateCode: string | null;
  district: string | null;
  districtCode: string | null;
  regionCode: string | null;
  tenderNumber: string;
  totalEstimatedCostINR: number;
  projectType: ProjectType;
  lengthKm: number | null;
  sourceURL: string | null;
  detailURL: string | null;
  uploadedBy: Types.ObjectId | null;
  filePath: string | null;
  parsedAt: Date;
  rawText: string;
  lineItems: ITenderLineItem[];
  status: TenderStatus;
  sourcePortal: "eprocure" | "etenders" | "worldbank" | "manual";
  organisation: string | null;
  publishedDate: Date | null;
  closingDate: Date | null;
  locationText: string | null;
  scrapedQuery: string | null;
  scrapedYear: number | null;
  vendorName: string | null;
  procurementMethod: "open" | "limited" | "nomination" | "other";
  contractYear: number | null;
  boqAvailable: boolean;
  boqDocumentURL: string | null;
  itemizationStatus: "none" | "partial" | "detailed";
  dataCompletenessScore: number;
  costBreakdown: ITenderCostBreakdown | null;
  isArchived: boolean;
  archivedAt: Date | null;
  archivedReason: string | null;
}

const tenderLineItemSchema = new Schema<ITenderLineItem>(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    quotedRateINR: { type: Number, required: true, min: 0 },
    totalCostINR: { type: Number, required: true, min: 0, default: 0 },
    marketRateINR: { type: Number, default: null },
    inflationPct: { type: Number, default: null },
    flagged: { type: Boolean, default: false },
    flagReason: { type: String, default: null }
  },
  { _id: false }
);

const tenderCostBreakdownSchema = new Schema<ITenderCostBreakdown>(
  {
    materialsCostINR: { type: Number, required: true, min: 0 },
    labourCostINR: { type: Number, required: true, min: 0 },
    machineryCostINR: { type: Number, required: true, min: 0 },
    overheadCostINR: { type: Number, required: true, min: 0 },
    contractorProfitINR: { type: Number, required: true, min: 0 },
    contingencyINR: { type: Number, required: true, min: 0 },
    cgstINR: { type: Number, required: true, min: 0 },
    sgstINR: { type: Number, required: true, min: 0 },
    igstINR: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const tenderSchema = new Schema<ITender>(
  {
    title: { type: String, required: true },
    department: { type: String, required: true },
    state: { type: String, required: true, index: true },
    stateCode: { type: String, default: null, index: true },
    district: { type: String, default: null, index: true },
    districtCode: { type: String, default: null, index: true },
    regionCode: { type: String, default: null },
    tenderNumber: { type: String, required: true, unique: true },
    totalEstimatedCostINR: { type: Number, required: true, min: 0 },
    projectType: { type: String, required: true },
    lengthKm: { type: Number, default: null },
    sourceURL: { type: String, default: null },
    detailURL: { type: String, default: null },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    filePath: { type: String, default: null },
    parsedAt: { type: Date, default: Date.now },
    rawText: { type: String, required: true },
    lineItems: { type: [tenderLineItemSchema], default: [] },
    status: {
      type: String,
      enum: ["pending", "parsing", "analyzing", "flagged", "clean", "insufficient_data", "error"],
      default: "pending"
    },
    sourcePortal: {
      type: String,
      enum: ["eprocure", "etenders", "worldbank", "manual"],
      default: "manual",
      index: true
    },
    organisation: { type: String, default: null },
    publishedDate: { type: Date, default: null, index: true },
    closingDate: { type: Date, default: null },
    locationText: { type: String, default: null },
    scrapedQuery: { type: String, default: null },
    scrapedYear: { type: Number, default: null, index: true },
    vendorName: { type: String, default: null },
    procurementMethod: { type: String, enum: ["open", "limited", "nomination", "other"], default: "other" },
    contractYear: { type: Number, default: null, index: true },
    boqAvailable: { type: Boolean, default: false, index: true },
    boqDocumentURL: { type: String, default: null },
    itemizationStatus: { type: String, enum: ["none", "partial", "detailed"], default: "none", index: true },
    dataCompletenessScore: { type: Number, default: 0, min: 0, max: 100 },
    costBreakdown: { type: tenderCostBreakdownSchema, default: null },
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
    archivedReason: { type: String, default: null }
  },
  { timestamps: true }
);

tenderSchema.index({ state: 1, status: 1 });
tenderSchema.index({ stateCode: 1, districtCode: 1, projectType: 1 });
tenderSchema.index({ stateCode: 1, publishedDate: 1 });
tenderSchema.index({ vendorName: 1, stateCode: 1 });

export const TenderModel = model<ITender>("Tender", tenderSchema);
