import { api } from "../../app/api";

export type ProjectType = "ROAD" | "BRIDGE" | "BUILDING" | "DRAINAGE";
export type ConfidenceLevel = "High" | "Medium" | "Low";
export type FlagColor = "GREEN" | "AMBER" | "RED";

export interface EstimateCostBreakdown {
  materials_cr: number;
  labour_equipment_cr: number;
  earthwork_cr: number;
  structures_cr: number;
  finishing_cr: number;
  profit_cr: number;
  contingency_cr: number;
  gst_cr: number;
}

export interface RiskFactor {
  factor: string;
  impact: string;
  severity: "High" | "Medium" | "Low";
}

export interface ComparableProject {
  name: string;
  location: string;
  year: number;
  cost_cr: number;
  source: string;
}

export interface AIEstimateResult {
  total_cost_cr: number;
  confidence_level: ConfidenceLevel;
  confidence_pct: number;
  unit_rate: { value: number; unit: string };
  sor_reference: string;
  cost_breakdown: EstimateCostBreakdown;
  assumptions: string[];
  risk_factors: RiskFactor[];
  comparable_projects: ComparableProject[];
  anomaly_flags: string[];
  region_adjustment: { state: string; multiplier: number; reason: string };
}

export interface CostHeadComparison {
  head: string;
  fair_cr: number;
  tender_cr: number;
  variance_pct: number;
  suspicious: boolean;
}

export interface TenderCompareResult {
  tender_quoted_cr: number;
  variance_pct: number;
  flag: FlagColor;
  anomaly_analysis: string;
  cost_head_comparison: CostHeadComparison[];
}

export interface Estimate {
  _id: string;
  project_name: string;
  district: string;
  state: string;
  financial_year: string;
  project_type: ProjectType;
  inputs: Record<string, unknown>;
  inputs_hash: string;
  ml_estimate_cr: number | null;
  ml_model_version: string | null;
  ai_result: AIEstimateResult;
  total_cost_cr: number;
  confidence_level: ConfidenceLevel;
  confidence_pct: number;
  claude_model_used: string;
  user_id: string | null;
  tender_comparison: TenderCompareResult | null;
  created_at: string;
}

export interface EstimateListItem extends Omit<Estimate, "inputs" | "ai_result"> {
  ai_result: Omit<AIEstimateResult, "comparable_projects">;
}

export interface EstimateListResponse {
  estimates: EstimateListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface GenerateEstimatePayload {
  project_name: string;
  district: string;
  state: string;
  financial_year: string;
  project_type: ProjectType;
  [key: string]: unknown;
}

export const estimateApi = api.injectEndpoints({
  endpoints: (build) => ({
    generateEstimate: build.mutation<Estimate, GenerateEstimatePayload>({
      query: (body) => ({ url: "/api/estimate/generate", method: "POST", body }),
      invalidatesTags: ["Estimate"]
    }),

    getEstimate: build.query<Estimate, string>({
      query: (id) => `/api/estimate/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Estimate", id }]
    }),

    listEstimates: build.query<
      EstimateListResponse,
      { project_type?: ProjectType; state?: string; page?: number; limit?: number }
    >({
      query: (params) => ({ url: "/api/estimate", params }),
      providesTags: ["Estimate"]
    }),

    compareWithTender: build.mutation<TenderCompareResult, { id: string; tender_quoted_cr: number }>({
      query: ({ id, tender_quoted_cr }) => ({
        url: `/api/estimate/${id}/compare`,
        method: "POST",
        body: { tender_quoted_cr }
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Estimate", id }]
    })
  }),
  overrideExisting: false
});

export const {
  useGenerateEstimateMutation,
  useGetEstimateQuery,
  useListEstimatesQuery,
  useCompareWithTenderMutation
} = estimateApi;
