import { useState } from "react";
import { useAppSelector, useAppDispatch } from "../../app/hooks";
import { setRegion, setItem, setDeviationThreshold } from "./analyticsSlice";
import { useGetHeatmapQuery } from "./analyticsApi";
import type { HeatmapStateEntry, HeatmapDistrictEntry } from "./analyticsApi";

const ITEM_OPTIONS = [
  { value: "cement", label: "Cement" }, { value: "steel_rod", label: "Steel Rod" },
  { value: "coarse_sand", label: "Sand (Coarse)" }, { value: "fine_sand", label: "Sand (Fine)" },
  { value: "aggregate_20mm", label: "Aggregate" }, { value: "brick", label: "Brick" },
  { value: "bitumen", label: "Bitumen" }, { value: "rcc_pipe", label: "RCC Pipe" }
];

function deviationColor(dev: number | null, threshold: number): string {
  if (dev === null) return "bg-slate-100 dark:bg-slate-800 text-slate-400";
  if (dev > threshold * 2) return "bg-red-600 text-white";
  if (dev > threshold) return "bg-red-400 text-white";
  if (dev > threshold / 2) return "bg-orange-300 text-slate-900";
  if (dev > 0) return "bg-yellow-200 text-slate-900";
  if (dev > -threshold / 2) return "bg-green-200 text-slate-900";
  return "bg-green-400 text-white";
}

function deviationBg(dev: number | null, threshold: number): string {
  if (dev === null) return "#f1f5f9";
  if (dev > threshold * 2) return "#dc2626";
  if (dev > threshold) return "#f87171";
  if (dev > threshold / 2) return "#fdba74";
  if (dev > 0) return "#fde68a";
  if (dev > -threshold / 2) return "#bbf7d0";
  return "#4ade80";
}

