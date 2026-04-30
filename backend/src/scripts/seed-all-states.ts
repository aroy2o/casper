import mongoose from "mongoose";
import { env } from "../config/env.js";
import { CPWD_2024_BASE_RATES, MATERIALS, logger } from "../services/scrapers/shared.js";
import { PriceHistoryModel } from "../models/PriceHistory.model.js";
import { PriceModel } from "../models/Price.model.js";
import { INDIA_GEO } from "../data/india-districts.js";

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// Seeded pseudo-random walk: give the same code the same history on every run
function seededRng(seed: number): () => number {
  let s = seed;
  return (): number => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function codeHash(code: string): number {
  return code.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

const HISTORY_DAYS = 730; // 2 years → 3 yearly buckets, 8 quarterly, 24 monthly

function buildPriceHistory(
  startPrice: number,
  source: string,
  seed: number
): Array<{ date: Date; priceINR: number; source: string }> {
  const rng = seededRng(seed);
  const points: Array<{ date: Date; priceINR: number; source: string }> = [];
  const today = new Date();
  let prev = startPrice;

  for (let i = HISTORY_DAYS; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    // Seasonal target: ~8% higher in construction season (Oct–Mar = peak)
    const month = date.getMonth(); // 0=Jan … 11=Dec
    const seasonal = 1 + 0.08 * Math.cos(((month - 0) / 12) * Math.PI * 2);
    const target = startPrice * seasonal;

    // Mean-reverting walk: gentle pull toward seasonal target + random shock
    const reversion = 0.008 * (target - prev);
    const shock = (rng() - 0.5) * startPrice * 0.025; // ±2.5% of baseline daily
    const next = clamp(prev + reversion + shock, startPrice * 0.72, startPrice * 1.38);
    const rounded = Math.round(next * 100) / 100;

    points.push({ date, priceINR: rounded, source });
    prev = rounded;
  }
  return points;
}

// Deterministic per-district multiplier: 0.96 – 1.08 above state price
function districtMultiplier(districtCode: string): number {
  const h = codeHash(districtCode);
  return 0.96 + (h % 13) * 0.01; // 0.96, 0.97 … 1.08
}

type HistoryOp = Parameters<typeof PriceHistoryModel.bulkWrite>[0][number];
type PriceDoc = {
  material: string; region: string;
  state: string | null; stateCode: string | null;
  district: string | null; districtCode: string | null;
  unit: string; priceINR: number; source: string;
  sourceURL: string; scrapedAt: Date; isActive: boolean;
};

async function main(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  logger.info("[seed-all-states] Connected to MongoDB");

  const historyOps: HistoryOp[] = [];
  const priceDocs: PriceDoc[] = [];
  const SOURCE_URL = "https://cpwd.gov.in/publication/scheduleofratesdelhi2024.pdf";

  for (const mat of MATERIALS) {
    const base = CPWD_2024_BASE_RATES[mat.material];
    if (!base) continue;

    // ── 1. National ────────────────────────────────────────────────────────
    const natPrice = base.priceINR;
    const natSeed = codeHash(`national:${mat.material}`);
    const natPoints = buildPriceHistory(natPrice, "cpwd_seed", natSeed);
    const natLatest = natPoints[natPoints.length - 1]!;
    historyOps.push({
      updateOne: {
        filter: { material: mat.material, region: "national" },
        update: { $set: { material: mat.material, region: "national", state: null, stateCode: null, district: null, districtCode: null, dataPoints: natPoints } },
        upsert: true
      }
    });
    priceDocs.push({ material: mat.material, region: "national", state: null, stateCode: null, district: null, districtCode: null, unit: base.unit, priceINR: natLatest.priceINR, source: "cpwd_seed", sourceURL: SOURCE_URL, scrapedAt: new Date(), isActive: true });

    // ── 2. States + their districts ────────────────────────────────────────
    for (const s of INDIA_GEO) {
      const statePrice = Math.round(base.priceINR * s.regionMultiplier * 100) / 100;
      const stateSeed = codeHash(`${s.code}:${mat.material}`);
      const statePoints = buildPriceHistory(statePrice, "cpwd_seed", stateSeed);
      const stateLatest = statePoints[statePoints.length - 1]!;

      historyOps.push({
        updateOne: {
          filter: { material: mat.material, region: s.code },
          update: { $set: { material: mat.material, region: s.code, state: s.name, stateCode: s.code, district: null, districtCode: null, dataPoints: statePoints } },
          upsert: true
        }
      });
      priceDocs.push({ material: mat.material, region: s.code, state: s.name, stateCode: s.code, district: null, districtCode: null, unit: base.unit, priceINR: stateLatest.priceINR, source: "cpwd_seed", sourceURL: SOURCE_URL, scrapedAt: new Date(), isActive: true });

      // ── 3. Districts within each state ───────────────────────────────────
      for (const d of s.districts) {
        const distMult = districtMultiplier(d.code);
        const distPrice = Math.round(statePrice * distMult * 100) / 100;
        const distSeed = codeHash(`${d.code}:${mat.material}`);
        const distPoints = buildPriceHistory(distPrice, "cpwd_seed", distSeed);
        const distLatest = distPoints[distPoints.length - 1]!;

        historyOps.push({
          updateOne: {
            filter: { material: mat.material, region: d.code },
            update: { $set: { material: mat.material, region: d.code, state: s.name, stateCode: s.code, district: d.name, districtCode: d.code, dataPoints: distPoints } },
            upsert: true
          }
        });
        priceDocs.push({ material: mat.material, region: d.code, state: s.name, stateCode: s.code, district: d.name, districtCode: d.code, unit: base.unit, priceINR: distLatest.priceINR, source: "cpwd_seed", sourceURL: SOURCE_URL, scrapedAt: new Date(), isActive: true });
      }
    }

    logger.info(`[seed-all-states] material=${mat.material} ops_queued=${historyOps.length}`);
  }

  logger.info(`[seed-all-states] Writing ${priceDocs.length} price records and ${historyOps.length} history docs…`);

  // Deactivate existing active prices, then bulk-write
  await PriceModel.updateMany({ isActive: true }, { $set: { isActive: false } });

  const BATCH = 500;
  for (let i = 0; i < historyOps.length; i += BATCH) {
    await PriceHistoryModel.bulkWrite(historyOps.slice(i, i + BATCH), { ordered: false });
  }
  for (let i = 0; i < priceDocs.length; i += BATCH) {
    await PriceModel.insertMany(priceDocs.slice(i, i + BATCH), { ordered: false });
  }

  logger.info(
    `[seed-all-states] Done. histories=${historyOps.length} prices=${priceDocs.length} ` +
    `(1 national + ${INDIA_GEO.length} states + ${INDIA_GEO.reduce((n, s) => n + s.districts.length, 0)} districts) × ${MATERIALS.length} materials`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
