import { useMemo } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { AlertFeed } from "../components/AlertFeed";
import { RiskBadge } from "../components/RiskBadge";
import { SourceRef } from "../components/SourceRef";
import { StatCard } from "../components/StatCard";
import { TransText } from "../components/TransText";
import { useGetAuditSummaryQuery } from "../features/audits/auditsApi";
import { useGetPriceHistoryQuery } from "../features/prices/pricesApi";
import { useGetTendersQuery } from "../features/tenders/tendersApi";
import { useAppSelector } from "../app/hooks";
import { formatCrore } from "../utils/format";

export const Dashboard = (): JSX.Element => {
  const { selectedStateCode, selectedStateName, selectedDistrictCode, selectedDistrictName } = useAppSelector((s) => s.analytics);
  const activeRegion = selectedStateCode ?? "national";
  const activeLabel = selectedDistrictName ?? selectedStateName ?? null;

  const { data: auditSummary, isLoading: summaryLoading } = useGetAuditSummaryQuery();
  const { data: tenders, isLoading: tendersLoading } = useGetTendersQuery({ limit: 8, status: "flagged,clean" });
  const distArg = selectedDistrictCode ? { districtCode: selectedDistrictCode } : {};
  const {
    data: cementHistory,
    isLoading: cementLoading,
    isError: cementError
  } = useGetPriceHistoryQuery({ material: "cement", region: activeRegion, ...distArg, days: 90 });
  const { data: steelHistory } = useGetPriceHistoryQuery({ material: "steel_rod", region: activeRegion, ...distArg, days: 90 });
  const { data: nationalCementHistory } = useGetPriceHistoryQuery({ material: "cement", region: "national", days: 90 });
  const { data: nationalSteelHistory } = useGetPriceHistoryQuery({ material: "steel_rod", region: "national", days: 90 });

  const safeTenders = Array.isArray(tenders) ? tenders : [];
  const tenderMetrics = useMemo(() => {
    const totalAudits = safeTenders.length;
    const totalOverpricedINR = safeTenders.reduce((sum, tender) => {
      const tenderOverpriced = tender.lineItems.reduce((lineSum, line) => {
        if (line.marketRateINR === null || line.marketRateINR <= 0) return lineSum;
        return lineSum + Math.max((line.quotedRateINR - line.marketRateINR) * line.quantity, 0);
      }, 0);
      return sum + tenderOverpriced;
    }, 0);

    const inflationValues = safeTenders.flatMap((tender) =>
      tender.lineItems
        .map((line) => {
          if (typeof line.inflationPct === "number") return line.inflationPct;
          if (line.marketRateINR === null || line.marketRateINR <= 0) return null;
          return ((line.quotedRateINR - line.marketRateINR) / line.marketRateINR) * 100;
        })
        .filter((value): value is number => typeof value === "number")
    );

    const avgInflationPct =
      inflationValues.length > 0
        ? inflationValues.reduce((sum, value) => sum + value, 0) / inflationValues.length
        : null;

    const criticalCount = safeTenders.reduce((count, tender) => count + (tender.status === "flagged" ? 1 : 0), 0);
    return { totalAudits, totalOverpricedINR, avgInflationPct, criticalCount };
  }, [safeTenders]);

  const totalAudits = auditSummary?.totalAudits && auditSummary.totalAudits > 0 ? auditSummary.totalAudits : tenderMetrics.totalAudits;
  const totalOverpricedINR = auditSummary?.totalOverpricedINR && auditSummary.totalOverpricedINR > 0 ? auditSummary.totalOverpricedINR : tenderMetrics.totalOverpricedINR;
  const avgInflationPct =
    auditSummary?.avgInflationPct != null && Number.isFinite(auditSummary.avgInflationPct)
      ? auditSummary.avgInflationPct
      : tenderMetrics.avgInflationPct;
  const criticalCount =
    auditSummary?.criticalCount != null && auditSummary.criticalCount > 0
      ? auditSummary.criticalCount
      : tenderMetrics.criticalCount;

  const chartData = useMemo(() => {
    const selectedCement = cementHistory?.dataPoints ?? nationalCementHistory?.dataPoints ?? [];
    if (selectedCement.length === 0) return [];

    const selectedSteel = steelHistory?.dataPoints ?? nationalSteelHistory?.dataPoints ?? [];
    const steelByDate = new Map(selectedSteel.map((point) => [new Date(point.date).toISOString(), point.priceINR]));

    return selectedCement.map((point) => {
      const isoDate = new Date(point.date).toISOString();
      const steelPrice = steelByDate.get(isoDate);
      return {
        date: new Date(point.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        cement: Math.round(point.priceINR),
        steel: steelPrice ? Math.round(steelPrice / 100) : undefined
      };
    });
  }, [cementHistory, steelHistory, nationalCementHistory, nationalSteelHistory]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Audits" value={summaryLoading ? "…" : String(totalAudits)} />
        <StatCard label="Total Overpriced" value={summaryLoading ? "…" : formatCrore(totalOverpricedINR)} />
        <StatCard
          label="Average Inflation"
          value={summaryLoading ? "…" : avgInflationPct != null ? `${avgInflationPct.toFixed(1)}%` : "N/A"}
        />
        <StatCard label="Critical Flags" value={summaryLoading ? "…" : String(criticalCount)} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 xl:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold"><TransText text="90-day Price Trend" /></h3>
            <span className="text-xs text-slate-500">
              {activeLabel ? (
                <span className="rounded-full bg-casper-blue/10 px-2 py-0.5 text-casper-blue font-medium">{activeLabel}</span>
              ) : (
                <span className="text-slate-400">All India — use state selector above to filter</span>
              )}
            </span>
          </div>
          {cementLoading ? (
            <div className="h-64 animate-pulse rounded-lg bg-slate-800" />
          ) : cementError ? (
            <div className="flex h-64 items-center justify-center rounded-xl text-sm text-red-400">
              <TransText text="Failed to load price data" />
            </div>
          ) : chartData.length > 0 ? (
            <div style={{ width: "100%", height: "300px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} interval={14} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => "₹" + v} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "steel" ? "₹" + (value * 100).toLocaleString("en-IN") + "/t" : "₹" + value + "/bag",
                      name === "steel" ? "Steel (÷100)" : "Cement"
                    ]}
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="cement" stroke="#3b82f6" dot={false} strokeWidth={2} name="Cement (₹/bag)" />
                  <Line type="monotone" dataKey="steel" stroke="#f59e0b" dot={false} strokeWidth={2} name="Steel (÷100 ₹/t)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center text-slate-400">
              <p><TransText text="No price data yet" /></p>
            </div>
          )}
        </div>
        <div className="xl:col-span-2">
          <AlertFeed />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold"><TransText text="Recent Tenders" /></h3>
        {tendersLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-10" />
            <div className="skeleton h-10" />
            <div className="skeleton h-10" />
          </div>
        ) : safeTenders.length === 0 ? (
          <p className="text-sm text-slate-500"><TransText text="No tenders found." /></p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-2">Tender</th>
                  <th>Dept</th>
                  <th>State</th>
                  <th>Cost</th>
                  <th>Risk</th>
                  <th>Source</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {safeTenders.slice(0, 8).map((tender) => (
                  <tr key={tender._id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="max-w-[260px] truncate py-2">{tender.title}</td>
                    <td>{tender.department}</td>
                    <td className="capitalize">{tender.state}</td>
                    <td>{formatCrore(tender.totalEstimatedCostINR)}</td>
                    <td>
                      <RiskBadge riskLevel={tender.status === "clean" ? "clean" : tender.status === "flagged" ? "high" : "pending"} />
                    </td>
                    <td>
                      <SourceRef sourceURL={tender.sourceURL} fetchedAt={tender.parsedAt} />
                    </td>
                    <td className="text-right">
                      <Link className="text-casper-blue hover:underline" to={`/tenders/${tender._id}`}>
                        View audit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
