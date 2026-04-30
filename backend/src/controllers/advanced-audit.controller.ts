import fs from "node:fs/promises";
import path from "node:path";
import { Request, Response } from "express";
import { Types } from "mongoose";
import puppeteer from "puppeteer";
import { TenderModel } from "../models/Tender.model.js";
import { AuditModel } from "../models/Audit.model.js";
import { MarketReferenceModel } from "../models/MarketReference.model.js";
import { PriceHistoryModel } from "../models/PriceHistory.model.js";
import { AuditReportModel } from "../models/AuditReport.model.js";
import { FlagChallengeModel } from "../models/FlagChallenge.model.js";
import { isValidObjectId } from "../utils/objectId.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const REPORT_DIR = path.join(process.cwd(), "data", "audit-reports");

const escHtml = (v: string): string =>
  v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

async function ensureReportDir(): Promise<void> {
  await fs.mkdir(REPORT_DIR, { recursive: true });
}

// ─── Seed market references once if collection is empty ───────────────────────

const MARKET_SEED: Array<{
  itemName: string;
  itemCategory: string;
  unit: string;
  priceINR: number;
  stateCode: string | null;
  source: "WPI" | "CPWD" | "GeM" | "PWD";
  sourceDescription: string;
  notes: string | null;
}> = [
  { itemName: "cement", itemCategory: "building_materials", unit: "bag", priceINR: 370, stateCode: null, source: "CPWD", sourceDescription: "CPWD Delhi Schedule of Rates 2024", notes: "50kg bag, OPC 43/53 Grade" },
  { itemName: "cement", itemCategory: "building_materials", unit: "bag", priceINR: 348, stateCode: null, source: "GeM", sourceDescription: "Government e-Marketplace listed price (national avg, Q1 2025)", notes: null },
  { itemName: "cement", itemCategory: "building_materials", unit: "bag", priceINR: 355, stateCode: "AS", source: "PWD", sourceDescription: "Assam PWD Schedule of Rates 2024-25", notes: "Includes intra-state transport" },
  { itemName: "cement", itemCategory: "building_materials", unit: "bag", priceINR: 365, stateCode: "ML", source: "PWD", sourceDescription: "Meghalaya PWD Schedule of Rates 2024-25", notes: null },
  { itemName: "cement", itemCategory: "building_materials", unit: "bag", priceINR: 360, stateCode: "MN", source: "PWD", sourceDescription: "Manipur PWD Schedule of Rates 2024-25", notes: null },
  { itemName: "steel_rod", itemCategory: "metals", unit: "MT", priceINR: 56000, stateCode: null, source: "CPWD", sourceDescription: "CPWD Delhi Schedule of Rates 2024", notes: "Fe-500 TMT bars" },
  { itemName: "steel_rod", itemCategory: "metals", unit: "MT", priceINR: 54500, stateCode: null, source: "GeM", sourceDescription: "Government e-Marketplace listed price (national avg, Q1 2025)", notes: null },
  { itemName: "steel_rod", itemCategory: "metals", unit: "MT", priceINR: 57200, stateCode: null, source: "WPI", sourceDescription: "Ministry of Commerce WPI Index (manufactured products – iron & steel), Mar 2025", notes: "Base year 2011-12=100, index 175.4" },
  { itemName: "bitumen", itemCategory: "road_materials", unit: "MT", priceINR: 50000, stateCode: null, source: "CPWD", sourceDescription: "CPWD Schedule of Rates 2024", notes: "VG-30 grade bitumen" },
  { itemName: "bitumen", itemCategory: "road_materials", unit: "MT", priceINR: 48800, stateCode: null, source: "WPI", sourceDescription: "Ministry of Commerce WPI Index (mineral oils – bitumen), Mar 2025", notes: null },
  { itemName: "coarse_sand", itemCategory: "aggregates", unit: "cum", priceINR: 42, stateCode: null, source: "CPWD", sourceDescription: "CPWD Delhi Schedule of Rates 2024", notes: "River sand, zone II" },
  { itemName: "fine_sand", itemCategory: "aggregates", unit: "cum", priceINR: 35, stateCode: null, source: "CPWD", sourceDescription: "CPWD Delhi Schedule of Rates 2024", notes: null },
  { itemName: "aggregate_20mm", itemCategory: "aggregates", unit: "cum", priceINR: 1750, stateCode: null, source: "CPWD", sourceDescription: "CPWD Delhi Schedule of Rates 2024", notes: "Machine crushed stone aggregate, 20mm nominal size" },
  { itemName: "brick", itemCategory: "building_materials", unit: "nos", priceINR: 6800, stateCode: null, source: "CPWD", sourceDescription: "CPWD Delhi Schedule of Rates 2024", notes: "Per thousand first-class bricks" },
  { itemName: "rcc_pipe", itemCategory: "drainage", unit: "m", priceINR: 2650, stateCode: null, source: "CPWD", sourceDescription: "CPWD Delhi Schedule of Rates 2024", notes: "300mm dia NP3 class" }
];

async function seedMarketRefsIfEmpty(): Promise<void> {
  const count = await MarketReferenceModel.countDocuments();
  if (count > 0) return;
  const refDate = new Date("2025-01-01");
  const docs = MARKET_SEED.map((s) => ({
    ...s,
    state: s.stateCode ? null : null,
    sourceURL: null,
    referenceDate: refDate,
    validUntil: new Date("2026-03-31"),
  }));
  await MarketReferenceModel.insertMany(docs);
}

// ─── 1. Similar Tenders ───────────────────────────────────────────────────────

