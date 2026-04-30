import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { useGetItemTimelineQuery, useGetVendorTimelineQuery } from "./auditsApi";
import { formatCrore, formatDate } from "../../utils/format";

interface Props {
  tender: {
    _id: string;
    state?: string;
    stateCode?: string | null;
    vendorName?: string | null;
    lineItems?: Array<{ description: string; flagged?: boolean; isFlag?: boolean }>;
  };
}

type TimelineMode = "item" | "vendor";

const colorDot: Record<string, string> = {
  red: "bg-red-500",
  yellow: "bg-yellow-400",
  green: "bg-emerald-500",
  grey: "bg-slate-400"
};

const colorBorder: Record<string, string> = {
  red: "border-red-200 dark:border-red-900",
  yellow: "border-yellow-200 dark:border-yellow-900",
  green: "border-emerald-200 dark:border-emerald-900",
  grey: "border-slate-200 dark:border-slate-800"
};

export function AuditTimelineTab({ tender }: Props): JSX.Element {
  const [mode, setMode] = useState<TimelineMode>("item");
  const [selectedItem, setSelectedItem] = useState<string>(
    tender.lineItems?.find((li) => li.flagged || li.isFlag)?.description ??
    tender.lineItems?.[0]?.description ?? ""
  );

  const itemTimelineArgs = tender.stateCode
    ? { item: selectedItem, state: tender.stateCode }
    : { item: selectedItem };

  const itemQuery = useGetItemTimelineQuery(
    itemTimelineArgs,
    { skip: mode !== "item" || !selectedItem }
  );

  const vendorQuery = useGetVendorTimelineQuery(
    { vendor_name: tender.vendorName ?? "" },
    { skip: mode !== "vendor" || !tender.vendorName }
  );

  const flaggedItems = tender.lineItems?.filter((li) => li.flagged || (li as { isFlag?: boolean }).isFlag) ?? [];
  const allItems = tender.lineItems ?? [];

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Audit History Timeline</h2>
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setMode("item")}
              className={`px-4 py-1.5 font-medium transition-colors ${mode === "item" ? "bg-casper-blue text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
            >
              Item Timeline
            </button>
            <button
              type="button"
              onClick={() => setMode("vendor")}
              disabled={!tender.vendorName}
              className={`px-4 py-1.5 font-medium transition-colors ${mode === "vendor" ? "bg-casper-blue text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"} disabled:opacity-40`}
              title={!tender.vendorName ? "No vendor data for this tender" : undefined}
            >
              Vendor Timeline
            </button>
          </div>
        </div>

        {/* Item selector */}
        {mode === "item" && allItems.length > 0 && (
          <div className="mb-4">
            <label className="text-xs text-slate-500 mb-1 block">Select item to track across all tenders:</label>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {allItems.map((li) => (
                <option key={li.description} value={li.description}>
                  {li.description}{(li.flagged || (li as { isFlag?: boolean }).isFlag) ? " ⚑" : ""}
                </option>
              ))}
            </select>
            {flaggedItems.length > 0 && (
              <p className="text-xs text-slate-400 mt-1">⚑ = flagged in this tender</p>
            )}
          </div>
        )}

        {/* Item Timeline */}
        {mode === "item" && (
          <>
            {!selectedItem && <p className="text-sm text-slate-500">No items available to track.</p>}
            {selectedItem && itemQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" />
                Loading item history…
              </div>
            )}
            {selectedItem && itemQuery.data && (
              <ItemTimelineContent data={itemQuery.data} />
            )}
            {selectedItem && itemQuery.isError && (
              <p className="text-sm text-slate-500">Unable to load item timeline.</p>
            )}
          </>
        )}

        {/* Vendor Timeline */}
        {mode === "vendor" && (
          <>
            {vendorQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" />
                Loading vendor history…
              </div>
            )}
            {vendorQuery.data && <VendorTimelineContent data={vendorQuery.data} />}
            {vendorQuery.isError && <p className="text-sm text-slate-500">Unable to load vendor timeline.</p>}
          </>
        )}
      </section>
    </div>
  );
}

function ItemTimelineContent({ data }: { data: import("./auditsApi").ItemTimelineResponse }): JSX.Element {
  const chartData = data.events
    .filter((e) => e.item?.quotedRateINR)
    .map((e) => ({
      date: e.date ? e.date.slice(0, 10) : "—",
      price: e.item?.quotedRateINR ?? 0,
      market: e.item?.marketRateINR ?? null,
      flagged: e.item?.flagged ?? false
    }));

  if (data.events.length === 0) {
    return <p className="text-sm text-slate-500">No tenders found containing this item in the selected region.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />Flagged</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1" />Mild inflation</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Fair</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1" />Cancelled/No data</span>
        <span className="ml-auto font-medium">{data.total} tenders</span>
      </div>

      {/* Price chart */}
      {chartData.length > 1 && (
        <div className="h-44 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} width={50} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Quoted Price"]} />
              <Line type="monotone" dataKey="price" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "#ef4444" }} name="Quoted" />
              <Line type="monotone" dataKey="market" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Market" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Anomalies */}
      {data.anomalies.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950/20">
          <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-1">Price Anomalies Detected</p>
          {data.anomalies.map((a, i) => (
            <p key={i} className="text-xs text-orange-600 dark:text-orange-400">{a.note}</p>
          ))}
        </div>
      )}

      {/* Timeline entries */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {data.events.map((event, i) => (
          <div key={i} className={`flex gap-3 rounded-xl border p-3 ${colorBorder[event.color]}`}>
            <div className="mt-1.5 flex-shrink-0">
              <span className={`inline-block h-3 w-3 rounded-full ${colorDot[event.color]}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs font-mono text-slate-500">{event.tenderNumber}</span>
                <span className="text-xs text-slate-400">{event.date ? formatDate(event.date) : "—"}</span>
              </div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{event.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>{event.state}{event.district ? ` / ${event.district}` : ""}</span>
                {event.vendorName && <span className="truncate max-w-[150px]">{event.vendorName}</span>}
                {event.item && (
                  <>
                    <span className="font-mono text-red-600">₹{event.item.quotedRateINR.toLocaleString("en-IN")}</span>
                    {event.item.marketRateINR && <span className="font-mono text-emerald-600">Mkt: ₹{event.item.marketRateINR.toLocaleString("en-IN")}</span>}
                    {event.item.inflationPct !== null && (
                      <span className={event.item.inflationPct > 30 ? "text-red-600 font-semibold" : "text-yellow-600"}>
                        {event.item.inflationPct.toFixed(1)}%
                      </span>
                    )}
                    {event.item.flagged && <span className="text-red-500">⚑</span>}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VendorTimelineContent({ data }: { data: import("./auditsApi").VendorTimelineResponse }): JSX.Element {
  if (data.events.length === 0) {
    return <p className="text-sm text-slate-500">No tenders found for vendor "{data.vendorName}".</p>;
  }

  const rs = data.riskSummary;

  return (
    <div className="space-y-4">
      {/* Risk summary */}
      {rs && (
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500">Total Tenders</p>
            <p className="text-xl font-bold">{rs.totalTenders}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500">Flagged</p>
            <p className={`text-xl font-bold ${rs.flaggedCount > 0 ? "text-red-600" : "text-emerald-600"}`}>{rs.flaggedCount} <span className="text-sm font-normal text-slate-400">({rs.flagRate}%)</span></p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500">States Active</p>
            <p className="text-sm font-semibold">{rs.statesActive.join(", ") || "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500">Avg Inflation</p>
            <p className={`text-xl font-bold ${rs.avgInflationPct > 20 ? "text-red-600" : "text-slate-700 dark:text-slate-200"}`}>{rs.avgInflationPct.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Timeline entries */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {data.events.map((event, i) => {
          const color = event.status === "flagged" ? "red" : event.status === "clean" ? "green" : "grey";
          return (
            <div key={i} className={`flex gap-3 rounded-xl border p-3 ${colorBorder[color]}`}>
              <div className="mt-1.5 flex-shrink-0"><span className={`inline-block h-3 w-3 rounded-full ${colorDot[color]}`} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-xs font-mono text-slate-500">{event.tenderNumber}</span>
                  <span className="text-xs text-slate-400">{event.date ? formatDate(event.date) : "—"}</span>
                </div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{event.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>{event.state}</span>
                  <span className="capitalize">{event.projectType}</span>
                  <span>{event.totalEstimatedCostINR > 0 ? formatCrore(event.totalEstimatedCostINR) : "—"}</span>
                  <span className={`capitalize font-medium ${event.status === "flagged" ? "text-red-600" : event.status === "clean" ? "text-emerald-600" : "text-slate-500"}`}>{event.status}</span>
                  {event.audit && <span className="font-semibold text-orange-600">{event.audit.overallInflationPct.toFixed(1)}% inflation</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
