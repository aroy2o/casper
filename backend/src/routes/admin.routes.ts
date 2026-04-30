import { Response, Router } from "express";
import { AlertModel } from "../models/Alert.model.js";
import { AuditModel } from "../models/Audit.model.js";
import { PriceHistoryModel } from "../models/PriceHistory.model.js";
import { PriceModel } from "../models/Price.model.js";
import { TenderModel } from "../models/Tender.model.js";
import { UserModel } from "../models/User.model.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { runAllScrapersNow } from "../services/queue.service.js";
import { runEprocureScraper } from "../services/scrapers/eprocure.scraper.js";
import { scrapeIoclBitumen } from "../services/scrapers/iocl.scraper.js";
import { scrapeSailSteel } from "../services/scrapers/sail.scraper.js";
import { MATERIALS, insertCpwdFallbackForAllRegions } from "../services/scrapers/shared.js";
import { redis } from "../config/redis.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(["admin"]));

adminRouter.delete("/reset", async (_req, res) => {
  try {
    await Promise.all([
      PriceModel.deleteMany({}),
      PriceHistoryModel.deleteMany({}),
      TenderModel.deleteMany({}),
      AuditModel.deleteMany({}),
      AlertModel.deleteMany({})
    ]);
    return sendSuccess(res, { dropped: ["prices", "priceHistory", "tenders", "audits", "alerts"] });
  } catch {
    return sendError(res, { code: "ADMIN_RESET_FAILED", message: "Unable to reset collections" }, 500);
  }
});

adminRouter.get("/scrape-now", async (_req, res) => {
  try {
    await runAllScrapersNow();
    return sendSuccess(res, { queued: true });
  } catch {
    return sendError(res, { code: "SCRAPE_TRIGGER_FAILED", message: "Unable to trigger scrapers" }, 500);
  }
});

type SyncInput = {
  yearsBack?: unknown;
  terms?: unknown;
  portals?: unknown;
  scope?: unknown;
  maxRecords?: unknown;
};

const runTenderSync = async (input: SyncInput, res: Response): Promise<void> => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const yearsBackRaw = Number(input.yearsBack ?? 3);
    const yearsBack = Number.isFinite(yearsBackRaw) ? Math.max(1, Math.min(10, Math.trunc(yearsBackRaw))) : 3;
    const termsRaw = typeof input.terms === "string" ? input.terms : "";
    const terms = termsRaw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const portalsRaw = typeof input.portals === "string" ? input.portals : "";
    const portalCandidates = portalsRaw
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is "eprocure" | "etenders" | "worldbank" =>
        value === "eprocure" || value === "etenders" || value === "worldbank"
      );

    const scope = typeof input.scope === "string" ? input.scope : undefined;
    const maxRecordsRaw = Number(input.maxRecords ?? 5000);
    const maxRecords = Number.isFinite(maxRecordsRaw) ? Math.max(100, Math.min(20000, Math.trunc(maxRecordsRaw))) : 5000;

    const scrapeOptions: Parameters<typeof runEprocureScraper>[0] = { yearsBack };
    if (terms.length > 0) {
      scrapeOptions.terms = terms;
    }
    if (portalCandidates.length > 0) {
      scrapeOptions.portals = portalCandidates;
    }
    if (scope) {
      scrapeOptions.scope = scope;
    }
    scrapeOptions.maxRecords = maxRecords;
    const beforeCount = await TenderModel.countDocuments({});
    const result = await runEprocureScraper(scrapeOptions);
    const afterCount = await TenderModel.countDocuments({});
    const alreadyExist = result.found - result.inserted;
    sendSuccess(res, {
      synced: true,
      found: result.found,
      inserted: result.inserted,
      alreadyExist,
      beforeCount,
      afterCount,
      yearsBack,
      scope,
      maxRecords,
      terms: terms.length > 0 ? terms : undefined,
      portals: portalCandidates.length > 0 ? portalCandidates : undefined
    });
    return;
  } catch {
    sendError(res, { code: "TENDER_SYNC_FAILED", message: "Unable to sync historical tenders" }, 500);
    return;
  }
};

adminRouter.post("/tenders/sync-last-3-years", async (req, res) => {
  await runTenderSync(req.body as SyncInput, res);
});

adminRouter.get("/tenders/sync-last-3-years", async (req, res) => {
  await runTenderSync(req.query as SyncInput, res);
});

// Materials handled by live scrapers — everything else gets CPWD fallback
const LIVE_SCRAPER_MATERIALS = new Set(["bitumen", "steel_rod"]);

adminRouter.post("/prices/refresh", async (_req, res) => {
  const sources: string[] = [];
  const errors: string[] = [];
  let updated = 0;

  // Run IOCL (bitumen) and SAIL (steel_rod) in parallel
  const [ioclResult, sailResult] = await Promise.allSettled([
    scrapeIoclBitumen(),
    scrapeSailSteel()
  ]);

  if (ioclResult.status === "fulfilled") {
    updated += ioclResult.value;
    sources.push("iocl");
  } else {
    errors.push(`iocl: ${ioclResult.reason instanceof Error ? ioclResult.reason.message : "unknown"}`);
  }

  if (sailResult.status === "fulfilled") {
    updated += sailResult.value;
    sources.push("sail");
  } else {
    errors.push(`sail: ${sailResult.reason instanceof Error ? sailResult.reason.message : "unknown"}`);
  }

  // CPWD fallback for remaining materials not covered by live scrapers
  const remainingMaterials = MATERIALS.filter((m) => !LIVE_SCRAPER_MATERIALS.has(m.material));
  for (const mat of remainingMaterials) {
    try {
      const count = await insertCpwdFallbackForAllRegions({
        material: mat.material,
        sourceURL: "https://cpwd.gov.in",
        reason: "manual_refresh"
      });
      updated += count;
    } catch (err) {
      errors.push(`cpwd:${mat.material}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  if (remainingMaterials.length > 0) sources.push("cpwd");

  // Flush backend price cache so the next GET /api/prices returns fresh data
  const priceKeys = await redis.keys("prices:v2:*");
  if (priceKeys.length > 0) {
    await redis.del(...priceKeys);
  }

  return sendSuccess(res, { updated, sources, errors });
});

adminRouter.get("/stats", async (_req, res) => {
  try {
    const [prices, priceHistory, tenders, audits, users, alerts] = await Promise.all([
      PriceModel.countDocuments({}),
      PriceHistoryModel.countDocuments({}),
      TenderModel.countDocuments({}),
      AuditModel.countDocuments({}),
      UserModel.countDocuments({}),
      AlertModel.countDocuments({})
    ]);
    return sendSuccess(res, { prices, priceHistory, tenders, audits, users, alerts });
  } catch {
    return sendError(res, { code: "ADMIN_STATS_FAILED", message: "Unable to fetch stats" }, 500);
  }
});
