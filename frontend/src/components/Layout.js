import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { VoiceMicButton } from "./VoiceMicButton";
import { AppTour } from "./AppTour";
import { RegionSelector } from "./RegionSelector";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAppSelector } from "../app/hooks";
import { toastEventName } from "../utils/toast";
import { TransText } from "./TransText";
const syncTheme = () => {
    const t = localStorage.getItem("casper_theme");
    if (t !== "light") {
        document.documentElement.classList.add("dark");
    }
    else {
        document.documentElement.classList.remove("dark");
    }
};
const navItems = [
    { to: "/", label: "Dashboard", icon: "M3 13h8V3H3v10Zm10 8h8V3h-8v18ZM3 21h8v-6H3v6Z" },
    { to: "/upload", label: "Upload Audit", icon: "M12 3v12m0-12 4 4m-4-4-4 4M4 19h16" },
    { to: "/prices", label: "Price Explorer", icon: "M4 17 9 12l4 4 7-9" },
    { to: "/tenders", label: "Tenders", icon: "M4 6h16M4 12h16M4 18h16" },
    { to: "/analytics", label: "Analytics", icon: "M2 12h4l3-9 4 18 3-9h4" },
    { to: "/reports", label: "Report History", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
    { to: "/extension-audits", label: "Extension Audits", icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18" },
    { to: "/compare", label: "Compare", icon: "M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M12 8v8m-3-4h6" },
    { to: "/retention", label: "Retention", icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" },
    { to: "/security", label: "Security", icon: "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" },
    { to: "/estimate", label: "Cost Estimator", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
    { to: "/settings", label: "Settings", icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" }
];
const pageTitle = (pathname) => {
    if (pathname.startsWith("/upload"))
        return "Upload Audit";
    if (pathname.startsWith("/prices"))
        return "Price Explorer";
    if (pathname.startsWith("/tenders"))
        return "Tender Browser";
    if (pathname.startsWith("/analytics"))
        return "Analytics & Intelligence";
    if (pathname.startsWith("/reports"))
        return "Report History";
    if (pathname.startsWith("/extension-audits"))
        return "Extension Audit History";
    if (pathname.startsWith("/compare"))
        return "Tender Comparison";
    if (pathname.startsWith("/retention"))
        return "Data Retention";
    if (pathname.startsWith("/security"))
        return "Security & Compliance";
    if (pathname.startsWith("/estimate"))
        return "Fair Cost Estimator";
    if (pathname.startsWith("/settings"))
        return "Settings";
    return "Dashboard";
};
export const Layout = ({ children }) => {
    const location = useLocation();
    const { unreadCount, connected } = useAppSelector((state) => state.alerts);
    const user = useAppSelector((state) => state.auth.user);
    const [toasts, setToasts] = useState([]);
    const [showTour, setShowTour] = useState(false);
    useEffect(() => {
        const handler = (event) => {
            const custom = event;
            setToasts((prev) => [...prev.slice(-2), custom.detail]);
            window.setTimeout(() => {
                setToasts((prev) => prev.filter((item) => item.id !== custom.detail.id));
            }, 4000);
        };
        window.addEventListener(toastEventName, handler);
        return () => window.removeEventListener(toastEventName, handler);
    }, []);
    useEffect(() => {
        syncTheme();
        const onStorageTheme = (e) => {
            if (e.key === "casper_theme")
                syncTheme();
        };
        window.addEventListener("storage", onStorageTheme);
        return () => window.removeEventListener("storage", onStorageTheme);
    }, []);
    useEffect(() => {
        const seen = localStorage.getItem("casper_tour_seen");
        if (!seen) {
            setShowTour(true);
        }
    }, []);
    const title = useMemo(() => pageTitle(location.pathname), [location.pathname]);
    return (_jsxs("div", { className: "flex min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100", children: [_jsxs("aside", { className: "hidden w-[220px] flex-col border-r border-slate-200 bg-slate-50 px-4 py-6 dark:border-slate-800 dark:bg-slate-900 md:flex", children: [_jsx("div", { className: "mb-8 text-lg font-semibold tracking-wide text-casper-blue", children: "CASPER" }), _jsx("nav", { className: "space-y-2", children: navItems.map((item) => {
                            const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                            return (_jsxs(Link, { to: item.to, className: `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${active
                                    ? "bg-casper-blue text-white"
                                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`, children: [_jsx("svg", { viewBox: "0 0 24 24", className: "h-4 w-4 fill-none stroke-current stroke-2", children: _jsx("path", { d: item.icon }) }), item.label] }, item.to));
                        }) }), _jsx("div", { className: "mt-auto", children: _jsx(VoiceMicButton, {}) })] }), _jsxs("div", { className: "flex min-h-screen flex-1 flex-col", children: [_jsx("header", { className: "sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 md:px-6", children: _jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: `h-2.5 w-2.5 rounded-full ${connected ? "bg-casper-green" : "bg-slate-500"}` }), _jsx("h1", { className: "text-lg font-semibold", children: title })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(RegionSelector, {}), _jsx(LanguageSwitcher, {})] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("button", { type: "button", className: "relative rounded-full border border-slate-300 p-2 dark:border-slate-700", children: [_jsx("svg", { viewBox: "0 0 24 24", className: "h-4 w-4 fill-none stroke-current stroke-2", children: _jsx("path", { d: "M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0" }) }), unreadCount > 0 ? (_jsx("span", { className: "absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-casper-red px-1 text-[10px] text-white", children: unreadCount })) : null] }), _jsxs("div", { className: "flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700", children: [_jsx("span", { className: "inline-flex h-6 w-6 items-center justify-center rounded-full bg-casper-blue text-xs font-semibold text-white", children: (user?.name ?? "U").slice(0, 1).toUpperCase() }), _jsx("span", { className: "hidden sm:inline", children: user?.name ?? "User" })] })] })] }) }), _jsx("main", { className: "flex-1 overflow-y-auto p-4 md:p-6", children: children }), _jsx("nav", { className: "fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:hidden", children: _jsx("div", { className: "grid grid-cols-5", children: navItems.map((item) => {
                                const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                                return (_jsxs(Link, { to: item.to, className: `flex flex-col items-center gap-1 py-2 text-[11px] ${active ? "text-casper-blue" : "text-slate-500"}`, children: [_jsx("svg", { viewBox: "0 0 24 24", className: "h-4 w-4 fill-none stroke-current stroke-2", children: _jsx("path", { d: item.icon }) }), item.label.split(" ")[0]] }, item.to));
                            }) }) }), _jsx("div", { className: "fixed right-4 top-4 z-50 space-y-2", children: toasts.map((toast) => (_jsx("div", { className: `rounded-lg px-3 py-2 text-sm text-white shadow ${toast.type === "error" ? "bg-casper-red" : toast.type === "success" ? "bg-casper-green" : "bg-casper-blue"}`, children: _jsx(TransText, { text: toast.message }) }, toast.id))) }), showTour ? (_jsx(AppTour, { onClose: () => {
                            localStorage.setItem("casper_tour_seen", "true");
                            setShowTour(false);
                        } })) : null] })] }));
};
