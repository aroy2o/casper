// Content script: detects tender pages and injects CASPER audit overlay
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;

// Listen for token push events from the page (sent by frontend)
window.addEventListener("message", (event) => {
  try {
    // Only accept messages from the same window
    if (event.source !== window) return;
    const msg = event.data as any;
    if (!msg || msg.type !== "CASPER_PUSH_TOKEN") return;
    const authToken = typeof msg.authToken === "string" ? msg.authToken.trim() : undefined;
    const refreshToken = typeof msg.refreshToken === "string" ? msg.refreshToken.trim() : undefined;
    const apiBase = typeof msg.apiBase === "string" ? msg.apiBase.trim() : undefined;
    const data: Record<string, unknown> = {};
    if (authToken) data.authToken = authToken.startsWith("Bearer ") ? authToken.slice(7).trim() : authToken;
    if (refreshToken) data.refreshToken = refreshToken.startsWith("Bearer ") ? refreshToken.slice(7).trim() : refreshToken;
    if (apiBase) data.apiBase = apiBase;
    if (Object.keys(data).length > 0) {
      chrome.storage.local.set(data, () => {
        // Optionally notify the extension/service worker that storage updated
        try { chrome.runtime.sendMessage({ type: "STORAGE_UPDATED", data }); } catch (_) {}
      });
    }
  } catch (_) {
    // ignore malformed messages
  }
});

const TENDER_KEYWORDS = [
  "tender", "bid", "procurement", "NIT", "RFP", "EOI", "BOQ",
  "bill of quantities", "e-procurement", "eprocure", "GeM",
  "works contract", "rate contract", "supply order", "quotation"
];

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444"
};

const RISK_BG: Record<string, string> = {
  low: "#dcfce7",
  medium: "#fef3c7",
  high: "#ffedd5",
  critical: "#fee2e2"
};

function isTenderPage(): boolean {
  const text = (document.title + " " + document.body.innerText.slice(0, 3000)).toLowerCase();
  return TENDER_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

function extractPageText(): string {
  // Get text from main content area, avoiding nav/footer noise
  const selectors = ["main", "article", "#content", ".content", "#main", ".main-content", "body"];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      return (el as HTMLElement).innerText.slice(0, 25000);
    }
  }
  return document.body.innerText.slice(0, 25000);
}

type AuditFlag = {
  lineItemDescription: string;
  quotedRateINR: number;
  marketRateINR: number;
  inflationPct: number;
  confidence: number;
  explanation: string;
};

type AuditResult = {
  auditId: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  overallInflationPct: number;
  totalOverpricedINR: number;
  flags: AuditFlag[];
  summary: string | null;
  recommendation: string | null;
  riskSignals: string[];
  claudeVerdict: string | null;
  tenderNumber: string | null;
  department: string | null;
  auditedAt: string;
};

// ─── Panel state ──────────────────────────────────────────────────────────────

let panelRoot: HTMLDivElement | null = null;
let panelVisible = false;
let auditInFlight = false;

function createPanel(): HTMLDivElement {
  const panel = document.createElement("div");
  panel.id = "casper-panel";
  Object.assign(panel.style, {
    position: "fixed",
    bottom: "80px",
    right: "16px",
    width: "360px",
    maxHeight: "80vh",
    overflowY: "auto",
    background: "#0f172a",
    color: "#e2e8f0",
    borderRadius: "16px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: "13px",
    // 2147483647 is the CSS max — must match or exceed the PDF embed's z-index
    zIndex: "2147483647",
    border: "1px solid #1e3a5f",
    display: "none"
  });
  return panel;
}

