import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { TrendDashboard } from "../features/analytics/TrendDashboard";
import { PredictionPanel } from "../features/analytics/PredictionPanel";
import { CollusionPanel } from "../features/analytics/CollusionPanel";
import { IndiaHeatmap } from "../features/analytics/IndiaHeatmap";
import { useAppSelector } from "../app/hooks";
import { TransText } from "../components/TransText";
import { useGetVendorNetworkQuery } from "../features/analytics/analyticsApi";
import { VendorNetworkGraph } from "../features/analytics/VendorNetworkGraph";
const TABS = [
    {
        id: "trends",
        label: "Trend Analysis",
        icon: "M4 17 9 12l4 4 7-9",
        description: "Price inflation trends across all states and districts"
    },
    {
        id: "heatmap",
        label: "Regional Heatmap",
        icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z",
        description: "Visual price deviation map — click to drill down"
    },
    {
        id: "predictions",
        label: "Price Forecasts",
        icon: "M2 12h4l3-9 4 18 3-9h4",
        description: "ML-powered next-month fair price predictions"
    },
    {
        id: "collusion",
        label: "Bid Pattern Analysis",
        icon: "M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z",
        description: "Collusion detection and vendor risk registry"
    },
    {
        id: "network",
        label: "Collusion Network",
        icon: "M4 12a2 2 0 1 0 0.001 0zM20 6a2 2 0 1 0 0.001 0zM20 18a2 2 0 1 0 0.001 0zM6 12h10M18.3 7.2l-12.6 9.6",
        description: "Interactive vendor network and cartel ring visualization"
    }
];
export const Analytics = () => {
    const [activeTab, setActiveTab] = useState("trends");
    const { data: network, isFetching: loadingNetwork } = useGetVendorNetworkQuery({ minScore: 0, limit: 80 }, { skip: activeTab !== "network" });
    const { selectedStateName, selectedDistrictName, selectedItem } = useAppSelector((s) => s.analytics);
    const scopeLabel = selectedDistrictName
        ? `${selectedDistrictName}, ${selectedStateName}`
        : selectedStateName
            ? selectedStateName
            : "Pan-India";
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900", children: [_jsxs("svg", { viewBox: "0 0 24 24", className: "h-4 w-4 fill-none stroke-casper-blue stroke-2", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("path", { d: "M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" })] }), _jsxs("span", { className: "text-sm font-medium text-slate-700 dark:text-slate-200", children: [_jsx(TransText, { text: "Scope" }), ": ", _jsx("span", { className: "text-casper-blue", children: scopeLabel })] }), _jsx("span", { className: "text-slate-300 dark:text-slate-700", children: "\u00B7" }), _jsxs("span", { className: "text-sm text-slate-500 dark:text-slate-400", children: [_jsx(TransText, { text: "Material" }), ": ", _jsx("span", { className: "font-medium text-slate-700 dark:text-slate-200", children: selectedItem })] }), _jsx("span", { className: "ml-auto text-xs text-slate-400 dark:text-slate-500", children: _jsx(TransText, { text: "Use the Region Selector in the header to change scope" }) })] }), _jsx("div", { className: "grid grid-cols-2 gap-2 md:grid-cols-4", children: TABS.map((tab) => (_jsxs("button", { type: "button", onClick: () => setActiveTab(tab.id), className: `flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all ${activeTab === tab.id
                        ? "border-casper-blue bg-casper-blue/5 dark:border-casper-blue dark:bg-casper-blue/10"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"}`, children: [_jsxs("div", { className: `flex items-center gap-2 ${activeTab === tab.id ? "text-casper-blue" : "text-slate-500 dark:text-slate-400"}`, children: [_jsx("svg", { viewBox: "0 0 24 24", className: "h-4 w-4 fill-none stroke-current stroke-2", children: _jsx("path", { d: tab.icon }) }), _jsx("span", { className: "text-xs font-semibold", children: tab.label })] }), _jsx("p", { className: "text-[11px] text-slate-400 dark:text-slate-500 leading-snug hidden md:block", children: tab.description })] }, tab.id))) }), _jsxs("div", { children: [activeTab === "trends" && _jsx(TrendDashboard, {}), activeTab === "heatmap" && _jsx(IndiaHeatmap, {}), activeTab === "predictions" && _jsx(PredictionPanel, {}), activeTab === "collusion" && _jsx(CollusionPanel, {}), activeTab === "network" && (_jsxs(_Fragment, { children: [loadingNetwork && _jsx("div", { className: "skeleton h-[480px]" }), !loadingNetwork && network && network.nodes.length === 0 && (_jsx("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900", children: "No vendor network data available yet." })), !loadingNetwork && network && network.nodes.length > 0 && _jsx(VendorNetworkGraph, { data: network })] }))] })] }));
};
