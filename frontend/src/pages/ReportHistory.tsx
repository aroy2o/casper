import { useState } from "react";
import { useGetReportHistoryQuery } from "../features/audits/auditsApi";
import { useAppSelector } from "../app/hooks";
import { showToast } from "../utils/toast";

const formatDate = (iso: string): string => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const typeLabel: Record<string, string> = {
  tender: "Tender Audit",
  vendor: "Vendor Due Diligence",
  item: "Item Price",
  regional: "Regional Compliance"
};

const typeBadge: Record<string, string> = {
  tender: "bg-blue-100 text-blue-700",
  vendor: "bg-purple-100 text-purple-700",
  item: "bg-emerald-100 text-emerald-700",
  regional: "bg-orange-100 text-orange-700"
};

export function ReportHistory(): JSX.Element {
  const [page, setPage] = useState(1);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const { data, isLoading, isFetching } = useGetReportHistoryQuery({ page, limit: 20 });

  const handleDownload = async (downloadURL: string, reportType: string, referenceName: string, format: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(downloadURL, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CASPER_${reportType}_${referenceName}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showToast("error", "Failed to download report. The file may have expired.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Report History</h1>
          <p className="text-sm text-slate-500 mt-1">All compliance and audit reports you have generated.</p>
        </div>
        {data && (
          <span className="text-sm text-slate-500">{data.total} report{data.total !== 1 ? "s" : ""}</span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" />
          Loading report history…
        </div>
      )}

      {!isLoading && data?.reports.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-400 text-sm">No reports generated yet.</p>
          <p className="text-slate-400 text-xs mt-1">Go to any tender and click "Export Audit Report" to generate your first report.</p>
        </div>
      )}

      {data && data.reports.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Report</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Format</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Generated</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Download</th>
                </tr>
              </thead>
              <tbody>
                {data.reports.map((report) => (
                  <tr key={report._id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-1 text-xs font-medium ${typeBadge[report.reportType] ?? "bg-slate-100 text-slate-600"}`}>
                        {typeLabel[report.reportType] ?? report.reportType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono text-xs max-w-[200px] truncate" title={report.referenceName}>
                      {report.referenceName}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${report.format === "pdf" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
                        {report.format}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {formatDate(report.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {report.downloadURL ? (
                        <button
                          type="button"
                          onClick={() => void handleDownload(report.downloadURL!, report.reportType, report.referenceName, report.format)}
                          className="inline-flex items-center gap-1.5 rounded bg-casper-blue px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Download
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Unavailable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-4 py-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isFetching}
                className="rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400"
              >
                ← Previous
              </button>
              <span className="text-xs text-slate-500">Page {page} of {data.pages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages || isFetching}
                className="rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
