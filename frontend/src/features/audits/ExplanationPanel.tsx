import { useMemo, useState } from "react";
import { showToast } from "../../utils/toast";
import { useAppSelector } from "../../app/hooks";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

interface ExplanationFlag {
  lineItemDescription: string;
  quotedRateINR: number;
  marketRateINR: number;
  inflationPct: number;
  explanation: string;
  humanSummary?: string | null;
  riskContribution?: number | null;
}

interface ExplanationAudit {
  overallInflationPct: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  overallVerdict?: string | null;
  plainEnglishSummary?: string | null;
  flags?: ExplanationFlag[];
}

interface Props {
  tenderId: string;
  tenderNumber: string;
  audit: ExplanationAudit | null;
  onGenerateEvidencePdf: () => Promise<void>;
}

const deviationColor = (pct: number): string => {
  if (pct > 15) return "text-red-600";
  if (pct >= 5) return "text-amber-600";
  if (pct < 0) return "text-cyan-600";
  return "text-emerald-600";
};

export function ExplanationPanel({ tenderId, tenderNumber, audit, onGenerateEvidencePdf }: Props): JSX.Element | null {
  const [drafting, setDrafting] = useState(false);
  const token = useAppSelector((state) => state.auth.accessToken);
  const sortedFlags = useMemo(
    () => [...(audit?.flags ?? [])].sort((a, b) => b.inflationPct - a.inflationPct),
    [audit?.flags]
  );
  if (!audit) return null;

  const onDraftRti = async () => {
    setDrafting(true);
    try {
      const requestInit: RequestInit = token
        ? { method: "POST", headers: { Authorization: `Bearer ${token}` } }
        : { method: "POST" };
      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/audits/${tenderId}/draft-rti`,
        requestInit
      );
      if (!response.ok) {
        throw new Error(`RTI draft failed: ${response.status}`);
      }
      const pdfBlob = await response.blob();
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RTI-${tenderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast("error", "Unable to draft RTI PDF.");
    } finally {
      setDrafting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="rounded-xl bg-white p-4 dark:bg-slate-950">
        <p className="text-xs uppercase tracking-wide text-slate-500">Overall Verdict</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{audit.overallVerdict ?? audit.riskLevel.toUpperCase()}</h2>
          <span className="text-lg font-semibold">{audit.overallInflationPct.toFixed(1)}%</span>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {audit.plainEnglishSummary ?? "This tender contains pricing deviations from benchmark rates and should be reviewed."}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {sortedFlags.map((item) => {
          const contribution = Math.max(0, Math.min(100, ((item.riskContribution ?? 0) * 100)));
          return (
            <article key={`${item.lineItemDescription}-${item.quotedRateINR}`} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.lineItemDescription}</p>
                  <p className="text-xs text-slate-500">{inr.format(item.quotedRateINR)} vs {inr.format(item.marketRateINR)}</p>
                </div>
                <p className={`text-sm font-semibold ${deviationColor(item.inflationPct)}`}>{item.inflationPct.toFixed(1)}%</p>
              </div>
              <div className="mt-2 h-2 w-full rounded bg-slate-200 dark:bg-slate-800">
                <div className="h-2 rounded bg-casper-red" style={{ width: `${contribution}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{item.humanSummary ?? item.explanation}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void onGenerateEvidencePdf()} className="rounded bg-casper-blue px-3 py-2 text-sm font-medium text-white">
          Generate Evidence PDF
        </button>
        <button type="button" onClick={() => void onDraftRti()} disabled={drafting} className="rounded border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-700">
          {drafting ? "Drafting..." : "Draft RTI PDF"}
        </button>
      </div>
    </section>
  );
}
