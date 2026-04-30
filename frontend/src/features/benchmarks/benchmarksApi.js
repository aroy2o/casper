import { api } from "../../app/api";
const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const buildUrl = (path, params) => {
    const url = new URL(path, baseUrl);
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined)
            return;
        url.searchParams.set(key, String(value));
    });
    return url.toString();
};
export const benchmarksApi = api.injectEndpoints({
    endpoints: (builder) => ({
        getBenchmark: builder.query({
            async queryFn(arg, apiCtx) {
                try {
                    const state = apiCtx.getState();
                    const token = state.auth?.accessToken ?? null;
                    const url = buildUrl("/api/benchmarks", {
                        type: arg.type,
                        region: arg.region,
                        lengthKm: arg.lengthKm,
                        year: arg.year
                    });
                    const requestInit = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
                    const response = await fetch(url, requestInit);
                    const json = (await response.json());
                    if (!response.ok) {
                        return { error: { status: response.status, data: json } };
                    }
                    return { data: json.data };
                }
                catch (error) {
                    return { error: { status: "FETCH_ERROR", data: String(error) } };
                }
            },
            providesTags: ["Benchmark"]
        })
    })
});
export const { useGetBenchmarkQuery, useLazyGetBenchmarkQuery } = benchmarksApi;
