/**
 * Fair Cost Estimator — AI Service
 *
 * Architecture:
 *  1. computeSOREstimate()  — deterministic MORTH 2023 / CPWD DSR 2023 formula → authoritative numbers
 *  2. generateAIContext()   — Ollama adds narrative only (assumptions, risk factors, comparables, anomaly flags)
 *  3. merge()               — SOR numbers + AI narrative = final result
 *
 * The AI never touches cost figures. Only the formula does.
 */

import crypto from "crypto";
import axios from "axios";
import { env } from "../config/env.js";
import { AIEstimateResult, TenderCompareResult } from "../models/Estimate.model.js";

const OLLAMA_TIMEOUT = 90_000;

// ─── Regional multipliers (CPWD / DONER / BRO norms) ────────────────────────
const REGION_MULTIPLIERS: Record<string, { multiplier: number; reason: string }> = {
  "arunachal pradesh":  { multiplier: 1.45, reason: "NE state — DONER/BRO norms, remote terrain" },
  "nagaland":           { multiplier: 1.40, reason: "NE state — DONER/BRO norms" },
  "manipur":            { multiplier: 1.38, reason: "NE state — DONER/BRO norms" },
  "mizoram":            { multiplier: 1.35, reason: "NE state — DONER/BRO norms, hilly" },
  "meghalaya":          { multiplier: 1.32, reason: "NE state — DONER norms, hilly terrain" },
  "sikkim":             { multiplier: 1.30, reason: "NE state — hilly, DONER norms" },
  "tripura":            { multiplier: 1.25, reason: "NE state — DONER norms" },
  "assam":              { multiplier: 1.22, reason: "NE state — flood-prone, DONER norms" },
  "himachal pradesh":   { multiplier: 1.20, reason: "Hilly terrain, remote access" },
  "uttarakhand":        { multiplier: 1.18, reason: "Hilly terrain, seismic zone" },
  "jammu & kashmir":    { multiplier: 1.25, reason: "UT — hilly, strategic area" },
  "ladakh":             { multiplier: 1.42, reason: "UT — extreme altitude, BRO norms" },
  "kerala":             { multiplier: 1.12, reason: "High labour cost, coastal terrain" },
  "delhi":              { multiplier: 1.15, reason: "High land cost, urban infrastructure" },
  "maharashtra":        { multiplier: 1.10, reason: "Urban premium, high material cost" },
  "gujarat":            { multiplier: 1.05, reason: "Industrial state" },
  "karnataka":          { multiplier: 1.08, reason: "Urban + rural mix" },
  "tamil nadu":         { multiplier: 1.07, reason: "Coastal state" },
  "telangana":          { multiplier: 1.06, reason: "Semi-arid" },
  "andhra pradesh":     { multiplier: 1.05, reason: "Coastal state" },
  "rajasthan":          { multiplier: 1.03, reason: "Desert terrain, remote areas" },
  "punjab":             { multiplier: 1.04, reason: "Canal-heavy terrain" },
  "haryana":            { multiplier: 1.05, reason: "Urban fringe" },
  "goa":                { multiplier: 1.08, reason: "Coastal, high labour cost" },
};

function getRegionAdj(state: string): { state: string; multiplier: number; reason: string } {
  const key = state.toLowerCase().trim();
  const adj = REGION_MULTIPLIERS[key];
  return adj
    ? { state, multiplier: adj.multiplier, reason: adj.reason }
    : { state, multiplier: 1.00, reason: "Standard plains rate (CPWD DSR 2023)" };
}

// ─── Overhead structure ───────────────────────────────────────────────────────
// direct → +10% profit → +5% contingency → ×1.18 GST
function applyOverheads(direct: number): {
  profit_cr: number; contingency_cr: number; gst_cr: number; total_cr: number;
} {
  const profit = direct * 0.10;
  const contingency = direct * 0.05;
  const subtotal = direct + profit + contingency;
  const gst = subtotal * 0.18;
  return {
    profit_cr: r2(profit),
    contingency_cr: r2(contingency),
    gst_cr: r2(gst),
    total_cr: r2(subtotal + gst)
  };
}

function r2(n: number): number { return Math.round(n * 100) / 100; }
function r3(n: number): number { return Math.round(n * 1000) / 1000; }

// ─── ROAD ────────────────────────────────────────────────────────────────────
/**
 * MORTH 2023 / CPWD DSR 2023 road cost formula.
 * Base: ₹2.20 Cr/km for 7m 2-lane bituminous, plain, good soil (direct, pre-overhead).
 * Factors applied multiplicatively.
 */