function renderLoading(panel: HTMLDivElement): void {
  panel.innerHTML = `
    <div style="padding:20px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <span style="font-size:18px;font-weight:700;color:#38bdf8;">CASPER</span>
        <span style="font-size:11px;color:#64748b;margin-left:auto;">Analyzing tender...</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;color:#64748b;">
        <div style="width:16px;height:16px;border:2px solid #38bdf8;border-top-color:transparent;border-radius:50%;animation:casper-spin 0.8s linear infinite;flex-shrink:0;"></div>
        <span>Running ML audit on page content...</span>
      </div>
    </div>
    <style>
      @keyframes casper-spin { to { transform: rotate(360deg); } }
      #casper-panel::-webkit-scrollbar { width:6px; }
      #casper-panel::-webkit-scrollbar-track { background:#1e293b; }
      #casper-panel::-webkit-scrollbar-thumb { background:#334155;border-radius:3px; }
    </style>
  `;
}

function renderError(panel: HTMLDivElement, message: string, onRetry?: () => void): void {
  panel.innerHTML = `
    <div style="padding:20px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <span style="font-size:18px;font-weight:700;color:#38bdf8;">CASPER</span>
      </div>
      <div style="background:#450a0a;border:1px solid #7f1d1d;border-radius:10px;padding:12px;color:#fca5a5;font-size:12px;">
        ${escapeHtml(message)}
      </div>
      <button id="casper-retry" style="margin-top:12px;width:100%;padding:8px;background:#1e3a5f;color:#38bdf8;border:1px solid #1e4a6e;border-radius:8px;cursor:pointer;font-size:12px;">
        Retry
      </button>
    </div>
  `;
  panel.querySelector("#casper-retry")?.addEventListener("click", () => (onRetry ?? runAudit)());
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function renderResult(panel: HTMLDivElement, result: AuditResult): void {
  const riskColor = RISK_COLORS[result.riskLevel] ?? "#64748b";
  const riskBg = RISK_BG[result.riskLevel] ?? "#1e293b";

  const flagsHtml = result.flags.slice(0, 5).map((f) => `
    <div style="background:#1e293b;border-radius:8px;padding:10px;margin-bottom:8px;border-left:3px solid #ef4444;">
      <div style="font-weight:600;margin-bottom:4px;font-size:12px;">${escapeHtml(f.lineItemDescription.slice(0, 80))}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:#94a3b8;">
        <span>Quoted: <b style="color:#fca5a5;">${formatINR(f.quotedRateINR)}</b></span>
        <span>Market: <b style="color:#86efac;">${formatINR(f.marketRateINR)}</b></span>
        <span>+${Math.round(f.inflationPct)}% inflation</span>
      </div>
      <div style="margin-top:4px;font-size:11px;color:#64748b;">${escapeHtml(f.explanation.slice(0, 120))}</div>
    </div>
  `).join("");

  const signalsHtml = result.riskSignals.slice(0, 4).map((s) => `
    <div style="display:flex;align-items:start;gap:6px;margin-bottom:4px;">
      <span style="color:#f97316;flex-shrink:0;">⚠</span>
      <span style="font-size:11px;color:#94a3b8;">${escapeHtml(s)}</span>
    </div>
  `).join("");

  panel.innerHTML = `
    <style>
      #casper-panel::-webkit-scrollbar { width:6px; }
      #casper-panel::-webkit-scrollbar-track { background:#1e293b; }
      #casper-panel::-webkit-scrollbar-thumb { background:#334155;border-radius:3px; }
      .casper-btn { cursor:pointer; transition: opacity 0.15s; }
      .casper-btn:hover { opacity:0.85; }
    </style>
    <div style="padding:16px 20px;">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <span style="font-size:16px;font-weight:700;color:#38bdf8;letter-spacing:-0.5px;">CASPER</span>
        <span style="font-size:10px;color:#475569;margin-left:auto;">
          ${new Date(result.auditedAt).toLocaleTimeString("en-IN")}
        </span>
        <button id="casper-close-panel" class="casper-btn" style="background:none;border:none;color:#64748b;font-size:16px;padding:2px 4px;">✕</button>
      </div>

      <!-- Risk Badge -->
      <div style="display:flex;align-items:center;gap:10px;background:${riskBg};border-radius:10px;padding:12px 14px;margin-bottom:14px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${riskColor};flex-shrink:0;box-shadow:0 0 8px ${riskColor};"></div>
        <div>
          <div style="font-weight:700;color:${riskColor};font-size:14px;text-transform:uppercase;">
            ${result.riskLevel} RISK
          </div>
          ${result.tenderNumber ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">Tender: ${escapeHtml(result.tenderNumber)}</div>` : ""}
        </div>
        <div style="margin-left:auto;text-align:right;">
          ${result.overallInflationPct > 0 ? `<div style="font-size:18px;font-weight:700;color:#fca5a5;">+${result.overallInflationPct}%</div>
          <div style="font-size:10px;color:#64748b;">avg inflation</div>` : ""}
        </div>
      </div>

      <!-- Stats row -->
      ${result.flags.length > 0 || result.totalOverpricedINR > 0 ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
        <div style="background:#1e293b;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#ef4444;">${result.flags.length}</div>
          <div style="font-size:10px;color:#64748b;">Flagged Items</div>
        </div>
        <div style="background:#1e293b;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:14px;font-weight:700;color:#fca5a5;">${result.totalOverpricedINR > 0 ? formatINR(result.totalOverpricedINR) : "—"}</div>
          <div style="font-size:10px;color:#64748b;">Overpriced Amt</div>
        </div>
      </div>` : ""}

      <!-- Verdict -->
      ${result.claudeVerdict ? `
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;color:#475569;margin-bottom:4px;letter-spacing:0.05em;">ML Verdict</div>
        <div style="background:#1e293b;border-radius:8px;padding:8px 12px;font-size:12px;color:#94a3b8;font-style:italic;">
          ${escapeHtml(result.claudeVerdict)}
        </div>
      </div>` : ""}

      <!-- Summary -->
      ${result.summary ? `
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;color:#475569;margin-bottom:4px;letter-spacing:0.05em;">Summary</div>
        <div style="background:#1e293b;border-radius:8px;padding:8px 12px;font-size:12px;color:#94a3b8;line-height:1.5;">
          ${escapeHtml(result.summary.slice(0, 400))}
        </div>
      </div>` : ""}

      <!-- Flags -->
      ${result.flags.length > 0 ? `
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;color:#475569;margin-bottom:6px;letter-spacing:0.05em;">
          Flagged Line Items (${result.flags.length})
        </div>
        ${flagsHtml}
        ${result.flags.length > 5 ? `<div style="font-size:11px;color:#64748b;text-align:center;margin-top:4px;">+${result.flags.length - 5} more — view full report in CASPER</div>` : ""}
      </div>` : ""}

      <!-- Risk Signals -->
      ${result.riskSignals.length > 0 ? `
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;color:#475569;margin-bottom:6px;letter-spacing:0.05em;">Risk Signals</div>
        ${signalsHtml}
      </div>` : ""}

      <!-- Recommendation -->
      ${result.recommendation ? `
      <div style="margin-bottom:14px;">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;color:#475569;margin-bottom:4px;letter-spacing:0.05em;">Recommendation</div>
        <div style="background:#0f2d1f;border:1px solid #166534;border-radius:8px;padding:8px 12px;font-size:12px;color:#86efac;line-height:1.5;">
          ${escapeHtml(result.recommendation.slice(0, 300))}
        </div>
      </div>` : ""}

      <!-- Actions -->
      <div style="display:flex;gap:8px;">
        <button id="casper-reaudit" class="casper-btn" style="flex:1;padding:8px;background:#1e3a5f;color:#38bdf8;border:1px solid #1e4a6e;border-radius:8px;font-size:12px;font-weight:600;">
          Re-Analyze
        </button>
        <button id="casper-view-history" class="casper-btn" style="flex:1;padding:8px;background:#1e293b;color:#94a3b8;border:1px solid #334155;border-radius:8px;font-size:12px;">
          View History ↗
        </button>
      </div>
    </div>
  `;

  panel.querySelector("#casper-close-panel")?.addEventListener("click", togglePanel);
  panel.querySelector("#casper-reaudit")?.addEventListener("click", () => runAudit());
  panel.querySelector("#casper-view-history")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_HISTORY" });
  });
}

