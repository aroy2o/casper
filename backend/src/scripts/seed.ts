import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { AlertModel } from "../models/Alert.model.js";
import { AuditModel } from "../models/Audit.model.js";
import { PriceHistoryModel } from "../models/PriceHistory.model.js";
import { PriceModel } from "../models/Price.model.js";
import { TenderModel } from "../models/Tender.model.js";
import { UserModel } from "../models/User.model.js";
import { runEprocureScraper } from "../services/scrapers/eprocure.scraper.js";
import { CPWD_2024_BASE_RATES, MATERIALS } from "../services/scrapers/shared.js";
import { INDIA_GEO } from "../data/india-districts.js";

type SeedPoint = { date: Date; priceINR: number; source: string };
type FraudSeedCase = {
  title: string;
  department: string;
  state: string;
  stateCode: string;
  district: string;
  districtCode: string;
  regionCode: string;
  tenderNumber: string;
  totalEstimatedCostINR: number;
  projectType: "road" | "bridge" | "building" | "drainage" | "other";
  sourceURL: string;
  detailURL: string;
  organisation: string;
  publishedDate: Date;
  closingDate: Date;
  locationText: string;
  contractYear: number;
  vendorName: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unit: string;
    quotedRateINR: number;
    marketRateINR: number;
    inflationPct: number;
    flagged: boolean;
    flagReason: string;
  }>;
  audit: {
    riskLevel: "medium" | "high" | "critical";
    overallInflationPct: number;
    totalOverpricedINR: number;
    riskSignals: string[];
    recommendation: string;
  };
};

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

const clearCollections = async (): Promise<void> => {
  await Promise.all([
    AlertModel.deleteMany({}),
    AuditModel.deleteMany({}),
    PriceModel.deleteMany({}),
    PriceHistoryModel.deleteMany({}),
    TenderModel.deleteMany({}),
    UserModel.deleteMany({ email: "admin@casper.gov.in" })
  ]);
};

type RegionEntry = { region: string; state: string | null; stateCode: string | null; multiplier: number };

const ALL_REGIONS: RegionEntry[] = [
  { region: "national", state: null, stateCode: null, multiplier: 1 },
  ...INDIA_GEO.map((s) => ({ region: s.code, state: s.name, stateCode: s.code, multiplier: s.regionMultiplier }))
];

