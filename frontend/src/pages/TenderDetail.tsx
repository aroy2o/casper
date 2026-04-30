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

type RiskLevel = "critical" | "high" | "medium" | "low";
type AuditTab = "Overview" | "Similar Tenders" | "Timeline" | "Export";

interface DetailAuditLineItem {
  description: string;
  quantity: number;
  unit: string;
  quotedRateINR: number;
  totalCostINR?: number;
  marketRateINR: number | null;
  inflationPct: number | null;
  isFlag?: boolean;
  flagged?: boolean;
}

interface DetailAuditFlag {
  lineItemDescription: string;
  quotedRateINR: number;
  marketRateINR: number;
  inflationPct: number;
  confidence: number;
  explanation: string;
  humanSummary?: string | null;
  verdict?: string | null;
  topFactors?: Array<{ feature: string; impact: number; direction: string }>;
  riskContribution?: number | null;
}

interface DetailAudit {
  riskLevel: RiskLevel;
  overallInflationPct: number;
  totalOverpricedINR: number;
  createdAt?: string;
  auditedAt?: string;
  summary?: string;
  plainEnglishSummary?: string | null;
  overallVerdict?: string | null;
  explanationVersion?: string | null;
  lineItems?: DetailAuditLineItem[];
  flags?: DetailAuditFlag[];
}

interface TenderCostBreakdown {
  materialsCostINR: number;
  labourCostINR: number;
  machineryCostINR: number;
  overheadCostINR: number;
  contractorProfitINR: number;
  contingencyINR: number;
  cgstINR: number;
  sgstINR: number;
  igstINR: number;
}

interface TenderWithAudit {
  _id: string;
  title: string;
  tenderNumber: string;
  department: string;
  state: string;
  stateCode?: string | null;
  district?: string | null;
  districtCode?: string | null;
  totalEstimatedCostINR: number;
  sourcePortal?: string;
  projectType?: string;
  sourceURL?: string | null;
  detailURL?: string | null;
  organisation?: string | null;
  locationText?: string | null;
  vendorName?: string | null;
  procurementMethod?: "open" | "limited" | "nomination" | "other";
  contractYear?: number | null;
  boqAvailable?: boolean;
  boqDocumentURL?: string | null;
  itemizationStatus?: "none" | "partial" | "detailed";
  dataCompletenessScore?: number;
  costBreakdown?: TenderCostBreakdown | null;
  scrapedQuery?: string | null;
  scrapedYear?: number | null;
  lengthKm?: number | null;
  parsedAt?: string;
  publishedDate?: string | null;
  closingDate?: string | null;
  rawText?: string;
  description?: string;
  errorMessage?: string;
  status: "pending" | "parsing" | "analyzing" | "flagged" | "clean" | "insufficient_data" | "error";
  lineItems?: DetailAuditLineItem[];
  audit?: DetailAudit | null;
}

const statusBadgeClass: Record<TenderWithAudit["status"], string> = {
  flagged: "bg-red-100 text-red-700",
  clean: "bg-emerald-100 text-emerald-700",
  insufficient_data: "bg-amber-100 text-amber-800",
  analyzing: "bg-yellow-100 text-yellow-800",
  pending: "bg-slate-100 text-slate-700",
  parsing: "bg-slate-100 text-slate-700",
  error: "bg-red-100 text-red-600"
};

const riskBadgeClass: Record<RiskLevel, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-emerald-100 text-emerald-700"
};

const inflationTextClass = (inflationPct: number | null | undefined): string => {
  const value = inflationPct ?? 0;
  if (value > 30) return "text-red-600";
  if (value >= 10) return "text-yellow-600";
  return "text-emerald-600";
};

const getFlag = (item: DetailAuditLineItem): boolean => Boolean(item.isFlag ?? item.flagged);

const TABS: AuditTab[] = ["Overview", "Similar Tenders", "Timeline", "Export"];