// ─── Audit runner ─────────────────────────────────────────────────────────────

function runAudit(): void {
  if (!panelRoot || auditInFlight) return;
  auditInFlight = true;
  renderLoading(panelRoot);

  const payload = {
    sourceURL: window.location.href,
    pageTitle: document.title,
    extractedText: extractPageText()
  };

  chrome.runtime.sendMessage({ type: "AUDIT_PAGE", payload }, (response: { ok: boolean; data?: AuditResult; error?: string }) => {
    auditInFlight = false;
    if (chrome.runtime.lastError) {
      if (panelRoot) renderError(panelRoot, "Extension context error. Try reloading the page.");
      return;
    }
    if (!panelRoot) return;
    if (response?.ok && response.data) {
      renderResult(panelRoot, response.data);
      updateFAB(response.data.riskLevel);
    } else {
      renderError(panelRoot, response?.error ?? "Audit failed. Check your CASPER login in the extension options.");
    }
  });
}

// ─── FAB (floating action button) ────────────────────────────────────────────

function updateFAB(riskLevel?: string): void {
  const fab = document.getElementById("casper-fab");
  if (!fab) return;
  const color = riskLevel ? (RISK_COLORS[riskLevel] ?? "#38bdf8") : "#38bdf8";
  fab.style.background = color;
  fab.style.boxShadow = `0 4px 20px ${color}66`;
}

