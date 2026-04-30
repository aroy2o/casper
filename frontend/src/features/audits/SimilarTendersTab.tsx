import { useGetSimilarTendersQuery } from "./auditsApi";
import { formatCrore, formatDate } from "../../utils/format";

interface Props {
  tenderId: string;
  tender: { projectType?: string; state?: string; totalEstimatedCostINR?: number };
}

const similarityColor = (score: number): string => {
  if (score >= 75) return "text-emerald-600 bg-emerald-50";
  if (score >= 50) return "text-yellow-600 bg-yellow-50";
  return "text-slate-600 bg-slate-100";
};

const riskColor = (level: string): string => {
  if (level === "critical" || level === "high") return "text-red-600";
  if (level === "medium") return "text-yellow-600";
  return "text-emerald-600";
};

export function SimilarTendersTab({ tenderId, tender }: Props): JSX.Element {
  const { data, isLoading, isError } = useGetSimilarTendersQuery({ tenderId, limit: 10 });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" />
          Finding similar historical tenders…
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        Unable to load similar tenders. The tender may not have enough data for comparison.
      </div>
    );
  }

  const { results, explanationCard } = data;

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold mb-2">Similar Tenders</h2>
        <p className="text-sm text-slate-500">
          No comparable historical tenders found for this {tender.projectType ?? "project"} in the database yet. Add more tenders to enable comparison.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Similar Tender Comparison</h2>
        <p className="mt-1 text-xs text-slate-500">
          Top {results.length} historical tenders matched by project type, region, and time proximity.
        </p>

        {/* Explanation card */}
        {explanationCard && (
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
            <span className="mr-2 font-semibold">Analysis:</span>{explanationCard}
          </div>
        )}

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <th className="pb-2 pr-4">Tender</th>
                <th className="pb-2 pr-4">Region</th>
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Cost</th>
                <th className="pb-2 pr-4">Deviation</th>
                <th className="pb-2 pr-4">Risk</th>
                <th className="pb-2">Match</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r._id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-slate-900 dark:text-slate-100 max-w-[200px] truncate" title={r.title}>{r.title}</div>
                    <div className="text-xs text-slate-400 font-mono">{r.tenderNumber}</div>
                    {r.vendorName && <div className="text-xs text-slate-500 truncate max-w-[200px]">{r.vendorName}</div>}
                  </td>
                  <td className="py-3 pr-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    <div>{r.state}</div>
                    {r.district && <div className="text-xs text-slate-400">{r.district}</div>}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs">
                    {r.publishedDate ? formatDate(r.publishedDate) : "—"}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap font-mono text-xs text-slate-800 dark:text-slate-200">
                    {r.totalEstimatedCostINR > 0 ? formatCrore(r.totalEstimatedCostINR) : "—"}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {r.deviationVsTarget !== null ? (
                      <span className={`text-xs font-semibold ${r.deviationVsTarget > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {r.deviationVsTarget > 0 ? "+" : ""}{r.deviationVsTarget}%
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {r.audit ? (
                      <div>
                        <span className={`text-xs font-semibold capitalize ${riskColor(r.audit.riskLevel)}`}>{r.audit.riskLevel}</span>
                        <div className="text-xs text-slate-400">{r.audit.overallInflationPct.toFixed(1)}% inflation</div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">{r.status}</span>
                    )}
                  </td>
                  <td className="py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${similarityColor(r.similarityScore)}`}>
                      {r.similarityScore}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Similarity score factors: project type (35pt), state (25pt), district (20pt), date proximity (20pt), cost range (15pt).
        </p>
      </section>
    </div>
  );
}
