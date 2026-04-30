import { useSearchParams, useNavigate } from "react-router-dom";
import { useCompareTendersQuery } from "../features/tenders/tendersApi";
import { RiskBadge } from "../components/RiskBadge";
import { formatCrore, formatDate } from "../utils/format";

const FIELD_LABELS: Record<string, string> = {
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

const AUDIT_FIELD_LABELS: Record<string, string> = {
  riskLevel: "Risk Level",
  overallInflationPct: "Overall Inflation",
  totalOverpricedINR: "Total Overpriced",
};

const formatValue = (field: string, value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "totalEstimatedCostINR") return formatCrore(Number(value));
  if (field === "totalOverpricedINR") return formatCrore(Number(value));
  if (field === "dataCompletenessScore") return `${value}%`;
  if (field === "overallInflationPct") return `${Number(value).toFixed(1)}%`;
  if (field === "publishedDate" || field === "closingDate") return formatDate(String(value));
  return String(value);
};

export const TenderComparison = (): JSX.Element => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const idsParam = searchParams.get("ids") ?? "";
  const ids = idsParam.split(",").filter(Boolean);

  const { data, isLoading, error } = useCompareTendersQuery(ids, { skip: ids.length < 2 });

  if (ids.length < 2) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-slate-500">Select at least 2 tenders from the Tender Browser to compare.</p>
        <button type="button" onClick={() => navigate("/tenders")} className="mt-4 rounded bg-casper-blue px-4 py-2 text-sm text-white">
          Go to Tender Browser
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-16" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950">
        <p className="text-red-600 dark:text-red-400">Failed to load comparison data.</p>
        <button type="button" onClick={() => navigate("/tenders")} className="mt-4 rounded bg-casper-blue px-4 py-2 text-sm text-white">
          Back to Tenders
        </button>
      </div>
    );
  }

  const { tenders, highlights } = data;

  const tenderFields = Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>;
  const auditFields = Object.keys(AUDIT_FIELD_LABELS) as Array<keyof typeof AUDIT_FIELD_LABELS>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate("/tenders")} className="text-sm text-casper-blue hover:underline">
          ← Back to Tenders
        </button>
        <h2 className="text-lg font-semibold">Side-by-Side Comparison</h2>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700">{tenders.length} tenders</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="sticky left-0 bg-slate-100 px-4 py-3 text-left font-semibold text-slate-500 dark:bg-slate-800 w-40">Field</th>
              {tenders.map((t) => (
                <th key={t._id} className="px-4 py-3 text-left font-semibold min-w-[220px]">
                  <button
                    type="button"
                    onClick={() => navigate(`/tenders/${t._id}`)}
                    className="text-casper-blue hover:underline text-left"
                  >
                    {t.tenderNumber}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Tender fields */}
            {tenderFields.map((field) => {
              const isHighlighted = highlights[field];
              return (
                <tr
                  key={field}
                  className={`border-t border-slate-200 dark:border-slate-700 ${isHighlighted ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}
                >
                  <td className="sticky left-0 bg-inherit px-4 py-2.5 font-medium text-slate-500 dark:bg-slate-900 text-xs uppercase tracking-wide">
                    {FIELD_LABELS[field]}
                    {isHighlighted && (
                      <span className="ml-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white" title="Values differ">!</span>
                    )}
                  </td>
                  {tenders.map((t) => {
                    const value = (t as unknown as Record<string, unknown>)[field];
                    return (
                      <td key={t._id} className="px-4 py-2.5">
                        {field === "status" ? (
                          <RiskBadge riskLevel={String(value) === "flagged" ? "high" : String(value) === "clean" ? "clean" : "pending"} />
                        ) : (
                          <span className="capitalize">{formatValue(field, value)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Divider */}
            <tr>
              <td colSpan={tenders.length + 1} className="bg-slate-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:bg-slate-800">
                Audit Results
              </td>
            </tr>

            {/* Audit fields */}
            {auditFields.map((field) => {
              const isHighlighted = highlights[`audit.${field}`];
              return (
                <tr key={field} className={`border-t border-slate-200 dark:border-slate-700 ${isHighlighted ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}>
                  <td className="sticky left-0 bg-inherit px-4 py-2.5 font-medium text-slate-500 dark:bg-slate-900 text-xs uppercase tracking-wide">
                    {AUDIT_FIELD_LABELS[field]}
                  </td>
                  {tenders.map((t) => {
                    const auditRecord = (t as any).audit as Record<string, unknown> | null;
                    const value = auditRecord ? auditRecord[field] : null;
                    return (
                      <td key={t._id} className="px-4 py-2.5">
                        {field === "riskLevel" && value ? (
                          <RiskBadge riskLevel={String(value) as "low" | "medium" | "high" | "critical"} />
                        ) : (
                          <span>{formatValue(field, value)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Line item count row */}
            <tr className="border-t border-slate-200 dark:border-slate-700">
              <td className="sticky left-0 bg-inherit px-4 py-2.5 font-medium text-slate-500 dark:bg-slate-900 text-xs uppercase tracking-wide">Line Items</td>
              {tenders.map((t) => (
                <td key={t._id} className="px-4 py-2.5">{t.lineItems?.length ?? 0} items</td>
              ))}
            </tr>

            {/* Flagged items row */}
            <tr className="border-t border-slate-200 dark:border-slate-700">
              <td className="sticky left-0 bg-inherit px-4 py-2.5 font-medium text-slate-500 dark:bg-slate-900 text-xs uppercase tracking-wide">Flagged Items</td>
              {tenders.map((t) => {
                const flaggedCount = t.lineItems?.filter((item) => item.flagged).length ?? 0;
                return (
                  <td key={t._id} className={`px-4 py-2.5 font-semibold ${flaggedCount > 0 ? "text-casper-red" : "text-casper-green"}`}>
                    {flaggedCount}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <p className="text-xs text-slate-400">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white">!</span>
        {" "}Highlighted rows indicate fields with significant differences between tenders.
      </p>
    </div>
  );
};

export default TenderComparison;
