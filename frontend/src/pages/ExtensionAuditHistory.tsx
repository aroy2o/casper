import { useState } from "react";
import { useGetExtensionAuditsQuery } from "../features/extension/extensionApi";

const RISK_BADGE: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
};

const RISK_DOT: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-orange-500",
  critical: "bg-red-500"
};

const formatINR = (n: number): string => {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

type RiskFilter = "all" | "low" | "medium" | "high" | "critical";

export function ExtensionAuditHistory(): JSX.Element {
  const [page, setPage] = useState(1);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useGetExtensionAuditsQuery({
    page,
    limit: 15,
    ...(riskFilter === "all" ? {} : { riskLevel: riskFilter })
  });

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Extension Audit History</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tenders analysed directly from your browser via the CASPER extension.
          </p>
        </div>
        {data && (
          <span className="text-sm text-slate-500">
            {data.total} audit{data.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        {(["all", "critical", "high", "medium", "low"] as RiskFilter[]).map((level) => (
          <button
            key={level}
            onClick={() => { setRiskFilter(level); setPage(1); }}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
              riskFilter === level
                ? "bg-casper-blue text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            {level === "all" ? "All" : level}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" />
          Loading audits…
        </div>
      )}

      {/* Empty */}
      {!isLoading && data?.audits.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
          <svg viewBox="0 0 24 24" className="h-10 w-10 stroke-slate-300 fill-none stroke-1.5 dark:stroke-slate-700">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-300">No extension audits yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Install the CASPER browser extension, open any tender page, and click <strong>Audit Tender</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Audit list */}
      {!isLoading && (data?.audits ?? []).length > 0 && (
        <div className="space-y-3">
          {(data?.audits ?? []).map((audit) => {
            const isOpen = expandedId === audit._id;
            return (
              <div
                key={audit._id}
                className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
              >
                {/* Row header — click to expand */}
                <button
                  type="button"
                  onClick={() => toggle(audit._id)}
                  className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    {/* Risk badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${RISK_BADGE[audit.riskLevel] ?? ""}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${RISK_DOT[audit.riskLevel] ?? ""}`} />
                      {audit.riskLevel}
                    </span>

                    {/* Title + URL */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {audit.pageTitle || audit.tenderNumber || "Untitled Page"}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {audit.sourceURL}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-right flex-shrink-0">
                      {audit.overallInflationPct > 0 && (
                        <div>
                          <p className="text-sm font-bold text-red-500">+{audit.overallInflationPct}%</p>
                          <p className="text-[10px] text-slate-500">inflation</p>
                        </div>
                      )}
                      {audit.flags?.length > 0 && (
                        <div>
                          <p className="text-sm font-bold text-orange-500">{audit.flags.length}</p>
                          <p className="text-[10px] text-slate-500">flags</p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-xs text-slate-500">{formatDate(audit.createdAt)}</p>
                        {audit.tenderNumber && (
                          <p className="text-[10px] text-slate-400 font-mono">{audit.tenderNumber}</p>
                        )}
                      </div>
                      <svg
                        viewBox="0 0 24 24"
                        className={`h-4 w-4 stroke-current fill-none stroke-2 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-4 space-y-4">
                    {/* Meta row */}
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                      {audit.department && (
                        <span><span className="font-semibold text-slate-700 dark:text-slate-300">Dept:</span> {audit.department}</span>
                      )}
                      {audit.claudeVerdict && (
                        <span><span className="font-semibold text-slate-700 dark:text-slate-300">ML Verdict:</span> {audit.claudeVerdict}</span>
                      )}
                      {audit.totalOverpricedINR > 0 && (
                        <span><span className="font-semibold text-slate-700 dark:text-slate-300">Overpriced:</span> {formatINR(audit.totalOverpricedINR)}</span>
                      )}
                    </div>

                    {/* Summary */}
                    {audit.summary && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Summary</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{audit.summary}</p>
                      </div>
                    )}

                    {/* Risk signals */}
                    {audit.riskSignals?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Risk Signals</p>
                        <ul className="space-y-1">
                          {audit.riskSignals.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                              <span className="text-orange-500 flex-shrink-0">⚠</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Flagged items */}
                    {audit.flags?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                          Flagged Line Items ({audit.flags.length})
                        </p>
                        <div className="space-y-2">
                          {audit.flags.map((f, i) => (
                            <div
                              key={i}
                              className="rounded-xl border border-red-100 bg-red-50 p-3 dark:border-red-900/30 dark:bg-red-900/10"
                            >
                              <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-1">
                                {f.lineItemDescription}
                              </p>
                              <div className="flex flex-wrap gap-3 text-xs">
                                <span>
                                  Quoted: <strong className="text-red-600">{formatINR(f.quotedRateINR)}</strong>
                                </span>
                                <span>
                                  Market: <strong className="text-emerald-600">{formatINR(f.marketRateINR)}</strong>
                                </span>
                                <span className="text-red-500 font-semibold">+{Math.round(f.inflationPct)}%</span>
                                <span className="text-slate-400">
                                  Confidence: {Math.round(f.confidence * 100)}%
                                </span>
                              </div>
                              {f.explanation && (
                                <p className="mt-1 text-xs text-slate-500">{f.explanation}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendation */}
                    {audit.recommendation && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/30 dark:bg-emerald-900/10">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-1">Recommendation</p>
                        <p className="text-sm text-emerald-800 dark:text-emerald-300">{audit.recommendation}</p>
                      </div>
                    )}

                    {/* Source link */}
                    <div className="flex justify-end">
                      <a
                        href={audit.sourceURL}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-casper-blue hover:underline"
                      >
                        Open original page ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {data.pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
            disabled={page === data.pages || isFetching}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
