import { api } from "../../app/api";

export type BenchmarkResult = {
  projectType: string;
  region: string;
  lengthKm: number;
  estimatedCostINR: number;
  costPerKmINR: number;
  breakdown: {
    rawMaterials: number;
    labourAndEquipment: number;
    contractorProfit: number;
    contingency: number;
    gst: number;
  };
  materialBreakdown: Array<{
    material: string;
    quantity: number;
    unit: string;
    rateINR: number;
    totalINR: number;
    source: "db" | "national_fallback" | "cpwd_fallback";
  }>;
  confidence: number;
  comparableProjects: Array<{
    name: string;
    costINR: number;
    costPerKmINR: number | null;
    year: number;
    source: "worldbank";
  }>;
};

type GetBenchmarkResponse = { success: true; data: BenchmarkResult };

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const buildUrl = (path: string, params: Record<string, string | number | undefined>): string => {
  const url = new URL(path, baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
};

export const benchmarksApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBenchmark: builder.query<BenchmarkResult, { type: string; region: string; lengthKm: number; year?: number }>({
      async queryFn(arg, apiCtx) {
        try {
          const state = apiCtx.getState() as { auth?: { accessToken?: string | null } };
          const token = state.auth?.accessToken ?? null;
          const url = buildUrl("/api/benchmarks", {
            type: arg.type,
            region: arg.region,
            lengthKm: arg.lengthKm,
            year: arg.year
          });
          const requestInit: RequestInit = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
          const response = await fetch(url, requestInit);
          const json = (await response.json()) as unknown;
          if (!response.ok) {
            return { error: { status: response.status, data: json } as unknown as never };
          }
          return { data: (json as GetBenchmarkResponse).data };
        } catch (error) {
          return { error: { status: "FETCH_ERROR", data: String(error) } as unknown as never };
        }
      },
      providesTags: ["Benchmark"]
    })
  })
});

export const { useGetBenchmarkQuery, useLazyGetBenchmarkQuery } = benchmarksApi;

