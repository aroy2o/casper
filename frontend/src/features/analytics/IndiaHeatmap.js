import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useAppSelector, useAppDispatch } from "../../app/hooks";
import { setRegion, setItem, setDeviationThreshold } from "./analyticsSlice";
import { useGetHeatmapQuery } from "./analyticsApi";
const ITEM_OPTIONS = [
    { value: "cement", label: "Cement" }, { value: "steel_rod", label: "Steel Rod" },
    { value: "coarse_sand", label: "Sand (Coarse)" }, { value: "fine_sand", label: "Sand (Fine)" },
    { value: "aggregate_20mm", label: "Aggregate" }, { value: "brick", label: "Brick" },
    { value: "bitumen", label: "Bitumen" }, { value: "rcc_pipe", label: "RCC Pipe" }
];
function deviationColor(dev, threshold) {
    if (dev === null)
        return "bg-slate-100 dark:bg-slate-800 text-slate-400";
    if (dev > threshold * 2)
        return "bg-red-600 text-white";
    if (dev > threshold)
        return "bg-red-400 text-white";
    if (dev > threshold / 2)
        return "bg-orange-300 text-slate-900";
    if (dev > 0)
        return "bg-yellow-200 text-slate-900";
    if (dev > -threshold / 2)
        return "bg-green-200 text-slate-900";
    return "bg-green-400 text-white";
}
function deviationBg(dev, threshold) {
    if (dev === null)
        return "#f1f5f9";
    if (dev > threshold * 2)
        return "#dc2626";
    if (dev > threshold)
        return "#f87171";
    if (dev > threshold / 2)
        return "#fdba74";
    if (dev > 0)
        return "#fde68a";
    if (dev > -threshold / 2)
        return "#bbf7d0";
    return "#4ade80";
}
const StateCard = ({ entry, threshold, onClick }) => {
    const colorClass = deviationColor(entry.deviationPct, threshold);
    return (_jsxs("button", { type: "button", onClick: onClick, title: `${entry.stateName}\n₹${entry.avgPriceINR?.toLocaleString("en-IN") ?? "N/A"}\n${entry.deviationPct !== null ? (entry.deviationPct > 0 ? "+" : "") + entry.deviationPct + "% vs median" : "No data"}`, className: `flex flex-col items-center justify-center rounded-xl p-3 text-center transition-transform hover:scale-105 active:scale-95 ${colorClass}`, children: [_jsx("span", { className: "text-[10px] font-bold", children: entry.stateCode }), _jsx("span", { className: "mt-0.5 hidden text-[9px] opacity-80 sm:block truncate w-full", children: entry.stateName.split(" ")[0] }), entry.deviationPct !== null && (_jsxs("span", { className: "mt-1 text-[10px] font-semibold", children: [entry.deviationPct > 0 ? "+" : "", entry.deviationPct, "%"] }))] }));
};
const DistrictCard = ({ entry, threshold }) => {
    const colorClass = deviationColor(entry.deviationPct, threshold);
    return (_jsxs("div", { title: `${entry.districtName}\n₹${entry.avgPriceINR?.toLocaleString("en-IN") ?? "N/A"}\n${entry.deviationPct !== null ? (entry.deviationPct > 0 ? "+" : "") + entry.deviationPct + "% vs median" : "No data"}`, className: `flex flex-col items-center justify-center rounded-xl p-3 text-center ${colorClass}`, children: [_jsx("span", { className: "text-xs font-semibold truncate w-full", children: entry.districtName }), entry.deviationPct !== null && (_jsxs("span", { className: "text-[10px] font-medium mt-0.5", children: [entry.deviationPct > 0 ? "+" : "", entry.deviationPct, "%"] })), entry.avgPriceINR !== null && (_jsxs("span", { className: "text-[9px] opacity-70 mt-0.5", children: ["\u20B9", entry.avgPriceINR.toLocaleString("en-IN")] }))] }));
};
const ColorScale = () => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-[10px] text-slate-400", children: "Fair" }), _jsx("div", { className: "flex h-3 w-32 overflow-hidden rounded-full", children: ["#4ade80", "#bbf7d0", "#fde68a", "#fdba74", "#f87171", "#dc2626"].map((c) => (_jsx("div", { className: "flex-1", style: { background: c } }, c))) }), _jsx("span", { className: "text-[10px] text-slate-400", children: "Overpriced" })] }));
export const IndiaHeatmap = () => {
    const dispatch = useAppDispatch();
    const { selectedStateCode, selectedStateName, selectedItem, deviationThreshold } = useAppSelector((s) => s.analytics);
    const [hoveredState, setHoveredState] = useState(null);
    const heatmapParams = {
        item: selectedItem,
        ...(selectedStateCode ? { state: selectedStateCode } : {})
    };
    const { data: heatmap, isLoading } = useGetHeatmapQuery(heatmapParams);
    const handleStateClick = (entry) => {
        if (selectedStateCode === entry.stateCode) {
            dispatch(setRegion({ stateCode: null, stateName: null }));
        }
        else {
            dispatch(setRegion({ stateCode: entry.stateCode, stateName: entry.stateName }));
        }
    };
    const sortedStates = [...(heatmap?.states ?? [])].sort((a, b) => (b.deviationPct ?? -999) - (a.deviationPct ?? -999));
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-xs font-medium text-slate-500", children: "Material" }), _jsx("select", { value: selectedItem, onChange: (e) => dispatch(setItem(e.target.value)), className: "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100", children: ITEM_OPTIONS.map((o) => _jsx("option", { value: o.value, children: o.label }, o.value)) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("label", { className: "text-xs font-medium text-slate-500", children: ["Flag threshold: ", deviationThreshold, "%"] }), _jsx("input", { type: "range", min: 5, max: 50, step: 5, value: deviationThreshold, onChange: (e) => dispatch(setDeviationThreshold(Number(e.target.value))), className: "w-24" })] }), _jsx(ColorScale, {})] }), _jsxs("div", { className: "flex gap-4", children: [_jsx("div", { className: "flex-1 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900", children: selectedStateCode ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mb-3 flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => dispatch(setRegion({ stateCode: null, stateName: null })), className: "flex items-center gap-1 text-xs font-medium text-casper-blue hover:underline", children: "\u2190 All India" }), _jsx("span", { className: "text-slate-300 dark:text-slate-700", children: "\u203A" }), _jsx("span", { className: "text-sm font-semibold text-slate-700 dark:text-slate-200", children: selectedStateName }), _jsx("span", { className: "rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800", children: "District View" })] }), isLoading && (_jsx("div", { className: "flex h-48 items-center justify-center", children: _jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" }) })), !isLoading && (_jsx("div", { className: "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6", children: (heatmap?.districts ?? []).map((d) => (_jsx(DistrictCard, { entry: d, threshold: deviationThreshold }, d.districtCode))) }))] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold text-slate-700 dark:text-slate-200", children: "All India \u2014 Click a state to drill down" }), heatmap?.median ? (_jsxs("span", { className: "text-xs text-slate-500", children: ["National median: ", _jsxs("strong", { children: ["\u20B9", heatmap.median.toLocaleString("en-IN")] })] })) : null] }), isLoading && (_jsx("div", { className: "flex h-48 items-center justify-center", children: _jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" }) })), !isLoading && (_jsx("div", { className: "grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8", children: sortedStates.map((s) => (_jsx(StateCard, { entry: s, threshold: deviationThreshold, onClick: () => handleStateClick(s) }, s.stateCode))) }))] })) }), _jsxs("div", { className: "hidden w-64 flex-shrink-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:block", children: [_jsx("h3", { className: "mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500", children: selectedStateCode ? "Districts by Deviation" : "States by Deviation" }), _jsx("div", { className: "space-y-1.5 max-h-[480px] overflow-y-auto", children: (selectedStateCode ? heatmap?.districts ?? [] : sortedStates).map((entry, i) => {
                                    const name = "stateName" in entry ? entry.stateName : entry.districtName;
                                    const dev = entry.deviationPct;
                                    const avg = entry.avgPriceINR;
                                    return (_jsxs("div", { className: "flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("span", { className: "h-3 w-3 rounded-sm flex-shrink-0", style: { background: deviationBg(dev, deviationThreshold) } }), _jsx("span", { className: "truncate text-xs text-slate-700 dark:text-slate-300", children: name })] }), _jsx("div", { className: "flex-shrink-0 text-right", children: dev !== null ? (_jsxs("span", { className: `text-xs font-semibold ${dev > 0 ? "text-red-600" : "text-green-600"}`, children: [dev > 0 ? "+" : "", dev, "%"] })) : (_jsx("span", { className: "text-xs text-slate-300", children: "\u2014" })) })] }, i));
                                }) })] })] }), hoveredState && (_jsxs("div", { className: "rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("p", { className: "font-semibold", children: hoveredState.stateName }), _jsxs("p", { className: "text-sm", children: ["\u20B9", hoveredState.avgPriceINR?.toLocaleString("en-IN") ?? "N/A"] }), _jsx("p", { className: "text-sm", children: hoveredState.deviationPct !== null ? `${hoveredState.deviationPct > 0 ? "+" : ""}${hoveredState.deviationPct}% vs median` : "No data" })] }))] }));
};
