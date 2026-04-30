import { useEffect, useState } from "react";
import { useAppSelector } from "../app/hooks";
import { useGetProfileQuery, usePushSubscribeMutation, useSyncTendersMutation, useUpdatePreferencesMutation } from "../features/user/userApi";
import { useRefreshPricesMutation } from "../features/prices/pricesApi";
import { showToast } from "../utils/toast";

export const Settings = (): JSX.Element => {
  const { data: profile } = useGetProfileQuery();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const refreshToken = useAppSelector((state) => state.auth.refreshToken);
  const [showToken, setShowToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [showRefreshToken, setShowRefreshToken] = useState(false);
  const [refreshTokenCopied, setRefreshTokenCopied] = useState(false);
  const [updatePreferences, updateState] = useUpdatePreferencesMutation();
  const [pushSubscribe] = usePushSubscribeMutation();
  const [syncTenders, syncState] = useSyncTendersMutation();
  const [refreshPrices, refreshState] = useRefreshPricesMutation();
  const [theme, setTheme] = useState(localStorage.getItem("casper_theme") ?? "dark");
  const [defaultRegion, setDefaultRegion] = useState(localStorage.getItem("casper_default_region") ?? "assam");
  const [syncYearsBack, setSyncYearsBack] = useState("3");
  const [syncScope, setSyncScope] = useState("assam");
  const [syncTermsInput, setSyncTermsInput] = useState("assam, meghalaya, arunachal, northeast india");
  const [syncMaxRecords, setSyncMaxRecords] = useState("5000");
  const [portalFilter, setPortalFilter] = useState({
    eprocure: true,
    etenders: true,
    worldbank: true
  });

  const [prefs, setPrefs] = useState({
    alertThresholdPct: 20,
    watchedRegions: ["assam"],
    notifyEmail: false,
    notifyPush: true,
    pushSubscription: null as Record<string, unknown> | null
  });

  useEffect(() => {
    if (profile) {
      setPrefs(profile.preferences);
    }
  }, [profile]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("casper_theme", theme);
  }, [theme]);

  useEffect(() => {
    const saved = localStorage.getItem("casper_theme");
    setTheme(saved !== "light" ? "dark" : "light");
  }, []);

  const toggleRegion = (region: string): void => {
    setPrefs((prev) => ({
      ...prev,
      watchedRegions: prev.watchedRegions.includes(region)
        ? prev.watchedRegions.filter((item) => item !== region)
        : [...prev.watchedRegions, region]
    }));
  };

  const save = async (): Promise<void> => {
    await updatePreferences(prefs);
  };

  const triggerPriceRefresh = async (): Promise<void> => {
    try {
      const result = await refreshPrices().unwrap();
      showToast("success", `Prices refreshed: ${result.updated} records updated from ${result.sources.join(", ")}`);
    } catch {
      showToast("error", "Price refresh failed — check backend logs");
    }
  };

  const triggerTenderSync = async (): Promise<void> => {
    const yearsBack = Math.max(1, Number(syncYearsBack) || 3);
    const terms = syncTermsInput
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const portals = (Object.entries(portalFilter).filter(([, enabled]) => enabled).map(([name]) => name) as Array<
      "eprocure" | "etenders" | "worldbank"
    >);

    await syncTenders({
      yearsBack,
      terms: terms.length > 0 ? terms : ["assam", "meghalaya", "arunachal", "northeast india"],
      portals: portals.length > 0 ? portals : ["eprocure", "etenders", "worldbank"],
      scope: syncScope,
      maxRecords: Math.max(100, Number(syncMaxRecords) || 5000)
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Profile</h2>
        {!profile ? (
          <div className="mt-3 space-y-2">
            <div className="skeleton h-8" />
            <div className="skeleton h-8" />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <p>Name: {profile.name}</p>
            <p>Email: {profile.email}</p>
            <p>Org: {profile.organization}</p>
            <p>Role: {profile.role}</p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">API Token for Extension</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Use these tokens to authenticate and auto-renew the CASPER browser extension session.
        </p>
        {accessToken ? (
          <div className="mt-4 space-y-3">
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={accessToken}
                readOnly
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(accessToken);
                  setTokenCopied(true);
                  showToast("success", "Token copied to clipboard!");
                  setTimeout(() => setTokenCopied(false), 3000);
                }}
                className="rounded bg-casper-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
              >
                {tokenCopied ? "✓ Copied!" : "Copy Token"}
              </button>
            </div>
            {refreshToken ? (
              <>
                <div className="relative">
                  <input
                    type={showRefreshToken ? "text" : "password"}
                    value={refreshToken}
                    readOnly
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRefreshToken(!showRefreshToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    {showRefreshToken ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(refreshToken);
                      setRefreshTokenCopied(true);
                      showToast("success", "Refresh token copied to clipboard!");
                      setTimeout(() => setRefreshTokenCopied(false), 3000);
                    }}
                    className="rounded bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600"
                  >
                    {refreshTokenCopied ? "✓ Copied!" : "Copy Refresh Token"}
                  </button>
                </div>
              </>
            ) : null}
            <div className="rounded bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
              <p className="font-semibold">Extension Setup:</p>
              <ol className="mt-2 list-inside list-decimal space-y-1">
                <li>Open CASPER Extension settings</li>
                <li>Paste this token into "Auth Token (JWT)" field</li>
                <li>Paste the refresh token into "Refresh Token (JWT)" field</li>
                <li>Click "Save Settings"</li>
                <li className="mt-2">Or push tokens automatically to any open CASPER extension by clicking <strong>Push to Extension</strong> below.</li>
              </ol>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    window.postMessage({ type: "CASPER_PUSH_TOKEN", authToken: accessToken, refreshToken }, window.location.origin || "*");
                    showToast("success", "Tokens pushed to open CASPER extension (if any)");
                  } catch (err) {
                    showToast("error", "Failed to push tokens to extension");
                  }
                }}
                className="rounded bg-casper-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
              >
                Push to Extension
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Please log in to view your API token.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Alert preferences</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm">Alert threshold: {prefs.alertThresholdPct}%</label>
            <input
              type="range"
              min={10}
              max={80}
              value={prefs.alertThresholdPct}
              onChange={(event) => setPrefs((prev) => ({ ...prev, alertThresholdPct: Number(event.target.value) }))}
              className="w-full"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {["assam", "meghalaya", "arunachal", "manipur", "national"].map((region) => (
              <label key={region} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.watchedRegions.includes(region)}
                  onChange={() => toggleRegion(region)}
                />
                {region}
              </label>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prefs.notifyEmail}
              onChange={(event) => setPrefs((prev) => ({ ...prev, notifyEmail: event.target.checked }))}
            />
            Email notifications
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prefs.notifyPush}
              onChange={async (event) => {
                const value = event.target.checked;
                setPrefs((prev) => ({ ...prev, notifyPush: value }));
                if (value) {
                  await pushSubscribe({ enabled: true });
                }
              }}
            />
            Push notifications
          </label>

          <button type="button" onClick={() => void save()} className="rounded bg-casper-blue px-4 py-2 text-sm font-semibold text-white">
            {updateState.isLoading ? "Saving..." : "Save preferences"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Display</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="rounded border border-slate-300 px-3 py-1.5 dark:border-slate-700">
            Toggle {theme === "dark" ? "Light" : "Dark"} mode
          </button>
          <select
            value={defaultRegion}
            onChange={(event) => {
              setDefaultRegion(event.target.value);
              localStorage.setItem("casper_default_region", event.target.value);
            }}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="assam">assam</option>
            <option value="meghalaya">meghalaya</option>
            <option value="arunachal">arunachal</option>
            <option value="national">national</option>
          </select>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("casper_tour_seen");
              window.location.reload();
            }}
            className="rounded border border-slate-300 px-3 py-1.5 dark:border-slate-700"
          >
            Replay app tour
          </button>
        </div>
      </section>

      {profile?.role === "admin" ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Price Data (Admin)</h2>
          <p className="mt-2 text-sm text-slate-500">
            Fetch the latest prices from IOCL (bitumen) and SAIL (steel). Remaining materials use CPWD 2024 rates.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => void triggerPriceRefresh()}
              disabled={refreshState.isLoading}
              className="rounded bg-casper-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {refreshState.isLoading ? "Refreshing…" : "Refresh Prices Now"}
            </button>
            {refreshState.data ? (
              <p className="mt-2 text-sm text-casper-green">
                ✓ {refreshState.data.updated} price records updated · sources: {refreshState.data.sources.join(", ")}
              </p>
            ) : null}
            {refreshState.data?.errors && refreshState.data.errors.length > 0 ? (
              <p className="mt-1 text-sm text-casper-red">Errors: {refreshState.data.errors.join("; ")}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {profile?.role === "admin" ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Tender Dataset Sync (Admin)</h2>
          <p className="mt-2 text-sm text-slate-500">
            One-click refresh for historical tenders with filters based on your preference.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              Years back
              <input
                type="number"
                min={1}
                max={10}
                value={syncYearsBack}
                onChange={(event) => setSyncYearsBack(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="text-sm">
              Scope (state-wise or full country)
              <select
                value={syncScope}
                onChange={(event) => setSyncScope(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="all_india">All India</option>
                <option value="assam">assam</option>
                <option value="meghalaya">meghalaya</option>
                <option value="arunachal">arunachal</option>
                <option value="manipur">manipur</option>
                <option value="mizoram">mizoram</option>
                <option value="nagaland">nagaland</option>
                <option value="tripura">tripura</option>
                <option value="sikkim">sikkim</option>
                <option value="west bengal">west bengal</option>
                <option value="karnataka">karnataka</option>
                <option value="maharashtra">maharashtra</option>
                <option value="delhi">delhi</option>
              </select>
            </label>
            <label className="text-sm">
              Max records (optimized cap)
              <input
                type="number"
                min={100}
                max={20000}
                value={syncMaxRecords}
                onChange={(event) => setSyncMaxRecords(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="text-sm md:col-span-2">
              Search terms (comma separated)
              <input
                value={syncTermsInput}
                onChange={(event) => setSyncTermsInput(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <div className="md:col-span-2">
              <p className="text-sm">Portals</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                {(["eprocure", "etenders", "worldbank"] as const).map((portal) => (
                  <label key={portal} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={portalFilter[portal]}
                      onChange={(event) => setPortalFilter((prev) => ({ ...prev, [portal]: event.target.checked }))}
                    />
                    {portal}
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void triggerTenderSync()}
                className="rounded bg-casper-blue px-4 py-2 text-sm font-semibold text-white"
              >
                {syncState.isLoading ? "Syncing..." : "Sync tenders now"}
              </button>
              {syncState.data ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  <p>
                    <strong>Found {syncState.data.found} tender{syncState.data.found !== 1 ? "s" : ""}</strong> from last {syncState.data.yearsBack} year{syncState.data.yearsBack !== 1 ? "s" : ""}
                  </p>
                  {syncState.data.inserted > 0 && (
                    <p className="text-casper-blue">✓ Added {syncState.data.inserted} new tender{syncState.data.inserted !== 1 ? "s" : ""}</p>
                  )}
                  {syncState.data.alreadyExist > 0 && (
                    <p className="text-slate-500">{syncState.data.alreadyExist} already in database</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">About</h2>
        <p className="mt-2">Version: 1.0.0</p>
        <p>Data sources: GeM 2024, CPWD SOR 2024, eprocure public records</p>
        <p>Last scrape time: Live from backend seeded dataset</p>
      </section>
    </div>
  );
};
