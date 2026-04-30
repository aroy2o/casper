import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { AlertModel } from "../models/Alert.model.js";
import { AuditModel } from "../models/Audit.model.js";
import { BenchmarkModel } from "../models/Benchmark.model.js";
import { PriceHistoryModel } from "../models/PriceHistory.model.js";
import { PriceModel } from "../models/Price.model.js";
import { TenderModel } from "../models/Tender.model.js";
import { UserModel } from "../models/User.model.js";
import { CPWD_2024_BASE_RATES, MATERIALS, logger } from "../services/scrapers/shared.js";
import { INDIA_GEO } from "../data/india-districts.js";
import { runGemScraper } from "../services/scrapers/gem.scraper.js";
import { runIndiaMartScraper } from "../services/scrapers/indiamart.scraper.js";
import { runTradeIndiaScraper } from "../services/scrapers/tradeindia.scraper.js";
import { runWorldBankScraper } from "../services/scrapers/worldbank.scraper.js";

type SeedPoint = { date: Date; priceINR: number; source: string };

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);

const build90DayHistory = (startPrice: number, source: string): SeedPoint[] => {
  const points: SeedPoint[] = [];
  const today = new Date();
  const min = startPrice * 0.85;
  const max = startPrice * 1.35;
  let prev = startPrice;

  for (let i = 0; i < 90; i += 1) {
    const daysAgo = 90 - i;
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    const randomWalk = randomBetween(-0.015, 0.025);
    const next = clamp(prev * (1 + randomWalk), min, max);
    const rounded = Math.round(next * 100) / 100;
    points.push({ date, priceINR: rounded, source });
    prev = rounded;
  }
  return points;
};

type RegionEntry = { region: string; state: string | null; stateCode: string | null; multiplier: number };

const ALL_REGIONS: RegionEntry[] = [
  { region: "national", state: null, stateCode: null, multiplier: 1 },
  ...INDIA_GEO.map((s) => ({ region: s.code, state: s.name, stateCode: s.code, multiplier: s.regionMultiplier }))
];

const seedPricesAndHistory = async (): Promise<{
  priceRecords: number;
  historyDocs: number;
  materials: number;
  regions: number;
}> => {
  const historyOps: Parameters<typeof PriceHistoryModel.bulkWrite>[0] = [];
  const priceDocs: Array<{
    material: string;
    region: string;
    state: string | null;
    stateCode: string | null;
    unit: string;
    priceINR: number;
    source: string;
    sourceURL: string;
    scrapedAt: Date;
    isActive: boolean;
  }> = [];

  for (const materialConfig of MATERIALS) {
    const base = CPWD_2024_BASE_RATES[materialConfig.material];
    if (!base) continue;

    for (const reg of ALL_REGIONS) {
      const startPrice = Math.round(base.priceINR * reg.multiplier * 100) / 100;
      const points = build90DayHistory(startPrice, "seed_cpwd");
      const latest = points[points.length - 1];
      if (!latest) continue;

      historyOps.push({
        updateOne: {
          filter: { material: materialConfig.material, region: reg.region },
          update: {
            $set: {
              material: materialConfig.material,
              region: reg.region,
              state: reg.state,
              stateCode: reg.stateCode,
              dataPoints: points
            }
          },
          upsert: true
        }
      });

      priceDocs.push({
        material: materialConfig.material,
        region: reg.region,
        state: reg.state,
        stateCode: reg.stateCode,
        unit: base.unit,
        priceINR: latest.priceINR,
        source: "cpwd_seed",
        sourceURL: "https://cpwd.gov.in",
        scrapedAt: new Date(),
        isActive: true
      });
    }
  }

  if (historyOps.length > 0) {
    await PriceHistoryModel.bulkWrite(historyOps, { ordered: false });
  }
  if (priceDocs.length > 0) {
    await PriceModel.insertMany(priceDocs, { ordered: false });
  }

  return {
    priceRecords: priceDocs.length,
    historyDocs: historyOps.length,
    materials: MATERIALS.length,
    regions: ALL_REGIONS.length
  };
};

