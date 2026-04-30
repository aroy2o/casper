/**
 * Seed & migrate existing tender/price data with state codes and district info.
 * Also seeds PriceHistory records for all Indian states so analytics has data.
 *
 * Run: tsx src/scripts/seed-india-districts.ts
 */
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { INDIA_GEO, getStateByName } from "../data/india-districts.js";
import { TenderModel } from "../models/Tender.model.js";
import { PriceModel } from "../models/Price.model.js";
import { PriceHistoryModel } from "../models/PriceHistory.model.js";

const CPWD_BASE: Record<string, { priceINR: number; unit: string }> = {
  cement: { priceINR: 370, unit: "per_bag_50kg" },
  steel_rod: { priceINR: 56000, unit: "per_tonne" },
  coarse_sand: { priceINR: 42, unit: "per_cft" },
  fine_sand: { priceINR: 35, unit: "per_cft" },
  aggregate_20mm: { priceINR: 1750, unit: "per_tonne" },
  brick: { priceINR: 6800, unit: "per_1000" },
  bitumen: { priceINR: 50000, unit: "per_tonne" },
  rcc_pipe: { priceINR: 2650, unit: "per_metre" }
};

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);
const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

async function backfillTenderStateCodes(): Promise<void> {
  console.log("Backfilling tender state codes...");
  const tenders = await TenderModel.find({ stateCode: null }).select("_id state").lean();
  let updated = 0;
  for (const t of tenders) {
    const info = getStateByName(t.state);
    if (!info) continue;
    await TenderModel.updateOne({ _id: t._id }, { $set: { stateCode: info.code, regionCode: info.code } });
    updated += 1;
  }
  console.log(`Backfilled ${updated} tenders with state codes`);
}

async function backfillPriceStateCodes(): Promise<void> {
  console.log("Backfilling price state codes...");
  const prices = await PriceModel.find({ stateCode: null }).select("_id region").lean();
  let updated = 0;
  for (const p of prices) {
    const info = getStateByName(p.region);
    if (!info) continue;
    await PriceModel.updateOne({ _id: p._id }, { $set: { state: info.name, stateCode: info.code } });
    updated += 1;
  }
  console.log(`Backfilled ${updated} prices with state codes`);
}

async function seedAllIndiaPriceHistory(): Promise<void> {
  console.log("Seeding Pan-India price history...");

  const today = new Date();
  let seeded = 0;

  for (const stateInfo of INDIA_GEO) {
    const mult = stateInfo.regionMultiplier;

    for (const [material, base] of Object.entries(CPWD_BASE)) {
      const startPrice = base.priceINR * mult;

      // Build 180-day history with random walk
      const dataPoints: { date: Date; priceINR: number; source: string }[] = [];
      let prev = startPrice;
      for (let i = 180; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const walk = randomBetween(-0.012, 0.018);
        const next = clamp(prev * (1 + walk), startPrice * 0.82, startPrice * 1.38);
        const rounded = Math.round(next * 100) / 100;
        dataPoints.push({ date, priceINR: rounded, source: `cpwd_seed_${stateInfo.code}` });
        prev = rounded;
      }

      const region = stateInfo.name.toLowerCase().replace(/ /g, "_");

      await PriceHistoryModel.findOneAndUpdate(
        { material, region },
        {
          $set: {
            material,
            region,
            state: stateInfo.name,
            stateCode: stateInfo.code
          },
          $setOnInsert: { dataPoints }
        },
        { upsert: true }
      );
      seeded += 1;
    }
  }

  console.log(`Seeded price history for ${seeded} material-state combinations`);
}

async function createIndexes(): Promise<void> {
  console.log("Ensuring indexes...");
  await TenderModel.syncIndexes();
  await PriceModel.syncIndexes();
  await PriceHistoryModel.syncIndexes();
  console.log("Indexes synchronized");
}

async function main(): Promise<void> {
  await connectDB();
  console.log("Connected. Starting India district seed...\n");

  await backfillTenderStateCodes();
  await backfillPriceStateCodes();
  await seedAllIndiaPriceHistory();
  await createIndexes();

  console.log("\n✓ India district seed complete");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
