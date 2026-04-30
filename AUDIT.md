# CASPER Codebase Audit
> Generated: 2026-04-27 | Auditor: Claude (full source read + live system verification)

---

## Section 1 — Codebase Map

### Backend (`backend/src/`)

| File | Description |
|------|-------------|
| `server.ts` | HTTP server bootstrap, Socket.io setup with JWT auth handshake, BullMQ worker start, ML/Ollama probe |
| `app.ts` | Express app: helmet, CORS, morgan, rate limiter, all routers mounted |
| `config/env.ts` | Zod-validated env loader; crashes on startup if any required var missing |
| `config/db.ts` | MongoDB connect with 5-attempt retry |
| `config/redis.ts` | ioredis client + `cacheTtlSeconds` constants |
| `controllers/audits.controller.ts` | `getAuditSummary` (aggregate), `getAuditByTenderId`, `getAuditReport` |
| `controllers/tenders.controller.ts` | `uploadTender` (Multer → ML parse → audit → Mongo), `listTenders` (with sanitizeTenderRecord filter), `getTenderById`, `deleteTender` |
| `controllers/prices.controller.ts` | `getPrices` (Redis-cached), `getPriceHistory`, `createManualPrice` |
| `controllers/voice.controller.ts` | `voiceQuery` — intent extraction via Ollama then `benchmarkService.estimate` — **BROKEN** |
| `controllers/benchmarks.controller.ts` | `getBenchmarks` — passes `type` field, `BenchmarkInput` expects `projectType` — **BROKEN** |
| `controllers/auth.controller.ts` | register, login, refresh, logout — JWT access + refresh tokens |
| `controllers/alerts.controller.ts` | SSE `streamAlerts` (10-second poll, dead — frontend uses Socket.io), `markAlertRead`, `markAllAlertsRead` |
| `controllers/user.controller.ts` | profile, updatePreferences, pushSubscribe, syncTenders |
| `middleware/auth.middleware.ts` | `requireAuth` (Bearer JWT), `requireRole` |
| `middleware/rateLimiter.middleware.ts` | In-memory rate limiter: 100 req/min general, 5 uploads/min, 20 voice/min |
| `middleware/upload.middleware.ts` | Multer disk storage → `/tmp/casper-uploads/` |
| `middleware/validate.middleware.ts` | Zod body validation |
| `middleware/validateQuery.middleware.ts` | Zod query string validation |
| `models/Audit.model.ts` | Audit schema; unique index on `tenderId` present |
| `models/Tender.model.ts` | Tender schema; compound index `{state,status}` present |
| `models/Price.model.ts` | Current live prices; compound index `{material,region,isActive}` |
| `models/PriceHistory.model.ts` | 90-day time series; unique index `{material,region}` |
| `models/Benchmark.model.ts` | World Bank project benchmarks; unique index `{projectId}` |
| `models/Alert.model.ts` | User alerts; index `{userId}` |
| `models/User.model.ts` | Users with preferences (alertThreshold, watchedRegions, pushSubscription) |
| `routes/*.routes.ts` | Thin router files wiring middleware to controllers |
| `schemas/*.schema.ts` | Zod schemas for request validation |
| `services/mlClient.service.ts` | HTTP client to ML service — `parsePdf(filePath)` sends **file path as JSON** (not multipart) |
| `services/ollamaClient.service.ts` | Ollama HTTP wrapper with availability check |
| `services/benchmark.service.ts` | Core fair-cost estimator: material rate lookup → quantity plan → labour/profit/GST |
| `services/alert.service.ts` | `createAlert()` writes to Mongo AND calls `emitAlertToUser` via Socket.io |
| `services/queue.service.ts` | BullMQ workers for gem/indiamart/tradeindia/eprocure/worldbank; **no `new-tender` worker** |
| `services/scrapers/eprocure.scraper.ts` | Puppeteer + Cheerio scraper for eprocure/etenders.gov.in; `fallbackWorldBank()` in same file writes to **TenderModel** (not Benchmark) |
| `services/scrapers/worldbank.scraper.ts` | World Bank API → `BenchmarkModel.findOneAndUpdate` (correct) |
| `services/scrapers/gem.scraper.ts` | GeM price scraper → `upsertPrice` |
| `services/scrapers/indiamart.scraper.ts` | IndiaMART price scraper → `upsertPrice` |
| `services/scrapers/tradeindia.scraper.ts` | TradeIndia price scraper → `upsertPrice` |
| `services/scrapers/shared.ts` | `upsertPrice`, `insertCpwdFallbackForAllRegions`, `CPWD_2024_BASE_RATES`, `logger` |
| `utils/apiResponse.ts` | `sendSuccess` / `sendError` wrappers; all responses use `{ success, data }` envelope |
| `scripts/seed.ts` | Seeds 12 NE India tenders, 8 materials × 3 regions × 90d price history, admin user |
| `scripts/reset-and-seed.ts` | Drops all collections then runs seed |
| `scripts/clean-tenders.ts` | Deletes eProcure-scraped tenders |

