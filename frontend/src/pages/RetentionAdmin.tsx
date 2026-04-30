import { useState } from "react";
import { api } from "../app/api";
import { useAppSelector } from "../app/hooks";
import { formatCrore, formatDate } from "../utils/format";

interface RetentionPolicy {
  archiveAfterDays: number;
  deleteAfterDays: number | null;
  autoArchiveEnabled: boolean;
  autoDeleteEnabled: boolean;
  lastRunAt: string | null;
  lastRunStats: { archived: number; deleted: number; durationMs: number } | null;
}

interface ArchivedTender {
  _id: string;
  title: string;
  tenderNumber: string;
  state: string;
  department: string;
  publishedDate: string | null;
  archivedAt: string | null;
  archivedReason: string | null;
  totalEstimatedCostINR: number;
  status: string;
}

const retentionApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getRetentionPolicy: builder.query<{ policy: RetentionPolicy; stats: { archivedCount: number; activeCount: number } }, void>({
      query: () => "/api/retention/policy",
      providesTags: ["Tender"]
    }),
    updateRetentionPolicy: builder.mutation<{ policy: RetentionPolicy }, Partial<RetentionPolicy>>({
      query: (body) => ({ url: "/api/retention/policy", method: "PUT", body }),
      invalidatesTags: ["Tender"]
    }),
    runArchival: builder.mutation<{ archived: number; deleted: number; durationMs: number; cutoffDate: string }, void>({
      query: () => ({ url: "/api/retention/run", method: "POST" }),
      invalidatesTags: ["Tender"]
    }),
    getArchivedTenders: builder.query<{ tenders: ArchivedTender[]; total: number; page: number; pages: number }, { page?: number }>({
      query: ({ page = 1 }) => `/api/retention/archived?page=${page}&limit=20`,
      providesTags: ["Tender"]
    }),
    restoreTender: builder.mutation<{ restored: boolean }, string>({
      query: (tenderId) => ({ url: `/api/retention/restore/${tenderId}`, method: "POST" }),
      invalidatesTags: ["Tender"]
    })
  })
});

const { useGetRetentionPolicyQuery, useUpdateRetentionPolicyMutation, useRunArchivalMutation, useGetArchivedTendersQuery, useRestoreTenderMutation } = retentionApi;

