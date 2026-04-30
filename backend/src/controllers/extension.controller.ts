import { execSync } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { Request, Response } from "express";
import { Types } from "mongoose";
import { ExtensionAuditModel } from "../models/ExtensionAudit.model.js";
import { mlClient } from "../services/mlClient.service.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";

const MAX_TEXT_LENGTH = 20_000;

function detectTenderNumber(text: string): string | null {
  const patterns = [
    /tender\s*(?:no\.?|number|ref\.?)\s*[:\-]?\s*([A-Z0-9\/\-]{5,30})/i,
    /NIT\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z0-9\/\-]{5,30})/i,
    /RFP\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z0-9\/\-]{5,30})/i,
    /EOI\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z0-9\/\-]{5,30})/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function detectDepartment(text: string): string | null {
  const patterns = [
    /(?:department|dept\.?|ministry|authority|board|corporation|council)\s*(?:of|:)?\s*([A-Za-z\s&,]{3,60})/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim().slice(0, 100);
  }
  return null;
}

function buildFallback(text: string): {
  riskLevel: "low" | "medium" | "high" | "critical";
  overallInflationPct: number;
  totalOverpricedINR: number;
  flags: never[];
  summary: string;
  recommendation: string;
  riskSignals: string[];
  claudeVerdict: null;
  mlModelVersion: string;
} {
  const hasPriceKeywords = /(?:overpriced|inflat|irregularit|suspect|corrupt|cartel)/i.test(text);
  const riskLevel = hasPriceKeywords ? "medium" : "low";
  return {
    riskLevel,
    overallInflationPct: 0,
    totalOverpricedINR: 0,
    flags: [],
    summary: "Automated analysis unavailable. Manual review recommended.",
    recommendation: "Cross-reference quoted rates with CPWD SOR and state PWD schedules.",
    riskSignals: hasPriceKeywords ? ["Price irregularity keywords detected in document"] : [],
    claudeVerdict: null,
    mlModelVersion: "fallback-v1"
  };
}

