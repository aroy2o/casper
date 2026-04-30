import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { SourceRef } from "../components/SourceRef";
import { useGetPricesQuery, type PriceRecord, useGetPriceHistoryQuery, useRefreshPricesMutation } from "../features/prices/pricesApi";
import { useGetBenchmarkQuery } from "../features/benchmarks/benchmarksApi";
import { useAppSelector } from "../app/hooks";
import { formatCrore, formatCurrency, formatDate, formatRelativeTime } from "../utils/format";
import { showToast } from "../utils/toast";
import { TransText } from "../components/TransText";

export const PriceExplorer = (): JSX.Element => {
  const materials = [
    "cement", "steel_rod", "coarse_sand", "fine_sand",
    "aggregate_20mm", "brick", "bitumen", "rcc_pipe"
  ] as const;

  const { selectedStateCode, selectedStateName, selectedDistrictCode, selectedDistrictName } = useAppSelector((s) => s.analytics);
  const activeRegion = selectedStateCode ?? "national";

  const [selectedMaterial, setSelectedMaterial] = useState<(typeof materials)[number]>("cement");
  const [projectType, setProjectType] = useState("road");
  const [lengthKm, setLengthKm] = useState("5");

  const { data: prices, isLoading: pricesLoading, isError: pricesError } = useGetPricesQuery({ region: activeRegion });

  // Primary: district (if selected) → state → national
  const primaryArgs = selectedDistrictCode
    ? { material: selectedMaterial, region: activeRegion, districtCode: selectedDistrictCode, days: 90 }
    : { material: selectedMaterial, region: activeRegion, days: 90 };
  const historyPrimary = useGetPriceHistoryQuery(primaryArgs);
  // Secondary: state line shown when a district is active
  const historyState = useGetPriceHistoryQuery(
    { material: selectedMaterial, region: activeRegion, days: 90 },
    { skip: !selectedDistrictCode || activeRegion === "national" }
  );
  // Baseline: national, shown when state or district is selected
  const historyNational = useGetPriceHistoryQuery(
    { material: selectedMaterial, region: "national", days: 90 },
    { skip: activeRegion === "national" }
  );

  const [refreshPrices, refreshState] = useRefreshPricesMutation();
  const [refreshMsg, setRefreshMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const safePrices = Array.isArray(prices) ? prices : [];

  const findMaterialPrice = (material: string): PriceRecord | null =>
    safePrices.find((row) => row.material === material) ?? null;

  const sourceBadge = (source: string): { label: string; className: string } => {
    const n = source.toLowerCase();
    if (n.includes("gem")) return { label: "GeM", className: "bg-casper-blue/15 text-casper-blue" };
    if (n.includes("iocl")) return { label: "IOCL", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
    if (n.includes("sail")) return { label: "SAIL", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
    if (n.includes("indiamart")) return { label: "IndiaMART", className: "bg-casper-amber/15 text-casper-amber" };
    if (n.includes("tradeindia")) return { label: "TradeIndia", className: "bg-casper-amber/15 text-casper-amber" };
    if (n.includes("cpwd")) return { label: "CPWD", className: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
    return { label: source, className: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
  };

  const freshnessDotColor = (scrapedAt: string): string => {
    const diffDays = (Date.now() - new Date(scrapedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 1) return "#22c55e";
    if (diffDays <= 7) return "#eab308";
    return "#ef4444";
  };

  const sourceLabel = (source: string): string => {
    const map: Record<string, string> = {
      iocl: "IOCL (IndianOil)", sail: "SAIL", cpwd: "CPWD SOR",
      cpwd_fallback: "CPWD (fallback)", gem: "GeM"
    };
    return map[source.toLowerCase()] ?? (source.charAt(0).toUpperCase() + source.slice(1));
  };

  const formatIST = (scrapedAt: string): string => {
    const d = new Date(scrapedAt);
    const dateStr = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
    const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
    return `${dateStr}, ${timeStr} IST`;
  };

  const formatMaterialName = (material: string): string => {
    const map: Record<string, string> = {
      cement: "Cement OPC 53 Grade", steel_rod: "TMT Steel Rod (Fe500)",
      coarse_sand: "Coarse Sand", fine_sand: "Fine Sand",
      aggregate_20mm: "20mm Aggregate", brick: "Bricks",
      bitumen: "Bitumen (VG30)", rcc_pipe: "RCC Pipe"
    };
    return map[material] ?? material.replaceAll("_", " ");
  };

  const trendForRegion = (points: Array<{ date: string; priceINR: number }> | undefined): { label: string; className: string } => {
    if (!points || points.length < 8) return { label: "—", className: "text-slate-500" };
    const latest = points[points.length - 1];
    const weekAgo = points[points.length - 8];
    if (!latest || !weekAgo || weekAgo.priceINR <= 0) return { label: "—", className: "text-slate-500" };
    const pct = ((latest.priceINR - weekAgo.priceINR) / weekAgo.priceINR) * 100;
    if (pct > 0) return { label: `↑ +${pct.toFixed(1)}%`, className: "text-casper-red" };
    if (pct < 0) return { label: `↓ ${pct.toFixed(1)}%`, className: "text-casper-green" };
    return { label: "—", className: "text-slate-500" };
  };

  const selectedTrend = trendForRegion(historyPrimary.data?.dataPoints);

  const chartData = useMemo(() => {
    const primaryPoints = historyPrimary.data?.dataPoints ?? [];
    const statePoints = historyState.data?.dataPoints ?? [];
    const nationalPoints = historyNational.data?.dataPoints ?? [];
    const base = primaryPoints.length > 0 ? primaryPoints : nationalPoints;
    if (base.length === 0) return [];
    // Align by date string so mismatched lengths don't shift lines
    const byDate = (pts: typeof primaryPoints): Map<string, number> =>
      new Map(pts.map((p) => [p.date.slice(0, 10), p.priceINR]));
    const stateByDate = byDate(statePoints);
    const nationalByDate = byDate(nationalPoints);
    return base.map((point) => {
      const day = point.date.slice(0, 10);
      return {
        date: formatDate(point.date),
        primary: point.priceINR,
        state: stateByDate.get(day),
        national: nationalByDate.get(day)
      };
    });
  }, [historyPrimary.data, historyState.data, historyNational.data]);

  const benchmarkQuery = useGetBenchmarkQuery(
    { type: projectType, region: activeRegion, lengthKm: Number(lengthKm) || 1, year: new Date().getFullYear() }
  );

  if (pricesError) showToast("error", "Unable to load prices");

  const handleRefresh = async (): Promise<void> => {
    try {
      const result = await refreshPrices().unwrap();
      setRefreshMsg({ type: "success", text: `✓ Updated ${result.updated} prices` });
      setTimeout(() => setRefreshMsg(null), 4000);
    } catch {
      setRefreshMsg({ type: "error", text: "✗ Refresh failed" });
      setTimeout(() => setRefreshMsg(null), 4000);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold"><TransText text="Price Explorer" /></h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Showing prices for{" "}
            <span className="font-medium text-casper-blue">
              {selectedStateName ?? "All India"}
            </span>
            {" — "}use the state selector in the header to change region
          </p>
        </div>
        <div className="flex items-center gap-3">
          {refreshMsg && (
            <span className={`text-sm ${refreshMsg.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {refreshMsg.text}
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshState.isLoading}
            className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 disabled:opacity-60"
          >
            <svg
              className={`h-4 w-4 ${refreshState.isLoading ? "animate-spin" : ""}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            {refreshState.isLoading ? <TransText text="Refreshing…" /> : <TransText text="Refresh Prices" />}
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Current prices list */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold"><TransText text="Current prices" /></h3>
            <span className="rounded-full bg-casper-blue/10 px-2 py-0.5 text-xs font-medium text-casper-blue">
              {selectedStateName ?? "All India"}
            </span>
          </div>
          {pricesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={`s-${idx}`} className="skeleton h-20" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {materials.map((m) => {
                const price = findMaterialPrice(m);
                const badge = price ? sourceBadge(price.source) : null;
                return (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setSelectedMaterial(m)}
                    className={`w-full rounded-2xl border p-4 text-left dark:border-slate-800 ${
                      selectedMaterial === m
                        ? "border-casper-blue bg-white dark:bg-slate-950"
                        : "border-slate-200 bg-slate-50 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{formatMaterialName(m)}</p>
                        {price ? (
                          <p className="mt-1 text-lg font-bold">
                            {formatCurrency(price.priceINR)}{" "}
                            <span className="text-xs font-medium text-slate-500">/ {price.unit}</span>
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-slate-500">No data</p>
                        )}
                        {price?.scrapedAt ? (
                          <p className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: freshnessDotColor(price.scrapedAt) }}
                            />
                            <span className="text-xs font-medium">{sourceLabel(price.source)}</span>
                            <span className="text-xs text-slate-500">· Scraped: {formatIST(price.scrapedAt)}</span>
                            <span className="text-xs text-slate-500">· {formatRelativeTime(price.scrapedAt)}</span>
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">No scrape data yet</p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                          Trend:{" "}
                          <span className={selectedMaterial === m ? selectedTrend.className : "text-slate-500"}>
                            {selectedMaterial === m ? selectedTrend.label : "—"}
                          </span>
                        </p>
                      </div>
                      {badge && price && (
                        <div className="flex flex-col items-end gap-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${badge.className}`}>
                            {badge.label}
                          </span>
                          <span className="text-[11px] text-slate-500">{formatRelativeTime(price.scrapedAt)}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Chart + estimator */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 xl:col-span-3">
          <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold">
              90-day trend — {formatMaterialName(selectedMaterial)}
            </h3>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {selectedDistrictCode && (
                <span><span className="inline-block h-2 w-2 rounded-full bg-casper-blue mr-1" />{selectedDistrictName}</span>
              )}
              {selectedStateCode && (
                <span><span className={`inline-block h-2 w-2 rounded-full mr-1 ${selectedDistrictCode ? "bg-amber-400" : "bg-casper-blue"}`} />{selectedStateName}</span>
              )}
              {activeRegion !== "national" && (
                <span><span className="inline-block h-2 w-2 rounded-full bg-slate-400 mr-1" />National</span>
              )}
            </div>
          </div>
          {historyPrimary.isLoading ? (
            <div className="h-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          ) : chartData.length === 0 ? (
            <p className="text-sm text-slate-500">No price history yet — run <code>npm run seed:all-states</code> first.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `₹${v}`} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, ""]} />
                  <Legend />
                  {/* Primary line: district (if selected) or state or national */}
                  <Line
                    type="monotone"
                    dataKey="primary"
                    stroke="#185FA5"
                    dot={false}
                    strokeWidth={2.5}
                    name={selectedDistrictName ?? selectedStateName ?? "National"}
                  />
                  {/* State comparison line when district is active */}
                  {selectedDistrictCode && selectedStateCode && (
                    <Line
                      type="monotone"
                      dataKey="state"
                      stroke="#f59e0b"
                      dot={false}
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                      name={selectedStateName ?? "State avg"}
                    />
                  )}
                  {/* National baseline when any state/district is selected */}
                  {activeRegion !== "national" && (
                    <Line
                      type="monotone"
                      dataKey="national"
                      stroke="#94a3b8"
                      dot={false}
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      name="National"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <h4 className="mb-3 text-sm font-semibold"><TransText text="Fair Cost Estimator" /></h4>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="road">road</option>
                <option value="bridge">bridge</option>
                <option value="building">building</option>
                <option value="drainage">drainage</option>
              </select>
              <input
                value={lengthKm}
                onChange={(e) => setLengthKm(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                placeholder="Length (km)"
              />
            </div>

            {benchmarkQuery.isLoading ? <div className="skeleton mt-4 h-20" /> : null}
            {benchmarkQuery.isError ? (
              <p className="mt-4 text-sm text-casper-red">Unable to load benchmark. Check backend.</p>
            ) : benchmarkQuery.data ? (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-slate-500">
                  {benchmarkQuery.data.projectType} • {benchmarkQuery.data.region} • {benchmarkQuery.data.lengthKm} km
                </p>
                <p className="text-3xl font-bold">{formatCrore(benchmarkQuery.data.estimatedCostINR)}</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {(
                    [
                      ["Materials", benchmarkQuery.data.breakdown.rawMaterials],
                      ["Labour & equipment", benchmarkQuery.data.breakdown.labourAndEquipment],
                      ["Profit", benchmarkQuery.data.breakdown.contractorProfit],
                      ["Contingency", benchmarkQuery.data.breakdown.contingency],
                      ["GST", benchmarkQuery.data.breakdown.gst]
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className="text-xs font-semibold">{formatCrore(value)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Confidence {(benchmarkQuery.data.confidence * 100).toFixed(0)}%</p>
                  <div className="mt-2 h-2 w-full rounded bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full rounded bg-casper-green"
                      style={{ width: `${Math.round(benchmarkQuery.data.confidence * 100)}%` }}
                    />
                  </div>
                </div>
                {benchmarkQuery.data.comparableProjects.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-slate-500">Comparable projects (World Bank)</p>
                    <ul className="mt-1 space-y-1">
                      {benchmarkQuery.data.comparableProjects.map((p) => (
                        <li key={`${p.name}-${p.year}`} className="text-xs text-slate-700 dark:text-slate-200">
                          {p.name} • {formatCrore(p.costINR)} • {p.year}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Enter inputs to estimate fair cost.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
