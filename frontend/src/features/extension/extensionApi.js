import { api } from "../../app/api";
export const extensionApi = api.injectEndpoints({
    endpoints: (builder) => ({
        getExtensionAudits: builder.query({
            query: ({ page = 1, limit = 15, riskLevel } = {}) => {
                const params = new URLSearchParams({ page: String(page), limit: String(limit) });
                if (riskLevel)
                    params.set("riskLevel", riskLevel);
                return `/api/extension/audits?${params.toString()}`;
            },
            providesTags: ["Audit"]
        }),
        getExtensionAuditById: builder.query({
            query: (auditId) => `/api/extension/audits/${auditId}`,
            providesTags: (_result, _err, id) => [{ type: "Audit", id }]
        })
    })
});
export const { useGetExtensionAuditsQuery, useGetExtensionAuditByIdQuery } = extensionApi;
