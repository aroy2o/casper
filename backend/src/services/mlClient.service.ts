import axios from "axios";
import { env } from "../config/env.js";

export interface ParsedLineItem {
  description: string;
  quantity: number;
  unit: string;
  quotedRateINR: number;
}

export interface AuditFlagResult {
  lineItemDescription: string;
  quotedRateINR: number;
  marketRateINR: number;
  inflationPct: number;
  confidence: number;
  explanation: string;
}

export interface AuditTextLineItem {
  description: string;
  quantity: number | null;
  unit: string;
  quotedRateINR: number | null;
  marketRateINR: number | null;
  inflationPct: number | null;
  flagged: boolean;
}

export interface AuditTextResult {
  lineItems: AuditTextLineItem[];
  riskLevel: "low" | "medium" | "high" | "critical";
  overallInflationPct: number;
  totalOverpricedINR: number;
  summary: string;
}

export interface FullAuditResult {
  verdict: "overpriced" | "neutral" | "underpriced";
  confidence: "high" | "medium" | "low";
  summary: string;
  flagged_items: Array<{
    item: string;
    quoted_rate: number;
    market_rate: number;
    deviation_pct: number;
    flag: "overpriced" | "underpriced" | "ok";
    human_summary?: string;
    verdict?: string;
    top_factors?: Array<{ feature: string; impact: number; direction: string }>;
    risk_contribution?: number;
  }>;
  risk_signals: string[];
  recommendation: string;
  plain_english_summary?: string;
  overall_verdict?: string;
  explanation_version?: string;
}

const client = axios.create({
  baseURL: env.ML_SERVICE_URL,
  timeout: 20_000
});

function extractLineItemsFromText(text: string): AuditTextLineItem[] {
  const results: AuditTextLineItem[] = [];
  const pattern = /(\d[\d,]*)\s*(bags?|MT|kg|ton|cum|sqm|nos?|units?)\s*[@at]+\s*[₹Rs.INR\s]*([\d,]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const qty = parseFloat((match[1] ?? "0").replace(/,/g, ""));
    const unit = match[2] ?? "nos";
    const rate = parseFloat((match[3] ?? "0").replace(/,/g, ""));
    if (qty > 0 && rate > 0) {
      results.push({
        description: match[0],
        quantity: qty,
        unit,
        quotedRateINR: rate,
        marketRateINR: null,
        inflationPct: null,
        flagged: false
      });
    }
  }
  return results;
}

export const mlClient = {
  async auditFullText(params: { text: string; title?: string; department?: string }): Promise<FullAuditResult> {
    const response = await axios.post<FullAuditResult>(
      `${env.ML_SERVICE_URL}/audit/full`,
      { text: params.text, title: params.title ?? "", department: params.department ?? "" },
      { timeout: 120_000 }
    );
    return response.data;
  },

  async parsePdf(filePath: string): Promise<ParsedLineItem[]> {
    const response = await client.post<{ lineItems: ParsedLineItem[] }>("/parse", { filePath });
    return response.data.lineItems;
  },
  async auditLineItems(payload: {
    lineItems: ParsedLineItem[];
    region: string;
  }): Promise<{ flags: AuditFlagResult[]; modelVersion: string }> {
    const response = await client.post<{ flags: AuditFlagResult[]; modelVersion: string }>("/audit", payload);
    return response.data;
  },
  async auditFromText(
    rawText: string,
    prices: Array<{ material: string; marketRatePerUnit: number; unit: string }>
  ): Promise<AuditTextResult> {
    try {
      const response = await axios.post<AuditTextResult>(
        `${env.ML_SERVICE_URL}/audit/text`,
        { text: rawText, prices },
        { timeout: 30000 }
      );
      return response.data;
    } catch {
      // ML service unreachable — use heuristic fallback
      const lineItems = extractLineItemsFromText(rawText);
      const flaggedCount = lineItems.filter((i) => i.flagged).length;
      void flaggedCount;
      const avgInflation =
        lineItems.length > 0
          ? lineItems.reduce((s, i) => s + (i.inflationPct ?? 0), 0) / lineItems.length
          : 0;
      const riskLevel: AuditTextResult["riskLevel"] =
        avgInflation > 50 ? "critical" : avgInflation > 30 ? "high" : avgInflation > 10 ? "medium" : "low";
      return {
        lineItems,
        riskLevel,
        overallInflationPct: Math.round(avgInflation),
        totalOverpricedINR: 0,
        summary: "Heuristic audit (ML service unavailable)"
      };
    }
  }
};
