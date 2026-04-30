import { api } from "../../app/api";

export interface TenderLineItem {
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

export interface TenderCostBreakdown {
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

export interface TenderBoqPayload {
  lineItems: Array<{
    description: string;
    quantity: number;
    unit: string;
    quotedRateINR: number;
  }>;
  region?: string;
  vendorName?: string;
  procurementMethod?: "open" | "limited" | "nomination" | "other";
  contractYear?: number;
  locationText?: string;
  boqDocumentURL?: string;
}

export interface AuditFlag {
  lineItemDescription: string;
  quotedRateINR: number;
  marketRateINR: number;
  inflationPct: number;
  confidence: number;
  explanation: string;
}

export interface Tender {
  _id: string;
  title: string;
  department: string;
  state: string;
  tenderNumber: string;
  totalEstimatedCostINR: number;
  projectType: string;
  lengthKm: number | null;
  sourceURL: string | null;
  sourcePortal?: "eprocure" | "etenders" | "worldbank" | "manual";
  organisation?: string | null;
  detailURL?: string | null;
  publishedDate?: string | null;
  closingDate?: string | null;
  locationText?: string | null;
  scrapedQuery?: string | null;
  scrapedYear?: number | null;
  vendorName?: string | null;
  procurementMethod?: "open" | "limited" | "nomination" | "other";
  contractYear?: number | null;
  boqAvailable?: boolean;
  boqDocumentURL?: string | null;
  itemizationStatus?: "none" | "partial" | "detailed";
  dataCompletenessScore?: number;
  costBreakdown?: TenderCostBreakdown | null;
  rawText?: string;
  errorMessage?: string;
  parsedAt: string;
  lineItems: TenderLineItem[];
  status: "pending" | "parsing" | "analyzing" | "flagged" | "clean" | "insufficient_data" | "error";
  audit?: {
    _id: string;
    tenderId: string;
    auditedAt: string;
    createdAt?: string;
    overallInflationPct: number;
    totalOverpricedINR: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    summary?: string;
    lineItems?: TenderLineItem[];
    flags?: AuditFlag[];
  } | null;
}

export interface TenderFilters {
  state?: string;
  district?: string;
  status?: string;
  projectType?: string;
  procurementMethod?: "open" | "limited" | "nomination" | "other";
  vendor?: string;
  riskLevel?: "low" | "medium" | "high" | "critical";
  dateFrom?: string;
  dateTo?: string;
  costMin?: number;
  costMax?: number;
  search?: string;
  includeArchived?: boolean;
  page?: number;
  limit?: number;
}

export interface CompareResult {
  tenders: (Tender & { audit: Tender["audit"] })[];
  highlights: Record<string, boolean>;
}

export const tendersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTenders: builder.query<Tender[], TenderFilters | void>({
      query: (params) => {
        if (!params) {
          return "/api/tenders";
        }
        return {
          url: "/api/tenders",
          params
        };
      },
      providesTags: ["Tender"]
    }),
    compareTenders: builder.query<CompareResult, string[]>({
      query: (ids) => `/api/tenders/compare?ids=${ids.join(",")}`,
      providesTags: ["Tender"]
    }),
    getTenderById: builder.query<Tender, string>({
      query: (id) => `/api/tenders/${id}`,
      providesTags: (_result, _err, id) => [{ type: "Tender", id }]
    }),
    uploadTender: builder.mutation<Tender, FormData>({
      query: (body) => ({
        url: "/api/tenders/upload",
        method: "POST",
        body
      }),
      invalidatesTags: ["Tender", "Audit"]
    }),
    upsertTenderBoq: builder.mutation<
      {
        tenderId: string;
        itemizationStatus: "none" | "partial" | "detailed";
        dataCompletenessScore: number;
        riskLevel: "low" | "medium" | "high" | "critical";
        overallInflationPct: number;
        totalOverpricedINR: number;
        lineItemsCount: number;
      },
      { id: string; payload: TenderBoqPayload }
    >({
      query: ({ id, payload }) => ({
        url: `/api/tenders/${id}/boq`,
        method: "POST",
        body: payload
      }),
      invalidatesTags: (_result, _err, arg) => ["Audit", "Tender", { type: "Tender", id: arg.id }]
    })
  })
});

export const { useGetTendersQuery, useGetTenderByIdQuery, useUploadTenderMutation, useUpsertTenderBoqMutation, useCompareTendersQuery } = tendersApi;
