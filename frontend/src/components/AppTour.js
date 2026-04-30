import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
const STEPS = [
    {
        title: "Dashboard",
        path: "/",
        description: "See live tender risk metrics, inflation signals, and latest tender activity. This gives a quick health view of procurement integrity."
    },
    {
        title: "Upload Audit",
        path: "/upload",
        description: "Upload a tender PDF to run AI extraction + market comparison. This is where flagged pricing anomalies are generated."
    },
    {
        title: "Price Explorer",
        path: "/prices",
        description: "Review real-time market references from GeM/IndiaMART/TradeIndia and benchmark estimates. This is the source of fair-rate baselines."
    },
    {
        title: "Tender Browser",
        path: "/tenders",
        description: "Browse real tenders scraped from public portals with source links, dates, and metadata. This is your searchable investigation workspace."
    },
    {
        title: "Settings",
        path: "/settings",
        description: "Configure alert thresholds, notifications, and display defaults. This personalizes monitoring and keeps signals relevant."
    }
];
export const AppTour = ({ onClose }) => {
    const [index, setIndex] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();
    const step = STEPS[Math.min(index, STEPS.length - 1)];
    const isLast = index === STEPS.length - 1;
    const helper = useMemo(() => {
        if (location.pathname === step.path) {
            return "You are on this page now.";
        }
        return "Click 'Take me there' to jump to this page.";
    }, [location.pathname, step.path]);
    return (_jsx("div", { className: "fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4", children: _jsxs("div", { className: "w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-casper-amber", children: "Welcome to CASPER" }), _jsx("h3", { className: "mt-1 text-xl font-semibold", children: step.title }), _jsx("p", { className: "mt-3 text-sm text-slate-300", children: step.description }), _jsx("p", { className: "mt-2 text-xs text-slate-400", children: helper }), _jsx("div", { className: "mt-4 h-2 w-full rounded bg-slate-700", children: _jsx("div", { className: "h-full rounded bg-casper-blue", style: { width: `${((index + 1) / STEPS.length) * 100}%` } }) }), _jsxs("p", { className: "mt-2 text-xs text-slate-400", children: ["Step ", index + 1, " of ", STEPS.length] }), _jsxs("div", { className: "mt-5 flex flex-wrap items-center justify-between gap-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "rounded border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800", children: "Skip tour" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", disabled: index === 0, onClick: () => setIndex((prev) => Math.max(0, prev - 1)), className: "rounded border border-slate-600 px-3 py-1.5 text-sm disabled:opacity-50", children: "Back" }), _jsx("button", { type: "button", onClick: () => navigate(step.path), className: "rounded border border-casper-blue px-3 py-1.5 text-sm text-casper-blue hover:bg-casper-blue/10", children: "Take me there" }), _jsx("button", { type: "button", onClick: () => {
                                        if (isLast) {
                                            onClose();
                                            return;
                                        }
                                        setIndex((prev) => Math.min(STEPS.length - 1, prev + 1));
                                    }, className: "rounded bg-casper-blue px-3 py-1.5 text-sm font-semibold text-white", children: isLast ? "Finish" : "Next" })] })] })] }) }));
};