function sorRoad(inp: Record<string, unknown>): Omit<AIEstimateResult, "assumptions" | "risk_factors" | "comparable_projects" | "anomaly_flags"> {
  const km          = Number(inp.length_km ?? 5);
  const widthM      = Number(inp.width_m ?? 7);
  const roadType    = String(inp.road_type ?? "MDR");
  const surface     = String(inp.surface_type ?? "Bituminous");
  const terrain     = String(inp.terrain ?? "Plain");
  const soil        = String(inp.subgrade_soil ?? "Good");
  const drainage    = String(inp.drainage_type ?? "None");
  const emb         = Math.max(0, Number(inp.embankment_height_m ?? 0) - 1.0); // above 1m is extra
  const culverts    = Number(inp.num_culverts ?? 0);
  const minorBridge = Number(inp.num_minor_bridges ?? 0);

  const BASE_PER_KM = 2.20; // ₹ Cr/km, 2-lane bituminous, plain, good soil

  const roadTypeFactor   = ({ NH: 1.22, SH: 1.12, MDR: 1.00, Rural: 0.78 } as Record<string,number>)[roadType] ?? 1.00;
  const surfaceFactor    = ({ Bituminous: 1.00, Concrete: 1.20, WBM: 0.60, Gravel: 0.45 } as Record<string,number>)[surface] ?? 1.00;
  const widthFactor      = widthM <= 4 ? 0.55 : widthM <= 8 ? 1.00 : widthM <= 15 ? 1.82 : 2.55;
  const terrainFactor    = ({ Plain: 1.00, Rolling: 1.15, Hilly: 1.38, Steep: 1.65 } as Record<string,number>)[terrain] ?? 1.00;
  const soilFactor       = ({ Good: 1.00, Medium: 1.06, Poor: 1.15 } as Record<string,number>)[soil] ?? 1.00;
  const drainFactor      = ({ None: 1.00, "Open drain": 1.06, "Covered drain": 1.13, Both: 1.19 } as Record<string,number>)[drainage] ?? 1.00;
  const embFactor        = 1 + emb * 0.025;

  const ratePerKm = BASE_PER_KM * roadTypeFactor * surfaceFactor * widthFactor * terrainFactor * soilFactor * drainFactor * embFactor;

  const region = getRegionAdj(String(inp.state ?? ""));
  const directLinear = ratePerKm * km * region.multiplier;
  const directExtras = (culverts * 0.14 + minorBridge * 0.85) * region.multiplier;
  const direct = directLinear + directExtras;

  // Breakdown proportions (of direct, pre-overhead)
  const oh = applyOverheads(direct);

  const breakdown = {
    materials_cr:        r2(direct * 0.40),
    labour_equipment_cr: r2(direct * 0.30),
    earthwork_cr:        r2(direct * 0.18),
    structures_cr:       r2(direct * 0.07),
    finishing_cr:        r2(direct * 0.05),
    profit_cr:           oh.profit_cr,
    contingency_cr:      oh.contingency_cr,
    gst_cr:              oh.gst_cr
  };

  const unitRatePerKm = r3(oh.total_cr / km);
  return {
    total_cost_cr:    oh.total_cr,
    confidence_level: "High",
    confidence_pct:   85,
    unit_rate:        { value: unitRatePerKm, unit: "per km" },
    sor_reference:    "MORTH 2023 / CPWD DSR 2023",
    cost_breakdown:   breakdown,
    region_adjustment: region
  };
}

// ─── BRIDGE ──────────────────────────────────────────────────────────────────
/**
 * MORTH 2023 bridge rates.
 * Base: ₹25,000/sqm for RCC Slab, Open foundation, Soil riverbed (direct cost).
 */
