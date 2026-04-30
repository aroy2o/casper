"""
Generate synthetic training data for the CASPER cost estimation ML models.
Uses SOR-based formulas to produce realistic cost figures per project type.

Run: python scripts/generate_training_data.py
Output: scripts/training_data_{type}.csv for each project type
"""
from __future__ import annotations

import random
import csv
import os
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent

random.seed(42)

# ── Regional multipliers ──────────────────────────────────────────────────────
STATE_MULTIPLIERS = {
    "Arunachal Pradesh": 1.45, "Nagaland": 1.40, "Manipur": 1.38,
    "Mizoram": 1.35, "Meghalaya": 1.32, "Sikkim": 1.30, "Tripura": 1.25,
    "Assam": 1.22, "Himachal Pradesh": 1.20, "Uttarakhand": 1.18,
    "Jammu & Kashmir": 1.25, "Ladakh": 1.40,
    "Delhi": 1.15, "Maharashtra": 1.10, "Gujarat": 1.05,
    "Karnataka": 1.08, "Tamil Nadu": 1.07, "Kerala": 1.12,
    "Andhra Pradesh": 1.05, "Telangana": 1.06, "Odisha": 1.00,
    "West Bengal": 1.03, "Bihar": 0.97, "Uttar Pradesh": 0.98,
    "Madhya Pradesh": 0.97, "Rajasthan": 1.02, "Haryana": 1.05,
    "Punjab": 1.04, "Chhattisgarh": 0.99, "Jharkhand": 0.98,
    "Goa": 1.08,
}
STATES = list(STATE_MULTIPLIERS.keys())


def rand_state() -> tuple[str, float]:
    s = random.choice(STATES)
    return s, STATE_MULTIPLIERS[s]


# ─────────────────────────────────────────────────────────────────────────────
# ROAD data generation
# Base: ₹1.5–3.0 Cr/km for single-lane bituminous plain road (MORTH 2023)
# ─────────────────────────────────────────────────────────────────────────────
ROAD_TYPE_FACTOR = {"NH": 1.20, "SH": 1.10, "MDR": 1.00, "Rural": 0.85}
SURFACE_FACTOR = {"Bituminous": 1.00, "Concrete": 1.25, "WBM": 0.70, "Gravel": 0.55}
TERRAIN_FACTOR = {"Plain": 1.00, "Rolling": 1.18, "Hilly": 1.40, "Steep": 1.65}
WIDTH_FACTOR = {3.75: 0.60, 7.0: 1.00, 14.0: 1.80, 21.0: 2.50}
SOIL_FACTOR = {"Good": 1.00, "Medium": 1.08, "Poor": 1.18}
DRAINAGE_FACTOR = {"None": 1.00, "Open drain": 1.08, "Covered drain": 1.15, "Both": 1.22}

ROAD_TYPES = ["NH", "SH", "MDR", "Rural"]
SURFACE_TYPES = ["Bituminous", "Concrete", "WBM", "Gravel"]
TERRAIN_TYPES = ["Plain", "Rolling", "Hilly", "Steep"]
WIDTH_OPTIONS = [3.75, 7.0, 14.0, 21.0]
SOIL_TYPES = ["Good", "Medium", "Poor"]
DRAIN_TYPES = ["None", "Open drain", "Covered drain", "Both"]


def gen_road_row() -> dict:
    state, reg = rand_state()
    length = round(random.uniform(0.5, 50.0), 2)
    width = random.choice(WIDTH_OPTIONS)
    road_type = random.choice(ROAD_TYPES)
    surface = random.choice(SURFACE_TYPES)
    terrain = random.choice(TERRAIN_TYPES)
    embankment = round(random.uniform(0, 4), 1)
    culverts = random.randint(0, 20)
    minor_bridges = random.randint(0, 5)
    drainage = random.choice(DRAIN_TYPES)
    soil = random.choice(SOIL_TYPES)

    base_rate = random.uniform(1.8, 2.8)  # Cr/km
    cost = (
        base_rate * length
        * ROAD_TYPE_FACTOR[road_type]
        * SURFACE_FACTOR[surface]
        * TERRAIN_FACTOR[terrain]
        * WIDTH_FACTOR.get(width, 1.0)
        * SOIL_FACTOR[soil]
        * DRAINAGE_FACTOR[drainage]
        * reg
        * (1 + embankment * 0.02)
        * (1 + culverts * 0.008)
        * (1 + minor_bridges * 0.05)
        * random.uniform(0.92, 1.08)  # noise
    )
    cost = round(cost, 3)

    return {
        "length_km": length, "width_m": width, "road_type": road_type,
        "surface_type": surface, "terrain": terrain, "embankment_height_m": embankment,
        "num_culverts": culverts, "num_minor_bridges": minor_bridges,
        "drainage_type": drainage, "subgrade_soil": soil, "state": state,
        "target_cost_cr": cost,
    }


