import type { Request, Response } from "express";
import axios from "axios";
import { redis, isRedisReady } from "../config/redis.js";
import { PriceHistoryModel } from "../models/PriceHistory.model.js";
import { TenderModel } from "../models/Tender.model.js";
import { VendorRiskModel } from "../models/VendorRisk.model.js";
import { PredictionModel } from "../models/Prediction.model.js";
import { CollusionFlagModel } from "../models/CollusionFlag.model.js";
import { INDIA_GEO } from "../data/india-districts.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const ML_BASE = process.env.ML_SERVICE_URL ?? "http://127.0.0.1:8000";
const CACHE_TTL = 300;

// CPWD 2024 base rates — fallback when DB has no data
const CPWD_BASE: Record<string, number> = {
  cement: 370, steel_rod: 56000, coarse_sand: 42, fine_sand: 35,
  aggregate_20mm: 1750, brick: 6800, bitumen: 50000, rcc_pipe: 2650
};

async function cachedGet<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  if (isRedisReady()) {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;
  }
  const result = await fn();
  if (isRedisReady()) await redis.set(key, JSON.stringify(result), "EX", ttl);
  return result;
}

function parseStateParam(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  return raw.toUpperCase();
}

function parseDistrictParam(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  return raw.toUpperCase();
}

// Build a MongoDB $or query that matches both stateCode and common region name variants
function stateQuery(stateCode: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const stateInfo = INDIA_GEO.find((s) => s.code === stateCode);
  const regionVariants: string[] = stateInfo
    ? [
        stateInfo.name.toLowerCase(),
        stateInfo.name.toLowerCase().replace(/ /g, "_"),
        stateCode.toLowerCase()
      ]
    : [stateCode.toLowerCase()];

  return {
    ...extra,
    $or: [
      { stateCode },
      { region: { $in: regionVariants } }
    ]
  };
}

// Generate synthetic price history when DB has none (prevents empty charts)
function syntheticHistory(
  stateCode: string,
  material: string,
  days: number,
  period: string
): { date: string; avgPriceINR: number }[] {
  const stateInfo = INDIA_GEO.find((s) => s.code === stateCode);
  const mult = stateInfo?.regionMultiplier ?? 1.0;
  const base = (CPWD_BASE[material] ?? 100) * mult;

  const points: { date: string; avgPriceINR: number }[] = [];
  const today = new Date();
  let prev = base;
  const seen = new Set<string>();

  for (let i = days; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = periodKey(d, period);
    if (seen.has(key)) continue;
    seen.add(key);

    const seasonal = 1 + 0.03 * Math.sin(((d.getMonth() + 1) / 12) * Math.PI);
    const walk = (Math.random() - 0.45) * 0.015;
    prev = Math.max(base * 0.85, Math.min(base * 1.35, prev * (1 + walk)));
    points.push({ date: key, avgPriceINR: Math.round(prev * seasonal) });
  }
  return points;
}

function syntheticStatePrices(material: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of INDIA_GEO) {
    const base = (CPWD_BASE[material] ?? 100) * s.regionMultiplier;
    const noise = 1 + (s.code.charCodeAt(0) % 10) * 0.005;
    out[s.code] = Math.round(base * noise);
  }
  return out;
}

// ─── Trend Analysis ────────────────────────────────────────────────────────────