const ensureAdminUser = async (): Promise<void> => {
  const passwordHash = await bcrypt.hash("CasperAdmin@2024", 12);
  await UserModel.create({
    name: "CASPER Admin",
    email: "admin@casper.gov.in",
    passwordHash,
    role: "admin",
    organization: "CASPER",
    preferences: {
      alertThresholdPct: 20,
      watchedRegions: ["assam", "meghalaya", "arunachal", "manipur", "national"],
      notifyEmail: true,
      notifyPush: true,
      pushSubscription: null
    }
  });
};

const runSafe = async (name: string, fn: () => Promise<number>): Promise<number> => {
  try {
    const result = await fn();
    logger.info(`[RESET-SEED] scraper_ok name=${name} result=${result}`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    logger.warn(`[RESET-SEED] scraper_failed name=${name} reason=${message}`);
    return 0;
  }
};

type SeedTenderLineItem = {
  description: string;
  quantity: number;
  unit: string;
  quotedRateINR: number;
  marketRateINR: number;
  inflationPct: number;
  flagged: boolean;
  flagReason: string | null;
};

type SeedTender = {
  title: string;
  department: string;
  state: string;
  tenderNumber: string;
  totalEstimatedCostINR: number;
  projectType: "road" | "bridge" | "building" | "drainage" | "other";
  lengthKm: number | null;
  sourceURL: string;
  status: "flagged" | "clean";
  lineItems: SeedTenderLineItem[];
};

const SEED_TENDERS: SeedTender[] = [
  {
    title: "4-laning of NH-27 Guwahati–Numaligarh section km 0–45",
    department: "NHIDCL – National Highways & Infrastructure Dev Corp",
    state: "assam",
    tenderNumber: "NHIDCL/NER/NH27/2024/001",
    totalEstimatedCostINR: 214_00_00_000,
    projectType: "road",
    lengthKm: 45,
    sourceURL: "https://nhidcl.com/tender/nh27-guwahati-numaligarh",
    status: "flagged",
    lineItems: [
      {
        description: "Cement OPC 53 Grade supply and stacking",
        quantity: 45000,
        unit: "bag",
        quotedRateINR: 520,
        marketRateINR: 385,
        inflationPct: 35.1,
        flagged: true,
        flagReason: "35% above current GeM/CPWD rate for Assam"
      },
      {
        description: "TMT Steel Fe-500 12mm dia bars",
        quantity: 850,
        unit: "tonne",
        quotedRateINR: 108000,
        marketRateINR: 58500,
        inflationPct: 84.6,
        flagged: true,
        flagReason: "84% above current market rate — critical anomaly"
      },
      {
        description: "Bitumen VG-30 supply",
        quantity: 420,
        unit: "tonne",
        quotedRateINR: 68000,
        marketRateINR: 52000,
        inflationPct: 30.8,
        flagged: true,
        flagReason: "30.8% above current market rate"
      },
      {
        description: "Coarse aggregate 20mm graded",
        quantity: 12000,
        unit: "tonne",
        quotedRateINR: 1900,
        marketRateINR: 1850,
        inflationPct: 2.7,
        flagged: false,
        flagReason: null
      }
    ]
  },
  {
    title: "Rehabilitation of Brahmaputra river bridge NH-715B pkg-3",
    department: "PWD (Roads) Assam",
    state: "assam",
    tenderNumber: "PWD/BR/NH715B/2024/003",
    totalEstimatedCostINR: 89_00_00_000,
    projectType: "bridge",
    lengthKm: null,
    sourceURL: "https://pwdassam.gov.in/tenders/nh715b-pkg3",
    status: "flagged",
    lineItems: [
      {
        description: "Cement OPC 53 Grade for RCC works",
        quantity: 28000,
        unit: "bag",
        quotedRateINR: 535,
        marketRateINR: 385,
        inflationPct: 38.9,
        flagged: true,
        flagReason: "38.9% above CPWD Assam rate"
      },
      {
        description: "TMT Steel Fe-500 for structural works",
        quantity: 620,
        unit: "tonne",
        quotedRateINR: 71500,
        marketRateINR: 58500,
        inflationPct: 22.2,
        flagged: true,
        flagReason: "22.2% above current market rate"
      },
      {
        description: "Coarse sand for concrete works",
        quantity: 8500,
        unit: "cft",
        quotedRateINR: 48,
        marketRateINR: 45,
        inflationPct: 6.7,
        flagged: false,
        flagReason: null
      }
    ]
  },
  {
    title: "Upgradation of Jorhat district rural roads batch-2",
    department: "Rural Development Dept – Assam",
    state: "assam",
    tenderNumber: "RDD/ASSAM/JOR/2024/022",
    totalEstimatedCostINR: 12_40_00_000,
    projectType: "road",
    lengthKm: 18,
    sourceURL: "https://assam.gov.in/rdd/tenders/jorhat-batch2",
    status: "clean",
    lineItems: [
      {
        description: "Cement OPC 43 Grade",
        quantity: 8000,
        unit: "bag",
        quotedRateINR: 398,
        marketRateINR: 385,
        inflationPct: 3.4,
        flagged: false,
        flagReason: null
      },
      {
        description: "TMT Steel Fe-415",
        quantity: 120,
        unit: "tonne",
        quotedRateINR: 60500,
        marketRateINR: 58500,
        inflationPct: 3.4,
        flagged: false,
        flagReason: null
      },
      {
        description: "Bitumen VG-30",
        quantity: 85,
        unit: "tonne",
        quotedRateINR: 52500,
        marketRateINR: 52000,
        inflationPct: 1.0,
        flagged: false,
        flagReason: null
      }
    ]
  },
  {
    title: "Silchar urban drainage and sewerage improvement phase-1",
    department: "Urban Development Dept – Assam",
    state: "assam",
    tenderNumber: "UDD/ASSAM/SIL/2024/008",
    totalEstimatedCostINR: 38_00_00_000,
    projectType: "drainage",
    lengthKm: 12,
    sourceURL: "https://assam.gov.in/udd/tenders/silchar-drainage",
    status: "flagged",
    lineItems: [
      {
        description: "RCC Pipe NP-3 600mm dia",
        quantity: 8000,
        unit: "metre",
        quotedRateINR: 3950,
        marketRateINR: 2800,
        inflationPct: 41.1,
        flagged: true,
        flagReason: "41% above current market rate for NP-3 pipes"
      },
      {
        description: "Cement OPC 53 Grade",
        quantity: 18000,
        unit: "bag",
        quotedRateINR: 490,
        marketRateINR: 385,
        inflationPct: 27.3,
        flagged: true,
        flagReason: "27% above CPWD Assam published rate"
      }
    ]
  },
  {
    title: "Construction of Itanagar secretariat complex phase-2",
    department: "Arunachal Pradesh PWD",
    state: "arunachal",
    tenderNumber: "APPWD/ITNGR/SEC/2024/011",
    totalEstimatedCostINR: 156_00_00_000,
    projectType: "building",
    lengthKm: null,
    sourceURL: "https://arunachalpwd.gov.in/tenders/secretariat-ph2",
    status: "flagged",
    lineItems: [
      {
        description: "Cement OPC 53 Grade",
        quantity: 65000,
        unit: "bag",
        quotedRateINR: 610,
        marketRateINR: 425,
        inflationPct: 43.5,
        flagged: true,
        flagReason: "43.5% above CPWD Arunachal zone rate"
      },
      {
        description: "TMT Steel Fe-500 various dia",
        quantity: 1200,
        unit: "tonne",
        quotedRateINR: 89000,
        marketRateINR: 64400,
        inflationPct: 38.2,
        flagged: true,
        flagReason: "38% above regional market rate"
      },
      {
        description: "Modular bricks class designation A",
        quantity: 800,
        unit: "per_1000",
        quotedRateINR: 9800,
        marketRateINR: 7820,
        inflationPct: 25.3,
        flagged: true,
        flagReason: "25% above current IndiaMART rate for Arunachal"
      }
    ]
  },
  {
    title: "Shillong bypass road km 8 to 22 construction",
    department: "Meghalaya PWD National Highways",
    state: "meghalaya",
    tenderNumber: "MEPWD/NH/SBP/2024/005",
    totalEstimatedCostINR: 94_50_00_000,
    projectType: "road",
    lengthKm: 14,
    sourceURL: "https://megpwd.gov.in/tenders/shillong-bypass-km8-22",
    status: "clean",
    lineItems: [
      {
        description: "Cement OPC 53 Grade",
        quantity: 22000,
        unit: "bag",
        quotedRateINR: 418,
        marketRateINR: 410,
        inflationPct: 2.0,
        flagged: false,
        flagReason: null
      },
      {
        description: "Bitumen VG-30",
        quantity: 380,
        unit: "tonne",
        quotedRateINR: 56200,
        marketRateINR: 55000,
        inflationPct: 2.2,
        flagged: false,
        flagReason: null
      },
      {
        description: "Coarse aggregate 20mm",
        quantity: 9500,
        unit: "tonne",
        quotedRateINR: 2180,
        marketRateINR: 2100,
        inflationPct: 3.8,
        flagged: false,
        flagReason: null
      }
    ]
  },
  {
    title: "Guwahati Ring Road Bitumen Resurfacing — NH-17 Bypass",
    department: "PWD Assam",
    state: "assam",
    tenderNumber: "PWD/ASSAM/GUWBT/2024/031",
    totalEstimatedCostINR: 47_50_00_000,
    projectType: "road",
    lengthKm: 12,
    sourceURL: "https://pwdassam.gov.in/tenders/guwahati-ring-road-nh17",
    status: "flagged",
    lineItems: [
      {
        description: "Bitumen VG30 premium grade supply",
        quantity: 450,
        unit: "tonne",
        quotedRateINR: 220000,
        marketRateINR: 95000,
        inflationPct: 131.6,
        flagged: true,
        flagReason: "Bitumen quoted 131.6% above market — ₹2,20,000/t vs market ₹95,000/t"
      },
      {
        description: "Aggregate 20mm base course",
        quantity: 8500,
        unit: "tonne",
        quotedRateINR: 1920,
        marketRateINR: 1850,
        inflationPct: 3.8,
        flagged: false,
        flagReason: null
      }
    ]
  }
];

const calcAudit = (
  tenderId: mongoose.Types.ObjectId,
  lineItems: SeedTenderLineItem[]
): {
  tenderId: mongoose.Types.ObjectId;
  auditedAt: Date;
  overallInflationPct: number;
  totalOverpricedINR: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  flags: Array<{
    lineItemDescription: string;
    quotedRateINR: number;
    marketRateINR: number;
    inflationPct: number;
    confidence: number;
    explanation: string;
  }>;
  mlModelVersion: string;
  reportURL: null;
} => {
  const flaggedItems = lineItems.filter((li) => li.flagged);
  const overallInflationPct =
    flaggedItems.length > 0 ? flaggedItems.reduce((sum, li) => sum + li.inflationPct, 0) / flaggedItems.length : 0;
  const totalOverpricedINR = lineItems.reduce((sum, li) => {
    if (!li.flagged) return sum;
    return sum + (li.quotedRateINR - li.marketRateINR) * li.quantity;
  }, 0);
  const riskLevel =
    overallInflationPct >= 60 ? "critical" : overallInflationPct >= 30 ? "high" : overallInflationPct >= 10 ? "medium" : "low";

  return {
    tenderId,
    auditedAt: new Date(),
    overallInflationPct: Math.round(overallInflationPct * 10) / 10,
    totalOverpricedINR: Math.round(totalOverpricedINR),
    riskLevel,
    flags: flaggedItems.map((li) => ({
      lineItemDescription: li.description,
      quotedRateINR: li.quotedRateINR,
      marketRateINR: li.marketRateINR,
      inflationPct: Math.round(li.inflationPct * 10) / 10,
      confidence: li.inflationPct >= 60 ? 0.95 : li.inflationPct >= 40 ? 0.85 : li.inflationPct >= 25 ? 0.75 : 0.65,
      explanation:
        `${li.description} quoted at ₹${li.quotedRateINR}/${li.unit} vs current market rate ₹${li.marketRateINR}/${li.unit} — ` +
        `${li.inflationPct.toFixed(1)}% above market. ${li.flagReason ?? ""}`.trim()
    })),
    mlModelVersion: "rule_v1",
    reportURL: null
  };
};

const seedTendersAndAudits = async (): Promise<{ tenders: number; audits: number }> => {
  let tenderCount = 0;
  let auditCount = 0;

  for (const seed of SEED_TENDERS) {
    const tender = await TenderModel.create({
      title: seed.title,
      department: seed.department,
      state: seed.state,
      tenderNumber: seed.tenderNumber,
      totalEstimatedCostINR: seed.totalEstimatedCostINR,
      projectType: seed.projectType,
      lengthKm: seed.lengthKm,
      sourceURL: seed.sourceURL,
      uploadedBy: null,
      parsedAt: new Date(),
      rawText: `${seed.title} ${seed.department}`,
      lineItems: seed.lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unit: li.unit,
        quotedRateINR: li.quotedRateINR,
        marketRateINR: li.marketRateINR,
        inflationPct: li.inflationPct,
        flagged: li.flagged,
        flagReason: li.flagReason
      })),
      status: seed.status,
      sourcePortal: "manual",
      organisation: seed.department,
      publishedDate: null,
      closingDate: null,
      locationText: null,
      scrapedQuery: null,
      scrapedYear: null
    });
    tenderCount += 1;
    logger.info(`[RESET-SEED] seeded_tender title="${seed.title}" status=${seed.status}`);

    if (seed.status === "flagged") {
      const auditPayload = calcAudit(tender._id, seed.lineItems);
      await AuditModel.create(auditPayload);
      auditCount += 1;
    }
  }

  logger.info(`[RESET-SEED] seeded_tenders_done tenders=${tenderCount} audits=${auditCount}`);
  return { tenders: tenderCount, audits: auditCount };
};

