import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setRegion, setDistrict, resetRegion } from "../features/analytics/analyticsSlice";
import { useGetStateListQuery } from "../features/analytics/analyticsApi";

export const RegionSelector = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const { selectedStateCode, selectedStateName, selectedDistrictCode, selectedDistrictName } = useAppSelector(
    (s) => s.analytics
  );
  const { data: stateList = [] } = useGetStateListQuery();
  const [stateOpen, setStateOpen] = useState(false);
  const [districtOpen, setDistrictOpen] = useState(false);
  const [stateSearch, setStateSearch] = useState("");
  const stateRef = useRef<HTMLDivElement>(null);
  const districtRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (stateRef.current && !stateRef.current.contains(e.target as Node)) setStateOpen(false);
      if (districtRef.current && !districtRef.current.contains(e.target as Node)) setDistrictOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedStateInfo = stateList.find((s) => s.code === selectedStateCode);
  const filteredStates = stateList.filter((s) =>
    stateSearch === "" || s.name.toLowerCase().includes(stateSearch.toLowerCase())
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* State selector */}
      <div ref={stateRef} className="relative">
        <button
          type="button"
          onClick={() => { setStateOpen((o) => !o); setDistrictOpen(false); }}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          {selectedStateName ?? "All India"}
          <svg viewBox="0 0 24 24" className="h-3 w-3 fill-none stroke-current stroke-2">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {stateOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="p-2">
              <input
                autoFocus
                value={stateSearch}
                onChange={(e) => setStateSearch(e.target.value)}
                placeholder="Search state..."
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-casper-blue dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              <button
                type="button"
                onClick={() => { dispatch(resetRegion()); setStateOpen(false); setStateSearch(""); }}
                className="w-full px-3 py-2 text-left text-sm font-semibold text-casper-blue hover:bg-blue-50 dark:hover:bg-slate-800"
              >
                🌏 All India (Pan-India)
              </button>
              <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
              {filteredStates.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => {
                    dispatch(setRegion({ stateCode: s.code, stateName: s.name }));
                    setStateOpen(false);
                    setStateSearch("");
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
                    selectedStateCode === s.code ? "bg-blue-50 font-medium text-casper-blue dark:bg-slate-800" : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span className="text-xs text-slate-400 mr-1">{s.code}</span>
                  {s.name}
                  {s.type === "ut" && <span className="ml-1 text-xs text-slate-400">(UT)</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* District selector — only shown when state is selected */}
      {selectedStateInfo && (
        <div ref={districtRef} className="relative">
          <button
            type="button"
            onClick={() => { setDistrictOpen((o) => !o); setStateOpen(false); }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            {selectedDistrictName ?? "All Districts"}
            <svg viewBox="0 0 24 24" className="h-3 w-3 fill-none stroke-current stroke-2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {districtOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="max-h-64 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => { dispatch(setDistrict({ districtCode: null, districtName: null })); setDistrictOpen(false); }}
                  className="w-full px-3 py-2 text-left text-sm font-semibold text-casper-blue hover:bg-blue-50 dark:hover:bg-slate-800"
                >
                  All Districts
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                {selectedStateInfo.districts.map((d) => (
                  <button
                    key={d.code}
                    type="button"
                    onClick={() => {
                      dispatch(setDistrict({ districtCode: d.code, districtName: d.name }));
                      setDistrictOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      selectedDistrictCode === d.code ? "bg-blue-50 font-medium text-casper-blue dark:bg-slate-800" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Breadcrumb badge */}
      {selectedStateName && (
        <div className="flex items-center gap-1 rounded-full bg-casper-blue/10 px-2.5 py-1 text-xs font-medium text-casper-blue">
          {selectedStateName}
          {selectedDistrictName && <><span className="opacity-60">›</span>{selectedDistrictName}</>}
          <button
            type="button"
            onClick={() => dispatch(resetRegion())}
            className="ml-1 rounded-full hover:bg-casper-blue/20 p-0.5"
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3 fill-none stroke-current stroke-2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
