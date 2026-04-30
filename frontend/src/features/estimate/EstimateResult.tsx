import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { Estimate, TenderCompareResult, useCompareWithTenderMutation } from "./estimateApi";
import { formatCrore } from "../../utils/format";
import { showToast } from "../../utils/toast";

const BREAKDOWN_COLORS = ["#1e3a5f", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#f59e0b", "#ef4444", "#6b7280"];

const BREAKDOWN_LABELS: Record<string, string> = {
  materials_cr: "Materials",
  labour_equipment_cr: "Labour & Equip.",
  earthwork_cr: "Earthwork",
  structures_cr: "Structures",
  finishing_cr: "Finishing",
  profit_cr: "Profit (10%)",
  contingency_cr: "Contingency (5%)",
  gst_cr: "GST (18%)"
};

// estimate values ending with _cr are in Crore units. Convert to INR before formatting.
function crToINR(cr: number) {
  return cr * 1e7;
}

function ConfidenceBadge({ level, pct }: { level: string; pct: number }) {
  const cls = level === "High"
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : level === "Medium"
    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {level} Confidence · {pct}%
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls = severity === "High"
    ? "text-red-600 dark:text-red-400"
    : severity === "Medium"
    ? "text-amber-600 dark:text-amber-400"
    : "text-green-600 dark:text-green-400";
  return <span className={`font-semibold ${cls}`}>{severity}</span>;
}

function FlagBadge({ flag }: { flag: string }) {
  const cls = flag === "GREEN"
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : flag === "AMBER"
    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  return <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-bold ${cls}`}>{flag}</span>;
}

interface TenderCompareProps {
  estimateId: string;
  fairTotal: number;
  existingComparison: TenderCompareResult | null;
}

function TenderCompare({ estimateId, fairTotal, existingComparison }: TenderCompareProps) {
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<TenderCompareResult | null>(existingComparison);
  const [compare, { isLoading }] = useCompareWithTenderMutation();

  const handleCompare = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      showToast("error", "Enter a valid tender amount in ₹ Crore");
      return;
    }
    try {
      const res = await compare({ id: estimateId, tender_quoted_cr: val }).unwrap();
      setResult(res);
    } catch {
      showToast("error", "Comparison failed");
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
        Compare with Tender Quote
      </h3>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter tender quoted amount in Crore"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm focus:border-casper-blue focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <button
          onClick={handleCompare}
          disabled={isLoading}
          className="rounded-lg bg-casper-blue px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isLoading ? "Analysing…" : "Analyse"}
        </button>
      </div>
      <p className="text-xs text-slate-500">Fair estimate: {formatCrore(crToINR(fairTotal))}</p>

      {result && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-slate-500">Tender Quote</p>
              <p className="text-xl font-bold">{formatCrore(crToINR(result.tender_quoted_cr))}</p>
            </div>
            <div className="text-2xl text-slate-400">vs</div>
            <div>
              <p className="text-xs text-slate-500">Fair Estimate</p>
              <p className="text-xl font-bold">{formatCrore(crToINR(fairTotal))}</p>
            </div>
            <div className="ml-auto">
              <p className="text-xs text-slate-500">Variance</p>
              <p className={`text-xl font-bold ${result.variance_pct > 0 ? "text-red-600" : "text-green-600"}`}>
                {result.variance_pct > 0 ? "+" : ""}{result.variance_pct.toFixed(1)}%
              </p>
            </div>
            <FlagBadge flag={result.flag} />
          </div>

          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {result.anomaly_analysis}
          </div>

          {result.cost_head_comparison.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="pb-2 text-left text-xs font-semibold uppercase text-slate-500">Cost Head</th>
                    <th className="pb-2 text-right text-xs font-semibold uppercase text-slate-500">Fair</th>
                    <th className="pb-2 text-right text-xs font-semibold uppercase text-slate-500">Tender</th>
                    <th className="pb-2 text-right text-xs font-semibold uppercase text-slate-500">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {result.cost_head_comparison.map((row) => (
                    <tr
                      key={row.head}
                      className={`border-b border-slate-100 dark:border-slate-800 ${row.suspicious ? "bg-red-50 dark:bg-red-900/10" : ""}`}
                    >
                      <td className="py-2 font-medium">
                        {row.suspicious && <span className="mr-1 text-red-500">⚠</span>}
                        {row.head}
                      </td>
                      <td className="py-2 text-right">{formatCrore(crToINR(row.fair_cr))}</td>
                      <td className="py-2 text-right">{formatCrore(crToINR(row.tender_cr))}</td>
                      <td className={`py-2 text-right font-semibold ${row.variance_pct > 20 ? "text-red-600" : row.variance_pct > 10 ? "text-amber-600" : "text-slate-600 dark:text-slate-300"}`}>
                        {row.variance_pct > 0 ? "+" : ""}{row.variance_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface EstimateResultProps {
  estimate: Estimate;
}

export function EstimateResult({ estimate }: EstimateResultProps): JSX.Element {
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const defaultCostBreakdown = {
    materials_cr: 0,
    labour_equipment_cr: 0,
    earthwork_cr: 0,
    structures_cr: 0,
    finishing_cr: 0,
    profit_cr: 0,
    contingency_cr: 0,
    gst_cr: 0
  };

  const defaultAires = {
    total_cost_cr: 0,
    confidence_level: "Low",
    confidence_pct: 0,
    unit_rate: { value: 0, unit: "" },
    sor_reference: "",
    cost_breakdown: defaultCostBreakdown,
    assumptions: [] as string[],
    risk_factors: [] as any[],
    comparable_projects: [] as any[],
    anomaly_flags: [] as string[],
    region_adjustment: { state: "", multiplier: 1, reason: "" }
  } as const;

  const r = {
    ...defaultAires,
    ...(estimate.ai_result ?? {}),
    cost_breakdown: { ...defaultCostBreakdown, ...(estimate.ai_result?.cost_breakdown ?? {}) },
    assumptions: estimate.ai_result?.assumptions ?? [],
    risk_factors: estimate.ai_result?.risk_factors ?? [],
    comparable_projects: estimate.ai_result?.comparable_projects ?? [],
    anomaly_flags: estimate.ai_result?.anomaly_flags ?? [],
    region_adjustment: estimate.ai_result?.region_adjustment ?? defaultAires.region_adjustment
  } as any;

  const bd = r.cost_breakdown;

  const chartData = Object.entries(BREAKDOWN_LABELS).map(([key, label]) => ({
    name: label,
    value: bd[key as keyof typeof bd] ?? 0
  })).filter((d) => d.value > 0);

  const handleDownloadPdf = () => {
    const apiBase = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "http://localhost:4000";
    const token = localStorage.getItem("casper_access_token") ?? "";
    const url = `${apiBase}/api/estimate/${estimate._id}/pdf`;
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", `CASPER_Estimate_${estimate.project_name.replace(/\s+/g, "_")}.pdf`);
    if (token) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.blob())
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          a.href = objectUrl;
          a.click();
          URL.revokeObjectURL(objectUrl);
        })
        .catch(() => showToast("error", "PDF generation failed"));
    } else {
      a.click();
    }
  };

  return (
    <div className="space-y-6">
      {/* Total cost hero */}
      <div className="relative overflow-hidden rounded-xl bg-[#1e3a5f] px-8 py-6 text-white shadow-lg">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-blue-300">Fair Cost Estimate</p>
            <p className="mt-1 text-5xl font-bold tracking-tight">
              {formatCrore(crToINR(r.total_cost_cr))}
            </p>
            <p className="mt-1 text-xs text-blue-200">
              {formatCrore(crToINR(r.unit_rate.value))} {r.unit_rate.unit} · {r.sor_reference}
            </p>
            {estimate.ml_estimate_cr && (
              <p className="mt-1 text-xs text-blue-300">ML Baseline: {formatCrore(crToINR(estimate.ml_estimate_cr))}</p>
            )}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <ConfidenceBadge level={r.confidence_level} pct={r.confidence_pct} />
            <p className="text-xs text-blue-300">{estimate.project_type} · {estimate.district}, {estimate.state}</p>
            <p className="text-xs text-blue-300">Model: {estimate.claude_model_used}</p>
          </div>
        </div>
        {/* subtle grid overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-5" style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 23px,#fff 23px,#fff 24px),repeating-linear-gradient(90deg,transparent,transparent 23px,#fff 23px,#fff 24px)" }} />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleDownloadPdf}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
            <path d="M12 16v-8m0 8-3-3m3 3 3-3M4 20h16M8 4H4v16h16V4h-4" />
          </svg>
          Download PDF Report
        </button>
        <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
          Estimate ID: <code className="font-mono text-casper-blue">{estimate._id}</code>
        </span>
      </div>

      {/* Anomaly flags */}
      {r.anomaly_flags.length > 0 && (
        <div className="space-y-2">
          {r.anomaly_flags.map((flag: string, i: number) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              <span className="mt-0.5 text-base leading-none">⚠</span>
              <span>{flag}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cost breakdown bar chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">Cost Breakdown</h3>
        <div className="mb-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 32, top: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatCrore(crToINR(v as number))} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: number) => [formatCrore(crToINR(v)), "Amount"]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {chartData.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 flex-shrink-0 rounded-sm" style={{ background: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length] }} />
              <div>
                <p className="text-xs text-slate-500">{d.name}</p>
                <p className="text-xs font-semibold">{formatCrore(crToINR(d.value))}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Region adjustment */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm dark:border-blue-900 dark:bg-blue-900/20">
        <span className="font-semibold text-blue-800 dark:text-blue-300">Region Adjustment: </span>
        <span className="text-blue-700 dark:text-blue-400">
          {r.region_adjustment.state} × {r.region_adjustment.multiplier} — {r.region_adjustment.reason}
        </span>
      </div>

      {/* Risk factors */}
      {r.risk_factors.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">Risk Factors</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Factor</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Impact</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Severity</th>
                </tr>
              </thead>
              <tbody>
                {r.risk_factors.map((rf: { factor: string; impact: string; severity: string }, i: number) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{rf.factor}</td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{rf.impact}</td>
                    <td className="px-6 py-3"><SeverityBadge severity={rf.severity} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assumptions accordion */}
      {r.assumptions.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setAssumptionsOpen((o) => !o)}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              Assumptions ({r.assumptions.length})
            </h3>
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 fill-none stroke-current stroke-2 transition-transform ${assumptionsOpen ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {assumptionsOpen && (
            <div className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
              <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                {r.assumptions.map((a: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 text-slate-400">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Comparable projects */}
      {r.comparable_projects.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">Comparable Projects</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Year</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Cost (₹ Cr)</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Source</th>
                </tr>
              </thead>
              <tbody>
                {r.comparable_projects.map((p: { name: string; location: string; year: string | number; cost_cr: number; source: string }, i: number) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{p.name}</td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{p.location}</td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{p.year}</td>
                    <td className="px-6 py-3 text-right font-semibold">{formatCrore(crToINR(p.cost_cr))}</td>
                    <td className="px-6 py-3 text-xs text-slate-500">{p.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tender compare */}
      <TenderCompare
        estimateId={estimate._id}
        fairTotal={estimate.total_cost_cr}
        existingComparison={estimate.tender_comparison}
      />
    </div>
  );
}