function sorBridge(inp: Record<string, unknown>): Omit<AIEstimateResult, "assumptions" | "risk_factors" | "comparable_projects" | "anomaly_flags"> {
  const lengthM     = Number(inp.total_length_m ?? 50);
  const widthM      = Number(inp.width_m ?? 8);
  const bridgeType  = String(inp.bridge_type ?? "RCC Slab");
  const foundation  = String(inp.foundation_type ?? "Open");
  const riverbed    = String(inp.river_bed_material ?? "Soil");
  const approachKm  = Number(inp.approach_road_length_m ?? 0) / 1000;

  const BASE_PER_SQM = 25_000; // INR/sqm direct

  const typeFactor       = ({ "RCC Slab": 1.00, "PSC Girder": 1.35, "Steel Truss": 1.65, "Cable-Stayed": 2.50 } as Record<string,number>)[bridgeType] ?? 1.00;
  const foundFactor      = ({ Open: 1.00, Pile: 1.22, Well: 1.38 } as Record<string,number>)[foundation] ?? 1.00;
  const riverbedFactor   = ({ Soil: 1.00, Rock: 1.06, Mixed: 1.02 } as Record<string,number>)[riverbed] ?? 1.00;

  const region = getRegionAdj(String(inp.state ?? ""));
  const area = lengthM * widthM;
  const directBridge = (area * BASE_PER_SQM * typeFactor * foundFactor * riverbedFactor * region.multiplier) / 1e7;
  const directApproach = approachKm * 1.8 * region.multiplier; // ₹1.8 Cr/km approach road (single lane)
  const direct = directBridge + directApproach;

  const oh = applyOverheads(direct);
  const breakdown = {
    materials_cr:        r2(direct * 0.38),
    labour_equipment_cr: r2(direct * 0.28),
    earthwork_cr:        r2(direct * 0.08),
    structures_cr:       r2(direct * 0.22),
    finishing_cr:        r2(direct * 0.04),
    profit_cr:           oh.profit_cr,
    contingency_cr:      oh.contingency_cr,
    gst_cr:              oh.gst_cr
  };

  const sqm = area > 0 ? r3((oh.total_cr * 1e7) / area) : 0;
  return {
    total_cost_cr:    oh.total_cr,
    confidence_level: "High",
    confidence_pct:   82,
    unit_rate:        { value: sqm, unit: "per sqm" },
    sor_reference:    "MORTH 2023 / IRC SP:70 / CPWD DSR 2023",
    cost_breakdown:   breakdown,
    region_adjustment: region
  };
}

// ─── BUILDING ────────────────────────────────────────────────────────────────
/**
 * CPWD DSR 2023 plinth area rates.
 * Base rates are per sqm, direct cost.
 */
function sorBuilding(inp: Record<string, unknown>): Omit<AIEstimateResult, "assumptions" | "risk_factors" | "comparable_projects" | "anomaly_flags"> {
  const bType       = String(inp.building_type ?? "Residential");
  const floors      = Number(inp.num_floors ?? 3);
  const plinth      = Number(inp.plinth_area_per_floor_sqm ?? 500);
  const conType     = String(inp.construction_type ?? "RCC Frame");
  const finish      = String(inp.finishing_level ?? "Standard");
  const site        = String(inp.site_condition ?? "Plain");
  const toilets     = Number(inp.num_toilets ?? 0);
  const lifts       = Number(inp.num_lifts ?? 0);
  const staircases  = Number(inp.num_staircases ?? 1);

  // INR/sqm base rates (CPWD DSR 2023)
  const BASE_SQM: Record<string, number> = {
    Residential: 21_000, Office: 25_000, Hospital: 36_000, School: 23_000, Other: 21_500
  };
  const baseSqm = BASE_SQM[bType] ?? 21_000;

  const conFactor    = ({ "Load-bearing": 0.85, "RCC Frame": 1.00, "Steel Frame": 1.25 } as Record<string,number>)[conType] ?? 1.00;
  const finishFactor = ({ Basic: 0.80, Standard: 1.00, Premium: 1.28 } as Record<string,number>)[finish] ?? 1.00;
  const siteFactor   = ({ Plain: 1.00, Sloped: 1.08 } as Record<string,number>)[site] ?? 1.00;

  const region = getRegionAdj(String(inp.state ?? ""));
  const totalArea = floors * plinth;
  const directWork = (totalArea * baseSqm * conFactor * finishFactor * siteFactor * region.multiplier) / 1e7;
  const extras = (toilets * 0.025 + lifts * 0.36 + staircases * 0.09) * region.multiplier;
  const direct = directWork + extras;

  const oh = applyOverheads(direct);
  const breakdown = {
    materials_cr:        r2(direct * 0.42),
    labour_equipment_cr: r2(direct * 0.28),
    earthwork_cr:        r2(direct * 0.04),
    structures_cr:       r2(direct * 0.18),
    finishing_cr:        r2(direct * 0.08),
    profit_cr:           oh.profit_cr,
    contingency_cr:      oh.contingency_cr,
    gst_cr:              oh.gst_cr
  };

  const sqmFull = totalArea > 0 ? r3((oh.total_cr * 1e7) / totalArea) : 0;
  return {
    total_cost_cr:    oh.total_cr,
    confidence_level: "High",
    confidence_pct:   83,
    unit_rate:        { value: sqmFull, unit: "per sqm" },
    sor_reference:    "CPWD DSR 2023 / CPWD Plinth Area Rates 2023",
    cost_breakdown:   breakdown,
    region_adjustment: region
  };
}

// ─── DRAINAGE ────────────────────────────────────────────────────────────────
/**
 * CPWD DSR 2023 drainage / sewer rates.
 * Base: ₹1.5 Cr/km for 300mm RCC, 2m depth, semi-urban (direct cost).
 */
