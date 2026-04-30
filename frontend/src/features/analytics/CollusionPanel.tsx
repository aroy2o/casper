import { useState } from "react";
import { useAppSelector } from "../../app/hooks";
import { useGetCollusionFlagsQuery, useGetVendorRegistryQuery } from "./analyticsApi";
import type { CollusionFlag, VendorRisk } from "./analyticsApi";

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
};

const TYPE_LABELS: Record<string, string> = {
  cross_state_repeat_winner: "Cross-State Repeat Winner",
  bid_cluster: "Bid Cluster",
  threshold_bid: "Threshold Bidding",
  price_spike: "Price Spike",
  cross_state_vendor_risk: "Cross-State Vendor Risk",
  single_bidder: "Single Bidder / Nomination",
  sequential_wins: "Sequential Wins"
};

const RiskScorePill = ({ score }: { score: number }): JSX.Element => {
  const cls = score >= 80 ? "bg-red-500" : score >= 60 ? "bg-orange-500" : score >= 40 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={`h-1.5 rounded-full ${cls}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold">{score}</span>
    </div>
  );
};

const FlagCard = ({ flag }: { flag: CollusionFlag }): JSX.Element => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div className="mb-2 flex items-start justify-between gap-2">
      <div className="flex flex-wrap gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLES[flag.severity]}`}>
          {flag.severity.toUpperCase()}
        </span>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          {TYPE_LABELS[flag.type] ?? flag.type}
        </span>
      </div>
      <RiskScorePill score={Math.round(flag.riskScore)} />
    </div>
    <p className="text-sm text-slate-700 dark:text-slate-200">{flag.description}</p>
    {flag.vendorsInvolved.length > 0 && (
      <div className="mt-2 flex flex-wrap gap-1">
        {flag.vendorsInvolved.map((v) => (
          <span key={v} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {v}
          </span>
        ))}
      </div>
    )}
    {flag.statesInvolved.length > 0 && (
      <div className="mt-1 flex flex-wrap gap-1">
        {flag.statesInvolved.map((s) => (
          <span key={s} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
            {s}
          </span>
        ))}
      </div>
    )}
    <p className="mt-2 text-[10px] text-slate-400">{new Date(flag.computedAt).toLocaleDateString("en-IN")}</p>
  </div>
);

const VendorRow = ({ vendor }: { vendor: VendorRisk }): JSX.Element => (
  <tr className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
    <td className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        {vendor.crossStateCartel && (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">CARTEL</span>
        )}
        <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate max-w-[200px]">{vendor.vendorName}</span>
      </div>
    </td>
    <td className="px-3 py-2.5">
      <RiskScorePill score={vendor.nationalRiskScore} />
    </td>
    <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400">{vendor.totalTenders}</td>
    <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400">{vendor.totalFlagged}</td>
    <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400">{vendor.statePresence.length} states</td>
    <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400">{vendor.collusionFlags}</td>
  </tr>
);

export const CollusionPanel = (): JSX.Element => {
  const { selectedStateCode } = useAppSelector((s) => s.analytics);
  const [tab, setTab] = useState<"flags" | "registry">("flags");
  const [severity, setSeverity] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const flagParams = {
    page,
    limit: 12,
    ...(selectedStateCode ? { state: selectedStateCode } : {}),
    ...(severity ? { severity } : {})
  };
  const { data: flagsData, isLoading: flagsLoading } = useGetCollusionFlagsQuery(flagParams);

  const registryParams = {
    page,
    limit: 20,
    ...(search ? { search } : {}),
    ...(selectedStateCode ? { state: selectedStateCode } : {})
  };
  const { data: registryData, isLoading: registryLoading } = useGetVendorRegistryQuery(registryParams);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit dark:border-slate-800 dark:bg-slate-900">
        {([["flags", "Suspicious Activity"], ["registry", "Vendor Risk Registry"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => { setTab(key); setPage(1); }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-white text-casper-blue shadow-sm dark:bg-slate-800 dark:text-casper-blue"
                : "text-slate-600 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Flags tab */}
      {tab === "flags" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-500">Filter severity:</span>
            {["", "low", "medium", "high", "critical"].map((s) => (
              <button
                key={s || "all"}
                type="button"
                onClick={() => { setSeverity(s); setPage(1); }}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  severity === s
                    ? "bg-casper-blue text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                }`}
              >
                {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            {flagsData && (
              <span className="ml-auto text-xs text-slate-400">{flagsData.total} flags found</span>
            )}
          </div>

          {flagsLoading && (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" />
            </div>
          )}

          {!flagsLoading && (flagsData?.flags ?? []).length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-500">No collusion flags detected yet. Run vendor risk computation from the admin panel.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(flagsData?.flags ?? []).map((flag) => <FlagCard key={flag._id} flag={flag} />)}
          </div>

          {flagsData && flagsData.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700">← Prev</button>
              <span className="text-sm text-slate-500">Page {page} / {flagsData.pages}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(flagsData.pages, p + 1))} disabled={page === flagsData.pages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700">Next →</button>
            </div>
          )}
        </>
      )}

      {/* Registry tab */}
      {tab === "registry" && (
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search vendor..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-casper-blue dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <svg viewBox="0 0 24 24" className="absolute left-2.5 top-2.5 h-4 w-4 fill-none stroke-slate-400 stroke-2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            {registryData && <span className="text-xs text-slate-400">{registryData.total} vendors</span>}
          </div>

          {registryLoading && (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" />
            </div>
          )}

          {!registryLoading && (registryData?.vendors ?? []).length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-500">No vendors in registry yet. Run the vendor risk computation first.</p>
            </div>
          )}

          {!registryLoading && (registryData?.vendors ?? []).length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                  <tr>
                    {["Vendor", "Risk Score", "Tenders", "Flagged", "States", "Collusion Flags"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-950">
                  {(registryData?.vendors ?? []).map((v) => <VendorRow key={v._id} vendor={v} />)}
                </tbody>
              </table>
            </div>
          )}

          {registryData && registryData.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700">← Prev</button>
              <span className="text-sm text-slate-500">Page {page} / {registryData.pages}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(registryData.pages, p + 1))} disabled={page === registryData.pages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
