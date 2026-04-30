import { api } from "../../app/api";
const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const buildUrl = (path, params) => {
    const url = new URL(path, baseUrl);
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined)
                return;
            url.searchParams.set(key, String(value));
        });
    }
    return url.toString();
};
export const pricesApi = api.injectEndpoints({
    endpoints: (builder) => ({
        getPrices: builder.query({
            async queryFn(arg, apiCtx) {
                try {
                    const state = apiCtx.getState();
                    const token = state.auth?.accessToken ?? null;
                    const params = arg ?? {};
                    const url = buildUrl("/api/prices", {
                        material: params.material,
                        region: params.region,
                        limit: params.limit
                    });
                    const requestInit = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
                    const response = await fetch(url, requestInit);
                    const json = (await response.json());
                    if (!response.ok) {
                        return { error: { status: response.status, data: json } };
                    }
                    const typed = json;
                    return { data: typed.data };
                }
                catch (error) {
                    return { error: { status: "FETCH_ERROR", data: String(error) } };
                }
            },
            providesTags: ["Price"]
        }),
        getPriceHistory: builder.query({
            query: (arg) => ({
                url: `/api/prices/${arg.material}/history`,
                params: {
                    region: arg.region ?? "national",
                    ...(arg.districtCode ? { districtCode: arg.districtCode } : {}),
                    days: arg.days ?? 90
                }
            }),
            providesTags: (_result, _error, arg) => [{ type: "Price", id: `${arg.material}:${arg.districtCode ?? arg.region ?? "default"}` }]
        }),
        refreshPrices: builder.mutation({
            query: () => ({
                url: "/api/admin/prices/refresh",
                method: "POST"
            }),
            invalidatesTags: ["Price"]
        }),
        getAllMaterialPrices: builder.query({
            async queryFn(arg, apiCtx) {
                const result = await (async () => {
                    const queryArg = arg?.region ? { region: arg.region } : undefined;
                    const base = await pricesApi.endpoints.getPrices.initiate(queryArg, {
                        subscribe: false,
                        forceRefetch: true
                    })(apiCtx.dispatch, apiCtx.getState, undefined);
                    if ("data" in base)
                        return { data: base.data };
                    return { error: base.error };
                })();
                if (result.error)
                    return { error: result.error };
                const rows = result.data ?? [];
                const byMaterial = {};
                rows.forEach((p) => {
                    const bucket = byMaterial[p.material] ?? [];
                    bucket.push(p);
                    byMaterial[p.material] = bucket;
                });
                return { data: byMaterial };
            },
            providesTags: ["Price"]
        })
    })
});
export const { useGetPricesQuery, useGetPriceHistoryQuery, useGetAllMaterialPricesQuery, useRefreshPricesMutation } = pricesApi;