export default function TenderDetail(): JSX.Element {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AuditTab>("Overview");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
  const [reauditing, setReauditing] = useState(false);
  const [drillDownItem, setDrillDownItem] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  const { data, isLoading, isFetching } = useGetTenderByIdQuery(id, {
    skip: id.length === 0
  });

  const tender = data as TenderWithAudit | undefined;
  const audit = tender?.audit ?? null;
  const lineItems = useMemo(() => {
    const source = audit?.lineItems ?? tender?.lineItems ?? [];
    return [...source].sort((a, b) => {
      const flagDiff = Number(getFlag(b)) - Number(getFlag(a));
      if (flagDiff !== 0) return flagDiff;
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
      if (!response.ok) throw new Error("PDF export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `CASPER-${tender.tenderNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showToast("error", "Failed to export report PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  const onReaudit = async () => {
    if (!tender || !accessToken) return;
    setReauditing(true);
    try {
      await fetch(`/api/tenders/${tender._id}/reaudit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setTimeout(() => window.location.reload(), 4000);
    } catch {
      setReauditing(false);
    }
  };

  if (isLoading || isFetching) {
    return <div className="skeleton h-48" />;
  }

  if (!tender) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm dark:border-slate-800 dark:bg-slate-900">
        Tender not found.
      </div>
    );
  }

  const isProcessing = tender.status === "analyzing" || tender.status === "pending" || tender.status === "parsing";
  const isAudited = tender.status === "flagged" || tender.status === "clean" || tender.status === "insufficient_data";
  const rawTextPreview = tender.description ?? tender.rawText ?? "";
  const showRawTextToggle = rawTextPreview.length > 300;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => navigate(-1)} className="text-sm text-casper-blue hover:underline">
          ← <TransText text="Back to Tenders" />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExportPdf}
            disabled={exportingPdf || !isAudited}
            title={!isAudited ? "Audit required" : undefined}
            className="inline-flex items-center gap-2 rounded bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
          >
            {exportingPdf ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" /> : null}
            <TransText text="Quick PDF" />
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("Export"); setShowExportModal(true); }}
            disabled={!isAudited}
            className="inline-flex items-center gap-2 rounded bg-casper-blue px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            <TransText text="Export Audit Report" />
          </button>
        </div>
      </div>

      {/* Processing / Error banners */}
      {isProcessing && (
        <div className="flex items-center justify-between rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
          <span>This tender is currently being processed. Refresh in a few seconds to see audit results.</span>
          <button type="button" onClick={() => window.location.reload()} className="ml-4 rounded bg-yellow-500 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-600">Refresh</button>
        </div>
      )}
      {tender.status === "error" && (
        <div className="flex items-center justify-between rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
          <span>Audit failed: {tender.errorMessage ?? "Unknown error"}</span>
          <button type="button" onClick={() => void onReaudit()} disabled={reauditing} className="ml-4 rounded bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-60">
            {reauditing ? "Queuing…" : "Retry Audit"}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => { setActiveTab(tab); if (tab === "Export") setShowExportModal(true); }}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-casper-blue text-casper-blue"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Overview */}
      {activeTab === "Overview" && (
        <div className="space-y-4">
          {/* Header section */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">{tender.title}</h1>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded bg-slate-200 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">{tender.tenderNumber}</span>
                  <span className="text-slate-500">{tender.department} • {tender.state}</span>
                </div>
              </div>
              <div className="space-y-2 text-right">
                <p className="text-xl font-semibold">
                  {tender.totalEstimatedCostINR > 0 ? formatCrore(tender.totalEstimatedCostINR) : "—"}
                </p>
                <div className="flex justify-end gap-2">
                  <span className={`rounded px-2 py-1 text-xs font-medium capitalize ${statusBadgeClass[tender.status]}`}>{tender.status}</span>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium capitalize text-slate-700">{tender.sourcePortal ?? "manual"}</span>
                </div>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <dt className="text-slate-500">Tender Number</dt><dd className="font-mono text-slate-900 dark:text-slate-100">{tender.tenderNumber}</dd>
              <dt className="text-slate-500">Department</dt><dd className="text-slate-900 dark:text-slate-100">{tender.department}</dd>
              {tender.organisation && (<><dt className="text-slate-500">Organisation</dt><dd className="text-slate-900 dark:text-slate-100">{tender.organisation}</dd></>)}
              <dt className="text-slate-500">State</dt><dd className="capitalize text-slate-900 dark:text-slate-100">{tender.state}</dd>
              {tender.locationText && (<><dt className="text-slate-500">Location</dt><dd className="text-slate-900 dark:text-slate-100">{tender.locationText}</dd></>)}
              {tender.vendorName && (<><dt className="text-slate-500">Vendor / Contractor</dt><dd className="text-slate-900 dark:text-slate-100">{tender.vendorName}</dd></>)}
              {tender.procurementMethod && (<><dt className="text-slate-500">Procurement Method</dt><dd className="capitalize text-slate-900 dark:text-slate-100">{tender.procurementMethod}</dd></>)}
              {tender.contractYear != null && (<><dt className="text-slate-500">Contract Year</dt><dd className="text-slate-900 dark:text-slate-100">{tender.contractYear}</dd></>)}
              {tender.itemizationStatus && (<><dt className="text-slate-500">Itemization Status</dt><dd className="capitalize text-slate-900 dark:text-slate-100">{tender.itemizationStatus}</dd></>)}
              {typeof tender.dataCompletenessScore === "number" && (<><dt className="text-slate-500">Data Completeness</dt><dd className="text-slate-900 dark:text-slate-100">{tender.dataCompletenessScore}%</dd></>)}
              {tender.lengthKm != null && (<><dt className="text-slate-500">Length</dt><dd className="text-slate-900 dark:text-slate-100">{tender.lengthKm} km</dd></>)}
              <dt className="text-slate-500">Source Portal</dt><dd className="capitalize text-slate-900 dark:text-slate-100">{tender.sourcePortal ?? "manual"}</dd>
              <dt className="text-slate-500">Project Type</dt><dd className="capitalize text-slate-900 dark:text-slate-100">{tender.projectType ?? "—"}</dd>
              <dt className="text-slate-500">Status</dt><dd><span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass[tender.status]}`}>{tender.status}</span></dd>
              <dt className="text-slate-500">Total Estimated Cost</dt><dd className="text-slate-900 dark:text-slate-100">{tender.totalEstimatedCostINR > 0 ? formatCrore(tender.totalEstimatedCostINR) : "—"}</dd>
              {tender.publishedDate && (<><dt className="text-slate-500">Opening Date</dt><dd className="text-slate-900 dark:text-slate-100">{formatDate(tender.publishedDate)}</dd></>)}
              {tender.closingDate && (<><dt className="text-slate-500">Closing Date</dt><dd className="text-slate-900 dark:text-slate-100">{formatDate(tender.closingDate)}</dd></>)}
              {tender.parsedAt && (<><dt className="text-slate-500">Parsed On</dt><dd className="text-slate-900 dark:text-slate-100">{formatDate(tender.parsedAt)}</dd></>)}
              {tender.sourceURL && (<><dt className="text-slate-500">Source URL</dt><dd><a href={tender.sourceURL} target="_blank" rel="noreferrer" className="text-casper-blue hover:underline">Open source</a></dd></>)}
              {tender.boqDocumentURL && (<><dt className="text-slate-500">BOQ Document</dt><dd><a href={tender.boqDocumentURL} target="_blank" rel="noreferrer" className="text-casper-blue hover:underline">Open BOQ</a></dd></>)}
            </dl>
            {rawTextPreview && (
              <div className="mt-4">
                <p className="text-xs font-medium text-slate-500 mb-1">Description / Raw Text</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {showFullText || !showRawTextToggle ? rawTextPreview : `${rawTextPreview.slice(0, 300)}…`}
                </p>
                {showRawTextToggle && (
                  <button type="button" onClick={() => setShowFullText((v) => !v)} className="mt-1 text-xs text-casper-blue hover:underline">
                    {showFullText ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            )}
          </section>

          <ExplanationPanel
            tenderId={tender._id}
            tenderNumber={tender.tenderNumber}
            audit={audit}
            onGenerateEvidencePdf={onExportPdf}
          />

          {/* Cost breakdown */}
          {tender.costBreakdown && (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-semibold"><TransText text="Cost Breakdown" /></h2>
              <p className="mt-1 text-xs text-slate-500">Estimated composition of the quoted tender value.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {([
                  ["Materials", tender.costBreakdown.materialsCostINR],
                  ["Labour & Equipment", tender.costBreakdown.labourCostINR],
                  ["Machinery", tender.costBreakdown.machineryCostINR],
                  ["Overheads", tender.costBreakdown.overheadCostINR],
                  ["Contractor Profit", tender.costBreakdown.contractorProfitINR],
                  ["Contingency", tender.costBreakdown.contingencyINR],
                  ["CGST", tender.costBreakdown.cgstINR],
                  ["SGST", tender.costBreakdown.sgstINR],
                  ["IGST", tender.costBreakdown.igstINR]
                ] as [string, number][]).map(([label, amount]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="mt-1 text-base font-semibold">{formatCurrency(amount)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Audit summary */}
          {audit && (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold"><TransText text="Audit Summary" /></h2>
                <span className={`rounded px-2 py-1 text-xs font-medium uppercase ${riskBadgeClass[audit.riskLevel]}`}>{audit.riskLevel}</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div><p className="text-xs text-slate-500">Overall inflation</p><p className="text-3xl font-bold">{audit.overallInflationPct.toFixed(1)}%</p></div>
                <div><p className="text-xs text-slate-500">Overpricing estimate</p><p className="text-lg font-semibold">{`${formatCrore(audit.totalOverpricedINR)} overpriced`}</p></div>
                <div><p className="text-xs text-slate-500">Audit date</p><p className="text-sm font-medium">{`Audited on ${formatDate(audit.createdAt ?? audit.auditedAt ?? Date.now())}`}</p></div>
              </div>
              {audit.summary && (
                <p className="mt-3 rounded bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">{audit.summary}</p>
              )}
            </section>
          )}

          {/* Line items — click flagged item to open drill-down */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold"><TransText text="Line Items" /></h2>
              {lineItems.some(getFlag) && (
                <p className="text-xs text-slate-500">Click a flagged item for deep analysis</p>
              )}
            </div>
            {lineItems.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="text-left">Material</th>
                      <th>Qty</th><th>Unit</th><th>Quoted ₹</th><th>Total ₹</th><th>Market ₹</th><th>Inflation %</th><th>Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr
                        key={`${item.description}-${item.quantity}-${item.unit}`}
                        className={`border-t border-slate-200 dark:border-slate-800 ${getFlag(item) ? "cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20" : ""}`}
                        onClick={() => { if (getFlag(item)) setDrillDownItem(item.description); }}
                        title={getFlag(item) ? "Click for detailed inflation analysis" : undefined}
                      >
                        <td className="py-2 text-left">{item.description}</td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-center">{item.unit}</td>
                        <td className="text-center">{formatCurrency(item.quotedRateINR)}</td>
                        <td className="text-center">{formatCurrency(item.totalCostINR ?? item.quantity * item.quotedRateINR)}</td>
                        <td className="text-center">{item.marketRateINR === null ? "-" : formatCurrency(item.marketRateINR)}</td>
                        <td className={`text-center font-medium ${inflationTextClass(item.inflationPct)}`}>
                          {item.inflationPct === null ? "-" : `${item.inflationPct.toFixed(1)}%`}
                        </td>
                        <td className="text-center">
                          {getFlag(item) ? (
                            <span className="text-red-600 underline decoration-dotted cursor-pointer" title="Click row for drill-down">⚑</span>
                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : audit ? (
              <p className="mt-3 text-sm text-slate-500">Audit complete — no line items were extracted from this tender&apos;s text.</p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No line items extracted for this tender.</p>
            )}
          </section>

          {/* Raw audit flags */}
          {audit && lineItems.length === 0 && audit.flags && audit.flags.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-semibold">Audit Flags</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500"><th className="text-left">Flag Type</th><th className="text-left">Description</th><th>Severity</th></tr>
                  </thead>
                  <tbody>
                    {audit.flags.map((flag, i) => (
                      <tr key={i} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="py-2 text-left font-mono text-xs">{flag.lineItemDescription}</td>
                        <td className="py-2 text-left text-xs">{flag.explanation}</td>
                        <td className={`py-2 text-center text-xs font-medium ${inflationTextClass(flag.inflationPct)}`}>{flag.inflationPct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Tab: Similar Tenders */}
      {activeTab === "Similar Tenders" && (
        <SimilarTendersTab tenderId={tender._id} tender={tender} />
      )}

      {/* Tab: Timeline */}
      {activeTab === "Timeline" && (
        <AuditTimelineTab tender={tender} />
      )}

      {/* Item Drill-Down Drawer */}
      {drillDownItem && (
        <ItemDrillDownDrawer
          tenderId={tender._id}
          itemName={drillDownItem}
          onClose={() => setDrillDownItem(null)}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          tender={tender}
          onClose={() => { setShowExportModal(false); setActiveTab("Overview"); }}
        />
      )}
    </div>
  );
}
