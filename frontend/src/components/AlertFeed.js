import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { connectAlerts, disconnectAlerts, markAllRead } from "../features/alerts/alertsSlice";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { formatDate } from "../utils/format";
const borderClass = {
    new_tender_flagged: "border-casper-red",
    price_spike: "border-casper-amber",
    audit_complete: "border-casper-green",
    scrape_error: "border-casper-red"
};
export const AlertFeed = () => {
    const dispatch = useAppDispatch();
    const token = useAppSelector((state) => state.auth.accessToken);
    const items = useAppSelector((state) => state.alerts.items);
    useEffect(() => {
        if (!token)
            return;
        dispatch(connectAlerts(token));
        return () => {
            dispatch(disconnectAlerts());
        };
    }, [dispatch, token]);
    return (_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold", children: "Live Alerts" }), _jsx("button", { type: "button", onClick: () => dispatch(markAllRead()), className: "rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800", children: "Mark all read" })] }), _jsx("div", { className: "max-h-[280px] space-y-2 overflow-y-auto pr-1", children: items.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: "No alerts yet" })) : (items.slice(0, 20).map((alert) => (_jsxs("article", { className: `rounded-lg border-l-4 bg-white p-3 dark:bg-slate-950 ${borderClass[alert.type] ?? "border-slate-400"}`, children: [_jsx("p", { className: "text-xs text-slate-500", children: formatDate(alert.createdAt) }), _jsx("p", { className: "text-sm text-slate-800 dark:text-slate-200", children: alert.message }), alert.tenderId ? (_jsx(Link, { className: "text-xs text-casper-blue hover:underline", to: `/tenders/${alert.tenderId}`, children: "Open tender" })) : null] }, alert._id)))) })] }));
};
