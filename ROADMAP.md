# CASPER Build Roadmap
> Mission sequence for hackathon demo completion | Based on full codebase audit 2026-04-27

---

## Section 1 — End Vision

When CASPER is complete, the judge sits down to a live dashboard showing 12 real government tenders from Assam and Meghalaya — NH27, Brahmaputra bridge, Silchar drainage — with inflation badges in red. She clicks NH27: the audit panel opens, showing TMT Steel quoted at ₹1,08,000/tonne vs a market rate of ₹58,500, with an AI-written explanation in plain English. She asks the voice assistant "What is the fair cost of a 5km road in Assam right now?" and hears a spoken answer with a rupee figure computed from live CPWD data. She opens Chrome, navigates to eprocure.gov.in, and sees a CASPER overlay inject fraud-risk badges directly onto the tender listing. Back on the dashboard, a live alert pulses: "New high-risk tender flagged — ₹43 Cr estimated overpricing." The judge's note reads: *"This is production-grade anti-corruption infrastructure."*

---

## Section 2 — Mission Sequence

### M1 — Foundation Cleanup: Dashboard Shows Real Data
**Priority:** Must ship first. Every other demo depends on visible, correct data.  
**Why it matters:** The dashboard is the first thing the judge sees. Right now it shows 8 scraped tenders with ₹0.00 cost and no audits. Stat cards show 0 critical flags. The benchmark widget is broken with a 500.

**Acceptance criteria:**
- [ ] `/api/benchmarks?type=road&region=assam&lengthKm=5&year=2026` returns a valid JSON estimate (fix `type` → `projectType` in `benchmarks.controller.ts:8`)
- [ ] Dashboard "Recent Tenders" shows at minimum 4 seeded analyzed tenders with non-zero cost and risk badges
- [ ] "Critical Flags" stat card shows a non-zero number (add one seeded tender with `overallInflationPct >= 60`)
- [ ] "Total Overpriced" and "Average Inflation" values are non-zero and correct on first load
- [ ] `PriceExplorer` Fair Cost Estimator returns a number, not an error
- [ ] `npx tsc --noEmit` on backend passes with 0 errors

**Files to touch:**
- `backend/src/controllers/benchmarks.controller.ts` — change `type:` to `projectType:`
- `backend/src/scripts/seed.ts` — add one tender with a line item at 120%+ inflation; lower `criticalCount` threshold OR tweak overallInflationPct
- `frontend/src/pages/Dashboard.tsx` — add `status: "flagged,clean"` or `sourcePortal: "manual"` to tenders query; OR pass `status=flagged` filter

**Complexity:** S (3–4 files, surgical fixes)  
**Dependencies:** None

---

### M2 — Upload Pipeline: Real PDF In, Real Audit Out
**Priority:** Core demo feature. Without this, CASPER is read-only.  
**Why it matters:** The judge will want to upload a fake tender PDF and see it audited in real time. Right now the voice endpoint is also broken for the same reason as M1.

**Acceptance criteria:**
- [ ] Upload a PDF with known cost line items (e.g., cement at ₹600/bag) → audit shows inflation flag with AI explanation
- [ ] Voice query `POST /api/voice/query` returns `{ answer: "...spoken sentence...", data: { estimatedCostINR: ... } }` — fix all 3 TypeScript errors in `voice.controller.ts`
- [ ] New-tender BullMQ Worker defined in `queue.service.ts` for `"new-tender"` queue (can be a stub that marks `status: "analyzing"` then sets `status: "error"` with a log; full ML integration is stretch)
- [ ] After upload, Socket.io emits an alert when the audit result is flagged
- [ ] `venv/` added to `.gitignore`

**Files to touch:**
- `backend/src/controllers/voice.controller.ts` — fix `type` → `projectType`, `estimateINR` → `estimatedCostINR`, replace `breakdown.map()` with breakdown object iteration
- `backend/src/services/queue.service.ts` — add `new-tender` Worker
- `backend/src/services/alert.service.ts` — call `createAlert()` from upload success path in `tenders.controller.ts`
- `.gitignore` — add `**/venv/`

**Complexity:** M (voice fix is S, new-tender worker is M)  
**Dependencies:** M1 must be complete (benchmark service must work before voice can work end-to-end)

---

### M3 — Tender Browser + Detail Page + PDF Export
**Priority:** Required for demo walk-through of individual audit reports.  
**Why it matters:** The judge needs to click a tender and see its line-by-line breakdown with flags. Right now TenderBrowser silently hides all seeded tenders.

**Acceptance criteria:**
- [ ] TenderBrowser lists all 6 seeded NE India tenders (remove `filter(row => Boolean(row.sourceURL))` at `TenderBrowser.tsx:52`)
- [ ] Clicking a seeded flagged tender shows line items with quoted rate, market rate, inflation %, and AI explanation
- [ ] "Download Audit PDF" button generates a PDF using jsPDF with: tender title, audit date, risk level, line item table, total overpriced, chart as an image
- [ ] Scraped tenders (₹0 cost) are visually de-emphasized or filtered by default (show a "Show scraped tenders" toggle)
- [ ] `TenderBrowser.tsx` no longer crashes on tenders without `sourceURL`

