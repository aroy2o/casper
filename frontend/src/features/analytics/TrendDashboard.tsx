import { useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";
import { useAppSelector, useAppDispatch } from "../../app/hooks";
import { useGetTrendsQuery, useGetTopInflatedQuery } from "./analyticsApi";
import { setItem, setPeriod } from "./analyticsSlice";

const ITEM_OPTIONS = [
  { value: "cement", label: "Cement" },
  { value: "steel_rod", label: "Steel Rod" },
  { value: "coarse_sand", label: "Coarse Sand" },
  { value: "fine_sand", label: "Fine Sand" },
  { value: "aggregate_20mm", label: "Aggregate 20mm" },
  { value: "brick", label: "Brick" },
  { value: "bitumen", label: "Bitumen" },
  { value: "rcc_pipe", label: "RCC Pipe" }
];

const COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed",
  "#0891b2", "#be185d", "#65a30d", "#9333ea", "#ea580c"
];

// Format the period key from backend into a human label
function formatPeriodLabel(key: string): string {
  // Yearly: "2024", "2025", "2026"
  if (/^\d{4}$/.test(key)) return key;
  // Quarterly: "2024-Q3" → "Q3 '24"
  const qMatch = key.match(/^(\d{4})-Q(\d)$/);
  if (qMatch) return `Q${qMatch[2] ?? ""} '${(qMatch[1] ?? "").slice(2)}`;
  // Monthly: "2024-05" → "May '24"
  const mMatch = key.match(/^(\d{4})-(\d{2})$/);
  if (mMatch) {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthIdx = parseInt(mMatch[2] ?? "1", 10) - 1;
    return `${months[monthIdx] ?? mMatch[2]} '${(mMatch[1] ?? "").slice(2)}`;
  }
  return key;
}

