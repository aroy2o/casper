import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { Types } from "mongoose";
import puppeteer from "puppeteer";
import pdfParse from "pdf-parse";
import { AuditModel } from "../models/Audit.model.js";
import { PriceModel } from "../models/Price.model.js";
import { TenderModel } from "../models/Tender.model.js";
import { mlClient, type FullAuditResult } from "../services/mlClient.service.js";
import { uploadToImageKit } from "../services/imagekit.service.js";
import { buildTenderCostBreakdown } from "../utils/costBreakdown.js";
import { newTenderQueue } from "../services/queue.service.js";
import { alertService } from "../services/alert.service.js";
import { isValidObjectId } from "../utils/objectId.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import { determineTenderStatus } from "../utils/tenderStatus.js";
import { logSecurityEvent } from "../services/auditLog.service.js";

type InputLineItem = {
  description: string;
  quantity: number;
  unit: string;
  quotedRateINR: number;
};

type TenderAuditFlag = {
  lineItemDescription: string;
  quotedRateINR: number;
  marketRateINR: number;
  inflationPct: number;
  confidence: number;
  explanation: string;
  humanSummary?: string | null;
  verdict?: string | null;
  topFactors?: Array<{ feature: string; impact: number; direction: string }>;
  riskContribution?: number | null;
};

type TenderAuditResult = {
  lineItems: Array<{
    description: string;
    quantity: number | null;
    unit: string;
    quotedRateINR: number | null;
    marketRateINR: number | null;
    inflationPct: number | null;
    flagged: boolean;
  }>;
  riskLevel: "low" | "medium" | "high" | "critical";
  overallInflationPct: number;
  totalOverpricedINR: number;
  flags: TenderAuditFlag[];
  modelVersion: string;
};

const deriveRiskLevel = (overallInflationPct: number): "low" | "medium" | "high" | "critical" => {
  if (overallInflationPct >= 60) return "critical";
  if (overallInflationPct >= 30) return "high";
  if (overallInflationPct >= 10) return "medium";
  return "low";
};

const deriveItemizationStatus = (lineItems: Array<{ quantity?: number; quotedRateINR?: number }>): "none" | "partial" | "detailed" => {
  if (!lineItems.length) return "none";
  const complete = lineItems.filter((i) => (i.quantity ?? 0) > 0 && (i.quotedRateINR ?? 0) > 0).length;
  if (complete >= 10) return "detailed";
  return "partial";
};

const computeDataCompletenessScore = (params: {
  lineItemsCount: number;
  hasLocation: boolean;
  hasContractYear: boolean;
  hasVendor: boolean;
  hasProcurement: boolean;
  hasBoqDocument: boolean;
}): number => {
  let score = 0;
  if (params.lineItemsCount >= 10) score += 40;
  else if (params.lineItemsCount >= 1) score += 20;
  if (params.hasLocation) score += 15;
  if (params.hasContractYear) score += 15;
  if (params.hasVendor) score += 10;
  if (params.hasProcurement) score += 10;
  if (params.hasBoqDocument) score += 10;
  return Math.min(100, score);
};

const noisyMarkers = [
  "function popup",
  "s.no e-published date",
  "tender list",
  "mis reports",
  "site compatibility",
  "designed, developed and hosted",
  "visitor no",
  "screen reader",
  "skip to main content",
  "last updated"
];

const hasNoisyContent = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const lowered = value.toLowerCase();
  return noisyMarkers.some((token) => lowered.includes(token));
};

const sanitizeText = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized || hasNoisyContent(normalized)) return null;
  return normalized;
};

const sanitizeTenderRecord = <T extends { title?: string; tenderNumber?: string; department?: string }>(record: T): T | null => {
  const title = sanitizeText(record.title);
  const tenderNumber = sanitizeText(record.tenderNumber);
  const department = sanitizeText(record.department);
  if (!title || !tenderNumber || !department) return null;
  if (title.length < 12 || title.length > 300 || tenderNumber.length < 6 || tenderNumber.length > 140 || department.length > 220)
    return null;
  if (title.split(/\s+/).filter(Boolean).length < 3) return null;
  const hasIdPattern =
    /\d{4}_[A-Z0-9]+_\d+_\d+/.test(tenderNumber) ||
    /^[A-Za-z0-9./-]{6,}\/[A-Za-z0-9./-]+$/.test(tenderNumber) ||
    /^[A-Za-z]{2,}[-/][A-Za-z0-9./-]{4,}$/.test(tenderNumber);
  if (!hasIdPattern) return null;
  return { ...record, title, tenderNumber, department };
};

