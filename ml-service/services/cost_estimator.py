"""Cost estimation model service — loads trained XGBoost models and runs inference."""
from __future__ import annotations

import os
import json
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent.parent / "saved_models"
MODEL_DIR.mkdir(exist_ok=True)

PROJECT_TYPES = ["ROAD", "BRIDGE", "BUILDING", "DRAINAGE"]

# Label encodings — must match generate_training_data.py
ROAD_ENCODINGS = {
    "road_type": {"NH": 0, "SH": 1, "MDR": 2, "Rural": 3},
    "surface_type": {"Bituminous": 0, "Concrete": 1, "WBM": 2, "Gravel": 3},
    "terrain": {"Plain": 0, "Rolling": 1, "Hilly": 2, "Steep": 3},
    "drainage_type": {"None": 0, "Open drain": 1, "Covered drain": 2, "Both": 3},
    "subgrade_soil": {"Good": 0, "Medium": 1, "Poor": 2},
}

BRIDGE_ENCODINGS = {
    "bridge_type": {"RCC Slab": 0, "PSC Girder": 1, "Steel Truss": 2, "Cable-Stayed": 3},
    "foundation_type": {"Open": 0, "Pile": 1, "Well": 2},
    "river_bed_material": {"Soil": 0, "Rock": 1, "Mixed": 2},
}

BUILDING_ENCODINGS = {
    "building_type": {"Residential": 0, "Office": 1, "Hospital": 2, "School": 3, "Other": 4},
    "construction_type": {"Load-bearing": 0, "RCC Frame": 1, "Steel Frame": 2},
    "finishing_level": {"Basic": 0, "Standard": 1, "Premium": 2},
    "site_condition": {"Plain": 0, "Sloped": 1},
}

DRAINAGE_ENCODINGS = {
    "pipe_material": {"RCC": 0, "DI": 1, "HDPE": 2, "PVC": 3},
    "terrain": {"Urban": 0, "Semi-urban": 1, "Rural": 2},
}

FEATURE_MAPS: dict[str, dict[str, Any]] = {
    "ROAD": {
        "numeric": ["length_km", "width_m", "embankment_height_m", "num_culverts", "num_minor_bridges"],
        "categorical": ROAD_ENCODINGS,
    },
    "BRIDGE": {
        "numeric": ["total_length_m", "width_m", "num_spans", "span_length_m", "approach_road_length_m", "max_flood_discharge"],
        "categorical": BRIDGE_ENCODINGS,
    },
    "BUILDING": {
        "numeric": ["num_floors", "plinth_area_per_floor_sqm", "num_toilets", "num_lifts", "num_staircases"],
        "categorical": BUILDING_ENCODINGS,
    },
    "DRAINAGE": {
        "numeric": ["network_length_km", "pipe_diameter_min_mm", "pipe_diameter_max_mm", "depth_of_laying_m", "num_manholes", "treatment_capacity_mld"],
        "categorical": DRAINAGE_ENCODINGS,
        "boolean": ["treatment_plant_required"],
    },
}

_models: dict[str, Any] = {}


def _model_path(project_type: str) -> Path:
    return MODEL_DIR / f"cost_estimator_{project_type.lower()}.pkl"


def load_models() -> int:
    """Load all available trained models into memory. Returns count loaded."""
    loaded = 0
    for pt in PROJECT_TYPES:
        path = _model_path(pt)
        if path.exists():
            try:
                _models[pt] = joblib.load(path)
                logger.info("Loaded cost estimator model: %s", pt)
                loaded += 1
            except Exception as exc:
                logger.warning("Failed to load model %s: %s", pt, exc)
    return loaded


def _build_feature_vector(project_type: str, inputs: dict[str, Any]) -> np.ndarray:
    """Encode inputs to a fixed-length feature vector."""
    fmap = FEATURE_MAPS[project_type]
    features: list[float] = []

    for col in fmap["numeric"]:
        val = inputs.get(col)
        features.append(float(val) if val is not None else 0.0)

    for col, mapping in fmap["categorical"].items():
        val = inputs.get(col, "")
        features.append(float(mapping.get(str(val), 0)))

    for col in fmap.get("boolean", []):
        val = inputs.get(col, False)
        features.append(1.0 if val else 0.0)

    return np.array(features, dtype=np.float64).reshape(1, -1)