function togglePanel(): void {
  if (!panelRoot) return;
  panelVisible = !panelVisible;
  panelRoot.style.display = panelVisible ? "block" : "none";
}

// ─── PDF detection ────────────────────────────────────────────────────────────

type PdfAuditData =
  | ({ isTender: true } & AuditResult)
  | { isTender: false; documentType: string; about: string; pageTitle: string; sourceURL: string };

function isPdfPage(): boolean {
  const href = window.location.href;
  const lower = href.toLowerCase();

  // Local downloaded PDFs opened with file://
  if (href.startsWith("file://") && lower.endsWith(".pdf")) return true;

  // Remote PDFs served over https://
  if (lower.startsWith("http") && (lower.endsWith(".pdf") || lower.includes(".pdf?") || lower.includes(".pdf#"))) return true;

  // Content-type header (available as a property in some Chrome versions)
  if ((document as any).contentType === "application/pdf") return true;

  // Fallback: title ends in .pdf and DOM has no readable text (Chrome PDF embed page)
  const titleIsPdf = document.title.toLowerCase().endsWith(".pdf");
  const bodyIsEmpty = (document.body?.innerText?.trim().length ?? 0) < 10;
  return titleIsPdf && bodyIsEmpty;
}

function isLocalPdf(): boolean {
  return window.location.href.startsWith("file://");
}

// Encode a large ArrayBuffer to base64 in chunks (avoids call-stack overflow on large files)
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    binary += String.fromCharCode(...(bytes.subarray(i, i + CHUNK) as unknown as number[]));
  }
  return btoa(binary);
}

