import * as cheerio from "cheerio";
import puppeteer from "puppeteer";
import { insertCpwdFallbackForAllRegions, logger, upsertPrice } from "./shared.js";

const SOURCE_URL = "https://www.sail.co.in/en/steel-prices";
const ALT_SOURCE_URL = "https://www.sail.co.in/en/products/price-list";

// SAIL's published TMT prices for Guwahati / NE India apply to Assam,
// Meghalaya, Arunachal Pradesh, and Manipur — all served by the SAIL
// Guwahati stockyard. We use the same ex-stockyard price for all four.
const NE_REGIONS = ["assam", "meghalaya", "arunachal", "manipur"] as const;

// Keywords that identify TMT / rebar products in the price table
const TMT_PATTERN = /tmt|fe[- ]?500|fe[- ]?550|rebar|tor\s*steel|thermo.?mech/i;
// Keywords that indicate NE India / Guwahati pricing
const NE_PRICE_PATTERN = /guwahati|northeast|north.?east|ne.?india|ne\s*region/i;

function extractPriceFromText(raw: string): number | null {
  const cleaned = raw.replace(/[₹Rs.,\s]/g, "");
  const n = Number.parseFloat(cleaned);
  // TMT steel is ~₹45,000–70,000 per tonne
  return Number.isFinite(n) && n > 30_000 && n < 150_000 ? n : null;
}

function parsePageForPrices(html: string): { nePrice: number | null; nationalPrice: number | null } {
  const $ = cheerio.load(html);
  let nePrice: number | null = null;
  let nationalPrice: number | null = null;

  // Strategy 1: table rows — look for TMT product rows
  $("table tr").each((_i, row) => {
    const rowText = $(row).text();
    if (!TMT_PATTERN.test(rowText)) return;
    const cells = $(row).find("td");
    if (cells.length < 2) return;
    cells.each((_j, cell) => {
      const price = extractPriceFromText($(cell).text());
      if (price === null) return;
      const precedingText = rowText.slice(0, rowText.indexOf($(cell).text()));
      if (NE_PRICE_PATTERN.test(precedingText) || NE_PRICE_PATTERN.test($(cell).attr("headers") ?? "")) {
        if (nePrice === null) nePrice = price;
      } else if (nationalPrice === null) {
        nationalPrice = price;
      }
    });
  });

  if (nePrice !== null || nationalPrice !== null) return { nePrice, nationalPrice };

  // Strategy 2: any element with TMT text containing a price
  $("[class*='price'], [class*='rate'], [class*='steel'], [class*='tmt']").each((_i, el) => {
    const text = $(el).text();
    if (!TMT_PATTERN.test(text)) return;
    const price = extractPriceFromText(text);
    if (price === null) return;
    if (NE_PRICE_PATTERN.test(text) && nePrice === null) {
      nePrice = price;
    } else if (nationalPrice === null) {
      nationalPrice = price;
    }
  });

  if (nePrice !== null || nationalPrice !== null) return { nePrice, nationalPrice };

  // Strategy 3: scan body text for a TMT price range
  const bodyText = $("body").text().replace(/\n/g, " ");
  const tmt = TMT_PATTERN.exec(bodyText);
  if (tmt) {
    const context = bodyText.slice(Math.max(0, tmt.index - 50), tmt.index + 200);
    const priceMatch = context.match(/([\d]{5,6}(?:\.\d+)?)/);
    if (priceMatch?.[1]) {
      const price = extractPriceFromText(priceMatch[1]);
      if (price !== null) nationalPrice = price;
    }
  }

  return { nePrice, nationalPrice };
}

export async function scrapeSailSteel(): Promise<number> {
  let browser: puppeteer.Browser | null = null;
  logger.info("[SAIL] scrape_start material=steel_rod source=sail");

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    let html = "";
    try {
      const response = await page.goto(SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
      if (!response || response.status() >= 400) throw new Error(`HTTP ${response?.status() ?? "no_response"}`);
      html = await page.content();
    } catch (primaryErr) {
      logger.warn(`[SAIL] primary URL failed (${primaryErr instanceof Error ? primaryErr.message : "err"}), trying alt URL`);
      const response = await page.goto(ALT_SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
      if (!response || response.status() >= 400) throw new Error(`alt_url_also_failed: HTTP ${response?.status() ?? "no_response"}`);
      html = await page.content();
    }

    const { nePrice, nationalPrice } = parsePageForPrices(html);

    if (nePrice === null && nationalPrice === null) {
      throw new Error("sail_no_prices_found");
    }

    let upserted = 0;

    // Apply the NE India price to all four NE regions served by Guwahati stockyard
    const effectiveNePrice = nePrice ?? (nationalPrice !== null ? Math.round(nationalPrice * 1.04) : null);
    if (effectiveNePrice !== null) {
      for (const region of NE_REGIONS) {
        await upsertPrice({
          material: "steel_rod",
          unit: "per_tonne",
          priceINR: effectiveNePrice,
          source: "sail",
          sourceURL: SOURCE_URL,
          region
        });
        upserted += 1;
        logger.info(`[SAIL] scrape_success region=${region} priceINR=${effectiveNePrice}`);
      }
    }

    if (nationalPrice !== null) {
      await upsertPrice({
        material: "steel_rod",
        unit: "per_tonne",
        priceINR: nationalPrice,
        source: "sail",
        sourceURL: SOURCE_URL,
        region: "national"
      });
      upserted += 1;
      logger.info(`[SAIL] scrape_success region=national priceINR=${nationalPrice}`);
    }

    return upserted;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    logger.warn(`[SAIL] scrape_failed reason=${reason} — inserting CPWD fallback for all regions`);
    return insertCpwdFallbackForAllRegions({
      material: "steel_rod",
      sourceURL: SOURCE_URL,
      reason: `sail_unreachable:${reason}`
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