const StateCard = ({
  entry,
  threshold,
  onClick
}: {
  entry: HeatmapStateEntry;
  threshold: number;
  onClick: () => void;
}): JSX.Element => {
  const colorClass = deviationColor(entry.deviationPct, threshold);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${entry.stateName}\n₹${entry.avgPriceINR?.toLocaleString("en-IN") ?? "N/A"}\n${entry.deviationPct !== null ? (entry.deviationPct > 0 ? "+" : "") + entry.deviationPct + "% vs median" : "No data"}`}
      className={`flex flex-col items-center justify-center rounded-xl p-3 text-center transition-transform hover:scale-105 active:scale-95 ${colorClass}`}
    >
      <span className="text-[10px] font-bold">{entry.stateCode}</span>
      <span className="mt-0.5 hidden text-[9px] opacity-80 sm:block truncate w-full">{entry.stateName.split(" ")[0]}</span>
      {entry.deviationPct !== null && (
        <span className="mt-1 text-[10px] font-semibold">
          {entry.deviationPct > 0 ? "+" : ""}{entry.deviationPct}%
        </span>
      )}
    </button>
  );
};

const DistrictCard = ({
  entry,
  threshold
}: {
  entry: HeatmapDistrictEntry;
  threshold: number;
}): JSX.Element => {
  const colorClass = deviationColor(entry.deviationPct, threshold);
  return (
    <div
      title={`${entry.districtName}\n₹${entry.avgPriceINR?.toLocaleString("en-IN") ?? "N/A"}\n${entry.deviationPct !== null ? (entry.deviationPct > 0 ? "+" : "") + entry.deviationPct + "% vs median" : "No data"}`}
      className={`flex flex-col items-center justify-center rounded-xl p-3 text-center ${colorClass}`}
    >
      <span className="text-xs font-semibold truncate w-full">{entry.districtName}</span>
      {entry.deviationPct !== null && (
        <span className="text-[10px] font-medium mt-0.5">
          {entry.deviationPct > 0 ? "+" : ""}{entry.deviationPct}%
        </span>
      )}
      {entry.avgPriceINR !== null && (
        <span className="text-[9px] opacity-70 mt-0.5">₹{entry.avgPriceINR.toLocaleString("en-IN")}</span>
      )}
    </div>
  );
};

const ColorScale = (): JSX.Element => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-slate-400">Fair</span>
    <div className="flex h-3 w-32 overflow-hidden rounded-full">
      {["#4ade80", "#bbf7d0", "#fde68a", "#fdba74", "#f87171", "#dc2626"].map((c) => (
        <div key={c} className="flex-1" style={{ background: c }} />
      ))}
    </div>
    <span className="text-[10px] text-slate-400">Overpriced</span>
  </div>
);

export const IndiaHeatmap = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const { selectedStateCode, selectedStateName, selectedItem, deviationThreshold } = useAppSelector((s) => s.analytics);
  const [hoveredState, setHoveredState] = useState<HeatmapStateEntry | null>(null);

  const heatmapParams = {
    item: selectedItem,
    ...(selectedStateCode ? { state: selectedStateCode } : {})
  };
  const { data: heatmap, isLoading } = useGetHeatmapQuery(heatmapParams);

  const handleStateClick = (entry: HeatmapStateEntry): void => {
    if (selectedStateCode === entry.stateCode) {
      dispatch(setRegion({ stateCode: null, stateName: null }));
    } else {
      dispatch(setRegion({ stateCode: entry.stateCode, stateName: entry.stateName }));
    }
  };

  const sortedStates = [...(heatmap?.states ?? [])].sort((a, b) =>
    (b.deviationPct ?? -999) - (a.deviationPct ?? -999)
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Material</label>
          <select
            value={selectedItem}
            onChange={(e) => dispatch(setItem(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {ITEM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Flag threshold: {deviationThreshold}%</label>
          <input
            type="range" min={5} max={50} step={5} value={deviationThreshold}
            onChange={(e) => dispatch(setDeviationThreshold(Number(e.target.value)))}
            className="w-24"
          />
        </div>
        <ColorScale />
      </div>

      <div className="flex gap-4">
        {/* Main heatmap grid */}
        <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {selectedStateCode ? (
            <>
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => dispatch(setRegion({ stateCode: null, stateName: null }))}
                  className="flex items-center gap-1 text-xs font-medium text-casper-blue hover:underline"
                >
                  ← All India
                </button>
                <span className="text-slate-300 dark:text-slate-700">›</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{selectedStateName}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">District View</span>
              </div>

              {isLoading && (
                <div className="flex h-48 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" />
                </div>
              )}
              {!isLoading && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {(heatmap?.districts ?? []).map((d) => (
                    <DistrictCard key={d.districtCode} entry={d} threshold={deviationThreshold} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  All India — Click a state to drill down
                </h3>
                {heatmap?.median ? (
                  <span className="text-xs text-slate-500">
                    National median: <strong>₹{heatmap.median.toLocaleString("en-IN")}</strong>
                  </span>
                ) : null}
              </div>

              {isLoading && (
                <div className="flex h-48 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" />
                </div>
              )}

              {!isLoading && (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                  {sortedStates.map((s) => (
                    <StateCard
                      key={s.stateCode}
                      entry={s}
                      threshold={deviationThreshold}
                      onClick={() => handleStateClick(s)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Side panel — ranked list */}
        <div className="hidden w-64 flex-shrink-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:block">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {selectedStateCode ? "Districts by Deviation" : "States by Deviation"}
          </h3>
          <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
            {(selectedStateCode ? heatmap?.districts ?? [] : sortedStates).map((entry, i) => {
              const name = "stateName" in entry ? entry.stateName : entry.districtName;
              const dev = entry.deviationPct;
              const avg = entry.avgPriceINR;
              return (
                <div key={i} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-3 w-3 rounded-sm flex-shrink-0"
                      style={{ background: deviationBg(dev, deviationThreshold) }}
                    />
                    <span className="truncate text-xs text-slate-700 dark:text-slate-300">{name}</span>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {dev !== null ? (
                      <span className={`text-xs font-semibold ${dev > 0 ? "text-red-600" : "text-green-600"}`}>
                        {dev > 0 ? "+" : ""}{dev}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hover tooltip detail (mobile) */}
      {hoveredState && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="font-semibold">{hoveredState.stateName}</p>
          <p className="text-sm">₹{hoveredState.avgPriceINR?.toLocaleString("en-IN") ?? "N/A"}</p>
          <p className="text-sm">{hoveredState.deviationPct !== null ? `${hoveredState.deviationPct > 0 ? "+" : ""}${hoveredState.deviationPct}% vs median` : "No data"}</p>
        </div>
      )}
    </div>
  );
};