export const getSimilarTenders = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const tenderId = req.params.tenderId;
    if (!tenderId || !isValidObjectId(tenderId)) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid tender ID" }, 400);
    }
    const limit = Math.min(Number(req.query.limit) || 10, 20);

    const target = await TenderModel.findById(tenderId).lean();
    if (!target) {
      return sendError(res, { code: "NOT_FOUND", message: "Tender not found" }, 404);
    }

    const targetDate = target.publishedDate ?? target.parsedAt ?? new Date();
    const sixMonthsAgo = new Date(targetDate);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const twoYearsAgo = new Date(targetDate);
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const candidates = await TenderModel.find({
      _id: { $ne: new Types.ObjectId(tenderId) },
      status: { $in: ["flagged", "clean", "insufficient_data"] },
      projectType: target.projectType,
      parsedAt: { $gte: twoYearsAgo }
    })
      .limit(200)
      .lean();

    const targetCost = target.totalEstimatedCostINR ?? 0;

    const scored = candidates.map((c) => {
      let score = 35; // projectType already matched in query
      if (c.stateCode && target.stateCode && c.stateCode === target.stateCode) score += 25;
      else if (c.state?.toLowerCase() === target.state?.toLowerCase()) score += 15;
      if (c.districtCode && target.districtCode && c.districtCode === target.districtCode) score += 20;
      const cDate = c.publishedDate ?? c.parsedAt ?? new Date();
      const diffDays = Math.abs(cDate.getTime() - targetDate.getTime()) / 86_400_000;
      if (diffDays <= 180) score += 20;
      else if (diffDays <= 365) score += 10;
      const cCost = c.totalEstimatedCostINR ?? 0;
      if (targetCost > 0 && cCost > 0) {
        const ratio = Math.abs(cCost - targetCost) / targetCost;
        if (ratio <= 0.2) score += 15;
        else if (ratio <= 0.5) score += 8;
      }
      return { tender: c, rawScore: score };
    });

    const MAX_SCORE = 115;
    const filtered = scored
      .filter((s) => s.rawScore >= 40)
      .sort((a, b) => b.rawScore - a.rawScore)
      .slice(0, limit);

    // Attach audit data for each match
    const tenderIds = filtered.map((s) => s.tender._id);
    const audits = await AuditModel.find({ tenderId: { $in: tenderIds } }).lean();
    const auditMap = new Map(audits.map((a) => [a.tenderId.toString(), a]));

    const results = filtered.map(({ tender, rawScore }) => {
      const audit = auditMap.get(tender._id.toString());
      const similarityScore = Math.min(100, Math.round((rawScore / MAX_SCORE) * 100));
      const deviationVsTarget =
        targetCost > 0 && (tender.totalEstimatedCostINR ?? 0) > 0
          ? Math.round(((tender.totalEstimatedCostINR - targetCost) / targetCost) * 100)
          : null;
      return {
        _id: tender._id,
        tenderNumber: tender.tenderNumber,
        title: tender.title,
        state: tender.state,
        district: tender.district,
        vendorName: tender.vendorName,
        projectType: tender.projectType,
        publishedDate: tender.publishedDate ?? tender.parsedAt,
        totalEstimatedCostINR: tender.totalEstimatedCostINR,
        status: tender.status,
        similarityScore,
        deviationVsTarget,
        audit: audit
          ? {
              riskLevel: audit.riskLevel,
              overallInflationPct: audit.overallInflationPct,
              totalOverpricedINR: audit.totalOverpricedINR
            }
          : null
      };
    });

    // Build explanation card for top match
    let explanationCard: string | null = null;
    const top = results[0];
    if (top) {
      const direction = (top.deviationVsTarget ?? 0) > 0 ? "higher" : "lower";
      const pct = Math.abs(top.deviationVsTarget ?? 0);
      explanationCard = `This ${target.projectType} tender is ${pct}% ${direction} in estimated cost than the most comparable tender "${top.title}" in ${top.state} (${new Date(top.publishedDate as Date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}). Similarity score: ${top.similarityScore}%.`;
    }

    return sendSuccess(res, { results, explanationCard, targetTenderId: tenderId });
  } catch (err) {
    console.error("[getSimilarTenders]", err);
    return sendError(res, { code: "SIMILAR_TENDERS_FAILED", message: "Unable to find similar tenders" }, 500);
  }
};

// ─── 2. Item Drill-Down ───────────────────────────────────────────────────────

