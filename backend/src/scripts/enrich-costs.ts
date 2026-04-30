/**
 * One-time Puppeteer enrichment script.
 * Finds zero-cost eProcure/eTenders tenders and searches eProcure for each
 * by tender number. Clicks the matching result (establishing a valid browser
 * session token), then extracts cost from the detail page.
 */
import mongoose from "mongoose";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { connectDB } from "../config/db.js";
import { TenderModel } from "../models/Tender.model.js";
import { logger } from "../services/scrapers/shared.js";

const COST_LABELS = /tender value|estimated cost|contract value|total bid value|approximate cost|bid value|estimated amount|work value/i;

function parseCostFromText(text: string): number {
  if (!text || text.trim() === "" || text.trim() === "-") return 0;
  const stripped = text.replace(/Rs\.|INR|₹/gi, "").trim();
  const cleaned = stripped.replace(/[,\s]/g, "").trim();
  if (/crore/i.test(text)) {
    const num = Number.parseFloat(cleaned.replace(/crore/gi, ""));
    return Number.isNaN(num) ? 0 : Math.round(num * 1e7);
  }
  if (/lakh/i.test(text)) {
    const num = Number.parseFloat(cleaned.replace(/lakh/gi, ""));
    return Number.isNaN(num) ? 0 : Math.round(num * 1e5);
  }
  const num = Number.parseFloat(cleaned);
  if (Number.isNaN(num) || num <= 0) return 0;
  return Math.round(num);
}

const SEARCH_BASE = "https://eprocure.gov.in/eprocure/app";

async function extractCostFromDetailPage(page: puppeteer.Page): Promise<{ cost: number; label: string }> {
  const result = await page.evaluate((labelPattern: string) => {
    const regex = new RegExp(labelPattern, "i");
    let costLabel = "";
    let costValue = "";

    // Strategy 1: td.td_caption / td.td_field pairs (GePNIC standard)
    const captions = Array.from(document.querySelectorAll("td.td_caption"));
    for (const cap of captions) {
      const labelText = (cap.textContent ?? "").trim();
      if (regex.test(labelText)) {
        const next = cap.nextElementSibling as HTMLElement | null;
        const val = next?.textContent?.trim() ?? "";
        if (val && val !== "-" && val !== "NA" && val.length < 50) {
          costLabel = labelText;
          costValue = val;
          break;
        }
      }
    }

    // Strategy 2: any tr with two adjacent cells where first matches label
    if (!costValue) {
      for (const tr of Array.from(document.querySelectorAll("tr"))) {
        const cells = Array.from(tr.querySelectorAll("th, td"));
        for (let i = 0; i < cells.length - 1; i++) {
          const cellEl = cells[i] as Element | undefined;
          if (!cellEl) continue;
          const labelText = (cellEl.textContent ?? "").trim();
          if (regex.test(labelText)) {
            const val = (cells[i + 1] as HTMLElement).textContent?.trim() ?? "";
            if (val && val !== "-" && val !== "NA" && val.length < 50) {
              costLabel = labelText;
              costValue = val;
              break;
            }
          }
        }
        if (costValue) break;
      }
    }

    // Strategy 3: regex on body text
    if (!costValue) {
      const bodyText = (document.body.innerText ?? "").replace(/\s+/g, " ");
      const m = bodyText.match(/(?:Tender Value|Estimated Cost|Contract Value|Bid Value|Approximate Cost)[^₹\d\n]{0,20}([₹\d][₹\d,. ]*(?:Lakh|Crore|lakh|crore)?)/i);
      if (m?.[1]) {
        costValue = m[1].trim();
      }
    }

    return { label: costLabel, value: costValue };
  }, COST_LABELS.source);

  if (!result.value) return { cost: 0, label: "" };

  let costText = result.value;
  if (/in.{0,5}lakh/i.test(result.label) && !/lakh/i.test(costText)) costText += " Lakh";
  if (/in.{0,5}crore/i.test(result.label) && !/crore/i.test(costText)) costText += " Crore";
  return { cost: parseCostFromText(costText), label: result.label };
}

async function enrichTenderCost(
  page: puppeteer.Page,
  tenderNumber: string,
  title: string,
  portal: "eprocure" | "etenders"
): Promise<number> {
  const base = portal === "etenders" ? "https://etenders.gov.in/eprocure/app" : SEARCH_BASE;

  // Search by tender number first, then fall back to a snippet of the title
  const queries = [tenderNumber, title.substring(0, 60)];

  for (const q of queries) {
    const url = `${base}?component=%24DirectLink&page=FrontEndAdvancedSearchResult&service=page&searchStr=${encodeURIComponent(q)}&itemsPerPage=20`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

      // Find a matching row anchor and click it
      const clicked = await page.evaluate((tn: string) => {
        const rows = Array.from(document.querySelectorAll("#table tr.even, #table tr.odd, #table tr[id^='informal']"));
        for (const row of rows) {
          const cellText = (row.textContent ?? "").toLowerCase();
          if (cellText.includes(tn.toLowerCase())) {
            const anchor = row.querySelector("td:nth-child(5) a") as HTMLAnchorElement | null;
            if (anchor) {
              anchor.click();
              return true;
            }
          }
        }
        // If no exact match, click the first result
        const firstAnchor = document.querySelector("#table tr.even td:nth-child(5) a, #table tr.odd td:nth-child(5) a") as HTMLAnchorElement | null;
        if (firstAnchor && rows.length === 1) {
          firstAnchor.click();
          return true;
        }
        return false;
      }, tenderNumber.split("/")[0] ?? tenderNumber);

      if (!clicked) continue;

      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
      const { cost, label } = await extractCostFromDetailPage(page);
      if (cost > 0) {
        logger.info(`[enrich] ${tenderNumber}: ₹${cost} (label="${label}")`);
        return cost;
      }
    } catch (err) {
      logger.warn(`[enrich] query failed for "${q}": ${err instanceof Error ? err.message : String(err)}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return 0;
}

const main = async (): Promise<void> => {
  await connectDB();

  const zeroCostTenders = await TenderModel.find({
    sourcePortal: { $in: ["eprocure", "etenders"] },
    totalEstimatedCostINR: { $lte: 0 }
  }).select({ _id: 1, tenderNumber: 1, title: 1, sourcePortal: 1 }).limit(100).lean();

  console.log(`Found ${zeroCostTenders.length} zero-cost eProcure/eTenders tenders`);

  if (zeroCostTenders.length === 0) {
    await mongoose.disconnect();
    return;
  }

  let browser: puppeteer.Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    let enriched = 0;
    for (const t of zeroCostTenders) {
      const portal = (t.sourcePortal as "eprocure" | "etenders") ?? "eprocure";
      const cost = await enrichTenderCost(page, t.tenderNumber ?? "", t.title ?? "", portal);
      if (cost > 0) {
        await TenderModel.updateOne({ _id: t._id }, { $set: { totalEstimatedCostINR: cost } });
        enriched++;
        console.log(`  ✓ ${t.tenderNumber}: ₹${cost}`);
      } else {
        console.log(`  — ${t.tenderNumber}: no cost found`);
      }
      await new Promise((r) => setTimeout(r, 1200));
    }

    console.log(`\nEnriched ${enriched} / ${zeroCostTenders.length} tenders`);
  } finally {
    if (browser) await browser.close();
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error("enrich-costs failed:", err);
  process.exit(1);
});
