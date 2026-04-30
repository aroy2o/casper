import { api } from "../../app/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StateInfo {
  code: string;
  name: string;
  type: "state" | "ut";
  districts: { name: string; code: string }[];
}

export interface TrendPoint {
  date: string;
  avgPriceINR: number;
}

export interface TrendData {
  scope: "state" | "national";
  stateCode?: string;
  material: string;
  series?: TrendPoint[];
  stateSeries?: Record<string, TrendPoint[]>;
}

export interface HeatmapStateEntry {
  stateCode: string;
  stateName: string;
  type: "state" | "ut";
  avgPriceINR: number | null;
  deviationPct: number | null;
  tenderCount: number;
}

export interface HeatmapDistrictEntry {
  districtCode: string;
  districtName: string;
  avgPriceINR: number | null;
  deviationPct: number | null;
  tenderCount: number;
}

export interface HeatmapData {
  scope: "state" | "district";
  stateCode?: string;
  material: string;
  median: number;
  states?: HeatmapStateEntry[];
  districts?: HeatmapDistrictEntry[];
}

export interface TopInflatedItem {
  code: string;
  label: string;
  avgPriceINR: number;
  deviationPct: number;
}

export interface TopInflatedData {
  type: "state" | "district";
  material: string;
  median: number;
  items: TopInflatedItem[];
}

export interface Prediction {
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
  fallbackLevel: "district" | "state" | "national";
}

export interface CollusionFlag {
  _id: string;
  type: string;
  description: string;
  vendorsInvolved: string[];
  statesInvolved: string[];
  riskScore: number;
  severity: "low" | "medium" | "high" | "critical";
  details: Record<string, unknown>;
  computedAt: string;
}

export interface VendorRisk {
  _id: string;
  vendorName: string;
  nationalRiskScore: number;
  statePresence: {
    stateCode: string;
    stateName: string;
    tenderCount: number;
    winCount: number;
    flaggedCount: number;
    avgInflationPct: number;
  }[];
  totalTenders: number;
  totalWins: number;
  totalFlagged: number;
  crossStateCartel: boolean;
  collusionFlags: number;
  repeatWinRate: number;
  lastSeenAt: string;
}

export interface VendorNetworkNode {
  id: string;
  name: string;
  collusionScore: number;
  totalTenders: number;
  wonTenders: number;
  totalValue: number;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  department: string;
  state: string;
}

export interface VendorNetworkEdge {
  source: string;
  target: string;
  sharedBids: number;
  priceSimilarity: number;
  connectionStrength: number;
  isSuspicious: boolean;
  evidence: string[];
}

export interface VendorRing {
  id: string;
  vendors: string[];
  avgCollusionScore: number;
  totalTendersAffected: number;
  estimatedFraudValue: number;
}

export interface VendorNetworkResponse {
  nodes: VendorNetworkNode[];
  edges: VendorNetworkEdge[];
  rings: VendorRing[];
  summary: {
    totalVendors: number;
    suspiciousConnections: number;
    identifiedRings: number;
    highRiskVendors: number;
  };
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

export const analyticsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getStateList: builder.query<StateInfo[], void>({
      query: () => "/api/analytics/states"
    }),
    getTrends: builder.query<TrendData, { state?: string; district?: string; item?: string; period?: string; days?: number }>({
      query: (params) => ({
        url: "/api/analytics/trends",
        params
      })
    }),
    getHeatmap: builder.query<HeatmapData, { item?: string; state?: string; period?: string }>({
      query: (params) => ({
        url: "/api/analytics/heatmap",
        params
      })
    }),
    getTopInflated: builder.query<TopInflatedData, { type?: string; limit?: number; item?: string; state?: string }>({
      query: (params) => ({
        url: "/api/analytics/top-inflated",
        params
      })
    }),
    getPredictions: builder.query<Prediction[], { state?: string; district?: string; item?: string }>({
      query: (params) => ({
        url: "/api/analytics/predictions",
        params
      })
    }),
    getCollusionFlags: builder.query<{ flags: CollusionFlag[]; total: number; page: number; pages: number }, { state?: string; severity?: string; page?: number; limit?: number }>({
      query: (params) => ({
        url: "/api/analytics/collusion-flags",
        params
      })
    }),
    getVendorRiskScores: builder.query<{ vendors: VendorRisk[]; total: number; page: number; pages: number }, { state?: string; minScore?: number; page?: number; limit?: number }>({
      query: (params) => ({
        url: "/api/analytics/vendor-risk-scores",
        params
      })
    }),
    getVendorRegistry: builder.query<{ vendors: VendorRisk[]; total: number; page: number; pages: number }, { search?: string; state?: string; page?: number; limit?: number }>({
      query: (params) => ({
        url: "/api/analytics/vendor-registry",
        params
      })
    }),
    getVendorNetwork: builder.query<VendorNetworkResponse, { minScore?: number; limit?: number } | void>({
      query: (params) => ({
        url: "/api/analytics/vendor-network",
        params: params ?? { minScore: 0.3, limit: 50 }
      })
    })
  })
});

export const {
  useGetStateListQuery,
  useGetTrendsQuery,
  useGetHeatmapQuery,
  useGetTopInflatedQuery,
  useGetPredictionsQuery,
  useGetCollusionFlagsQuery,
  useGetVendorRiskScoresQuery,
  useGetVendorRegistryQuery,
  useGetVendorNetworkQuery
} = analyticsApi;
