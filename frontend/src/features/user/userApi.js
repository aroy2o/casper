import { api } from "../../app/api";
export const userApi = api.injectEndpoints({
    endpoints: (builder) => ({
        getProfile: builder.query({
            query: () => "/api/user/profile",
            providesTags: ["User"]
        }),
        updatePreferences: builder.mutation({
            query: (body) => ({
                url: "/api/user/preferences",
                method: "PATCH",
                body
            }),
            invalidatesTags: ["User"]
        }),
        pushSubscribe: builder.mutation({
            query: (body) => ({
                url: "/api/user/push-subscribe",
                method: "POST",
                body
            }),
            invalidatesTags: ["User"]
        }),
        syncTenders: builder.mutation({
            query: ({ yearsBack, terms, portals, scope, maxRecords }) => ({
                url: "/api/admin/tenders/sync-last-3-years",
                method: "POST",
                body: {
                    yearsBack,
                    terms: terms.join(","),
                    portals: portals.join(","),
                    scope,
                    maxRecords
                }
            }),
            invalidatesTags: ["Tender"]
        })
    })
});
export const { useGetProfileQuery, useUpdatePreferencesMutation, usePushSubscribeMutation, useSyncTendersMutation } = userApi;
