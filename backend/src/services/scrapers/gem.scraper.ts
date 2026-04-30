import puppeteer from "puppeteer";
import { MATERIALS, insertCpwdFallbackForAllRegions, logger, mapLocationToRegion, parsePrice, upsertPrice } from "./shared.js";

// GeM requires authenticated session.
// Replace with GeM API integration when API key available.
const GEM_SEARCH_URL = "https://mkp.gem.gov.in/search?q=cement";

async function probeGemAccessible(): Promise<boolean> {
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
    const response = await page.goto(GEM_SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    const status = response?.status() ?? 0;
    if (status === 401 || status === 403) return false;
    const finalUrl = page.url();
    const html = await page.content();
    const isLoginWall =
      finalUrl.includes("/login") ||
      finalUrl.includes("/signin") ||
      /sign.?in|please.?log.?in|log.?in.?to.?continue|authentication.?required/i.test(html);
    return !isLoginWall;
  } catch {
    return false;
  } finally {
    if (browser) await browser.close();
  }
}

export const runGemScraper = async (): Promise<number> => {
  const accessible = await probeGemAccessible();

  if (!accessible) {
    // GeM requires authenticated session.
    // Replace with GeM API integration when API key available.
    logger.warn("[GEM] auth_required — GeM marketplace requires an authenticated session. Falling through to CPWD fallback for all materials.");
    let upserted = 0;
    for (const materialConfig of MATERIALS) {
      upserted += await insertCpwdFallbackForAllRegions({
        material: materialConfig.material,
        sourceURL: "https://cpwd.gov.in",
        reason: "gem_failed:auth_required"
      });
    }
    return upserted;
  }

  // Reached only if GeM ever becomes accessible without auth.
  // Selectors below may need updating against the live DOM at that time.
  let upserted = 0;
  for (const materialConfig of MATERIALS) {
    let browser: puppeteer.Browser | null = null;
    try {
      logger.info(`[GEM] scrape_start material=${materialConfig.material}`);
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
      });
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      await page.goto(`https://mkp.gem.gov.in/search?q=${encodeURIComponent(materialConfig.query)}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000
      });
      await page.waitForSelector(".product-card, .item-list", { timeout: 15_000 });

      const rows = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll(".product-card, .item-list")).slice(0, 3);
        return cards.map((card) => ({
          title: (card.querySelector("h3")?.textContent ?? card.querySelector(".product-title")?.textContent ?? "").trim(),
          priceText:
            (card.querySelector(".price")?.textContent ??
              card.querySelector("[data-price]")?.getAttribute("data-price") ??
              "").trim(),
          location: (card.querySelector(".location")?.textContent ?? card.querySelector(".supplier-location")?.textContent ?? "").trim()
        }));
      });

      const first = rows[0];
      const parsed = parsePrice(first?.priceText ?? "");
      if (!first || parsed === null) {
        throw new Error("No parseable GeM price");
      }

      const normalizedPrice = materialConfig.unit === "per_bag_50kg" && parsed > 5000 ? parsed / 60 : parsed;
      const region = mapLocationToRegion(first.location);
      await upsertPrice({
        material: materialConfig.material,
        unit: materialConfig.unit,
        priceINR: normalizedPrice,
        source: "gem",
        sourceURL: "https://mkp.gem.gov.in",
        region
      });
      upserted += 1;
      logger.info(
        `[GEM] scrape_success material=${materialConfig.material} region=${region} priceINR=${normalizedPrice}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      logger.warn(`[GEM] scrape_failed material=${materialConfig.material} reason=${message}`);
      upserted += await insertCpwdFallbackForAllRegions({
        material: materialConfig.material,
        sourceURL: "https://cpwd.gov.in",
        reason: `gem_failed:${message}`
      });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  return upserted;
};
