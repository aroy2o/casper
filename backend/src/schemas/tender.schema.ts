import { z } from "zod";

const tenderLineItemSchema = z.object({
  description: z.string().min(2).max(400),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(50),
  quotedRateINR: z.coerce.number().positive()
});

const parseLineItemsInput = (value: unknown): unknown => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

export const uploadTenderSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  department: z.string().min(2).max(200).optional(),
  state: z.string().min(2).max(50).optional(),
  tenderNumber: z.string().min(3).max(100).optional(),
  totalEstimatedCostINR: z.coerce.number().positive().optional(),
  projectType: z.enum(["road", "bridge", "railway", "building", "drainage", "other"]).optional(),
  lengthKm: z.coerce.number().positive().optional(),
  sourceURL: z.string().url().optional(),
  detailURL: z.string().url().optional(),
  organisation: z.string().min(2).max(220).optional(),
  locationText: z.string().min(2).max(300).optional(),
  vendorName: z.string().min(2).max(220).optional(),
  procurementMethod: z.enum(["open", "limited", "nomination", "other"]).optional(),
  contractYear: z.coerce.number().int().min(2000).max(2100).optional(),
  boqDocumentURL: z.string().url().optional(),
  lineItems: z.preprocess(parseLineItemsInput, z.array(tenderLineItemSchema).max(200)).optional()
});

export const upsertTenderBoqSchema = z.object({
  lineItems: z.array(tenderLineItemSchema).min(1).max(500),
  region: z.string().min(2).max(50).optional(),
  vendorName: z.string().min(2).max(220).optional(),
  procurementMethod: z.enum(["open", "limited", "nomination", "other"]).optional(),
  contractYear: z.coerce.number().int().min(2000).max(2100).optional(),
  locationText: z.string().min(2).max(300).optional(),
  boqDocumentURL: z.string().url().optional()
});

export const tenderQuerySchema = z.object({
  state: z.string().optional(),
  district: z.string().optional(),
  status: z.string().optional(),
  projectType: z.string().optional(),
  procurementMethod: z.enum(["open", "limited", "nomination", "other"]).optional(),
  vendor: z.string().optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  costMin: z.coerce.number().min(0).optional(),
  costMax: z.coerce.number().min(0).optional(),
  search: z.string().max(200).optional(),
  includeArchived: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const compareQuerySchema = z.object({
  ids: z.string().min(1)
});