const HIGH_PROFILE_FRAUD_CASES: FraudSeedCase[] = [
  {
    title: "Pune Flyover Tender (2022) - bid rigging pattern case",
    department: "Maharashtra Urban Infrastructure Development Department",
    state: "maharashtra",
    stateCode: "MH",
    district: "Pune",
    districtCode: "MH-PN",
    regionCode: "MH",
    tenderNumber: "MH-PUNE/2022-FLYOVER-017",
    totalEstimatedCostINR: 4380000000,
    projectType: "bridge",
    sourceURL: "https://www.hindustantimes.com/cities/pune-news/",
    detailURL: "https://www.hindustantimes.com/cities/pune-news/",
    organisation: "Pune Metropolitan Region Development Authority",
    publishedDate: new Date("2022-04-18T00:00:00.000Z"),
    closingDate: new Date("2022-06-03T00:00:00.000Z"),
    locationText: "Pune Ring Road Corridor",
    contractYear: 2022,
    vendorName: "Infra Consortium A (anonymised)",
    lineItems: [
      { description: "M40 grade ready-mix concrete", quantity: 16000, unit: "cum", quotedRateINR: 11650, marketRateINR: 8050, inflationPct: 44.72, flagged: true, flagReason: "Quoted rate materially above district market reference." },
      { description: "TMT reinforcement steel Fe500D", quantity: 5800, unit: "MT", quotedRateINR: 88400, marketRateINR: 64400, inflationPct: 37.27, flagged: true, flagReason: "Repeated premium beyond historical CPWD-adjusted range." },
      { description: "Bearing assembly and expansion joints", quantity: 120, unit: "nos", quotedRateINR: 1480000, marketRateINR: 1030000, inflationPct: 43.69, flagged: true, flagReason: "Single-source style pricing with no competitive spread." }
    ],
    audit: {
      riskLevel: "critical",
      overallInflationPct: 41.89,
      totalOverpricedINR: 794800000,
      riskSignals: ["concentrated high-value variation orders", "same bidder cluster across lots", "line items inflated above market references"],
      recommendation: "Escalate to vigilance review and freeze variation approvals pending independent quantity validation."
    }
  },
  {
    title: "Nagpur Smart Roads Package (2021) - cartel-linked tender",
    department: "Urban Development Department",
    state: "maharashtra",
    stateCode: "MH",
    district: "Nagpur",
    districtCode: "MH-NG",
    regionCode: "MH",
    tenderNumber: "MH-NAG/2021-SMARTROAD-044",
    totalEstimatedCostINR: 2190000000,
    projectType: "road",
    sourceURL: "https://timesofindia.indiatimes.com/city/nagpur",
    detailURL: "https://timesofindia.indiatimes.com/city/nagpur",
    organisation: "Nagpur Smart and Sustainable City Development Corporation",
    publishedDate: new Date("2021-07-09T00:00:00.000Z"),
    closingDate: new Date("2021-08-27T00:00:00.000Z"),
    locationText: "Inner Ring Road and Smart Junctions",
    contractYear: 2021,
    vendorName: "City Works Alliance B (anonymised)",
    lineItems: [
      { description: "Bituminous concrete wearing course", quantity: 92000, unit: "sqm", quotedRateINR: 1880, marketRateINR: 1290, inflationPct: 45.74, flagged: true, flagReason: "Asphalt package priced far above state schedule rates." },
      { description: "Precast kerb stones with laying", quantity: 68000, unit: "m", quotedRateINR: 1690, marketRateINR: 1180, inflationPct: 43.22, flagged: true, flagReason: "Unit rate inconsistent with nearby municipal contracts." },
      { description: "Road marking thermoplastic paint", quantity: 54000, unit: "sqm", quotedRateINR: 660, marketRateINR: 460, inflationPct: 43.48, flagged: true, flagReason: "Premium repeats across all bidder BOQs." }
    ],
    audit: {
      riskLevel: "critical",
      overallInflationPct: 44.15,
      totalOverpricedINR: 401500000,
      riskSignals: ["bid spread under 1 percent", "identical rounding patterns in competing bids", "non-competitive vendor rotation history"],
      recommendation: "Run antitrust screening and rebid with split packages plus independent cost benchmarking."
    }
  },
  {
    title: "Kolkata Drainage Rehabilitation Lot-3 (2020) - inflated civil BOQ",
    department: "Municipal Affairs Department",
    state: "west_bengal",
    stateCode: "WB",
    district: "Kolkata",
    districtCode: "WB-KO",
    regionCode: "WB",
    tenderNumber: "WB-KOL/2020-DRAIN-LOT3",
    totalEstimatedCostINR: 1260000000,
    projectType: "drainage",
    sourceURL: "https://www.telegraphindia.com/west-bengal/kolkata",
    detailURL: "https://www.telegraphindia.com/west-bengal/kolkata",
    organisation: "Kolkata Municipal Corporation",
    publishedDate: new Date("2020-09-21T00:00:00.000Z"),
    closingDate: new Date("2020-11-03T00:00:00.000Z"),
    locationText: "Canal East Road catchment",
    contractYear: 2020,
    vendorName: "Eastern Utilities Group C (anonymised)",
    lineItems: [
      { description: "RCC NP3 drain pipes 900 mm", quantity: 3800, unit: "m", quotedRateINR: 21200, marketRateINR: 15500, inflationPct: 36.77, flagged: true, flagReason: "Pipe rates exceed CPWD-equivalent band." },
      { description: "Excavation and trench preparation", quantity: 72000, unit: "cum", quotedRateINR: 940, marketRateINR: 690, inflationPct: 36.23, flagged: true, flagReason: "Labour and machinery loaded beyond norm." },
      { description: "Dewatering and pumping arrangements", quantity: 18, unit: "months", quotedRateINR: 7800000, marketRateINR: 5900000, inflationPct: 32.2, flagged: true, flagReason: "Prolonged duration assumptions not supported by design notes." }
    ],
    audit: {
      riskLevel: "high",
      overallInflationPct: 35.07,
      totalOverpricedINR: 221300000,
      riskSignals: ["inflated enabling works", "weak justification for timeline extension", "limited number of technically qualified bidders"],
      recommendation: "Audit quantity estimates and validate execution timeline before release of further milestone payments."
    }
  },
  {
    title: "Hyderabad Elevated Corridor Package-2 (2023) - manipulated estimates",
    department: "Roads and Buildings Department",
    state: "telangana",
    stateCode: "TS",
    district: "Hyderabad",
    districtCode: "TS-HY",
    regionCode: "TS",
    tenderNumber: "TS-HYD/2023-ECR-002",
    totalEstimatedCostINR: 6020000000,
    projectType: "bridge",
    sourceURL: "https://www.deccanchronicle.com/nation/current-affairs",
    detailURL: "https://www.deccanchronicle.com/nation/current-affairs",
    organisation: "Hyderabad Metropolitan Development Authority",
    publishedDate: new Date("2023-02-14T00:00:00.000Z"),
    closingDate: new Date("2023-04-01T00:00:00.000Z"),
    locationText: "Miyapur to Lakdikapul corridor",
    contractYear: 2023,
    vendorName: "Metro Link Constructors D (anonymised)",
    lineItems: [
      { description: "Pre-stressed concrete segment casting", quantity: 11200, unit: "cum", quotedRateINR: 18450, marketRateINR: 13300, inflationPct: 38.72, flagged: true, flagReason: "Segment fabrication quote incompatible with market contracts." },
      { description: "Structural steel girder fabrication", quantity: 4300, unit: "MT", quotedRateINR: 124500, marketRateINR: 90100, inflationPct: 38.18, flagged: true, flagReason: "Steel package includes unexplained processing uplift." },
      { description: "Traffic management and barricading", quantity: 24, unit: "months", quotedRateINR: 9200000, marketRateINR: 6650000, inflationPct: 38.35, flagged: true, flagReason: "Operational overhead assumptions materially overstated." }
    ],
    audit: {
      riskLevel: "critical",
      overallInflationPct: 38.42,
      totalOverpricedINR: 1054700000,
      riskSignals: ["estimate revisions just before bid opening", "single dominant consortium winning linked packages", "inflated steel and concrete line items"],
      recommendation: "Commission independent engineer review and halt package amendments until repricing is completed."
    }
  },
  {
    title: "Jaipur Civic Building Retrofit (2019) - procurement favoritism indicators",
    department: "Public Works Department",
    state: "rajasthan",
    stateCode: "RJ",
    district: "Jaipur",
    districtCode: "RJ-JP",
    regionCode: "RJ",
    tenderNumber: "RJ-JPR/2019-RETROFIT-011",
    totalEstimatedCostINR: 780000000,
    projectType: "building",
    sourceURL: "https://indianexpress.com/section/cities/jaipur/",
    detailURL: "https://indianexpress.com/section/cities/jaipur/",
    organisation: "Rajasthan PWD (Buildings)",
    publishedDate: new Date("2019-06-05T00:00:00.000Z"),
    closingDate: new Date("2019-07-12T00:00:00.000Z"),
    locationText: "Civil Lines administrative block cluster",
    contractYear: 2019,
    vendorName: "Heritage Infra Services E (anonymised)",
    lineItems: [
      { description: "Facade restoration stone cladding", quantity: 14800, unit: "sqm", quotedRateINR: 4980, marketRateINR: 3490, inflationPct: 42.69, flagged: true, flagReason: "Conservation works loaded without third-party valuation." },
      { description: "Fire safety retrofitting package", quantity: 9, unit: "blocks", quotedRateINR: 17300000, marketRateINR: 12600000, inflationPct: 37.3, flagged: true, flagReason: "Turnkey bundle pricing above comparable tenders." },
      { description: "HVAC replacement and BMS integration", quantity: 9, unit: "blocks", quotedRateINR: 22400000, marketRateINR: 16400000, inflationPct: 36.59, flagged: true, flagReason: "Bundled controls and equipment show persistent overpricing." }
    ],
    audit: {
      riskLevel: "high",
      overallInflationPct: 38.86,
      totalOverpricedINR: 173100000,
      riskSignals: ["short bid window", "single technically responsive bidder", "lump-sum bundling hides unit economics"],
      recommendation: "Re-tender specialist packages separately and mandate open BOQ disclosure for all bidders."
    }
  }
];