const getTenderAndAudit = async (tenderId: string) => {
  const tender = await TenderModel.findById(tenderId).lean();
  if (!tender) {
    return null;
  }
  const audit = await AuditModel.findOne({ tenderId: tender._id }).lean();
  return { tender, audit: audit ?? null };
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const tenderCacheDir = path.join(process.cwd(), "data", "tender-cache");

const buildLocalTenderNumber = (): string => `TMP-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

const normalizeKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const extractPdfText = async (bufferOrPath: Buffer | string): Promise<string> => {
  try {
    const buffer = typeof bufferOrPath === "string" ? await fs.readFile(bufferOrPath) : bufferOrPath;
    const parsed = await pdfParse(buffer);
    return parsed.text ?? "";
  } catch (error) {
    console.warn("[uploadTender] PDF text extraction failed, using fallback text", error);
    return "";
  }
};

const preprocessText = (text: string): string =>
  text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^\s*\d+\s*$/gm, "")
    .trim()
    .slice(0, 5000);

const parseLineItemsFromText = (text: string): InputLineItem[] => {
  const lineItems: InputLineItem[] = [];
  const pattern = /(\d[\d,]*)\s*(bags?|MT|kg|ton|cum|sqm|nos?|units?)\s*[@at]+\s*[₹Rs.INR\s]*([\d,]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const quantity = Number.parseFloat((match[1] ?? "0").replace(/,/g, ""));
    const unit = match[2] ?? "nos";
    const quotedRateINR = Number.parseFloat((match[3] ?? "0").replace(/,/g, ""));
    if (quantity > 0 && quotedRateINR > 0) {
      lineItems.push({
        description: match[0].trim(),
        quantity,
        unit,
        quotedRateINR
      });
    }
  }
  return lineItems;
};

const chooseMarketPrice = (
  item: InputLineItem,
  prices: Array<{ material: string; marketRatePerUnit: number; unit: string }>
): { marketRateINR: number | null; confidence: number } => {
  const itemKey = normalizeKey(item.description);
  const unitKey = normalizeKey(item.unit);
  const directMatch = prices.find((price) => {
    const materialKey = normalizeKey(price.material);
    return materialKey.includes(itemKey) || itemKey.includes(materialKey) || normalizeKey(price.unit) === unitKey;
  });
  if (!directMatch) {
    return { marketRateINR: null, confidence: 0 };
  }
  return { marketRateINR: directMatch.marketRatePerUnit, confidence: 0.7 };
};

const buildFallbackAudit = (
  lineItems: InputLineItem[],
  prices: Array<{ material: string; marketRatePerUnit: number; unit: string }>
): TenderAuditResult => {
  const auditedLineItems = lineItems.map((item) => {
    const match = chooseMarketPrice(item, prices);
    const inflationPct =
      match.marketRateINR && match.marketRateINR > 0
        ? ((item.quotedRateINR - match.marketRateINR) / match.marketRateINR) * 100
        : null;
    const flagged = inflationPct !== null && inflationPct >= 10;
    return {
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      quotedRateINR: item.quotedRateINR,
      marketRateINR: match.marketRateINR,
      inflationPct,
      flagged
    };
  });

  const flags: TenderAuditFlag[] = auditedLineItems
    .filter((item) => item.flagged && item.marketRateINR !== null && item.inflationPct !== null)
    .map((item) => ({
      lineItemDescription: item.description,
      quotedRateINR: item.quotedRateINR ?? 0,
      marketRateINR: item.marketRateINR ?? 0,
      inflationPct: item.inflationPct ?? 0,
      confidence: 0.7,
      explanation: `Quoted ₹${item.quotedRateINR} vs market ₹${item.marketRateINR}`
    }));

  const overallInflationPct =
    flags.length > 0 ? flags.reduce((sum, flag) => sum + flag.inflationPct, 0) / flags.length : 0;
  const totalOverpricedINR = auditedLineItems.reduce((sum, item) => {
    if (item.marketRateINR === null) return sum;
    return sum + ((item.quotedRateINR ?? 0) - item.marketRateINR) * (item.quantity ?? 0);
  }, 0);

  return {
    lineItems: auditedLineItems,
    riskLevel: deriveRiskLevel(overallInflationPct),
    overallInflationPct,
    totalOverpricedINR,
    flags,
    modelVersion: "local-fallback-v1"
  };
};

const persistTenderFile = async (file: Express.Multer.File): Promise<string | null> => {
  try {
    await fs.mkdir(tenderCacheDir, { recursive: true });
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const cachedPath = path.join(tenderCacheDir, safeName);
    await fs.copyFile(file.path, cachedPath);
    return cachedPath;
  } catch (error) {
    console.warn("[uploadTender] Failed to cache uploaded file locally", error);
    return null;
  }
};

const buildAuditResult = async (
  params: { rawText: string; lineItems: InputLineItem[]; region: string },
  prices: Array<{ material: string; marketRatePerUnit: number; unit: string }>
): Promise<TenderAuditResult> => {
  try {
    if (params.lineItems.length > 0) {
      try {
        const audit = await mlClient.auditLineItems({ lineItems: params.lineItems, region: params.region });
        const lineItems = params.lineItems.map((item) => {
          const flag = audit.flags.find((entry) => entry.lineItemDescription === item.description);
          return {
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            quotedRateINR: item.quotedRateINR,
            marketRateINR: flag?.marketRateINR ?? null,
            inflationPct: flag?.inflationPct ?? null,
            flagged: Boolean(flag)
          };
        });
        const overallInflationPct =
          audit.flags.length > 0 ? audit.flags.reduce((sum, flag) => sum + flag.inflationPct, 0) / audit.flags.length : 0;
        const totalOverpricedINR = lineItems.reduce((sum, item) => {
          if (item.marketRateINR === null) return sum;
          return sum + ((item.quotedRateINR ?? 0) - item.marketRateINR) * (item.quantity ?? 0);
        }, 0);
        return {
          lineItems,
          riskLevel: deriveRiskLevel(overallInflationPct),
          overallInflationPct,
          totalOverpricedINR,
          flags: audit.flags,
          modelVersion: audit.modelVersion
        };
      } catch (error) {
        console.warn("[uploadTender] ML line-item audit failed, using fallback audit", error);
        return buildFallbackAudit(params.lineItems, prices);
      }
    }

    try {
      const audit = await mlClient.auditFromText(params.rawText, prices);
      const lineItems = audit.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        quotedRateINR: item.quotedRateINR,
        marketRateINR: item.marketRateINR,
        inflationPct: item.inflationPct,
        flagged: item.flagged
      }));
      const flags = lineItems
        .filter((item) => item.flagged && item.marketRateINR !== null && item.quotedRateINR !== null)
        .map((item) => ({
          lineItemDescription: item.description,
          quotedRateINR: item.quotedRateINR ?? 0,
          marketRateINR: item.marketRateINR ?? 0,
          inflationPct: item.inflationPct ?? 0,
          confidence: 0.6,
          explanation: `Quoted ₹${item.quotedRateINR} vs market ₹${item.marketRateINR}`
        }));
      return {
        lineItems,
        riskLevel: audit.riskLevel,
        overallInflationPct: audit.overallInflationPct,
        totalOverpricedINR: audit.totalOverpricedINR,
        flags,
        modelVersion: "ml-text-audit"
      };
    } catch (error) {
      console.warn("[uploadTender] ML text audit failed, using fallback audit", error);
      return buildFallbackAudit(parseLineItemsFromText(params.rawText), prices);
    }
  } catch (error) {
    console.warn("[uploadTender] Audit fallback failed, using empty audit result", error);
    return buildFallbackAudit([], prices);
  }
};

const buildTenderDocument = (
  req: Request,
  file: Express.Multer.File | undefined,
  rawText: string,
  cachedFilePath: string | null,
  enrichedLineItems: TenderAuditResult["lineItems"],
  tenderStatus: ReturnType<typeof determineTenderStatus>,
  itemizationStatus: "none" | "partial" | "detailed",
  costBreakdown: NonNullable<ReturnType<typeof buildTenderCostBreakdown>>,
  dataCompletenessScore: number
) => {
  return {
    title: req.body.title ?? file?.originalname ?? "Uploaded Tender",
    department: req.body.department ?? "Unknown",
    state: req.body.state ?? "national",
    tenderNumber: req.body.tenderNumber ?? buildLocalTenderNumber(),
    totalEstimatedCostINR: Number(req.body.totalEstimatedCostINR ?? 0),
    projectType: req.body.projectType ?? "other",
    lengthKm: req.body.lengthKm ? Number(req.body.lengthKm) : null,
    sourceURL: req.body.sourceURL ?? null,
    detailURL: req.body.detailURL ?? null,
    uploadedBy: req.auth?.userId ?? null,
    filePath: cachedFilePath,
    parsedAt: new Date(),
    rawText,
    lineItems: enrichedLineItems,
    status: tenderStatus,
    organisation: req.body.organisation ?? req.body.department ?? null,
    locationText: req.body.locationText ?? null,
    vendorName: req.body.vendorName ?? null,
    procurementMethod: req.body.procurementMethod ?? "other",
    contractYear: req.body.contractYear ?? null,
    boqAvailable: enrichedLineItems.length > 0,
    boqDocumentURL: req.body.boqDocumentURL ?? null,
    itemizationStatus,
    dataCompletenessScore,
    costBreakdown
  };
};

const mapFullAuditToTenderAudit = (full: FullAuditResult): TenderAuditResult => {
  const overpricedItems = full.flagged_items.filter((i) => i.flag === "overpriced");
  const overallInflationPct =
    overpricedItems.length > 0
      ? overpricedItems.reduce((sum, i) => sum + i.deviation_pct, 0) / overpricedItems.length
      : 0;
  const totalOverpricedINR = overpricedItems.reduce(
    (sum, i) => sum + Math.max(0, i.quoted_rate - i.market_rate),
    0
  );
  const confidenceScore = full.confidence === "high" ? 0.9 : full.confidence === "medium" ? 0.7 : 0.5;
  const riskLevel: TenderAuditResult["riskLevel"] =
    full.verdict === "overpriced"
      ? full.confidence === "high"
        ? "critical"
        : "high"
      : full.verdict === "underpriced"
        ? "medium"
        : "low";

  return {
    lineItems: full.flagged_items.map((item) => ({
      description: item.item,
      quantity: 1,
      unit: "nos",
      quotedRateINR: item.quoted_rate,
      marketRateINR: item.market_rate,
      inflationPct: item.deviation_pct,
      flagged: item.flag !== "ok"
    })),
    riskLevel,
    overallInflationPct,
    totalOverpricedINR,
    flags: full.flagged_items
      .filter((i) => i.flag !== "ok")
      .map((item) => ({
        lineItemDescription: item.item,
        quotedRateINR: item.quoted_rate,
        marketRateINR: item.market_rate,
        inflationPct: item.deviation_pct,
        confidence: confidenceScore,
        explanation: `${item.item}: quoted ₹${item.quoted_rate.toLocaleString("en-IN")} vs market ₹${item.market_rate.toLocaleString("en-IN")} (${item.deviation_pct > 0 ? "+" : ""}${item.deviation_pct.toFixed(1)}%)`,
        humanSummary: item.human_summary ?? null,
        verdict: item.verdict ?? null,
        topFactors: item.top_factors ?? [],
        riskContribution: item.risk_contribution ?? null
      })),
    modelVersion: "ollama-llama3.1"
  };
};

export const uploadTender = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const file = req.file;
    const manualLineItems = (req.body.lineItems as InputLineItem[] | undefined) ?? [];
    if (!file && manualLineItems.length === 0) {
      return sendError(res, { code: "FILE_OR_BOQ_REQUIRED", message: "Provide a PDF file or BOQ lineItems" }, 400);
    }

    const priceRows: Array<{ material: string; priceINR: number; unit: string }> = await PriceModel.find({ isActive: true })
      .lean()
      .catch((error) => {
        console.warn("[uploadTender] Failed to load active prices, continuing without market context", error);
        return [] as Array<{ material: string; priceINR: number; unit: string }>;
      });
    const activePrices = priceRows.map((price) => ({
      material: price.material,
      marketRatePerUnit: price.priceINR,
      unit: price.unit
    }));

    // Read file once, then fan out persist + ImageKit + PDF extraction in parallel
    let cachedFilePath: string | null = null;
    let imagekitUrl: string | null = null;
    let rawText = "";

    if (file) {
      const fileBuffer = await fs.readFile(file.path);
      const [persistResult, ikResult, pdfResult] = await Promise.allSettled([
        persistTenderFile(file),
        uploadToImageKit(fileBuffer, file.originalname),
        extractPdfText(fileBuffer),
      ]);
      cachedFilePath = persistResult.status === "fulfilled" ? persistResult.value : null;
      imagekitUrl = ikResult.status === "fulfilled" ? ikResult.value : null;
      rawText = pdfResult.status === "fulfilled" ? pdfResult.value : "";
      if (ikResult.status === "rejected") {
        console.warn("[uploadTender] ImageKit upload failed:", ikResult.reason instanceof Error ? ikResult.reason.message : ikResult.reason);
      }
    } else {
      rawText = `${req.body.title ?? "Uploaded Tender"} ${req.body.department ?? ""}`.trim();
    }
    const parsedLineItems = manualLineItems.length > 0 ? manualLineItems : file ? parseLineItemsFromText(rawText) : [];

    const cleanedText = preprocessText(rawText);

    // Ollama full-document audit (primary path — sends extracted text to llama3.1)
    let ollamaResult: FullAuditResult | null = null;
    if (cleanedText.length > 50) {
      try {
        ollamaResult = await mlClient.auditFullText({
          text: cleanedText,
          ...(req.body.title ? { title: req.body.title as string } : {}),
          ...(req.body.department ? { department: req.body.department as string } : {})
        });
        console.log("[uploadTender] Ollama audit verdict:", ollamaResult.verdict);
      } catch (err) {
        console.warn("[uploadTender] Ollama full audit failed, falling back to rule-based audit:", err instanceof Error ? err.message : err);
      }
    }

    // Build audit result: Ollama first, rule-based ML as fallback
    const auditResult = ollamaResult
      ? mapFullAuditToTenderAudit(ollamaResult)
      : await buildAuditResult(
          { rawText: cleanedText, lineItems: parsedLineItems, region: (req.body.state as string | undefined) ?? "national" },
          activePrices
        );

    const flagMap = new Map(auditResult.flags.map((flag) => [flag.lineItemDescription, flag]));
    const enrichedLineItems = auditResult.lineItems.map((item) => {
      const flag = flagMap.get(item.description);
      return {
        ...item,
        totalCostINR: (item.quantity ?? 0) * (item.quotedRateINR ?? 0),
        marketRateINR: item.marketRateINR ?? flag?.marketRateINR ?? null,
        inflationPct: item.inflationPct ?? flag?.inflationPct ?? null,
        flagged: Boolean(flag),
        flagReason: flag?.explanation ?? null
      };
    });

    const overallInflationPct = auditResult.overallInflationPct;
    const riskLevel = auditResult.riskLevel;
    const totalOverpricedINR = auditResult.totalOverpricedINR;

    // Ollama verdict sets status directly — avoids the "insufficient_data" polling trap
    const baseStatus = determineTenderStatus({
      totalEstimatedCostINR: Number(req.body.totalEstimatedCostINR ?? 0),
      lineItemCount: enrichedLineItems.length,
      riskLevel
    });
    const tenderStatus = ollamaResult
      ? ollamaResult.verdict === "overpriced"
        ? "flagged"
        : "clean"
      : baseStatus === "insufficient_data"
        ? "clean"
        : baseStatus;

    const itemizationStatus = deriveItemizationStatus(
      enrichedLineItems.map((item) => ({ quantity: item.quantity ?? 0, quotedRateINR: item.quotedRateINR ?? 0 }))
    );
    const costBreakdown = buildTenderCostBreakdown({
      totalEstimatedCostINR: Number(req.body.totalEstimatedCostINR ?? 0),
      projectType: (req.body.projectType as "road" | "bridge" | "railway" | "building" | "drainage" | "other") ?? "other",
      state: req.body.state ?? "national",
      lineItemCount: enrichedLineItems.length
    });
    const dataCompletenessScore = computeDataCompletenessScore({
      lineItemsCount: enrichedLineItems.length,
      hasLocation: Boolean(req.body.locationText),
      hasContractYear: Boolean(req.body.contractYear),
      hasVendor: Boolean(req.body.vendorName),
      hasProcurement: Boolean(req.body.procurementMethod),
      hasBoqDocument: Boolean(req.body.boqDocumentURL)
    });

    const tenderDocument = buildTenderDocument(
      req,
      file,
      rawText,
      imagekitUrl ?? cachedFilePath,
      enrichedLineItems,
      tenderStatus,
      itemizationStatus,
      costBreakdown,
      dataCompletenessScore
    );

    let tender;
    try {
      tender = await TenderModel.create(tenderDocument);
    } catch (error) {
      const isDuplicateTenderNumber = error instanceof Error && "message" in error && error.message.includes("E11000");
      if (!isDuplicateTenderNumber) {
        throw error;
      }
      tender = await TenderModel.create({ ...tenderDocument, tenderNumber: buildLocalTenderNumber() });
    }

    try {
      await AuditModel.create({
        tenderId: new Types.ObjectId(tender._id.toString()),
        auditedAt: new Date(),
        overallInflationPct,
        totalOverpricedINR,
        riskLevel,
        flags: auditResult.flags,
        mlModelVersion: auditResult.modelVersion,
        reportURL: null,
        claudeVerdict: ollamaResult?.verdict ?? null,
        summary: ollamaResult?.summary ?? null,
        riskSignals: ollamaResult?.risk_signals ?? [],
        recommendation: ollamaResult?.recommendation ?? null,
        imagekitUrl,
        plainEnglishSummary: ollamaResult?.plain_english_summary ?? null,
        overallVerdict: ollamaResult?.overall_verdict ?? null,
        explanationVersion: ollamaResult?.explanation_version ?? null
      });
      if ((riskLevel === "high" || riskLevel === "critical") && req.auth?.userId) {
        await alertService.createAlert({
          userId: req.auth.userId,
          type: "new_tender_flagged",
          message: `${tender.title} — ₹${(totalOverpricedINR / 1e7).toFixed(2)} Cr estimated overpricing`,
          tenderId: tender._id.toString()
        });
      }
    } catch (auditError) {
      console.error("[uploadTender] Failed to save audit document", auditError);
      tender.status = "error";
      await tender.save();
    }

    if (file) {
      await fs.unlink(file.path).catch(() => undefined);
    }
    void logSecurityEvent({ action: "tender_upload", req, resource: "tender", resourceId: tender._id.toString(), metadata: { tenderNumber: tender.tenderNumber, state: tender.state } });
    return sendSuccess(res, tender, 201);
  } catch (error) {
    console.error("[uploadTender] Unable to upload tender", error);
    return sendError(res, { code: "TENDER_UPLOAD_FAILED", message: "Unable to upload tender" }, 500);
  }
};

export const upsertTenderBoq = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const tenderId = req.params.id;
    if (!tenderId || !isValidObjectId(tenderId)) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid ID format" }, 400);
    }

    const tender = await TenderModel.findById(tenderId);
    if (!tender) {
      return sendError(res, { code: "NOT_FOUND", message: "Tender not found" }, 404);
    }

    const inputItems = (req.body.lineItems as InputLineItem[]).map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      quotedRateINR: item.quotedRateINR
    }));

    const auditResult = await mlClient.auditLineItems({
      lineItems: inputItems,
      region: (req.body.region as string | undefined) ?? tender.state
    });
    const flagMap = new Map(auditResult.flags.map((flag) => [flag.lineItemDescription, flag]));
    const enrichedLineItems = inputItems.map((item) => {
      const flag = flagMap.get(item.description);
      return {
        ...item,
        totalCostINR: item.quantity * item.quotedRateINR,
        marketRateINR: flag?.marketRateINR ?? null,
        inflationPct: flag?.inflationPct ?? null,
        flagged: Boolean(flag),
        flagReason: flag?.explanation ?? null
      };
    });

    const overallInflationPct =
      auditResult.flags.length > 0
        ? auditResult.flags.reduce((sum, flag) => sum + flag.inflationPct, 0) / auditResult.flags.length
        : 0;
    const totalOverpricedINR = enrichedLineItems.reduce((sum, item) => {
      if (item.marketRateINR === null) return sum;
      return sum + (item.quotedRateINR - item.marketRateINR) * item.quantity;
    }, 0);
    const riskLevel = deriveRiskLevel(overallInflationPct);
    const costBreakdown = buildTenderCostBreakdown({
      totalEstimatedCostINR: tender.totalEstimatedCostINR,
      projectType: tender.projectType,
      state: tender.state,
      lineItemCount: enrichedLineItems.length
    });

    tender.lineItems = enrichedLineItems;
    tender.status = determineTenderStatus({
      totalEstimatedCostINR: tender.totalEstimatedCostINR,
      lineItemCount: enrichedLineItems.length,
      riskLevel
    });
    tender.vendorName = (req.body.vendorName as string | undefined) ?? tender.vendorName;
    tender.procurementMethod =
      (req.body.procurementMethod as "open" | "limited" | "nomination" | "other" | undefined) ?? tender.procurementMethod;
    tender.contractYear = (req.body.contractYear as number | undefined) ?? tender.contractYear;
    tender.locationText = (req.body.locationText as string | undefined) ?? tender.locationText;
    tender.boqDocumentURL = (req.body.boqDocumentURL as string | undefined) ?? tender.boqDocumentURL;
    tender.boqAvailable = true;
    tender.itemizationStatus = deriveItemizationStatus(enrichedLineItems);
    tender.dataCompletenessScore = computeDataCompletenessScore({
      lineItemsCount: enrichedLineItems.length,
      hasLocation: Boolean(tender.locationText),
      hasContractYear: Boolean(tender.contractYear),
      hasVendor: Boolean(tender.vendorName),
      hasProcurement: Boolean(tender.procurementMethod && tender.procurementMethod !== "other"),
      hasBoqDocument: Boolean(tender.boqDocumentURL)
    });
    tender.costBreakdown = costBreakdown;
    await tender.save();

    await AuditModel.findOneAndUpdate(
      { tenderId: tender._id },
      {
        $set: {
          auditedAt: new Date(),
          overallInflationPct,
          totalOverpricedINR,
          riskLevel,
          flags: auditResult.flags,
          mlModelVersion: auditResult.modelVersion,
          reportURL: null
        }
      },
      { upsert: true, new: true }
    );

    return sendSuccess(res, {
      tenderId: tender._id,
      itemizationStatus: tender.itemizationStatus,
      dataCompletenessScore: tender.dataCompletenessScore,
      riskLevel,
      overallInflationPct,
      totalOverpricedINR,
      lineItemsCount: tender.lineItems.length
    });
  } catch {
    return sendError(res, { code: "BOQ_UPSERT_FAILED", message: "Unable to upsert BOQ and audit tender" }, 500);
  }
};

export const listTenders = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const state = req.query.state as string | undefined;
    const district = req.query.district as string | undefined;
    const status = req.query.status as string | undefined;
    const projectType = req.query.projectType as string | undefined;
    const procurementMethod = req.query.procurementMethod as string | undefined;
    const vendor = req.query.vendor as string | undefined;
    const riskLevel = req.query.riskLevel as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const costMin = req.query.costMin ? Number(req.query.costMin) : undefined;
    const costMax = req.query.costMax ? Number(req.query.costMax) : undefined;
    const search = req.query.search as string | undefined;
    const includeArchived = req.query.includeArchived === "true";
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    const query: Record<string, unknown> = {};

    if (!includeArchived) query.isArchived = { $ne: true };
    if (state) query.state = state;
    if (district) query.district = new RegExp(district, "i");
    if (status) {
      const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
      query.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }
    if (projectType) query.projectType = projectType;
    if (procurementMethod) query.procurementMethod = procurementMethod;
    if (vendor) query.vendorName = new RegExp(vendor, "i");
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.$gte = new Date(dateFrom);
      if (dateTo) dateFilter.$lte = new Date(dateTo);
      query.publishedDate = dateFilter;
    }
    if (costMin !== undefined || costMax !== undefined) {
      const costFilter: Record<string, number> = {};
      if (costMin !== undefined && Number.isFinite(costMin)) costFilter.$gte = costMin;
      if (costMax !== undefined && Number.isFinite(costMax)) costFilter.$lte = costMax;
      query.totalEstimatedCostINR = costFilter;
    }
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ title: re }, { tenderNumber: re }, { department: re }, { organisation: re }];
    }

    // riskLevel requires a join with audits; resolve audit IDs first
    if (riskLevel) {
      const { AuditModel } = await import("../models/Audit.model.js");
      const matchingAudits = await AuditModel.find({ riskLevel }).distinct("tenderId").lean();
      query._id = { $in: matchingAudits };
    }

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const skip = (safePage - 1) * safeLimit;

    const tenders = await TenderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean();

    // Return all tenders for listing (do not drop records here). Provide a
    // best-effort extraction of totalEstimatedCostINR when it's missing by
    // summing quoted line item values.
    const processed = tenders.map((t) => {
      const reported = Number((t as any).totalEstimatedCostINR ?? 0) || 0;
      let totalEstimated = reported;
      if (!totalEstimated || totalEstimated <= 0) {
        if (Array.isArray((t as any).lineItems) && (t as any).lineItems.length > 0) {
          totalEstimated = (t as any).lineItems.reduce((sum: number, item: any) => {
            const qty = Number(item.quantity ?? 1) || 1;
            const rate = Number(item.quotedRateINR ?? 0) || 0;
            return sum + qty * rate;
          }, 0);
        }
      }
      return {
        ...t,
        totalEstimatedCostINR: totalEstimated
      };
    });

    return sendSuccess(res, processed, 200);
  } catch {
    return sendError(res, { code: "TENDER_LIST_FAILED", message: "Unable to fetch tenders" }, 500);
  }
};

export const getTenderById = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const tenderId = req.params.id;
    if (!tenderId || !isValidObjectId(tenderId)) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid ID format" }, 400);
    }
    const result = await getTenderAndAudit(tenderId);
    if (!result) {
      return sendError(res, { code: "NOT_FOUND", message: "Tender not found" }, 404);
    }
    const { tender, audit } = result;

    // Do not reject tender details solely because they failed strict validation.
    // Sanitize text fields for safety, but fall back to original values when
    // sanitization strips content.
    const safeTitle = sanitizeText(tender.title) ?? tender.title ?? "Untitled";
    const safeTenderNumber = sanitizeText(tender.tenderNumber) ?? tender.tenderNumber ?? "N/A";
    const safeDepartment = sanitizeText(tender.department) ?? tender.department ?? "Unknown";

    const reported = Number((tender as any).totalEstimatedCostINR ?? 0) || 0;
    let totalEstimated = reported;
    if (!totalEstimated || totalEstimated <= 0) {
      if (Array.isArray((tender as any).lineItems) && (tender as any).lineItems.length > 0) {
        totalEstimated = (tender as any).lineItems.reduce((sum: number, item: any) => {
          const qty = Number(item.quantity ?? 1) || 1;
          const rate = Number(item.quotedRateINR ?? 0) || 0;
          return sum + qty * rate;
        }, 0);
      }
    }

    const safeTender = {
      ...tender,
      title: safeTitle,
      tenderNumber: safeTenderNumber,
      department: safeDepartment,
      totalEstimatedCostINR: totalEstimated
    } as any;

    return sendSuccess(res, { ...safeTender, audit });
  } catch {
    return sendError(res, { code: "TENDER_GET_FAILED", message: "Unable to fetch tender" }, 500);
  }
};

export const exportTenderPdf = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const tenderId = req.params.id;
    if (!tenderId || !isValidObjectId(tenderId)) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid ID format" }, 400);
    }

    const result = await getTenderAndAudit(tenderId);
    if (!result) {
      return sendError(res, { code: "NOT_FOUND", message: "Tender not found" }, 404);
    }

    const { tender, audit } = result;
    const lineItems = [...(tender.lineItems ?? [])].sort((a, b) => {
      const aFlag = a.flagged ? 1 : 0;
      const bFlag = b.flagged ? 1 : 0;
      if (aFlag !== bFlag) return bFlag - aFlag;
      return (b.inflationPct ?? 0) - (a.inflationPct ?? 0);
    });

    const lineItemRows =
      lineItems.length > 0
        ? lineItems
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.description)}</td>
                  <td>${item.quantity}</td>
                  <td>${escapeHtml(item.unit)}</td>
                  <td>₹${item.quotedRateINR.toLocaleString("en-IN")}</td>
                  <td>${item.marketRateINR === null ? "-" : `₹${item.marketRateINR.toLocaleString("en-IN")}`}</td>
                  <td>${item.inflationPct === null ? "-" : `${item.inflationPct.toFixed(1)}%`}</td>
                  <td>${item.flagged ? "⚑" : "-"}</td>
                </tr>
              `
            )
            .join("")
        : `<tr><td colspan="7">No line items extracted for this tender.</td></tr>`;

    const htmlString = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>CASPER Tender Report</title>
          <style>
            body { font-family: Arial, sans-serif; color: #1f2937; padding: 24px; }
            h1, h2 { margin: 0 0 8px; }
            .header { margin-bottom: 18px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
            .meta { margin: 6px 0; font-size: 14px; }
            .card { margin-top: 16px; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; }
            .footer { margin-top: 24px; font-size: 12px; color: #4b5563; border-top: 1px solid #d1d5db; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>CASPER</h1>
            <div class="meta">AI-Powered Procurement Audit Report</div>
          </div>

          <h2>${escapeHtml(tender.title)}</h2>
          <div class="meta"><strong>Tender #:</strong> ${escapeHtml(tender.tenderNumber)}</div>
          <div class="meta"><strong>Department:</strong> ${escapeHtml(tender.department)}</div>
          <div class="meta"><strong>State:</strong> ${escapeHtml(tender.state)}</div>

          <div class="card">
            <h2 style="font-size: 18px;">Audit Summary</h2>
            <div class="meta"><strong>Risk Level:</strong> ${audit?.riskLevel ?? "N/A"}</div>
            <div class="meta"><strong>Overall Inflation %:</strong> ${
              audit?.overallInflationPct !== undefined ? `${audit.overallInflationPct.toFixed(1)}%` : "N/A"
            }</div>
            <div class="meta"><strong>Total Overpriced INR:</strong> ${
              audit?.totalOverpricedINR !== undefined ? `₹${audit.totalOverpricedINR.toLocaleString("en-IN")}` : "N/A"
            }</div>
          </div>

          <div class="card">
            <h2 style="font-size: 18px;">Line Items</h2>
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Quoted ₹</th>
                  <th>Market ₹</th>
                  <th>Inflation %</th>
                  <th>Flag</th>
                </tr>
              </thead>
              <tbody>
                ${lineItemRows}
              </tbody>
            </table>
          </div>

          <div class="footer">
            Generated by CASPER — AI-Powered Procurement Audit System<br />
            ${new Date().toLocaleString("en-IN")}
          </div>
        </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.setContent(htmlString, { waitUntil: "networkidle0" });
    const pdfUint8 = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    const pdfBuffer = Buffer.from(pdfUint8);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("Content-Disposition", `attachment; filename="CASPER-${tender.tenderNumber}.pdf"`);
    return res.send(pdfBuffer);
  } catch {
    return sendError(res, { code: "TENDER_EXPORT_FAILED", message: "Unable to export tender PDF" }, 500);
  }
};

export const reauditTender = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const tenderId = req.params.id;
    if (!tenderId || !isValidObjectId(tenderId)) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid ID format" }, 400);
    }
    const tender = await TenderModel.findById(tenderId);
    if (!tender) {
      return sendError(res, { code: "NOT_FOUND", message: "Tender not found" }, 404);
    }
    if (tender.status === "flagged" || tender.status === "clean" || tender.status === "insufficient_data") {
      return sendSuccess(res, { success: true, message: "Already audited", status: tender.status });
    }
    tender.status = "pending";
    await tender.save();
    await newTenderQueue.add(
      "reaudit",
      { tenderId: tender._id.toString() },
      { attempts: 2, backoff: { type: "fixed", delay: 3000 } }
    );
    return sendSuccess(res, { success: true, message: "Reaudit queued", tenderId: tender._id });
  } catch {
    return sendError(res, { code: "REAUDIT_FAILED", message: "Unable to queue reaudit" }, 500);
  }
};