**Files to touch:**
- `frontend/src/pages/TenderBrowser.tsx` — remove sourceURL filter; add jsPDF export button
- `frontend/package.json` — add `jspdf` dependency
- Optional: `frontend/src/pages/TenderBrowser.tsx` — add "Analyzed only" toggle that filters by `status: "flagged" | "clean"`

**Complexity:** M (PDF export adds real work)  
**Dependencies:** M1 (seeded tenders must be visible in API — they already are, just frontend-filtered)

---

### M4 — Voice Mode End-to-End
**Priority:** Demo showstopper feature. Judge asks a question, gets a spoken answer.  
**Why it matters:** Voice mode is one of the five spec requirements and is visually the most memorable demo moment.

**Acceptance criteria:**
- [ ] Click mic button → browser captures speech → transcript appears in bubble above button
- [ ] Backend processes transcript → Ollama extracts intent → `benchmarkService.estimate` runs → spoken answer generated
- [ ] Spoken answer is played back via `SpeechSynthesisUtterance` in en-IN voice
- [ ] Query `"fair cost of 1km road in assam"` returns an answer with a rupee figure
- [ ] If Ollama is unavailable, `fallbackIntent` kicks in and still returns a valid spoken estimate
- [ ] Voice endpoint handles network errors gracefully (does not show blank screen)

**Files to touch:**
- `backend/src/controllers/voice.controller.ts` — 3 bug fixes (covered in M2, but voice is fully testable only after M2 is done)
- No frontend changes required (voice UI is complete)

**Complexity:** S (fixes are already identified; mostly backend one-liners)  
**Dependencies:** M1 (benchmark service must work), M2 (voice controller fixes)

---

### M5 — Real-time Socket.io Alerts
**Priority:** Demo "live system" credibility.  
**Why it matters:** The judge sees a pulse in the header as a new tender is flagged. Without alerts firing, CASPER looks static.

**Acceptance criteria:**
- [ ] When `uploadTender` creates an audit with `riskLevel: "high" | "critical"`, `alertService.createAlert()` is called with type `"new_tender_flagged"`
- [ ] The alert appears in `AlertFeed` within 2 seconds of upload completing, without page refresh
- [ ] Alert badge in Layout header shows unread count
- [ ] "Mark all read" clears the count
- [ ] When the price scraper inserts a CPWD fallback significantly above previous price, it emits a `"price_spike"` alert (optional but high demo value)

**Files to touch:**
- `backend/src/controllers/tenders.controller.ts` — add `alertService.createAlert()` call after successful audit creation
- `backend/src/services/alert.service.ts` — already wired to Socket.io; no changes needed
- Optional: `backend/src/services/scrapers/shared.ts` — add price-spike alert in `upsertPrice` if new price is >20% above previous

**Complexity:** S  
**Dependencies:** M2 (alert fires from audit creation path)

---

### M6 — Chrome Extension Real Overlay Feature
**Priority:** Visual differentiation for the demo. No other team will have a browser extension.  
**Why it matters:** Judge opens eprocure.gov.in in Chrome and CASPER overlays corruption badges — this is visually stunning and memorable.

**Acceptance criteria:**
- [ ] `extension/` has a working Vite build (`npm run build` produces `dist/`)
- [ ] Extension can be loaded unpacked in Chrome
- [ ] On `eprocure.gov.in` and `etenders.gov.in`: content script reads tender numbers from the page DOM
- [ ] For each tender number, content script sends a message to background service worker which calls CASPER API (`/api/tenders?tenderNumber=...`) using stored JWT
- [ ] If tender exists in CASPER with an audit: injects a colored badge (red for flagged, green for clean) next to tender title on the page
- [ ] JWT is shared via `chrome.storage.local` when user logs in to the PWA (or popup has its own login form)
- [ ] Extension popup shows connection status and unread alert count

**Files to touch:**
- `extension/vite.config.ts` — ensure MV3 output with correct entry points
- `extension/src/content/inject.tsx` — full replacement: DOM scanner + badge injection
- `extension/src/background/service-worker.ts` — API fetch helper with JWT from storage
- `extension/src/popup/Popup.tsx` — connection status, unread count, login link
- `extension/manifest.json` — point to built `dist/` paths

**Complexity:** L (DOM injection, message passing, auth sharing — all new)  
**Dependencies:** M1 (API must work), M3 (tenders must be fetchable by tenderNumber)

---

### M7 — Mobile Responsive + Dark Mode + Loading/Error States
**Priority:** Polish before demo day.  
**Why it matters:** The judge may use a tablet. Dark mode is visually impressive. Skeleton loaders prevent jarring blank states.