export const getItemDrillDown = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const tenderId = req.params.tenderId;
    const itemParam = typeof req.query.item === "string" ? req.query.item.trim() : "";
    if (!tenderId || !isValidObjectId(tenderId)) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid tender ID" }, 400);
    }
    if (!itemParam) {
      return sendError(res, { code: "ITEM_REQUIRED", message: "item query parameter is required" }, 400);
    }

    await seedMarketRefsIfEmpty();

    const tender = await TenderModel.findById(tenderId).lean();
    if (!tender) {
      return sendError(res, { code: "NOT_FOUND", message: "Tender not found" }, 404);
    }

    const lineItem = tender.lineItems?.find((li) =>
      li.description.toLowerCase().includes(itemParam.toLowerCase()) ||
      itemParam.toLowerCase().includes(li.description.toLowerCase())
    );

    if (!lineItem) {
      return sendError(res, { code: "ITEM_NOT_FOUND", message: "Item not found in this tender's line items" }, 404);
    }

    const audit = await AuditModel.findOne({ tenderId: new Types.ObjectId(tenderId) }).lean();
    const auditFlag = audit?.flags?.find((f) =>
      f.lineItemDescription.toLowerCase().includes(itemParam.toLowerCase())
    );

    // Market citations for this item in this state
    const itemKey = itemParam.toLowerCase().replace(/\s+/g, "_");
    const citations = await MarketReferenceModel.find({
      itemName: { $regex: new RegExp(itemKey.replace(/_/g, ".*"), "i") },
      $or: [{ stateCode: null }, { stateCode: tender.stateCode }]
    })
      .sort({ stateCode: -1 })
      .limit(6)
      .lean();

    // Price history for this item in this state
    const priceHistory = await PriceHistoryModel.findOne({
      material: { $regex: new RegExp(itemKey.replace(/_/g, ".*"), "i") },
      $or: [{ stateCode: tender.stateCode }, { region: tender.state?.toLowerCase() }]
    }).lean();

    const historyPoints = (priceHistory?.dataPoints ?? [])
      .slice(-24)
      .map((p) => ({ date: p.date, avgPriceINR: p.priceINR, source: p.source }));

    // Build comparable rates table from citations
    const comparableRates: Record<string, number | null> = {
      tenderQuoted: lineItem.quotedRateINR,
      wpiIndex: citations.find((c) => c.source === "WPI")?.priceINR ?? null,
      gemPrice: citations.find((c) => c.source === "GeM")?.priceINR ?? null,
      cpwdSOR: citations.find((c) => c.source === "CPWD")?.priceINR ?? null,
      statePwdRate: citations.find((c) => c.source === "PWD" && c.stateCode === tender.stateCode)?.priceINR ?? null,
      mlPredicted: lineItem.marketRateINR ?? null
    };

    // Inflation breakdown
    const baseMarketRate = lineItem.marketRateINR ?? auditFlag?.marketRateINR ?? citations[0]?.priceINR ?? null;
    const inflationBreakdown = baseMarketRate
      ? {
          quotedRate: lineItem.quotedRateINR,
          baseMarketRate,
          formula: "((quotedRate - marketRate) / marketRate) × 100",
          result: Math.round(((lineItem.quotedRateINR - baseMarketRate) / baseMarketRate) * 100 * 10) / 10,
          referenceSource: citations[0]?.sourceDescription ?? "CPWD Schedule of Rates 2024",
          referenceDate: citations[0]?.referenceDate?.toISOString().slice(0, 10) ?? "2024-01-01"
        }
      : null;

    // Contributing factors
    const factors: string[] = [];
    if (auditFlag) factors.push(auditFlag.explanation);
    if (lineItem.inflationPct && lineItem.inflationPct > 30) factors.push("Significant deviation from market benchmark (>30%)");
    if (lineItem.inflationPct && lineItem.inflationPct > 60) factors.push("Critically overpriced — likely vendor-specific markup");
    if (tender.stateCode === "MN" || tender.stateCode === "AR") factors.push("Remote NE India region — higher logistics cost may apply (typically +8–12%)");
    if (tender.procurementMethod === "nomination") factors.push("Nomination-based procurement — competitive pricing not guaranteed");
    if (factors.length === 0 && lineItem.flagged) factors.push("Price exceeds benchmark threshold for this item category");

    // Challenges on record for this item
    const challenges = await FlagChallengeModel.find({
      tenderId: new Types.ObjectId(tenderId),
      itemDescription: { $regex: new RegExp(itemParam, "i") }
    })
      .lean()
      .limit(5);

    return sendSuccess(res, {
      item: {
        description: lineItem.description,
        quantity: lineItem.quantity,
        unit: lineItem.unit,
        quotedRateINR: lineItem.quotedRateINR,
        marketRateINR: lineItem.marketRateINR,
        inflationPct: lineItem.inflationPct,
        flagged: lineItem.flagged,
        flagReason: lineItem.flagReason
      },
      marketCitations: citations.map((c) => ({
        source: c.source,
        sourceDescription: c.sourceDescription,
        priceINR: c.priceINR,
        unit: c.unit,
        stateCode: c.stateCode,
        referenceDate: c.referenceDate,
        sourceURL: c.sourceURL,
        notes: c.notes
      })),
      priceHistory: historyPoints,
      inflationBreakdown,
      comparableRates,
      contributingFactors: factors,
      challengesOnRecord: challenges.length,
      challenges: challenges.map((ch) => ({
        status: ch.status,
        rebuttal: ch.rebuttal,
        createdAt: ch.createdAt
      }))
    });
  } catch (err) {
    console.error("[getItemDrillDown]", err);
    return sendError(res, { code: "DRILL_DOWN_FAILED", message: "Unable to fetch item drill-down" }, 500);
  }
};

// ─── 3. Item Timeline ─────────────────────────────────────────────────────────