function sorDrainage(inp: Record<string, unknown>): Omit<AIEstimateResult, "assumptions" | "risk_factors" | "comparable_projects" | "anomaly_flags"> {
  const km          = Number(inp.network_length_km ?? 5);
  const diaMin      = Number(inp.pipe_diameter_min_mm ?? 200);
  const diaMax      = Number(inp.pipe_diameter_max_mm ?? 600);
  const material    = String(inp.pipe_material ?? "RCC");
  const depth       = Number(inp.depth_of_laying_m ?? 2.0);
  const terrain     = String(inp.terrain ?? "Semi-urban");
  const manholes    = Number(inp.num_manholes ?? 0);
  const hasSTP      = Boolean(inp.treatment_plant_required);
  const stpMLD      = Number(inp.treatment_capacity_mld ?? 0);

  const avgDia = (diaMin + diaMax) / 2;
  const diaFactor = Math.pow(avgDia / 300, 1.5); // exponential with diameter
  const matFactor  = ({ RCC: 1.00, DI: 1.35, HDPE: 0.80, PVC: 0.70 } as Record<string,number>)[material] ?? 1.00;
  const depthFactor = 1 + Math.max(0, depth - 2.0) * 0.10; // +10% per metre beyond 2m
  const terFactor  = ({ Urban: 1.20, "Semi-urban": 1.00, Rural: 0.82 } as Record<string,number>)[terrain] ?? 1.00;

  const BASE = 1.5; // ₹ Cr/km (300mm RCC, 2m depth, semi-urban, direct cost)
  const region = getRegionAdj(String(inp.state ?? ""));

  const directPipe = km * BASE * diaFactor * matFactor * depthFactor * terFactor * region.multiplier;
  const directMH   = manholes * 0.015 * region.multiplier; // ₹1.5 lakh/manhole
  const directSTP  = hasSTP && stpMLD > 0 ? stpMLD * 2.5 * region.multiplier : 0; // ₹2.5 Cr/MLD STP

  const direct = directPipe + directMH + directSTP;
  const oh = applyOverheads(direct);

  const breakdown = {
    materials_cr:        r2(direct * 0.42),
    labour_equipment_cr: r2(direct * 0.32),
    earthwork_cr:        r2(direct * 0.12),
    structures_cr:       r2(direct * 0.09),
    finishing_cr:        r2(direct * 0.05),
    profit_cr:           oh.profit_cr,
    contingency_cr:      oh.contingency_cr,
    gst_cr:              oh.gst_cr
  };

  const unitPerKm = r3(oh.total_cr / km);
  return {
    total_cost_cr:    oh.total_cr,
    confidence_level: "High",
    confidence_pct:   82,
    unit_rate:        { value: unitPerKm, unit: "per running km" },
    sor_reference:    "CPWD DSR 2023 / MoUD STP Norms 2023",
    cost_breakdown:   breakdown,
    region_adjustment: region
  };
}

// ─── Main SOR dispatcher ─────────────────────────────────────────────────────
function computeSOREstimate(inputs: Record<string, unknown>): Omit<AIEstimateResult, "assumptions" | "risk_factors" | "comparable_projects" | "anomaly_flags"> {
  const type = String(inputs.project_type ?? "ROAD").toUpperCase();
  switch (type) {
    case "ROAD":     return sorRoad(inputs);
    case "BRIDGE":   return sorBridge(inputs);
    case "BUILDING": return sorBuilding(inputs);
    case "DRAINAGE": return sorDrainage(inputs);
    default:         return sorRoad(inputs);
  }
}

// ─── AI context prompt ────────────────────────────────────────────────────────
const AI_CONTEXT_SYSTEM = `You are CASPER's Cost Estimate Analyst for Indian government infrastructure.
The cost figures have already been computed via MORTH 2023 / CPWD DSR 2023 formulas. Your role is CONTEXT ONLY — do NOT change any cost numbers.
Return ONLY valid JSON with these fields (no markdown, no code blocks):
{
  "assumptions": [string, ...],
  "risk_factors": [{"factor": string, "impact": "+X% to +Y%", "severity": "High|Medium|Low"}, ...],
  "comparable_projects": [{"name": string, "location": string, "year": number, "cost_cr": number, "source": string}, ...],
  "anomaly_flags": [string, ...]
}
Guidelines:
- assumptions: 3–5 key engineering assumptions behind this estimate (soil bearing, design speed, traffic loading, material availability, etc.)
- risk_factors: 2–4 realistic risk items with percentage impact ranges
- comparable_projects: 2–3 real or realistic similar completed projects in India with approximate costs
- anomaly_flags: any technically inconsistent input combinations (e.g. 6-lane rural road, hospital without lifts, etc.) — leave empty array if none
Keep responses concise and factual.`;

