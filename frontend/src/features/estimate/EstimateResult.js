import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useCompareWithTenderMutation } from "./estimateApi";
import { formatCrore } from "../../utils/format";
import { showToast } from "../../utils/toast";
const BREAKDOWN_COLORS = ["#1e3a5f", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#f59e0b", "#ef4444", "#6b7280"];
const BREAKDOWN_LABELS = {
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
function crToINR(cr) {
    return cr * 1e7;
}
function ConfidenceBadge({ level, pct }) {
    const cls = level === "High"
        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
        : level === "Medium"
            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    return (_jsxs("span", { className: `inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${cls}`, children: [level, " Confidence \u00B7 ", pct, "%"] }));
}
function SeverityBadge({ severity }) {
    const cls = severity === "High"
        ? "text-red-600 dark:text-red-400"
        : severity === "Medium"
            ? "text-amber-600 dark:text-amber-400"
            : "text-green-600 dark:text-green-400";
    return _jsx("span", { className: `font-semibold ${cls}`, children: severity });
}
function FlagBadge({ flag }) {
    const cls = flag === "GREEN"
        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
        : flag === "AMBER"
            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    return _jsx("span", { className: `inline-block rounded-full px-3 py-0.5 text-xs font-bold ${cls}`, children: flag });
}
function TenderCompare({ estimateId, fairTotal, existingComparison }) {
    const [amount, setAmount] = useState("");
    const [result, setResult] = useState(existingComparison);
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
        }
        catch {
            showToast("error", "Comparison failed");
        }
    };
    return (_jsxs("div", { className: "space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h3", { className: "text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400", children: "Compare with Tender Quote" }), _jsxs("div", { className: "flex gap-3", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx("span", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400", children: "\u20B9" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: amount, onChange: (e) => setAmount(e.target.value), placeholder: "Enter tender quoted amount in Crore", className: "w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm focus:border-casper-blue focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" })] }), _jsx("button", { onClick: handleCompare, disabled: isLoading, className: "rounded-lg bg-casper-blue px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60", children: isLoading ? "Analysing…" : "Analyse" })] }), _jsxs("p", { className: "text-xs text-slate-500", children: ["Fair estimate: ", formatCrore(crToINR(fairTotal))] }), result && (_jsxs("div", { className: "mt-4 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500", children: "Tender Quote" }), _jsx("p", { className: "text-xl font-bold", children: formatCrore(crToINR(result.tender_quoted_cr)) })] }), _jsx("div", { className: "text-2xl text-slate-400", children: "vs" }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500", children: "Fair Estimate" }), _jsx("p", { className: "text-xl font-bold", children: formatCrore(crToINR(fairTotal)) })] }), _jsxs("div", { className: "ml-auto", children: [_jsx("p", { className: "text-xs text-slate-500", children: "Variance" }), _jsxs("p", { className: `text-xl font-bold ${result.variance_pct > 0 ? "text-red-600" : "text-green-600"}`, children: [result.variance_pct > 0 ? "+" : "", result.variance_pct.toFixed(1), "%"] })] }), _jsx(FlagBadge, { flag: result.flag })] }), _jsx("div", { className: "rounded-lg bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300", children: result.anomaly_analysis }), result.cost_head_comparison.length > 0 && (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200 dark:border-slate-700", children: [_jsx("th", { className: "pb-2 text-left text-xs font-semibold uppercase text-slate-500", children: "Cost Head" }), _jsx("th", { className: "pb-2 text-right text-xs font-semibold uppercase text-slate-500", children: "Fair" }), _jsx("th", { className: "pb-2 text-right text-xs font-semibold uppercase text-slate-500", children: "Tender" }), _jsx("th", { className: "pb-2 text-right text-xs font-semibold uppercase text-slate-500", children: "Variance" })] }) }), _jsx("tbody", { children: result.cost_head_comparison.map((row) => (_jsxs("tr", { className: `border-b border-slate-100 dark:border-slate-800 ${row.suspicious ? "bg-red-50 dark:bg-red-900/10" : ""}`, children: [_jsxs("td", { className: "py-2 font-medium", children: [row.suspicious && _jsx("span", { className: "mr-1 text-red-500", children: "\u26A0" }), row.head] }), _jsx("td", { className: "py-2 text-right", children: formatCrore(crToINR(row.fair_cr)) }), _jsx("td", { className: "py-2 text-right", children: formatCrore(crToINR(row.tender_cr)) }), _jsxs("td", { className: `py-2 text-right font-semibold ${row.variance_pct > 20 ? "text-red-600" : row.variance_pct > 10 ? "text-amber-600" : "text-slate-600 dark:text-slate-300"}`, children: [row.variance_pct > 0 ? "+" : "", row.variance_pct.toFixed(1), "%"] })] }, row.head))) })] }) }))] }))] }));
}
export function EstimateResult({ estimate }) {
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
        assumptions: [],
        risk_factors: [],
        comparable_projects: [],
        anomaly_flags: [],
        region_adjustment: { state: "", multiplier: 1, reason: "" }
    };
    const r = {
        ...defaultAires,
        ...(estimate.ai_result ?? {}),
        cost_breakdown: { ...defaultCostBreakdown, ...(estimate.ai_result?.cost_breakdown ?? {}) },
        assumptions: estimate.ai_result?.assumptions ?? [],
        risk_factors: estimate.ai_result?.risk_factors ?? [],
        comparable_projects: estimate.ai_result?.comparable_projects ?? [],
        anomaly_flags: estimate.ai_result?.anomaly_flags ?? [],
        region_adjustment: estimate.ai_result?.region_adjustment ?? defaultAires.region_adjustment
    };
    const bd = r.cost_breakdown;
    const chartData = Object.entries(BREAKDOWN_LABELS).map(([key, label]) => ({
        name: label,
        value: bd[key] ?? 0
    })).filter((d) => d.value > 0);
    const handleDownloadPdf = () => {
        const apiBase = import.meta.env?.VITE_API_URL ?? "http://localhost:4000";
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
        }
        else {
            a.click();
        }
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "relative overflow-hidden rounded-xl bg-[#1e3a5f] px-8 py-6 text-white shadow-lg", children: [_jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium uppercase tracking-widest text-blue-300", children: "Fair Cost Estimate" }), _jsx("p", { className: "mt-1 text-5xl font-bold tracking-tight", children: formatCrore(crToINR(r.total_cost_cr)) }), _jsxs("p", { className: "mt-1 text-xs text-blue-200", children: [formatCrore(crToINR(r.unit_rate.value)), " ", r.unit_rate.unit, " \u00B7 ", r.sor_reference] }), estimate.ml_estimate_cr && (_jsxs("p", { className: "mt-1 text-xs text-blue-300", children: ["ML Baseline: ", formatCrore(crToINR(estimate.ml_estimate_cr))] }))] }), _jsxs("div", { className: "flex flex-col items-start gap-2 sm:items-end", children: [_jsx(ConfidenceBadge, { level: r.confidence_level, pct: r.confidence_pct }), _jsxs("p", { className: "text-xs text-blue-300", children: [estimate.project_type, " \u00B7 ", estimate.district, ", ", estimate.state] }), _jsxs("p", { className: "text-xs text-blue-300", children: ["Model: ", estimate.claude_model_used] })] })] }), _jsx("div", { className: "pointer-events-none absolute inset-0 opacity-5", style: { backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 23px,#fff 23px,#fff 24px),repeating-linear-gradient(90deg,transparent,transparent 23px,#fff 23px,#fff 24px)" } })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("button", { onClick: handleDownloadPdf, className: "flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800", children: [_jsx("svg", { viewBox: "0 0 24 24", className: "h-4 w-4 fill-none stroke-current stroke-2", children: _jsx("path", { d: "M12 16v-8m0 8-3-3m3 3 3-3M4 20h16M8 4H4v16h16V4h-4" }) }), "Download PDF Report"] }), _jsxs("span", { className: "flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-800", children: ["Estimate ID: ", _jsx("code", { className: "font-mono text-casper-blue", children: estimate._id })] })] }), r.anomaly_flags.length > 0 && (_jsx("div", { className: "space-y-2", children: r.anomaly_flags.map((flag, i) => (_jsxs("div", { className: "flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300", children: [_jsx("span", { className: "mt-0.5 text-base leading-none", children: "\u26A0" }), _jsx("span", { children: flag })] }, i))) })), _jsxs("div", { className: "rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h3", { className: "mb-4 text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400", children: "Cost Breakdown" }), _jsx("div", { className: "mb-4 h-64", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: chartData, layout: "vertical", margin: { left: 8, right: 32, top: 0, bottom: 0 }, children: [_jsx(CartesianGrid, { horizontal: false, strokeDasharray: "3 3", stroke: "#e2e8f0" }), _jsx(XAxis, { type: "number", tick: { fontSize: 10 }, tickFormatter: (v) => formatCrore(crToINR(v)) }), _jsx(YAxis, { type: "category", dataKey: "name", width: 110, tick: { fontSize: 10 } }), _jsx(Tooltip, { formatter: (v) => [formatCrore(crToINR(v)), "Amount"], contentStyle: { fontSize: 12, borderRadius: 8 } }), _jsx(Bar, { dataKey: "value", radius: [0, 4, 4, 0], children: chartData.map((_, i) => (_jsx(Cell, { fill: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length] }, i))) })] }) }) }), _jsx("div", { className: "grid grid-cols-2 gap-2 sm:grid-cols-4", children: chartData.map((d, i) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "inline-block h-3 w-3 flex-shrink-0 rounded-sm", style: { background: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length] } }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500", children: d.name }), _jsx("p", { className: "text-xs font-semibold", children: formatCrore(crToINR(d.value)) })] })] }, d.name))) })] }), _jsxs("div", { className: "rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm dark:border-blue-900 dark:bg-blue-900/20", children: [_jsx("span", { className: "font-semibold text-blue-800 dark:text-blue-300", children: "Region Adjustment: " }), _jsxs("span", { className: "text-blue-700 dark:text-blue-400", children: [r.region_adjustment.state, " \u00D7 ", r.region_adjustment.multiplier, " \u2014 ", r.region_adjustment.reason] })] }), r.risk_factors.length > 0 && (_jsxs("div", { className: "rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900", children: [_jsx("div", { className: "border-b border-slate-200 px-6 py-4 dark:border-slate-800", children: _jsx("h3", { className: "text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400", children: "Risk Factors" }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 dark:bg-slate-800", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500", children: "Factor" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500", children: "Impact" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500", children: "Severity" })] }) }), _jsx("tbody", { children: r.risk_factors.map((rf, i) => (_jsxs("tr", { className: "border-t border-slate-100 dark:border-slate-800", children: [_jsx("td", { className: "px-6 py-3 font-medium text-slate-900 dark:text-white", children: rf.factor }), _jsx("td", { className: "px-6 py-3 text-slate-600 dark:text-slate-400", children: rf.impact }), _jsx("td", { className: "px-6 py-3", children: _jsx(SeverityBadge, { severity: rf.severity }) })] }, i))) })] }) })] })), r.assumptions.length > 0 && (_jsxs("div", { className: "rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900", children: [_jsxs("button", { type: "button", onClick: () => setAssumptionsOpen((o) => !o), className: "flex w-full items-center justify-between px-6 py-4 text-left", children: [_jsxs("h3", { className: "text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400", children: ["Assumptions (", r.assumptions.length, ")"] }), _jsx("svg", { viewBox: "0 0 24 24", className: `h-4 w-4 fill-none stroke-current stroke-2 transition-transform ${assumptionsOpen ? "rotate-180" : ""}`, children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), assumptionsOpen && (_jsx("div", { className: "border-t border-slate-100 px-6 py-4 dark:border-slate-800", children: _jsx("ul", { className: "space-y-1.5 text-sm text-slate-700 dark:text-slate-300", children: r.assumptions.map((a, i) => (_jsxs("li", { className: "flex gap-2", children: [_jsx("span", { className: "mt-0.5 text-slate-400", children: "\u2022" }), _jsx("span", { children: a })] }, i))) }) }))] })), r.comparable_projects.length > 0 && (_jsxs("div", { className: "rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900", children: [_jsx("div", { className: "border-b border-slate-200 px-6 py-4 dark:border-slate-800", children: _jsx("h3", { className: "text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400", children: "Comparable Projects" }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-50 dark:bg-slate-800", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500", children: "Project" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500", children: "Location" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500", children: "Year" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500", children: "Cost (\u20B9 Cr)" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500", children: "Source" })] }) }), _jsx("tbody", { children: r.comparable_projects.map((p, i) => (_jsxs("tr", { className: "border-t border-slate-100 dark:border-slate-800", children: [_jsx("td", { className: "px-6 py-3 font-medium text-slate-900 dark:text-white", children: p.name }), _jsx("td", { className: "px-6 py-3 text-slate-600 dark:text-slate-400", children: p.location }), _jsx("td", { className: "px-6 py-3 text-slate-600 dark:text-slate-400", children: p.year }), _jsx("td", { className: "px-6 py-3 text-right font-semibold", children: formatCrore(crToINR(p.cost_cr)) }), _jsx("td", { className: "px-6 py-3 text-xs text-slate-500", children: p.source })] }, i))) })] }) })] })), _jsx(TenderCompare, { estimateId: estimate._id, fairTotal: estimate.total_cost_cr, existingComparison: estimate.tender_comparison })] }));
}