**Acceptance criteria:**
- [ ] Dashboard renders correctly on 375px wide mobile (no horizontal overflow)
- [ ] Dark mode toggle in Settings applies to all pages consistently
- [ ] Every data-fetching component shows a skeleton loader while loading
- [ ] Every API error shows a user-friendly inline error message (not just a toast)
- [ ] Console has 0 errors on Chrome DevTools (fix key prop warnings, etc.)
- [ ] App Tour is visually correct in dark mode

**Files to touch:**
- Multiple page and component files — targeted Tailwind fixes
- `frontend/src/index.css` — ensure dark mode base styles

**Complexity:** S (mostly CSS; app structure is already responsive)  
**Dependencies:** M1, M3 (pages must be functional first)

---

### M8 — Demo Polish: Auto-Replay Mode + Animations + Deploy
**Priority:** Final hardening before stage presentation.  
**Why it matters:** Judges see 50+ teams. CASPER must look practiced and production-grade. A live deploy link is a major credibility signal.

**Acceptance criteria:**
- [ ] "Demo Mode" toggle in Settings fills dashboard with seeded data (bypass auth, pre-populate all widgets)
- [ ] Smooth page transitions (Tailwind `transition-all`, `animate-fade-in` classes)
- [ ] Fraud badge numbers animate on change (counter animation for Total Overpriced)
- [ ] PDF export button works on the demo machine without internet
- [ ] App accessible at a public URL (Render/Railway backend + Vercel frontend OR ngrok tunnel) with demo credentials pre-seeded
- [ ] `README.md` updated with 60-second setup instructions and demo login credentials

**Files to touch:**
- `frontend/src/pages/Dashboard.tsx` — animation classes
- `frontend/src/pages/Settings.tsx` — demo mode toggle
- Various deploy config files

**Complexity:** S–M (deploy config varies by target platform)  
**Dependencies:** All M1–M7

---

## Section 3 — What We CUT for the Hackathon

| Feature | Why cut |
|---------|---------|
| **Full XGBoost ML model training** | Rule-based audit with CPWD rates + Ollama explanations is demo-sufficient; training pipeline would take days and add fragility |
| **Web Push notifications** | Service worker push requires VAPID keys, subscription management, and a push server — too much infra for a demo |
| **SSE alert stream** (`/api/alerts/stream`) | Socket.io is already wired and working; SSE is dead code with a bug; cutting it reduces surface area |
| **Arunachal/Manipur price data** | Only Assam, Meghalaya, and National are seeded; extension of price data to other states is data entry work, not engineering |
| **Multi-tenant / multi-user demo** | Single admin user is sufficient for the demo; RBAC is implemented but not showcased |
| **GeM/IndiaMART/TradeIndia live scraping accuracy** | Scrapers fall back to CPWD rates reliably; live scraping from private portals is fragile and unpredictable; demo uses CPWD + seeded data |
| **Public API key gating** | The `GET /api/benchmarks` public API exists but has no rate limiting or key requirement; sufficient for a hackathon demo without hardening |
| **PDF form data extraction for `.docx` / `.xlsx`** | ML service only handles PDF via pdfminer/PyMuPDF; Word/Excel DPRs would need python-docx/openpyxl; deferred |
| **Historical audit replay** | No time-travel into past price states; all audits use current market rates |

---

## Section 4 — Demo Script (2 Minutes, Judge-Facing)

### 0:00–0:20 — Hook: The Problem
> "North East India loses ₹3,000 crore annually to inflated infrastructure tenders. Cement quoted at ₹600 when the market price is ₹385. Nobody catches it in real time. Until now."

*(Show dashboard with red critical-flag badge and Total Overpriced number)*

### 0:20–0:45 — Core Feature: Live Audit
> "Here's a live NH-27 highway tender. CASPER detected TMT Steel quoted at ₹1,08,000 per tonne — 84.6% above market. The AI explains, in plain English, why this is suspicious."

*(Click NH27 → tender detail opens → scroll to flag explanations with rupee amounts)*

### 0:45–1:05 — Voice Mode
> "Citizens can ask questions in natural language."

*(Click mic → say "What is the fair cost of a 5km road in Assam?" → wait for spoken answer → overlay quote appears in bubble)*

### 1:05–1:20 — Price Explorer + Benchmark API
> "CASPER cross-references 8 construction materials across 5 regions, updated continuously. Journalists can call our REST API for fair-cost benchmarks."

*(Switch to Price Explorer → show cement trend chart → show Fair Cost Estimator card with breakdown)*

### 1:20–1:40 — Chrome Extension
> "And if you're a procurement officer reviewing tenders on eprocure.gov.in — CASPER overlays directly on the page."

*(Open Chrome on eprocure.gov.in → show fraud badge injected next to a tender title)*

### 1:40–2:00 — Close
> "Built on Ollama — no cloud AI, no data leaves the machine. Open source, deployable in 60 seconds. CASPER: making every rupee accountable."

*(Show real-time alert pulse in header: "New high-risk tender flagged — ₹43 Cr estimated overpricing")*
