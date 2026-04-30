import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const StatCard = ({ label, value, subtext, trend }) => {
    const trendClass = trend === undefined ? "" : trend >= 0 ? "text-casper-green" : "text-casper-red";
    return (_jsxs("article", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("p", { className: "text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400", children: label }), _jsx("p", { className: "mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100", children: value }), subtext ? _jsx("p", { className: "mt-1 text-sm text-slate-600 dark:text-slate-300", children: subtext }) : null, trend !== undefined ? (_jsx("p", { className: `mt-3 text-xs font-semibold ${trendClass}`, children: trend >= 0 ? `+${trend.toFixed(1)}%` : `${trend.toFixed(1)}%` })) : null] }));
};
