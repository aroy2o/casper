import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useGetSimilarTendersQuery } from "./auditsApi";
import { formatCrore, formatDate } from "../../utils/format";
const similarityColor = (score) => {
    if (score >= 75)
        return "text-emerald-600 bg-emerald-50";
    if (score >= 50)
        return "text-yellow-600 bg-yellow-50";
    return "text-slate-600 bg-slate-100";
};
const riskColor = (level) => {
    if (level === "critical" || level === "high")
        return "text-red-600";
    if (level === "medium")
        return "text-yellow-600";
    return "text-emerald-600";
};
export function SimilarTendersTab({ tenderId, tender }) {
    const { data, isLoading, isError } = useGetSimilarTendersQuery({ tenderId, limit: 10 });
    if (isLoading) {
        return (_jsx("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-900", children: _jsxs("div", { className: "flex items-center gap-3 text-slate-500", children: [_jsx("span", { className: "h-4 w-4 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" }), "Finding similar historical tenders\u2026"] }) }));
    }
    if (isError || !data) {
        return (_jsx("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900", children: "Unable to load similar tenders. The tender may not have enough data for comparison." }));
    }
    const { results, explanationCard } = data;
    if (results.length === 0) {
        return (_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h2", { className: "text-lg font-semibold mb-2", children: "Similar Tenders" }), _jsxs("p", { className: "text-sm text-slate-500", children: ["No comparable historical tenders found for this ", tender.projectType ?? "project", " in the database yet. Add more tenders to enable comparison."] })] }));
    }
    return (_jsx("div", { className: "space-y-4", children: _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Similar Tender Comparison" }), _jsxs("p", { className: "mt-1 text-xs text-slate-500", children: ["Top ", results.length, " historical tenders matched by project type, region, and time proximity."] }), explanationCard && (_jsxs("div", { className: "mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300", children: [_jsx("span", { className: "mr-2 font-semibold", children: "Analysis:" }), explanationCard] })), _jsx("div", { className: "mt-4 overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700", children: [_jsx("th", { className: "pb-2 pr-4", children: "Tender" }), _jsx("th", { className: "pb-2 pr-4", children: "Region" }), _jsx("th", { className: "pb-2 pr-4", children: "Date" }), _jsx("th", { className: "pb-2 pr-4", children: "Cost" }), _jsx("th", { className: "pb-2 pr-4", children: "Deviation" }), _jsx("th", { className: "pb-2 pr-4", children: "Risk" }), _jsx("th", { className: "pb-2", children: "Match" })] }) }), _jsx("tbody", { children: results.map((r) => (_jsxs("tr", { className: "border-b border-slate-100 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-800/30", children: [_jsxs("td", { className: "py-3 pr-4", children: [_jsx("div", { className: "font-medium text-slate-900 dark:text-slate-100 max-w-[200px] truncate", title: r.title, children: r.title }), _jsx("div", { className: "text-xs text-slate-400 font-mono", children: r.tenderNumber }), r.vendorName && _jsx("div", { className: "text-xs text-slate-500 truncate max-w-[200px]", children: r.vendorName })] }), _jsxs("td", { className: "py-3 pr-4 text-slate-700 dark:text-slate-300 whitespace-nowrap", children: [_jsx("div", { children: r.state }), r.district && _jsx("div", { className: "text-xs text-slate-400", children: r.district })] }), _jsx("td", { className: "py-3 pr-4 text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs", children: r.publishedDate ? formatDate(r.publishedDate) : "—" }), _jsx("td", { className: "py-3 pr-4 whitespace-nowrap font-mono text-xs text-slate-800 dark:text-slate-200", children: r.totalEstimatedCostINR > 0 ? formatCrore(r.totalEstimatedCostINR) : "—" }), _jsx("td", { className: "py-3 pr-4 whitespace-nowrap", children: r.deviationVsTarget !== null ? (_jsxs("span", { className: `text-xs font-semibold ${r.deviationVsTarget > 0 ? "text-red-600" : "text-emerald-600"}`, children: [r.deviationVsTarget > 0 ? "+" : "", r.deviationVsTarget, "%"] })) : "—" }), _jsx("td", { className: "py-3 pr-4 whitespace-nowrap", children: r.audit ? (_jsxs("div", { children: [_jsx("span", { className: `text-xs font-semibold capitalize ${riskColor(r.audit.riskLevel)}`, children: r.audit.riskLevel }), _jsxs("div", { className: "text-xs text-slate-400", children: [r.audit.overallInflationPct.toFixed(1), "% inflation"] })] })) : (_jsx("span", { className: "text-xs text-slate-400", children: r.status })) }), _jsx("td", { className: "py-3", children: _jsxs("span", { className: `rounded-full px-2 py-1 text-xs font-semibold ${similarityColor(r.similarityScore)}`, children: [r.similarityScore, "%"] }) })] }, r._id))) })] }) }), _jsx("p", { className: "mt-3 text-xs text-slate-400", children: "Similarity score factors: project type (35pt), state (25pt), district (20pt), date proximity (20pt), cost range (15pt)." })] }) }));
}
