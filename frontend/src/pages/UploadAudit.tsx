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

const VerdictBadge = ({ verdict }: { verdict: string | null | undefined }) => {
  if (!verdict) return null;
  const styles: Record<string, string> = {
    overpriced: "bg-red-100 text-red-700 border-red-300",
    neutral: "bg-slate-100 text-slate-700 border-slate-300",
    underpriced: "bg-green-100 text-green-700 border-green-300"
  };
  return (
    <span className={`inline-block rounded-full border px-3 py-0.5 text-xs font-semibold capitalize ${styles[verdict] ?? styles.neutral}`}>
      {verdict}
    </span>
  );
};

export const UploadAudit = (): JSX.Element => {
  const [uploadTender, { isLoading, error: uploadError }] = useUploadTenderMutation();
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    department: "",
    state: "national",
    projectType: "road",
    tenderNumber: "",
    totalEstimatedCostINR: "",
    lengthKm: ""
  });
  const [tenderId, setTenderId] = useState<string | null>(null);
  const [auditFetchId, setAuditFetchId] = useState<string | null>(null);
  const [hasRetried404, setHasRetried404] = useState(false);
  const [stopTenderPolling, setStopTenderPolling] = useState(false);

  const textFields: Array<{ key: keyof typeof form; label: string }> = [
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

  const { data: audit, error: auditError, refetch: refetchAudit } = useGetAuditByTenderIdQuery(
    auditFetchId ? auditFetchId : skipToken
  );

  // Stop polling once the tender reaches any terminal status
  useEffect(() => {
    if (!tenderId || !tender) return;
    if (!TERMINAL_STATUSES.has(tender.status)) return;
    setStopTenderPolling(true);
    const timer = window.setTimeout(() => {
      setAuditFetchId(tenderId);
      setHasRetried404(false);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [tender, tenderId]);

  useEffect(() => {
    if (!auditFetchId || hasRetried404 || !auditError || !("status" in auditError)) return;
    if (auditError.status !== 404) return;
    const timer = window.setTimeout(() => {
      setHasRetried404(true);
      void refetchAudit();
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [auditError, auditFetchId, hasRetried404, refetchAudit]);

  const activeStep = useMemo(() => {
    if (isLoading) return 2;
    if (!tenderId) return 0;
    if (!tender || !TERMINAL_STATUSES.has(tender.status)) return 4;
    if (!audit) return 4;
    return 5;
  }, [isLoading, tenderId, tender, audit]);

  const onSubmit = async (): Promise<void> => {
    if (!file) return;
    setTenderId(null);
    setAuditFetchId(null);
    setStopTenderPolling(false);
    const formData = new FormData();
    formData.append("file", file);
    Object.entries(form).forEach(([key, value]) => {
      if (value.length > 0) formData.append(key, value);
    });
    const result = await uploadTender(formData);
    if ("data" in result && result.data) {
      setStopTenderPolling(false);
      setTenderId(result.data._id);
    }
  };

  const hasResult = Boolean(tender && TERMINAL_STATUSES.has(tender.status));
  const isAnalysing = Boolean(tenderId && !hasResult && !uploadError);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {/* ── Upload form ── */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-semibold">Upload Tender PDF</h2>

        <label className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-400 p-6 text-sm text-slate-500 dark:border-slate-700">
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "Drop PDF or click to choose"}
        </label>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {textFields.map(({ key, label }) => (
            <input
              key={key}
              value={form[key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              placeholder={label}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          ))}
          <select
            value={form.state}
            onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="national">national</option>
            {INDIA_STATES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={form.projectType}
            onChange={(e) => setForm((prev) => ({ ...prev, projectType: e.target.value }))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="road">road</option>
            <option value="bridge">bridge</option>
            <option value="railway">railway</option>
            <option value="building">building</option>
            <option value="drainage">drainage</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={!file || isLoading}
          className="mt-4 rounded-lg bg-casper-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isLoading ? "Uploading…" : "Analyze tender"}
        </button>

        {uploadError && (
          <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            Upload failed — check the server is running and the file is a valid PDF.
          </p>
        )}

        {/* Progress steps */}
        <ol className="mt-4 space-y-2 text-sm">
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  index + 1 < activeStep
                    ? "bg-casper-green text-white"
                    : index + 1 === activeStep
                      ? "animate-pulse bg-casper-blue text-white"
                      : "bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                }`}
              >
                {index + 1 < activeStep ? "✓" : index + 1}
              </span>
              <span className={index + 1 === activeStep ? "font-medium" : ""}>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Audit result ── */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-semibold">Audit Result</h2>

        {/* Waiting / analysing state */}
        {isAnalysing && !audit && (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">AI is analysing the document… this can take up to 90 seconds with local Ollama.</p>
            <div className="skeleton h-8" />
            <div className="skeleton h-20" />
            <div className="skeleton h-16" />
          </div>
        )}

        {/* Error from tender status */}
        {tender?.status === "error" && !audit && (
          <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            The audit job encountered an error. Check the backend logs and make sure Ollama is running.
          </p>
        )}

        {/* No result yet, nothing uploaded */}
        {!tenderId && !audit && (
          <p className="text-sm text-slate-400">Upload a PDF to see the audit result here.</p>
        )}

        {/* Audit result */}
        {audit && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge riskLevel={audit.riskLevel as "critical" | "high" | "medium" | "low"} />
              <VerdictBadge verdict={audit.claudeVerdict} />
            </div>

            {tender && (
              <SourceRef
                source={audit.mlModelVersion ?? "ollama"}
                sourceURL={tender.sourceURL}
                fetchedAt={tender.parsedAt}
                className="mt-2"
              />
            )}

            {/* Summary */}
            {audit.summary && (
              <p className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950">
                {audit.summary}
              </p>
            )}

            {/* Headline numbers */}
            <div className="mt-3 flex gap-6">
              <div>
                <p className="text-2xl font-bold text-casper-red">{audit.overallInflationPct.toFixed(1)}%</p>
                <p className="text-xs text-slate-500">avg overpricing</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-casper-red">{formatCrore(audit.totalOverpricedINR)}</p>
                <p className="text-xs text-slate-500">total overpriced</p>
              </div>
            </div>

            {/* Flagged items table */}
            {audit.flags && audit.flags.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500">
                      <th className="pb-1">Item</th>
                      <th className="pb-1">Quoted</th>
                      <th className="pb-1">Market</th>
                      <th className="pb-1">Deviation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.flags.map((flag, i) => (
                      <tr key={`${flag.lineItemDescription}-${i}`} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="py-1.5 pr-2 text-xs">{flag.lineItemDescription}</td>
                        <td className="py-1.5 pr-2 text-xs">{formatCurrency(flag.quotedRateINR)}</td>
                        <td className="py-1.5 pr-2 text-xs">{formatCurrency(flag.marketRateINR)}</td>
                        <td className={`py-1.5 text-xs font-semibold ${flag.inflationPct > 0 ? "text-red-600" : "text-green-600"}`}>
                          {flag.inflationPct > 0 ? "+" : ""}{flag.inflationPct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Risk signals */}
            {audit.riskSignals && audit.riskSignals.length > 0 && (
              <div className="mt-4">
                <p className="mb-1 text-xs font-semibold uppercase text-slate-400">Risk signals</p>
                <ul className="space-y-1">
                  {audit.riskSignals.map((signal, i) => (
                    <li key={i} className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      ⚠ {signal}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendation */}
            {audit.recommendation && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
                <p className="mb-0.5 text-xs font-semibold uppercase text-blue-500">Recommendation</p>
                <p className="text-sm text-blue-900 dark:text-blue-100">{audit.recommendation}</p>
              </div>
            )}

            {/* Explanation cards (fallback when no rich fields) */}
            {(!audit.riskSignals || audit.riskSignals.length === 0) && audit.flags.length > 0 && (
              <div className="mt-4 space-y-2">
                {audit.flags.map((flag) => (
                  <p key={flag.explanation} className="rounded-lg border border-casper-red/30 bg-casper-red/10 p-2 text-xs">
                    {flag.explanation}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