async function callOllamaJSON(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await axios.post<{ message: { content: string } }>(
    `${env.OLLAMA_BASE_URL}/api/chat`,
    {
      model: env.OLLAMA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      stream: false,
      format: "json",
      options: { temperature: 0.15, num_predict: 1024 }
    },
    { timeout: OLLAMA_TIMEOUT }
  );
  return response.data.message.content;
}

function buildContextMessage(inputs: Record<string, unknown>, sor: Omit<AIEstimateResult, "assumptions" | "risk_factors" | "comparable_projects" | "anomaly_flags">): string {
  const { project_name, project_type, state, district, financial_year, ...fields } = inputs as Record<string, string | number | boolean>;
  const params = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `  ${k}: ${String(v)}`)
    .join("\n");

  return [
    `Project Type: ${String(project_type)} | State: ${String(state)}, ${String(district)} | FY: ${String(financial_year)}`,
    `Project Name: ${String(project_name)}`,
    `Parameters:\n${params}`,
    `--- Computed SOR Estimate ---`,
    `Total Cost: ₹${sor.total_cost_cr.toFixed(2)} Cr`,
    `Unit Rate: ₹${sor.unit_rate.value.toFixed(3)} Cr ${sor.unit_rate.unit}`,
    `Region Multiplier: ${sor.region_adjustment.multiplier}x (${sor.region_adjustment.reason})`,
    `---`,
    `Provide assumptions, risk_factors, comparable_projects, and anomaly_flags for this ${String(project_type)} project in ${String(state)}.`
  ].join("\n");
}

function defaultContext(inputs: Record<string, unknown>): Pick<AIEstimateResult, "assumptions" | "risk_factors" | "comparable_projects" | "anomaly_flags"> {
  const type = String(inputs.project_type ?? "");
  const state = String(inputs.state ?? "");
  const region = getRegionAdj(state);

  return {
    assumptions: [
      `Rates based on CPWD DSR 2023 with ${region.multiplier}x regional multiplier for ${state}`,
      "Design standards as per relevant IRC / IS codes",
      "Material supply from nearest available market",
      "Normal site conditions assumed unless otherwise specified",
      "Skilled labour availability at standard PWD rates"
    ],
    risk_factors: [
      { factor: "Material price escalation", impact: "+5% to +12%", severity: "Medium" },
      { factor: "Monsoon season delay", impact: "+3% to +8%", severity: "Low" },
      ...(region.multiplier >= 1.30 ? [{ factor: "Remote location logistics", impact: "+8% to +15%", severity: "High" } as const] : [])
    ],
    comparable_projects: [],
    anomaly_flags: detectAnomalies(type, inputs)
  };
}

function detectAnomalies(type: string, inp: Record<string, unknown>): string[] {
  const flags: string[] = [];
  if (type === "ROAD") {
    const widthM = Number(inp.width_m ?? 0);
    const roadType = String(inp.road_type ?? "");
    if (widthM >= 21 && roadType === "Rural") flags.push("6-lane width specified for a Rural road — verify road category");
    if (widthM <= 4 && roadType === "NH") flags.push("Single-lane width for National Highway — verify specification");
    if (String(inp.surface_type) === "Gravel" && roadType === "NH") flags.push("Gravel surface for NH — typically bituminous or concrete required");
  }
  if (type === "BUILDING") {
    const floors = Number(inp.num_floors ?? 0);
    const lifts = Number(inp.num_lifts ?? 0);
    const bType = String(inp.building_type ?? "");
    if (floors > 4 && lifts === 0 && bType === "Hospital") flags.push("Hospital above 4 floors with no lifts — accessibility compliance issue");
    if (floors > 6 && lifts === 0) flags.push(`${floors}-floor building with no lifts — verify NBC 2016 compliance`);
  }
  if (type === "DRAINAGE") {
    const diaMin = Number(inp.pipe_diameter_min_mm ?? 0);
    const diaMax = Number(inp.pipe_diameter_max_mm ?? 0);
    if (diaMin > diaMax) flags.push("Minimum pipe diameter exceeds maximum — verify inputs");
    if (Boolean(inp.treatment_plant_required) && !Number(inp.treatment_capacity_mld)) {
      flags.push("Treatment plant required but capacity (MLD) not specified");
    }
  }
  if (type === "BRIDGE") {
    const numSpans = Number(inp.num_spans ?? 1);
    const spanLen = Number(inp.span_length_m ?? 0);
    const totalLen = Number(inp.total_length_m ?? 0);
    if (numSpans > 1 && Math.abs(numSpans * spanLen - totalLen) > totalLen * 0.15) {
      flags.push(`Span count × span length (${numSpans * spanLen}m) doesn't match total length (${totalLen}m) — verify inputs`);
    }
  }
  return flags;
}