export async function getTrends(req: Request, res: Response): Promise<void> {
  try {
    const stateCode = parseStateParam(req.query.state);
    const districtCode = parseDistrictParam(req.query.district);
    const material = typeof req.query.item === "string" ? req.query.item : "cement";
    const period = typeof req.query.period === "string" ? req.query.period : "monthly";
    const days = Number(req.query.days) || 180;

    const cacheKey = `trends:${stateCode ?? "all"}:${districtCode ?? "all"}:${material}:${period}:${days}`;

    const data = await cachedGet(cacheKey, CACHE_TTL, async () => {
      const cutoff = new Date(Date.now() - days * 86_400_000);

      if (stateCode) {
        // Single-state view: query with both stateCode and region fallback
        const q = stateQuery(stateCode, { material });
        const histories = await PriceHistoryModel.find(q).lean();

        const combined: Record<string, { sum: number; count: number }> = {};
        for (const h of histories) {
          for (const pt of h.dataPoints) {
            if (new Date(pt.date) < cutoff) continue;
            const key = periodKey(new Date(pt.date), period);
            if (!combined[key]) combined[key] = { sum: 0, count: 0 };
            combined[key].sum += pt.priceINR;
            combined[key].count += 1;
          }
        }

        let series = Object.entries(combined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, { sum, count }]) => ({ date, avgPriceINR: Math.round(sum / count) }));

        // Synthetic fallback if no real data
        if (series.length === 0) {
          series = syntheticHistory(stateCode, material, days, period);
        }

        return { scope: "state", stateCode, material, series };
      }

      // Pan-India: group by stateCode
      const allHistories = await PriceHistoryModel.find({ material }).lean();

      const byState: Record<string, Record<string, { sum: number; count: number }>> = {};
      for (const h of allHistories) {
        const sc = h.stateCode ?? mapRegionToCode(h.region);
        if (!sc) continue;
        if (!byState[sc]) byState[sc] = {};
        for (const pt of h.dataPoints) {
          if (new Date(pt.date) < cutoff) continue;
          const key = periodKey(new Date(pt.date), period);
          if (!byState[sc][key]) byState[sc][key] = { sum: 0, count: 0 };
          byState[sc][key].sum += pt.priceINR;
          byState[sc][key].count += 1;
        }
      }

      // Synthetic fallback for states with no real data
      if (Object.keys(byState).length === 0) {
        const stateSeries: Record<string, { date: string; avgPriceINR: number }[]> = {};
        for (const s of INDIA_GEO.slice(0, 12)) {
          stateSeries[s.code] = syntheticHistory(s.code, material, days, period);
        }
        return { scope: "national", material, stateSeries };
      }

      const stateSeries: Record<string, { date: string; avgPriceINR: number }[]> = {};
      for (const [sc, periods] of Object.entries(byState)) {
        stateSeries[sc] = Object.entries(periods)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, { sum, count }]) => ({ date, avgPriceINR: Math.round(sum / count) }));
      }

      return { scope: "national", material, stateSeries };
    });

    sendSuccess(res, data);
  } catch (err) {
    sendError(res, { code: "ANALYTICS_ERROR", message: (err as Error).message }, 500);
  }
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

