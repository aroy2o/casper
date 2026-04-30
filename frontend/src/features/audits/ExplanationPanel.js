import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { showToast } from "../../utils/toast";
import { useAppSelector } from "../../app/hooks";
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const deviationColor = (pct) => {
    if (pct > 15)
        return "text-red-600";
    if (pct >= 5)
        return "text-amber-600";
    if (pct < 0)
        return "text-cyan-600";
    return "text-emerald-600";
};
export function ExplanationPanel({ tenderId, tenderNumber, audit, onGenerateEvidencePdf }) {
    const [drafting, setDrafting] = useState(false);
    const token = useAppSelector((state) => state.auth.accessToken);
    const sortedFlags = useMemo(() => [...(audit?.flags ?? [])].sort((a, b) => b.inflationPct - a.inflationPct), [audit?.flags]);
    if (!audit)
        return null;
    const onDraftRti = async () => {
        setDrafting(true);
        try {
            const requestInit = token
                ? { method: "POST", headers: { Authorization: `Bearer ${token}` } }
                : { method: "POST" };
            const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/audits/${tenderId}/draft-rti`, requestInit);
            if (!response.ok) {
                throw new Error(`RTI draft failed: ${response.status}`);
            }
            const pdfBlob = await response.blob();
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `RTI-${tenderNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }
        catch {
            showToast("error", "Unable to draft RTI PDF.");
        }
        finally {
            setDrafting(false);
        }
    };
    return (_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900", children: [_jsxs("div", { className: "rounded-xl bg-white p-4 dark:bg-slate-950", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-slate-500", children: "Overall Verdict" }), _jsxs("div", { className: "mt-1 flex items-center justify-between gap-2", children: [_jsx("h2", { className: "text-xl font-bold", children: audit.overallVerdict ?? audit.riskLevel.toUpperCase() }), _jsxs("span", { className: "text-lg font-semibold", children: [audit.overallInflationPct.toFixed(1), "%"] })] }), _jsx("p", { className: "mt-2 text-sm text-slate-600 dark:text-slate-300", children: audit.plainEnglishSummary ?? "This tender contains pricing deviations from benchmark rates and should be reviewed." })] }), _jsx("div", { className: "mt-4 space-y-3", children: sortedFlags.map((item) => {
                    const contribution = Math.max(0, Math.min(100, ((item.riskContribution ?? 0) * 100)));
                    return (_jsxs("article", { className: "rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium", children: item.lineItemDescription }), _jsxs("p", { className: "text-xs text-slate-500", children: [inr.format(item.quotedRateINR), " vs ", inr.format(item.marketRateINR)] })] }), _jsxs("p", { className: `text-sm font-semibold ${deviationColor(item.inflationPct)}`, children: [item.inflationPct.toFixed(1), "%"] })] }), _jsx("div", { className: "mt-2 h-2 w-full rounded bg-slate-200 dark:bg-slate-800", children: _jsx("div", { className: "h-2 rounded bg-casper-red", style: { width: `${contribution}%` } }) }), _jsx("p", { className: "mt-2 text-xs text-slate-600 dark:text-slate-400", children: item.humanSummary ?? item.explanation })] }, `${item.lineItemDescription}-${item.quotedRateINR}`));
                }) }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-2", children: [_jsx("button", { type: "button", onClick: () => void onGenerateEvidencePdf(), className: "rounded bg-casper-blue px-3 py-2 text-sm font-medium text-white", children: "Generate Evidence PDF" }), _jsx("button", { type: "button", onClick: () => void onDraftRti(), disabled: drafting, className: "rounded border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-700", children: drafting ? "Drafting..." : "Draft RTI PDF" })] })] }));
}