export const getItemTimeline = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const item = typeof req.query.item === "string" ? req.query.item.trim() : "";
    const state = typeof req.query.state === "string" ? req.query.state.trim() : null;
    const district = typeof req.query.district === "string" ? req.query.district.trim() : null;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    if (!item) {
      return sendError(res, { code: "ITEM_REQUIRED", message: "item query parameter is required" }, 400);
    }

    const query: Record<string, unknown> = {
      "lineItems.description": { $regex: new RegExp(item, "i") },
      status: { $in: ["flagged", "clean", "insufficient_data"] }
    };
    if (state) query.$or = [{ stateCode: state.toUpperCase() }, { state: { $regex: new RegExp(state, "i") } }];
    if (district) {
      const orConds = (query.$or as unknown[]) ?? [];
      query.$and = [
        { $or: orConds.length > 0 ? orConds : [{ _id: { $exists: true } }] },
        { $or: [{ districtCode: district.toUpperCase() }, { district: { $regex: new RegExp(district, "i") } }] }
      ];
      delete query.$or;
    }

    const tenders = await TenderModel.find(query)
      .sort({ publishedDate: 1 })
      .limit(limit)
      .lean();

    const tenderIds = tenders.map((t) => t._id);
    const audits = await AuditModel.find({ tenderId: { $in: tenderIds } }).lean();
    const auditMap = new Map(audits.map((a) => [a.tenderId.toString(), a]));

    const events = tenders.map((t) => {
      const matchedItem = t.lineItems?.find((li) =>
        li.description.toLowerCase().includes(item.toLowerCase())
      );
      const audit = auditMap.get(t._id.toString());
      const inflationPct = matchedItem?.inflationPct ?? null;
      const color =
        t.status === "flagged" || (inflationPct !== null && inflationPct > 30)
          ? "red"
          : inflationPct !== null && inflationPct > 10
          ? "yellow"
          : t.status === "clean"
          ? "green"
          : "grey";

      return {
        tenderId: t._id,
        tenderNumber: t.tenderNumber,
        title: t.title,
        state: t.state,
        district: t.district,
        vendorName: t.vendorName,
        date: t.publishedDate ?? t.parsedAt,
        status: t.status,
        item: matchedItem
          ? {
              description: matchedItem.description,
              quotedRateINR: matchedItem.quotedRateINR,
              marketRateINR: matchedItem.marketRateINR,
              inflationPct,
              flagged: matchedItem.flagged
            }
          : null,
        auditRiskLevel: audit?.riskLevel ?? null,
        color
      };
    });

    // Detect anomalies (price jumps >40% between consecutive entries)
    const anomalies: Array<{ from: number; to: number; jumpPct: number; note: string }> = [];
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1]?.item?.quotedRateINR;
      const curr = events[i]?.item?.quotedRateINR;
      if (prev && curr && prev > 0) {
        const jump = ((curr - prev) / prev) * 100;
        if (Math.abs(jump) > 40) {
          anomalies.push({
            from: i - 1,
            to: i,
            jumpPct: Math.round(jump),
            note: `Price ${jump > 0 ? "jumped" : "dropped"} ${Math.abs(Math.round(jump))}% between ${events[i - 1]?.tenderNumber} and ${events[i]?.tenderNumber}`
          });
        }
      }
    }

    return sendSuccess(res, { item, events, anomalies, total: events.length });
  } catch (err) {
    console.error("[getItemTimeline]", err);
    return sendError(res, { code: "TIMELINE_FAILED", message: "Unable to fetch item timeline" }, 500);
  }
};

// ─── 4. Vendor Timeline ───────────────────────────────────────────────────────

export const getVendorTimeline = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const vendorName = typeof req.query.vendor_name === "string" ? req.query.vendor_name.trim() : "";
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    if (!vendorName) {
      return sendError(res, { code: "VENDOR_REQUIRED", message: "vendor_name query parameter is required" }, 400);
    }

    const tenders = await TenderModel.find({
      vendorName: { $regex: new RegExp(vendorName, "i") }
    })
      .sort({ publishedDate: 1 })
      .limit(limit)
      .lean();

    if (tenders.length === 0) {
      return sendSuccess(res, { vendorName, events: [], total: 0, riskSummary: null });
    }

    const tenderIds = tenders.map((t) => t._id);
    const audits = await AuditModel.find({ tenderId: { $in: tenderIds } }).lean();
    const auditMap = new Map(audits.map((a) => [a.tenderId.toString(), a]));

    const events = tenders.map((t) => {
      const audit = auditMap.get(t._id.toString());
      return {
        tenderId: t._id,
        tenderNumber: t.tenderNumber,
        title: t.title,
        state: t.state,
        district: t.district,
        date: t.publishedDate ?? t.parsedAt,
        totalEstimatedCostINR: t.totalEstimatedCostINR,
        status: t.status,
        projectType: t.projectType,
        procurementMethod: t.procurementMethod,
        audit: audit
          ? {
              riskLevel: audit.riskLevel,
              overallInflationPct: audit.overallInflationPct,
              totalOverpricedINR: audit.totalOverpricedINR
            }
          : null
      };
    });

    const flaggedCount = events.filter((e) => e.status === "flagged").length;
    const statesActive = [...new Set(tenders.map((t) => t.state).filter(Boolean))];
    const avgInflation =
      events.reduce((s, e) => s + (e.audit?.overallInflationPct ?? 0), 0) / events.length;

    const riskSummary = {
      totalTenders: events.length,
      flaggedCount,
      flagRate: Math.round((flaggedCount / events.length) * 100),
      statesActive,
      avgInflationPct: Math.round(avgInflation * 10) / 10
    };

    return sendSuccess(res, { vendorName, events, total: events.length, riskSummary });
  } catch (err) {
    console.error("[getVendorTimeline]", err);
    return sendError(res, { code: "VENDOR_TIMELINE_FAILED", message: "Unable to fetch vendor timeline" }, 500);
  }
};

// ─── 5. Export Report ─────────────────────────────────────────────────────────