export const deleteTender = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const tenderId = req.params.id;
    if (!tenderId || !isValidObjectId(tenderId)) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid ID format" }, 400);
    }
    const deleted = await TenderModel.findByIdAndDelete(tenderId).lean();
    if (!deleted) {
      return sendError(res, { code: "NOT_FOUND", message: "Tender not found" }, 404);
    }
    void logSecurityEvent({ action: "tender_delete", req, resource: "tender", resourceId: tenderId, metadata: { tenderNumber: (deleted as any).tenderNumber } });
    return sendSuccess(res, { id: tenderId, deleted: true });
  } catch {
    return sendError(res, { code: "TENDER_DELETE_FAILED", message: "Unable to delete tender" }, 500);
  }
};

export const compareTenders = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const idsParam = req.query.ids as string | undefined;
    if (!idsParam) {
      return sendError(res, { code: "MISSING_IDS", message: "Provide comma-separated tender IDs via ?ids=" }, 400);
    }
    const ids = idsParam.split(",").map((id) => id.trim()).filter((id) => isValidObjectId(id));
    if (ids.length < 2) {
      return sendError(res, { code: "TOO_FEW_IDS", message: "At least 2 valid tender IDs are required" }, 400);
    }
    if (ids.length > 5) {
      return sendError(res, { code: "TOO_MANY_IDS", message: "Maximum 5 tenders can be compared at once" }, 400);
    }

    const { AuditModel } = await import("../models/Audit.model.js");
    const tenders = await TenderModel.find({ _id: { $in: ids } }).lean();
    const audits = await AuditModel.find({ tenderId: { $in: ids } }).lean();
    const auditMap = new Map(audits.map((a) => [String((a as any).tenderId), a]));

    const enriched = tenders.map((t) => {
      const audit = auditMap.get(String(t._id)) ?? null;
      return { ...t, audit };
    });

    // Compute highlights: fields where values differ significantly
    const highlights: Record<string, boolean> = {};
    const numFields = ["totalEstimatedCostINR", "dataCompletenessScore"] as const;
    for (const field of numFields) {
      const vals = enriched.map((t) => Number((t as any)[field] ?? 0)).filter((v) => v > 0);
      if (vals.length > 1) {
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        if (max > 0 && (max - min) / max > 0.1) highlights[field] = true;
      }
    }
    const strFields = ["state", "projectType", "procurementMethod", "status"] as const;
    for (const field of strFields) {
      const vals = new Set(enriched.map((t) => (t as any)[field]));
      if (vals.size > 1) highlights[field] = true;
    }

    return sendSuccess(res, { tenders: enriched, highlights });
  } catch {
    return sendError(res, { code: "COMPARE_FAILED", message: "Unable to compare tenders" }, 500);
  }
};