# ─────────────────────────────────────────────────────────────────────────────
# BRIDGE  (base ₹35,000–55,000/sqm for RCC slab, plain)
# ─────────────────────────────────────────────────────────────────────────────
BRIDGE_TYPE_FACTOR = {"RCC Slab": 1.00, "PSC Girder": 1.30, "Steel Truss": 1.60, "Cable-Stayed": 2.40}
FOUNDATION_FACTOR = {"Open": 1.00, "Pile": 1.20, "Well": 1.35}
RIVERBED_FACTOR = {"Soil": 1.00, "Rock": 0.90, "Mixed": 1.05}

BRIDGE_TYPES = ["RCC Slab", "PSC Girder", "Steel Truss", "Cable-Stayed"]
FOUNDATION_TYPES = ["Open", "Pile", "Well"]
RIVERBED_TYPES = ["Soil", "Rock", "Mixed"]


def gen_bridge_row() -> dict:
    state, reg = rand_state()
    total_length = round(random.uniform(10, 600), 1)
    width = round(random.uniform(5, 24), 1)
    num_spans = random.randint(1, 20)
    span_length = round(total_length / num_spans, 1)
    bridge_type = random.choice(BRIDGE_TYPES)
    foundation = random.choice(FOUNDATION_TYPES)
    riverbed = random.choice(RIVERBED_TYPES)
    flood = round(random.uniform(100, 5000), 0) if random.random() > 0.3 else 0
    approach = round(random.uniform(0, 500), 0)

    area = total_length * width
    base_rate_per_sqm = random.uniform(35000, 55000)  # INR
    cost_inr = (
        area * base_rate_per_sqm
        * BRIDGE_TYPE_FACTOR[bridge_type]
        * FOUNDATION_FACTOR[foundation]
        * RIVERBED_FACTOR[riverbed]
        * reg
        * (1 + approach * 0.0001)
        * random.uniform(0.90, 1.10)
    )
    cost_cr = round(cost_inr / 1e7, 3)

    return {
        "total_length_m": total_length, "width_m": width, "num_spans": num_spans,
        "span_length_m": span_length, "bridge_type": bridge_type,
        "foundation_type": foundation, "river_bed_material": riverbed,
        "max_flood_discharge": flood, "approach_road_length_m": approach,
        "state": state, "target_cost_cr": cost_cr,
    }


# ─────────────────────────────────────────────────────────────────────────────
# BUILDING  (base ₹18,000–30,000/sqm depending on type & finish)
# ─────────────────────────────────────────────────────────────────────────────
BUILDING_TYPE_FACTOR = {"Residential": 1.00, "Office": 1.15, "Hospital": 1.45, "School": 1.10, "Other": 1.05}
CONSTRUCTION_FACTOR = {"Load-bearing": 0.90, "RCC Frame": 1.00, "Steel Frame": 1.25}
FINISH_FACTOR = {"Basic": 0.85, "Standard": 1.00, "Premium": 1.30}
SITE_FACTOR = {"Plain": 1.00, "Sloped": 1.08}

BUILDING_TYPES = ["Residential", "Office", "Hospital", "School", "Other"]
CONSTRUCTION_TYPES = ["Load-bearing", "RCC Frame", "Steel Frame"]
FINISH_LEVELS = ["Basic", "Standard", "Premium"]
SITE_CONDITIONS = ["Plain", "Sloped"]