export const exportReport = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { reportType, referenceId, format = "pdf" } = req.body as {
      reportType?: string;
      referenceId?: string;
      format?: string;
    };
    const userId = req.auth?.userId;

    if (!userId) return sendError(res, { code: "UNAUTHORIZED", message: "Auth required" }, 401);
    if (!reportType || !["tender", "vendor", "item", "regional"].includes(reportType)) {
      return sendError(res, { code: "INVALID_TYPE", message: "reportType must be tender|vendor|item|regional" }, 400);
    }
    if (!referenceId) {
      return sendError(res, { code: "REFERENCE_REQUIRED", message: "referenceId is required" }, 400);
    }
    if (!["pdf", "csv"].includes(format)) {
      return sendError(res, { code: "INVALID_FORMAT", message: "format must be pdf|csv" }, 400);
    }

    await ensureReportDir();

    let htmlContent = "";
    let csvContent = "";
    let referenceName = referenceId;

    if (reportType === "tender") {
      if (!isValidObjectId(referenceId)) {
        return sendError(res, { code: "INVALID_ID", message: "Invalid tender ID" }, 400);
      }
      const tender = await TenderModel.findById(referenceId).lean();
      if (!tender) return sendError(res, { code: "NOT_FOUND", message: "Tender not found" }, 404);
      const audit = await AuditModel.findOne({ tenderId: new Types.ObjectId(referenceId) }).lean();
      referenceName = tender.tenderNumber;
      ({ htmlContent, csvContent } = buildTenderReport(tender, audit));

    } else if (reportType === "vendor") {
      const tenders = await TenderModel.find({ vendorName: { $regex: new RegExp(referenceId, "i") } }).lean();
      referenceName = tenders[0]?.vendorName ?? referenceId;
      const tenderIds = tenders.map((t) => t._id);
      const audits = await AuditModel.find({ tenderId: { $in: tenderIds } }).lean();
      const auditMap = new Map(audits.map((a) => [a.tenderId.toString(), a]));
      ({ htmlContent, csvContent } = buildVendorReport(referenceName, tenders, auditMap));

    } else if (reportType === "item") {
      const itemTenders = await TenderModel.find({
        "lineItems.description": { $regex: new RegExp(referenceId, "i") }
      }).lean();
      referenceName = referenceId;
      ({ htmlContent, csvContent } = buildItemReport(referenceId, itemTenders));

    } else {
      // regional
      const stateTenders = await TenderModel.find({
        $or: [{ stateCode: referenceId.toUpperCase() }, { state: { $regex: new RegExp(referenceId, "i") } }]
      }).lean();
      referenceName = stateTenders[0]?.state ?? referenceId;
      const stateIds = stateTenders.map((t) => t._id);
      const stateAudits = await AuditModel.find({ tenderId: { $in: stateIds } }).lean();
      const stateAuditMap = new Map(stateAudits.map((a) => [a.tenderId.toString(), a]));
      ({ htmlContent, csvContent } = buildRegionalReport(referenceName, stateTenders, stateAuditMap));
    }

    const timestamp = Date.now();
    const safeName = referenceName.replace(/[^a-zA-Z0-9-]/g, "_");
    const fileName = `CASPER_${reportType}_${safeName}_${timestamp}.${format}`;
    const filePath = path.join(REPORT_DIR, fileName);

    if (format === "pdf") {
      const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: "networkidle0" });
      const pdfBuf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" } });
      await browser.close();
      await fs.writeFile(filePath, pdfBuf);
    } else {
      await fs.writeFile(filePath, csvContent, "utf-8");
    }

    const report = await AuditReportModel.create({
      reportType,
      referenceId,
      referenceName,
      format,
      filePath,
      downloadURL: `/api/audits/reports/${timestamp}/download`,
      generatedBy: new Types.ObjectId(userId),
      metadata: { fileName, generatedAt: new Date().toISOString() }
    });

    // Update downloadURL to use actual DB id
    report.downloadURL = `/api/audits/reports/${report._id.toString()}/download`;
    await report.save();

    return sendSuccess(res, {
      reportId: report._id,
      reportType,
      referenceName,
      format,
      downloadURL: report.downloadURL,
      generatedAt: report.createdAt
    }, 201);
  } catch (err) {
    console.error("[exportReport]", err);
    return sendError(res, { code: "EXPORT_FAILED", message: "Unable to generate report" }, 500);
  }
};

// ─── 6. Download Report ───────────────────────────────────────────────────────

