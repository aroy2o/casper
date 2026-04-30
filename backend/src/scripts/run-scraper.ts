import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { runEprocureScraper } from "../services/scrapers/eprocure.scraper.js";
import { logger } from "../services/scrapers/shared.js";

const main = async (): Promise<void> => {
  await connectDB();
  logger.info("[run-scraper] starting eProcure + eTenders full scrape");

  const result = await runEprocureScraper({
    yearsBack: 2,
    portals: ["eprocure", "etenders", "worldbank"],
    maxRecords: 500
  });

  logger.info(`[run-scraper] done found=${result.found} inserted=${result.inserted}`);
  await mongoose.disconnect();
};

main().catch((err) => {
  console.error("run-scraper failed:", err);
  process.exit(1);
});