const run = async (): Promise<void> => {
  await connectDB();

  logger.info("[RESET-SEED] drop_collections_start");
  await Promise.all([
    PriceModel.deleteMany({}),
    PriceHistoryModel.deleteMany({}),
    TenderModel.deleteMany({}),
    AuditModel.deleteMany({}),
    UserModel.deleteMany({}),
    AlertModel.deleteMany({}),
    BenchmarkModel.deleteMany({})
  ]);
  logger.info("[RESET-SEED] drop_collections_done");

  const seeded = await seedPricesAndHistory();
  logger.info(
    `[RESET-SEED] seeded_prices priceRecords=${seeded.priceRecords} historyDocs=${seeded.historyDocs} materials=${seeded.materials} regions=${seeded.regions}`
  );

  // ── SEED TENDERS + AUDITS ──────────────────────────────────
  await seedTendersAndAudits();

  await ensureAdminUser();
  logger.info("[RESET-SEED] admin_user_created email=admin@casper.gov.in");

  // Overlay real scraped prices on top of seeded data.
  await runSafe("gem", runGemScraper);
  await runSafe("indiamart", runIndiaMartScraper);
  await runSafe("tradeindia", runTradeIndiaScraper);

  // Benchmarks (World Bank) are optional for price charts, but helpful for the estimator confidence.
  await runSafe("worldbank", runWorldBankScraper);

  const [priceCount, priceHistoryCount, tenderCount, benchmarkCount] = await Promise.all([
    PriceModel.countDocuments({}),
    PriceHistoryModel.countDocuments({}),
    TenderModel.countDocuments({}),
    BenchmarkModel.countDocuments({})
  ]);

  logger.info(
    `[RESET-SEED] summary prices=${priceCount} priceHistoryDocs=${priceHistoryCount} tenders=${tenderCount} benchmarks=${benchmarkCount}`
  );

  await mongoose.disconnect();
};

run().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown_error";
  logger.error(`[RESET-SEED] failed reason=${message}`);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
