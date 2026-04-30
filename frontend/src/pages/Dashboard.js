import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
export const Dashboard = () => {
    const { selectedStateCode, selectedStateName, selectedDistrictCode, selectedDistrictName } = useAppSelector((s) => s.analytics);
    const activeRegion = selectedStateCode ?? "national";
    const activeLabel = selectedDistrictName ?? selectedStateName ?? null;
    const { data: auditSummary, isLoading: summaryLoading } = useGetAuditSummaryQuery();
    const { data: tenders, isLoading: tendersLoading } = useGetTendersQuery({ limit: 8, status: "flagged,clean" });
    const distArg = selectedDistrictCode ? { districtCode: selectedDistrictCode } : {};
    const { data: cementHistory, isLoading: cementLoading, isError: cementError } = useGetPriceHistoryQuery({ material: "cement", region: activeRegion, ...distArg, days: 90 });
    const { data: steelHistory } = useGetPriceHistoryQuery({ material: "steel_rod", region: activeRegion, ...distArg, days: 90 });
    const { data: nationalCementHistory } = useGetPriceHistoryQuery({ material: "cement", region: "national", days: 90 });
    const { data: nationalSteelHistory } = useGetPriceHistoryQuery({ material: "steel_rod", region: "national", days: 90 });
    const safeTenders = Array.isArray(tenders) ? tenders : [];
    const tenderMetrics = useMemo(() => {
        const totalAudits = safeTenders.length;
        const totalOverpricedINR = safeTenders.reduce((sum, tender) => {
            const tenderOverpriced = tender.lineItems.reduce((lineSum, line) => {
                if (line.marketRateINR === null || line.marketRateINR <= 0)
                    return lineSum;
                return lineSum + Math.max((line.quotedRateINR - line.marketRateINR) * line.quantity, 0);
            }, 0);
            return sum + tenderOverpriced;
        }, 0);
        const inflationValues = safeTenders.flatMap((tender) => tender.lineItems
            .map((line) => {
            if (typeof line.inflationPct === "number")
                return line.inflationPct;
            if (line.marketRateINR === null || line.marketRateINR <= 0)
                return null;
            return ((line.quotedRateINR - line.marketRateINR) / line.marketRateINR) * 100;
        })
            .filter((value) => typeof value === "number"));
        const avgInflationPct = inflationValues.length > 0
            ? inflationValues.reduce((sum, value) => sum + value, 0) / inflationValues.length
            : null;
        const criticalCount = safeTenders.reduce((count, tender) => count + (tender.status === "flagged" ? 1 : 0), 0);
        return { totalAudits, totalOverpricedINR, avgInflationPct, criticalCount };
    }, [safeTenders]);
    const totalAudits = auditSummary?.totalAudits && auditSummary.totalAudits > 0 ? auditSummary.totalAudits : tenderMetrics.totalAudits;
    const totalOverpricedINR = auditSummary?.totalOverpricedINR && auditSummary.totalOverpricedINR > 0 ? auditSummary.totalOverpricedINR : tenderMetrics.totalOverpricedINR;
    const avgInflationPct = auditSummary?.avgInflationPct != null && Number.isFinite(auditSummary.avgInflationPct)
        ? auditSummary.avgInflationPct
        : tenderMetrics.avgInflationPct;
    const criticalCount = auditSummary?.criticalCount != null && auditSummary.criticalCount > 0
        ? auditSummary.criticalCount
        : tenderMetrics.criticalCount;
    const chartData = useMemo(() => {
        const selectedCement = cementHistory?.dataPoints ?? nationalCementHistory?.dataPoints ?? [];
        if (selectedCement.length === 0)
            return [];
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
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("section", { className: "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4", children: [_jsx(StatCard, { label: "Total Audits", value: summaryLoading ? "…" : String(totalAudits) }), _jsx(StatCard, { label: "Total Overpriced", value: summaryLoading ? "…" : formatCrore(totalOverpricedINR) }), _jsx(StatCard, { label: "Average Inflation", value: summaryLoading ? "…" : avgInflationPct != null ? `${avgInflationPct.toFixed(1)}%` : "N/A" }), _jsx(StatCard, { label: "Critical Flags", value: summaryLoading ? "…" : String(criticalCount) })] }), _jsxs("section", { className: "grid grid-cols-1 gap-4 xl:grid-cols-5", children: [_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 xl:col-span-3", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold", children: _jsx(TransText, { text: "90-day Price Trend" }) }), _jsx("span", { className: "text-xs text-slate-500", children: activeLabel ? (_jsx("span", { className: "rounded-full bg-casper-blue/10 px-2 py-0.5 text-casper-blue font-medium", children: activeLabel })) : (_jsx("span", { className: "text-slate-400", children: "All India \u2014 use state selector above to filter" })) })] }), cementLoading ? (_jsx("div", { className: "h-64 animate-pulse rounded-lg bg-slate-800" })) : cementError ? (_jsx("div", { className: "flex h-64 items-center justify-center rounded-xl text-sm text-red-400", children: _jsx(TransText, { text: "Failed to load price data" }) })) : chartData.length > 0 ? (_jsx("div", { style: { width: "100%", height: "300px" }, children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(LineChart, { data: chartData, margin: { top: 5, right: 20, bottom: 5, left: 0 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#334155" }), _jsx(XAxis, { dataKey: "date", tick: { fontSize: 11, fill: "#94a3b8" }, interval: 14 }), _jsx(YAxis, { tick: { fontSize: 11, fill: "#94a3b8" }, tickFormatter: (v) => "₹" + v }), _jsx(Tooltip, { formatter: (value, name) => [
                                                    name === "steel" ? "₹" + (value * 100).toLocaleString("en-IN") + "/t" : "₹" + value + "/bag",
                                                    name === "steel" ? "Steel (÷100)" : "Cement"
                                                ], contentStyle: { background: "#1e293b", border: "1px solid #334155" } }), _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "cement", stroke: "#3b82f6", dot: false, strokeWidth: 2, name: "Cement (\u20B9/bag)" }), _jsx(Line, { type: "monotone", dataKey: "steel", stroke: "#f59e0b", dot: false, strokeWidth: 2, name: "Steel (\u00F7100 \u20B9/t)" })] }) }) })) : (_jsx("div", { className: "flex h-64 flex-col items-center justify-center text-slate-400", children: _jsx("p", { children: _jsx(TransText, { text: "No price data yet" }) }) }))] }), _jsx("div", { className: "xl:col-span-2", children: _jsx(AlertFeed, {}) })] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h3", { className: "mb-3 text-sm font-semibold", children: _jsx(TransText, { text: "Recent Tenders" }) }), tendersLoading ? (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "skeleton h-10" }), _jsx("div", { className: "skeleton h-10" }), _jsx("div", { className: "skeleton h-10" })] })) : safeTenders.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: _jsx(TransText, { text: "No tenders found." }) })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-slate-500", children: [_jsx("th", { className: "py-2", children: "Tender" }), _jsx("th", { children: "Dept" }), _jsx("th", { children: "State" }), _jsx("th", { children: "Cost" }), _jsx("th", { children: "Risk" }), _jsx("th", { children: "Source" }), _jsx("th", { className: "text-right", children: "Action" })] }) }), _jsx("tbody", { children: safeTenders.slice(0, 8).map((tender) => (_jsxs("tr", { className: "border-t border-slate-200 dark:border-slate-800", children: [_jsx("td", { className: "max-w-[260px] truncate py-2", children: tender.title }), _jsx("td", { children: tender.department }), _jsx("td", { className: "capitalize", children: tender.state }), _jsx("td", { children: formatCrore(tender.totalEstimatedCostINR) }), _jsx("td", { children: _jsx(RiskBadge, { riskLevel: tender.status === "clean" ? "clean" : tender.status === "flagged" ? "high" : "pending" }) }), _jsx("td", { children: _jsx(SourceRef, { sourceURL: tender.sourceURL, fetchedAt: tender.parsedAt }) }), _jsx("td", { className: "text-right", children: _jsx(Link, { className: "text-casper-blue hover:underline", to: `/tenders/${tender._id}`, children: "View audit" }) })] }, tender._id))) })] }) }))] })] }));
};
