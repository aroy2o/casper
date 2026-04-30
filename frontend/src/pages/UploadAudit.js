import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { SourceRef } from "../components/SourceRef";
import { useGetTenderByIdQuery, useUploadTenderMutation } from "../features/tenders/tendersApi";
import { useGetAuditByTenderIdQuery } from "../features/audits/auditsApi";
import { RiskBadge } from "../components/RiskBadge";
import { formatCurrency, formatCrore } from "../utils/format";
import { INDIA_STATES } from "../utils/indiaStates";
const TERMINAL_STATUSES = new Set(["flagged", "clean", "insufficient_data", "error"]);
const steps = [
    "Uploading PDF...",
    "Parsing document...",
    "Fetching market prices...",
    "Running AI fraud detection...",
    "Generating report..."
];
const VerdictBadge = ({ verdict }) => {
    if (!verdict)
        return null;
    const styles = {
        overpriced: "bg-red-100 text-red-700 border-red-300",
        neutral: "bg-slate-100 text-slate-700 border-slate-300",
        underpriced: "bg-green-100 text-green-700 border-green-300"
    };
    return (_jsx("span", { className: `inline-block rounded-full border px-3 py-0.5 text-xs font-semibold capitalize ${styles[verdict] ?? styles.neutral}`, children: verdict }));
};
export const UploadAudit = () => {
    const [uploadTender, { isLoading, error: uploadError }] = useUploadTenderMutation();
    const [file, setFile] = useState(null);
    const [form, setForm] = useState({
        title: "",
        department: "",
        state: "national",
        projectType: "road",
        tenderNumber: "",
        totalEstimatedCostINR: "",
        lengthKm: ""
    });
    const [tenderId, setTenderId] = useState(null);
    const [auditFetchId, setAuditFetchId] = useState(null);
    const [hasRetried404, setHasRetried404] = useState(false);
    const [stopTenderPolling, setStopTenderPolling] = useState(false);
    const textFields = [
        { key: "title", label: "Tender title" },
        { key: "department", label: "Department" },
        { key: "tenderNumber", label: "Tender number" },
        { key: "totalEstimatedCostINR", label: "Estimated cost in INR" },
        { key: "lengthKm", label: "Length in km (optional)" }
    ];
    const { data: tender } = useGetTenderByIdQuery(tenderId ? tenderId : skipToken, {
        pollingInterval: stopTenderPolling ? 0 : 4000,
        refetchOnFocus: false
    });
    const { data: audit, error: auditError, refetch: refetchAudit } = useGetAuditByTenderIdQuery(auditFetchId ? auditFetchId : skipToken);
    // Stop polling once the tender reaches any terminal status
    useEffect(() => {
        if (!tenderId || !tender)
            return;
        if (!TERMINAL_STATUSES.has(tender.status))
            return;
        setStopTenderPolling(true);
        const timer = window.setTimeout(() => {
            setAuditFetchId(tenderId);
            setHasRetried404(false);
        }, 500);
        return () => window.clearTimeout(timer);
    }, [tender, tenderId]);
    useEffect(() => {
        if (!auditFetchId || hasRetried404 || !auditError || !("status" in auditError))
            return;
        if (auditError.status !== 404)
            return;
        const timer = window.setTimeout(() => {
            setHasRetried404(true);
            void refetchAudit();
        }, 1000);
        return () => window.clearTimeout(timer);
    }, [auditError, auditFetchId, hasRetried404, refetchAudit]);
    const activeStep = useMemo(() => {
        if (isLoading)
            return 2;
        if (!tenderId)
            return 0;
        if (!tender || !TERMINAL_STATUSES.has(tender.status))
            return 4;
        if (!audit)
            return 4;
        return 5;
    }, [isLoading, tenderId, tender, audit]);
    const onSubmit = async () => {
        if (!file)
            return;
        setTenderId(null);
        setAuditFetchId(null);
        setStopTenderPolling(false);
        const formData = new FormData();
        formData.append("file", file);
        Object.entries(form).forEach(([key, value]) => {
            if (value.length > 0)
                formData.append(key, value);
        });
        const result = await uploadTender(formData);
        if ("data" in result && result.data) {
            setStopTenderPolling(false);
            setTenderId(result.data._id);
        }
    };
    const hasResult = Boolean(tender && TERMINAL_STATUSES.has(tender.status));
    const isAnalysing = Boolean(tenderId && !hasResult && !uploadError);
    return (_jsxs("div", { className: "grid grid-cols-1 gap-6 xl:grid-cols-2", children: [_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h2", { className: "mb-4 text-lg font-semibold", children: "Upload Tender PDF" }), _jsxs("label", { className: "mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-400 p-6 text-sm text-slate-500 dark:border-slate-700", children: [_jsx("input", { type: "file", accept: "application/pdf", className: "hidden", onChange: (e) => setFile(e.target.files?.[0] ?? null) }), file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "Drop PDF or click to choose"] }), _jsxs("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-2", children: [textFields.map(({ key, label }) => (_jsx("input", { value: form[key], onChange: (e) => setForm((prev) => ({ ...prev, [key]: e.target.value })), placeholder: label, className: "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" }, key))), _jsxs("select", { value: form.state, onChange: (e) => setForm((prev) => ({ ...prev, state: e.target.value })), className: "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950", children: [_jsx("option", { value: "national", children: "national" }), INDIA_STATES.map((s) => (_jsx("option", { value: s.value, children: s.label }, s.value)))] }), _jsxs("select", { value: form.projectType, onChange: (e) => setForm((prev) => ({ ...prev, projectType: e.target.value })), className: "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950", children: [_jsx("option", { value: "road", children: "road" }), _jsx("option", { value: "bridge", children: "bridge" }), _jsx("option", { value: "railway", children: "railway" }), _jsx("option", { value: "building", children: "building" }), _jsx("option", { value: "drainage", children: "drainage" })] })] }), _jsx("button", { type: "button", onClick: () => void onSubmit(), disabled: !file || isLoading, className: "mt-4 rounded-lg bg-casper-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50", children: isLoading ? "Uploading…" : "Analyze tender" }), uploadError && (_jsx("p", { className: "mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700", children: "Upload failed \u2014 check the server is running and the file is a valid PDF." })), _jsx("ol", { className: "mt-4 space-y-2 text-sm", children: steps.map((step, index) => (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx("span", { className: `inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${index + 1 < activeStep
                                        ? "bg-casper-green text-white"
                                        : index + 1 === activeStep
                                            ? "animate-pulse bg-casper-blue text-white"
                                            : "bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-200"}`, children: index + 1 < activeStep ? "✓" : index + 1 }), _jsx("span", { className: index + 1 === activeStep ? "font-medium" : "", children: step })] }, step))) })] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h2", { className: "mb-4 text-lg font-semibold", children: "Audit Result" }), isAnalysing && !audit && (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm text-slate-500", children: "AI is analysing the document\u2026 this can take up to 90 seconds with local Ollama." }), _jsx("div", { className: "skeleton h-8" }), _jsx("div", { className: "skeleton h-20" }), _jsx("div", { className: "skeleton h-16" })] })), tender?.status === "error" && !audit && (_jsx("p", { className: "rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700", children: "The audit job encountered an error. Check the backend logs and make sure Ollama is running." })), !tenderId && !audit && (_jsx("p", { className: "text-sm text-slate-400", children: "Upload a PDF to see the audit result here." })), audit && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(RiskBadge, { riskLevel: audit.riskLevel }), _jsx(VerdictBadge, { verdict: audit.claudeVerdict })] }), tender && (_jsx(SourceRef, { source: audit.mlModelVersion ?? "ollama", sourceURL: tender.sourceURL, fetchedAt: tender.parsedAt, className: "mt-2" })), audit.summary && (_jsx("p", { className: "mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950", children: audit.summary })), _jsxs("div", { className: "mt-3 flex gap-6", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-2xl font-bold text-casper-red", children: [audit.overallInflationPct.toFixed(1), "%"] }), _jsx("p", { className: "text-xs text-slate-500", children: "avg overpricing" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold text-casper-red", children: formatCrore(audit.totalOverpricedINR) }), _jsx("p", { className: "text-xs text-slate-500", children: "total overpriced" })] })] }), audit.flags && audit.flags.length > 0 && (_jsx("div", { className: "mt-4 overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs text-slate-500", children: [_jsx("th", { className: "pb-1", children: "Item" }), _jsx("th", { className: "pb-1", children: "Quoted" }), _jsx("th", { className: "pb-1", children: "Market" }), _jsx("th", { className: "pb-1", children: "Deviation" })] }) }), _jsx("tbody", { children: audit.flags.map((flag, i) => (_jsxs("tr", { className: "border-t border-slate-200 dark:border-slate-800", children: [_jsx("td", { className: "py-1.5 pr-2 text-xs", children: flag.lineItemDescription }), _jsx("td", { className: "py-1.5 pr-2 text-xs", children: formatCurrency(flag.quotedRateINR) }), _jsx("td", { className: "py-1.5 pr-2 text-xs", children: formatCurrency(flag.marketRateINR) }), _jsxs("td", { className: `py-1.5 text-xs font-semibold ${flag.inflationPct > 0 ? "text-red-600" : "text-green-600"}`, children: [flag.inflationPct > 0 ? "+" : "", flag.inflationPct.toFixed(1), "%"] })] }, `${flag.lineItemDescription}-${i}`))) })] }) })), audit.riskSignals && audit.riskSignals.length > 0 && (_jsxs("div", { className: "mt-4", children: [_jsx("p", { className: "mb-1 text-xs font-semibold uppercase text-slate-400", children: "Risk signals" }), _jsx("ul", { className: "space-y-1", children: audit.riskSignals.map((signal, i) => (_jsxs("li", { className: "rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200", children: ["\u26A0 ", signal] }, i))) })] })), audit.recommendation && (_jsxs("div", { className: "mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950", children: [_jsx("p", { className: "mb-0.5 text-xs font-semibold uppercase text-blue-500", children: "Recommendation" }), _jsx("p", { className: "text-sm text-blue-900 dark:text-blue-100", children: audit.recommendation })] })), (!audit.riskSignals || audit.riskSignals.length === 0) && audit.flags.length > 0 && (_jsx("div", { className: "mt-4 space-y-2", children: audit.flags.map((flag) => (_jsx("p", { className: "rounded-lg border border-casper-red/30 bg-casper-red/10 p-2 text-xs", children: flag.explanation }, flag.explanation))) }))] }))] })] }));
};
