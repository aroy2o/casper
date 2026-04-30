import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useExportReportMutation } from "./auditsApi";
import { showToast } from "../../utils/toast";
import { useAppSelector } from "../../app/hooks";
const REPORT_OPTIONS = [
    { type: "tender", label: "Tender Audit Report", desc: "Full audit for this tender — all items, benchmarks, flags, risk score, AI summary." },
    { type: "vendor", label: "Vendor Due Diligence Report", desc: "All tenders by this vendor across India — win rate, flag history, cross-state activity.", requiresVendor: true },
    { type: "item", label: "Item Price Report", desc: "Price history for the most flagged item in this region." },
    { type: "regional", label: "Regional Compliance Report", desc: "Summary for this state — total tenders, flagged count, estimated overcharge, top vendors." }
];
export function ExportModal({ tender, onClose }) {
    const [reportType, setReportType] = useState("tender");
    const [format, setFormat] = useState("pdf");
    const [downloadURL, setDownloadURL] = useState(null);
    const accessToken = useAppSelector((state) => state.auth.accessToken);
    const [exportReport, { isLoading }] = useExportReportMutation();
    const getReferenceId = () => {
        if (reportType === "tender")
            return tender._id;
        if (reportType === "vendor")
            return tender.vendorName ?? "";
        if (reportType === "regional")
            return tender.stateCode ?? tender.state ?? "";
        // item: use tender ID and backend will pick the most flagged item
        return tender._id;
    };
    const handleExport = async () => {
        const refId = getReferenceId();
        if (!refId) {
            showToast("error", "Missing reference data for this report type.");
            return;
        }
        try {
            const result = await exportReport({ reportType, referenceId: refId, format }).unwrap();
            setDownloadURL(result.downloadURL);
            showToast("success", "Report generated successfully!");
        }
        catch {
            showToast("error", "Failed to generate report. Try again.");
        }
    };
    const handleDownload = async () => {
        if (!downloadURL || !accessToken)
            return;
        try {
            const res = await fetch(downloadURL, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!res.ok)
                throw new Error("Download failed");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `CASPER_${reportType}_${tender.tenderNumber}.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        }
        catch {
            showToast("error", "Failed to download file.");
        }
    };
    const selectedOption = REPORT_OPTIONS.find((o) => o.type === reportType);
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-40 bg-black/50", onClick: onClose }), _jsxs("div", { className: "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl dark:bg-slate-950", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-base font-semibold", children: "Export Audit Report" }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: tender.tenderNumber })] }), _jsx("button", { type: "button", onClick: onClose, className: "rounded p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800", children: _jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsxs("div", { className: "p-5 space-y-5", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide block mb-2", children: "Report Type" }), _jsx("div", { className: "space-y-2", children: REPORT_OPTIONS.map((opt) => {
                                            const disabled = opt.requiresVendor && !tender.vendorName;
                                            return (_jsxs("label", { className: `flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${reportType === opt.type
                                                    ? "border-casper-blue bg-blue-50 dark:bg-blue-950/30"
                                                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300"} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`, children: [_jsx("input", { type: "radio", name: "reportType", value: opt.type, checked: reportType === opt.type, onChange: () => !disabled && setReportType(opt.type), disabled: disabled, className: "mt-0.5 accent-casper-blue" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-slate-800 dark:text-slate-200", children: opt.label }), _jsx("div", { className: "text-xs text-slate-500 mt-0.5", children: opt.desc }), disabled && _jsx("div", { className: "text-xs text-orange-500 mt-0.5", children: "No vendor data for this tender" })] })] }, opt.type));
                                        }) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide block mb-2", children: "Format" }), _jsx("div", { className: "flex gap-2", children: ["pdf", "csv"].map((f) => (_jsxs("label", { className: `flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${format === f ? "border-casper-blue bg-blue-50 text-casper-blue dark:bg-blue-950/30" : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400"}`, children: [_jsx("input", { type: "radio", name: "format", value: f, checked: format === f, onChange: () => setFormat(f), className: "accent-casper-blue" }), f.toUpperCase(), _jsx("span", { className: "text-xs text-slate-400", children: f === "pdf" ? "(formatted)" : "(raw data)" })] }, f))) })] }), _jsxs("div", { className: "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("p", { className: "text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5", children: "What's included:" }), reportType === "tender" && _jsxs("ul", { className: "text-xs text-slate-500 space-y-0.5 list-disc list-inside", children: [_jsx("li", { children: "Tender summary & metadata" }), _jsx("li", { children: "All line items with price benchmarks" }), _jsx("li", { children: "Audit flags & AI explanations" }), _jsx("li", { children: "Risk level & overpricing estimate" }), _jsx("li", { children: "AI summary & recommendations" })] }), reportType === "vendor" && _jsxs("ul", { className: "text-xs text-slate-500 space-y-0.5 list-disc list-inside", children: [_jsxs("li", { children: ["All tenders by ", tender.vendorName] }), _jsx("li", { children: "Flag rate & risk score history" }), _jsx("li", { children: "Cross-state activity map" }), _jsx("li", { children: "Average inflation per tender" })] }), reportType === "item" && _jsxs("ul", { className: "text-xs text-slate-500 space-y-0.5 list-disc list-inside", children: [_jsx("li", { children: "Price history across all tenders" }), _jsx("li", { children: "Market citations & benchmarks" }), _jsx("li", { children: "Inflation trend over time" })] }), reportType === "regional" && _jsxs("ul", { className: "text-xs text-slate-500 space-y-0.5 list-disc list-inside", children: [_jsxs("li", { children: ["All tenders in ", tender.state] }), _jsx("li", { children: "Flagged count & estimated overcharge" }), _jsx("li", { children: "Top vendors by tender count" })] })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [!downloadURL ? (_jsx("button", { type: "button", onClick: () => void handleExport(), disabled: isLoading, className: "flex w-full items-center justify-center gap-2 rounded-xl bg-casper-blue px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 hover:bg-blue-700", children: isLoading ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" }), "Generating ", format.toUpperCase(), " Report\u2026"] })) : (`Generate ${format.toUpperCase()} Report`) })) : (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400", children: "Report generated successfully." }), _jsxs("button", { type: "button", onClick: () => void handleDownload(), className: "flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700", children: [_jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" }) }), "Download ", format.toUpperCase(), " Report"] }), _jsx("button", { type: "button", onClick: () => { setDownloadURL(null); }, className: "w-full rounded-xl border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400", children: "Generate Another Report" })] })), _jsx("button", { type: "button", onClick: onClose, className: "w-full rounded-xl border border-slate-200 px-5 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900", children: "Close" })] })] })] })] }));
}
