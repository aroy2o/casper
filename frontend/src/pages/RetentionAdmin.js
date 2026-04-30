import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "../app/api";
import { useAppSelector } from "../app/hooks";
import { formatCrore, formatDate } from "../utils/format";
const retentionApi = api.injectEndpoints({
    endpoints: (builder) => ({
        getRetentionPolicy: builder.query({
            query: () => "/api/retention/policy",
            providesTags: ["Tender"]
        }),
        updateRetentionPolicy: builder.mutation({
            query: (body) => ({ url: "/api/retention/policy", method: "PUT", body }),
            invalidatesTags: ["Tender"]
        }),
        runArchival: builder.mutation({
            query: () => ({ url: "/api/retention/run", method: "POST" }),
            invalidatesTags: ["Tender"]
        }),
        getArchivedTenders: builder.query({
            query: ({ page = 1 }) => `/api/retention/archived?page=${page}&limit=20`,
            providesTags: ["Tender"]
        }),
        restoreTender: builder.mutation({
            query: (tenderId) => ({ url: `/api/retention/restore/${tenderId}`, method: "POST" }),
            invalidatesTags: ["Tender"]
        })
    })
});
const { useGetRetentionPolicyQuery, useUpdateRetentionPolicyMutation, useRunArchivalMutation, useGetArchivedTendersQuery, useRestoreTenderMutation } = retentionApi;
export const RetentionAdmin = () => {
    const user = useAppSelector((state) => state.auth.user);
    const isAdmin = user?.role === "admin";
    const [page, setPage] = useState(1);
    const [archiveDays, setArchiveDays] = useState("");
    const [editMode, setEditMode] = useState(false);
    const [runResult, setRunResult] = useState(null);
    const { data: policyData, isLoading: policyLoading } = useGetRetentionPolicyQuery();
    const { data: archived, isLoading: archivedLoading } = useGetArchivedTendersQuery({ page });
    const [updatePolicy, { isLoading: saving }] = useUpdateRetentionPolicyMutation();
    const [runArchival, { isLoading: running }] = useRunArchivalMutation();
    const [restoreTender] = useRestoreTenderMutation();
    const policy = policyData?.policy;
    const stats = policyData?.stats;
    const handleSavePolicy = async () => {
        if (!archiveDays || archiveDays < 30)
            return;
        await updatePolicy({ archiveAfterDays: Number(archiveDays) });
        setEditMode(false);
    };
    const handleRunArchival = async () => {
        const result = await runArchival().unwrap().catch(() => null);
        if (result)
            setRunResult({ archived: result.archived, deleted: result.deleted });
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-base font-semibold", children: "Retention Policy" }), isAdmin && !editMode && (_jsx("button", { type: "button", onClick: () => { setArchiveDays(policy?.archiveAfterDays ?? 1095); setEditMode(true); }, className: "rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700", children: "Edit" }))] }), policyLoading ? _jsx("div", { className: "skeleton mt-3 h-24" }) : policy ? (_jsxs("div", { className: "mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500", children: "Archive after" }), _jsxs("p", { className: "font-semibold", children: [policy.archiveAfterDays, " days (", Math.round(policy.archiveAfterDays / 365 * 10) / 10, " yr)"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500", children: "Delete after archive" }), _jsx("p", { className: "font-semibold", children: policy.deleteAfterDays ? `${policy.deleteAfterDays} days` : "Never" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500", children: "Auto-archive" }), _jsx("span", { className: `inline-block rounded-full px-2 py-0.5 text-xs font-medium ${policy.autoArchiveEnabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`, children: policy.autoArchiveEnabled ? "Enabled" : "Disabled" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500", children: "Last run" }), _jsx("p", { className: "font-semibold", children: policy.lastRunAt ? formatDate(policy.lastRunAt) : "Never" }), policy.lastRunStats && (_jsxs("p", { className: "text-xs text-slate-400", children: ["Archived ", policy.lastRunStats.archived, ", deleted ", policy.lastRunStats.deleted] }))] })] })) : null, editMode && (_jsx("div", { className: "mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700", children: _jsxs("div", { className: "flex items-end gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-xs text-slate-500", children: "Archive tenders older than (days)" }), _jsx("input", { type: "number", min: 30, value: archiveDays, onChange: (e) => setArchiveDays(e.target.value ? Number(e.target.value) : ""), className: "rounded border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" }), _jsx("p", { className: "mt-0.5 text-xs text-slate-400", children: "Minimum 30 days. 1095 = 3 years (recommended)." })] }), _jsx("button", { type: "button", onClick: handleSavePolicy, disabled: saving || !archiveDays || archiveDays < 30, className: "rounded bg-casper-blue px-4 py-1.5 text-sm text-white disabled:opacity-50", children: saving ? "Saving…" : "Save" }), _jsx("button", { type: "button", onClick: () => setEditMode(false), className: "rounded border border-slate-300 px-4 py-1.5 text-sm dark:border-slate-700", children: "Cancel" })] }) }))] }), _jsxs("section", { className: "grid grid-cols-1 gap-4 md:grid-cols-3", children: [_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("p", { className: "text-xs text-slate-500", children: "Active tenders" }), _jsx("p", { className: "mt-1 text-2xl font-bold", children: stats?.activeCount ?? "—" })] }), _jsxs("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("p", { className: "text-xs text-slate-500", children: "Archived tenders" }), _jsx("p", { className: "mt-1 text-2xl font-bold text-slate-400", children: stats?.archivedCount ?? "—" })] }), isAdmin && (_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("p", { className: "text-xs text-slate-500", children: "Manual archival run" }), _jsx("button", { type: "button", onClick: handleRunArchival, disabled: running, className: "mt-2 rounded bg-amber-500 px-4 py-1.5 text-sm text-white hover:bg-amber-600 disabled:opacity-50", children: running ? "Running…" : "Run now" }), runResult && (_jsxs("p", { className: "mt-1 text-xs text-green-600", children: ["Done: ", runResult.archived, " archived, ", runResult.deleted, " deleted."] }))] }))] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h2", { className: "mb-3 text-base font-semibold", children: "Archived Tenders" }), archivedLoading ? (_jsx("div", { className: "skeleton h-32" })) : (archived?.tenders.length ?? 0) === 0 ? (_jsx("p", { className: "text-sm text-slate-400", children: "No archived tenders yet." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs text-slate-500", children: [_jsx("th", { className: "pb-2", children: "Tender #" }), _jsx("th", { className: "pb-2", children: "Title" }), _jsx("th", { className: "pb-2", children: "State" }), _jsx("th", { className: "pb-2", children: "Cost" }), _jsx("th", { className: "pb-2", children: "Archived" }), _jsx("th", { className: "pb-2", children: "Reason" }), isAdmin && _jsx("th", { className: "pb-2", children: "Actions" })] }) }), _jsx("tbody", { children: archived?.tenders.map((t) => (_jsxs("tr", { className: "border-t border-slate-200 dark:border-slate-700", children: [_jsx("td", { className: "py-2 font-mono text-xs", children: t.tenderNumber }), _jsx("td", { className: "max-w-[250px] truncate py-2", title: t.title, children: t.title }), _jsx("td", { className: "py-2 capitalize", children: t.state }), _jsx("td", { className: "py-2", children: t.totalEstimatedCostINR > 0 ? formatCrore(t.totalEstimatedCostINR) : "—" }), _jsx("td", { className: "py-2", children: t.archivedAt ? formatDate(t.archivedAt) : "—" }), _jsx("td", { className: "max-w-[200px] truncate py-2 text-xs text-slate-400", title: t.archivedReason ?? "", children: t.archivedReason ?? "—" }), isAdmin && (_jsx("td", { className: "py-2", children: _jsx("button", { type: "button", onClick: () => void restoreTender(t._id), className: "rounded bg-casper-blue px-2 py-1 text-xs text-white hover:bg-blue-600", children: "Restore" }) }))] }, t._id))) })] }) })), (archived?.pages ?? 0) > 1 && (_jsxs("div", { className: "mt-3 flex items-center justify-center gap-2", children: [_jsx("button", { type: "button", disabled: page === 1, onClick: () => setPage((p) => p - 1), className: "rounded border px-3 py-1 text-sm disabled:opacity-50", children: "Prev" }), _jsxs("span", { className: "text-sm", children: ["Page ", page, " / ", archived?.pages] }), _jsx("button", { type: "button", disabled: page >= (archived?.pages ?? 1), onClick: () => setPage((p) => p + 1), className: "rounded border px-3 py-1 text-sm disabled:opacity-50", children: "Next" })] }))] }), _jsx("p", { className: "text-xs text-slate-400", children: "Data retention policy complies with Indian IT Act, 2000 (Section 67C) which mandates a minimum 3-year retention for electronic records in public procurement." })] }));
};
