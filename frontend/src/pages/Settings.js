import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useAppSelector } from "../app/hooks";
import { useGetProfileQuery, usePushSubscribeMutation, useSyncTendersMutation, useUpdatePreferencesMutation } from "../features/user/userApi";
import { useRefreshPricesMutation } from "../features/prices/pricesApi";
import { showToast } from "../utils/toast";
export const Settings = () => {
    const { data: profile } = useGetProfileQuery();
    const accessToken = useAppSelector((state) => state.auth.accessToken);
    const refreshToken = useAppSelector((state) => state.auth.refreshToken);
    const [showToken, setShowToken] = useState(false);
    const [tokenCopied, setTokenCopied] = useState(false);
    const [showRefreshToken, setShowRefreshToken] = useState(false);
    const [refreshTokenCopied, setRefreshTokenCopied] = useState(false);
    const [updatePreferences, updateState] = useUpdatePreferencesMutation();
    const [pushSubscribe] = usePushSubscribeMutation();
    const [syncTenders, syncState] = useSyncTendersMutation();
    const [refreshPrices, refreshState] = useRefreshPricesMutation();
    const [theme, setTheme] = useState(localStorage.getItem("casper_theme") ?? "dark");
    const [defaultRegion, setDefaultRegion] = useState(localStorage.getItem("casper_default_region") ?? "assam");
    const [syncYearsBack, setSyncYearsBack] = useState("3");
    const [syncScope, setSyncScope] = useState("assam");
    const [syncTermsInput, setSyncTermsInput] = useState("assam, meghalaya, arunachal, northeast india");
    const [syncMaxRecords, setSyncMaxRecords] = useState("5000");
    const [portalFilter, setPortalFilter] = useState({
        eprocure: true,
        etenders: true,
        worldbank: true
    });
    const [prefs, setPrefs] = useState({
        alertThresholdPct: 20,
        watchedRegions: ["assam"],
        notifyEmail: false,
        notifyPush: true,
        pushSubscription: null
    });
    useEffect(() => {
        if (profile) {
            setPrefs(profile.preferences);
        }
    }, [profile]);
    useEffect(() => {
        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
        }
        else {
            root.classList.remove("dark");
        }
        localStorage.setItem("casper_theme", theme);
    }, [theme]);
    useEffect(() => {
        const saved = localStorage.getItem("casper_theme");
        setTheme(saved !== "light" ? "dark" : "light");
    }, []);
    const toggleRegion = (region) => {
        setPrefs((prev) => ({
            ...prev,
            watchedRegions: prev.watchedRegions.includes(region)
                ? prev.watchedRegions.filter((item) => item !== region)
                : [...prev.watchedRegions, region]
        }));
    };
    const save = async () => {
        await updatePreferences(prefs);
    };
    const triggerPriceRefresh = async () => {
        try {
            const result = await refreshPrices().unwrap();
            showToast("success", `Prices refreshed: ${result.updated} records updated from ${result.sources.join(", ")}`);
        }
        catch {
            showToast("error", "Price refresh failed — check backend logs");
        }
    };
    const triggerTenderSync = async () => {
        const yearsBack = Math.max(1, Number(syncYearsBack) || 3);
        const terms = syncTermsInput
            .split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0);
        const portals = Object.entries(portalFilter).filter(([, enabled]) => enabled).map(([name]) => name);
        await syncTenders({
            yearsBack,
            terms: terms.length > 0 ? terms : ["assam", "meghalaya", "arunachal", "northeast india"],
            portals: portals.length > 0 ? portals : ["eprocure", "etenders", "worldbank"],
            scope: syncScope,
            maxRecords: Math.max(100, Number(syncMaxRecords) || 5000)
        });
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Profile" }), !profile ? (_jsxs("div", { className: "mt-3 space-y-2", children: [_jsx("div", { className: "skeleton h-8" }), _jsx("div", { className: "skeleton h-8" })] })) : (_jsxs("div", { className: "mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2", children: [_jsxs("p", { children: ["Name: ", profile.name] }), _jsxs("p", { children: ["Email: ", profile.email] }), _jsxs("p", { children: ["Org: ", profile.organization] }), _jsxs("p", { children: ["Role: ", profile.role] })] }))] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h2", { className: "text-lg font-semibold", children: "API Token for Extension" }), _jsx("p", { className: "mt-2 text-sm text-slate-600 dark:text-slate-400", children: "Use these tokens to authenticate and auto-renew the CASPER browser extension session." }), accessToken ? (_jsxs("div", { className: "mt-4 space-y-3", children: [_jsxs("div", { className: "relative", children: [_jsx("input", { type: showToken ? "text" : "password", value: accessToken, readOnly: true, className: "w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950" }), _jsx("button", { type: "button", onClick: () => setShowToken(!showToken), className: "absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300", children: showToken ? "Hide" : "Show" })] }), _jsx("div", { className: "flex gap-2", children: _jsx("button", { type: "button", onClick: () => {
                                        navigator.clipboard.writeText(accessToken);
                                        setTokenCopied(true);
                                        showToast("success", "Token copied to clipboard!");
                                        setTimeout(() => setTokenCopied(false), 3000);
                                    }, className: "rounded bg-casper-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600", children: tokenCopied ? "✓ Copied!" : "Copy Token" }) }), refreshToken ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "relative", children: [_jsx("input", { type: showRefreshToken ? "text" : "password", value: refreshToken, readOnly: true, className: "w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950" }), _jsx("button", { type: "button", onClick: () => setShowRefreshToken(!showRefreshToken), className: "absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300", children: showRefreshToken ? "Hide" : "Show" })] }), _jsx("div", { className: "flex gap-2", children: _jsx("button", { type: "button", onClick: () => {
                                                navigator.clipboard.writeText(refreshToken);
                                                setRefreshTokenCopied(true);
                                                showToast("success", "Refresh token copied to clipboard!");
                                                setTimeout(() => setRefreshTokenCopied(false), 3000);
                                            }, className: "rounded bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600", children: refreshTokenCopied ? "✓ Copied!" : "Copy Refresh Token" }) })] })) : null, _jsxs("div", { className: "rounded bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-900/20 dark:text-blue-200", children: [_jsx("p", { className: "font-semibold", children: "Extension Setup:" }), _jsxs("ol", { className: "mt-2 list-inside list-decimal space-y-1", children: [_jsx("li", { children: "Open CASPER Extension settings" }), _jsx("li", { children: "Paste this token into \"Auth Token (JWT)\" field" }), _jsx("li", { children: "Paste the refresh token into \"Refresh Token (JWT)\" field" }), _jsx("li", { children: "Click \"Save Settings\"" }), _jsxs("li", { className: "mt-2", children: ["Or push tokens automatically to any open CASPER extension by clicking ", _jsx("strong", { children: "Push to Extension" }), " below."] })] })] }), _jsx("div", { className: "flex gap-2", children: _jsx("button", { type: "button", onClick: () => {
                                        try {
                                            window.postMessage({ type: "CASPER_PUSH_TOKEN", authToken: accessToken, refreshToken }, window.location.origin || "*");
                                            showToast("success", "Tokens pushed to open CASPER extension (if any)");
                                        }
                                        catch (err) {
                                            showToast("error", "Failed to push tokens to extension");
                                        }
                                    }, className: "rounded bg-casper-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600", children: "Push to Extension" }) })] })) : (_jsx("p", { className: "mt-3 text-sm text-slate-500", children: "Please log in to view your API token." }))] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Alert preferences" }), _jsxs("div", { className: "mt-4 space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "text-sm", children: ["Alert threshold: ", prefs.alertThresholdPct, "%"] }), _jsx("input", { type: "range", min: 10, max: 80, value: prefs.alertThresholdPct, onChange: (event) => setPrefs((prev) => ({ ...prev, alertThresholdPct: Number(event.target.value) })), className: "w-full" })] }), _jsx("div", { className: "flex flex-wrap gap-3", children: ["assam", "meghalaya", "arunachal", "manipur", "national"].map((region) => (_jsxs("label", { className: "flex items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: prefs.watchedRegions.includes(region), onChange: () => toggleRegion(region) }), region] }, region))) }), _jsxs("label", { className: "flex items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: prefs.notifyEmail, onChange: (event) => setPrefs((prev) => ({ ...prev, notifyEmail: event.target.checked })) }), "Email notifications"] }), _jsxs("label", { className: "flex items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: prefs.notifyPush, onChange: async (event) => {
                                            const value = event.target.checked;
                                            setPrefs((prev) => ({ ...prev, notifyPush: value }));
                                            if (value) {
                                                await pushSubscribe({ enabled: true });
                                            }
                                        } }), "Push notifications"] }), _jsx("button", { type: "button", onClick: () => void save(), className: "rounded bg-casper-blue px-4 py-2 text-sm font-semibold text-white", children: updateState.isLoading ? "Saving..." : "Save preferences" })] })] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Display" }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-3 text-sm", children: [_jsxs("button", { type: "button", onClick: () => setTheme(theme === "dark" ? "light" : "dark"), className: "rounded border border-slate-300 px-3 py-1.5 dark:border-slate-700", children: ["Toggle ", theme === "dark" ? "Light" : "Dark", " mode"] }), _jsxs("select", { value: defaultRegion, onChange: (event) => {
                                    setDefaultRegion(event.target.value);
                                    localStorage.setItem("casper_default_region", event.target.value);
                                }, className: "rounded border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-950", children: [_jsx("option", { value: "assam", children: "assam" }), _jsx("option", { value: "meghalaya", children: "meghalaya" }), _jsx("option", { value: "arunachal", children: "arunachal" }), _jsx("option", { value: "national", children: "national" })] }), _jsx("button", { type: "button", onClick: () => {
                                    localStorage.removeItem("casper_tour_seen");
                                    window.location.reload();
                                }, className: "rounded border border-slate-300 px-3 py-1.5 dark:border-slate-700", children: "Replay app tour" })] })] }), profile?.role === "admin" ? (_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Price Data (Admin)" }), _jsx("p", { className: "mt-2 text-sm text-slate-500", children: "Fetch the latest prices from IOCL (bitumen) and SAIL (steel). Remaining materials use CPWD 2024 rates." }), _jsxs("div", { className: "mt-4", children: [_jsx("button", { type: "button", onClick: () => void triggerPriceRefresh(), disabled: refreshState.isLoading, className: "rounded bg-casper-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60", children: refreshState.isLoading ? "Refreshing…" : "Refresh Prices Now" }), refreshState.data ? (_jsxs("p", { className: "mt-2 text-sm text-casper-green", children: ["\u2713 ", refreshState.data.updated, " price records updated \u00B7 sources: ", refreshState.data.sources.join(", ")] })) : null, refreshState.data?.errors && refreshState.data.errors.length > 0 ? (_jsxs("p", { className: "mt-1 text-sm text-casper-red", children: ["Errors: ", refreshState.data.errors.join("; ")] })) : null] })] })) : null, profile?.role === "admin" ? (_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Tender Dataset Sync (Admin)" }), _jsx("p", { className: "mt-2 text-sm text-slate-500", children: "One-click refresh for historical tenders with filters based on your preference." }), _jsxs("div", { className: "mt-4 grid grid-cols-1 gap-3 md:grid-cols-2", children: [_jsxs("label", { className: "text-sm", children: ["Years back", _jsx("input", { type: "number", min: 1, max: 10, value: syncYearsBack, onChange: (event) => setSyncYearsBack(event.target.value), className: "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" })] }), _jsxs("label", { className: "text-sm", children: ["Scope (state-wise or full country)", _jsxs("select", { value: syncScope, onChange: (event) => setSyncScope(event.target.value), className: "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950", children: [_jsx("option", { value: "all_india", children: "All India" }), _jsx("option", { value: "assam", children: "assam" }), _jsx("option", { value: "meghalaya", children: "meghalaya" }), _jsx("option", { value: "arunachal", children: "arunachal" }), _jsx("option", { value: "manipur", children: "manipur" }), _jsx("option", { value: "mizoram", children: "mizoram" }), _jsx("option", { value: "nagaland", children: "nagaland" }), _jsx("option", { value: "tripura", children: "tripura" }), _jsx("option", { value: "sikkim", children: "sikkim" }), _jsx("option", { value: "west bengal", children: "west bengal" }), _jsx("option", { value: "karnataka", children: "karnataka" }), _jsx("option", { value: "maharashtra", children: "maharashtra" }), _jsx("option", { value: "delhi", children: "delhi" })] })] }), _jsxs("label", { className: "text-sm", children: ["Max records (optimized cap)", _jsx("input", { type: "number", min: 100, max: 20000, value: syncMaxRecords, onChange: (event) => setSyncMaxRecords(event.target.value), className: "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" })] }), _jsxs("label", { className: "text-sm md:col-span-2", children: ["Search terms (comma separated)", _jsx("input", { value: syncTermsInput, onChange: (event) => setSyncTermsInput(event.target.value), className: "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("p", { className: "text-sm", children: "Portals" }), _jsx("div", { className: "mt-2 flex flex-wrap gap-3 text-sm", children: ["eprocure", "etenders", "worldbank"].map((portal) => (_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: portalFilter[portal], onChange: (event) => setPortalFilter((prev) => ({ ...prev, [portal]: event.target.checked })) }), portal] }, portal))) })] }), _jsxs("div", { className: "md:col-span-2 flex flex-col gap-3", children: [_jsx("button", { type: "button", onClick: () => void triggerTenderSync(), className: "rounded bg-casper-blue px-4 py-2 text-sm font-semibold text-white", children: syncState.isLoading ? "Syncing..." : "Sync tenders now" }), syncState.data ? (_jsxs("div", { className: "text-sm text-slate-600 dark:text-slate-300", children: [_jsxs("p", { children: [_jsxs("strong", { children: ["Found ", syncState.data.found, " tender", syncState.data.found !== 1 ? "s" : ""] }), " from last ", syncState.data.yearsBack, " year", syncState.data.yearsBack !== 1 ? "s" : ""] }), syncState.data.inserted > 0 && (_jsxs("p", { className: "text-casper-blue", children: ["\u2713 Added ", syncState.data.inserted, " new tender", syncState.data.inserted !== 1 ? "s" : ""] })), syncState.data.alreadyExist > 0 && (_jsxs("p", { className: "text-slate-500", children: [syncState.data.alreadyExist, " already in database"] }))] })) : null] })] })] })) : null, _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h2", { className: "text-lg font-semibold", children: "About" }), _jsx("p", { className: "mt-2", children: "Version: 1.0.0" }), _jsx("p", { children: "Data sources: GeM 2024, CPWD SOR 2024, eprocure public records" }), _jsx("p", { children: "Last scrape time: Live from backend seeded dataset" })] })] }));
};
