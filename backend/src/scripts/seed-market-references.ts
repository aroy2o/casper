import mongoose from "mongoose";
import { env } from "../config/env.js";
import { MarketReferenceModel } from "../models/MarketReference.model.js";

const MARKET_SEED = [
  // Cement — national + key NE India states
  { itemName: "cement", itemCategory: "building_materials", unit: "bag", priceINR: 370, stateCode: null, state: null, source: "CPWD", sourceDescription: "CPWD Delhi Schedule of Rates 2024", notes: "50kg bag, OPC 43/53 Grade" },
  { itemName: "cement", itemCategory: "building_materials", unit: "bag", priceINR: 348, stateCode: null, state: null, source: "GeM", sourceDescription: "Government e-Marketplace listed price (national avg, Q1 2025)", notes: null },
  { itemName: "cement", itemCategory: "building_materials", unit: "bag", priceINR: 355, stateCode: "AS", state: "Assam", source: "PWD", sourceDescription: "Assam PWD Schedule of Rates 2024-25", notes: "Includes intra-state transport" },
  { itemName: "cement", itemCategory: "building_materials", unit: "bag", priceINR: 362, stateCode: "ML", state: "Meghalaya", source: "PWD", sourceDescription: "Meghalaya PWD Schedule of Rates 2024-25", notes: null },
  { itemName: "cement", itemCategory: "building_materials", unit: "bag", priceINR: 368, stateCode: "MN", state: "Manipur", source: "PWD", sourceDescription: "Manipur PWD Schedule of Rates 2024-25", notes: null },
  { itemName: "cement", itemCategory: "building_materials", unit: "bag", priceINR: 375, stateCode: "AR", state: "Arunachal Pradesh", source: "PWD", sourceDescription: "Arunachal Pradesh PWD Schedule of Rates 2024-25", notes: "Remote terrain surcharge included" },
  { itemName: "cement", itemCategory: "building_materials", unit: "bag", priceINR: 360, stateCode: "TR", state: "Tripura", source: "PWD", sourceDescription: "Tripura PWD Schedule of Rates 2024-25", notes: null },
  // WPI index for cement
  { itemName: "cement", itemCategory: "building_materials", unit: "bag", priceINR: 352, stateCode: null, state: null, source: "WPI", sourceDescription: "Ministry of Commerce WPI Index (non-metallic mineral products – cement), Mar 2025", notes: "Base year 2011-12=100, index 162.3; converted to per-bag from MT" },

  // Steel Rod
  { itemName: "steel_rod", itemCategory: "metals", unit: "MT", priceINR: 56000, stateCode: null, state: null, source: "CPWD", sourceDescription: "CPWD Delhi Schedule of Rates 2024", notes: "Fe-500 TMT bars" },
  { itemName: "steel_rod", itemCategory: "metals", unit: "MT", priceINR: 54500, stateCode: null, state: null, source: "GeM", sourceDescription: "Government e-Marketplace listed price (national avg, Q1 2025)", notes: "Fe-500D TMT" },
  { itemName: "steel_rod", itemCategory: "metals", unit: "MT", priceINR: 57200, stateCode: null, state: null, source: "WPI", sourceDescription: "Ministry of Commerce WPI Index (manufactured products – iron & steel), Mar 2025", notes: "Base year 2011-12=100, index 175.4" },
  { itemName: "steel_rod", itemCategory: "metals", unit: "MT", priceINR: 58000, stateCode: null, state: null, source: "SAIL", sourceDescription: "SAIL listed mill price for TMT Fe-500, Q1 2025", notes: null },

  // Bitumen
  { itemName: "bitumen", itemCategory: "road_materials", unit: "MT", priceINR: 50000, stateCode: null, state: null, source: "CPWD", sourceDescription: "CPWD Schedule of Rates 2024", notes: "VG-30 grade bitumen" },
  { itemName: "bitumen", itemCategory: "road_materials", unit: "MT", priceINR: 48800, stateCode: null, state: null, source: "WPI", sourceDescription: "Ministry of Commerce WPI Index (mineral oils – bitumen), Mar 2025", notes: null },
  { itemName: "bitumen", itemCategory: "road_materials", unit: "MT", priceINR: 49200, stateCode: null, state: null, source: "IOCL", sourceDescription: "Indian Oil Corporation Ltd. ex-depot price (North-East region), Mar 2025", notes: "VG-30, includes basic price + excise + VAT" },
  { itemName: "bitumen", itemCategory: "road_materials", unit: "MT", priceINR: 51500, stateCode: "AR", state: "Arunachal Pradesh", source: "PWD", sourceDescription: "Arunachal Pradesh PWD Schedule of Rates 2024-25", notes: "Transport surcharge to remote districts" },

  // Aggregates & Sand
  { itemName: "coarse_sand", itemCategory: "aggregates", unit: "cum", priceINR: 42, stateCode: null, state: null, source: "CPWD", sourceDescription: "CPWD Delhi Schedule of Rates 2024", notes: "River sand, zone II" },
  { itemName: "fine_sand", itemCategory: "aggregates", unit: "cum", priceINR: 35, stateCode: null, state: null, source: "CPWD", sourceDescription: "CPWD Delhi Schedule of Rates 2024", notes: null },
  { itemName: "aggregate_20mm", itemCategory: "aggregates", unit: "cum", priceINR: 1750, stateCode: null, state: null, source: "CPWD", sourceDescription: "CPWD Delhi Schedule of Rates 2024", notes: "Machine crushed stone aggregate, 20mm nominal size" },
  { itemName: "aggregate_20mm", itemCategory: "aggregates", unit: "cum", priceINR: 1820, stateCode: "AS", state: "Assam", source: "PWD", sourceDescription: "Assam PWD Schedule of Rates 2024-25", notes: null },

  // Brick
  { itemName: "brick", itemCategory: "building_materials", unit: "thousand", priceINR: 6800, stateCode: null, state: null, source: "CPWD", sourceDescription: "CPWD Delhi Schedule of Rates 2024", notes: "Per thousand first-class bricks (standard modular)" },
  { itemName: "brick", itemCategory: "building_materials", unit: "thousand", priceINR: 5900, stateCode: "AS", state: "Assam", source: "PWD", sourceDescription: "Assam PWD Schedule of Rates 2024-25", notes: "Local kiln-fired brick" },

  // RCC Pipe
  { itemName: "rcc_pipe", itemCategory: "drainage", unit: "m", priceINR: 2650, stateCode: null, state: null, source: "CPWD", sourceDescription: "CPWD Delhi Schedule of Rates 2024", notes: "300mm dia NP3 class" },
  { itemName: "rcc_pipe", itemCategory: "drainage", unit: "m", priceINR: 2580, stateCode: null, state: null, source: "GeM", sourceDescription: "Government e-Marketplace listed price, 300mm NP3 (Q1 2025)", notes: null }
] as const;

async function main(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  console.log("[seed-market-references] Connected to MongoDB");

  const existing = await MarketReferenceModel.countDocuments();
  if (existing > 0) {
    console.log(`[seed-market-references] ${existing} market references already exist. Dropping and re-seeding…`);
    await MarketReferenceModel.deleteMany({});
  }

  const refDate = new Date("2025-01-01");
  const validUntil = new Date("2026-03-31");

  const docs = MARKET_SEED.map((s) => ({
    ...s,
    sourceURL: null,
    referenceDate: refDate,
    validUntil
  }));

  await MarketReferenceModel.insertMany(docs);
  console.log(`[seed-market-references] Seeded ${docs.length} market references`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
