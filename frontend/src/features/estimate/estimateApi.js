import { api } from "../../app/api";
export const estimateApi = api.injectEndpoints({
    endpoints: (build) => ({
        generateEstimate: build.mutation({
            query: (body) => ({ url: "/api/estimate/generate", method: "POST", body }),
            invalidatesTags: ["Estimate"]
        }),
        getEstimate: build.query({
            query: (id) => `/api/estimate/${id}`,
            providesTags: (_r, _e, id) => [{ type: "Estimate", id }]
        }),
        listEstimates: build.query({
            query: (params) => ({ url: "/api/estimate", params }),
            providesTags: ["Estimate"]
        }),
        compareWithTender: build.mutation({
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
export const { useGenerateEstimateMutation, useGetEstimateQuery, useListEstimatesQuery, useCompareWithTenderMutation } = estimateApi;
