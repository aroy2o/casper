import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGetTenderByIdQuery, useGetTendersQuery, type TenderFilters } from "../features/tenders/tendersApi";
import { useGetAuditByTenderIdQuery } from "../features/audits/auditsApi";
import { useAppSelector } from "../app/hooks";
import { RiskBadge } from "../components/RiskBadge";
import { formatCrore, formatCurrency, formatDate } from "../utils/format";
import { INDIA_STATES } from "../utils/indiaStates";
import { TransText } from "../components/TransText";

const PROJECT_TYPES = ["road", "bridge", "railway", "building", "drainage", "other"];

export const TenderBrowser = (): JSX.Element => {
  const [filters, setFilters] = useState<TenderFilters>({ page: 1, limit: 20 });
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [showScrapedOnly, setShowScrapedOnly] = useState(false);
  const [tableView, setTableView] = useState(true);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [reauditingId, setReauditingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const token = useAppSelector((state) => state.auth.accessToken);

  const { data: tenders, isLoading, refetch } = useGetTendersQuery(filters);

  const selectedId = params.id ?? "";
  const { data: tender } = useGetTenderByIdQuery(selectedId, {
    skip: selectedId.length === 0,
    pollingInterval: 0,
    refetchOnFocus: false
  });

  const shouldPollAudit = tender?.status === "pending" || tender?.status === "parsing" || tender?.status === "analyzing";
  const { data: audit } = useGetAuditByTenderIdQuery(selectedId, {
    skip: selectedId.length === 0 || tender?.status === "pending" || tender?.status === "parsing",
    pollingInterval: shouldPollAudit ? 3000 : 0,
    refetchOnFocus: false
  });

  useEffect(() => {
    setFilters((f) => ({ ...f, page: 1 }));
  }, [filters.state, filters.status, filters.riskLevel, filters.projectType, filters.vendor, filters.dateFrom, filters.dateTo, filters.costMin, filters.costMax, filters.search]);

  // Debounce search input
  useEffect(() => {
    const t = window.setTimeout(() => {
      setFilters((f) => ({ ...f, ...(searchInput ? { search: searchInput } : {}), page: 1 }) as TenderFilters);
    }, 400);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const list = useMemo(() => {
    let rows = Array.isArray(tenders) ? tenders : [];
    if (showScrapedOnly) rows = rows.filter((row) => Boolean(row.sourceURL));
    return rows;
  }, [tenders, showScrapedOnly]);

  const itemsPerPage = filters.limit ?? 20;

  const detailRisk = audit?.riskLevel ?? (tender?.status === "clean" ? "clean" : tender?.status === "flagged" ? "high" : "pending");

  const toggleCompare = (id: string) => {
    setSelectedForCompare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const handleReaudit = async (id: string) => {
    setReauditingId(id);
    try {
      await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/tenders/${id}/reaudit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      setTimeout(() => {
        void refetch();
        setReauditingId(null);
      }, 4000);
    } catch {
      setReauditingId(null);
    }
  };

  const clearFilters = () => {
    setFilters({ page: 1, limit: 20 });
    setSearchInput("");
    setShowScrapedOnly(false);
  };

  const hasActiveFilters = !!(
    filters.state || filters.district || filters.status || filters.projectType ||
    filters.procurementMethod || filters.vendor || filters.riskLevel ||
    filters.dateFrom || filters.dateTo || filters.costMin || filters.costMax || filters.search
  );

  const renderStatusBadge = (status: string) => {
    if (status === "analyzing" || status === "pending") {
      return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Processing…</span>;
    }
    if (status === "error") {
      return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-600">Error</span>;
    }
    if (status === "insufficient_data") {
      return <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">Insufficient data</span>;
    }
    const level = status === "flagged" ? "high" : status === "clean" ? "clean" : "pending";
    return <RiskBadge riskLevel={level as "high" | "clean" | "pending"} />;
  };

  if (selectedId.length > 0) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => navigate("/tenders")} className="text-sm text-casper-blue hover:underline">
          Back
        </button>
        {!tender ? (
          <div className="skeleton h-32" />
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-bold">{tender.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {tender.tenderNumber} • {formatDate(tender.parsedAt)}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div><p className="text-slate-500">State</p><p className="capitalize">{tender.state}</p></div>
              <div><p className="text-slate-500">Project Type</p><p className="capitalize">{tender.projectType ?? "—"}</p></div>
              <div><p className="text-slate-500">Cost</p><p>{tender.totalEstimatedCostINR != null && !isNaN(tender.totalEstimatedCostINR) && tender.totalEstimatedCostINR > 0 ? formatCrore(tender.totalEstimatedCostINR) : "—"}</p></div>
              <div><p className="text-slate-500">Status</p><RiskBadge riskLevel={detailRisk} /></div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 md:grid-cols-2">
              <p>Tender #: {tender.tenderNumber}</p>
              <p>Department: {tender.department}</p>
              <p>Portal: {tender.sourcePortal ?? "unknown"}</p>
              <p>Organisation: {tender.organisation ?? tender.department}</p>
              <p>Published: {tender.publishedDate ? formatDate(tender.publishedDate) : formatDate(tender.parsedAt)}</p>
              <p>Closing: {tender.closingDate ? formatDate(tender.closingDate) : "N/A"}</p>
              <p className="md:col-span-2">
                Source URL:{" "}
                {tender.sourceURL ? (
                  <a className="text-casper-blue hover:underline" href={tender.sourceURL} target="_blank" rel="noreferrer">Open source</a>
                ) : ("N/A")}
              </p>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="text-left">Description</th><th>Quoted</th><th>Market</th><th>Inflation</th><th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {tender.lineItems.map((item) => (
                    <tr key={item.description} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="py-2 text-left">{item.description}</td>
                      <td>{formatCurrency(item.quotedRateINR)}</td>
                      <td>{item.marketRateINR ? formatCurrency(item.marketRateINR) : "-"}</td>
                      <td>{item.inflationPct ? `${item.inflationPct.toFixed(1)}%` : "-"}</td>
                      <td>{item.flagged ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tender.status === "pending" ? (
              <div className="mt-4 rounded-lg border border-slate-300 p-3 text-sm dark:border-slate-700">Not yet analyzed — upload PDF to audit.</div>
            ) : !audit ? (
              <div className="mt-4 rounded-lg border border-slate-300 p-3 text-sm dark:border-slate-700">Analyzing...</div>
            ) : (
              <div className="mt-4 space-y-2">
                {audit.flags.map((flag) => (
                  <p key={flag.explanation} className="rounded-lg border border-casper-red/30 bg-casper-red/10 p-2 text-xs">{flag.explanation}</p>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compare bar */}
      {selectedForCompare.length >= 2 && (
        <div className="flex items-center justify-between rounded-xl bg-casper-blue px-4 py-2 text-white">
          <span className="text-sm font-medium">{selectedForCompare.length} <TransText text="tenders selected for comparison" /></span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/compare?ids=${selectedForCompare.join(",")}`)}
              className="rounded bg-white px-3 py-1 text-xs font-semibold text-casper-blue hover:bg-blue-50"
            >
              <TransText text="Compare" />
            </button>
            <button type="button" onClick={() => setSelectedForCompare([])} className="text-xs underline opacity-80 hover:opacity-100">
              <TransText text="Clear" />
            </button>
          </div>
        </div>
      )}

      {/* Search + filter bar */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search title, tender #, department…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 min-w-[200px] rounded border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          <select
            value={filters.state ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, ...(e.target.value ? { state: e.target.value } : {}), page: 1 }) as TenderFilters)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">All states</option>
            <option value="national">National</option>
            {INDIA_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select
            value={filters.status ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, ...(e.target.value ? { status: e.target.value } : {}), page: 1 }) as TenderFilters)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">All status</option>
            <option value="pending">Pending</option>
            <option value="analyzing">Processing</option>
            <option value="flagged">Flagged</option>
            <option value="clean">Clean</option>
            <option value="error">Error</option>
          </select>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium ${showFilters ? "border-casper-blue bg-casper-blue text-white" : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"}`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="M3 6h18M7 12h10M11 18h2" /></svg>
            <TransText text="Filters" /> {hasActiveFilters && <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-casper-blue">!</span>}
          </button>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400">
              <TransText text="Clear filters" />
            </button>
          )}
          <div className="ml-auto flex gap-1">
            <button type="button" onClick={() => setTableView(true)} className={`rounded px-2 py-1 text-sm ${tableView ? "bg-casper-blue text-white" : "bg-slate-200 dark:bg-slate-700"}`}><TransText text="Table" /></button>
            <button type="button" onClick={() => setTableView(false)} className={`rounded px-2 py-1 text-sm ${!tableView ? "bg-casper-blue text-white" : "bg-slate-200 dark:bg-slate-700"}`}><TransText text="Cards" /></button>
          </div>
        </div>

        {/* Advanced filter panel */}
        {showFilters && (
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-sm dark:border-slate-700 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Project Type</label>
              <select
                value={filters.projectType ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, ...(e.target.value ? { projectType: e.target.value } : {}), page: 1 }) as TenderFilters)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Any</option>
                {PROJECT_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Procurement</label>
              <select
                value={filters.procurementMethod ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, ...(e.target.value ? { procurementMethod: e.target.value as TenderFilters["procurementMethod"] } : {}), page: 1 }) as TenderFilters)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Any</option>
                <option value="open">Open</option>
                <option value="limited">Limited</option>
                <option value="nomination">Nomination</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Risk Level</label>
              <select
                value={filters.riskLevel ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, ...(e.target.value ? { riskLevel: e.target.value as TenderFilters["riskLevel"] } : {}), page: 1 }) as TenderFilters)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Any</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Vendor name</label>
              <input
                type="text"
                placeholder="Search vendor…"
                value={filters.vendor ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, ...(e.target.value ? { vendor: e.target.value } : {}), page: 1 }) as TenderFilters)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Published from</label>
              <input
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, ...(e.target.value ? { dateFrom: e.target.value } : {}), page: 1 }) as TenderFilters)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Published to</label>
              <input
                type="date"
                value={filters.dateTo ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, ...(e.target.value ? { dateTo: e.target.value } : {}), page: 1 }) as TenderFilters)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Min cost (₹)</label>
              <input
                type="number"
                placeholder="e.g. 1000000"
                value={filters.costMin ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, ...(e.target.value ? { costMin: Number(e.target.value) } : {}), page: 1 }) as TenderFilters)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Max cost (₹)</label>
              <input
                type="number"
                placeholder="e.g. 50000000"
                value={filters.costMax ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, ...(e.target.value ? { costMax: Number(e.target.value) } : {}), page: 1 }) as TenderFilters)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="col-span-2 flex items-center gap-3 md:col-span-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showScrapedOnly}
                  onChange={(e) => setShowScrapedOnly(e.target.checked)}
                />
                Scraped (has source URL) only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.includeArchived ?? false}
                  onChange={(e) => setFilters((f) => ({ ...f, includeArchived: e.target.checked, page: 1 }))}
                />
                Include archived
              </label>
            </div>
          </div>
        )}
      </section>

      {isLoading ? (
        <div className="space-y-2">
          <div className="skeleton h-10" />
          <div className="skeleton h-10" />
          <div className="skeleton h-10" />
        </div>
      ) : tableView ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500">
                <th className="w-6" />
                <th className="text-left">Tender #</th>
                <th className="text-left">Title</th>
                <th className="text-left">Dept</th>
                <th>State</th>
                <th>Cost</th>
                <th>Type</th>
                <th>Risk</th>
                <th>Data</th>
                <th>Published</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr
                  key={row._id}
                  className={`cursor-pointer border-t border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800 ${selectedForCompare.includes(row._id) ? "bg-blue-50 dark:bg-blue-950" : ""}`}
                  onClick={() => navigate(`/tenders/${row._id}`)}
                >
                  <td className="py-2" onClick={(e) => { e.stopPropagation(); toggleCompare(row._id); }}>
                    <input
                      type="checkbox"
                      checked={selectedForCompare.includes(row._id)}
                      onChange={() => {}}
                      className="cursor-pointer"
                      title="Select for comparison"
                    />
                  </td>
                  <td className="py-2 text-left font-mono text-xs">{row.tenderNumber}</td>
                  <td className="max-w-[280px] truncate text-left" title={row.title}>{row.title}</td>
                  <td className="max-w-[200px] truncate text-left" title={row.department}>{row.department}</td>
                  <td className="capitalize">{row.state}</td>
                  <td>{row.totalEstimatedCostINR != null && !isNaN(row.totalEstimatedCostINR) && row.totalEstimatedCostINR > 0 ? formatCrore(row.totalEstimatedCostINR) : "—"}</td>
                  <td className="capitalize">{row.projectType ?? "—"}</td>
                  <td>{renderStatusBadge(row.status)}</td>
                  <td>
                    <div className="text-xs">
                      <div className="capitalize">{row.itemizationStatus ?? "none"}</div>
                      <div className="text-slate-500">{typeof row.dataCompletenessScore === "number" ? `${row.dataCompletenessScore}%` : "0%"}</div>
                    </div>
                  </td>
                  <td>{formatDate(row.parsedAt)}</td>
                  <td className="flex items-center gap-1 py-2" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => navigate(`/tenders/${row._id}`)} className="rounded bg-casper-blue px-2 py-1 text-xs text-white">View</button>
                    {(row.status === "analyzing" || row.status === "pending" || row.status === "error") && (
                      <button
                        type="button"
                        onClick={() => void handleReaudit(row._id)}
                        disabled={reauditingId === row._id}
                        className="rounded bg-yellow-500 px-2 py-1 text-xs text-white hover:bg-yellow-600 disabled:opacity-50"
                      >
                        {reauditingId === row._id ? "..." : "Re-audit"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400"><TransText text="No tenders match the current filters." /></p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map((row) => (
            <article
              key={row._id}
              className={`cursor-pointer rounded-2xl border p-4 ${selectedForCompare.includes(row._id) ? "border-casper-blue bg-blue-50 dark:bg-blue-950" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"}`}
              onClick={() => navigate(`/tenders/${row._id}`)}
            >
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">{row.title}</h3>
                <input
                  type="checkbox"
                  checked={selectedForCompare.includes(row._id)}
                  onChange={() => {}}
                  onClick={(e) => { e.stopPropagation(); toggleCompare(row._id); }}
                  className="cursor-pointer"
                  title="Select for comparison"
                />
              </div>
              <p className="text-sm text-slate-500">{row.department}</p>
              <div className="mt-3 flex items-center justify-between">
                <span>{row.totalEstimatedCostINR != null && !isNaN(row.totalEstimatedCostINR) && row.totalEstimatedCostINR > 0 ? formatCrore(row.totalEstimatedCostINR) : "—"}</span>
                {renderStatusBadge(row.status)}
              </div>
            </article>
          ))}
        </div>
      )}

      {list.length > 0 && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))}
            disabled={(filters.page ?? 1) === 1}
            className="rounded px-3 py-1 text-sm font-medium disabled:opacity-50 enabled:hover:bg-casper-blue enabled:hover:text-white"
          >
            <TransText text="Previous" />
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-400">Page {filters.page ?? 1}</span>
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            disabled={list.length < itemsPerPage}
            className="rounded px-3 py-1 text-sm font-medium disabled:opacity-50 enabled:hover:bg-casper-blue enabled:hover:text-white"
          >
            <TransText text="Next" />
          </button>
        </div>
      )}
    </div>
  );
};