export const auditPage = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { sourceURL, pageTitle, extractedText, tenderNumber: providedTenderNumber, department: providedDepartment } =
      req.body as {
        sourceURL?: string;
        pageTitle?: string;
        extractedText?: string;
        tenderNumber?: string;
        department?: string;
      };

    if (!sourceURL || typeof sourceURL !== "string") {
      return sendError(res, { code: "INVALID_INPUT", message: "sourceURL is required" }, 400);
    }
    if (!extractedText || typeof extractedText !== "string" || extractedText.trim().length < 50) {
      return sendError(res, { code: "INVALID_INPUT", message: "extractedText must be at least 50 characters" }, 400);
    }

    const userId = req.auth!.userId;
    const truncatedText = extractedText.slice(0, MAX_TEXT_LENGTH);
    const title = (pageTitle && String(pageTitle).trim().length > 0 ? String(pageTitle).trim() : "Untitled Page").slice(0, 200);
    const tenderNumber = providedTenderNumber ?? detectTenderNumber(truncatedText);
    const department = providedDepartment ?? detectDepartment(truncatedText);

    let auditResult;
    try {
      const full = await mlClient.auditFullText({
        text: truncatedText,
        title,
        department: department ?? undefined
      });

      const riskLevel: "low" | "medium" | "high" | "critical" =
        full.verdict === "overpriced"
          ? full.confidence === "high"
            ? "critical"
            : "high"
          : full.verdict === "neutral"
            ? "low"
            : "low";

      const confidence = full.confidence === "high" ? 0.9 : full.confidence === "medium" ? 0.65 : 0.4;
      // Guard against null/undefined numeric fields in ML response — Mongoose requires them
      const overpricedItems = (full.flagged_items ?? []).filter(
        (i) => i.flag === "overpriced" && i.quoted_rate != null && i.market_rate != null && i.deviation_pct != null
      );
      auditResult = {
        riskLevel,
        overallInflationPct: overpricedItems.length
          ? Math.round(overpricedItems.reduce((s, i) => s + (i.deviation_pct ?? 0), 0) / overpricedItems.length)
          : 0,
        totalOverpricedINR: 0,
        flags: overpricedItems.map((i) => ({
          lineItemDescription: String(i.item ?? "Unknown item").slice(0, 200),
          quotedRateINR: Number(i.quoted_rate),
          marketRateINR: Number(i.market_rate),
          inflationPct: Math.round(Number(i.deviation_pct)),
          confidence,
          explanation: `Quoted ${i.quoted_rate} vs market ${i.market_rate} (${Math.round(Number(i.deviation_pct))}% deviation)`
        })),
        summary: full.summary ?? null,
        recommendation: full.recommendation ?? null,
        riskSignals: full.risk_signals ?? [],
        claudeVerdict: full.verdict ?? null,
        mlModelVersion: "ollama-full-v1"
      };
    } catch (err) {
      console.error("[extension/auditPage] ML client error:", err);
      auditResult = buildFallback(truncatedText);
    }

    const record = await ExtensionAuditModel.create({
      sourceURL,
      pageTitle: title,
      extractedText: truncatedText,
      tenderNumber,
      department,
      triggeredBy: new Types.ObjectId(userId),
      ...auditResult
    });

    return sendSuccess(
      res,
      {
        auditId: record._id.toString(),
        riskLevel: record.riskLevel,
        overallInflationPct: record.overallInflationPct,
        totalOverpricedINR: record.totalOverpricedINR,
        flags: record.flags,
        summary: record.summary,
        recommendation: record.recommendation,
        riskSignals: record.riskSignals,
        claudeVerdict: record.claudeVerdict,
        tenderNumber: record.tenderNumber,
        department: record.department,
        auditedAt: record.createdAt
      },
      201
    );
  } catch (err) {
    console.error("[extension/auditPage] Unhandled error:", err);
    return sendError(res, { code: "EXTENSION_AUDIT_FAILED", message: "Unable to audit page" }, 500);
  }
};

export const getExtensionAudits = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = req.auth!.userId;
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
    const riskLevel = req.query.riskLevel as string | undefined;

    const filter: Record<string, unknown> = { triggeredBy: new Types.ObjectId(userId) };
    if (riskLevel && ["low", "medium", "high", "critical"].includes(riskLevel)) {
      filter.riskLevel = riskLevel;
    }

    const [total, records] = await Promise.all([
      ExtensionAuditModel.countDocuments(filter),
      ExtensionAuditModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-extractedText")
        .lean()
    ]);

    return sendSuccess(res, {
      audits: records,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch {
    return sendError(res, { code: "EXTENSION_AUDITS_FETCH_FAILED", message: "Unable to fetch extension audits" }, 500);
  }
};

export const getExtensionAuditById = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = req.auth!.userId;
    const { auditId } = req.params;

    if (!auditId || !Types.ObjectId.isValid(auditId)) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid audit ID" }, 400);
    }

    const record = await ExtensionAuditModel.findOne({
      _id: new Types.ObjectId(auditId),
      triggeredBy: new Types.ObjectId(userId)
    }).lean();

    if (!record) {
      return sendError(res, { code: "NOT_FOUND", message: "Audit not found" }, 404);
    }

    return sendSuccess(res, record);
  } catch {
    return sendError(res, { code: "EXTENSION_AUDIT_FETCH_FAILED", message: "Unable to fetch audit" }, 500);
  }
};

// ─── PDF audit helpers ────────────────────────────────────────────────────────

const PDF_TENDER_KEYWORDS = [
  "tender", "nit ", "rfp", "eoi", "boq", "procurement", "bid ", "bidding",
  "works contract", "rate contract", "supply order", "work order", "eprocure",
  "e-tender", "quotation", "notice inviting", "request for proposal"
];