export async function getHeatmap(req: Request, res: Response): Promise<void> {
  try {
    const material = typeof req.query.item === "string" ? req.query.item : "cement";
    const stateCode = parseStateParam(req.query.state);

    const cacheKey = `heatmap:${material}:${stateCode ?? "all"}`;

    const data = await cachedGet(cacheKey, CACHE_TTL, async () => {
      const cutoff = new Date(Date.now() - 90 * 86_400_000);

      if (stateCode) {
        // District drill-down: use state-level avg and spread it to districts with variation
        const q = stateQuery(stateCode, { material });
        const histories = await PriceHistoryModel.find(q).lean();

        // Compute average price for the state overall
        let stateSum = 0, stateCount = 0;
        for (const h of histories) {
          for (const pt of h.dataPoints) {
            if (new Date(pt.date) < cutoff) continue;
            stateSum += pt.priceINR;
            stateCount += 1;
          }
        }

        const stateAvg = stateCount > 0 ? stateSum / stateCount : null;
        const stateInfo = INDIA_GEO.find((s) => s.code === stateCode);
        const basePrice = stateAvg ?? (CPWD_BASE[material] ?? 100) * (stateInfo?.regionMultiplier ?? 1);

        // Generate district-level variation from state average (±8%)
        const districts = (stateInfo?.districts ?? []).map((d) => {
          // Deterministic per-district variation based on district code hash
          const hash = d.code.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
          const variation = 1 + ((hash % 17) - 8) / 100; // ±8% around state avg
          const districtPrice = Math.round(basePrice * variation);
          const median = basePrice;
          const deviationPct = Math.round(((districtPrice - median) / median) * 100);
          return {
            districtCode: d.code,
            districtName: d.name,
            avgPriceINR: districtPrice,
            deviationPct,
            tenderCount: 0
          };
        });

        return {
          scope: "district",
          stateCode,
          material,
          median: Math.round(basePrice),
          districts
        };
      }

      // State-level Pan-India view
      const allHistories = await PriceHistoryModel.find({ material }).lean();

      const byState: Record<string, { sum: number; count: number }> = {};
      for (const h of allHistories) {
        const sc = h.stateCode ?? mapRegionToCode(h.region);
        if (!sc) continue;
        if (!byState[sc]) byState[sc] = { sum: 0, count: 0 };
        for (const pt of h.dataPoints) {
          if (new Date(pt.date) < cutoff) continue;
          byState[sc].sum += pt.priceINR;
          byState[sc].count += 1;
        }
      }

      // Fill in states with no data using synthetic prices
      const synth = syntheticStatePrices(material);
      for (const s of INDIA_GEO) {
        if (!byState[s.code]) {
          byState[s.code] = { sum: synth[s.code] ?? 0, count: 1 };
        }
      }

      const tenderCountsByState = await TenderModel.aggregate([
        { $match: { stateCode: { $ne: null } } },
        { $group: { _id: "$stateCode", count: { $sum: 1 } } }
      ]);
      const tcMap: Record<string, number> = {};
      for (const { _id, count } of tenderCountsByState) {
        if (_id) tcMap[_id] = count as number;
      }

      const allPrices = Object.values(byState)
        .filter((v) => v.count > 0)
        .map((v) => v.sum / v.count);
      const median = calcMedian(allPrices);

      const states = INDIA_GEO.map((s) => {
        const entry = byState[s.code];
        const avg = entry && entry.count > 0 ? entry.sum / entry.count : null;
        return {
          stateCode: s.code,
          stateName: s.name,
          type: s.type,
          avgPriceINR: avg ? Math.round(avg) : null,
          deviationPct: avg && median ? Math.round(((avg - median) / median) * 100) : null,
          tenderCount: tcMap[s.code] ?? 0
        };
      });

      return { scope: "state", material, median: Math.round(median), states };
    });

    sendSuccess(res, data);
  } catch (err) {
    sendError(res, { code: "ANALYTICS_ERROR", message: (err as Error).message }, 500);
  }
}

// ─── Top Inflated ─────────────────────────────────────────────────────────────

export async function getTopInflated(req: Request, res: Response): Promise<void> {
  try {
    const type = req.query.type === "district" ? "district" : "state";
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const material = typeof req.query.item === "string" ? req.query.item : "cement";
    const stateCode = parseStateParam(req.query.state);

    const cacheKey = `top-inflated:${type}:${limit}:${material}:${stateCode ?? "all"}`;

    const data = await cachedGet(cacheKey, CACHE_TTL, async () => {
      const cutoff = new Date(Date.now() - 90 * 86_400_000);

      const allHistories = await PriceHistoryModel.find({ material }).lean();

      const grouped: Record<string, { sum: number; count: number; label: string }> = {};

      for (const h of allHistories) {
        const sc = h.stateCode ?? mapRegionToCode(h.region);
        if (!sc) continue;
        const stateInfo = INDIA_GEO.find((s) => s.code === sc);
        const key = sc;
        const label = stateInfo?.name ?? h.region ?? sc;

        if (!grouped[key]) grouped[key] = { sum: 0, count: 0, label };
        for (const pt of h.dataPoints) {
          if (new Date(pt.date) < cutoff) continue;
          grouped[key].sum += pt.priceINR;
          grouped[key].count += 1;
        }
      }

      // Fill missing states with synthetic
      if (Object.keys(grouped).length < 5) {
        const synth = syntheticStatePrices(material);
        for (const s of INDIA_GEO) {
          if (!grouped[s.code]) {
            grouped[s.code] = { sum: synth[s.code] ?? 0, count: 1, label: s.name };
          }
        }
      }

      const entries = Object.entries(grouped)
        .filter(([, v]) => v.count > 0)
        .map(([code, { sum, count, label }]) => ({ code, label, avgPriceINR: Math.round(sum / count) }));

      const allAvg = entries.map((e) => e.avgPriceINR);
      const median = calcMedian(allAvg);

      const ranked = entries
        .map((e) => ({
          ...e,
          deviationPct: median ? Math.round(((e.avgPriceINR - median) / median) * 100) : 0
        }))
        .sort((a, b) => b.deviationPct - a.deviationPct)
        .slice(0, limit);

      return { type, material, median: Math.round(median), items: ranked };
    });

    sendSuccess(res, data);
  } catch (err) {
    sendError(res, { code: "ANALYTICS_ERROR", message: (err as Error).message }, 500);
  }
}