def predict(project_type: str, inputs: dict[str, Any]) -> dict[str, Any]:
    """
    Run cost estimation prediction.
    Returns ml_estimate_cr and feature_importances if model is available.
    """
    pt = project_type.upper()

    if pt not in _models:
        loaded = load_models()
        if pt not in _models:
            logger.warning("No trained model for %s (loaded %d total)", pt, loaded)
            return {"ml_estimate_cr": None, "ml_model_version": None, "feature_importances": {}}

    model = _models[pt]
    X = _build_feature_vector(pt, inputs)

    try:
        pred = float(model.predict(X)[0])
        pred = max(0.01, pred)
    except Exception as exc:
        logger.error("Prediction failed for %s: %s", pt, exc)
        return {"ml_estimate_cr": None, "ml_model_version": None, "feature_importances": {}}

    # Feature importance mapping
    fmap = FEATURE_MAPS[pt]
    feature_names = (
        fmap["numeric"]
        + list(fmap["categorical"].keys())
        + fmap.get("boolean", [])
    )
    importances: dict[str, float] = {}
    if hasattr(model, "feature_importances_"):
        imp = model.feature_importances_
        for name, score in zip(feature_names, imp):
            importances[name] = round(float(score), 4)

    version_file = _model_path(pt).with_suffix(".version.json")
    version = "v1.0"
    if version_file.exists():
        try:
            version = json.loads(version_file.read_text()).get("version", "v1.0")
        except Exception:
            pass

    explanations: dict[str, Any] = {
        "items": [],
        "summary": None,
        "explanation_version": "shap-treexplainer-v1",
    }
    try:
        import shap  # type: ignore

        feature_values = X[0]
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X)
        if isinstance(shap_values, list):
            shap_row = np.array(shap_values[0][0], dtype=float)
        else:
            shap_row = np.array(shap_values[0], dtype=float)

        top_idx = np.argsort(np.abs(shap_row))[-3:][::-1]
        top_factors: list[dict[str, Any]] = []
        for idx in top_idx:
            impact = float(shap_row[idx])
            top_factors.append(
                {
                    "feature": feature_names[int(idx)],
                    "impact": round(abs(impact), 4),
                    "direction": "increased" if impact >= 0 else "reduced",
                    "feature_value": round(float(feature_values[int(idx)]), 4),
                }
            )

        quoted_total_cr = float(inputs.get("quoted_total_cr", pred))
        benchmark_cr = float(pred)
        if benchmark_cr <= 0:
            deviation_pct = 0.0
        else:
            deviation_pct = ((quoted_total_cr - benchmark_cr) / benchmark_cr) * 100.0

        if deviation_pct > 15:
            verdict = "OVERPRICED"
        elif deviation_pct < -10:
            verdict = "UNDERPRICED"
        else:
            verdict = "FAIR"

        factors_text = ", ".join(
            [
                f"{f['feature'].replace('_', ' ')} ({f['direction']} cost impact)"
                for f in top_factors
            ]
        )
        human_summary = (
            f"Quoted value is {abs(deviation_pct):.1f}% "
            f"{'above' if deviation_pct >= 0 else 'below'} the benchmark estimate. "
            f"Primary drivers: {factors_text}."
        )
        explanations["items"] = [
            {
                "deviation_pct": round(deviation_pct, 2),
                "verdict": verdict,
                "top_factors": top_factors,
                "human_summary": human_summary,
                "quoted_total_cr": round(quoted_total_cr, 2),
                "benchmark_total_cr": round(benchmark_cr, 2),
            }
        ]
        explanations["summary"] = human_summary
    except ModuleNotFoundError:
        logger.warning("SHAP not installed; skipping explainability output")
    except Exception as exc:
        logger.warning("SHAP explanation generation failed for %s: %s", pt, exc)

    return {
        "ml_estimate_cr": round(pred, 2),
        "ml_model_version": f"{pt.lower()}-{version}",
        "feature_importances": importances,
        "explanations": explanations,
    }
