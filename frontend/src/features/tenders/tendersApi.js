import { api } from "../../app/api";
export const tendersApi = api.injectEndpoints({
    endpoints: (builder) => ({
        getTenders: builder.query({
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
        compareTenders: builder.query({
            query: (ids) => `/api/tenders/compare?ids=${ids.join(",")}`,
            providesTags: ["Tender"]
        }),
        getTenderById: builder.query({
            query: (id) => `/api/tenders/${id}`,
            providesTags: (_result, _err, id) => [{ type: "Tender", id }]
        }),
        uploadTender: builder.mutation({
            query: (body) => ({
                url: "/api/tenders/upload",
                method: "POST",
                body
            }),
            invalidatesTags: ["Tender", "Audit"]
        }),
        upsertTenderBoq: builder.mutation({
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