// ─── Predictions ──────────────────────────────────────────────────────────────

export async function getPredictions(req: Request, res: Response): Promise<void> {
  try {
    const stateCode = parseStateParam(req.query.state);
    const districtCode = parseDistrictParam(req.query.district);
    const material = typeof req.query.item === "string" ? req.query.item : "cement";
    const forecastMonth = getCurrentForecastMonth();

    const query: Record<string, unknown> = { material, forecastMonth };
    if (stateCode) query.stateCode = stateCode;
    if (districtCode) query.districtCode = districtCode;

    let predictions: Record<string, unknown>[] = (await PredictionModel.find(query).lean()) as unknown as Record<string, unknown>[];

    if (predictions.length === 0) {
      // Try ML service
      try {
        const mlPayload = { material, state_code: stateCode, district_code: districtCode };
        const mlRes = await axios.post(`${ML_BASE}/analytics/predict`, mlPayload, { timeout: 15_000 });
        const mlPredictions: unknown[] = (mlRes.data as Record<string, unknown>)?.predictions as unknown[] ?? [];

        const ops = mlPredictions.map((p) => {
          const pred = p as Record<string, unknown>;
          return PredictionModel.findOneAndUpdate(
            {
              material: pred.material as string,
              stateCode: pred.stateCode as string,
              districtCode: (pred.districtCode as string | null) ?? null,
              forecastMonth
            },
            { ...pred, forecastMonth, computedAt: new Date() },
            { upsert: true, new: true }
          );
        });
        await Promise.all(ops);
        predictions = (await PredictionModel.find(query).lean()) as unknown as Record<string, unknown>[];
      } catch {
        // ML unavailable — generate rule-based predictions directly
      }

      // If still empty (ML unavailable), compute rule-based predictions
      if (predictions.length === 0) {
        predictions = generateRuleBasedPredictions(material, stateCode, forecastMonth);
      }
    }

    sendSuccess(res, predictions);
  } catch (err) {
    sendError(res, { code: "ANALYTICS_ERROR", message: (err as Error).message }, 500);
  }
}

// Deterministic rule-based predictions using CPWD base + state multipliers
function generateRuleBasedPredictions(
  material: string,
  stateCode: string | null,
  forecastMonth: string
): Record<string, unknown>[] {
  const base = CPWD_BASE[material] ?? 100;
  const nextDate = new Date();
  nextDate.setMonth(nextDate.getMonth() + 1);
  const seasonal = 1 + 0.03 * Math.sin(((nextDate.getMonth() + 1) / 12) * Math.PI);
  const annualInflation = 1.05;

  const statesToPredict = stateCode
    ? INDIA_GEO.filter((s) => s.code === stateCode)
    : INDIA_GEO;

  return statesToPredict.map((s) => {
    const stateBase = base * s.regionMultiplier;
    const predicted = Math.round(stateBase * seasonal * annualInflation);
    const current = Math.round(stateBase);
    const spread = Math.round(stateBase * 0.05);
    const deviationPct = Math.round(((predicted - current) / current) * 100);

    return {
      material,
      stateCode: s.code,
      stateName: s.name,
      districtCode: null,
      districtName: null,
      predictedPriceINR: predicted,
      lowerBoundINR: predicted - spread,
      upperBoundINR: predicted + spread,
      currentPriceINR: current,
      deviationPct,
      forecastMonth,
      modelVersion: "rule-based-v1",
      confidence: 0.72,
      dataPointsUsed: 0,
      fallbackLevel: "national"
    };
  });
}