export const RetentionAdmin = (): JSX.Element => {
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.role === "admin";
  const [page, setPage] = useState(1);
  const [archiveDays, setArchiveDays] = useState<number | "">("");
  const [editMode, setEditMode] = useState(false);
  const [runResult, setRunResult] = useState<{ archived: number; deleted: number } | null>(null);

  const { data: policyData, isLoading: policyLoading } = useGetRetentionPolicyQuery();
  const { data: archived, isLoading: archivedLoading } = useGetArchivedTendersQuery({ page });
  const [updatePolicy, { isLoading: saving }] = useUpdateRetentionPolicyMutation();
  const [runArchival, { isLoading: running }] = useRunArchivalMutation();
  const [restoreTender] = useRestoreTenderMutation();

  const policy = policyData?.policy;
  const stats = policyData?.stats;

  const handleSavePolicy = async () => {
    if (!archiveDays || archiveDays < 30) return;
    await updatePolicy({ archiveAfterDays: Number(archiveDays) });
    setEditMode(false);
  };

  const handleRunArchival = async () => {
    const result = await runArchival().unwrap().catch(() => null);
    if (result) setRunResult({ archived: result.archived, deleted: result.deleted });
  };

  return (
    <div className="space-y-6">
      {/* Policy card */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Retention Policy</h2>
          {isAdmin && !editMode && (
            <button type="button" onClick={() => { setArchiveDays(policy?.archiveAfterDays ?? 1095); setEditMode(true); }} className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700">
              Edit
            </button>
          )}
        </div>

        {policyLoading ? <div className="skeleton mt-3 h-24" /> : policy ? (
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Archive after</p>
              <p className="font-semibold">{policy.archiveAfterDays} days ({Math.round(policy.archiveAfterDays / 365 * 10) / 10} yr)</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Delete after archive</p>
              <p className="font-semibold">{policy.deleteAfterDays ? `${policy.deleteAfterDays} days` : "Never"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Auto-archive</p>
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${policy.autoArchiveEnabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                {policy.autoArchiveEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500">Last run</p>
              <p className="font-semibold">{policy.lastRunAt ? formatDate(policy.lastRunAt) : "Never"}</p>
              {policy.lastRunStats && (
                <p className="text-xs text-slate-400">Archived {policy.lastRunStats.archived}, deleted {policy.lastRunStats.deleted}</p>
              )}
            </div>
          </div>
        ) : null}

        {editMode && (
          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <div className="flex items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Archive tenders older than (days)</label>
                <input
                  type="number"
                  min={30}
                  value={archiveDays}
                  onChange={(e) => setArchiveDays(e.target.value ? Number(e.target.value) : "")}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
                <p className="mt-0.5 text-xs text-slate-400">Minimum 30 days. 1095 = 3 years (recommended).</p>
              </div>
              <button type="button" onClick={handleSavePolicy} disabled={saving || !archiveDays || archiveDays < 30} className="rounded bg-casper-blue px-4 py-1.5 text-sm text-white disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setEditMode(false)} className="rounded border border-slate-300 px-4 py-1.5 text-sm dark:border-slate-700">
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Stats + run archival */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500">Active tenders</p>
          <p className="mt-1 text-2xl font-bold">{stats?.activeCount ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500">Archived tenders</p>
          <p className="mt-1 text-2xl font-bold text-slate-400">{stats?.archivedCount ?? "—"}</p>
        </div>
        {isAdmin && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500">Manual archival run</p>
            <button
              type="button"
              onClick={handleRunArchival}
              disabled={running}
              className="mt-2 rounded bg-amber-500 px-4 py-1.5 text-sm text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {running ? "Running…" : "Run now"}
            </button>
            {runResult && (
              <p className="mt-1 text-xs text-green-600">Done: {runResult.archived} archived, {runResult.deleted} deleted.</p>
            )}
          </div>
        )}
      </section>

      {/* Archived tenders list */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-base font-semibold">Archived Tenders</h2>
        {archivedLoading ? (
          <div className="skeleton h-32" />
        ) : (archived?.tenders.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-400">No archived tenders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2">Tender #</th>
                  <th className="pb-2">Title</th>
                  <th className="pb-2">State</th>
                  <th className="pb-2">Cost</th>
                  <th className="pb-2">Archived</th>
                  <th className="pb-2">Reason</th>
                  {isAdmin && <th className="pb-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {archived?.tenders.map((t) => (
                  <tr key={t._id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="py-2 font-mono text-xs">{t.tenderNumber}</td>
                    <td className="max-w-[250px] truncate py-2" title={t.title}>{t.title}</td>
                    <td className="py-2 capitalize">{t.state}</td>
                    <td className="py-2">{t.totalEstimatedCostINR > 0 ? formatCrore(t.totalEstimatedCostINR) : "—"}</td>
                    <td className="py-2">{t.archivedAt ? formatDate(t.archivedAt) : "—"}</td>
                    <td className="max-w-[200px] truncate py-2 text-xs text-slate-400" title={t.archivedReason ?? ""}>{t.archivedReason ?? "—"}</td>
                    {isAdmin && (
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => void restoreTender(t._id)}
                          className="rounded bg-casper-blue px-2 py-1 text-xs text-white hover:bg-blue-600"
                        >
                          Restore
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(archived?.pages ?? 0) > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Prev</button>
            <span className="text-sm">Page {page} / {archived?.pages}</span>
            <button type="button" disabled={page >= (archived?.pages ?? 1)} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Next</button>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-400">
        Data retention policy complies with Indian IT Act, 2000 (Section 67C) which mandates a minimum 3-year retention for electronic records in public procurement.
      </p>
    </div>
  );
};
