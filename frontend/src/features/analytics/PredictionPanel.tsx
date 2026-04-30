import { useAppSelector } from "../../app/hooks";
import { useGetPredictionsQuery } from "./analyticsApi";
import type { Prediction } from "./analyticsApi";
import { useAppDispatch } from "../../app/hooks";
import { setItem } from "./analyticsSlice";

const ITEM_OPTIONS = [
  { value: "cement", label: "Cement" },
  { value: "steel_rod", label: "Steel Rod (TMT)" },
  { value: "coarse_sand", label: "Coarse Sand" },
  { value: "fine_sand", label: "Fine Sand" },
  { value: "aggregate_20mm", label: "Aggregate 20mm" },
  { value: "brick", label: "Brick" },
  { value: "bitumen", label: "Bitumen VG30" },
  { value: "rcc_pipe", label: "RCC Pipe NP3" }
];

const ConfidenceDot = ({ value }: { value: number }): JSX.Element => {
  const pct = Math.round(value * 100);
  const cls = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-red-400";
  return (
    <span className="flex items-center gap-1 text-xs text-slate-500">
      <span className={`h-2 w-2 rounded-full ${cls}`} />
      {pct}% conf.
    </span>
  );
};

const FallbackBadge = ({ level }: { level: string }): JSX.Element => {
  const map: Record<string, string> = {
    district: "text-green-700 bg-green-50",
    state: "text-blue-700 bg-blue-50",
    national: "text-slate-600 bg-slate-100"
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${map[level] ?? map.national}`}>
      {level}
    </span>
  );
};

const PredCard = ({ pred }: { pred: Prediction }): JSX.Element => {
  const deviation = pred.deviationPct;
  const deviationClass = deviation > 15 ? "text-red-600" : deviation > 5 ? "text-amber-600" : "text-green-600";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{pred.stateCode}</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{pred.stateName || pred.stateCode}</p>
        </div>
        <FallbackBadge level={pred.fallbackLevel} />
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-slate-900 dark:text-white">
          ₹{pred.predictedPriceINR.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </p>
        <p className="text-xs text-slate-400">predicted for {pred.forecastMonth}</p>
      </div>
      <div className="mt-2 text-xs text-slate-400">
        Range: ₹{pred.lowerBoundINR.toLocaleString("en-IN", { maximumFractionDigits: 0 })} –{" "}
        ₹{pred.upperBoundINR.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <ConfidenceDot value={pred.confidence} />
        <span className={`text-xs font-semibold ${deviationClass}`}>
          {deviation > 0 ? "+" : ""}{deviation.toFixed(1)}% vs current
        </span>
      </div>
    </div>
  );
};

export const PredictionPanel = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const { selectedStateCode, selectedDistrictCode, selectedItem } = useAppSelector((s) => s.analytics);

  const predParams = {
    item: selectedItem,
    ...(selectedStateCode ? { state: selectedStateCode } : {}),
    ...(selectedDistrictCode ? { district: selectedDistrictCode } : {})
  };
  const { data: predictions = [], isLoading, isError } = useGetPredictionsQuery(predParams);

  const overThreshold = predictions.filter((p) => p.deviationPct > 15);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Material</label>
          <select
            value={selectedItem}
            onChange={(e) => dispatch(setItem(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {ITEM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          Forecast horizon: next calendar month · Model: GradientBoostingRegressor
        </div>
      </div>

      {/* Alert banner if over-threshold predictions */}
      {overThreshold.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/20">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 flex-shrink-0 fill-none stroke-amber-600 stroke-2">
            <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <strong>{overThreshold.length} state{overThreshold.length > 1 ? "s" : ""}</strong> forecast price increases{" "}
            &gt;15% above current levels:{" "}
            {overThreshold.map((p) => p.stateCode).join(", ")}
          </div>
        </div>
      )}

      {/* Loading / error states */}
      {isLoading && (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-casper-blue border-t-transparent" />
          <span className="ml-3 text-sm text-slate-500">Computing ML predictions…</span>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">ML predictions unavailable — ensure the ML service is running.</p>
        </div>
      )}

      {/* Predictions grid */}
      {!isLoading && !isError && predictions.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">No predictions available yet. The model is being trained.</p>
        </div>
      )}

      {!isLoading && predictions.length > 0 && (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {predictions.length} predicted prices for <strong>{selectedItem}</strong>{" "}
            {selectedStateCode ? `in ${selectedStateCode}` : "across all Indian states"} — {predictions[0]?.forecastMonth ?? ""}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {predictions.map((pred) => (
              <PredCard key={`${pred.stateCode}-${pred.districtCode ?? "state"}`} pred={pred} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
