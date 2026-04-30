import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useGetReportHistoryQuery } from "../features/audits/auditsApi";
import { useAppSelector } from "../app/hooks";
import { showToast } from "../utils/toast";
const formatDate = (iso) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const typeLabel = {
    tender: "Tender Audit",
    vendor: "Vendor Due Diligence",
    item: "Item Price",
    regional: "Regional Compliance"
};
const typeBadge = {
    tender: "bg-blue-100 text-blue-700",
    vendor: "bg-purple-100 text-purple-700",
    item: "bg-emerald-100 text-emerald-700",
    regional: "bg-orange-100 text-orange-700"
};
export function ReportHistory() {
    const [page, setPage] = useState(1);
    const accessToken = useAppSelector((state) => state.auth.accessToken);
    const { data, isLoading, isFetching } = useGetReportHistoryQuery({ page, limit: 20 });
    const handleDownload = async (downloadURL, reportType, referenceName, format) => {
        if (!accessToken)
            return;
        try {
            const res = await fetch(downloadURL, { headers: { Authorization: `Bearer ${accessToken}` } });
            if (!res.ok)
                throw new Error("Download failed");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `CASPER_${reportType}_${referenceName}.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        }
        catch {
            showToast("error", "Failed to download report. The file may have expired.");
        }
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Report History" }), _jsx("p", { className: "text-sm text-slate-500 mt-1", children: "All compliance and audit reports you have generated." })] }), data && (_jsxs("span", { className: "text-sm text-slate-500", children: [data.total, " report", data.total !== 1 ? "s" : ""] }))] }), isLoading && (_jsxs("div", { className: "flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("span", { className: "h-4 w-4 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" }), "Loading report history\u2026"] })), !isLoading && data?.reports.length === 0 && (_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-800 dark:bg-slate-900", children: [_jsx("p", { className: "text-slate-400 text-sm", children: "No reports generated yet." }), _jsx("p", { className: "text-slate-400 text-xs mt-1", children: "Go to any tender and click \"Export Audit Report\" to generate your first report." })] })), data && data.reports.length > 0 && (_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200 dark:border-slate-800", children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Report" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Reference" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Format" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Generated" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Download" })] }) }), _jsx("tbody", { children: data.reports.map((report) => (_jsxs("tr", { className: "border-b border-slate-100 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-800/30", children: [_jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `rounded px-2 py-1 text-xs font-medium ${typeBadge[report.reportType] ?? "bg-slate-100 text-slate-600"}`, children: typeLabel[report.reportType] ?? report.reportType }) }), _jsx("td", { className: "px-4 py-3 text-slate-700 dark:text-slate-300 font-mono text-xs max-w-[200px] truncate", title: report.referenceName, children: report.referenceName }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `rounded px-2 py-0.5 text-xs font-semibold uppercase ${report.format === "pdf" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`, children: report.format }) }), _jsx("td", { className: "px-4 py-3 text-slate-500 text-xs whitespace-nowrap", children: formatDate(report.createdAt) }), _jsx("td", { className: "px-4 py-3", children: report.downloadURL ? (_jsxs("button", { type: "button", onClick: () => void handleDownload(report.downloadURL, report.reportType, report.referenceName, report.format), className: "inline-flex items-center gap-1.5 rounded bg-casper-blue px-3 py-1 text-xs font-medium text-white hover:bg-blue-700", children: [_jsx("svg", { className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" }) }), "Download"] })) : (_jsx("span", { className: "text-xs text-slate-400", children: "Unavailable" })) })] }, report._id))) })] }) }), data.pages > 1 && (_jsxs("div", { className: "flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-4 py-3", children: [_jsx("button", { type: "button", onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1 || isFetching, className: "rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400", children: "\u2190 Previous" }), _jsxs("span", { className: "text-xs text-slate-500", children: ["Page ", page, " of ", data.pages] }), _jsx("button", { type: "button", onClick: () => setPage((p) => Math.min(data.pages, p + 1)), disabled: page === data.pages || isFetching, className: "rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400", children: "Next \u2192" })] }))] }))] }));
}
