import { api } from "../../app/api";
// ─── Endpoints ────────────────────────────────────────────────────────────────
export const analyticsApi = api.injectEndpoints({
    endpoints: (builder) => ({
        getStateList: builder.query({
            query: () => "/api/analytics/states"
        }),
        getTrends: builder.query({
            query: (params) => ({
                url: "/api/analytics/trends",
                params
            })
        }),
        getHeatmap: builder.query({
            query: (params) => ({
                url: "/api/analytics/heatmap",
                params
            })
        }),
        getTopInflated: builder.query({
            query: (params) => ({
                url: "/api/analytics/top-inflated",
                params
            })
        }),
        getPredictions: builder.query({
            query: (params) => ({
                url: "/api/analytics/predictions",
                params
            })
        }),
        getCollusionFlags: builder.query({
            query: (params) => ({
                url: "/api/analytics/collusion-flags",
                params
            })
        }),
        getVendorRiskScores: builder.query({
            query: (params) => ({
                url: "/api/analytics/vendor-risk-scores",
                params
            })
        }),
        getVendorRegistry: builder.query({
            query: (params) => ({
                url: "/api/analytics/vendor-registry",
                params
            })
        }),
        getVendorNetwork: builder.query({
            query: (params) => ({
                url: "/api/analytics/vendor-network",
                params: params ?? { minScore: 0.3, limit: 50 }
            })
        })
    })
});
export const { useGetStateListQuery, useGetTrendsQuery, useGetHeatmapQuery, useGetTopInflatedQuery, useGetPredictionsQuery, useGetCollusionFlagsQuery, useGetVendorRiskScoresQuery, useGetVendorRegistryQuery, useGetVendorNetworkQuery } = analyticsApi;