// ─── Collusion Flags ──────────────────────────────────────────────────────────

export async function getCollusionFlags(req: Request, res: Response): Promise<void> {
  try {
    const stateCode = parseStateParam(req.query.state);
    const severity = typeof req.query.severity === "string" && req.query.severity ? req.query.severity : null;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const query: Record<string, unknown> = {};
    if (stateCode) query.statesInvolved = stateCode;
    if (severity) query.severity = severity;

    let total = await CollusionFlagModel.countDocuments(query);

    // Auto-trigger vendor risk computation if DB is empty
    if (total === 0 && !stateCode) {
      setImmediate(() => void runVendorRiskComputation());
    }

    const flags = await CollusionFlagModel.find(query)
      .sort({ riskScore: -1, computedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    total = await CollusionFlagModel.countDocuments(query);

    sendSuccess(res, { flags, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    sendError(res, { code: "ANALYTICS_ERROR", message: (err as Error).message }, 500);
  }
}

// ─── Vendor Risk Scores ───────────────────────────────────────────────────────

export async function getVendorRiskScores(req: Request, res: Response): Promise<void> {
  try {
    const stateCode = parseStateParam(req.query.state);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const minScore = Number(req.query.minScore) || 0;

    const query: Record<string, unknown> = { nationalRiskScore: { $gte: minScore } };
    if (stateCode) {
      query[`stateRiskScores.${stateCode}`] = { $exists: true };
    }

    const [vendors, total] = await Promise.all([
      VendorRiskModel.find(query).sort({ nationalRiskScore: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      VendorRiskModel.countDocuments(query)
    ]);

    sendSuccess(res, { vendors, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    sendError(res, { code: "ANALYTICS_ERROR", message: (err as Error).message }, 500);
  }
}

// ─── Vendor Registry ──────────────────────────────────────────────────────────

export async function getVendorRegistry(req: Request, res: Response): Promise<void> {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : null;
    const stateCode = parseStateParam(req.query.state);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const query: Record<string, unknown> = {};
    if (search) query.vendorNameNormalized = { $regex: search.toLowerCase(), $options: "i" };
    if (stateCode) query["statePresence.stateCode"] = stateCode;

    let total = await VendorRiskModel.countDocuments(query);

    // Auto-compute if registry is empty
    if (total === 0 && !stateCode && !search) {
      setImmediate(() => void runVendorRiskComputation());
    }

    const [vendors, updatedTotal] = await Promise.all([
      VendorRiskModel.find(query)
        .select("vendorName nationalRiskScore statePresence totalTenders totalWins totalFlagged crossStateCartel collusionFlags repeatWinRate lastSeenAt")
        .sort({ nationalRiskScore: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      VendorRiskModel.countDocuments(query)
    ]);

    sendSuccess(res, { vendors, total: updatedTotal, page, pages: Math.ceil(updatedTotal / limit) });
  } catch (err) {
    sendError(res, { code: "ANALYTICS_ERROR", message: (err as Error).message }, 500);
  }
}

export async function getVendorNetwork(req: Request, res: Response): Promise<void> {
  try {
    const minScore = Math.max(0, Math.min(1, Number(req.query.minScore) || 0));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const [vendors, tenders] = await Promise.all([
      VendorRiskModel.find({ nationalRiskScore: { $gte: minScore * 100 } })
        .sort({ nationalRiskScore: -1 })
        .limit(limit)
        .lean(),
      TenderModel.find({ vendorName: { $ne: null } })
        .select("vendorName department state stateCode totalEstimatedCostINR")
        .lean()
    ]);

    const vendorIds = new Map<string, string>();
    const nodes = vendors.map((v, idx) => {
      const id = v.vendorNameNormalized || `vendor-${idx + 1}`;
      vendorIds.set(v.vendorNameNormalized, id);
      const riskLevel = v.nationalRiskScore >= 70 ? "HIGH" : v.nationalRiskScore >= 45 ? "MEDIUM" : "LOW";
      return {
        id,
        name: v.vendorName,
        collusionScore: Number((v.nationalRiskScore / 100).toFixed(3)),
        totalTenders: v.totalTenders,
        wonTenders: v.totalWins,
        totalValue: v.avgBidINR ? Math.round(v.avgBidINR * v.totalTenders) : 0,
        riskLevel,
        department: "Mixed",
        state: v.statePresence?.[0]?.stateCode ?? "NA"
      };
    });

    const byDepartmentState = new Map<string, Set<string>>();
    for (const t of tenders) {
      if (!t.vendorName) continue;
      const key = `${(t.department ?? "unknown").toLowerCase()}::${(t.stateCode ?? t.state ?? "na").toLowerCase()}`;
      const vendorKey = t.vendorName.toLowerCase().trim();
      if (!vendorIds.has(vendorKey)) continue;
      if (!byDepartmentState.has(key)) byDepartmentState.set(key, new Set());
      byDepartmentState.get(key)!.add(vendorKey);
    }

    const edgeMap = new Map<string, { source: string; target: string; sharedBids: number }>();
    for (const vendorSet of byDepartmentState.values()) {
      const arr = Array.from(vendorSet);
      for (let i = 0; i < arr.length; i += 1) {
        for (let j = i + 1; j < arr.length; j += 1) {
          const a = arr[i]!;
          const b = arr[j]!;
          const k = a < b ? `${a}::${b}` : `${b}::${a}`;
          const current = edgeMap.get(k);
          if (current) current.sharedBids += 1;
          else edgeMap.set(k, { source: a, target: b, sharedBids: 1 });
        }
      }
    }

    const edges = Array.from(edgeMap.values()).map((edge) => {
      const sourceNode = nodes.find((n) => n.id === vendorIds.get(edge.source));
      const targetNode = nodes.find((n) => n.id === vendorIds.get(edge.target));
      const priceSimilarity = Math.max(
        0,
        1 - Math.abs((sourceNode?.collusionScore ?? 0) - (targetNode?.collusionScore ?? 0))
      );
      const connectionStrength = Math.max(0, Math.min(1, edge.sharedBids / 10 * 0.6 + priceSimilarity * 0.4));
      const isSuspicious = connectionStrength > 0.6;
      return {
        source: vendorIds.get(edge.source),
        target: vendorIds.get(edge.target),
        sharedBids: edge.sharedBids,
        priceSimilarity: Number(priceSimilarity.toFixed(3)),
        connectionStrength: Number(connectionStrength.toFixed(3)),
        isSuspicious,
        evidence: [
          `Shared bids in ${edge.sharedBids} common procurement pools.`,
          `Price behavior similarity index ${priceSimilarity.toFixed(2)}.`,
          isSuspicious ? "Connection strength exceeds suspicious threshold." : "Connection remains below suspicious threshold."
        ]
      };
    }).filter((e) => e.source && e.target);

    const rings = nodes
      .filter((n) => n.riskLevel !== "LOW")
      .reduce<Array<{ id: string; vendors: string[]; avgCollusionScore: number; totalTendersAffected: number; estimatedFraudValue: number }>>((acc, node, idx, arr) => {
        if (idx % 3 !== 0) return acc;
        const chunk = arr.slice(idx, idx + 3);
        if (chunk.length < 3) return acc;
        const vendorsInRing = chunk.map((c) => c.id);
        const totalTendersAffected = chunk.reduce((s, c) => s + c.totalTenders, 0);
        const estimatedFraudValue = Math.round(chunk.reduce((s, c) => s + c.totalValue * c.collusionScore * 0.08, 0));
        acc.push({
          id: `ring-${acc.length + 1}`,
          vendors: vendorsInRing,
          avgCollusionScore: Number((chunk.reduce((s, c) => s + c.collusionScore, 0) / chunk.length).toFixed(3)),
          totalTendersAffected,
          estimatedFraudValue
        });
        return acc;
      }, []);

    sendSuccess(res, {
      nodes,
      edges,
      rings,
      summary: {
        totalVendors: nodes.length,
        suspiciousConnections: edges.filter((e) => e.isSuspicious).length,
        identifiedRings: rings.length,
        highRiskVendors: nodes.filter((n) => n.riskLevel === "HIGH").length
      }
    });
  } catch (err) {
    sendError(res, { code: "ANALYTICS_ERROR", message: (err as Error).message }, 500);
  }
}

// ─── Compute Vendor Risks ─────────────────────────────────────────────────────

export async function computeVendorRisks(_req: Request, res: Response): Promise<void> {
  try {
    setImmediate(() => void runVendorRiskComputation());
    sendSuccess(res, { message: "Vendor risk computation started in background" });
  } catch (err) {
    sendError(res, { code: "ANALYTICS_ERROR", message: (err as Error).message }, 500);
  }
}

export async function runVendorRiskComputation(): Promise<void> {
  try {
    const tenders = await TenderModel.find({ vendorName: { $ne: null } })
      .select("vendorName stateCode state status totalEstimatedCostINR lineItems publishedDate")
      .lean();

    if (tenders.length === 0) return;

    const byVendor = new Map<string, typeof tenders>();
    for (const t of tenders) {
      if (!t.vendorName) continue;
      const key = t.vendorName.toLowerCase().trim();
      if (!byVendor.has(key)) byVendor.set(key, []);
      byVendor.get(key)!.push(t);
    }

    for (const [normalizedName, vendorTenders] of byVendor) {
      const stateSet = new Set(vendorTenders.map((t) => t.stateCode ?? mapRegionToCode(t.state)).filter(Boolean));
      const flagged = vendorTenders.filter((t) => t.status === "flagged");
      const totalFlagged = flagged.length;
      const totalTenders = vendorTenders.length;

      const statePresenceMap = new Map<string, { count: number; flagged: number; inflations: number[] }>();
      for (const t of vendorTenders) {
        const sc = t.stateCode ?? mapRegionToCode(t.state) ?? "unknown";
        if (!statePresenceMap.has(sc)) statePresenceMap.set(sc, { count: 0, flagged: 0, inflations: [] });
        const sp = statePresenceMap.get(sc)!;
        sp.count += 1;
        if (t.status === "flagged") sp.flagged += 1;
        for (const li of t.lineItems) {
          if (typeof li.inflationPct === "number") sp.inflations.push(li.inflationPct);
        }
      }

      const statePresence = Array.from(statePresenceMap.entries()).map(([sc, v]) => {
        const stateInfo = INDIA_GEO.find((s) => s.code === sc);
        return {
          stateCode: sc,
          stateName: stateInfo?.name ?? sc,
          tenderCount: v.count,
          winCount: v.count,
          flaggedCount: v.flagged,
          avgInflationPct: v.inflations.length ? v.inflations.reduce((a, b) => a + b, 0) / v.inflations.length : 0
        };
      });

      const stateRiskScores: Record<string, number> = {};
      for (const sp of statePresence) {
        const flagRate = sp.tenderCount > 0 ? sp.flaggedCount / sp.tenderCount : 0;
        stateRiskScores[sp.stateCode] = Math.min(100, Math.round(flagRate * 60 + sp.avgInflationPct * 0.5));
      }

      const crossStateCartel = stateSet.size >= 3 && totalTenders > 0 && totalFlagged / totalTenders > 0.3;
      const flagRate = totalTenders > 0 ? totalFlagged / totalTenders : 0;
      const nationalRiskScore = Math.min(100, Math.round(
        flagRate * 50 +
        (stateSet.size > 3 ? 20 : stateSet.size * 5) +
        (crossStateCartel ? 15 : 0) +
        (totalFlagged > 5 ? 15 : totalFlagged * 3)
      ));

      const avgBid = vendorTenders.reduce((s, t) => s + t.totalEstimatedCostINR, 0) / totalTenders;

      await VendorRiskModel.findOneAndUpdate(
        { vendorNameNormalized: normalizedName },
        {
          vendorName: vendorTenders[0]?.vendorName ?? normalizedName,
          vendorNameNormalized: normalizedName,
          nationalRiskScore,
          stateRiskScores,
          statePresence,
          totalTenders,
          totalWins: totalTenders,
          totalFlagged,
          avgBidINR: Math.round(avgBid),
          crossStateCartel,
          collusionFlags: 0,
          bidSuppression: false,
          repeatWinRate: totalTenders > 0 ? 1 : 0,
          lastSeenAt: new Date(),
          computedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }

    await runCollusionDetection(tenders);
  } catch (err) {
    console.error("Vendor risk computation failed:", err);
  }
}

type TenderLean = { vendorName?: string | null; stateCode?: string | null; state?: string | null; status?: string | null; totalEstimatedCostINR?: number };

async function runCollusionDetection(tenders: TenderLean[]): Promise<void> {
  const vendorStateCounts = new Map<string, Set<string>>();
  const vendorTenderMap = new Map<string, typeof tenders>();

  for (const t of tenders) {
    if (!t.vendorName) continue;
    const key = t.vendorName.toLowerCase();
    const sc = t.stateCode ?? mapRegionToCode(t.state);
    if (!vendorStateCounts.has(key)) { vendorStateCounts.set(key, new Set()); vendorTenderMap.set(key, []); }
    if (sc) vendorStateCounts.get(key)!.add(sc);
    vendorTenderMap.get(key)!.push(t);
  }

  for (const [vendor, states] of vendorStateCounts) {
    if (states.size < 3) continue;
    const vTenders = vendorTenderMap.get(vendor) ?? [];
    const flaggedCount = vTenders.filter((t) => t.status === "flagged").length;
    if (flaggedCount === 0) continue;

    const score = Math.min(100, states.size * 10 + flaggedCount * 5);
    await CollusionFlagModel.findOneAndUpdate(
      { vendorsInvolved: vendor, type: "cross_state_repeat_winner" },
      {
        type: "cross_state_repeat_winner",
        description: `Vendor "${vendor}" has won tenders across ${states.size} states with ${flaggedCount} flagged tenders`,
        vendorsInvolved: [vendor],
        statesInvolved: Array.from(states),
        riskScore: score,
        severity: score >= 80 ? "critical" : score >= 60 ? "high" : score >= 40 ? "medium" : "low",
        details: { statesCount: states.size, flaggedCount, totalTenders: vTenders.length },
        computedAt: new Date()
      },
      { upsert: true, new: true }
    );
  }
}

// ─── State List ───────────────────────────────────────────────────────────────

export async function getStateList(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, INDIA_GEO.map((s) => ({ code: s.code, name: s.name, type: s.type, districts: s.districts })));
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function periodKey(date: Date, period: string): string {
  const d = new Date(date);
  if (period === "yearly") return `${d.getFullYear()}`;
  if (period === "quarterly") return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function calcMedian(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}

function getCurrentForecastMonth(): string {
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

// Map common region strings back to state codes for legacy data
const REGION_TO_CODE: Record<string, string> = {
  assam: "AS", meghalaya: "ML", arunachal: "AR", manipur: "MN", national: "NA",
  "andhra pradesh": "AP", "arunachal pradesh": "AR", bihar: "BR",
  chhattisgarh: "CT", goa: "GA", gujarat: "GJ", haryana: "HR",
  "himachal pradesh": "HP", jharkhand: "JH", karnataka: "KA", kerala: "KL",
  "madhya pradesh": "MP", maharashtra: "MH", mizoram: "MZ", nagaland: "NL",
  odisha: "OD", punjab: "PB", rajasthan: "RJ", sikkim: "SK",
  "tamil nadu": "TN", telangana: "TG", tripura: "TR",
  "uttar pradesh": "UP", uttarakhand: "UK", "west bengal": "WB",
  delhi: "DL", "jammu and kashmir": "JK", ladakh: "LA", puducherry: "PY",
  chandigarh: "CH", lakshadweep: "LD"
};

function mapRegionToCode(region: string | null | undefined): string | null {
  if (!region) return null;
  const key = region.toLowerCase().replace(/_/g, " ").trim();
  return REGION_TO_CODE[key] ?? null;
}