### ML Service (`ml-service/`)

| File | Description |
|------|-------------|
| `main.py` | FastAPI app, mounts `/parse` and `/audit` routers |
| `routes/parse.py` | `POST /parse` — accepts `{ filePath }` JSON body; calls `parse_pdf` |
| `routes/audit.py` | `POST /audit` — accepts `{ lineItems, region }`; calls `audit_line_items` |
| `models/schemas.py` | Pydantic models: ParseRequest, ParsedLineItem, ParseResponse, AuditRequest, AuditFlag, AuditResponse |
| `services/pdf_parser.py` | pdfminer → PyMuPDF fallback → Ollama `qwen2.5-coder:7b` extraction → regex fallback |
| `services/nlp_extractor.py` | Ollama material-entity mapper to canonical names (cement, steel_rod, etc.) |
| `services/price_model.py` | Audit logic: calls **`http://127.0.0.1:4000/api/prices`** for market rates; CPWD fallback; confidence scoring; Ollama explanation generation |

### Frontend (`frontend/src/`)

| File | Description |
|------|-------------|
| `main.tsx` | React 18 entry; Redux Provider + BrowserRouter |
| `routes.tsx` | All protected routes using `<ProtectedPage>` |
| `App.tsx` | **DEAD FILE** — returns `<div className="hidden" />`; not imported |
| `app/api.ts` | RTK Query base with `baseQueryWithToast`: unwraps `{ success, data }` envelope; re-auth on 401 |
| `app/store.ts` | Redux store with RTK Query middleware |
| `app/store.js` | **Dead file** — re-exports from store.ts |
| `app/rootReducer.ts` | Combines api, auth, alerts, voice reducers |
| `pages/Dashboard.tsx` | Stat cards + 90d price chart + recent tenders table + AlertFeed |
| `pages/Login.tsx` | Login form |
| `pages/PriceExplorer.tsx` | Material price cards + 90d trend chart + Fair Cost Estimator widget |
| `pages/TenderBrowser.tsx` | Tender list (filters by sourceURL — excludes seeded) + detail view |
| `pages/UploadAudit.tsx` | PDF upload form + progress steps + audit result table |
| `pages/Settings.tsx` | Profile, preferences, dark mode, admin tender sync |
| `features/audits/auditsApi.ts` | `getAuditSummary`, `getAuditByTenderId` RTK endpoints |
| `features/tenders/tendersApi.ts` | `getTenders`, `getTenderById`, `uploadTender` RTK endpoints |
| `features/prices/pricesApi.ts` | `getPrices` (queryFn raw fetch), `getPriceHistory`, `getAllMaterialPrices` |
| `features/benchmarks/benchmarksApi.ts` | `getBenchmark` (queryFn raw fetch) — sends `type` param |
| `features/auth/authSlice.ts` | Auth state: tokens, user, isAuthenticated |
| `features/alerts/alertsSlice.ts` | Socket.io connection + Redux state for live alerts |
| `features/voice/voiceSlice.ts` | Web Speech API recognition + `sendVoiceQuery` thunk |
| `features/user/userApi.ts` | Profile, updatePreferences, pushSubscribe, syncTenders RTK endpoints |
| `components/Layout.tsx` | Sidebar nav + top header + mobile bottom nav + toast system + AppTour |
| `components/StatCard.tsx` | Simple metric display card |
| `components/RiskBadge.tsx` | Color-coded risk indicator |
| `components/AlertFeed.tsx` | Socket.io-fed alert list |
| `components/VoiceMicButton.tsx` | Mic button + SpeechRecognition dispatch |
| `components/SourceRef.tsx` | Source attribution badge |
| `components/AppTour.tsx` | First-run onboarding overlay |
| `utils/format.ts` | `formatCrore`, `formatCurrency`, `formatDate`, `formatRelativeTime` |
| `utils/toast.ts` | Custom event-based toast system |
| `routes.js` | **Dead file** — re-exports from routes.tsx |