// ─── Public exports ───────────────────────────────────────────────────────────

export function hashInputs(inputs: Record<string, unknown>): string {
  const sorted = JSON.stringify(inputs, Object.keys(inputs).sort());
  return crypto.createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}

export async function generateAIEstimate(
  inputs: Record<string, unknown>,
  _mlEstimateCr?: number | null
): Promise<{ result: AIEstimateResult; modelUsed: string }> {
  // Step 1: Deterministic SOR estimate (always accurate)
  const sor = computeSOREstimate(inputs);

  // Step 2: AI adds narrative context (assumptions, risks, comparables, anomaly flags)
  let context: Pick<AIEstimateResult, "assumptions" | "risk_factors" | "comparable_projects" | "anomaly_flags">;
  let modelUsed = "heuristic-fallback";

  try {
    const msg = buildContextMessage(inputs, sor);
    const raw = await callOllamaJSON(AI_CONTEXT_SYSTEM, msg);
    const parsed = JSON.parse(raw) as Partial<Pick<AIEstimateResult, "assumptions" | "risk_factors" | "comparable_projects" | "anomaly_flags">>;

    context = {
      assumptions:          Array.isArray(parsed.assumptions) ? parsed.assumptions : defaultContext(inputs).assumptions,
      risk_factors:         Array.isArray(parsed.risk_factors) ? parsed.risk_factors : defaultContext(inputs).risk_factors,
      comparable_projects:  Array.isArray(parsed.comparable_projects) ? parsed.comparable_projects : [],
      anomaly_flags:        Array.isArray(parsed.anomaly_flags) ? parsed.anomaly_flags : detectAnomalies(String(inputs.project_type ?? ""), inputs)
    };
    modelUsed = `ollama:${env.OLLAMA_MODEL}`;
  } catch {
    context = defaultContext(inputs);
  }

  // Merge: SOR numbers + AI narrative
  const result: AIEstimateResult = {
    ...sor,
    ...context
  };

  return { result, modelUsed };
}

export async function fetchMlEstimate(
  projectType: string,
  inputs: Record<string, unknown>
): Promise<{ ml_estimate_cr: number | null; ml_model_version: string | null }> {
  try {
    const response = await axios.post<{ ml_estimate_cr: number; ml_model_version: string }>(
      `${env.ML_SERVICE_URL}/estimate/predict`,
      { project_type: projectType, inputs },
      { timeout: 10_000 }
    );
    return { ml_estimate_cr: response.data.ml_estimate_cr, ml_model_version: response.data.ml_model_version };
  } catch {
    return { ml_estimate_cr: null, ml_model_version: null };
  }
}

// ─── Tender comparison ────────────────────────────────────────────────────────
const COMPARE_SYSTEM = `You are CASPER's Tender Comparison Engine.
Return ONLY valid JSON (no markdown):
{
  "anomaly_analysis": string,
  "cost_head_comparison": [{"head": string, "fair_cr": number, "tender_cr": number, "variance_pct": number, "suspicious": boolean}]
}
suspicious = true when abs(variance_pct) > 20.
Scale tender amount proportionally across cost heads by fair-estimate weights.
Identify which heads are most likely padded based on project type procurement norms.`;

export async function compareTenderQuote(
  fairEstimate: AIEstimateResult,
  tenderQuotedCr: number,
  projectType: string
): Promise<TenderCompareResult> {
  const variancePct = ((tenderQuotedCr - fairEstimate.total_cost_cr) / fairEstimate.total_cost_cr) * 100;
  const flag = variancePct > 20 ? "RED" : variancePct > 10 ? "AMBER" : "GREEN";

  const bd = fairEstimate.cost_breakdown;
  const userMsg = [
    `Project Type: ${projectType}`,
    `Fair Estimate Total: ₹${fairEstimate.total_cost_cr.toFixed(2)} Cr`,
    `Tender Quote: ₹${tenderQuotedCr.toFixed(2)} Cr`,
    `Overall Variance: ${variancePct > 0 ? "+" : ""}${variancePct.toFixed(1)}%`,
    `Fair breakdown (₹ Cr): Materials=${bd.materials_cr}, Labour=${bd.labour_equipment_cr}, Earthwork=${bd.earthwork_cr}, Structures=${bd.structures_cr}, Finishing=${bd.finishing_cr}, Profit=${bd.profit_cr}, Contingency=${bd.contingency_cr}, GST=${bd.gst_cr}`
  ].join("\n");

  try {
    const raw = await callOllamaJSON(COMPARE_SYSTEM, userMsg);
    const parsed = JSON.parse(raw) as { anomaly_analysis: string; cost_head_comparison: TenderCompareResult["cost_head_comparison"] };
    return {
      tender_quoted_cr: tenderQuotedCr,
      variance_pct: r2(variancePct),
      flag: flag as "GREEN" | "AMBER" | "RED",
      anomaly_analysis: parsed.anomaly_analysis ?? "",
      cost_head_comparison: parsed.cost_head_comparison ?? proportionalComparison(bd, tenderQuotedCr, fairEstimate.total_cost_cr)
    };
  } catch {
    return {
      tender_quoted_cr: tenderQuotedCr,
      variance_pct: r2(variancePct),
      flag: flag as "GREEN" | "AMBER" | "RED",
      anomaly_analysis: `Tender is ${Math.abs(variancePct).toFixed(1)}% ${variancePct > 0 ? "above" : "below"} fair estimate of ₹${fairEstimate.total_cost_cr.toFixed(2)} Cr. ${variancePct > 20 ? "Significant over-pricing detected — recommend detailed scrutiny of all cost heads." : variancePct > 10 ? "Moderate variance — review major cost heads." : "Variance within acceptable range."}`,
      cost_head_comparison: proportionalComparison(bd, tenderQuotedCr, fairEstimate.total_cost_cr)
    };
  }
}

