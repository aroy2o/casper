/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, type CSSProperties } from "react";

declare const chrome: any;

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

function normalizeAuthToken(token: string): string {
  const trimmed = token.trim();
  return trimmed.startsWith("Bearer ") ? trimmed.slice(7).trim() : trimmed;
}

const RISK_COLOR: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444"
};

type RecentAudit = {
  auditId: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  overallInflationPct: number;
  tenderNumber: string | null;
  summary: string | null;
  auditedAt: string;
  sourceURL: string;
  pageTitle: string;
};

function Badge({ level }: { level: string }) {
  const color = RISK_COLOR[level] ?? "#64748b";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 700,
        background: `${color}22`,
        color,
        textTransform: "uppercase",
        letterSpacing: "0.04em"
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
      {level}
    </span>
  );
}

export function Popup(): JSX.Element {
  const [tab, setTab] = useState<"status" | "settings">("status");
  const [authToken, setAuthToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [apiBase, setApiBase] = useState("http://localhost:4000");
  const [appBase, setAppBase] = useState("http://localhost:5173");
  const [saved, setSaved] = useState(false);
  const [recentAudits, setRecentAudits] = useState<RecentAudit[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    chrome.storage.local.get(["authToken", "refreshToken", "apiBase", "appBase"], (result: any) => {
      setAuthToken((result.authToken as string) ?? "");
      setRefreshToken((result.refreshToken as string) ?? "");
      setApiBase((result.apiBase as string) ?? "http://localhost:4000");
      setAppBase((result.appBase as string) ?? "http://localhost:5173");
    });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      setPageUrl(tabs[0]?.url ?? "");
    });
  }, []);

  useEffect(() => {
    if (tab !== "status" || !authToken || !apiBase) return;
    setLoadingRecent(true);
    fetch(`${apiBase}/api/extension/audits?limit=5`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
      .then((r) => r.json())
      .then((json: any) => {
        if (json.success) setRecentAudits((json.data?.audits ?? []) as RecentAudit[]);
      })
      .catch(() => {})
      .finally(() => setLoadingRecent(false));
  }, [tab, authToken, apiBase]);

  const saveSettings = () => {
    chrome.storage.local.set({
      authToken: normalizeAuthToken(authToken),
      refreshToken: normalizeAuthToken(refreshToken),
      apiBase,
      appBase
    }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const openHistory = () => {
    chrome.tabs.create({ url: `${appBase}/extension-audits` });
  };

  const isConnected = !!authToken;

  const styles: Record<string, CSSProperties> = {
    root: {
      width: 340,
      fontFamily: "'Inter', system-ui, sans-serif",
      background: "#0f172a",
      color: "#e2e8f0",
      fontSize: 13
    },
    header: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "14px 16px 12px",
      borderBottom: "1px solid #1e293b"
    },
    logo: { fontSize: 17, fontWeight: 700, color: "#38bdf8", letterSpacing: "-0.5px" },
    dot: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: isConnected ? "#22c55e" : "#64748b",
      boxShadow: isConnected ? "0 0 6px #22c55e" : "none",
      marginLeft: "auto"
    },
    connLabel: { fontSize: 11, color: isConnected ? "#22c55e" : "#64748b" },
    tabBar: { display: "flex", borderBottom: "1px solid #1e293b" },
    tab: (active: boolean): CSSProperties => ({
      flex: 1,
      padding: "8px 0",
      textAlign: "center",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      background: "none",
      border: "none",
      color: active ? "#38bdf8" : "#475569",
      borderBottom: active ? "2px solid #38bdf8" : "2px solid transparent"
    }),
    body: { padding: 14, maxHeight: 380, overflowY: "auto" },
    row: {
      background: "#1e293b",
      borderRadius: 10,
      padding: "10px 12px",
      marginBottom: 8,
      cursor: "pointer",
      transition: "background 0.15s"
    },
    label: { fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 },
    input: {
      width: "100%",
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: 8,
      padding: "7px 10px",
      color: "#e2e8f0",
      fontSize: 12,
      outline: "none",
      boxSizing: "border-box"
    },
    btn: (primary: boolean): CSSProperties => ({
      width: "100%",
      padding: "9px 0",
      borderRadius: 8,
      border: "none",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 13,
      background: primary ? "#38bdf8" : "#1e293b",
      color: primary ? "#0f172a" : "#94a3b8",
      marginBottom: 8
    }),
    emptyText: { textAlign: "center", color: "#475569", fontSize: 12, padding: "24px 0" }
  };

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.logo}>CASPER</span>
        <span style={{ fontSize: 11, color: "#475569", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: 6 }}>
          {pageUrl ? safeHostname(pageUrl) : "—"}
        </span>
        <span style={styles.dot} />
        <span style={styles.connLabel}>{isConnected ? "Connected" : "Not linked"}</span>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        <button style={styles.tab(tab === "status")} onClick={() => setTab("status")}>Recent Audits</button>
        <button style={styles.tab(tab === "settings")} onClick={() => setTab("settings")}>Settings</button>
      </div>

      {/* Body */}
      <div style={styles.body}>
        {tab === "status" && (
          <>
            {!isConnected ? (
              <div style={styles.emptyText}>
                Set your auth token in <b>Settings</b> to start auditing tenders.
              </div>
            ) : loadingRecent ? (
              <div style={styles.emptyText}>Loading recent audits…</div>
            ) : recentAudits.length === 0 ? (
              <div style={styles.emptyText}>
                No audits yet. Browse a tender page and click <b>Audit Tender</b>.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>Last 5 extension audits</div>
                  {recentAudits.map((a) => (
                    <div
                      key={a.auditId}
                      style={styles.row}
                      onClick={() => chrome.tabs.create({ url: `${appBase}/extension-audits` })}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Badge level={a.riskLevel} />
                        {a.overallInflationPct > 0 && (
                          <span style={{ fontSize: 11, color: "#fca5a5", marginLeft: "auto" }}>
                            +{a.overallInflationPct}%
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.pageTitle || a.tenderNumber || "Untitled"}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {safeHostname(a.sourceURL)} · {new Date(a.auditedAt).toLocaleDateString("en-IN")}
                      </div>
                    </div>
                  ))}
                </div>
                <button style={styles.btn(false)} onClick={openHistory}>
                  View All Audits in CASPER ↗
                </button>
              </>
            )}
          </>
        )}

        {tab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={styles.label}>Auth Token (JWT)</div>
              <input
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Paste your CASPER access token"
                style={styles.input}
              />
              <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
                Copy from CASPER → Settings → API Token
              </div>
            </div>

            <div>
              <div style={styles.label}>Refresh Token (JWT)</div>
              <input
                type="password"
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                placeholder="Paste your CASPER refresh token"
                style={styles.input}
              />
              <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
                Used to automatically renew the access token when it expires
              </div>
            </div>

            <div>
              <div style={styles.label}>Backend API URL</div>
              <input
                type="text"
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
                placeholder="http://localhost:4000"
                style={styles.input}
              />
            </div>

            <div>
              <div style={styles.label}>Frontend App URL</div>
              <input
                type="text"
                value={appBase}
                onChange={(e) => setAppBase(e.target.value)}
                placeholder="http://localhost:5173"
                style={styles.input}
              />
            </div>

            <button style={styles.btn(true)} onClick={saveSettings}>
              {saved ? "✓ Saved!" : "Save Settings"}
            </button>

            <button style={styles.btn(false)} onClick={openHistory}>
              Open Audit History ↗
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
