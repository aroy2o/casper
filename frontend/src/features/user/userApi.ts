import { api } from "../../app/api";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "admin" | "analyst" | "viewer";
  organization: string;
  preferences: {
    alertThresholdPct: number;
    watchedRegions: string[];
    notifyEmail: boolean;
    notifyPush: boolean;
    pushSubscription: Record<string, unknown> | null;
  };
}

export interface TenderSyncInput {
  yearsBack: number;
  terms: string[];
  portals: Array<"eprocure" | "etenders" | "worldbank">;
  scope?: string;
  maxRecords?: number;
}

export interface TenderSyncResult {
  synced: boolean;
  found: number;
  inserted: number;
  alreadyExist: number;
  yearsBack: number;
  beforeCount: number;
  afterCount: number;
  scope?: string;
  maxRecords?: number;
  terms?: string[];
  portals?: Array<"eprocure" | "etenders" | "worldbank">;
}

export const userApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query<UserProfile, void>({
      query: () => "/api/user/profile",
      providesTags: ["User"]
    }),
    updatePreferences: builder.mutation<UserProfile["preferences"], UserProfile["preferences"]>({
      query: (body) => ({
        url: "/api/user/preferences",
        method: "PATCH",
        body
      }),
      invalidatesTags: ["User"]
    }),
    pushSubscribe: builder.mutation<{ subscribed: boolean }, Record<string, unknown>>({
      query: (body) => ({
        url: "/api/user/push-subscribe",
        method: "POST",
        body
      }),
      invalidatesTags: ["User"]
    }),
    syncTenders: builder.mutation<TenderSyncResult, TenderSyncInput>({
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
