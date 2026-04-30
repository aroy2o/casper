import { PriceHistoryModel } from "../../models/PriceHistory.model.js";
import { PriceModel } from "../../models/Price.model.js";
import { INDIA_GEO } from "../../data/india-districts.js";

// Legacy region strings kept for backward-compat reads; new writes use stateCode as region key
export const REGIONS = ["assam", "meghalaya", "arunachal", "manipur", "national"] as const;
export type Region = (typeof REGIONS)[number];

export const CPWD_2024_BASE_RATES: Record<string, { priceINR: number; unit: string }> = {
  cement: { priceINR: 370, unit: "per_bag_50kg" },
  steel_rod: { priceINR: 56000, unit: "per_tonne" },
  coarse_sand: { priceINR: 42, unit: "per_cft" },
  fine_sand: { priceINR: 35, unit: "per_cft" },
  aggregate_20mm: { priceINR: 1750, unit: "per_tonne" },
  brick: { priceINR: 6800, unit: "per_1000" },
  bitumen: { priceINR: 50000, unit: "per_tonne" },
  rcc_pipe: { priceINR: 2650, unit: "per_metre" }
};

export const MATERIALS = [
  { query: "cement opc 53 grade", material: "cement", unit: "per_bag_50kg" },
  { query: "tmt steel fe500", material: "steel_rod", unit: "per_tonne" },
  { query: "coarse sand construction", material: "coarse_sand", unit: "per_cft" },
  { query: "fine river sand", material: "fine_sand", unit: "per_cft" },
  { query: "aggregate 20mm stone", material: "aggregate_20mm", unit: "per_tonne" },
  { query: "modular brick red", material: "brick", unit: "per_1000" },
  { query: "bitumen vg30", material: "bitumen", unit: "per_tonne" },
  { query: "rcc pipe np3 600mm", material: "rcc_pipe", unit: "per_metre" }
] as const;

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

const isoNow = (): string => new Date().toISOString();

export const logger: Logger = {
  info: (message) => {
    process.stdout.write(`${isoNow()} INFO ${message}\n`);
  },
  warn: (message) => {
    process.stderr.write(`${isoNow()} WARN ${message}\n`);
  },
  error: (message) => {
    process.stderr.write(`${isoNow()} ERROR ${message}\n`);
  }
};

export function parsePrice(raw: string): number | null {
  const normalized = raw.replace(/₹|rs\\.?/gi, "").replace(/,/g, "").trim();
  const range = normalized.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    return Number.isFinite(low) && Number.isFinite(high) ? (low + high) / 2 : null;
  }
  const single = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!single) return null;
  const price = Number(single[1]);
  return Number.isFinite(price) ? price : null;
}

// City/alias overrides not derivable from state names
const CITY_TO_STATE: Array<{ keywords: string[]; code: string }> = [
  { keywords: ["delhi", "new delhi", "ndmc"], code: "DL" },
  { keywords: ["mumbai", "pune", "nagpur", "thane", "nashik", "aurangabad", "solapur"], code: "MH" },
  { keywords: ["bangalore", "bengaluru", "mysore", "hubli", "mangalore", "belagavi"], code: "KA" },
  { keywords: ["chennai", "coimbatore", "madurai", "tiruchirappalli", "salem", "vellore"], code: "TN" },
  { keywords: ["hyderabad", "warangal", "nizamabad", "khammam", "karimnagar"], code: "TG" },
  { keywords: ["kolkata", "howrah", "durgapur", "asansol", "siliguri", "bardhaman"], code: "WB" },
  { keywords: ["ahmedabad", "surat", "vadodara", "rajkot", "gandhinagar", "bhavnagar"], code: "GJ" },
  { keywords: ["jaipur", "jodhpur", "udaipur", "kota", "ajmer", "bikaner"], code: "RJ" },
  { keywords: ["lucknow", "kanpur", "agra", "varanasi", "allahabad", "prayagraj", "meerut", "noida", "ghaziabad"], code: "UP" },
  { keywords: ["bhopal", "indore", "jabalpur", "gwalior", "ujjain", "rewa"], code: "MP" },
  { keywords: ["patna", "gaya", "muzaffarpur", "bhagalpur", "darbhanga", "purnia"], code: "BR" },
  { keywords: ["bhubaneswar", "cuttack", "rourkela", "berhampur", "sambalpur"], code: "OD" },
  { keywords: ["chandigarh"], code: "CH" },
  { keywords: ["panaji", "margao", "vasco", "mapusa", "ponda"], code: "GA" },
  { keywords: ["shimla", "manali", "dharamsala", "solan"], code: "HP" },
  { keywords: ["dehradun", "haridwar", "roorkee", "rishikesh"], code: "UK" },
  { keywords: ["ranchi", "jamshedpur", "dhanbad", "bokaro", "hazaribagh"], code: "JH" },
  { keywords: ["raipur", "bilaspur", "durg", "bhilai", "korba"], code: "CT" },
  { keywords: ["amritsar", "ludhiana", "jalandhar", "patiala", "bathinda"], code: "PB" },
  { keywords: ["gurgaon", "gurugram", "faridabad", "rohtak", "ambala", "panipat", "hisar"], code: "HR" },
  { keywords: ["thiruvananthapuram", "kochi", "kozhikode", "thrissur", "kollam", "kannur"], code: "KL" },
  { keywords: ["shillong", "tura", "jowai"], code: "ML" },
  { keywords: ["imphal", "thoubal", "churachandpur"], code: "MN" },
  { keywords: ["guwahati", "dibrugarh", "silchar", "jorhat", "tinsukia"], code: "AS" },
  { keywords: ["itanagar", "pasighat", "naharlagun", "tawang", "bomdila"], code: "AR" },
  { keywords: ["agartala", "dharmanagar", "kailashahar"], code: "TR" },
  { keywords: ["aizawl", "lunglei", "champhai"], code: "MZ" },
  { keywords: ["kohima", "dimapur", "mokokchung"], code: "NL" },
  { keywords: ["gangtok", "namchi", "mangan"], code: "SK" },
  { keywords: ["srinagar", "jammu", "leh", "anantnag"], code: "JK" },
  { keywords: ["leh", "kargil"], code: "LA" },
  { keywords: ["pondicherry", "puducherry"], code: "PY" },
  { keywords: ["port blair"], code: "AN" },
  { keywords: ["kavaratti"], code: "LD" },
  { keywords: ["daman", "diu", "silvassa", "dadra"], code: "DD" }
];

