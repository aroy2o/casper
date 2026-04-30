import { useState } from "react";
import { Link } from "react-router-dom";
import { EstimateForm } from "../features/estimate/EstimateForm";
import { EstimateResult } from "../features/estimate/EstimateResult";
import {
  Estimate,
  GenerateEstimatePayload,
  useGenerateEstimateMutation,
  useListEstimatesQuery
} from "../features/estimate/estimateApi";
import { formatDate, formatCrore } from "../utils/format";
import { TransText } from "../components/TransText";

type Tab = "new" | "history";

function HistoryItem({ est, onSelect }: { est: Estimate; onSelect: (e: Estimate) => void }) {
  const flagClass = est.confidence_level === "High"
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : est.confidence_level === "Medium"
    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";

  return (
    <button
      onClick={() => onSelect(est)}
      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900 dark:text-white">{est.project_name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{est.project_type} · {est.district}, {est.state}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-base font-bold text-slate-900 dark:text-white">{formatCrore(est.total_cost_cr * 1e7)}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${flagClass}`}>{est.confidence_level}</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">{formatDate(est.created_at)} · FY {est.financial_year}</p>
    </button>
  );
}

export function FairCostEstimator(): JSX.Element {
  const [tab, setTab] = useState<Tab>("new");
  const [result, setResult] = useState<Estimate | null>(null);
  const [selectedFromHistory, setSelectedFromHistory] = useState<Estimate | null>(null);

  const [generate, { isLoading }] = useGenerateEstimateMutation();
  const { data: historyData, isLoading: historyLoading } = useListEstimatesQuery({ limit: 20 });

  const handleGenerate = async (payload: GenerateEstimatePayload) => {
    try {
      const est = await generate(payload).unwrap();
      setResult(est);
    } catch {
      // error handled by RTK Query toast
    }
  };

  const displayEstimate = selectedFromHistory ?? result;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white"><TransText text="Fair Cost Estimator" /></h2>
          <p className="mt-1 text-sm text-slate-500">
            <TransText text="AI-powered itemized cost estimates using CPWD DSR 2023 / MORTH SOR benchmarks" />
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
          {(["new", "history"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelectedFromHistory(null); }}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              {t === "new" ? <TransText text="New Estimate" /> : <TransText text="History" />}
            </button>
          ))}
        </div>
      </div>

      {tab === "new" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          {/* Form */}
          <div className="xl:col-span-2">
            <div className="sticky top-4 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  <TransText text="Project Parameters" />
                </h3>
                <EstimateForm onSubmit={handleGenerate} isLoading={isLoading} />
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="xl:col-span-3">
            {isLoading ? (
              <div className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                <svg className="h-10 w-10 animate-spin text-casper-blue" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <div className="text-center">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Generating Estimate…</p>
                  <p className="mt-1 text-sm text-slate-500">Querying SOR databases and AI engine (3–15s)</p>
                </div>
              </div>
            ) : displayEstimate ? (
              <EstimateResult estimate={displayEstimate} />
            ) : (
              <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                <svg viewBox="0 0 24 24" className="h-12 w-12 fill-none stroke-slate-300 stroke-1.5 dark:stroke-slate-700">
                  <path d="M9 7H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-2M9 7a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" />
                </svg>
                <p className="text-sm text-slate-500">Fill in the form and click Generate to see your estimate</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          {/* History list */}
          <div className="xl:col-span-2">
            <div className="space-y-3">
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <svg className="h-6 w-6 animate-spin text-casper-blue" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                </div>
              ) : (historyData?.estimates ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No estimates yet. Create one in the New Estimate tab.</p>
              ) : (
                (historyData?.estimates as unknown as Estimate[] ?? []).map((est) => (
                  <HistoryItem
                    key={est._id}
                    est={est}
                    onSelect={(e) => setSelectedFromHistory(e)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Selected estimate result */}
          <div className="xl:col-span-3">
            {selectedFromHistory ? (
              <EstimateResult estimate={selectedFromHistory} />
            ) : (
              <div className="flex min-h-80 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-sm text-slate-500">Select an estimate from the list to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
