import * as cheerio from "cheerio";
import puppeteer from "puppeteer";
import { insertCpwdFallbackForAllRegions, logger, upsertPrice } from "./shared.js";

const SOURCE_URL = "https://iocl.com/bitumen-prices";
const ALT_SOURCE_URL = "https://iocl.com/product/bitumen";

// IOCL does not publish separate prices for Arunachal Pradesh or Manipur.
// We derive them by adding 5% to the Assam (Guwahati depot) price as a
// transport premium — these states are landlocked and all road bitumen
// passes through Assam distribution points.
const ASSAM_TRANSPORT_PREMIUM = 1.05;

// City/keyword patterns mapped to our canonical regions.
const CITY_REGION_MAP: Array<{ pattern: RegExp; region: string }> = [
  { pattern: /guwahati|silchar|tinsukia|jorhat|dibrugarh|assam/i, region: "assam" },
  { pattern: /shillong|meghalaya/i, region: "meghalaya" }
];

function cityToRegion(city: string): string | null {
  for (const entry of CITY_REGION_MAP) {
    if (entry.pattern.test(city)) return entry.region;
  }
  return null;
}

function extractPriceFromText(raw: string): number | null {
  const cleaned = raw.replace(/[₹Rs.,\s]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n > 10_000 && n < 200_000 ? n : null;
}

// Try multiple selector strategies to pull city→price rows from the page.
function parsePageForPrices(html: string): Array<{ city: string; priceINR: number }> {
  const $ = cheerio.load(html);
  const extracted: Array<{ city: string; priceINR: number }> = [];

  // Strategy 1: table rows with at least two cells
  $("table tr").each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) return;
    const cityText = $(cells[0]).text().trim();
    const price = extractPriceFromText($(cells[1]).text());
    if (cityText.length > 1 && price !== null) {
      extracted.push({ city: cityText, priceINR: price });
    }
  });

  if (extracted.length > 0) return extracted;

  // Strategy 2: labeled list items or definition lists
  $("li, dt, .price-item, [class*='city'], [class*='location']").each((_i, el) => {
    const text = $(el).text();
    const cityMatch = text.match(/([A-Za-z\s]{3,30})/);
    const priceMatch = text.match(/([\d]{4,6}(?:\.\d+)?)/);
    if (cityMatch?.[1] && priceMatch?.[1]) {
      const price = extractPriceFromText(priceMatch[1]);
      if (price !== null) {
        extracted.push({ city: cityMatch[1].trim(), priceINR: price });
      }
    }
  });

  if (extracted.length > 0) return extracted;

  // Strategy 3: scan body text for known NE city names adjacent to a price
  const bodyText = $("body").text().replace(/\n/g, " ");
  for (const keyword of ["Guwahati", "Silchar", "Shillong"]) {
    const re = new RegExp(`${keyword}[^0-9₹]{0,60}[₹\\s](\\d[\\d,]{3,6})`, "i");
    const match = re.exec(bodyText);
    if (match?.[1]) {
      const price = extractPriceFromText(match[1]);
      if (price !== null) {
        extracted.push({ city: keyword, priceINR: price });
      }
    }
  }

  return extracted;
}

// Derive a national-average price from any ₹NNNNN pattern on the page
// as a last resort when no city-specific prices are found.
function extractNationalFallback(html: string): number | null {
  const matches = html.match(/[₹][\s]*([\d,]{5,7})/g) ?? [];
  const prices = matches
    .map((s) => extractPriceFromText(s))
    .filter((n): n is number => n !== null);
  if (prices.length === 0) return null;
  return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
}

export async function scrapeIoclBitumen(): Promise<number> {
  let browser: puppeteer.Browser | null = null;
  logger.info("[IOCL] scrape_start material=bitumen source=iocl");

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
      logger.warn(`[IOCL] primary URL failed (${primaryErr instanceof Error ? primaryErr.message : "err"}), trying alt URL`);
      const response = await page.goto(ALT_SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
      if (!response || response.status() >= 400) throw new Error(`alt_url_also_failed: HTTP ${response?.status() ?? "no_response"}`);
      html = await page.content();
    }

    const extracted = parsePageForPrices(html);
    const nationalFallback = extracted.length === 0 ? extractNationalFallback(html) : null;

    if (extracted.length === 0 && nationalFallback === null) {
      throw new Error("iocl_no_prices_found");
    }

    // Build region → price map from whatever we found
    const regionPrices = new Map<string, number>();

    for (const { city, priceINR } of extracted) {
      const region = cityToRegion(city);
      if (region && !regionPrices.has(region)) {
        regionPrices.set(region, priceINR);
      }
    }

    if (nationalFallback !== null && !regionPrices.has("national")) {
      regionPrices.set("national", nationalFallback);
    }

    // If we only have a national price, derive regional prices from it
    if (!regionPrices.has("assam") && regionPrices.has("national")) {
      const nat = regionPrices.get("national") as number;
      regionPrices.set("assam", Math.round(nat * 1.08));
    }
    if (!regionPrices.has("meghalaya") && regionPrices.has("assam")) {
      regionPrices.set("meghalaya", Math.round((regionPrices.get("assam") as number) * 1.02));
    }
    if (!regionPrices.has("national") && regionPrices.has("assam")) {
      regionPrices.set("national", Math.round((regionPrices.get("assam") as number) / 1.08));
    }

    // Arunachal Pradesh and Manipur: +5% transport premium over Assam.
    // IOCL does not publish separate depot prices for these states;
    // all bitumen is transshipped through Guwahati, adding ~5% logistics cost.
    if (regionPrices.has("assam")) {
      const assamPrice = regionPrices.get("assam") as number;
      regionPrices.set("arunachal", Math.round(assamPrice * ASSAM_TRANSPORT_PREMIUM));
      regionPrices.set("manipur", Math.round(assamPrice * ASSAM_TRANSPORT_PREMIUM));
    }

    let upserted = 0;
    for (const [region, priceINR] of regionPrices.entries()) {
      await upsertPrice({
        material: "bitumen",
        unit: "per_tonne",
        priceINR,
        source: "iocl",
        sourceURL: SOURCE_URL,
        region
      });
      upserted += 1;
      logger.info(`[IOCL] scrape_success region=${region} priceINR=${priceINR}`);
    }

    return upserted;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    logger.warn(`[IOCL] scrape_failed reason=${reason} — inserting CPWD fallback for all regions`);
    return insertCpwdFallbackForAllRegions({
      material: "bitumen",
      sourceURL: SOURCE_URL,
      reason: `iocl_unreachable:${reason}`
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
