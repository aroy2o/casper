import { api } from "../../app/api";

export interface PriceRecord {
  _id: string;
  material: string;
  unit: string;
  priceINR: number;
  source: string;
  region: string;
  scrapedAt: string;
  isActive: boolean;
}

export interface PriceHistoryPoint {
  date: string;
  priceINR: number;
  source: string;
}

export interface GetPricesResponse {
  success: true;
  data: PriceRecord[];
  meta: { total: number };
}

export interface GetPriceHistoryResponse {
  success: true;
  data: {
    material: string;
    region: string;
    dataPoints: PriceHistoryPoint[];
  };
}

export interface RefreshPricesResult {
  updated: number;
  sources: string[];
  errors: string[];
}

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const buildUrl = (path: string, params?: Record<string, string | number | undefined>): string => {
  const url = new URL(path, baseUrl);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
};

export const pricesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getPrices: builder.query<PriceRecord[], { material?: string; region?: string; limit?: number } | void>({
      async queryFn(arg, apiCtx) {
        try {
          const state = apiCtx.getState() as { auth?: { accessToken?: string | null } };
          const token = state.auth?.accessToken ?? null;
          const params = arg ?? {};
          const url = buildUrl("/api/prices", {
            material: params.material,
            region: params.region,
            limit: params.limit
          });

          const requestInit: RequestInit = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
          const response = await fetch(url, requestInit);
          const json = (await response.json()) as unknown;
          if (!response.ok) {
            return { error: { status: response.status, data: json } as unknown as never };
          }
          const typed = json as GetPricesResponse;
          return { data: typed.data };
        } catch (error) {
          return { error: { status: "FETCH_ERROR", data: String(error) } as unknown as never };
        }
      },
      providesTags: ["Price"]
    }),
    getPriceHistory: builder.query<
      { material: string; region: string; dataPoints: PriceHistoryPoint[] },
      { material: string; region?: string; districtCode?: string; days?: number }
    >({
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
    refreshPrices: builder.mutation<RefreshPricesResult, void>({
      query: () => ({
        url: "/api/admin/prices/refresh",
        method: "POST"
      }),
      invalidatesTags: ["Price"]
    }),
    getAllMaterialPrices: builder.query<Record<string, PriceRecord[]>, { region?: string } | void>({
      async queryFn(arg, apiCtx) {
        const result = await (async (): Promise<{ data?: PriceRecord[]; error?: unknown }> => {
          const queryArg = arg?.region ? { region: arg.region } : undefined;
          const base = await pricesApi.endpoints.getPrices.initiate(queryArg, {
            subscribe: false,
            forceRefetch: true
          })(apiCtx.dispatch, apiCtx.getState, undefined);
          if ("data" in base) return { data: base.data as PriceRecord[] };
          return { error: base.error };
        })();
        if (result.error) return { error: result.error as never };
        const rows = result.data ?? [];
        const byMaterial: Record<string, PriceRecord[]> = {};
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