function renderNotTender(panel: HTMLDivElement, result: { documentType: string; about: string; pageTitle: string }): void {
  panel.innerHTML = `
    <style>
      #casper-panel::-webkit-scrollbar { width:6px; }
      #casper-panel::-webkit-scrollbar-track { background:#1e293b; }
      #casper-panel::-webkit-scrollbar-thumb { background:#334155;border-radius:3px; }
    </style>
    <div style="padding:16px 20px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <span style="font-size:16px;font-weight:700;color:#38bdf8;letter-spacing:-0.5px;">CASPER</span>
        <button id="casper-close-panel" style="background:none;border:none;color:#64748b;font-size:16px;padding:2px 4px;margin-left:auto;cursor:pointer;">✕</button>
      </div>

      <div style="background:#1e293b;border:2px solid #334155;border-radius:12px;padding:14px 16px;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:20px;">📄</span>
          <div>
            <div style="font-weight:700;color:#e2e8f0;font-size:13px;">Not a Tender Document</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(result.documentType)}</div>
          </div>
        </div>
        <div style="font-size:12px;color:#94a3b8;line-height:1.6;border-top:1px solid #334155;padding-top:8px;margin-top:4px;">
          ${escapeHtml(result.about.slice(0, 400))}
        </div>
      </div>

      <div style="background:#0f2d1f;border:1px solid #166534;border-radius:8px;padding:10px 12px;font-size:12px;color:#86efac;margin-bottom:12px;">
        CASPER only audits government tender and procurement documents. If this is a tender, try uploading it manually via the CASPER dashboard.
      </div>

      <button id="casper-view-history" style="width:100%;padding:8px;background:#1e293b;color:#94a3b8;border:1px solid #334155;border-radius:8px;font-size:12px;cursor:pointer;">
        View Audit History ↗
      </button>
    </div>
  `;
  panel.querySelector("#casper-close-panel")?.addEventListener("click", togglePanel);
  panel.querySelector("#casper-view-history")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_HISTORY" });
  });
}

function handlePdfResponse(response: { ok: boolean; data?: PdfAuditData; error?: string }): void {
  auditInFlight = false;
  if (chrome.runtime.lastError) {
    if (panelRoot) renderError(panelRoot, "Extension context error. Try reloading the page.", runPdfAudit);
    return;
  }
  if (!panelRoot) return;
  if (!response?.ok) {
    renderError(panelRoot, response?.error ?? "PDF audit failed. Check your CASPER login in the popup.", runPdfAudit);
    return;
  }
  const data = response.data!;
  if (!data.isTender) {
    renderNotTender(panelRoot, data as { documentType: string; about: string; pageTitle: string });
    const fab = document.getElementById("casper-fab");
    if (fab) { fab.style.background = "#475569"; fab.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)"; }
  } else {
    renderResult(panelRoot, data as unknown as AuditResult);
    updateFAB((data as any).riskLevel);
  }
}