function proportionalComparison(
  bd: AIEstimateResult["cost_breakdown"],
  tenderCr: number,
  fairTotal: number
): TenderCompareResult["cost_head_comparison"] {
  const ratio = tenderCr / fairTotal;
  return [
    { head: "Materials",          fair_cr: bd.materials_cr },
    { head: "Labour & Equipment", fair_cr: bd.labour_equipment_cr },
    { head: "Earthwork",          fair_cr: bd.earthwork_cr },
    { head: "Structures",         fair_cr: bd.structures_cr },
    { head: "Finishing",          fair_cr: bd.finishing_cr },
    { head: "Profit (10%)",       fair_cr: bd.profit_cr },
    { head: "Contingency (5%)",   fair_cr: bd.contingency_cr },
    { head: "GST (18%)",          fair_cr: bd.gst_cr }
  ].map((h) => {
    const tender_cr = r2(h.fair_cr * ratio);
    const vPct = r2(((tender_cr - h.fair_cr) / (h.fair_cr || 0.001)) * 100);
    return { ...h, tender_cr, variance_pct: vPct, suspicious: Math.abs(vPct) > 20 };
  });
}

// ─── PDF generation ───────────────────────────────────────────────────────────
function estimatePdfHtml(estimate: {
  project_name: string; project_type: string; state: string; district: string;
  financial_year: string; total_cost_cr: number; confidence_level: string;
  confidence_pct: number; ai_result: AIEstimateResult; ml_estimate_cr: number | null; created_at: Date;
}): string {
  const bd = estimate.ai_result.cost_breakdown;
  const breakdownRows: [string, number][] = [
    ["Materials",             bd.materials_cr],
    ["Labour & Equipment",    bd.labour_equipment_cr],
    ["Earthwork",             bd.earthwork_cr],
    ["Structures",            bd.structures_cr],
    ["Finishing",             bd.finishing_cr],
    ["Contractor Profit (10%)", bd.profit_cr],
    ["Contingency (5%)",      bd.contingency_cr],
    ["GST (18%)",             bd.gst_cr]
  ];
  const confColor = estimate.confidence_level === "High" ? "#16a34a" : estimate.confidence_level === "Medium" ? "#d97706" : "#dc2626";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:28px;color:#1e293b;font-size:12px}
  .hdr{background:#1e3a5f;color:#fff;padding:18px 22px;border-radius:6px;margin-bottom:20px}
  .hdr h1{margin:0 0 3px;font-size:18px}.hdr p{margin:0;opacity:.8;font-size:11px}
  .meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px}
  .mc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:10px 14px}
  .mc .lbl{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
  .mc .val{font-size:14px;font-weight:600;margin-top:2px}
  .total{background:#1e3a5f;color:#fff;border-radius:7px;padding:18px 22px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
  .amt{font-size:28px;font-weight:700}
  .stitle{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#475569;border-bottom:2px solid #e2e8f0;padding-bottom:5px;margin:16px 0 8px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#f1f5f9;padding:6px 8px;text-align:left;font-size:10px;font-weight:600;color:#475569;text-transform:uppercase}
  td{padding:6px 8px;border-bottom:1px solid #f1f5f9}
  .rH{color:#dc2626;font-weight:600}.rM{color:#d97706;font-weight:600}.rL{color:#16a34a;font-weight:600}
  .flag{background:#fef3c7;border:1px solid #f59e0b;border-radius:3px;padding:5px 8px;margin:3px 0;font-size:11px}
  .assm{padding:3px 0;color:#334155}.assm::before{content:"• ";color:#94a3b8}
  .foot{margin-top:24px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between}
</style></head><body>
<div class="hdr"><h1>CASPER — Fair Cost Estimate Report</h1>
<p>Government Tender Analysis & Evaluation Platform | ${new Date(estimate.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"})}</p></div>
<div class="meta">
  <div class="mc"><div class="lbl">Project Name</div><div class="val" style="font-size:12px">${estimate.project_name}</div></div>
  <div class="mc"><div class="lbl">Location</div><div class="val" style="font-size:12px">${estimate.district}, ${estimate.state}</div></div>
  <div class="mc"><div class="lbl">Financial Year</div><div class="val">${estimate.financial_year}</div></div>
  <div class="mc"><div class="lbl">Project Type</div><div class="val">${estimate.project_type}</div></div>
  <div class="mc"><div class="lbl">SOR Reference</div><div class="val" style="font-size:10px">${estimate.ai_result.sor_reference}</div></div>
  <div class="mc"><div class="lbl">Unit Rate</div><div class="val" style="font-size:11px">₹${estimate.ai_result.unit_rate.value.toFixed(3)} Cr ${estimate.ai_result.unit_rate.unit}</div></div>
</div>
<div class="total">
  <div><div style="font-size:11px;opacity:.75;margin-bottom:3px">FAIR COST ESTIMATE (MORTH/CPWD DSR 2023)</div>
    <div class="amt">₹${estimate.total_cost_cr.toFixed(2)} Crore</div>
    ${estimate.ml_estimate_cr ? `<div style="font-size:10px;opacity:.7;margin-top:3px">ML Cross-check: ₹${estimate.ml_estimate_cr.toFixed(2)} Cr</div>` : ""}
  </div>
  <div style="text-align:right">
    <div style="font-size:10px;opacity:.7;margin-bottom:3px">Confidence</div>
    <div style="font-size:20px;font-weight:700;color:${confColor}">${estimate.confidence_level}</div>
    <div style="font-size:11px;opacity:.8">${estimate.confidence_pct}%</div>
  </div>
</div>
<div class="stitle">Cost Breakdown</div>
<table><thead><tr><th>Cost Head</th><th style="text-align:right">Amount (₹ Cr)</th><th style="text-align:right">Share (%)</th></tr></thead>
<tbody>
${breakdownRows.map(([h,v])=>`<tr><td>${h}</td><td style="text-align:right">₹${v.toFixed(2)}</td><td style="text-align:right">${((v/estimate.total_cost_cr)*100).toFixed(1)}%</td></tr>`).join("")}
<tr style="font-weight:700;background:#f8fafc"><td>TOTAL</td><td style="text-align:right">₹${estimate.total_cost_cr.toFixed(2)}</td><td style="text-align:right">100%</td></tr>
</tbody></table>
${estimate.ai_result.risk_factors.length ? `<div class="stitle">Risk Factors</div><table><thead><tr><th>Factor</th><th>Impact</th><th>Severity</th></tr></thead><tbody>${estimate.ai_result.risk_factors.map(r=>`<tr><td>${r.factor}</td><td>${r.impact}</td><td class="r${r.severity[0]}">${r.severity}</td></tr>`).join("")}</tbody></table>` : ""}
${estimate.ai_result.assumptions.length ? `<div class="stitle">Assumptions</div>${estimate.ai_result.assumptions.map(a=>`<div class="assm">${a}</div>`).join("")}` : ""}
${estimate.ai_result.anomaly_flags.length ? `<div class="stitle">Anomaly Flags</div>${estimate.ai_result.anomaly_flags.map(f=>`<div class="flag">⚠ ${f}</div>`).join("")}` : ""}
${estimate.ai_result.comparable_projects.length ? `<div class="stitle">Comparable Projects</div><table><thead><tr><th>Project</th><th>Location</th><th>Year</th><th style="text-align:right">Cost</th><th>Source</th></tr></thead><tbody>${estimate.ai_result.comparable_projects.map(p=>`<tr><td>${p.name}</td><td>${p.location}</td><td>${p.year}</td><td style="text-align:right">₹${p.cost_cr}</td><td>${p.source}</td></tr>`).join("")}</tbody></table>` : ""}
<div class="foot"><span>CASPER — Government Tender Analysis Platform</span>
<span>Region: ${estimate.ai_result.region_adjustment.state} ×${estimate.ai_result.region_adjustment.multiplier} — ${estimate.ai_result.region_adjustment.reason}</span></div>
</body></html>`;
}

export async function generateEstimatePdf(estimate: Parameters<typeof estimatePdfHtml>[0]): Promise<Buffer> {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(estimatePdfHtml(estimate), { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }, printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
