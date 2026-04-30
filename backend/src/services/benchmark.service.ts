import { cacheTtlSeconds, isRedisReady, redis } from "../config/redis.js";
import { BenchmarkModel } from "../models/Benchmark.model.js";
import { PriceModel } from "../models/Price.model.js";
import { CPWD_2024_BASE_RATES, logger } from "./scrapers/shared.js";

type MaterialSource = "db" | "national_fallback" | "cpwd_fallback";

type MaterialRate = {
  material: string;
  rateINR: number;
  unit: string;
  source: MaterialSource;
  resolvedRegion: string;
};

type BenchmarkInput = {
  projectType: string;
  region: string;
  lengthKm: number;
  year?: number;
};

export type BenchmarkResult = {
  projectType: string;
  region: string;
  lengthKm: number;
  estimatedCostINR: number;
  costPerKmINR: number;
  breakdown: {
    rawMaterials: number;
    labourAndEquipment: number;
    contractorProfit: number;
    contingency: number;
    gst: number;
  };
  materialBreakdown: Array<{
    material: string;
    quantity: number;
    unit: string;
    rateINR: number;
    totalINR: number;
    source: MaterialSource;
  }>;
  confidence: number;
  comparableProjects: Array<{
    name: string;
    costINR: number;
    costPerKmINR: number | null;
    year: number;
    source: "worldbank";
  }>;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const normalizeProjectType = (input: string): "road" | "bridge" | "building" | "drainage" | "other" => {
  const value = input.trim().toLowerCase();
  if (value === "road") return "road";
  if (value === "bridge") return "bridge";
  if (value === "building") return "building";
  if (value === "drainage") return "drainage";
  return "other";
};

const requiredMaterialsForType = (projectType: string): string[] => {
  const type = normalizeProjectType(projectType);
  if (type === "road") {
    return ["aggregate_20mm", "bitumen", "cement", "steel_rod", "fine_sand", "coarse_sand", "brick"];
  }
  if (type === "bridge") {
    return ["cement", "steel_rod", "aggregate_20mm", "coarse_sand"];
  }
  if (type === "building") {
    return ["cement", "steel_rod", "brick", "fine_sand", "coarse_sand"];
  }
  if (type === "drainage") {
    return ["rcc_pipe", "cement", "aggregate_20mm", "coarse_sand"];
  }
  return ["aggregate_20mm", "cement", "steel_rod"];
};

const resolveCpwdRate = (material: string): { rateINR: number; unit: string } => {
  const base = CPWD_2024_BASE_RATES[material];
  if (base) {
    return { rateINR: base.priceINR, unit: base.unit };
  }
  return { rateINR: 1, unit: "unit" };
};

const isDatabaseReady = (): boolean => PriceModel.db.readyState === 1;

const resolveMaterialRate = async (material: string, region: string): Promise<MaterialRate> => {
  if (isDatabaseReady()) {
    try {
      const scoped = await PriceModel.findOne({ material, region, isActive: true }).sort({ scrapedAt: -1 }).lean();
      if (scoped) {
        return { material, rateINR: Number(scoped.priceINR), unit: String(scoped.unit), source: "db", resolvedRegion: region };
      }
    } catch (error) {
      logger.warn(`[BENCHMARK] price_lookup_failed material=${material} region=${region} error=${String(error)}`);
    }
  }

  if (isDatabaseReady()) {
    try {
      const national = await PriceModel.findOne({ material, region: "national", isActive: true }).sort({ scrapedAt: -1 }).lean();
      if (national) {
        return {
          material,
          rateINR: Number(national.priceINR),
          unit: String(national.unit),
          source: "national_fallback",
          resolvedRegion: "national"
        };
      }
    } catch (error) {
      logger.warn(`[BENCHMARK] national_price_lookup_failed material=${material} error=${String(error)}`);
    }
  }
  const fallback = resolveCpwdRate(material);
  return { material, rateINR: fallback.rateINR, unit: fallback.unit, source: "cpwd_fallback", resolvedRegion: "national" };
};

type QuantityRow = { material: string; quantity: number; unit: string };

const roadPerKmQuantities = (): QuantityRow[] => [
  { material: "aggregate_20mm", quantity: 1200, unit: "cum" },
  { material: "aggregate_20mm", quantity: 380, unit: "tonne" },
  { material: "aggregate_20mm", quantity: 320, unit: "tonne" },
  { material: "bitumen", quantity: 42, unit: "tonne" },
  { material: "cement", quantity: 65 * 7, unit: "bag" },
  { material: "steel_rod", quantity: 8, unit: "tonne" },
  { material: "fine_sand", quantity: 280, unit: "cft" },
  { material: "coarse_sand", quantity: 180, unit: "cft" },
  { material: "brick", quantity: 4000 / 1000, unit: "per_1000" }
];

const bridgePerMetreQuantities = (): QuantityRow[] => [
  { material: "cement", quantity: 180 * 7, unit: "bag" },
  { material: "steel_rod", quantity: 85, unit: "tonne" },
  { material: "aggregate_20mm", quantity: 200, unit: "tonne" },
  { material: "coarse_sand", quantity: 300, unit: "cft" }
];

const buildingPerSqmQuantities = (): QuantityRow[] => [
  { material: "cement", quantity: 12, unit: "bag" },
  { material: "steel_rod", quantity: 0.08, unit: "tonne" },
  { material: "brick", quantity: 800 / 1000, unit: "per_1000" },
  { material: "fine_sand", quantity: 25, unit: "cft" },
  { material: "coarse_sand", quantity: 18, unit: "cft" }
];

const drainagePerKmQuantities = (): QuantityRow[] => [
  { material: "rcc_pipe", quantity: 1000, unit: "metre" },
  { material: "cement", quantity: 2000, unit: "bag" },
  { material: "aggregate_20mm", quantity: 800, unit: "tonne" },
  { material: "coarse_sand", quantity: 500, unit: "cft" }
];

const computeTotals = (rows: Array<{ rate: MaterialRate; qty: QuantityRow }>): Array<{
  material: string;
  quantity: number;
  unit: string;
  rateINR: number;
  totalINR: number;
  source: MaterialSource;
}> => {
  return rows.map(({ rate, qty }) => ({
    material: rate.material,
    quantity: qty.quantity,
    unit: qty.unit,
    rateINR: rate.rateINR,
    totalINR: qty.quantity * rate.rateINR,
    source: rate.source
  }));
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const benchmarkService = {
  async estimate(params: BenchmarkInput): Promise<BenchmarkResult> {
    const projectType = normalizeProjectType(params.projectType);
    const region = params.region.trim() || "national";
    const lengthKm = Number.isFinite(params.lengthKm) && params.lengthKm > 0 ? params.lengthKm : 1;
    const year = Number.isFinite(params.year) && (params.year ?? 0) > 1970 ? (params.year as number) : new Date().getFullYear();

    const cacheKey = `benchmark:v2:${projectType}:${region}:${lengthKm}:${year}`;
    if (isRedisReady()) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached) as BenchmarkResult;
        }
      } catch (error) {
        logger.warn(`[BENCHMARK] cache_read_failed key=${cacheKey} error=${String(error)}`);
      }
    }

    const requiredMaterials = requiredMaterialsForType(projectType);
    const materialRates = await Promise.all(requiredMaterials.map((material) => resolveMaterialRate(material, region)));

    const dbMaterialCount = materialRates.filter((rate) => rate.source === "db").length;
    const hasRegionSpecific = materialRates.some((rate) => rate.source === "db" && rate.resolvedRegion === region);

    let quantityPlan: QuantityRow[] = [];
    let scaleMultiplier = 1;
    let complexityFactor = 1;
    let perUnitLabel: "per_km" | "per_metre" | "per_sqm" = "per_km";

    if (projectType === "road") {
      quantityPlan = roadPerKmQuantities();
      scaleMultiplier = lengthKm;
      perUnitLabel = "per_km";
    } else if (projectType === "drainage") {
      quantityPlan = drainagePerKmQuantities();
      scaleMultiplier = lengthKm;
      perUnitLabel = "per_km";
    } else if (projectType === "bridge") {
      quantityPlan = bridgePerMetreQuantities();
      scaleMultiplier = lengthKm * 1000;
      complexityFactor = 1.4;
      perUnitLabel = "per_metre";
    } else if (projectType === "building") {
      quantityPlan = buildingPerSqmQuantities();
      scaleMultiplier = lengthKm * 1000;
      perUnitLabel = "per_sqm";
    } else {
      quantityPlan = roadPerKmQuantities();
      scaleMultiplier = lengthKm;
      perUnitLabel = "per_km";
    }

    const rateByMaterial = new Map(materialRates.map((rate) => [rate.material, rate]));
    const rows = quantityPlan
      .map((qty) => ({ qty, rate: rateByMaterial.get(qty.material) }))
      .filter((row): row is { qty: QuantityRow; rate: MaterialRate } => Boolean(row.rate));

    const materialBreakdownBase = computeTotals(rows);
    const rawMaterialsBase = materialBreakdownBase.reduce((sum, item) => sum + item.totalINR, 0);
    const rawMaterials = rawMaterialsBase * scaleMultiplier * complexityFactor;

    const labourAndEquipment = rawMaterials * 0.45;
    const contractorProfit = (rawMaterials + labourAndEquipment) * 0.12;
    const subtotal = rawMaterials + labourAndEquipment + contractorProfit;
    const contingency = subtotal * 0.05;
    const subtotal2 = subtotal + contingency;
    const gst = subtotal2 * 0.18;
    const estimatedCostINR = rawMaterials + labourAndEquipment + contractorProfit + contingency + gst;

    const costPerKmINR = estimatedCostINR / lengthKm;

    let comparableRows: Array<{
      projectName: string;
      totalCostINR: number;
      costPerKmINR: number | null;
      approvalYear: number;
    }> = [];
    if (isDatabaseReady()) {
      try {
        comparableRows = await BenchmarkModel.find({
          projectType,
          $or: [{ region }, { region: "national" }]
        })
          .sort({ approvalYear: -1 })
          .limit(3)
          .lean();
      } catch (error) {
        logger.warn(`[BENCHMARK] comparable_lookup_failed type=${projectType} region=${region} error=${String(error)}`);
      }
    }

    const comparableProjects = comparableRows.map((row) => ({
      name: String(row.projectName),
      costINR: Number(row.totalCostINR),
      costPerKmINR: row.costPerKmINR === null ? null : Number(row.costPerKmINR),
      year: Number(row.approvalYear),
      source: "worldbank" as const
    }));

    let confidence = 0.65;
    if (dbMaterialCount >= 6) confidence += 0.15;
    if (hasRegionSpecific) confidence += 0.1;
    if (comparableProjects.length > 0) confidence += 0.05;
    confidence = clamp(confidence, 0.5, 0.95);

    const materialBreakdown = materialBreakdownBase.map((item) => ({
      ...item,
      totalINR: item.totalINR * scaleMultiplier * complexityFactor
    }));

    const result: BenchmarkResult = {
      projectType,
      region,
      lengthKm,
      estimatedCostINR: round2(estimatedCostINR),
      costPerKmINR: round2(costPerKmINR),
      breakdown: {
        rawMaterials: round2(rawMaterials),
        labourAndEquipment: round2(labourAndEquipment),
        contractorProfit: round2(contractorProfit),
        contingency: round2(contingency),
        gst: round2(gst)
      },
      materialBreakdown: materialBreakdown.map((row) => ({
        ...row,
        rateINR: round2(row.rateINR),
        totalINR: round2(row.totalINR)
      })),
      confidence: round2(confidence),
      comparableProjects
    };

    if (isRedisReady()) {
      try {
        await redis.set(cacheKey, JSON.stringify(result), "EX", cacheTtlSeconds.benchmark);
      } catch (error) {
        logger.warn(`[BENCHMARK] cache_write_failed key=${cacheKey} error=${String(error)}`);
      }
    }

    logger.info(
      `[BENCHMARK] estimate_done type=${projectType} region=${region} lengthKm=${lengthKm} perUnit=${perUnitLabel} confidence=${result.confidence}`
    );
    return result;
  }
};