### Extension (`extension/src/`)

| File | Description |
|------|-------------|
| `manifest.json` | MV3; references .tsx files directly (no build configured); host_permissions: all URLs |
| `content/inject.tsx` | **STUB** — 12 lines: appends "CASPER Active" blue badge to DOM. No overlay logic |
| `background/service-worker.ts` | Handles PING message only; sets `watchedRegions` on install |
| `popup/Popup.tsx` | Popup UI (unread; reads chrome.storage.local) |
| `options/Options.tsx` | Options page |

### Scripts and Config

| File | Description |
|------|-------------|
| `scripts/start-local.sh` | Starts backend, ML service, frontend in separate terminals |
| `scripts/reset.sh` | Calls backend seed reset endpoint |
| `scripts/verify.sh` | Hits health endpoints |
| `docker-compose.yml` | MongoDB + Redis services (no backend/ML/frontend services defined) |
| `backend/.env.development` | MongoDB Atlas URI (with password), Redis local, JWT secrets (weak: `change_me_access`) |

---

## Section 2 — Feature Completion Matrix

| Feature | Status | Where it lives | Gaps |
|---------|--------|----------------|------|
| Price scraping — GeM | ⚠ PARTIAL | `gem.scraper.ts` | Puppeteer scrapes; falls back to CPWD rates; accuracy unverified |
| Price scraping — IndiaMART | ⚠ PARTIAL | `indiamart.scraper.ts` | Falls back to CPWD rates |
| Price scraping — TradeIndia | ⚠ PARTIAL | `tradeindia.scraper.ts` | Falls back to CPWD rates |
| Price scraping — CPWD SOR | ✅ COMPLETE | `shared.ts` | 360 price records in DB from CPWD fallbacks |
| Price history (90-day) | ✅ COMPLETE | `PriceHistory.model.ts` + seed | 40 PriceHistory docs (8×5 regions), 90 data points each |
| PDF parsing (ML) | ⚠ PARTIAL | `ml-service/services/pdf_parser.py` | Accepts `filePath` JSON — backend passes Multer temp path; works only when both services share filesystem |
| NLP material extraction | ✅ COMPLETE | `nlp_extractor.py` | Ollama qwen2.5-coder:7b with keyword fallback |
| ML audit engine | ✅ COMPLETE | `price_model.py` | Rule-based with confidence thresholds; calls backend API for live rates |
| Explainable AI — line item explanations | ✅ COMPLETE | `price_model._generate_explanation` | Ollama llama3.1 with descriptive fallback |
| Dashboard stat cards | ⚠ PARTIAL | `Dashboard.tsx` | Shows 4 audits, ₹12.13Cr overpriced, 37.7% avg inflation; **Critical Flags stuck at 0** |
| Dashboard 90-day price chart | ✅ COMPLETE | `Dashboard.tsx` | Renders cement + steel lines with 90-day seeded data |
| Dashboard recent tenders | ❌ BROKEN | `Dashboard.tsx:23` | Shows eProcure/eTenders scraped tenders (₹0.00, status:pending) instead of seeded analyzed ones |
| Tender browser list view | ❌ BROKEN | `TenderBrowser.tsx:52` | `filter(row => Boolean(row.sourceURL))` removes ALL seeded tenders (sourceURL=null) |
| Tender browser detail view | ⚠ PARTIAL | `TenderBrowser.tsx` | Structure exists; only shows scraped tenders which have no lineItems or audits |
| Upload PDF → audit flow | ⚠ PARTIAL | `UploadAudit.tsx` + `tenders.controller.ts` | UI complete, ML pipeline runs locally; fails cross-machine |
| Price explorer — material list | ✅ COMPLETE | `PriceExplorer.tsx` | 8 materials with source badge, trend indicator |
| Price explorer — 90-day trend chart | ✅ COMPLETE | `PriceExplorer.tsx` | Assam/Meghalaya/National lines render |
| Fair Cost Estimator | ❌ BROKEN | `benchmarks.controller.ts:8` | Passes `type` field; `BenchmarkInput` expects `projectType`; `normalizeProjectType(undefined)` throws TypeError → 500 on every call |
| Public Benchmark API | ❌ BROKEN | `/api/benchmarks` | Same bug as above; also no API-key gating for public consumers |
| Voice assistant — speech capture | ✅ COMPLETE | `voiceSlice.ts` | Web Speech API with en-IN; dispatches transcript |
| Voice assistant — backend NLP + answer | ❌ BROKEN | `voice.controller.ts:148,157,158` | `type` vs `projectType` mismatch + `result.estimateINR` (should be `estimatedCostINR`) + `result.breakdown.map()` (breakdown is object, not array) |
| Voice assistant — spoken output | ✅ COMPLETE | `voiceSlice.ts` | `SpeechSynthesisUtterance` with en-IN |
| Real-time Socket.io alerts | ⚠ PARTIAL | `server.ts` + `alertsSlice.ts` | Socket.io connect/auth works; **0 Alert documents exist** — no events fire |
| Alert feed UI | ✅ COMPLETE | `AlertFeed.tsx` | Shows empty state; ready when alerts exist |
| Settings — theme/preferences | ✅ COMPLETE | `Settings.tsx` | Dark mode toggle, region preference, alert threshold |
| Settings — admin tender sync | ✅ COMPLETE | `Settings.tsx` | Calls `/api/admin/tenders/sync-last-3-years`; shows results |
| Authentication (login/register) | ✅ COMPLETE | `auth.controller.ts` | JWT access + refresh, bcrypt, Zod validated |
| New-tender ML pipeline | ⛔ MISSING | `queue.service.ts` | `new-tender` BullMQ queue is populated by scraper but **no Worker is defined** → scraped tenders stuck at `status:pending` forever |
| Chrome extension — badge stub | ⚠ PARTIAL | `extension/content/inject.tsx` | "CASPER Active" badge appears; no logic |
| Chrome extension — fraud overlay | ⛔ MISSING | — | Not implemented anywhere |
| Chrome extension — build | ⛔ MISSING | — | No `dist/` output; manifest points to `.tsx` files; unusable without Vite build |
| PDF export of audit report | ⛔ MISSING | — | No jsPDF code anywhere in frontend |
| Push notifications | ⛔ MISSING | — | User model has `pushSubscription` field; no push endpoint or web-push implementation |
| SSE alert stream | ❌ BROKEN | `alerts.controller.ts:20` | `\\n\\n` in template literal produces literal backslash characters, not newlines — SSE protocol broken; frontend never calls this endpoint anyway |
| BullMQ scheduled scrapers | ✅ COMPLETE | `queue.service.ts` | 5 scrapers scheduled (gem/indiamart/tradeindia every 6h; eprocure every 2h; worldbank daily) |
| Dark mode | ✅ COMPLETE | Tailwind `dark:` classes | System-wide; toggle in Settings |
| Mobile responsive layout | ✅ COMPLETE | `Layout.tsx` | Sidebar hidden on mobile, bottom nav shown |
| App tour / onboarding | ✅ COMPLETE | `AppTour.tsx` | First-run overlay, localStorage-gated |

