import { useState } from "react";
import { useExportReportMutation } from "./auditsApi";
import { showToast } from "../../utils/toast";
import { useAppSelector } from "../../app/hooks";

interface Props {
  tender: {
    _id: string;
    tenderNumber: string;
    vendorName?: string | null;
    state?: string;
    stateCode?: string | null;
  };
  onClose: () => void;
}

type ReportType = "tender" | "vendor" | "item" | "regional";
type ReportFormat = "pdf" | "csv";

const REPORT_OPTIONS: Array<{ type: ReportType; label: string; desc: string; requiresVendor?: boolean }> = [
  { type: "tender", label: "Tender Audit Report", desc: "Full audit for this tender — all items, benchmarks, flags, risk score, AI summary." },
  { type: "vendor", label: "Vendor Due Diligence Report", desc: "All tenders by this vendor across India — win rate, flag history, cross-state activity.", requiresVendor: true },
  { type: "item", label: "Item Price Report", desc: "Price history for the most flagged item in this region." },
  { type: "regional", label: "Regional Compliance Report", desc: "Summary for this state — total tenders, flagged count, estimated overcharge, top vendors." }
];

export function ExportModal({ tender, onClose }: Props): JSX.Element {
  const [reportType, setReportType] = useState<ReportType>("tender");
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [downloadURL, setDownloadURL] = useState<string | null>(null);
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  const [exportReport, { isLoading }] = useExportReportMutation();

  const getReferenceId = (): string => {
    if (reportType === "tender") return tender._id;
    if (reportType === "vendor") return tender.vendorName ?? "";
    if (reportType === "regional") return tender.stateCode ?? tender.state ?? "";
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
    } catch {
      showToast("error", "Failed to generate report. Try again.");
    }
  };

  const handleDownload = async () => {
    if (!downloadURL || !accessToken) return;
    try {
      const res = await fetch(downloadURL, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CASPER_${reportType}_${tender.tenderNumber}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showToast("error", "Failed to download file.");
    }
  };

  const selectedOption = REPORT_OPTIONS.find((o) => o.type === reportType);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold">Export Audit Report</h2>
            <p className="text-xs text-slate-500 mt-0.5">{tender.tenderNumber}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Report type */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide block mb-2">Report Type</label>
            <div className="space-y-2">
              {REPORT_OPTIONS.map((opt) => {
                const disabled = opt.requiresVendor && !tender.vendorName;
                return (
                  <label
                    key={opt.type}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                      reportType === opt.type
                        ? "border-casper-blue bg-blue-50 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="radio"
                      name="reportType"
                      value={opt.type}
                      checked={reportType === opt.type}
                      onChange={() => !disabled && setReportType(opt.type)}
                      disabled={disabled}
                      className="mt-0.5 accent-casper-blue"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{opt.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                      {disabled && <div className="text-xs text-orange-500 mt-0.5">No vendor data for this tender</div>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide block mb-2">Format</label>
            <div className="flex gap-2">
              {(["pdf", "csv"] as ReportFormat[]).map((f) => (
                <label key={f} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${format === f ? "border-casper-blue bg-blue-50 text-casper-blue dark:bg-blue-950/30" : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400"}`}>
                  <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="accent-casper-blue" />
                  {f.toUpperCase()}
                  <span className="text-xs text-slate-400">{f === "pdf" ? "(formatted)" : "(raw data)"}</span>
                </label>
              ))}
            </div>
          </div>

          {/* What's included preview */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">What's included:</p>
            {reportType === "tender" && <ul className="text-xs text-slate-500 space-y-0.5 list-disc list-inside"><li>Tender summary & metadata</li><li>All line items with price benchmarks</li><li>Audit flags & AI explanations</li><li>Risk level & overpricing estimate</li><li>AI summary & recommendations</li></ul>}
            {reportType === "vendor" && <ul className="text-xs text-slate-500 space-y-0.5 list-disc list-inside"><li>All tenders by {tender.vendorName}</li><li>Flag rate & risk score history</li><li>Cross-state activity map</li><li>Average inflation per tender</li></ul>}
            {reportType === "item" && <ul className="text-xs text-slate-500 space-y-0.5 list-disc list-inside"><li>Price history across all tenders</li><li>Market citations & benchmarks</li><li>Inflation trend over time</li></ul>}
            {reportType === "regional" && <ul className="text-xs text-slate-500 space-y-0.5 list-disc list-inside"><li>All tenders in {tender.state}</li><li>Flagged count & estimated overcharge</li><li>Top vendors by tender count</li></ul>}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {!downloadURL ? (
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-casper-blue px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 hover:bg-blue-700"
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating {format.toUpperCase()} Report…
                  </>
                ) : (
                  `Generate ${format.toUpperCase()} Report`
                )}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
                  Report generated successfully.
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download {format.toUpperCase()} Report
                </button>
                <button
                  type="button"
                  onClick={() => { setDownloadURL(null); }}
                  className="w-full rounded-xl border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                >
                  Generate Another Report
                </button>
              </div>
            )}
            <button type="button" onClick={onClose} className="w-full rounded-xl border border-slate-200 px-5 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
