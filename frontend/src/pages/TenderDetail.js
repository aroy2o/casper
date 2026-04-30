import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import { useGetTenderByIdQuery } from "../features/tenders/tendersApi";
import { formatCrore, formatCurrency, formatDate } from "../utils/format";
import { showToast } from "../utils/toast";
import { SimilarTendersTab } from "../features/audits/SimilarTendersTab";
import { ItemDrillDownDrawer } from "../features/audits/ItemDrillDownDrawer";
import { AuditTimelineTab } from "../features/audits/AuditTimelineTab";
import { ExportModal } from "../features/audits/ExportModal";
import { TransText } from "../components/TransText";
import { ExplanationPanel } from "../features/audits/ExplanationPanel";
const statusBadgeClass = {
    flagged: "bg-red-100 text-red-700",
    clean: "bg-emerald-100 text-emerald-700",
    insufficient_data: "bg-amber-100 text-amber-800",
    analyzing: "bg-yellow-100 text-yellow-800",
    pending: "bg-slate-100 text-slate-700",
    parsing: "bg-slate-100 text-slate-700",
    error: "bg-red-100 text-red-600"
};
const riskBadgeClass = {
    critical: "bg-red-100 text-red-700",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-emerald-100 text-emerald-700"
};
const inflationTextClass = (inflationPct) => {
    const value = inflationPct ?? 0;
    if (value > 30)
        return "text-red-600";
    if (value >= 10)
        return "text-yellow-600";
    return "text-emerald-600";
};
const getFlag = (item) => Boolean(item.isFlag ?? item.flagged);
const TABS = ["Overview", "Similar Tenders", "Timeline", "Export"];
export default function TenderDetail() {
    const { id = "" } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("Overview");
    const [exportingPdf, setExportingPdf] = useState(false);
    const [showFullText, setShowFullText] = useState(false);
    const [reauditing, setReauditing] = useState(false);
    const [drillDownItem, setDrillDownItem] = useState(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const accessToken = useAppSelector((state) => state.auth.accessToken);
    const { data, isLoading, isFetching } = useGetTenderByIdQuery(id, {
        skip: id.length === 0
    });
    const tender = data;
    const audit = tender?.audit ?? null;
    const lineItems = useMemo(() => {
        const source = audit?.lineItems ?? tender?.lineItems ?? [];
        return [...source].sort((a, b) => {
            const flagDiff = Number(getFlag(b)) - Number(getFlag(a));
            if (flagDiff !== 0)
                return flagDiff;
            return (b.inflationPct ?? 0) - (a.inflationPct ?? 0);
        });
    }, [audit?.lineItems, tender?.lineItems]);
    const onExportPdf = async () => {
        if (!tender || !accessToken) {
            showToast("error", "Unable to export PDF right now.");
            return;
        }
        setExportingPdf(true);
        try {
            const response = await fetch(`/api/tenders/${tender._id}/export-pdf`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!response.ok)
                throw new Error("PDF export failed");
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `CASPER-${tender.tenderNumber}.pdf`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
        }
        catch {
            showToast("error", "Failed to export report PDF.");
        }
        finally {
            setExportingPdf(false);
        }
    };
    const onReaudit = async () => {
        if (!tender || !accessToken)
            return;
        setReauditing(true);
        try {
            await fetch(`/api/tenders/${tender._id}/reaudit`, {
                method: "POST",
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setTimeout(() => window.location.reload(), 4000);
        }
        catch {
            setReauditing(false);
        }
    };
    if (isLoading || isFetching) {
        return _jsx("div", { className: "skeleton h-48" });
    }
    if (!tender) {
        return (_jsx("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm dark:border-slate-800 dark:bg-slate-900", children: "Tender not found." }));
    }
    const isProcessing = tender.status === "analyzing" || tender.status === "pending" || tender.status === "parsing";
    const isAudited = tender.status === "flagged" || tender.status === "clean" || tender.status === "insufficient_data";
    const rawTextPreview = tender.description ?? tender.rawText ?? "";
    const showRawTextToggle = rawTextPreview.length > 300;
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("button", { type: "button", onClick: () => navigate(-1), className: "text-sm text-casper-blue hover:underline", children: ["\u2190 ", _jsx(TransText, { text: "Back to Tenders" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { type: "button", onClick: onExportPdf, disabled: exportingPdf || !isAudited, title: !isAudited ? "Audit required" : undefined, className: "inline-flex items-center gap-2 rounded bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200", children: [exportingPdf ? _jsx("span", { className: "h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" }) : null, _jsx(TransText, { text: "Quick PDF" })] }), _jsx("button", { type: "button", onClick: () => { setActiveTab("Export"); setShowExportModal(true); }, disabled: !isAudited, className: "inline-flex items-center gap-2 rounded bg-casper-blue px-3 py-2 text-sm font-medium text-white disabled:opacity-60", children: _jsx(TransText, { text: "Export Audit Report" }) })] })] }), isProcessing && (_jsxs("div", { className: "flex items-center justify-between rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300", children: [_jsx("span", { children: "This tender is currently being processed. Refresh in a few seconds to see audit results." }), _jsx("button", { type: "button", onClick: () => window.location.reload(), className: "ml-4 rounded bg-yellow-500 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-600", children: "Refresh" })] })), tender.status === "error" && (_jsxs("div", { className: "flex items-center justify-between rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300", children: [_jsxs("span", { children: ["Audit failed: ", tender.errorMessage ?? "Unknown error"] }), _jsx("button", { type: "button", onClick: () => void onReaudit(), disabled: reauditing, className: "ml-4 rounded bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-60", children: reauditing ? "Queuing…" : "Retry Audit" })] })), _jsx("div", { className: "border-b border-slate-200 dark:border-slate-800", children: _jsx("nav", { className: "flex gap-1 overflow-x-auto", children: TABS.map((tab) => (_jsx("button", { type: "button", onClick: () => { setActiveTab(tab); if (tab === "Export")
                            setShowExportModal(true); }, className: `whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                            ? "border-casper-blue text-casper-blue"
                            : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`, children: tab }, tab))) }) }), activeTab === "Overview" && (_jsxs("div", { className: "space-y-4", children: [_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("h1", { className: "text-2xl font-bold", children: tender.title }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-sm", children: [_jsx("span", { className: "rounded bg-slate-200 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200", children: tender.tenderNumber }), _jsxs("span", { className: "text-slate-500", children: [tender.department, " \u2022 ", tender.state] })] })] }), _jsxs("div", { className: "space-y-2 text-right", children: [_jsx("p", { className: "text-xl font-semibold", children: tender.totalEstimatedCostINR > 0 ? formatCrore(tender.totalEstimatedCostINR) : "—" }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("span", { className: `rounded px-2 py-1 text-xs font-medium capitalize ${statusBadgeClass[tender.status]}`, children: tender.status }), _jsx("span", { className: "rounded bg-slate-100 px-2 py-1 text-xs font-medium capitalize text-slate-700", children: tender.sourcePortal ?? "manual" })] })] })] }), _jsxs("dl", { className: "mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm", children: [_jsx("dt", { className: "text-slate-500", children: "Tender Number" }), _jsx("dd", { className: "font-mono text-slate-900 dark:text-slate-100", children: tender.tenderNumber }), _jsx("dt", { className: "text-slate-500", children: "Department" }), _jsx("dd", { className: "text-slate-900 dark:text-slate-100", children: tender.department }), tender.organisation && (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-slate-500", children: "Organisation" }), _jsx("dd", { className: "text-slate-900 dark:text-slate-100", children: tender.organisation })] })), _jsx("dt", { className: "text-slate-500", children: "State" }), _jsx("dd", { className: "capitalize text-slate-900 dark:text-slate-100", children: tender.state }), tender.locationText && (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-slate-500", children: "Location" }), _jsx("dd", { className: "text-slate-900 dark:text-slate-100", children: tender.locationText })] })), tender.vendorName && (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-slate-500", children: "Vendor / Contractor" }), _jsx("dd", { className: "text-slate-900 dark:text-slate-100", children: tender.vendorName })] })), tender.procurementMethod && (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-slate-500", children: "Procurement Method" }), _jsx("dd", { className: "capitalize text-slate-900 dark:text-slate-100", children: tender.procurementMethod })] })), tender.contractYear != null && (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-slate-500", children: "Contract Year" }), _jsx("dd", { className: "text-slate-900 dark:text-slate-100", children: tender.contractYear })] })), tender.itemizationStatus && (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-slate-500", children: "Itemization Status" }), _jsx("dd", { className: "capitalize text-slate-900 dark:text-slate-100", children: tender.itemizationStatus })] })), typeof tender.dataCompletenessScore === "number" && (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-slate-500", children: "Data Completeness" }), _jsxs("dd", { className: "text-slate-900 dark:text-slate-100", children: [tender.dataCompletenessScore, "%"] })] })), tender.lengthKm != null && (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-slate-500", children: "Length" }), _jsxs("dd", { className: "text-slate-900 dark:text-slate-100", children: [tender.lengthKm, " km"] })] })), _jsx("dt", { className: "text-slate-500", children: "Source Portal" }), _jsx("dd", { className: "capitalize text-slate-900 dark:text-slate-100", children: tender.sourcePortal ?? "manual" }), _jsx("dt", { className: "text-slate-500", children: "Project Type" }), _jsx("dd", { className: "capitalize text-slate-900 dark:text-slate-100", children: tender.projectType ?? "—" }), _jsx("dt", { className: "text-slate-500", children: "Status" }), _jsx("dd", { children: _jsx("span", { className: `rounded px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass[tender.status]}`, children: tender.status }) }), _jsx("dt", { className: "text-slate-500", children: "Total Estimated Cost" }), _jsx("dd", { className: "text-slate-900 dark:text-slate-100", children: tender.totalEstimatedCostINR > 0 ? formatCrore(tender.totalEstimatedCostINR) : "—" }), tender.publishedDate && (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-slate-500", children: "Opening Date" }), _jsx("dd", { className: "text-slate-900 dark:text-slate-100", children: formatDate(tender.publishedDate) })] })), tender.closingDate && (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-slate-500", children: "Closing Date" }), _jsx("dd", { className: "text-slate-900 dark:text-slate-100", children: formatDate(tender.closingDate) })] })), tender.parsedAt && (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-slate-500", children: "Parsed On" }), _jsx("dd", { className: "text-slate-900 dark:text-slate-100", children: formatDate(tender.parsedAt) })] })), tender.sourceURL && (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-slate-500", children: "Source URL" }), _jsx("dd", { children: _jsx("a", { href: tender.sourceURL, target: "_blank", rel: "noreferrer", className: "text-casper-blue hover:underline", children: "Open source" }) })] })), tender.boqDocumentURL && (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-slate-500", children: "BOQ Document" }), _jsx("dd", { children: _jsx("a", { href: tender.boqDocumentURL, target: "_blank", rel: "noreferrer", className: "text-casper-blue hover:underline", children: "Open BOQ" }) })] }))] }), rawTextPreview && (_jsxs("div", { className: "mt-4", children: [_jsx("p", { className: "text-xs font-medium text-slate-500 mb-1", children: "Description / Raw Text" }), _jsx("p", { className: "text-sm text-slate-700 dark:text-slate-300", children: showFullText || !showRawTextToggle ? rawTextPreview : `${rawTextPreview.slice(0, 300)}…` }), showRawTextToggle && (_jsx("button", { type: "button", onClick: () => setShowFullText((v) => !v), className: "mt-1 text-xs text-casper-blue hover:underline", children: showFullText ? "Show less" : "Show more" }))] }))] }), _jsx(ExplanationPanel, { tenderId: tender._id, tenderNumber: tender.tenderNumber, audit: audit, onGenerateEvidencePdf: onExportPdf }), tender.costBreakdown && (_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h2", { className: "text-lg font-semibold", children: _jsx(TransText, { text: "Cost Breakdown" }) }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: "Estimated composition of the quoted tender value." }), _jsx("div", { className: "mt-4 grid grid-cols-1 gap-3 md:grid-cols-3", children: [
                                    ["Materials", tender.costBreakdown.materialsCostINR],
                                    ["Labour & Equipment", tender.costBreakdown.labourCostINR],
                                    ["Machinery", tender.costBreakdown.machineryCostINR],
                                    ["Overheads", tender.costBreakdown.overheadCostINR],
                                    ["Contractor Profit", tender.costBreakdown.contractorProfitINR],
                                    ["Contingency", tender.costBreakdown.contingencyINR],
                                    ["CGST", tender.costBreakdown.cgstINR],
                                    ["SGST", tender.costBreakdown.sgstINR],
                                    ["IGST", tender.costBreakdown.igstINR]
                                ].map(([label, amount]) => (_jsxs("div", { className: "rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950", children: [_jsx("div", { className: "text-xs text-slate-500", children: label }), _jsx("div", { className: "mt-1 text-base font-semibold", children: formatCurrency(amount) })] }, label))) })] })), audit && (_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsx("h2", { className: "text-lg font-semibold", children: _jsx(TransText, { text: "Audit Summary" }) }), _jsx("span", { className: `rounded px-2 py-1 text-xs font-medium uppercase ${riskBadgeClass[audit.riskLevel]}`, children: audit.riskLevel })] }), _jsxs("div", { className: "mt-3 grid grid-cols-1 gap-4 md:grid-cols-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500", children: "Overall inflation" }), _jsxs("p", { className: "text-3xl font-bold", children: [audit.overallInflationPct.toFixed(1), "%"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500", children: "Overpricing estimate" }), _jsx("p", { className: "text-lg font-semibold", children: `${formatCrore(audit.totalOverpricedINR)} overpriced` })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500", children: "Audit date" }), _jsx("p", { className: "text-sm font-medium", children: `Audited on ${formatDate(audit.createdAt ?? audit.auditedAt ?? Date.now())}` })] })] }), audit.summary && (_jsx("p", { className: "mt-3 rounded bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300", children: audit.summary }))] })), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold", children: _jsx(TransText, { text: "Line Items" }) }), lineItems.some(getFlag) && (_jsx("p", { className: "text-xs text-slate-500", children: "Click a flagged item for deep analysis" }))] }), lineItems.length > 0 ? (_jsx("div", { className: "mt-3 overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-slate-500", children: [_jsx("th", { className: "text-left", children: "Material" }), _jsx("th", { children: "Qty" }), _jsx("th", { children: "Unit" }), _jsx("th", { children: "Quoted \u20B9" }), _jsx("th", { children: "Total \u20B9" }), _jsx("th", { children: "Market \u20B9" }), _jsx("th", { children: "Inflation %" }), _jsx("th", { children: "Flag" })] }) }), _jsx("tbody", { children: lineItems.map((item) => (_jsxs("tr", { className: `border-t border-slate-200 dark:border-slate-800 ${getFlag(item) ? "cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20" : ""}`, onClick: () => { if (getFlag(item))
                                                    setDrillDownItem(item.description); }, title: getFlag(item) ? "Click for detailed inflation analysis" : undefined, children: [_jsx("td", { className: "py-2 text-left", children: item.description }), _jsx("td", { className: "text-center", children: item.quantity }), _jsx("td", { className: "text-center", children: item.unit }), _jsx("td", { className: "text-center", children: formatCurrency(item.quotedRateINR) }), _jsx("td", { className: "text-center", children: formatCurrency(item.totalCostINR ?? item.quantity * item.quotedRateINR) }), _jsx("td", { className: "text-center", children: item.marketRateINR === null ? "-" : formatCurrency(item.marketRateINR) }), _jsx("td", { className: `text-center font-medium ${inflationTextClass(item.inflationPct)}`, children: item.inflationPct === null ? "-" : `${item.inflationPct.toFixed(1)}%` }), _jsx("td", { className: "text-center", children: getFlag(item) ? (_jsx("span", { className: "text-red-600 underline decoration-dotted cursor-pointer", title: "Click row for drill-down", children: "\u2691" })) : "-" })] }, `${item.description}-${item.quantity}-${item.unit}`))) })] }) })) : audit ? (_jsx("p", { className: "mt-3 text-sm text-slate-500", children: "Audit complete \u2014 no line items were extracted from this tender's text." })) : (_jsx("p", { className: "mt-3 text-sm text-slate-500", children: "No line items extracted for this tender." }))] }), audit && lineItems.length === 0 && audit.flags && audit.flags.length > 0 && (_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Audit Flags" }), _jsx("div", { className: "mt-3 overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-slate-500", children: [_jsx("th", { className: "text-left", children: "Flag Type" }), _jsx("th", { className: "text-left", children: "Description" }), _jsx("th", { children: "Severity" })] }) }), _jsx("tbody", { children: audit.flags.map((flag, i) => (_jsxs("tr", { className: "border-t border-slate-200 dark:border-slate-800", children: [_jsx("td", { className: "py-2 text-left font-mono text-xs", children: flag.lineItemDescription }), _jsx("td", { className: "py-2 text-left text-xs", children: flag.explanation }), _jsxs("td", { className: `py-2 text-center text-xs font-medium ${inflationTextClass(flag.inflationPct)}`, children: [flag.inflationPct.toFixed(1), "%"] })] }, i))) })] }) })] }))] })), activeTab === "Similar Tenders" && (_jsx(SimilarTendersTab, { tenderId: tender._id, tender: tender })), activeTab === "Timeline" && (_jsx(AuditTimelineTab, { tender: tender })), drillDownItem && (_jsx(ItemDrillDownDrawer, { tenderId: tender._id, itemName: drillDownItem, onClose: () => setDrillDownItem(null) })), showExportModal && (_jsx(ExportModal, { tender: tender, onClose: () => { setShowExportModal(false); setActiveTab("Overview"); } }))] }));
}
