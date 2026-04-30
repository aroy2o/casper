import { api } from "../../app/api";

export interface AuditFlag {
  lineItemDescription: string;
  quotedRateINR: number;
  marketRateINR: number;
  inflationPct: number;
  confidence: number;
  explanation: string;
  humanSummary?: string | null;
  verdict?: string | null;
  topFactors?: Array<{ feature: string; impact: number; direction: string }>;
  riskContribution?: number | null;
}

export interface Audit {
  _id: string;
  tenderId: string;
  auditedAt: string;
  overallInflationPct: number;
  totalOverpricedINR: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  flags: AuditFlag[];
  mlModelVersion: string;
  reportURL: string | null;
  claudeVerdict: "overpriced" | "neutral" | "underpriced" | null;
  summary: string | null;
  riskSignals: string[];
  recommendation: string | null;
  imagekitUrl: string | null;
  plainEnglishSummary?: string | null;
  overallVerdict?: string | null;
  explanationVersion?: string | null;
}

export interface AuditExplanation {
  overallInflationPct: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  overallVerdict: string | null;
  plainEnglishSummary: string | null;
  explanationVersion: string | null;
  flags: AuditFlag[];
}

export interface AuditSummary {
  totalAudits: number;
  criticalCount: number;
  flaggedTenders: number;
  totalOverpricedINR: number;
  avgInflationPct: number;
}

// ─── Similar Tenders ──────────────────────────────────────────────────────────

export interface SimilarTenderResult {
  _id: string;
  tenderNumber: string;
  title: string;
  state: string;
  district: string | null;
  vendorName: string | null;
  projectType: string;
  publishedDate: string | null;
  totalEstimatedCostINR: number;
  status: string;
  similarityScore: number;
  deviationVsTarget: number | null;
  audit: { riskLevel: string; overallInflationPct: number; totalOverpricedINR: number } | null;
}

export interface SimilarTendersResponse {
  results: SimilarTenderResult[];
  explanationCard: string | null;
  targetTenderId: string;
}

// ─── Item Drill-Down ──────────────────────────────────────────────────────────

export interface MarketCitation {
  source: string;
  sourceDescription: string;
  priceINR: number;
  unit: string;
  stateCode: string | null;
  referenceDate: string;
  sourceURL: string | null;
  notes: string | null;
}

export interface PriceHistoryPoint {
  date: string;
  avgPriceINR: number;
  source: string;
}

export interface InflationBreakdown {
  quotedRate: number;
  baseMarketRate: number;
  formula: string;
  result: number;
  referenceSource: string;
  referenceDate: string;
}

export interface ComparableRates {
  tenderQuoted: number;
  wpiIndex: number | null;
  gemPrice: number | null;
  cpwdSOR: number | null;
  statePwdRate: number | null;
  mlPredicted: number | null;
}

export interface ItemDrillDownResponse {
  item: {
    description: string;
    quantity: number;
    unit: string;
    quotedRateINR: number;
    marketRateINR: number | null;
    inflationPct: number | null;
    flagged: boolean;
    flagReason: string | null;
  };
  marketCitations: MarketCitation[];
  priceHistory: PriceHistoryPoint[];
  inflationBreakdown: InflationBreakdown | null;
  comparableRates: ComparableRates;
  contributingFactors: string[];
  challengesOnRecord: number;
  challenges: Array<{ status: string; rebuttal: string; createdAt: string }>;
}

// ─── Timelines ────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  tenderId: string;
  tenderNumber: string;
  title: string;
  state: string;
  district: string | null;
  vendorName: string | null;
  date: string | null;
  status: string;
  item: {
    description: string;
    quotedRateINR: number;
    marketRateINR: number | null;
    inflationPct: number | null;
    flagged: boolean;
  } | null;
  auditRiskLevel: string | null;
  color: "red" | "yellow" | "green" | "grey";
}

export interface ItemTimelineResponse {
  item: string;
  events: TimelineEvent[];
  anomalies: Array<{ from: number; to: number; jumpPct: number; note: string }>;
  total: number;
}

export interface VendorTimelineEvent {
  tenderId: string;
  tenderNumber: string;
  title: string;
  state: string;
  district: string | null;
  date: string | null;
  totalEstimatedCostINR: number;
  status: string;
  projectType: string;
  procurementMethod: string;
  audit: { riskLevel: string; overallInflationPct: number; totalOverpricedINR: number } | null;
}