export const downloadReport = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const reportId = req.params.reportId;
    if (!reportId || !isValidObjectId(reportId)) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid report ID" }, 400);
    }
    const report = await AuditReportModel.findById(reportId).lean();
    if (!report || !report.filePath) {
      return sendError(res, { code: "NOT_FOUND", message: "Report not found" }, 404);
    }
    const userId = req.auth?.userId;
    if (report.generatedBy.toString() !== userId && req.auth?.role !== "admin") {
      return sendError(res, { code: "FORBIDDEN", message: "Access denied" }, 403);
    }
    try {
      await fs.access(report.filePath);
    } catch {
      return sendError(res, { code: "FILE_NOT_FOUND", message: "Report file no longer available" }, 404);
    }
    const ext = report.format === "pdf" ? "pdf" : "csv";
    const safeName = report.referenceName.replace(/[^a-zA-Z0-9-]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="CASPER_${report.reportType}_${safeName}.${ext}"`);
    res.setHeader("Content-Type", report.format === "pdf" ? "application/pdf" : "text/csv");
    const fileBuffer = await fs.readFile(report.filePath);
    return res.send(fileBuffer);
  } catch (err) {
    console.error("[downloadReport]", err);
    return sendError(res, { code: "DOWNLOAD_FAILED", message: "Unable to download report" }, 500);
  }
};

// ─── 7. Report History ────────────────────────────────────────────────────────

export const getReportHistory = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = req.auth?.userId;
    const isAdmin = req.auth?.role === "admin";
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const query = isAdmin ? {} : { generatedBy: new Types.ObjectId(userId) };
    const [reports, total] = await Promise.all([
      AuditReportModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditReportModel.countDocuments(query)
    ]);

    return sendSuccess(res, { reports, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[getReportHistory]", err);
    return sendError(res, { code: "REPORT_HISTORY_FAILED", message: "Unable to fetch report history" }, 500);
  }
};

// ─── 8. Challenge Flag ────────────────────────────────────────────────────────

export const challengeFlag = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const tenderId = req.params.tenderId;
    if (!tenderId || !isValidObjectId(tenderId)) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid tender ID" }, 400);
    }
    const userId = req.auth?.userId;
    if (!userId) return sendError(res, { code: "UNAUTHORIZED", message: "Auth required" }, 401);

    const { itemDescription, rebuttal, supportingDocumentURL } = req.body as {
      itemDescription?: string;
      rebuttal?: string;
      supportingDocumentURL?: string;
    };

    if (!itemDescription || typeof itemDescription !== "string" || itemDescription.trim().length < 5) {
      return sendError(res, { code: "ITEM_REQUIRED", message: "itemDescription is required (min 5 chars)" }, 400);
    }
    if (!rebuttal || typeof rebuttal !== "string" || rebuttal.trim().length < 20) {
      return sendError(res, { code: "REBUTTAL_REQUIRED", message: "rebuttal is required (min 20 chars)" }, 400);
    }

    const tender = await TenderModel.findById(tenderId).lean();
    if (!tender) return sendError(res, { code: "NOT_FOUND", message: "Tender not found" }, 404);

    const challenge = await FlagChallengeModel.create({
      tenderId: new Types.ObjectId(tenderId),
      itemDescription: itemDescription.trim(),
      challengedBy: new Types.ObjectId(userId),
      rebuttal: rebuttal.trim(),
      supportingDocumentURL: supportingDocumentURL ?? null,
      status: "pending"
    });

    return sendSuccess(res, { challengeId: challenge._id, status: challenge.status, message: "Challenge submitted for review" }, 201);
  } catch (err) {
    console.error("[challengeFlag]", err);
    return sendError(res, { code: "CHALLENGE_FAILED", message: "Unable to submit challenge" }, 500);
  }
};

// ─── Report HTML/CSV builders ─────────────────────────────────────────────────

const baseStyles = `
  body { font-family: Arial, sans-serif; color: #1f2937; padding: 24px; font-size: 13px; }
  h1 { color: #1e3a5f; margin: 0 0 4px; }
  h2 { color: #1e3a5f; font-size: 15px; margin: 18px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  h3 { font-size: 13px; margin: 12px 0 6px; }
  .header { margin-bottom: 18px; border-bottom: 3px solid #1e3a5f; padding-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { font-size: 22px; font-weight: 700; color: #1e3a5f; letter-spacing: 2px; }
  .brand-sub { font-size: 11px; color: #6b7280; }
  .meta { margin: 4px 0; color: #374151; }
  .card { margin: 12px 0; padding: 12px 14px; border: 1px solid #e5e7eb; border-radius: 6px; background: #f9fafb; }
  .risk-high { color: #b91c1c; font-weight: 600; }
  .risk-medium { color: #d97706; font-weight: 600; }
  .risk-low { color: #059669; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
  th { background: #1e3a5f; color: white; padding: 7px 8px; text-align: left; }
  td { border-bottom: 1px solid #e5e7eb; padding: 6px 8px; vertical-align: top; }
  tr:nth-child(even) td { background: #f3f4f6; }
  .flagged { color: #b91c1c; }
  .footer { margin-top: 24px; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  @page { margin: 15mm; }
`;

function buildTenderReport(
  tender: Record<string, unknown>,
  audit: Record<string, unknown> | null
): { htmlContent: string; csvContent: string } {
  const lineItems = (tender.lineItems as Array<Record<string, unknown>>) ?? [];
  const flags = (audit?.flags as Array<Record<string, unknown>>) ?? [];
  const riskClass = audit ? (["critical","high"].includes(audit.riskLevel as string) ? "risk-high" : audit.riskLevel === "medium" ? "risk-medium" : "risk-low") : "";

  const lineItemRows = lineItems
    .map((li) => `<tr>
      <td>${escHtml(String(li.description ?? ""))}</td>
      <td>${li.quantity}</td>
      <td>${escHtml(String(li.unit ?? ""))}</td>
      <td>₹${Number(li.quotedRateINR ?? 0).toLocaleString("en-IN")}</td>
      <td>${li.marketRateINR === null ? "—" : `₹${Number(li.marketRateINR).toLocaleString("en-IN")}`}</td>
      <td>${li.inflationPct === null ? "—" : `${Number(li.inflationPct).toFixed(1)}%`}</td>
      <td class="${li.flagged ? "flagged" : ""}">${li.flagged ? "⚑ Flagged" : "—"}</td>
    </tr>`)
    .join("");

  const flagRows = flags
    .map((f) => `<tr><td>${escHtml(String(f.lineItemDescription ?? ""))}</td><td>${Number(f.inflationPct ?? 0).toFixed(1)}%</td><td>${escHtml(String(f.explanation ?? ""))}</td></tr>`)
    .join("");

  const htmlContent = `<!doctype html><html><head><meta charset="utf-8"><title>CASPER Tender Audit Report</title><style>${baseStyles}</style></head><body>
    <div class="header">
      <div><div class="brand">CASPER</div><div class="brand-sub">AI-Powered Procurement Audit System</div></div>
      <div style="text-align:right;font-size:11px;color:#6b7280;">Tender Audit Report<br>${new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}</div>
    </div>
    <div class="card">
      <div style="font-size:16px;font-weight:700;">${escHtml(String(tender.title ?? ""))}</div>
      <div class="meta"><strong>Tender #:</strong> ${escHtml(String(tender.tenderNumber ?? ""))}</div>
      <div class="meta"><strong>Department:</strong> ${escHtml(String(tender.department ?? ""))}</div>
      <div class="meta"><strong>State:</strong> ${escHtml(String(tender.state ?? ""))}</div>
      ${tender.vendorName ? `<div class="meta"><strong>Vendor:</strong> ${escHtml(String(tender.vendorName))}</div>` : ""}
    </div>
    ${audit ? `<h2>Audit Summary</h2><div class="card">
      <div class="meta"><strong>Risk Level:</strong> <span class="${riskClass}">${String(audit.riskLevel ?? "").toUpperCase()}</span></div>
      <div class="meta"><strong>Overall Inflation:</strong> ${Number(audit.overallInflationPct ?? 0).toFixed(1)}%</div>
      <div class="meta"><strong>Estimated Overpricing:</strong> ₹${Number(audit.totalOverpricedINR ?? 0).toLocaleString("en-IN")}</div>
      ${audit.summary ? `<div class="meta" style="margin-top:8px;"><strong>AI Summary:</strong> ${escHtml(String(audit.summary))}</div>` : ""}
    </div>` : ""}
    <h2>Line Items (${lineItems.length})</h2>
    <table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Quoted ₹</th><th>Market ₹</th><th>Inflation</th><th>Status</th></tr></thead>
    <tbody>${lineItemRows || "<tr><td colspan='7'>No line items extracted.</td></tr>"}</tbody></table>
    ${flags.length > 0 ? `<h2>Audit Flags (${flags.length})</h2><table><thead><tr><th>Item</th><th>Inflation</th><th>Explanation</th></tr></thead><tbody>${flagRows}</tbody></table>` : ""}
    <div class="footer">Generated by CASPER — AI-Powered Procurement Audit System &nbsp;|&nbsp; ${new Date().toLocaleString("en-IN")} &nbsp;|&nbsp; Confidential</div>
  </body></html>`;

  const csvRows = [
    ["Description", "Quantity", "Unit", "Quoted Rate (INR)", "Market Rate (INR)", "Inflation %", "Flagged"],
    ...lineItems.map((li) => [
      String(li.description ?? ""),
      String(li.quantity ?? ""),
      String(li.unit ?? ""),
      String(li.quotedRateINR ?? ""),
      String(li.marketRateINR ?? ""),
      li.inflationPct !== null ? `${Number(li.inflationPct).toFixed(1)}%` : "",
      li.flagged ? "Yes" : "No"
    ])
  ];
  const csvContent = csvRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");

  return { htmlContent, csvContent };
}

function buildVendorReport(
  vendorName: string,
  tenders: Array<Record<string, unknown>>,
  auditMap: Map<string, Record<string, unknown>>
): { htmlContent: string; csvContent: string } {
  const flaggedCount = tenders.filter((t) => t.status === "flagged").length;
  const states = [...new Set(tenders.map((t) => String(t.state ?? "")).filter(Boolean))];
  const rows = tenders
    .map((t) => {
      const audit = auditMap.get(String(t._id));
      return `<tr>
        <td>${escHtml(String(t.tenderNumber ?? ""))}</td>
        <td>${escHtml(String(t.title ?? "").slice(0, 60))}</td>
        <td>${escHtml(String(t.state ?? ""))}</td>
        <td>${t.publishedDate ? new Date(t.publishedDate as string).toLocaleDateString("en-IN") : "—"}</td>
        <td>₹${Number(t.totalEstimatedCostINR ?? 0).toLocaleString("en-IN")}</td>
        <td>${String(t.status ?? "")}</td>
        <td>${audit ? `${Number(audit.overallInflationPct ?? 0).toFixed(1)}%` : "—"}</td>
      </tr>`;
    })
    .join("");

  const htmlContent = `<!doctype html><html><head><meta charset="utf-8"><title>CASPER Vendor Report</title><style>${baseStyles}</style></head><body>
    <div class="header"><div><div class="brand">CASPER</div><div class="brand-sub">Vendor Due Diligence Report</div></div>
    <div style="text-align:right;font-size:11px;color:#6b7280;">${new Date().toLocaleDateString("en-IN")}</div></div>
    <div class="card">
      <div style="font-size:16px;font-weight:700;">${escHtml(vendorName)}</div>
      <div class="meta"><strong>Total Tenders:</strong> ${tenders.length}</div>
      <div class="meta"><strong>Flagged:</strong> ${flaggedCount} (${Math.round((flaggedCount / Math.max(tenders.length, 1)) * 100)}%)</div>
      <div class="meta"><strong>States Active:</strong> ${states.join(", ") || "—"}</div>
    </div>
    <h2>Tender History</h2>
    <table><thead><tr><th>Tender #</th><th>Title</th><th>State</th><th>Date</th><th>Cost</th><th>Status</th><th>Inflation</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="footer">Generated by CASPER &nbsp;|&nbsp; ${new Date().toLocaleString("en-IN")}</div>
  </body></html>`;

  const csvContent = [
    ["Tender Number", "Title", "State", "Date", "Cost (INR)", "Status", "Inflation %"],
    ...tenders.map((t) => {
      const audit = auditMap.get(String(t._id));
      return [
        String(t.tenderNumber ?? ""),
        String(t.title ?? ""),
        String(t.state ?? ""),
        t.publishedDate ? new Date(t.publishedDate as string).toLocaleDateString("en-IN") : "",
        String(t.totalEstimatedCostINR ?? ""),
        String(t.status ?? ""),
        audit ? `${Number(audit.overallInflationPct ?? 0).toFixed(1)}%` : ""
      ];
    })
  ].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");

  return { htmlContent, csvContent };
}

function buildItemReport(
  itemName: string,
  tenders: Array<Record<string, unknown>>
): { htmlContent: string; csvContent: string } {
  const rows = tenders
    .map((t) => {
      const items = (t.lineItems as Array<Record<string, unknown>>) ?? [];
      const matched = items.find((li) =>
        String(li.description ?? "").toLowerCase().includes(itemName.toLowerCase())
      );
      return `<tr>
        <td>${escHtml(String(t.tenderNumber ?? ""))}</td>
        <td>${escHtml(String(t.state ?? ""))}</td>
        <td>${t.publishedDate ? new Date(t.publishedDate as string).toLocaleDateString("en-IN") : "—"}</td>
        <td>${matched ? `₹${Number(matched.quotedRateINR ?? 0).toLocaleString("en-IN")}` : "—"}</td>
        <td>${matched?.marketRateINR !== null && matched?.marketRateINR !== undefined ? `₹${Number(matched.marketRateINR).toLocaleString("en-IN")}` : "—"}</td>
        <td>${matched?.inflationPct !== null && matched?.inflationPct !== undefined ? `${Number(matched.inflationPct).toFixed(1)}%` : "—"}</td>
        <td>${matched?.flagged ? "⚑" : "—"}</td>
      </tr>`;
    })
    .join("");

  const htmlContent = `<!doctype html><html><head><meta charset="utf-8"><title>CASPER Item Price Report</title><style>${baseStyles}</style></head><body>
    <div class="header"><div><div class="brand">CASPER</div><div class="brand-sub">Item Price History Report</div></div>
    <div style="text-align:right;font-size:11px;color:#6b7280;">${new Date().toLocaleDateString("en-IN")}</div></div>
    <div class="card"><div style="font-size:16px;font-weight:700;">${escHtml(itemName)}</div>
    <div class="meta"><strong>Tenders containing this item:</strong> ${tenders.length}</div></div>
    <h2>Price History Across Tenders</h2>
    <table><thead><tr><th>Tender #</th><th>State</th><th>Date</th><th>Quoted ₹</th><th>Market ₹</th><th>Inflation</th><th>Flag</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="footer">Generated by CASPER &nbsp;|&nbsp; ${new Date().toLocaleString("en-IN")}</div>
  </body></html>`;

  const csvContent = [["Tender Number", "State", "Date", "Quoted Rate (INR)", "Market Rate (INR)", "Inflation %", "Flagged"],
    ...tenders.map((t) => {
      const items = (t.lineItems as Array<Record<string, unknown>>) ?? [];
      const matched = items.find((li) => String(li.description ?? "").toLowerCase().includes(itemName.toLowerCase()));
      return [
        String(t.tenderNumber ?? ""), String(t.state ?? ""),
        t.publishedDate ? new Date(t.publishedDate as string).toLocaleDateString("en-IN") : "",
        matched ? String(matched.quotedRateINR ?? "") : "",
        matched?.marketRateINR != null ? String(matched.marketRateINR) : "",
        matched?.inflationPct != null ? `${Number(matched.inflationPct).toFixed(1)}%` : "",
        matched?.flagged ? "Yes" : "No"
      ];
    })
  ].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");

  return { htmlContent, csvContent };
}

function buildRegionalReport(
  stateName: string,
  tenders: Array<Record<string, unknown>>,
  auditMap: Map<string, Record<string, unknown>>
): { htmlContent: string; csvContent: string } {
  const flagged = tenders.filter((t) => t.status === "flagged").length;
  const totalOverpriced = Array.from(auditMap.values()).reduce((s, a) => s + Number(a.totalOverpricedINR ?? 0), 0);
  const vendorCounts = new Map<string, number>();
  tenders.forEach((t) => {
    const v = String(t.vendorName ?? "").trim();
    if (v) vendorCounts.set(v, (vendorCounts.get(v) ?? 0) + 1);
  });
  const topVendors = [...vendorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const rows = tenders
    .map((t) => {
      const a = auditMap.get(String(t._id));
      return `<tr><td>${escHtml(String(t.tenderNumber ?? ""))}</td><td>${escHtml(String(t.district ?? "—"))}</td>
      <td>${t.publishedDate ? new Date(t.publishedDate as string).toLocaleDateString("en-IN") : "—"}</td>
      <td>₹${Number(t.totalEstimatedCostINR ?? 0).toLocaleString("en-IN")}</td>
      <td>${String(t.status ?? "")}</td>
      <td>${a ? `${Number(a.overallInflationPct ?? 0).toFixed(1)}%` : "—"}</td></tr>`;
    })
    .join("");

  const htmlContent = `<!doctype html><html><head><meta charset="utf-8"><title>CASPER Regional Report</title><style>${baseStyles}</style></head><body>
    <div class="header"><div><div class="brand">CASPER</div><div class="brand-sub">Regional Compliance Report</div></div>
    <div style="text-align:right;font-size:11px;color:#6b7280;">${new Date().toLocaleDateString("en-IN")}</div></div>
    <div class="card"><div style="font-size:16px;font-weight:700;">${escHtml(stateName)} — Procurement Compliance Overview</div>
      <div class="meta"><strong>Total Tenders:</strong> ${tenders.length}</div>
      <div class="meta"><strong>Flagged:</strong> ${flagged} (${Math.round((flagged / Math.max(tenders.length, 1)) * 100)}%)</div>
      <div class="meta"><strong>Estimated Total Overpricing:</strong> ₹${totalOverpriced.toLocaleString("en-IN")}</div>
    </div>
    <h2>Top Vendors by Tender Count</h2>
    <table><thead><tr><th>Vendor</th><th>Tenders</th></tr></thead>
    <tbody>${topVendors.map(([v, c]) => `<tr><td>${escHtml(v)}</td><td>${c}</td></tr>`).join("")}</tbody></table>
    <h2>All Tenders</h2>
    <table><thead><tr><th>Tender #</th><th>District</th><th>Date</th><th>Cost</th><th>Status</th><th>Inflation</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="footer">Generated by CASPER &nbsp;|&nbsp; ${new Date().toLocaleString("en-IN")}</div>
  </body></html>`;

  const csvContent = [["Tender Number", "District", "Date", "Cost (INR)", "Status", "Inflation %"],
    ...tenders.map((t) => {
      const a = auditMap.get(String(t._id));
      return [String(t.tenderNumber ?? ""), String(t.district ?? ""), t.publishedDate ? new Date(t.publishedDate as string).toLocaleDateString("en-IN") : "", String(t.totalEstimatedCostINR ?? ""), String(t.status ?? ""), a ? `${Number(a.overallInflationPct ?? 0).toFixed(1)}%` : ""];
    })
  ].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");

  return { htmlContent, csvContent };
}
