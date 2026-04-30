import { Request, Response } from "express";
import { Types } from "mongoose";
import puppeteer from "puppeteer";
import { AuditModel } from "../models/Audit.model.js";
import { TenderModel } from "../models/Tender.model.js";
import { isValidObjectId } from "../utils/objectId.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import { ollamaClient } from "../services/ollamaClient.service.js";

export const getAuditByTenderId = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const tenderId = req.params.tenderId;
    if (!tenderId) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid ID format" }, 400);
    }

    if (!isValidObjectId(tenderId)) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid ID format" }, 400);
    }

    // Search by tenderId first, fall back to searching by audit _id
    const audit = await AuditModel.findOne({
      $or: [{ tenderId: new Types.ObjectId(tenderId) }, { _id: new Types.ObjectId(tenderId) }]
    }).lean();

    if (!audit) {
      return sendError(res, { code: "NOT_FOUND", message: "Audit not found" }, 404);
    }
    return sendSuccess(res, audit);
  } catch {
    return sendError(res, { code: "AUDIT_FETCH_FAILED", message: "Unable to fetch audit" }, 500);
  }
};

export const getAuditReport = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const tenderId = req.params.tenderId;
    if (!tenderId) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid ID format" }, 400);
    }
    if (!isValidObjectId(tenderId)) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid ID format" }, 400);
    }
    const audit = await AuditModel.findOne({ tenderId: new Types.ObjectId(tenderId) }).lean();
    if (!audit) {
      return sendError(res, { code: "NOT_FOUND", message: "Audit not found" }, 404);
    }
    return sendSuccess(res, { reportURL: audit.reportURL });
  } catch {
    return sendError(res, { code: "AUDIT_REPORT_FAILED", message: "Unable to fetch report" }, 500);
  }
};

export const getAuditSummary = async (_req: Request, res: Response): Promise<Response | void> => {
  try {
    const [totalAudits, flaggedTenders, criticalCount, cleanTenders, totalAgg, avgAgg, topFlagAgg, recent] =
      await Promise.all([
        AuditModel.countDocuments({}),
        AuditModel.countDocuments({ riskLevel: { $in: ["high", "critical"] } }),
        AuditModel.countDocuments({ riskLevel: "critical" }),
        AuditModel.countDocuments({ riskLevel: "low" }),
        AuditModel.aggregate<{ _id: null; total: number }>([{ $group: { _id: null, total: { $sum: "$totalOverpricedINR" } } }]),
        AuditModel.aggregate<{ _id: null; avg: number }>([{ $group: { _id: null, avg: { $avg: "$overallInflationPct" } } }]),
        AuditModel.aggregate<{ _id: string; count: number }>([
          { $unwind: "$flags" },
          { $group: { _id: "$flags.lineItemDescription", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 }
        ]),
        AuditModel.find({ riskLevel: { $in: ["high", "critical"] } })
          .sort({ auditedAt: -1 })
          .limit(5)
          .populate("tenderId", "title department state")
          .lean()
      ]);

    const totalOverpricedINR = totalAgg[0]?.total ?? 0;
    const avgInflationPct = Math.round(((avgAgg[0]?.avg ?? 0) * 10)) / 10;
    const mostFlaggedMaterial = topFlagAgg[0]?._id ?? null;

    const recentFlags = recent.map((audit) => {
      const tender = audit.tenderId as unknown as { title?: string; department?: string; state?: string } | null;
      return {
        _id: audit._id.toString(),
        riskLevel: String(audit.riskLevel),
        overallInflationPct: Number(audit.overallInflationPct),
        totalOverpricedINR: Number(audit.totalOverpricedINR),
        auditedAt: new Date(audit.auditedAt).toISOString(),
        tender: tender
          ? {
              title: String(tender.title ?? ""),
              department: String(tender.department ?? ""),
              state: String(tender.state ?? "")
            }
          : null
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        totalAudits,
        flaggedTenders,
        criticalCount,
        cleanTenders,
        totalOverpricedINR,
        avgInflationPct,
        mostFlaggedMaterial,
        recentFlags
      }
    });
  } catch {
    return sendError(res, { code: "AUDIT_SUMMARY_FAILED", message: "Unable to fetch summary" }, 500);
  }
};

export const getAuditExplanation = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const tenderId = req.params.tenderId;
    if (!tenderId || !isValidObjectId(tenderId)) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid ID format" }, 400);
    }
    const audit = await AuditModel.findOne({
      $or: [{ tenderId: new Types.ObjectId(tenderId) }, { _id: new Types.ObjectId(tenderId) }]
    }).lean();
    if (!audit) {
      return sendError(res, { code: "NOT_FOUND", message: "Audit not found" }, 404);
    }
    const explanation = {
      overallInflationPct: audit.overallInflationPct,
      riskLevel: audit.riskLevel,
      overallVerdict: (audit as { overallVerdict?: string | null }).overallVerdict ?? null,
      plainEnglishSummary: (audit as { plainEnglishSummary?: string | null }).plainEnglishSummary ?? audit.summary ?? null,
      explanationVersion: (audit as { explanationVersion?: string | null }).explanationVersion ?? null,
      flags: (audit.flags ?? []).map((flag) => ({
        lineItemDescription: flag.lineItemDescription,
        quotedRateINR: flag.quotedRateINR,
        marketRateINR: flag.marketRateINR,
        inflationPct: flag.inflationPct,
        explanation: flag.explanation,
        humanSummary: (flag as { humanSummary?: string | null }).humanSummary ?? null,
        verdict: (flag as { verdict?: string | null }).verdict ?? null,
        topFactors: (flag as { topFactors?: Array<{ feature: string; impact: number; direction: string }> }).topFactors ?? [],
        riskContribution: (flag as { riskContribution?: number | null }).riskContribution ?? null
      }))
    };
    return sendSuccess(res, explanation);
  } catch {
    return sendError(res, { code: "AUDIT_EXPLANATION_FAILED", message: "Unable to fetch explanation" }, 500);
  }
};

