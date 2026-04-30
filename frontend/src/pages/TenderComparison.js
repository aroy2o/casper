import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useCompareTendersQuery } from "../features/tenders/tendersApi";
import { RiskBadge } from "../components/RiskBadge";
import { formatCrore, formatDate } from "../utils/format";
const FIELD_LABELS = {
    title: "Title",
    tenderNumber: "Tender #",
    department: "Department",
    state: "State",
    district: "District",
    projectType: "Project Type",
    procurementMethod: "Procurement",
    vendorName: "Vendor",
    totalEstimatedCostINR: "Estimated Cost",
    dataCompletenessScore: "Data Completeness",
    publishedDate: "Published",
    closingDate: "Closing",
    status: "Status",
    organisation: "Organisation",
    sourcePortal: "Source Portal",
    lengthKm: "Length (km)",
};
const AUDIT_FIELD_LABELS = {
    riskLevel: "Risk Level",
    overallInflationPct: "Overall Inflation",
    totalOverpricedINR: "Total Overpriced",
};
const formatValue = (field, value) => {
    if (value === null || value === undefined || value === "")
        return "—";
    if (field === "totalEstimatedCostINR")
        return formatCrore(Number(value));
    if (field === "totalOverpricedINR")
        return formatCrore(Number(value));
    if (field === "dataCompletenessScore")
        return `${value}%`;
    if (field === "overallInflationPct")
        return `${Number(value).toFixed(1)}%`;
    if (field === "publishedDate" || field === "closingDate")
        return formatDate(String(value));
    return String(value);
};
export const TenderComparison = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const idsParam = searchParams.get("ids") ?? "";
    const ids = idsParam.split(",").filter(Boolean);
    const { data, isLoading, error } = useCompareTendersQuery(ids, { skip: ids.length < 2 });
    if (ids.length < 2) {
        return (_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900", children: [_jsx("p", { className: "text-slate-500", children: "Select at least 2 tenders from the Tender Browser to compare." }), _jsx("button", { type: "button", onClick: () => navigate("/tenders"), className: "mt-4 rounded bg-casper-blue px-4 py-2 text-sm text-white", children: "Go to Tender Browser" })] }));
    }
    if (isLoading) {
        return (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "skeleton h-16" }), _jsx("div", { className: "skeleton h-64" })] }));
    }
    if (error || !data) {
        return (_jsxs("div", { className: "rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950", children: [_jsx("p", { className: "text-red-600 dark:text-red-400", children: "Failed to load comparison data." }), _jsx("button", { type: "button", onClick: () => navigate("/tenders"), className: "mt-4 rounded bg-casper-blue px-4 py-2 text-sm text-white", children: "Back to Tenders" })] }));
    }
    const { tenders, highlights } = data;
    const tenderFields = Object.keys(FIELD_LABELS);
    const auditFields = Object.keys(AUDIT_FIELD_LABELS);
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { type: "button", onClick: () => navigate("/tenders"), className: "text-sm text-casper-blue hover:underline", children: "\u2190 Back to Tenders" }), _jsx("h2", { className: "text-lg font-semibold", children: "Side-by-Side Comparison" }), _jsxs("span", { className: "rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700", children: [tenders.length, " tenders"] })] }), _jsx("div", { className: "overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200 dark:border-slate-700", children: [_jsx("th", { className: "sticky left-0 bg-slate-100 px-4 py-3 text-left font-semibold text-slate-500 dark:bg-slate-800 w-40", children: "Field" }), tenders.map((t) => (_jsx("th", { className: "px-4 py-3 text-left font-semibold min-w-[220px]", children: _jsx("button", { type: "button", onClick: () => navigate(`/tenders/${t._id}`), className: "text-casper-blue hover:underline text-left", children: t.tenderNumber }) }, t._id)))] }) }), _jsxs("tbody", { children: [tenderFields.map((field) => {
                                    const isHighlighted = highlights[field];
                                    return (_jsxs("tr", { className: `border-t border-slate-200 dark:border-slate-700 ${isHighlighted ? "bg-amber-50 dark:bg-amber-950/30" : ""}`, children: [_jsxs("td", { className: "sticky left-0 bg-inherit px-4 py-2.5 font-medium text-slate-500 dark:bg-slate-900 text-xs uppercase tracking-wide", children: [FIELD_LABELS[field], isHighlighted && (_jsx("span", { className: "ml-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white", title: "Values differ", children: "!" }))] }), tenders.map((t) => {
                                                const value = t[field];
                                                return (_jsx("td", { className: "px-4 py-2.5", children: field === "status" ? (_jsx(RiskBadge, { riskLevel: String(value) === "flagged" ? "high" : String(value) === "clean" ? "clean" : "pending" })) : (_jsx("span", { className: "capitalize", children: formatValue(field, value) })) }, t._id));
                                            })] }, field));
                                }), _jsx("tr", { children: _jsx("td", { colSpan: tenders.length + 1, className: "bg-slate-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:bg-slate-800", children: "Audit Results" }) }), auditFields.map((field) => {
                                    const isHighlighted = highlights[`audit.${field}`];
                                    return (_jsxs("tr", { className: `border-t border-slate-200 dark:border-slate-700 ${isHighlighted ? "bg-amber-50 dark:bg-amber-950/30" : ""}`, children: [_jsx("td", { className: "sticky left-0 bg-inherit px-4 py-2.5 font-medium text-slate-500 dark:bg-slate-900 text-xs uppercase tracking-wide", children: AUDIT_FIELD_LABELS[field] }), tenders.map((t) => {
                                                const auditRecord = t.audit;
                                                const value = auditRecord ? auditRecord[field] : null;
                                                return (_jsx("td", { className: "px-4 py-2.5", children: field === "riskLevel" && value ? (_jsx(RiskBadge, { riskLevel: String(value) })) : (_jsx("span", { children: formatValue(field, value) })) }, t._id));
                                            })] }, field));
                                }), _jsxs("tr", { className: "border-t border-slate-200 dark:border-slate-700", children: [_jsx("td", { className: "sticky left-0 bg-inherit px-4 py-2.5 font-medium text-slate-500 dark:bg-slate-900 text-xs uppercase tracking-wide", children: "Line Items" }), tenders.map((t) => (_jsxs("td", { className: "px-4 py-2.5", children: [t.lineItems?.length ?? 0, " items"] }, t._id)))] }), _jsxs("tr", { className: "border-t border-slate-200 dark:border-slate-700", children: [_jsx("td", { className: "sticky left-0 bg-inherit px-4 py-2.5 font-medium text-slate-500 dark:bg-slate-900 text-xs uppercase tracking-wide", children: "Flagged Items" }), tenders.map((t) => {
                                            const flaggedCount = t.lineItems?.filter((item) => item.flagged).length ?? 0;
                                            return (_jsx("td", { className: `px-4 py-2.5 font-semibold ${flaggedCount > 0 ? "text-casper-red" : "text-casper-green"}`, children: flaggedCount }, t._id));
                                        })] })] })] }) }), _jsxs("p", { className: "text-xs text-slate-400", children: [_jsx("span", { className: "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white", children: "!" }), " ", "Highlighted rows indicate fields with significant differences between tenders."] })] }));
};
export default TenderComparison;
