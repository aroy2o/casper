import { z } from "zod";

const commonFields = {
  project_name: z.string().min(2).max(200),
  district: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  financial_year: z.string().regex(/^\d{4}-\d{2}$/, "Use format YYYY-YY (e.g. 2024-25)")
};

const roadSchema = z.object({
  ...commonFields,
  project_type: z.literal("ROAD"),
  length_km: z.coerce.number().positive(),
  width_m: z.coerce.number().positive(),
  road_type: z.enum(["NH", "SH", "MDR", "Rural"]),
  surface_type: z.enum(["Bituminous", "Concrete", "WBM", "Gravel"]),
  terrain: z.enum(["Plain", "Rolling", "Hilly", "Steep"]),
  embankment_height_m: z.coerce.number().min(0).default(0),
  num_culverts: z.coerce.number().int().min(0).default(0),
  num_minor_bridges: z.coerce.number().int().min(0).default(0),
  drainage_type: z.enum(["Open drain", "Covered drain", "Both", "None"]),
  subgrade_soil: z.enum(["Good", "Medium", "Poor"])
});

const bridgeSchema = z.object({
  ...commonFields,
  project_type: z.literal("BRIDGE"),
  total_length_m: z.coerce.number().positive(),
  width_m: z.coerce.number().positive(),
  num_spans: z.coerce.number().int().positive(),
  span_length_m: z.coerce.number().positive(),
  bridge_type: z.enum(["RCC Slab", "PSC Girder", "Steel Truss", "Cable-Stayed"]),
  foundation_type: z.enum(["Open", "Pile", "Well"]),
  river_bed_material: z.enum(["Soil", "Rock", "Mixed"]),
  max_flood_discharge: z.coerce.number().optional(),
  approach_road_length_m: z.coerce.number().min(0).default(0)
});

const buildingSchema = z.object({
  ...commonFields,
  project_type: z.literal("BUILDING"),
  building_type: z.enum(["Residential", "Office", "Hospital", "School", "Other"]),
  num_floors: z.coerce.number().int().positive(),
  plinth_area_per_floor_sqm: z.coerce.number().positive(),
  construction_type: z.enum(["Load-bearing", "RCC Frame", "Steel Frame"]),
  finishing_level: z.enum(["Basic", "Standard", "Premium"]),
  site_condition: z.enum(["Plain", "Sloped"]),
  num_toilets: z.coerce.number().int().min(0).default(0),
  num_lifts: z.coerce.number().int().min(0).default(0),
  num_staircases: z.coerce.number().int().min(1).default(1)
});

const drainageSchema = z.object({
  ...commonFields,
  project_type: z.literal("DRAINAGE"),
  network_length_km: z.coerce.number().positive(),
  pipe_diameter_min_mm: z.coerce.number().min(100).max(1200),
  pipe_diameter_max_mm: z.coerce.number().min(100).max(1200),
  pipe_material: z.enum(["RCC", "DI", "HDPE", "PVC"]),
  depth_of_laying_m: z.coerce.number().positive(),
  terrain: z.enum(["Urban", "Semi-urban", "Rural"]),
  num_manholes: z.coerce.number().int().min(0).default(0),
  treatment_plant_required: z.coerce.boolean(),
  treatment_capacity_mld: z.coerce.number().optional()
});

export const generateEstimateSchema = z.discriminatedUnion("project_type", [
  roadSchema,
  bridgeSchema,
  buildingSchema,
  drainageSchema
]);

export type GenerateEstimateInput = z.infer<typeof generateEstimateSchema>;

export const compareEstimateSchema = z.object({
  tender_quoted_cr: z.coerce.number().positive("Tender amount must be positive")
});

export const listEstimatesQuerySchema = z.object({
  project_type: z.enum(["ROAD", "BRIDGE", "BUILDING", "DRAINAGE"]).optional(),
  state: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});