function runPdfAudit(): void {
  if (!panelRoot || auditInFlight) return;
  auditInFlight = true;
  renderLoading(panelRoot);

  if (isLocalPdf()) {
    // file:// — the service worker cannot fetch file:// URLs.
    // Read bytes directly in the content script (same-origin) and forward as base64.
    fetch(window.location.href)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not read file (${r.status})`);
        return r.arrayBuffer();
      })
      .then((buffer) => {
        const base64 = bufferToBase64(buffer);
        chrome.runtime.sendMessage(
          { type: "AUDIT_PDF_BYTES", payload: { pdfBase64: base64, pageTitle: document.title, sourceURL: window.location.href } },
          handlePdfResponse
        );
      })
      .catch((err: Error) => {
        const fallbackText = extractPageText();
        if (fallbackText.trim().length >= 50) {
          chrome.runtime.sendMessage(
            {
              type: "AUDIT_PAGE",
              payload: {
                sourceURL: window.location.href,
                pageTitle: document.title,
                extractedText: fallbackText
              }
            },
            (response: { ok: boolean; data?: AuditResult; error?: string }) => {
              auditInFlight = false;
              handlePdfResponse(response as unknown as { ok: boolean; data?: PdfAuditData; error?: string });
            }
          );
          return;
        }

        auditInFlight = false;
        if (panelRoot) {
          renderError(
            panelRoot,
            `Could not read PDF: ${err.message}. Enable "Allow access to file URLs" in chrome://extensions for byte-level PDF reading, or open a text-based PDF so CASPER can fall back to page-text analysis.`
          );
        }
      });
  } else {
    // https:// — service worker fetches the URL (includes portal session cookies)
    chrome.runtime.sendMessage(
      { type: "AUDIT_PDF_URL", payload: { pdfUrl: window.location.href, pageTitle: document.title, sourceURL: window.location.href } },
      handlePdfResponse
    );
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init(): void {
  if (document.getElementById("casper-fab")) return; // already injected

  // ── PDF page path ──────────────────────────────────────────────────────────
  if (isPdfPage()) {
    // Chrome's built-in PDF embed renders at z-index 2147483647 (CSS max).
    // Lower it so our FAB and panel can appear above it.
    const pdfEmbed = document.querySelector<HTMLElement>(
      "embed[type='application/x-google-chrome-pdf'], embed[type='application/pdf'], embed"
    );
    if (pdfEmbed) pdfEmbed.style.zIndex = "2147483644";

    // document.body may be minimal on PDF viewer pages — fall back to documentElement
    const mountTarget = document.body ?? document.documentElement;

    panelRoot = createPanel();
    mountTarget.appendChild(panelRoot);

    const fab = document.createElement("div");
    fab.id = "casper-fab";
    fab.title = "CASPER — Click to audit this PDF";
    Object.assign(fab.style, {
      position: "fixed", bottom: "16px", right: "16px",
      height: "52px", borderRadius: "26px",
      background: "#8b5cf6", color: "white",
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: "6px", padding: "0 16px",
      fontSize: "13px", fontWeight: "700",
      zIndex: "2147483647", cursor: "pointer",
      boxShadow: "0 4px 20px #8b5cf666",
      userSelect: "none", fontFamily: "system-ui, sans-serif",
      letterSpacing: "-0.3px", transition: "box-shadow 0.2s, transform 0.1s"
    });
    fab.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      Audit PDF
    `;
    fab.addEventListener("mouseenter", () => { fab.style.transform = "scale(1.04)"; });
    fab.addEventListener("mouseleave", () => { fab.style.transform = "scale(1)"; });
    fab.addEventListener("click", () => {
      if (!panelVisible) { togglePanel(); runPdfAudit(); } else { togglePanel(); }
    });
    mountTarget.appendChild(fab);
    return;
  }

  if (!isTenderPage()) {
    // Still inject a minimal badge for non-tender pages
    const badge = document.createElement("div");
    badge.id = "casper-fab";
    badge.title = "CASPER — Not a tender page";
    Object.assign(badge.style, {
      position: "fixed",
      bottom: "16px",
      right: "16px",
      width: "44px",
      height: "44px",
      borderRadius: "50%",
      background: "#334155",
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "14px",
      fontWeight: "700",
      zIndex: "2147483645",
      cursor: "pointer",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      userSelect: "none",
      fontFamily: "system-ui, sans-serif",
      letterSpacing: "-0.5px"
    });
    badge.textContent = "C";
    document.body.appendChild(badge);
    return;
  }

  // Tender page: inject full FAB + panel
  panelRoot = createPanel();
  document.body.appendChild(panelRoot);

  const fab = document.createElement("div");
  fab.id = "casper-fab";
  fab.title = "CASPER — Click to audit this tender";
  Object.assign(fab.style, {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    height: "52px",
    borderRadius: "26px",
    background: "#38bdf8",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "0 16px",
    fontSize: "13px",
    fontWeight: "700",
    zIndex: "2147483645",
    cursor: "pointer",
    boxShadow: "0 4px 20px #38bdf866",
    userSelect: "none",
    fontFamily: "system-ui, sans-serif",
    letterSpacing: "-0.3px",
    transition: "box-shadow 0.2s, transform 0.1s"
  });
  fab.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
    Audit Tender
  `;

  fab.addEventListener("mouseenter", () => { fab.style.transform = "scale(1.04)"; });
  fab.addEventListener("mouseleave", () => { fab.style.transform = "scale(1)"; });

  fab.addEventListener("click", () => {
    if (!panelVisible) {
      togglePanel();
      runAudit();
    } else {
      togglePanel();
    }
  });

  document.body.appendChild(fab);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