---

## Section 3 — Critical Bugs (demo-blockers)

### BUG-01 — Benchmark endpoint always crashes ❌ CRITICAL
**File:** `backend/src/controllers/benchmarks.controller.ts:8`  
**Symptom:** `GET /api/benchmarks?type=road&region=assam&lengthKm=5&year=2026` returns `500 BENCHMARK_FAILED`. `PriceExplorer` "Fair Cost Estimator" always shows error.  
**Root cause:** Controller passes `{ type: req.query.type, ... }` but `BenchmarkInput` interface declares `projectType` not `type`. At runtime `params.projectType === undefined`, and `normalizeProjectType` calls `undefined.trim()` → TypeError.  
**Fix:** Change `type: req.query.type` → `projectType: req.query.type` in the controller object literal.

### BUG-02 — Voice query endpoint always crashes ❌ CRITICAL
**File:** `backend/src/controllers/voice.controller.ts:148, 157, 158, 163, 170`  
**Symptom:** `POST /api/voice/query` always returns `500 VOICE_QUERY_FAILED`. Voice mic captures speech but backend fails.  
**Root cause:** Three stacked errors:
1. Line 148: `{ type: intent.projectType }` — same `type` vs `projectType` mismatch as BUG-01
2. Lines 157/163/170: `result.estimateINR` — `BenchmarkResult` has `estimatedCostINR`, not `estimateINR`
3. Line 158: `result.breakdown.map(item => ...)` — `breakdown` is `{ rawMaterials, labourAndEquipment, ... }` (an object), not an array  
**Fix:** `projectType: intent.projectType`, `result.estimatedCostINR`, replace `.breakdown.map()` with `Object.entries(result.breakdown).map(...)`.

