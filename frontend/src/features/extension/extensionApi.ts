import { api } from "../../app/api";

export interface ExtensionAuditFlag {
  lineItemDescription: string;
  quotedRateINR: number;
  marketRateINR: number;
  inflationPct: number;
  confidence: number;
  explanation: string;
}

export interface ExtensionAudit {
  _id: string;
  sourceURL: string;
  pageTitle: string;
  tenderNumber: string | null;
  department: string | null;
  riskLevel: "low" | "medium" | "high" | "critical";
  overallInflationPct: number;
  totalOverpricedINR: number;
  flags: ExtensionAuditFlag[];
  summary: string | null;
  recommendation: string | null;
  riskSignals: string[];
  claudeVerdict: string | null;
  mlModelVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtensionAuditsResponse {
  audits: ExtensionAudit[];
  total: number;
  page: number;
  pages: number;
}

export const extensionApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getExtensionAudits: builder.query<
      ExtensionAuditsResponse,
      { page?: number; limit?: number; riskLevel?: string }
    >({
      query: ({ page = 1, limit = 15, riskLevel } = {}) => {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (riskLevel) params.set("riskLevel", riskLevel);
        return `/api/extension/audits?${params.toString()}`;
      },
      providesTags: ["Audit"]
    }),

    getExtensionAuditById: builder.query<ExtensionAudit, string>({
      query: (auditId) => `/api/extension/audits/${auditId}`,
      providesTags: (_result, _err, id) => [{ type: "Audit", id }]
    })
  })
});

export const { useGetExtensionAuditsQuery, useGetExtensionAuditByIdQuery } = extensionApi;