export const draftRtiLetter = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const tenderId = req.params.tenderId;
    if (!tenderId || !isValidObjectId(tenderId)) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid ID format" }, 400);
    }
    const audit = await AuditModel.findOne({ tenderId: new Types.ObjectId(tenderId) }).lean();
    const tender = await TenderModel.findById(tenderId).lean();
    if (!audit || !tender) {
      return sendError(res, { code: "NOT_FOUND", message: "Audit not found" }, 404);
    }
    const flagged = (audit.flags ?? [])
      .filter((f) => f.inflationPct >= 10)
      .slice(0, 8)
      .map((f) => `- ${f.lineItemDescription}: quoted ₹${f.quotedRateINR.toLocaleString("en-IN")} vs benchmark ₹${f.marketRateINR.toLocaleString("en-IN")} (${f.inflationPct.toFixed(1)}%)`)
      .join("\n");
    const prompt = `Draft a formal RTI letter in Indian procurement context.\nTender title: ${tender.title}\nTender number: ${tender.tenderNumber}\nDepartment: ${tender.department}\nState: ${tender.state}\nFlagged findings:\n${flagged || "- No line-item level findings available"}\n\nReturn only the letter body with subject, facts sought, and closing.`;

    const fallbackLetter = [
      "Subject: Request for information under the Right to Information Act, 2005 regarding tender procurement records",
      "",
      `Tender Reference: ${tender.tenderNumber}`,
      `Tender Title: ${tender.title}`,
      `Department: ${tender.department}`,
      `State: ${tender.state}`,
      "",
      "Respected Public Information Officer,",
      "",
      "I am seeking certified information and records concerning the above tender in public interest to understand the basis of pricing, bid evaluation and post-award contract administration.",
      "",
      "Information requested:",
      "1. Certified copy of the full Notice Inviting Tender (NIT), BOQ and technical specifications.",
      "2. Names of all bidders, quoted prices and comparative statement prepared during financial evaluation.",
      "3. Certified copies of the estimate sanction note and rate analysis used to determine benchmark prices.",
      "4. File notings and approvals for bidder qualification, award decision and any deviation from standard procedure.",
      "5. Details of amendments, corrigenda, variation orders and revised administrative approvals after tender publication.",
      "6. Measurement book extracts and payment release records against major line items.",
      "",
      "Risk observations prompting this request:",
      flagged || "- No line-item level findings available",
      "",
      "I request that the above information be provided within the statutory timeline under the RTI Act, 2005. If any part of the requested information pertains to another public authority, please transfer it under Section 6(3) and inform me accordingly.",
      "",
      "Sincerely,",
      "Citizen Applicant"
    ].join("\n");

    let letter = fallbackLetter;
    try {
      letter = await ollamaClient.generate(prompt, { temperature: 0.1 });
    } catch {
      letter = fallbackLetter;
    }

    if (req.query.format === "json") {
      return sendSuccess(res, { letter });
    }

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 36px; font-size: 12px; line-height: 1.55; }
            h1 { font-size: 16px; margin: 0 0 8px; }
            .meta { font-size: 11px; color: #4b5563; margin-bottom: 14px; }
            pre { white-space: pre-wrap; word-break: break-word; font-family: Arial, sans-serif; margin: 0; }
          </style>
        </head>
        <body>
          <h1>RTI Draft Letter</h1>
          <div class="meta">Generated by CASPER on ${new Date().toLocaleString("en-IN")}</div>
          <pre>${letter.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</pre>
        </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBytes = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    const pdfBuffer = Buffer.from(pdfBytes);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("Content-Disposition", `attachment; filename="RTI-${tender.tenderNumber}.pdf"`);
    return res.send(pdfBuffer);
  } catch {
    return sendError(res, { code: "RTI_DRAFT_FAILED", message: "Unable to draft RTI letter" }, 500);
  }
};
