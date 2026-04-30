import { Request, Response } from "express";
import { cacheTtlSeconds, redis } from "../config/redis.js";
import { PriceHistoryModel } from "../models/PriceHistory.model.js";
import { PriceModel } from "../models/Price.model.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";

type PriceResponseRow = {
  _id: string;
  material: string;
  unit: string;
  priceINR: number;
  source: string;
  region: string;
  scrapedAt: string;
  isActive: boolean;
};

export const getPrices = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const material = (req.query.material as string | undefined) ?? "";
    const region = (req.query.region as string | undefined) ?? "";
    const limitRaw = Number(req.query.limit ?? 200);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.trunc(limitRaw))) : 200;

    const cacheKey = `prices:v2:${material}:${region}:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { data: PriceResponseRow[]; meta: { total: number } };
      return res.status(200).json({ success: true, data: parsed.data, meta: parsed.meta });
    }

    const baseQuery: Record<string, unknown> = { isActive: true };
    if (material.length > 0) {
      baseQuery.material = material;
    }

    const queryWithRegion = region.length > 0 ? { ...baseQuery, region } : baseQuery;
    let rows = await PriceModel.find(queryWithRegion).sort({ scrapedAt: -1 }).limit(limit).lean();

    if (region.length > 0 && rows.length === 0) {
      rows = await PriceModel.find({ ...baseQuery, region: "national" }).sort({ scrapedAt: -1 }).limit(limit).lean();
    }

    const data: PriceResponseRow[] = rows.map((row) => ({
      _id: row._id.toString(),
      material: String(row.material),
      unit: String(row.unit),
      priceINR: Number(row.priceINR),
      source: String(row.source),
      region: String(row.region),
      scrapedAt: new Date(row.scrapedAt).toISOString(),
      isActive: Boolean(row.isActive)
    }));

    const payload = { data, meta: { total: data.length } };
    await redis.set(cacheKey, JSON.stringify(payload), "EX", cacheTtlSeconds.prices);
    return res.status(200).json({ success: true, data: payload.data, meta: payload.meta });
  } catch {
    return sendError(res, { code: "PRICES_FETCH_FAILED", message: "Unable to fetch prices" }, 500);
  }
};

export const getPriceHistory = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const material = req.params.material;
    const region = (req.query.region as string | undefined) ?? "national";
    const districtCode = (req.query.districtCode as string | undefined) ?? "";
    const daysRaw = Number(req.query.days ?? 90);
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, Math.trunc(daysRaw))) : 90;

    type HistDoc = { dataPoints: Array<{ date: Date; priceINR: number; source: string }> } | null;

    const lookup = async (key: string): Promise<HistDoc> =>
      PriceHistoryModel.findOne({ material, region: key }).lean<HistDoc>();

    let history: HistDoc = districtCode ? await lookup(districtCode) : null;
    if (!history || history.dataPoints.length === 0) history = await lookup(region);
    if (!history || history.dataPoints.length === 0) {
      history = await PriceHistoryModel.findOne({ material, stateCode: region }).lean<HistDoc>();
    }
    if (!history || history.dataPoints.length === 0) history = await lookup("national");

    const sorted = [...(history?.dataPoints ?? [])]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const sliced = sorted.length > days ? sorted.slice(sorted.length - days) : sorted;

    return res.status(200).json({
      success: true,
      data: {
        material,
        region: districtCode || region,
        dataPoints: sliced.map((point) => ({
          date: new Date(point.date).toISOString(),
          priceINR: Number(point.priceINR),
          source: String(point.source)
        }))
      }
    });
  } catch {
    return sendError(res, { code: "PRICE_HISTORY_FAILED", message: "Unable to fetch history" }, 500);
  }
};

export const createManualPrice = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const row = await PriceModel.create({ ...req.body, scrapedAt: new Date(), isActive: true });
    return sendSuccess(res, row, 201);
  } catch {
    return sendError(res, { code: "PRICE_CREATE_FAILED", message: "Unable to create manual price" }, 500);
  }
};