### BUG-03 — TenderBrowser hides all seeded tenders ❌ CRITICAL
**File:** `frontend/src/pages/TenderBrowser.tsx:52`  
**Symptom:** Tender Browser shows only eProcure/eTenders scraped tenders (₹0 cost, no line items, no audit). All 6 seeded NE India tenders are invisible.  
**Root cause:** `return rows.filter((row) => Boolean(row.sourceURL))` — seeded tenders have `sourceURL: null`. Every manually uploaded/seeded tender is filtered out.  
**Fix:** Remove or invert this filter. Seeded tenders should always be visible; optionally filter out scraped-only tenders with a UI toggle.

### BUG-04 — New-tender queue worker missing ❌ CRITICAL
**File:** `backend/src/services/queue.service.ts:35-96`  
**Symptom:** Scraped tenders are added to `new-tender` BullMQ queue but never analyzed. All 57 scraped tenders remain at `status: "pending"` indefinitely.  
**Root cause:** `startQueueWorkers()` creates Workers for gem/indiamart/tradeindia/eprocure/worldbank but **no Worker for `"new-tender"`**. The eprocure scraper creates this queue (line 10 of eprocure.scraper.ts) and enqueues jobs, but nothing consumes them.  
**Fix:** Add a Worker for `"new-tender"` that calls ML service to parse/audit the tender PDF (or for scraped tenders with no PDF, runs a text-based audit if `rawText` is populated).

### BUG-05 — Dashboard "Recent Tenders" shows ₹0 scraped tenders ❌ HIGH
**File:** `frontend/src/pages/Dashboard.tsx:23` + `backend/src/controllers/tenders.controller.ts:156`  
**Symptom:** "Recent Tenders" table on dashboard shows 8 scraped tenders with ₹0 cost and no audit, not the seeded analyzed tenders.  
**Root cause:** `listTenders` sorts by `createdAt: -1`. Scraped tenders were added after seeding, so they appear first. The dashboard query `useGetTendersQuery({ limit: 8 })` has no filter for status or source portal.  
**Fix:** Add `status: "flagged,clean"` filter to dashboard tender query to show only analyzed tenders, OR add a `sourcePortal: "manual"` option.

### BUG-06 — Critical Flags count is always 0 ❌ HIGH
**File:** `backend/src/controllers/audits.controller.ts:57`  
**Symptom:** Dashboard "Critical Flags" stat card always shows 0.  
**Root cause:** `riskLevel = "critical"` requires `overallInflationPct >= 60`. The highest seeded audit is NH27 at 50.2%. None of the 4 existing audits cross the 60% threshold. The audit summary correctly returns `criticalCount: 0` but the dashboard fallback also computes 0.  
**Fix:** Either add a seeded tender with inflation >= 60% (e.g., set one line item at 120% inflation with a large quantity) OR lower the critical threshold to 40% for demo purposes.

