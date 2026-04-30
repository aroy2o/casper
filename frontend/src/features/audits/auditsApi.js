import { api } from "../../app/api";
// ─── RTK Query endpoints ──────────────────────────────────────────────────────
export const auditsApi = api.injectEndpoints({
    endpoints: (builder) => ({
        // Existing
        getAuditByTenderId: builder.query({
            query: (tenderId) => `/api/audits/${tenderId}`,
            providesTags: (_result, _err, id) => [{ type: "Audit", id }]
        }),
        getAuditSummary: builder.query({
            query: () => "/api/audits/summary",
            providesTags: ["Audit"]
        }),
        getAuditExplanation: builder.query({
            query: (tenderId) => `/api/audits/${tenderId}/explanation`
        }),
        // New: Similar Tenders
        getSimilarTenders: builder.query({
            query: ({ tenderId, limit = 10 }) => `/api/audits/${tenderId}/similar?limit=${limit}`
        }),
        // New: Item Drill-Down
        getItemDrillDown: builder.query({
            query: ({ tenderId, item }) => `/api/audits/${tenderId}/item-drill-down?item=${encodeURIComponent(item)}`
        }),
        // New: Item Timeline
        getItemTimeline: builder.query({
            query: ({ item, state, district, limit = 50 }) => {
                const params = new URLSearchParams({ item });
                if (state)
                    params.set("state", state);
                if (district)
                    params.set("district", district);
                if (limit)
                    params.set("limit", String(limit));
                return `/api/audits/item-timeline?${params.toString()}`;
            }
        }),
        // New: Vendor Timeline
        getVendorTimeline: builder.query({
            query: ({ vendor_name, limit = 50 }) => `/api/audits/vendor-timeline?vendor_name=${encodeURIComponent(vendor_name)}&limit=${limit}`
        }),
        // New: Report History
        getReportHistory: builder.query({
            query: (params) => {
                const p = params ?? {};
                return `/api/audits/reports?page=${p.page ?? 1}&limit=${p.limit ?? 20}`;
            },
            providesTags: ["Audit"]
        }),
        // New: Export Report (mutation)
        exportReport: builder.mutation({
            query: (body) => ({
                url: "/api/audits/export",
                method: "POST",
                body
            }),
            invalidatesTags: ["Audit"]
        }),
        // New: Challenge Flag (mutation)
        challengeFlag: builder.mutation({
            query: ({ tenderId, ...body }) => ({
                url: `/api/audits/${tenderId}/challenge-flag`,
                method: "POST",
                body
            })
        })
    })
});
export const { useGetAuditByTenderIdQuery, useGetAuditSummaryQuery, useGetAuditExplanationQuery, useGetSimilarTendersQuery, useGetItemDrillDownQuery, useGetItemTimelineQuery, useGetVendorTimelineQuery, useGetReportHistoryQuery, useExportReportMutation, useChallengeFlagMutation } = auditsApi;