function buildRecentPeriodKeys(period: "monthly" | "quarterly" | "yearly", count: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  if (period === "yearly") {
    for (let i = count - 1; i >= 0; i -= 1) keys.push(String(now.getFullYear() - i));
    return keys;
  }
  if (period === "quarterly") {
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
    const absoluteQuarter = now.getFullYear() * 4 + (currentQuarter - 1);
    for (let i = count - 1; i >= 0; i -= 1) {
      const q = absoluteQuarter - i;
      const year = Math.floor(q / 4);
      const quarter = (q % 4) + 1;
      keys.push(`${year}-Q${quarter}`);
    }
    return keys;
  }
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function normalizeSeriesToWindow(
  series: { date: string; avgPriceINR: number }[],
  period: "monthly" | "quarterly" | "yearly",
  targetBuckets: number
): { date: string; avgPriceINR: number }[] {
  if (targetBuckets <= 0) return series;
  const keys = buildRecentPeriodKeys(period, targetBuckets);
  const byDate = new Map(series.map((p) => [p.date, p.avgPriceINR]));
  const fallback = series.length > 0 ? series[series.length - 1]!.avgPriceINR : 0;
  let lastValue = fallback;
  return keys.map((key) => {
    const value = byDate.get(key);
    if (typeof value === "number") {
      lastValue = value;
      return { date: key, avgPriceINR: value };
    }
    return { date: key, avgPriceINR: lastValue };
  });
}

const SeverityBadge = ({ pct }: { pct: number | null }): JSX.Element => {
  if (pct === null) return <span className="text-xs text-slate-400">N/A</span>;
  const cls = pct > 20 ? "bg-red-100 text-red-700" : pct > 10 ? "bg-amber-100 text-amber-700" : pct > 0 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{pct > 0 ? "+" : ""}{pct}%</span>;
};

export const TrendDashboard = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const { selectedStateCode, selectedDistrictCode, selectedItem, selectedPeriod } = useAppSelector((s) => s.analytics);
  const [quarterWindow, setQuarterWindow] = useState(6);
  const [yearWindow, setYearWindow] = useState(2);

  const requestedDays =
    selectedPeriod === "yearly"
      ? yearWindow * 365 + 30
      : selectedPeriod === "quarterly"
      ? quarterWindow * 90 + 30
      : 180;
  const targetBuckets = selectedPeriod === "yearly" ? yearWindow : selectedPeriod === "quarterly" ? quarterWindow : 6;

  const trendParams = {
    item: selectedItem,
    period: selectedPeriod,
    days: requestedDays,
    ...(selectedStateCode ? { state: selectedStateCode } : {}),
    ...(selectedDistrictCode ? { district: selectedDistrictCode } : {})
  };
  const { data: trendData, isLoading: trendLoading, isError: trendError } = useGetTrendsQuery(trendParams);

  const { data: topStates } = useGetTopInflatedQuery({ type: "state", limit: 5, item: selectedItem });
  const topDistrictParams = {
    type: "district" as const,
    limit: 5,
    item: selectedItem,
    ...(selectedStateCode ? { state: selectedStateCode } : {})
  };
  const { data: topDistricts } = useGetTopInflatedQuery(topDistrictParams);

  const stateSeriesKeys = useMemo(() => {
    if (!trendData?.stateSeries) return [];
    return Object.keys(trendData.stateSeries).slice(0, 10);
  }, [trendData]);

  // National pan-India chart: merge all state series by date using Maps (O(1) lookup)
  const nationalChartData = useMemo(() => {
    if (!trendData?.stateSeries || stateSeriesKeys.length === 0) return [];

    // Build a map per state: date → avgPriceINR
    const stateMaps = new Map<string, Map<string, number>>();
    const allDates = new Set<string>();

    for (const key of stateSeriesKeys) {
      const pts = normalizeSeriesToWindow(
        trendData.stateSeries![key] ?? [],
        selectedPeriod,
        targetBuckets
      );
      const m = new Map<string, number>();
      for (const pt of pts) {
        m.set(pt.date, pt.avgPriceINR);
        allDates.add(pt.date);
      }
      stateMaps.set(key, m);
    }

    return Array.from(allDates)
      .sort()
      .map((date) => {
        const row: Record<string, unknown> = { date, label: formatPeriodLabel(date) };
        for (const key of stateSeriesKeys) {
          const val = stateMaps.get(key)?.get(date);
          if (val !== undefined) row[key] = val;
        }
        return row;
      });
  }, [trendData, stateSeriesKeys, selectedPeriod, targetBuckets]);

  // State-specific single-line chart
  const stateSeries = useMemo(
    () =>
      normalizeSeriesToWindow(trendData?.series ?? [], selectedPeriod, targetBuckets).map((pt) => ({
        ...pt,
        label: formatPeriodLabel(pt.date)
      })),
    [trendData, selectedPeriod, targetBuckets]
  );

  const topPanIndiaKeys = useMemo(() => {
    if (selectedStateCode || nationalChartData.length === 0) return new Set<string>();
    const latest = nationalChartData[nationalChartData.length - 1] as Record<string, unknown> | undefined;
    if (!latest) return new Set<string>();
    return new Set(
      stateSeriesKeys
        .map((key) => ({ key, value: Number(latest[key] ?? -Infinity) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3)
        .map((x) => x.key)
    );
  }, [selectedStateCode, nationalChartData, stateSeriesKeys]);

  // Decide chart type: bar for yearly/quarterly (few buckets), line for monthly
  const useBarChart = selectedPeriod === "yearly" ||
    (selectedPeriod === "quarterly" && (stateSeries.length <= 4 || nationalChartData.length <= 4));

  const chartHeight = selectedPeriod === "yearly" ? 260 : 300;
  const visibleBucketCount = selectedStateCode ? stateSeries.length : nationalChartData.length;

  const yTickFormatter = (v: number): string =>
    v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`;

  const renderPanIndiaTooltip = ({ active, payload, label }: any): JSX.Element | null => {
    if (!active || !Array.isArray(payload) || payload.length === 0) return null;
    const rows = payload
      .filter((p: any) => typeof p?.value === "number")
      .sort((a: any, b: any) => Number(b.value) - Number(a.value))
      .slice(0, 6);
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-2.5 text-xs text-slate-100 shadow-xl">
        <p className="mb-1 font-semibold text-slate-200">{String(label)}</p>
        <div className="space-y-1">
          {rows.map((row: any) => (
            <div key={String(row.dataKey)} className="flex min-w-[190px] items-center justify-between gap-3">
              <span className="truncate" style={{ color: row.color }}>{String(row.name ?? row.dataKey)}</span>
              <span className="font-medium text-slate-100">₹{Number(row.value).toLocaleString("en-IN")}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Material</label>
          <select
            value={selectedItem}
            onChange={(e) => dispatch(setItem(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {ITEM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Period</label>
          {(["monthly", "quarterly", "yearly"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => dispatch(setPeriod(p))}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                selectedPeriod === p
                  ? "bg-casper-blue text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        {selectedPeriod === "quarterly" && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Quarter window</label>
            <select
              value={quarterWindow}
              onChange={(e) => setQuarterWindow(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {[4, 6].map((q) => (
                <option key={q} value={q}>{q} quarters</option>
              ))}
            </select>
          </div>
        )}
        {selectedPeriod === "yearly" && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Year window</label>
            <select
              value={yearWindow}
              onChange={(e) => setYearWindow(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {[1, 2].map((y) => (
                <option key={y} value={y}>{y} years</option>
              ))}
            </select>
          </div>
        )}
        {selectedPeriod === "yearly" && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Showing {visibleBucketCount} {visibleBucketCount === 1 ? "year" : "years"} of data
          </span>
        )}
        {selectedPeriod === "quarterly" && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Showing {visibleBucketCount} {visibleBucketCount === 1 ? "quarter" : "quarters"}
          </span>
        )}
      </div>

      {/* Main chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {selectedStateCode
            ? `Price Trend — ${selectedItem} · ${selectedStateCode}`
            : `Pan-India Price Trend — ${selectedItem} (Top 10 states)`}
        </h3>
        <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
          {selectedPeriod === "yearly" ? "Annual avg price (CPWD SOR baseline + simulated regional variation)" :
           selectedPeriod === "quarterly" ? "Quarterly avg price per region" :
           "Monthly avg price per region"}
        </p>

        {trendLoading && (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" />
          </div>
        )}
        {trendError && (
          <div className="flex h-48 items-center justify-center text-sm text-slate-400">
            No data available — run <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">npm run seed:all-states</code> in the backend
          </div>
        )}

        {!trendLoading && !trendError && (() => {
          const data = selectedStateCode ? stateSeries : nationalChartData;
          if (data.length === 0) {
            return (
              <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                No data for this period — try Monthly view or run the seed script
              </div>
            );
          }

          // Single-state view
          if (selectedStateCode) {
            return (
              <ResponsiveContainer width="100%" height={chartHeight}>
                {useBarChart ? (
                  <BarChart data={stateSeries} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={yTickFormatter} width={64} />
                    <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Avg Price"]} labelFormatter={(l) => String(l)} />
                    <Bar dataKey="avgPriceINR" name="Avg Price" radius={[4, 4, 0, 0]}>
                      {stateSeries.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <LineChart data={stateSeries} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      interval={selectedPeriod === "monthly" ? Math.floor(stateSeries.length / 6) : 0}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={yTickFormatter} width={64} />
                    <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Avg Price"]} labelFormatter={(l) => String(l)} />
                    <Line
                      type="monotone"
                      dataKey="avgPriceINR"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={stateSeries.length <= 12}
                      activeDot={{ r: 5 }}
                      name="Avg Price"
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            );
          }

          // Pan-India multi-state view
          return (
            <ResponsiveContainer width="100%" height={chartHeight}>
              {useBarChart ? (
                <BarChart data={nationalChartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={yTickFormatter} width={64} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, ""]} labelFormatter={(l) => String(l)} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  {stateSeriesKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} name={key} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={nationalChartData} margin={{ top: 8, right: 20, bottom: 8, left: 4 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#cbd5e1" opacity={0.6} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={{ stroke: "#cbd5e1" }}
                    interval={Math.max(0, Math.floor(nationalChartData.length / 8) - 1)}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={yTickFormatter}
                    tickLine={false}
                    axisLine={{ stroke: "#cbd5e1" }}
                    width={68}
                  />
                  <Tooltip content={renderPanIndiaTooltip} />
                  <Legend iconSize={9} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                  {stateSeriesKeys.map((key, i) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={topPanIndiaKeys.has(key) ? 2.7 : 1.4}
                      strokeOpacity={topPanIndiaKeys.has(key) ? 0.98 : 0.35}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
                      name={key}
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          );
        })()}
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <LeaderboardCard
          title="Top 5 Most Inflated States"
          items={topStates?.items ?? []}
          median={topStates?.median ?? 0}
          emptyText="No state data available"
        />
        <LeaderboardCard
          title={selectedStateCode ? `Top 5 Inflated Districts — ${selectedStateCode}` : "Top 5 Most Inflated Districts"}
          items={topDistricts?.items ?? []}
          median={topDistricts?.median ?? 0}
          emptyText="Select a state for district data"
        />
      </div>
    </div>
  );
};

const LeaderboardCard = ({
  title, items, median, emptyText
}: {
  title: string;
  items: { code: string; label: string; avgPriceINR: number; deviationPct: number }[];
  median: number;
  emptyText: string;
}): JSX.Element => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
    {items.length === 0 ? (
      <p className="py-4 text-center text-sm text-slate-400">{emptyText}</p>
    ) : (
      <>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          National median: <strong>₹{median.toLocaleString("en-IN")}</strong>
        </p>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={item.code} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-casper-blue/10 text-[10px] font-bold text-casper-blue">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">₹{item.avgPriceINR.toLocaleString("en-IN")}</span>
                <SeverityBadge pct={item.deviationPct} />
              </div>
            </div>
          ))}
        </div>
      </>
    )}
  </div>
);