### BUG-07 — SSE alert stream broken (unused but still wrong) ❌ MEDIUM
**File:** `backend/src/controllers/alerts.controller.ts:20`  
**Symptom:** `/api/alerts/stream` endpoint sends malformed SSE data (literal `\n\n` characters instead of two newlines).  
**Root cause:** Template literal `` `data: ${JSON.stringify(rows)}\\n\\n` `` — `\\n` in a template literal produces a literal backslash-n, not a newline. Should be `\n\n`.  
**Impact:** Frontend never calls this endpoint (uses Socket.io instead), so user-visible impact is zero. But the endpoint is dead.

### BUG-08 — ML service has hardcoded localhost URLs ❌ MEDIUM
**Files:** `ml-service/services/price_model.py:37`, `ml-service/services/pdf_parser.py:11`  
**Symptom:** In Docker/separate-machine deployments, ML service cannot reach backend API or Ollama.  
**Root cause:** `http://127.0.0.1:4000/api/prices` and `http://127.0.0.1:11434` are hardcoded. Works for local dev only.  
**Fix:** Move to environment variables in `ml-service/.env`.

### BUG-09 — Frontend TypeScript errors with exactOptionalPropertyTypes ❌ MEDIUM
**Files:** `frontend/src/features/benchmarksApi.ts:60`, `pricesApi.ts:62,94,105`  
**Symptom:** `npx tsc --noEmit` fails on 4 frontend errors. Does not prevent Vite dev server from running.  
**Root cause:** `exactOptionalPropertyTypes: true` in tsconfig; code uses `undefined` in places that require explicit `undefined` in union types.  
**Fix:** Add `| undefined` to affected `headers` and `region` types.

### BUG-10 — `venv/` not in .gitignore ❌ MEDIUM
**File:** `.gitignore`  
**Symptom:** `ml-service/venv/` would be committed to git (350+ MB of Python packages).  
**Root cause:** `.gitignore` has `**/__pycache__/` but not `**/venv/`.  
**Fix:** Add `**/venv/` to `.gitignore`.

---

## Section 4 — Data Integrity Check

### Collection counts (live, verified via `/api/admin/stats`):

| Collection | Count | Expected | Status |
|------------|-------|----------|--------|
| Price | 360 | 8 materials × 5 regions = 40 base | ✓ Scrapers added CPWD fallback data (9 rounds = 360) |
| PriceHistory | 40 | 8 materials × 5 regions = 40 | ✓ Correct |
| Tender | 72 | 12 seeded | ✗ 66 extra from scrapers (33 eprocure + 24 etenders + 9 filtered) |
| Audit | 4 | 7 expected from 12-tender seed | ✗ DB was seeded with older version (6 tenders, 4 flagged) |
| User | 1 | 1 admin | ✓ Correct |
| Alert | 0 | 0 (no audits triggered) | ⚠ Expected; no automated audit pipeline |
| Benchmark | Unknown | >0 (WorldBank scheduled) | Could not verify via API (endpoint broken) |

### Seeded NE India tenders (6 in DB, verified live):

| Tender Number | Status | Cost | lineItems |
|---------------|--------|------|-----------|
| `NHIDCL/NER/NH27/2024/001` | flagged | ₹214 Cr | 4 |
| `PWD/BR/NH715B/2024/003` | flagged | ₹89 Cr | 3 |
| `UDD/ASSAM/SIL/2024/008` | flagged | ₹38 Cr | 2 |
| `APPWD/ITNGR/SEC/2024/011` | flagged | ₹156 Cr | 3 |
| `RDD/ASSAM/JOR/2024/022` | clean | ₹12.4 Cr | 3 |
| `MEPWD/NH/SBP/2024/005` | clean | ₹94.5 Cr | 3 |

Note: These are from the **older seed version** in the database. The current `seed.ts` has 12 tenders with different data. The DB has NOT been re-seeded with the current code.

