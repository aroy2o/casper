import axios from "axios";
import * as cheerio from "cheerio";
import { MATERIALS, delay, insertCpwdFallbackForAllRegions, logger, mapLocationToRegion, parsePrice, upsertPrice } from "./shared.js";

const client = axios.create({
  timeout: 20_000,
  headers: {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    "Accept-Language": "en-IN,en;q=0.9",
    Accept: "text/html,application/xhtml+xml"
  }
});

export const runIndiaMartScraper = async (): Promise<number> => {
  let upserted = 0;
  for (const materialConfig of MATERIALS) {
    try {
      logger.info(`[INDIAMART] scrape_start material=${materialConfig.material}`);
      const { data: html } = await client.get<string>(
        `https://www.indiamart.com/search.mp?ss=${encodeURIComponent(materialConfig.query)}&cq=${encodeURIComponent(materialConfig.material)}`
      );
      const $ = cheerio.load(html, { xml: { decodeEntities: false } });
      const rows = $(".product-base-wrap, .prd-info-sec, .prd-list, .product-listing-card, [class*='product']")
        .slice(0, 8)
        .toArray()
        .map((element) => {
          const node = $(element);
          return {
            title:
              node.find(".prd-title").first().text().trim() ||
              node.find("[class*='title']").first().text().trim(),
            priceText:
              node.find(".price strong").first().text().trim() ||
              node.find("[class*='price']").first().text().trim() ||
              node.find("[data-price]").first().attr("data-price")?.trim() ||
              "",
            location:
              node.find(".prd-loc").first().text().trim() ||
              node.find(".lcn").first().text().trim() ||
              node.find("[class*='loc']").first().text().trim()
          };
        });
      const first = rows.find((row) => parsePrice(row.priceText) !== null);
      const parsed = first ? parsePrice(first.priceText) : null;
      if (!first || parsed === null) {
        throw new Error("No parseable IndiaMART price");
      }

      const region = mapLocationToRegion(first.location);
      await upsertPrice({
        material: materialConfig.material,
        unit: materialConfig.unit,
        priceINR: parsed,
        source: "indiamart",
        sourceURL: "https://www.indiamart.com",
        region
      });
      upserted += 1;
      logger.info(
        `[INDIAMART] scrape_success material=${materialConfig.material} region=${region} priceINR=${parsed} unit=${materialConfig.unit}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      logger.warn(`[INDIAMART] scrape_failed material=${materialConfig.material} reason=${message}`);
      upserted += await insertCpwdFallbackForAllRegions({
        material: materialConfig.material,
        sourceURL: "https://cpwd.gov.in",
        reason: `indiamart_failed:${message}`
      });
    }
    await delay(1500);
  }
  return upserted;
};