export interface VendorTimelineResponse {
  vendorName: string;
  events: VendorTimelineEvent[];
  total: number;
  riskSummary: {
    totalTenders: number;
    flaggedCount: number;
    flagRate: number;
    statesActive: string[];
    avgInflationPct: number;
  } | null;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface AuditReportRecord {
  _id: string;
  reportType: "tender" | "vendor" | "item" | "regional";
  referenceId: string;
  referenceName: string;
  format: "pdf" | "csv";
  downloadURL: string | null;
  generatedBy: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ReportHistoryResponse {
  reports: AuditReportRecord[];
  total: number;
  page: number;
  pages: number;
}

export interface ExportReportRequest {
  reportType: "tender" | "vendor" | "item" | "regional";
  referenceId: string;
  format: "pdf" | "csv";
}

export interface ExportReportResponse {
  reportId: string;
  reportType: string;
  referenceName: string;
  format: string;
  downloadURL: string;
  generatedAt: string;
}

// ─── RTK Query endpoints ──────────────────────────────────────────────────────

export const auditsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Existing
    getAuditByTenderId: builder.query<Audit, string>({
      query: (tenderId) => `/api/audits/${tenderId}`,
      providesTags: (_result, _err, id) => [{ type: "Audit", id }]
    }),
    getAuditSummary: builder.query<AuditSummary, void>({
      query: () => "/api/audits/summary",
      providesTags: ["Audit"]
    }),
    getAuditExplanation: builder.query<AuditExplanation, string>({
      query: (tenderId) => `/api/audits/${tenderId}/explanation`
    }),

    // New: Similar Tenders
    getSimilarTenders: builder.query<SimilarTendersResponse, { tenderId: string; limit?: number }>({
      query: ({ tenderId, limit = 10 }) => `/api/audits/${tenderId}/similar?limit=${limit}`
    }),

    // New: Item Drill-Down
    getItemDrillDown: builder.query<ItemDrillDownResponse, { tenderId: string; item: string }>({
      query: ({ tenderId, item }) => `/api/audits/${tenderId}/item-drill-down?item=${encodeURIComponent(item)}`
    }),

    // New: Item Timeline
    getItemTimeline: builder.query<ItemTimelineResponse, { item: string; state?: string; district?: string; limit?: number }>({
      query: ({ item, state, district, limit = 50 }) => {
        const params = new URLSearchParams({ item });
        if (state) params.set("state", state);
        if (district) params.set("district", district);
        if (limit) params.set("limit", String(limit));
        return `/api/audits/item-timeline?${params.toString()}`;
      }
    }),

    // New: Vendor Timeline
    getVendorTimeline: builder.query<VendorTimelineResponse, { vendor_name: string; limit?: number }>({
      query: ({ vendor_name, limit = 50 }) =>
        `/api/audits/vendor-timeline?vendor_name=${encodeURIComponent(vendor_name)}&limit=${limit}`
    }),

    // New: Report History
    getReportHistory: builder.query<ReportHistoryResponse, { page?: number; limit?: number } | void>({
      query: (params) => {
        const p = params ?? {};
        return `/api/audits/reports?page=${p.page ?? 1}&limit=${p.limit ?? 20}`;
      },
      providesTags: ["Audit"]
    }),

    // New: Export Report (mutation)
    exportReport: builder.mutation<ExportReportResponse, ExportReportRequest>({
      query: (body) => ({
        url: "/api/audits/export",
        method: "POST",
        body
      }),
      invalidatesTags: ["Audit"]
    }),

    // New: Challenge Flag (mutation)
    challengeFlag: builder.mutation<
      { challengeId: string; status: string; message: string },
      { tenderId: string; itemDescription: string; rebuttal: string; supportingDocumentURL?: string }
    >({
      query: ({ tenderId, ...body }) => ({
        url: `/api/audits/${tenderId}/challenge-flag`,
        method: "POST",
        body
      })
    })
  })
});

export const {
  useGetAuditByTenderIdQuery,
  useGetAuditSummaryQuery,
  useGetAuditExplanationQuery,
  useGetSimilarTendersQuery,
  useGetItemDrillDownQuery,
  useGetItemTimelineQuery,
  useGetVendorTimelineQuery,
  useGetReportHistoryQuery,
  useExportReportMutation,
  useChallengeFlagMutation
} = auditsApi;
