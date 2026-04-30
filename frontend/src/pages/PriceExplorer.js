import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { useGetPricesQuery, useGetPriceHistoryQuery, useRefreshPricesMutation } from "../features/prices/pricesApi";
import { useGetBenchmarkQuery } from "../features/benchmarks/benchmarksApi";
import { useAppSelector } from "../app/hooks";
import { formatCrore, formatCurrency, formatDate, formatRelativeTime } from "../utils/format";
import { showToast } from "../utils/toast";
import { TransText } from "../components/TransText";
export const PriceExplorer = () => {
    const materials = [
        "cement", "steel_rod", "coarse_sand", "fine_sand",
        "aggregate_20mm", "brick", "bitumen", "rcc_pipe"
    ];
    const { selectedStateCode, selectedStateName, selectedDistrictCode, selectedDistrictName } = useAppSelector((s) => s.analytics);
    const activeRegion = selectedStateCode ?? "national";
    const [selectedMaterial, setSelectedMaterial] = useState("cement");
    const [projectType, setProjectType] = useState("road");
    const [lengthKm, setLengthKm] = useState("5");
    const { data: prices, isLoading: pricesLoading, isError: pricesError } = useGetPricesQuery({ region: activeRegion });
    // Primary: district (if selected) → state → national
    const primaryArgs = selectedDistrictCode
        ? { material: selectedMaterial, region: activeRegion, districtCode: selectedDistrictCode, days: 90 }
        : { material: selectedMaterial, region: activeRegion, days: 90 };
    const historyPrimary = useGetPriceHistoryQuery(primaryArgs);
    // Secondary: state line shown when a district is active
    const historyState = useGetPriceHistoryQuery({ material: selectedMaterial, region: activeRegion, days: 90 }, { skip: !selectedDistrictCode || activeRegion === "national" });
    // Baseline: national, shown when state or district is selected
    const historyNational = useGetPriceHistoryQuery({ material: selectedMaterial, region: "national", days: 90 }, { skip: activeRegion === "national" });
    const [refreshPrices, refreshState] = useRefreshPricesMutation();
    const [refreshMsg, setRefreshMsg] = useState(null);
    const safePrices = Array.isArray(prices) ? prices : [];
    const findMaterialPrice = (material) => safePrices.find((row) => row.material === material) ?? null;
    const sourceBadge = (source) => {
        const n = source.toLowerCase();
        if (n.includes("gem"))
            return { label: "GeM", className: "bg-casper-blue/15 text-casper-blue" };
        if (n.includes("iocl"))
            return { label: "IOCL", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
        if (n.includes("sail"))
            return { label: "SAIL", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
        if (n.includes("indiamart"))
            return { label: "IndiaMART", className: "bg-casper-amber/15 text-casper-amber" };
        if (n.includes("tradeindia"))
            return { label: "TradeIndia", className: "bg-casper-amber/15 text-casper-amber" };
        if (n.includes("cpwd"))
            return { label: "CPWD", className: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
        return { label: source, className: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
    };
    const freshnessDotColor = (scrapedAt) => {
        const diffDays = (Date.now() - new Date(scrapedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays < 1)
            return "#22c55e";
        if (diffDays <= 7)
            return "#eab308";
        return "#ef4444";
    };
    const sourceLabel = (source) => {
        const map = {
            iocl: "IOCL (IndianOil)", sail: "SAIL", cpwd: "CPWD SOR",
            cpwd_fallback: "CPWD (fallback)", gem: "GeM"
        };
        return map[source.toLowerCase()] ?? (source.charAt(0).toUpperCase() + source.slice(1));
    };
    const formatIST = (scrapedAt) => {
        const d = new Date(scrapedAt);
        const dateStr = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
        const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
        return `${dateStr}, ${timeStr} IST`;
    };
    const formatMaterialName = (material) => {
        const map = {
            cement: "Cement OPC 53 Grade", steel_rod: "TMT Steel Rod (Fe500)",
            coarse_sand: "Coarse Sand", fine_sand: "Fine Sand",
            aggregate_20mm: "20mm Aggregate", brick: "Bricks",
            bitumen: "Bitumen (VG30)", rcc_pipe: "RCC Pipe"
        };
        return map[material] ?? material.replaceAll("_", " ");
    };
    const trendForRegion = (points) => {
        if (!points || points.length < 8)
            return { label: "—", className: "text-slate-500" };
        const latest = points[points.length - 1];
        const weekAgo = points[points.length - 8];
        if (!latest || !weekAgo || weekAgo.priceINR <= 0)
            return { label: "—", className: "text-slate-500" };
        const pct = ((latest.priceINR - weekAgo.priceINR) / weekAgo.priceINR) * 100;
        if (pct > 0)
            return { label: `↑ +${pct.toFixed(1)}%`, className: "text-casper-red" };
        if (pct < 0)
            return { label: `↓ ${pct.toFixed(1)}%`, className: "text-casper-green" };
        return { label: "—", className: "text-slate-500" };
    };
    const selectedTrend = trendForRegion(historyPrimary.data?.dataPoints);
    const chartData = useMemo(() => {
        const primaryPoints = historyPrimary.data?.dataPoints ?? [];
        const statePoints = historyState.data?.dataPoints ?? [];
        const nationalPoints = historyNational.data?.dataPoints ?? [];
        const base = primaryPoints.length > 0 ? primaryPoints : nationalPoints;
        if (base.length === 0)
            return [];
        // Align by date string so mismatched lengths don't shift lines
        const byDate = (pts) => new Map(pts.map((p) => [p.date.slice(0, 10), p.priceINR]));
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
    const benchmarkQuery = useGetBenchmarkQuery({ type: projectType, region: activeRegion, lengthKm: Number(lengthKm) || 1, year: new Date().getFullYear() });
    if (pricesError)
        showToast("error", "Unable to load prices");
    const handleRefresh = async () => {
        try {
            const result = await refreshPrices().unwrap();
            setRefreshMsg({ type: "success", text: `✓ Updated ${result.updated} prices` });
            setTimeout(() => setRefreshMsg(null), 4000);
        }
        catch {
            setRefreshMsg({ type: "error", text: "✗ Refresh failed" });
            setTimeout(() => setRefreshMsg(null), 4000);
        }
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold", children: _jsx(TransText, { text: "Price Explorer" }) }), _jsxs("p", { className: "mt-0.5 text-xs text-slate-500", children: ["Showing prices for", " ", _jsx("span", { className: "font-medium text-casper-blue", children: selectedStateName ?? "All India" }), " — ", "use the state selector in the header to change region"] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [refreshMsg && (_jsx("span", { className: `text-sm ${refreshMsg.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`, children: refreshMsg.text })), _jsxs("button", { type: "button", onClick: () => void handleRefresh(), disabled: refreshState.isLoading, className: "flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 disabled:opacity-60", children: [_jsxs("svg", { className: `h-4 w-4 ${refreshState.isLoading ? "animate-spin" : ""}`, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }), _jsx("path", { d: "M21 3v5h-5" }), _jsx("path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }), _jsx("path", { d: "M8 16H3v5" })] }), refreshState.isLoading ? _jsx(TransText, { text: "Refreshing\u2026" }) : _jsx(TransText, { text: "Refresh Prices" })] })] })] }), _jsxs("section", { className: "grid grid-cols-1 gap-6 xl:grid-cols-5", children: [_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 xl:col-span-2", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold", children: _jsx(TransText, { text: "Current prices" }) }), _jsx("span", { className: "rounded-full bg-casper-blue/10 px-2 py-0.5 text-xs font-medium text-casper-blue", children: selectedStateName ?? "All India" })] }), pricesLoading ? (_jsx("div", { className: "space-y-3", children: Array.from({ length: 8 }).map((_, idx) => (_jsx("div", { className: "skeleton h-20" }, `s-${idx}`))) })) : (_jsx("div", { className: "space-y-3", children: materials.map((m) => {
                                    const price = findMaterialPrice(m);
                                    const badge = price ? sourceBadge(price.source) : null;
                                    return (_jsx("button", { type: "button", onClick: () => setSelectedMaterial(m), className: `w-full rounded-2xl border p-4 text-left dark:border-slate-800 ${selectedMaterial === m
                                            ? "border-casper-blue bg-white dark:bg-slate-950"
                                            : "border-slate-200 bg-slate-50 dark:bg-slate-900"}`, children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold", children: formatMaterialName(m) }), price ? (_jsxs("p", { className: "mt-1 text-lg font-bold", children: [formatCurrency(price.priceINR), " ", _jsxs("span", { className: "text-xs font-medium text-slate-500", children: ["/ ", price.unit] })] })) : (_jsx("p", { className: "mt-1 text-sm text-slate-500", children: "No data" })), price?.scrapedAt ? (_jsxs("p", { className: "mt-1 flex items-center gap-1.5 flex-wrap", children: [_jsx("span", { className: "inline-block h-2 w-2 rounded-full", style: { backgroundColor: freshnessDotColor(price.scrapedAt) } }), _jsx("span", { className: "text-xs font-medium", children: sourceLabel(price.source) }), _jsxs("span", { className: "text-xs text-slate-500", children: ["\u00B7 Scraped: ", formatIST(price.scrapedAt)] }), _jsxs("span", { className: "text-xs text-slate-500", children: ["\u00B7 ", formatRelativeTime(price.scrapedAt)] })] })) : (_jsx("p", { className: "mt-1 text-xs text-slate-500", children: "No scrape data yet" })), _jsxs("p", { className: "mt-1 text-xs text-slate-500", children: ["Trend:", " ", _jsx("span", { className: selectedMaterial === m ? selectedTrend.className : "text-slate-500", children: selectedMaterial === m ? selectedTrend.label : "—" })] })] }), badge && price && (_jsxs("div", { className: "flex flex-col items-end gap-2", children: [_jsx("span", { className: `rounded-full px-2 py-1 text-[11px] font-semibold ${badge.className}`, children: badge.label }), _jsx("span", { className: "text-[11px] text-slate-500", children: formatRelativeTime(price.scrapedAt) })] }))] }) }, m));
                                }) }))] }), _jsxs("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 xl:col-span-3", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between flex-wrap gap-2", children: [_jsxs("h3", { className: "text-sm font-semibold", children: ["90-day trend \u2014 ", formatMaterialName(selectedMaterial)] }), _jsxs("div", { className: "flex items-center gap-3 text-xs text-slate-500", children: [selectedDistrictCode && (_jsxs("span", { children: [_jsx("span", { className: "inline-block h-2 w-2 rounded-full bg-casper-blue mr-1" }), selectedDistrictName] })), selectedStateCode && (_jsxs("span", { children: [_jsx("span", { className: `inline-block h-2 w-2 rounded-full mr-1 ${selectedDistrictCode ? "bg-amber-400" : "bg-casper-blue"}` }), selectedStateName] })), activeRegion !== "national" && (_jsxs("span", { children: [_jsx("span", { className: "inline-block h-2 w-2 rounded-full bg-slate-400 mr-1" }), "National"] }))] })] }), historyPrimary.isLoading ? (_jsx("div", { className: "h-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800" })) : chartData.length === 0 ? (_jsxs("p", { className: "text-sm text-slate-500", children: ["No price history yet \u2014 run ", _jsx("code", { children: "npm run seed:all-states" }), " first."] })) : (_jsx("div", { className: "h-72", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(LineChart, { data: chartData, children: [_jsx(XAxis, { dataKey: "date", tick: { fontSize: 10 } }), _jsx(YAxis, { tick: { fontSize: 10 }, tickFormatter: (v) => `₹${v}` }), _jsx(Tooltip, { formatter: (v) => [`₹${v.toLocaleString("en-IN")}`, ""] }), _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "primary", stroke: "#185FA5", dot: false, strokeWidth: 2.5, name: selectedDistrictName ?? selectedStateName ?? "National" }), selectedDistrictCode && selectedStateCode && (_jsx(Line, { type: "monotone", dataKey: "state", stroke: "#f59e0b", dot: false, strokeWidth: 1.5, strokeDasharray: "5 3", name: selectedStateName ?? "State avg" })), activeRegion !== "national" && (_jsx(Line, { type: "monotone", dataKey: "national", stroke: "#94a3b8", dot: false, strokeWidth: 1, strokeDasharray: "3 3", name: "National" }))] }) }) })), _jsxs("div", { className: "mt-6 rounded-xl border border-slate-200 p-4 dark:border-slate-700", children: [_jsx("h4", { className: "mb-3 text-sm font-semibold", children: _jsx(TransText, { text: "Fair Cost Estimator" }) }), _jsxs("div", { className: "grid grid-cols-1 gap-2 md:grid-cols-4", children: [_jsxs("select", { value: projectType, onChange: (e) => setProjectType(e.target.value), className: "rounded border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950", children: [_jsx("option", { value: "road", children: "road" }), _jsx("option", { value: "bridge", children: "bridge" }), _jsx("option", { value: "building", children: "building" }), _jsx("option", { value: "drainage", children: "drainage" })] }), _jsx("input", { value: lengthKm, onChange: (e) => setLengthKm(e.target.value), className: "rounded border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950", placeholder: "Length (km)" })] }), benchmarkQuery.isLoading ? _jsx("div", { className: "skeleton mt-4 h-20" }) : null, benchmarkQuery.isError ? (_jsx("p", { className: "mt-4 text-sm text-casper-red", children: "Unable to load benchmark. Check backend." })) : benchmarkQuery.data ? (_jsxs("div", { className: "mt-4 space-y-3 text-sm", children: [_jsxs("p", { className: "text-slate-500", children: [benchmarkQuery.data.projectType, " \u2022 ", benchmarkQuery.data.region, " \u2022 ", benchmarkQuery.data.lengthKm, " km"] }), _jsx("p", { className: "text-3xl font-bold", children: formatCrore(benchmarkQuery.data.estimatedCostINR) }), _jsx("div", { className: "grid grid-cols-1 gap-2 md:grid-cols-2", children: [
                                                    ["Materials", benchmarkQuery.data.breakdown.rawMaterials],
                                                    ["Labour & equipment", benchmarkQuery.data.breakdown.labourAndEquipment],
                                                    ["Profit", benchmarkQuery.data.breakdown.contractorProfit],
                                                    ["Contingency", benchmarkQuery.data.breakdown.contingency],
                                                    ["GST", benchmarkQuery.data.breakdown.gst]
                                                ].map(([label, value]) => (_jsxs("div", { className: "flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950", children: [_jsx("span", { className: "text-xs text-slate-500", children: label }), _jsx("span", { className: "text-xs font-semibold", children: formatCrore(value) })] }, label))) }), _jsxs("div", { children: [_jsxs("p", { className: "text-xs text-slate-500", children: ["Confidence ", (benchmarkQuery.data.confidence * 100).toFixed(0), "%"] }), _jsx("div", { className: "mt-2 h-2 w-full rounded bg-slate-200 dark:bg-slate-800", children: _jsx("div", { className: "h-full rounded bg-casper-green", style: { width: `${Math.round(benchmarkQuery.data.confidence * 100)}%` } }) })] }), benchmarkQuery.data.comparableProjects.length > 0 && (_jsxs("div", { className: "pt-2", children: [_jsx("p", { className: "text-xs text-slate-500", children: "Comparable projects (World Bank)" }), _jsx("ul", { className: "mt-1 space-y-1", children: benchmarkQuery.data.comparableProjects.map((p) => (_jsxs("li", { className: "text-xs text-slate-700 dark:text-slate-200", children: [p.name, " \u2022 ", formatCrore(p.costINR), " \u2022 ", p.year] }, `${p.name}-${p.year}`))) })] }))] })) : (_jsx("p", { className: "mt-4 text-sm text-slate-500", children: "Enter inputs to estimate fair cost." }))] })] })] })] }));
};