export function mapLocationToRegion(location: string): string {
  const val = location.toLowerCase();

  // City/alias check first (more specific than state name)
  for (const entry of CITY_TO_STATE) {
    if (entry.keywords.some((k) => val.includes(k))) return entry.code;
  }

  // INDIA_GEO state name check
  for (const s of INDIA_GEO) {
    if (val.includes(s.name.toLowerCase())) return s.code;
    if (val.includes(s.code.toLowerCase()) && s.code.length === 2) return s.code;
  }

  return "national";
}

export async function upsertPrice(params: {
  material: string;
  unit: string;
  priceINR: number;
  source: string;
  sourceURL: string;
  region: string;
  state?: string | null;
  stateCode?: string | null;
}) {
  const { material, region, unit, priceINR, source, sourceURL, state = null, stateCode = null } = params;

  await PriceModel.updateMany({ material, region, isActive: true }, { $set: { isActive: false } });

  const newPrice = await PriceModel.create({
    material,
    region,
    priceINR,
    unit,
    source,
    sourceURL,
    state,
    stateCode,
    scrapedAt: new Date(),
    isActive: true
  });

  await PriceHistoryModel.findOneAndUpdate(
    { material, region },
    {
      $setOnInsert: { state, stateCode },
      $push: {
        dataPoints: {
          $each: [{ date: new Date(), priceINR, source }],
          $slice: -365
        }
      }
    },
    { upsert: true, new: true }
  );

  return newPrice;
}

export async function insertCpwdFallbackForAllRegions(params: {
  material: string;
  sourceURL: string;
  reason: string;
}): Promise<number> {
  const base = CPWD_2024_BASE_RATES[params.material];
  if (!base) {
    logger.warn(`[CPWD] Missing base rate for material=${params.material}. reason=${params.reason}`);
    return 0;
  }

  // National baseline (no state)
  await upsertPrice({
    material: params.material,
    unit: base.unit,
    priceINR: base.priceINR,
    source: "cpwd_fallback",
    sourceURL: params.sourceURL,
    region: "national",
    state: null,
    stateCode: null
  });

  // All 36 states/UTs with their respective CPWD SOR multipliers
  const stateTasks = INDIA_GEO.map(async (s) => {
    const priceINR = Math.round(base.priceINR * s.regionMultiplier * 100) / 100;
    await upsertPrice({
      material: params.material,
      unit: base.unit,
      priceINR,
      source: "cpwd_fallback",
      sourceURL: params.sourceURL,
      region: s.code,
      state: s.name,
      stateCode: s.code
    });
  });

  await Promise.all(stateTasks);

  const count = INDIA_GEO.length + 1;
  logger.warn(
    `[CPWD] Inserted fallback for material=${params.material} across ${count} regions (all states + national) reason=${params.reason}`
  );
  return count;
}

export const delay = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
