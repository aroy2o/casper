import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { RootState } from "./store";
import { clearCredentials, setAccessToken } from "../features/auth/authSlice";
import { showToast } from "../utils/toast";

type ApiEnvelope = {
  success: boolean;
  data?: unknown;
  error?: {
    code?: string;
    message?: string;
  };
};

const isApiEnvelope = (value: unknown): value is ApiEnvelope => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return "success" in value;
};

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  }
});

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if ("error" in result && result.error?.status === 401) {
    const state = api.getState() as RootState;
    const refreshToken = state.auth.refreshToken;

    if (!refreshToken) {
      api.dispatch(clearCredentials());
      return result;
    }

    const refreshResult = await rawBaseQuery(
      {
        url: "/api/auth/refresh",
        method: "POST",
        body: { refreshToken }
      },
      api,
      extraOptions
    );

    if ("data" in refreshResult && refreshResult.data && isApiEnvelope(refreshResult.data)) {
      const envelope = refreshResult.data;
      const nextToken = envelope.success
        ? (envelope.data as { accessToken?: string } | undefined)?.accessToken
        : undefined;
      if (nextToken) {
        api.dispatch(setAccessToken(nextToken));
        result = await rawBaseQuery(args, api, extraOptions);
      } else {
        api.dispatch(clearCredentials());
      }
    } else {
      api.dispatch(clearCredentials());
    }
  }

  return result;
};

const baseQueryWithToast: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const result = await baseQueryWithReauth(args, api, extraOptions);

  if ("data" in result && result.data && isApiEnvelope(result.data)) {
    if (!result.data.success) {
      showToast("error", result.data.error?.message ?? "Request failed");
      return {
        error: {
          status: 400,
          data: result.data
        }
      };
    }

    return {
      data: result.data.data
    };
  }

  if ("error" in result && result.error) {
    const error = result.error;
    // 401 is handled by the reauth layer (clearCredentials) — no toast needed
    if (error.status === 401) return result;
    const message =
      "data" in error &&
      typeof error.data === "object" &&
      error.data !== null &&
      "error" in (error.data as Record<string, unknown>)
        ? String(
            ((error.data as Record<string, unknown>).error as Record<string, unknown> | undefined)?.message ??
              "Request failed"
          )
        : "Request failed";
    showToast("error", message);
  }
  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithToast,
  tagTypes: ["Price", "Tender", "Audit", "Alert", "Benchmark", "User", "Estimate"],
  endpoints: () => ({})
});