def gen_building_row() -> dict:
    state, reg = rand_state()
    num_floors = random.randint(1, 20)
    plinth_area = round(random.uniform(100, 2000), 0)
    btype = random.choice(BUILDING_TYPES)
    construction = random.choice(CONSTRUCTION_TYPES)
    finish = random.choice(FINISH_LEVELS)
    site = random.choice(SITE_CONDITIONS)
    toilets = random.randint(0, 20)
    lifts = random.randint(0, 5)
    staircases = random.randint(1, 6)

    total_area = num_floors * plinth_area
    base_rate = random.uniform(18000, 30000)  # INR/sqm
    cost_inr = (
        total_area * base_rate
        * BUILDING_TYPE_FACTOR[btype]
        * CONSTRUCTION_FACTOR[construction]
        * FINISH_FACTOR[finish]
        * SITE_FACTOR[site]
        * reg
        * (1 + toilets * 0.003)
        * (1 + lifts * 0.015)
        * (1 + staircases * 0.005)
        * random.uniform(0.92, 1.08)
    )
    cost_cr = round(cost_inr / 1e7, 3)

    return {
        "building_type": btype, "num_floors": num_floors,
        "plinth_area_per_floor_sqm": plinth_area, "construction_type": construction,
        "finishing_level": finish, "site_condition": site, "num_toilets": toilets,
        "num_lifts": lifts, "num_staircases": staircases, "state": state,
        "target_cost_cr": cost_cr,
    }


# ─────────────────────────────────────────────────────────────────────────────
# DRAINAGE  (base ₹0.8–2.5 Cr/km depending on diameter & material)
# ─────────────────────────────────────────────────────────────────────────────
PIPE_MATERIAL_FACTOR = {"RCC": 1.00, "DI": 1.30, "HDPE": 0.85, "PVC": 0.75}
DRAIN_TERRAIN_FACTOR = {"Urban": 1.20, "Semi-urban": 1.00, "Rural": 0.85}

PIPE_MATERIALS = ["RCC", "DI", "HDPE", "PVC"]
DRAIN_TERRAINS = ["Urban", "Semi-urban", "Rural"]


def gen_drainage_row() -> dict:
    state, reg = rand_state()
    network_km = round(random.uniform(0.5, 30), 2)
    dia_min = random.choice([100, 150, 200, 250, 300])
    dia_max = random.choice([300, 450, 600, 800, 1000, 1200])
    if dia_max < dia_min:
        dia_min, dia_max = dia_max, dia_min
    material = random.choice(PIPE_MATERIALS)
    depth = round(random.uniform(1.0, 6.0), 1)
    terrain = random.choice(DRAIN_TERRAINS)
    manholes = random.randint(5, 200)
    has_treatment = random.random() > 0.5
    treatment_mld = round(random.uniform(1, 50), 1) if has_treatment else 0

    avg_dia_factor = (dia_max / 600)  # normalise around 600mm
    depth_factor = 1 + (depth - 2.5) * 0.08
    base_rate = random.uniform(0.8, 1.5)  # Cr/km

    cost = (
        base_rate * network_km
        * avg_dia_factor
        * PIPE_MATERIAL_FACTOR[material]
        * depth_factor
        * DRAIN_TERRAIN_FACTOR[terrain]
        * reg
        * (1 + manholes * 0.0005)
        * (1 + treatment_mld * 0.002)
        * random.uniform(0.90, 1.10)
    )
    cost_cr = round(cost, 3)

    return {
        "network_length_km": network_km, "pipe_diameter_min_mm": dia_min,
        "pipe_diameter_max_mm": dia_max, "pipe_material": material,
        "depth_of_laying_m": depth, "terrain": terrain, "num_manholes": manholes,
        "treatment_plant_required": has_treatment,
        "treatment_capacity_mld": treatment_mld, "state": state,
        "target_cost_cr": cost_cr,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
GENERATORS = {
    "ROAD": gen_road_row,
    "BRIDGE": gen_bridge_row,
    "BUILDING": gen_building_row,
    "DRAINAGE": gen_drainage_row,
}

N_ROWS = 3000  # per project type


def main() -> None:
    for ptype, gen_fn in GENERATORS.items():
        rows = [gen_fn() for _ in range(N_ROWS)]
        filepath = OUTPUT_DIR / f"training_data_{ptype.lower()}.csv"
        fieldnames = list(rows[0].keys())
        with open(filepath, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"[{ptype}] Written {N_ROWS} rows → {filepath}")

    print("Done. Run train_cost_model.py next.")


if __name__ == "__main__":
    main()
