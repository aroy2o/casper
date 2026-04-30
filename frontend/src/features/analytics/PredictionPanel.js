import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useAppSelector } from "../../app/hooks";
import { useGetPredictionsQuery } from "./analyticsApi";
import { useAppDispatch } from "../../app/hooks";
import { setItem } from "./analyticsSlice";
const ITEM_OPTIONS = [
    { value: "cement", label: "Cement" },
    { value: "steel_rod", label: "Steel Rod (TMT)" },
    { value: "coarse_sand", label: "Coarse Sand" },
    { value: "fine_sand", label: "Fine Sand" },
    { value: "aggregate_20mm", label: "Aggregate 20mm" },
    { value: "brick", label: "Brick" },
    { value: "bitumen", label: "Bitumen VG30" },
    { value: "rcc_pipe", label: "RCC Pipe NP3" }
];
const ConfidenceDot = ({ value }) => {
    const pct = Math.round(value * 100);
    const cls = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-red-400";
    return (_jsxs("span", { className: "flex items-center gap-1 text-xs text-slate-500", children: [_jsx("span", { className: `h-2 w-2 rounded-full ${cls}` }), pct, "% conf."] }));
};
const FallbackBadge = ({ level }) => {
    const map = {
        district: "text-green-700 bg-green-50",
        state: "text-blue-700 bg-blue-50",
        national: "text-slate-600 bg-slate-100"
    };
    return (_jsx("span", { className: `rounded px-1.5 py-0.5 text-[10px] font-medium ${map[level] ?? map.national}`, children: level }));
};
const PredCard = ({ pred }) => {
    const deviation = pred.deviationPct;
    const deviationClass = deviation > 15 ? "text-red-600" : deviation > 5 ? "text-amber-600" : "text-green-600";
    return (_jsxs("div", { className: "rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900", children: [_jsxs("div", { className: "mb-2 flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium text-slate-500 dark:text-slate-400", children: pred.stateCode }), _jsx("p", { className: "text-sm font-semibold text-slate-800 dark:text-slate-100", children: pred.stateName || pred.stateCode })] }), _jsx(FallbackBadge, { level: pred.fallbackLevel })] }), _jsxs("div", { className: "mt-3", children: [_jsxs("p", { className: "text-2xl font-bold text-slate-900 dark:text-white", children: ["\u20B9", pred.predictedPriceINR.toLocaleString("en-IN", { maximumFractionDigits: 0 })] }), _jsxs("p", { className: "text-xs text-slate-400", children: ["predicted for ", pred.forecastMonth] })] }), _jsxs("div", { className: "mt-2 text-xs text-slate-400", children: ["Range: \u20B9", pred.lowerBoundINR.toLocaleString("en-IN", { maximumFractionDigits: 0 }), " \u2013", " ", "\u20B9", pred.upperBoundINR.toLocaleString("en-IN", { maximumFractionDigits: 0 })] }), _jsxs("div", { className: "mt-3 flex items-center justify-between", children: [_jsx(ConfidenceDot, { value: pred.confidence }), _jsxs("span", { className: `text-xs font-semibold ${deviationClass}`, children: [deviation > 0 ? "+" : "", deviation.toFixed(1), "% vs current"] })] })] }));
};
export const PredictionPanel = () => {
    const dispatch = useAppDispatch();
    const { selectedStateCode, selectedDistrictCode, selectedItem } = useAppSelector((s) => s.analytics);
    const predParams = {
        item: selectedItem,
        ...(selectedStateCode ? { state: selectedStateCode } : {}),
        ...(selectedDistrictCode ? { district: selectedDistrictCode } : {})
    };
    const { data: predictions = [], isLoading, isError } = useGetPredictionsQuery(predParams);
    const overThreshold = predictions.filter((p) => p.deviationPct > 15);
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-xs font-medium text-slate-500 dark:text-slate-400", children: "Material" }), _jsx("select", { value: selectedItem, onChange: (e) => dispatch(setItem(e.target.value)), className: "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100", children: ITEM_OPTIONS.map((o) => _jsx("option", { value: o.value, children: o.label }, o.value)) })] }), _jsx("div", { className: "ml-auto text-xs text-slate-500 dark:text-slate-400", children: "Forecast horizon: next calendar month \u00B7 Model: GradientBoostingRegressor" })] }), overThreshold.length > 0 && (_jsxs("div", { className: "flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/20", children: [_jsx("svg", { viewBox: "0 0 24 24", className: "mt-0.5 h-4 w-4 flex-shrink-0 fill-none stroke-amber-600 stroke-2", children: _jsx("path", { d: "M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" }) }), _jsxs("div", { className: "text-sm text-amber-800 dark:text-amber-200", children: [_jsxs("strong", { children: [overThreshold.length, " state", overThreshold.length > 1 ? "s" : ""] }), " forecast price increases", " ", ">15% above current levels:", " ", overThreshold.map((p) => p.stateCode).join(", ")] })] })), isLoading && (_jsxs("div", { className: "flex h-48 items-center justify-center", children: [_jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" }), _jsx("span", { className: "ml-3 text-sm text-slate-500", children: "Computing ML predictions\u2026" })] })), isError && (_jsx("div", { className: "rounded-xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900", children: _jsx("p", { className: "text-sm text-slate-500", children: "ML predictions unavailable \u2014 ensure the ML service is running." }) })), !isLoading && !isError && predictions.length === 0 && (_jsx("div", { className: "rounded-xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900", children: _jsx("p", { className: "text-sm text-slate-500", children: "No predictions available yet. The model is being trained." }) })), !isLoading && predictions.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: ["Showing ", predictions.length, " predicted prices for ", _jsx("strong", { children: selectedItem }), " ", selectedStateCode ? `in ${selectedStateCode}` : "across all Indian states", " \u2014 ", predictions[0]?.forecastMonth ?? ""] }), _jsx("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", children: predictions.map((pred) => (_jsx(PredCard, { pred: pred }, `${pred.stateCode}-${pred.districtCode ?? "state"}`))) })] }))] }));
};