### Price History (cement/assam — verified via API):
- 90 data points ✓
- Range: 2026-02-03 to 2026-04-27
- Source mix: `seed_cpwd` (historical) + `cpwd_fallback` (recent scraper)

### Dashboard pollution:
- Of 63 API-visible tenders: **57 have `totalEstimatedCostINR = 0`** (failed cost extraction)
- The 8 most recent are all eTenders scraped (status: `pending`)
- Seeded tenders are visible in the API but buried

---

## Section 5 — Type Safety + Lint State

### Backend TypeScript (`npx tsc --noEmit` in `backend/`):

| Error | File | Line | Severity | Impact |
|-------|------|------|----------|--------|
| `type` not in `BenchmarkInput` | `benchmarks.controller.ts` | 8 | **CRITICAL** | Benchmark endpoint 500 at runtime |
| `type` not in `BenchmarkInput` | `voice.controller.ts` | 148 | **CRITICAL** | Voice endpoint 500 at runtime |
| `result.estimateINR` does not exist | `voice.controller.ts` | 157, 163, 170 | **CRITICAL** | Voice endpoint crash |
| `result.breakdown.map` is not a function | `voice.controller.ts` | 158 | **CRITICAL** | Voice endpoint crash |
| Return type mismatch (array vs single) | `shared.ts` | 116 | MEDIUM | No runtime impact (Mongoose create works) |

### Frontend TypeScript (`npx tsc --noEmit` in `frontend/`):

| Error | File | Line | Severity | Impact |
|-------|------|------|----------|--------|
| `headers: T \| undefined` not assignable to `HeadersInit` | `benchmarksApi.ts` | 60 | LOW | No runtime impact |
| Same `headers` issue | `pricesApi.ts` | 62 | LOW | No runtime impact |
| `region: string \| undefined` not assignable with exactOptionalPropertyTypes | `pricesApi.ts` | 94 | LOW | No runtime impact |
| Object possibly undefined | `pricesApi.ts` | 105 | LOW | No runtime impact |

### Python (py_compile on all `ml-service/*.py` excluding venv/):
All files pass. **No syntax errors.**

### Notable `any` types in production paths:
- `benchmarks.controller.ts` passes `req.query.type as string` — loses type safety but not the cause of the bug
- `tenders.controller.ts:43` — `sanitizeTenderRecord` uses generic constrained to `{ title?, tenderNumber?, department? }` — acceptable

---

## Section 6 — Security + Production Hygiene

| Issue | Location | Severity | Notes |
|-------|----------|----------|-------|
| Weak JWT secrets | `backend/.env.development` | HIGH | `change_me_access` / `change_me_refresh` — 16 chars, trivially brute-forceable |
| MongoDB Atlas credentials in tracked env file | `backend/.env.development` | HIGH | `.gitignore` has `!.env.development` which means it IS tracked. Password visible in file. |
| `venv/` not gitignored | `.gitignore` | MEDIUM | Would commit 350+ MB of Python packages |
| Hardcoded backend URL in ML service | `ml-service/services/price_model.py:37`, `pdf_parser.py:11` | MEDIUM | `127.0.0.1:4000` — breaks Docker/prod |
| `new-tender` queue grows unbounded | `queue.service.ts` | MEDIUM | No worker drains the queue; Redis memory risk in production |
| SSE endpoint never cleaned up properly | `alerts.controller.ts:24` | LOW | 10-second polling timer; `req.on("close")` handles cleanup correctly |
| No API key/rate limiting for public benchmark endpoint | `benchmarks.routes.ts` | LOW | Intended to be public per spec; needs token or CORS origin check for prod |
| Dead files pollute codebase | `App.tsx`, `routes.js`, `store.js` | LOW | Confusion risk; no security impact |
| Extension `host_permissions: ["https://*/*"]` | `extension/manifest.json` | LOW | Overbroad for current stub; fine for demo but should restrict to gov domains |
| ML service `/parse` accepts arbitrary file paths | `ml-service/routes/parse.py` | MEDIUM | A caller with network access to port 8000 can read any file on the ML server |