const seedPricesAndHistory = async (): Promise<void> => {
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
};

const seedHighProfileFraudCases = async (): Promise<number> => {
  const inserted: string[] = [];
  for (const fraudCase of HIGH_PROFILE_FRAUD_CASES) {
    const tender = await TenderModel.create({
      title: fraudCase.title,
      department: fraudCase.department,
      state: fraudCase.state,
      stateCode: fraudCase.stateCode,
      district: fraudCase.district,
      districtCode: fraudCase.districtCode,
      regionCode: fraudCase.regionCode,
      tenderNumber: fraudCase.tenderNumber,
      totalEstimatedCostINR: fraudCase.totalEstimatedCostINR,
      projectType: fraudCase.projectType,
      lengthKm: null,
      sourceURL: fraudCase.sourceURL,
      detailURL: fraudCase.detailURL,
      uploadedBy: null,
      filePath: null,
      parsedAt: new Date(),
      rawText: `${fraudCase.title}. Demo seed derived from anonymised high-profile tender corruption reporting.`,
      lineItems: fraudCase.lineItems.map((item) => ({
        ...item,
        totalCostINR: item.quantity * item.quotedRateINR
      })),
      status: "flagged",
      sourcePortal: "manual",
      organisation: fraudCase.organisation,
      publishedDate: fraudCase.publishedDate,
      closingDate: fraudCase.closingDate,
      locationText: fraudCase.locationText,
      scrapedQuery: "high-profile fraud demo seed",
      scrapedYear: fraudCase.contractYear,
      vendorName: fraudCase.vendorName,
      procurementMethod: "open",
      contractYear: fraudCase.contractYear,
      boqAvailable: true,
      boqDocumentURL: fraudCase.detailURL,
      itemizationStatus: "partial",
      dataCompletenessScore: 88,
      isArchived: false,
      archivedAt: null,
      archivedReason: null
    });

    await AuditModel.create({
      tenderId: tender._id,
      auditedAt: new Date(),
      overallInflationPct: fraudCase.audit.overallInflationPct,
      totalOverpricedINR: fraudCase.audit.totalOverpricedINR,
      riskLevel: fraudCase.audit.riskLevel,
      flags: fraudCase.lineItems.map((item) => ({
        lineItemDescription: item.description,
        quotedRateINR: item.quotedRateINR,
        marketRateINR: item.marketRateINR,
        inflationPct: item.inflationPct,
        confidence: 0.91,
        explanation: item.flagReason
      })),
      mlModelVersion: "seeded-real-case-v1",
      reportURL: null,
      claudeVerdict: "overpriced",
      summary: `Anonymised high-profile case with ${fraudCase.audit.overallInflationPct.toFixed(1)}% average inflation on benchmarked line items.`,
      riskSignals: fraudCase.audit.riskSignals,
      recommendation: fraudCase.audit.recommendation,
      imagekitUrl: null,
      plainEnglishSummary: `${fraudCase.title} shows repeated BOQ inflation and elevated collusion risk indicators.`,
      overallVerdict: "Likely manipulated tender pricing",
      explanationVersion: "seed-demo-2026-05"
    });
    inserted.push(fraudCase.tenderNumber);
  }

  console.log("Seeded high-profile fraud demo tenders", inserted);
  return inserted.length;
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

const run = async (): Promise<void> => {
  if (process.env.NODE_ENV !== "development") {
    console.log("Seed only runs in NODE_ENV=development. Exiting.");
    process.exit(0);
  }

  await connectDB();
  await clearCollections();
  await seedPricesAndHistory();

  // Real data only: scrape all-India portals; no synthetic tender generation.
  const scrapeResult = await runEprocureScraper({
    yearsBack: 3,
    portals: ["eprocure", "etenders", "worldbank"],
    scope: "all_india",
    maxRecords: 8000
  });
  const scandalSeeded = await seedHighProfileFraudCases();

  await ensureAdminUser();

  const counts = await Promise.all([
    PriceModel.countDocuments({}),
    PriceHistoryModel.countDocuments({}),
    TenderModel.countDocuments({}),
    AuditModel.countDocuments({}),
    UserModel.countDocuments({ email: "admin@casper.gov.in" })
  ]);

  console.log("Seed complete", {
    scrapeFound: scrapeResult.found,
    scrapeInserted: scrapeResult.inserted,
    scandalSeeded,
    prices: counts[0],
    priceHistory: counts[1],
    tenders: counts[2],
    audits: counts[3],
    adminUsers: counts[4]
  });

  await mongoose.disconnect();
};

run().catch(async (error: unknown) => {
  console.error("Seed failed", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
