import { Job, Queue, Worker } from "bullmq";
import { Types } from "mongoose";
import { redis } from "../config/redis.js";
import { alertService } from "./alert.service.js";
import { mlClient } from "./mlClient.service.js";
import { UserModel } from "../models/User.model.js";
import { TenderModel } from "../models/Tender.model.js";
import { AuditModel } from "../models/Audit.model.js";
import { PriceModel } from "../models/Price.model.js";
import { runEprocureScraper } from "./scrapers/eprocure.scraper.js";
import { runGemScraper } from "./scrapers/gem.scraper.js";
import { scrapeIoclBitumen } from "./scrapers/iocl.scraper.js";
import { runIndiaMartScraper } from "./scrapers/indiamart.scraper.js";
import { scrapeSailSteel } from "./scrapers/sail.scraper.js";
import { runTradeIndiaScraper } from "./scrapers/tradeindia.scraper.js";
import { runWorldBankScraper } from "./scrapers/worldbank.scraper.js";
import { buildTenderCostBreakdown } from "../utils/costBreakdown.js";
import { determineTenderStatus } from "../utils/tenderStatus.js";

export const queueNames = {
  gem: "gem-scraper",
  indiamart: "indiamart-scraper",
  tradeindia: "tradeindia-scraper",
  eprocure: "eprocure-scraper",
  worldbank: "worldbank-scraper",
  iocl: "iocl-scraper",
  sail: "sail-scraper",
  newTender: "new-tender"
} as const;

export const gemQueue = new Queue(queueNames.gem, { connection: redis });
export const indiamartQueue = new Queue(queueNames.indiamart, { connection: redis });
export const tradeindiaQueue = new Queue(queueNames.tradeindia, { connection: redis });
export const eprocureQueue = new Queue(queueNames.eprocure, { connection: redis });
export const worldbankQueue = new Queue(queueNames.worldbank, { connection: redis });
export const ioclQueue = new Queue(queueNames.iocl, { connection: redis });
export const sailQueue = new Queue(queueNames.sail, { connection: redis });
export const newTenderQueue = new Queue(queueNames.newTender, { connection: redis });

const deriveRiskLevel = (overallInflationPct: number): "low" | "medium" | "high" | "critical" => {
  if (overallInflationPct >= 60) return "critical";
  if (overallInflationPct >= 30) return "high";
  if (overallInflationPct >= 10) return "medium";
  return "low";
};

const alertAdmin = async (message: string): Promise<void> => {
  const admin = await UserModel.findOne({ role: "admin" }).lean();
  if (!admin) return;
  await alertService.createAlert({
    userId: admin._id.toString(),
    type: "scrape_error",
    message
  });
};