function textLooksLikeTender(text: string): boolean {
  const lower = text.toLowerCase();
  return PDF_TENDER_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractPdfTextViaCli(filePath: string): string {
  try {
    const raw = execSync(`pdftotext "${filePath}" -`, { timeout: 20_000 });
    return raw.toString("utf8").slice(0, MAX_TEXT_LENGTH);
  } catch {
    return "";
  }
}

function classifyDocument(text: string, title: string, url: string): string {
  const combined = (text + " " + title + " " + url).toLowerCase();
  if (/annual.?report|annual.?statement/.test(combined)) return "Annual Report";
  if (/invoice|bill of/i.test(combined)) return "Invoice / Bill";
  if (/policy|circular|guidelines|office.?memo|om\b/.test(combined)) return "Policy / Circular";
  if (/agenda|minutes.?of.?meet/.test(combined)) return "Meeting Minutes";
  if (/inspection.?report|audit.?report/.test(combined)) return "Audit / Inspection Report";
  if (/drawing|blueprint|design.?plan/.test(combined)) return "Technical Drawing / Design";
  if (/agreement|mou|memorandum.?of.?understanding/.test(combined)) return "Agreement / MoU";
  return "General Document";
}

// ─── auditPdfUrl controller ───────────────────────────────────────────────────

export const auditPdfUrl = async (req: Request, res: Response): Promise<Response | void> => {
  const tempPath = req.file?.path ?? null;

  try {
    const { sourceURL, pageTitle } = req.body as { sourceURL?: string; pageTitle?: string };

    if (!req.file) {
      return sendError(res, { code: "INVALID_INPUT", message: "PDF file is required" }, 400);
    }
    if (!sourceURL || typeof sourceURL !== "string") {
      return sendError(res, { code: "INVALID_INPUT", message: "sourceURL is required" }, 400);
    }

    const userId = req.auth!.userId;
    const title = (pageTitle && String(pageTitle).trim().length > 0
      ? String(pageTitle).trim()
      : req.file?.originalname && String(req.file.originalname).trim().length > 0
        ? String(req.file.originalname).trim()
        : "Untitled PDF").slice(0, 200);

    // ── Step 1: extract raw text via pdftotext ─────────────────────────────
    const rawText = extractPdfTextViaCli(tempPath!);

    // ── Step 2: decide if this is a tender ────────────────────────────────
    const urlAndTitle = sourceURL + " " + title;
    const isTenderByKeyword = textLooksLikeTender(rawText) || textLooksLikeTender(urlAndTitle);

    if (!isTenderByKeyword) {
      const docType = classifyDocument(rawText, title, sourceURL);
      const snippet = rawText.slice(0, 300).replace(/\s+/g, " ").trim();
      const about = snippet
        ? `This appears to be a ${docType}. Excerpt: "${snippet}…"`
        : `This appears to be a ${docType}, not a government tender document.`;

      return sendSuccess(res, { isTender: false, documentType: docType, about, pageTitle: title, sourceURL });
    }

    // ── Step 3: parse BOQ line items via ML service ───────────────────────
    let auditResult;
    try {
      const lineItems = await mlClient.parsePdf(tempPath!);

      if (lineItems.length > 0) {
        // BOQ found — run item-level audit
        const { flags, modelVersion } = await mlClient.auditLineItems({ lineItems, region: "india" });
        const overallInflationPct = flags.length
          ? Math.round(flags.reduce((s, f) => s + f.inflationPct, 0) / flags.length)
          : 0;
        const riskLevel =
          overallInflationPct > 60 ? "critical"
          : overallInflationPct > 30 ? "high"
          : overallInflationPct > 10 ? "medium"
          : "low";

        auditResult = {
          isTender: true,
          riskLevel,
          overallInflationPct,
          totalOverpricedINR: flags.reduce((s, f) => s + Math.max(0, (f.quotedRateINR - f.marketRateINR)), 0),
          flags,
          summary: `BOQ analysis of ${lineItems.length} line items. ${flags.length} flagged.`,
          recommendation: flags.length > 0
            ? "Cross-reference flagged items with CPWD SOR and state PWD schedules."
            : "No significant price anomalies detected in BOQ.",
          riskSignals: flags.filter((f) => f.inflationPct > 30).map((f) => `${f.lineItemDescription}: +${Math.round(f.inflationPct)}% above market`),
          claudeVerdict: flags.length > 0 ? "overpriced" : "neutral",
          mlModelVersion: modelVersion
        };
      } else {
        // No BOQ — fall back to full-text ML audit on extracted text
        throw new Error("no_items");
      }
    } catch {
      // Full-text audit on the raw PDF text
      const textForAudit = rawText.length > 100 ? rawText : urlAndTitle;
      try {
        const full = await mlClient.auditFullText({ text: textForAudit, title, department: undefined });
        const confidence = full.confidence === "high" ? 0.9 : 0.6;
        const overpricedItems = (full.flagged_items ?? []).filter(
          (i) => i.flag === "overpriced" && i.quoted_rate != null && i.market_rate != null && i.deviation_pct != null
        );
        const overallInflationPct = overpricedItems.length
          ? Math.round(overpricedItems.reduce((s, i) => s + (i.deviation_pct ?? 0), 0) / overpricedItems.length)
          : 0;
        const riskLevel =
          full.verdict === "overpriced"
            ? full.confidence === "high" ? "critical" : "high"
            : "low";

        auditResult = {
          isTender: true,
          riskLevel,
          overallInflationPct,
          totalOverpricedINR: 0,
          flags: overpricedItems.map((i) => ({
            lineItemDescription: String(i.item ?? "Unknown item").slice(0, 200),
            quotedRateINR: Number(i.quoted_rate),
            marketRateINR: Number(i.market_rate),
            inflationPct: Math.round(Number(i.deviation_pct)),
            confidence,
            explanation: `Quoted ${i.quoted_rate} vs market ${i.market_rate} (${Math.round(Number(i.deviation_pct))}% deviation)`
          })),
          summary: full.summary ?? null,
          recommendation: full.recommendation ?? null,
          riskSignals: full.risk_signals ?? [],
          claudeVerdict: full.verdict ?? null,
          mlModelVersion: "ollama-full-v1"
        };
      } catch (err) {
        console.error("[extension/auditPdfUrl] ML full-text error:", err);
        auditResult = { isTender: true, ...buildFallback(textForAudit) };
      }
    }

    // ── Step 4: persist to DB ──────────────────────────────────────────────
    const tenderNumber = detectTenderNumber(rawText || urlAndTitle);
    const department = detectDepartment(rawText || urlAndTitle);
    const { isTender: _isTender, ...dbFields } = auditResult;
    void _isTender;

    const record = await ExtensionAuditModel.create({
      sourceURL,
      pageTitle: title,
      extractedText: rawText.slice(0, MAX_TEXT_LENGTH) || urlAndTitle,
      tenderNumber,
      department,
      triggeredBy: new Types.ObjectId(userId),
      ...dbFields
    });

    return sendSuccess(
      res,
      {
        isTender: true,
        auditId: record._id.toString(),
        riskLevel: record.riskLevel,
        overallInflationPct: record.overallInflationPct,
        totalOverpricedINR: record.totalOverpricedINR,
        flags: record.flags,
        summary: record.summary,
        recommendation: record.recommendation,
        riskSignals: record.riskSignals,
        claudeVerdict: record.claudeVerdict,
        tenderNumber: record.tenderNumber,
        department: record.department,
        auditedAt: record.createdAt
      },
      201
    );
  } catch (err) {
    console.error("[extension/auditPdfUrl] Unhandled error:", err);
    return sendError(res, { code: "EXTENSION_PDF_AUDIT_FAILED", message: "Unable to audit PDF" }, 500);
  } finally {
    // Always clean up the temp file
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
};
