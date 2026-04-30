import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useGetItemDrillDownQuery, useChallengeFlagMutation } from "./auditsApi";
import { formatCurrency } from "../../utils/format";
import { showToast } from "../../utils/toast";

interface Props {
  tenderId: string;
  itemName: string;
  onClose: () => void;
}

const rateRow = (label: string, value: number | null, isQuoted = false): JSX.Element => (
  <tr className={`border-b border-slate-100 dark:border-slate-800 ${isQuoted ? "font-semibold" : ""}`}>
    <td className="py-2 pr-4 text-slate-600 dark:text-slate-400">{label}</td>
    <td className={`py-2 text-right font-mono ${value === null ? "text-slate-400" : isQuoted ? "text-red-600" : "text-slate-800 dark:text-slate-200"}`}>
      {value === null ? "N/A" : formatCurrency(value)}
    </td>
  </tr>
);

export function ItemDrillDownDrawer({ tenderId, itemName, onClose }: Props): JSX.Element {
  const [showChallenge, setShowChallenge] = useState(false);
  const [rebuttal, setRebuttal] = useState("");
  const [challengeFlag, { isLoading: submitting }] = useChallengeFlagMutation();

  const { data, isLoading, isError } = useGetItemDrillDownQuery({ tenderId, item: itemName });

  const handleChallenge = async () => {
    if (rebuttal.trim().length < 20) {
      showToast("error", "Please provide a detailed rebuttal (min 20 characters).");
      return;
    }
    try {
      await challengeFlag({ tenderId, itemDescription: itemName, rebuttal: rebuttal.trim() }).unwrap();
      showToast("success", "Challenge submitted for review.");
      setShowChallenge(false);
      setRebuttal("");
    } catch {
      showToast("error", "Failed to submit challenge.");
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold">Item Inflation Analysis</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[350px]">{itemName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-3 p-8 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" />
            Loading analysis…
          </div>
        )}

        {isError && (
          <div className="p-5 text-sm text-slate-500">
            Unable to load drill-down data. This item may not be present in the tender's line items.
          </div>
        )}

        {data && (
          <div className="space-y-5 p-5">
            {/* Item summary */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500 text-xs">Quantity</span><p className="font-semibold mt-0.5">{data.item.quantity} {data.item.unit}</p></div>
                <div><span className="text-slate-500 text-xs">Quoted Rate</span><p className="font-semibold text-red-600 mt-0.5">{formatCurrency(data.item.quotedRateINR)}</p></div>
                <div><span className="text-slate-500 text-xs">Market Rate</span><p className="font-semibold text-emerald-600 mt-0.5">{data.item.marketRateINR ? formatCurrency(data.item.marketRateINR) : "N/A"}</p></div>
                <div><span className="text-slate-500 text-xs">Inflation</span><p className={`font-bold text-lg mt-0.5 ${(data.item.inflationPct ?? 0) > 30 ? "text-red-600" : "text-yellow-600"}`}>{data.item.inflationPct !== null ? `${data.item.inflationPct.toFixed(1)}%` : "—"}</p></div>
              </div>
              {data.item.flagReason && (
                <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">{data.item.flagReason}</p>
              )}
            </div>

            {/* Inflation Breakdown */}
            {data.inflationBreakdown && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Inflation Calculation</h3>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 text-sm space-y-2">
                  <div className="flex justify-between"><span className="text-slate-500">Quoted Rate</span><span className="font-mono">{formatCurrency(data.inflationBreakdown.quotedRate)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Base Market Rate</span><span className="font-mono text-emerald-600">{formatCurrency(data.inflationBreakdown.baseMarketRate)}</span></div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2"><span className="text-slate-500 font-mono text-xs">{data.inflationBreakdown.formula}</span></div>
                  <div className="flex justify-between"><span className="font-semibold">Result</span><span className={`font-bold ${data.inflationBreakdown.result > 30 ? "text-red-600" : "text-yellow-600"}`}>{data.inflationBreakdown.result.toFixed(1)}%</span></div>
                  <p className="text-xs text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2">
                    Reference: {data.inflationBreakdown.referenceSource} ({data.inflationBreakdown.referenceDate})
                  </p>
                </div>
              </div>
            )}

            {/* Comparable Rates */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Comparable Market Rates</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-sm">
                  <tbody>
                    {rateRow("This Tender (Quoted)", data.comparableRates.tenderQuoted, true)}
                    {rateRow("WPI Index (MoC)", data.comparableRates.wpiIndex)}
                    {rateRow("GeM Portal", data.comparableRates.gemPrice)}
                    {rateRow("CPWD Schedule of Rates", data.comparableRates.cpwdSOR)}
                    {rateRow("State PWD Rate", data.comparableRates.statePwdRate)}
                    {rateRow("Casper ML Predicted", data.comparableRates.mlPredicted)}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Market Citations */}
            {data.marketCitations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Market Price Sources</h3>
                <div className="space-y-2">
                  {data.marketCitations.map((c, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{c.source}</span>
                        <span className="font-mono text-sm font-semibold">{formatCurrency(c.priceINR)}<span className="text-xs font-normal text-slate-400">/{c.unit}</span></span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{c.sourceDescription}</p>
                      {c.notes && <p className="text-xs text-slate-400 italic mt-0.5">{c.notes}</p>}
                      {c.stateCode && <span className="text-xs text-blue-500">({c.stateCode} specific)</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Price History Chart */}
            {data.priceHistory.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Price Trend (Historical)</h3>
                <div className="h-40 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.priceHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v: string) => v.slice(0, 7)} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(1)}k`} width={50} />
                      <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Price"]} />
                      <Line type="monotone" dataKey="avgPriceINR" stroke="#2563eb" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Contributing Factors */}
            {data.contributingFactors.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Contributing Factors</h3>
                <ul className="space-y-1.5">
                  {data.contributingFactors.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-red-100 text-red-600 text-xs flex items-center justify-center font-bold">!</span>
                      <span className="text-slate-700 dark:text-slate-300">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Challenge Flag */}
            {data.item.flagged && (
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                {!showChallenge ? (
                  <button
                    type="button"
                    onClick={() => setShowChallenge(true)}
                    className="w-full rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400"
                  >
                    Challenge This Flag — Submit Rebuttal
                  </button>
                ) : (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/20">
                    <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-2">Submit Flag Challenge</h3>
                    {data.challengesOnRecord > 0 && (
                      <p className="text-xs text-orange-600 mb-2">{data.challengesOnRecord} challenge(s) already on record for this item.</p>
                    )}
                    <textarea
                      value={rebuttal}
                      onChange={(e) => setRebuttal(e.target.value)}
                      placeholder="Provide your rebuttal with supporting evidence. Explain why the quoted price is justified (e.g., special materials, remote location transport costs, certified specifications)..."
                      className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                      rows={4}
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleChallenge()}
                        disabled={submitting}
                        className="rounded bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
                      >
                        {submitting ? "Submitting…" : "Submit Challenge"}
                      </button>
                      <button type="button" onClick={() => { setShowChallenge(false); setRebuttal(""); }} className="rounded border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
