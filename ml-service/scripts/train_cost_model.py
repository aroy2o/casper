"""
Train XGBoost cost estimation models from generated training data.

Run AFTER generate_training_data.py:
  python scripts/generate_training_data.py
  python scripts/train_cost_model.py

Saves models to: saved_models/cost_estimator_{type}.pkl
"""
from __future__ import annotations

import sys
import json
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

try:
    from xgboost import XGBRegressor
except ImportError:
    print("xgboost not installed — run: pip install xgboost")
    sys.exit(1)

SCRIPTS_DIR = Path(__file__).parent
MODEL_DIR = SCRIPTS_DIR.parent / "saved_models"
MODEL_DIR.mkdir(exist_ok=True)

# Label encodings — must stay in sync with cost_estimator.py
CATEGORICAL_COLS = {
    "ROAD": {
        "road_type": {"NH": 0, "SH": 1, "MDR": 2, "Rural": 3},
        "surface_type": {"Bituminous": 0, "Concrete": 1, "WBM": 2, "Gravel": 3},
        "terrain": {"Plain": 0, "Rolling": 1, "Hilly": 2, "Steep": 3},
        "drainage_type": {"None": 0, "Open drain": 1, "Covered drain": 2, "Both": 3},
        "subgrade_soil": {"Good": 0, "Medium": 1, "Poor": 2},
    },
    "BRIDGE": {
        "bridge_type": {"RCC Slab": 0, "PSC Girder": 1, "Steel Truss": 2, "Cable-Stayed": 3},
        "foundation_type": {"Open": 0, "Pile": 1, "Well": 2},
        "river_bed_material": {"Soil": 0, "Rock": 1, "Mixed": 2},
    },
    "BUILDING": {
        "building_type": {"Residential": 0, "Office": 1, "Hospital": 2, "School": 3, "Other": 4},
        "construction_type": {"Load-bearing": 0, "RCC Frame": 1, "Steel Frame": 2},
        "finishing_level": {"Basic": 0, "Standard": 1, "Premium": 2},
        "site_condition": {"Plain": 0, "Sloped": 1},
    },
    "DRAINAGE": {
        "pipe_material": {"RCC": 0, "DI": 1, "HDPE": 2, "PVC": 3},
        "terrain": {"Urban": 0, "Semi-urban": 1, "Rural": 2},
    },
}

BOOLEAN_COLS = {
    "ROAD": [],
    "BRIDGE": [],
    "BUILDING": [],
    "DRAINAGE": ["treatment_plant_required"],
}

# Drop columns not used as features
DROP_COLS = ["state", "target_cost_cr"]

XGB_PARAMS = {
    "n_estimators": 400,
    "max_depth": 6,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "min_child_weight": 3,
    "random_state": 42,
    "n_jobs": -1,
}


def encode_df(df: pd.DataFrame, ptype: str) -> pd.DataFrame:
    cat_maps = CATEGORICAL_COLS[ptype]
    bool_cols = BOOLEAN_COLS[ptype]

    for col, mapping in cat_maps.items():
        if col in df.columns:
            df[col] = df[col].map(mapping).fillna(0).astype(float)

    for col in bool_cols:
        if col in df.columns:
            df[col] = df[col].astype(bool).astype(float)

    return df


def train_one(ptype: str) -> None:
    csv_path = SCRIPTS_DIR / f"training_data_{ptype.lower()}.csv"
    if not csv_path.exists():
        print(f"[{ptype}] CSV not found at {csv_path} — skipping. Run generate_training_data.py first.")
        return

    df = pd.read_csv(csv_path)
    target = df["target_cost_cr"].values
    df = df.drop(columns=[c for c in DROP_COLS if c in df.columns])
    df = encode_df(df, ptype)

    X = df.values.astype(np.float64)
    y = target.astype(np.float64)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=42)

    model = XGBRegressor(**XGB_PARAMS)
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    mape = float(np.mean(np.abs((y_test - y_pred) / (y_test + 1e-9))) * 100)

    print(f"[{ptype}] MAE=₹{mae:.3f} Cr  R²={r2:.4f}  MAPE={mape:.2f}%")

    model_path = MODEL_DIR / f"cost_estimator_{ptype.lower()}.pkl"
    joblib.dump(model, model_path)

    version_path = model_path.with_suffix(".version.json")
    version_path.write_text(json.dumps({"version": "v1.0", "mae_cr": round(mae, 3), "r2": round(r2, 4), "mape_pct": round(mape, 2)}))

    print(f"[{ptype}] Model saved → {model_path}")


def main() -> None:
    types = sys.argv[1:] if len(sys.argv) > 1 else ["ROAD", "BRIDGE", "BUILDING", "DRAINAGE"]
    for ptype in types:
        train_one(ptype.upper())
    print("\nAll done. Models in saved_models/")


if __name__ == "__main__":
    main()