export const startQueueWorkers = (): void => {
  const gemProcessor = async (): Promise<void> => {
    try {
      const count = await runGemScraper();
      console.log(`GeM scraper done, ${count} records`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown GeM scraper error";
      console.error("Scraper gem failed", error);
      await alertAdmin(message);
      throw error;
    }
  };

  const indiamartProcessor = async (): Promise<void> => {
    try {
      const count = await runIndiaMartScraper();
      console.log(`IndiaMART scraper done, ${count} records`);
    } catch (error) {
      console.error("Scraper indiamart failed", error);
      await alertAdmin(error instanceof Error ? error.message : "Unknown IndiaMART scraper error");
      throw error;
    }
  };

  const tradeindiaProcessor = async (): Promise<void> => {
    try {
      const count = await runTradeIndiaScraper();
      console.log(`TradeIndia scraper done, ${count} records`);
    } catch (error) {
      console.error("Scraper tradeindia failed", error);
      await alertAdmin(error instanceof Error ? error.message : "Unknown TradeIndia scraper error");
      throw error;
    }
  };

  const eprocureProcessor = async (): Promise<void> => {
    try {
      const count = await runEprocureScraper();
      console.log(`eProcure scraper done, ${count} records`);
    } catch (error) {
      console.error("Scraper eprocure failed", error);
      await alertAdmin(error instanceof Error ? error.message : "Unknown eProcure scraper error");
      throw error;
    }
  };

  const worldbankProcessor = async (): Promise<void> => {
    try {
      const count = await runWorldBankScraper();
      console.log(`WorldBank scraper done, ${count} records`);
    } catch (error) {
      console.error("Scraper worldbank failed", error);
      await alertAdmin(error instanceof Error ? error.message : "Unknown WorldBank scraper error");
      throw error;
    }
  };

  const ioclProcessor = async (): Promise<void> => {
    try {
      const count = await scrapeIoclBitumen();
      console.log(`IOCL bitumen scraper done, ${count} records`);
    } catch (error) {
      console.error("Scraper iocl failed", error);
      await alertAdmin(error instanceof Error ? error.message : "Unknown IOCL scraper error");
      throw error;
    }
  };

  const sailProcessor = async (): Promise<void> => {
    try {
      const count = await scrapeSailSteel();
      console.log(`SAIL steel scraper done, ${count} records`);
    } catch (error) {
      console.error("Scraper sail failed", error);
      await alertAdmin(error instanceof Error ? error.message : "Unknown SAIL scraper error");
      throw error;
    }
  };

  const newTenderProcessor = async (job: Job<{ tenderId: string }>): Promise<void> => {
    const { tenderId } = job.data;
    const tender = await TenderModel.findById(tenderId);
    if (!tender) return;
    if (tender.status !== "pending" && tender.status !== "error") return;

    tender.status = "analyzing";
    await tender.save();

    try {
      const filePath = (tender as unknown as { filePath?: string }).filePath;

      // Fetch active prices for heuristic/ML context
      const activePrices = await PriceModel.find({ isActive: true }).lean();
      const prices = activePrices.map((p) => ({
        material: p.material,
        marketRatePerUnit: p.priceINR,
        unit: p.unit
      }));

      let auditResult: Awaited<ReturnType<typeof mlClient.auditFromText>>;
      let pdfLineItems: Awaited<ReturnType<typeof mlClient.parsePdf>> = [];
      let auditFlags: Awaited<ReturnType<typeof mlClient.auditLineItems>>["flags"] = [];
      let mlModelVersion = "text-heuristic-v1";

      if (filePath) {
        pdfLineItems = await mlClient.parsePdf(filePath);
        const pdfAudit = await mlClient.auditLineItems({ lineItems: pdfLineItems, region: tender.state });
        auditFlags = pdfAudit.flags;
        mlModelVersion = pdfAudit.modelVersion;
        const overallInflationPct =
          auditFlags.length > 0
            ? auditFlags.reduce((sum, f) => sum + f.inflationPct, 0) / auditFlags.length
            : 0;
        const riskLevel = deriveRiskLevel(overallInflationPct);
        const totalOverpricedINR = pdfLineItems.reduce((sum, item) => {
          const flag = auditFlags.find((f) => f.lineItemDescription === item.description);
          if (!flag) return sum;
          return sum + (item.quotedRateINR - flag.marketRateINR) * item.quantity;
        }, 0);
        auditResult = {
          lineItems: pdfLineItems.map((item) => {
            const flag = auditFlags.find((f) => f.lineItemDescription === item.description);
            return {
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              quotedRateINR: item.quotedRateINR,
              marketRateINR: flag?.marketRateINR ?? null,
              inflationPct: flag?.inflationPct ?? null,
              flagged: Boolean(flag)
            };
          }),
          riskLevel,
          overallInflationPct,
          totalOverpricedINR,
          summary: ""
        };
      } else {
        auditResult = await mlClient.auditFromText(tender.rawText ?? "", prices);
      }

      const existingAudit = await AuditModel.findOne({ tenderId: tender._id }).lean();
      if (!existingAudit) {
        const flags = filePath
          ? auditFlags
          : auditResult.lineItems
              .filter((i) => i.flagged)
              .map((i) => ({
                lineItemDescription: i.description,
                quotedRateINR: i.quotedRateINR ?? 0,
                marketRateINR: i.marketRateINR ?? 0,
                inflationPct: i.inflationPct ?? 0,
                confidence: 0.6,
                explanation: `Quoted ₹${i.quotedRateINR} vs market ₹${i.marketRateINR}`
              }));

        await AuditModel.create({
          tenderId: new Types.ObjectId(tender._id.toString()),
          auditedAt: new Date(),
          overallInflationPct: auditResult.overallInflationPct,
          totalOverpricedINR: auditResult.totalOverpricedINR,
          riskLevel: auditResult.riskLevel,
          flags,
          mlModelVersion,
          reportURL: null
        });
      }

      const finalStatus = determineTenderStatus({
        totalEstimatedCostINR: tender.totalEstimatedCostINR,
        lineItemCount: tender.lineItems.length,
        riskLevel: auditResult.riskLevel
      });
      tender.status = finalStatus;
      if (auditResult.lineItems.length > 0 && tender.lineItems.length === 0) {
        tender.lineItems = auditResult.lineItems.map((i) => ({
          description: i.description,
          quantity: i.quantity ?? 0,
          unit: i.unit,
          quotedRateINR: i.quotedRateINR ?? 0,
          totalCostINR: (i.quantity ?? 0) * (i.quotedRateINR ?? 0),
          marketRateINR: i.marketRateINR,
          inflationPct: i.inflationPct,
          flagged: i.flagged,
          flagReason: i.flagged ? `Inflation ${i.inflationPct?.toFixed(1) ?? "?"}%` : null
        }));
      }
      tender.costBreakdown = buildTenderCostBreakdown({
        totalEstimatedCostINR: tender.totalEstimatedCostINR,
        projectType: tender.projectType,
        state: tender.state,
        lineItemCount: tender.lineItems.length
      });
      tender.boqAvailable = tender.lineItems.length > 0;
      tender.itemizationStatus = tender.lineItems.length >= 10 ? "detailed" : tender.lineItems.length > 0 ? "partial" : "none";
      tender.dataCompletenessScore = Math.min(
        100,
        (tender.lineItems.length >= 10 ? 40 : tender.lineItems.length > 0 ? 20 : 0) +
          (tender.locationText ? 15 : 0) +
          (tender.contractYear ? 15 : 0) +
          (tender.vendorName ? 10 : 0) +
          (tender.procurementMethod && tender.procurementMethod !== "other" ? 10 : 0) +
          (tender.boqDocumentURL ? 10 : 0)
      );
      await tender.save();

      if ((auditResult.riskLevel === "high" || auditResult.riskLevel === "critical") && finalStatus === "flagged") {
        const uploaderId = tender.uploadedBy?.toString();
        const alertUserId =
          uploaderId ?? (await UserModel.findOne({ role: "admin" }).lean())?._id.toString();
        if (alertUserId) {
          await alertService.createAlert({
            userId: alertUserId,
            type: "new_tender_flagged",
            message: `${tender.title} — ₹${(auditResult.totalOverpricedINR / 1e7).toFixed(2)} Cr estimated overpricing`,
            tenderId: tender._id.toString()
          });
        }
      }
    } catch (err) {
      console.error("[new-tender worker] Failed to process tender", tenderId, err);
      tender.status = "error";
      (tender as unknown as { errorMessage?: string }).errorMessage =
        err instanceof Error ? err.message : "Unknown error";
      await tender.save();
      throw err;
    }
  };

  new Worker(queueNames.gem, gemProcessor, { connection: redis });
  new Worker(queueNames.indiamart, indiamartProcessor, { connection: redis });
  new Worker(queueNames.tradeindia, tradeindiaProcessor, { connection: redis });
  new Worker(queueNames.eprocure, eprocureProcessor, { connection: redis });
  new Worker(queueNames.worldbank, worldbankProcessor, { connection: redis });
  new Worker(queueNames.iocl, ioclProcessor, { connection: redis });
  new Worker(queueNames.sail, sailProcessor, { connection: redis });
  new Worker(queueNames.newTender, newTenderProcessor, { connection: redis });

  // Trigger a startup scrape if there are fewer than 10 ready tenders
  TenderModel.countDocuments({ status: { $in: ["clean", "flagged"] } })
    .then(async (readyCount) => {
      if (readyCount < 10) {
        await eprocureQueue.add("startup-scrape", {}, {
          delay: 8000,
          jobId: "startup-scrape-once",
          removeOnComplete: true
        });
        console.log(`[queue] Startup scrape triggered — only ${readyCount} ready tenders`);
      }
    })
    .catch((err) => console.error("[queue] Startup scrape check failed", err));
};

export const scheduleScrapers = async (): Promise<void> => {
  const sixHours = 6 * 60 * 60 * 1000;
  const twoHours = 2 * 60 * 60 * 1000;
  const day = 24 * 60 * 60 * 1000;
  await gemQueue.upsertJobScheduler("gem-repeat", { every: sixHours }, { name: "scrape-gem", data: {} });
  await indiamartQueue.upsertJobScheduler(
    "indiamart-repeat",
    { every: sixHours },
    { name: "scrape-indiamart", data: {} }
  );
  await tradeindiaQueue.upsertJobScheduler(
    "tradeindia-repeat",
    { every: sixHours },
    { name: "scrape-tradeindia", data: {} }
  );
  await eprocureQueue.upsertJobScheduler("eprocure-repeat", { every: twoHours }, { name: "scrape-eprocure", data: {} });
  await worldbankQueue.upsertJobScheduler("worldbank-repeat", { every: day }, { name: "scrape-worldbank", data: {} });
  // IOCL bitumen prices update monthly; daily scraping is sufficient for demo freshness
  await ioclQueue.upsertJobScheduler("iocl-repeat", { every: day }, { name: "scrape-iocl", data: {} });
  // SAIL steel prices can shift weekly; scrape every 12 hours
  await sailQueue.upsertJobScheduler("sail-repeat", { every: twoHours * 6 }, { name: "scrape-sail", data: {} });
};

export const runAllScrapersNow = async (): Promise<void> => {
  await Promise.all([
    gemQueue.add("scrape-gem-manual", {}),
    indiamartQueue.add("scrape-indiamart-manual", {}),
    tradeindiaQueue.add("scrape-tradeindia-manual", {}),
    eprocureQueue.add("scrape-eprocure-manual", {}),
    worldbankQueue.add("scrape-worldbank-manual", {}),
    ioclQueue.add("scrape-iocl-manual", {}),
    sailQueue.add("scrape-sail-manual", {})
  ]);
};
