import logging
from fastapi import APIRouter, BackgroundTasks, Query
from typing import Optional
from models.prediction_schemas import (
    PredictRequest, PredictResponse,
    CollusionAnalyzeRequest, CollusionAnalyzeResponse, CollusionResult,
    RetrainRequest, RetrainResponse,
)
from services.price_predictor import predict_next_month, predict_all_states, retrain_all
from services.collusion_detector import detect_collusion

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["analytics"])

VALID_MATERIALS = [
    "cement", "steel_rod", "coarse_sand", "fine_sand",
    "aggregate_20mm", "brick", "bitumen", "rcc_pipe",
]


@router.post("/predict", response_model=PredictResponse)
def predict_price(payload: PredictRequest) -> PredictResponse:
    material = payload.material if payload.material in VALID_MATERIALS else "cement"

    if payload.state_code:
        pred = predict_next_month(material, payload.state_code, payload.district_code)
        predictions = [pred]
    else:
        predictions = predict_all_states(material)

    return PredictResponse(predictions=predictions)


@router.get("/predict")
def predict_price_get(
    item: str = Query("cement"),
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
) -> dict:
    material = item if item in VALID_MATERIALS else "cement"
    if state:
        pred = predict_next_month(material, state, district)
        return {"success": True, "data": {"predictions": [pred]}}
    else:
        preds = predict_all_states(material)
        return {"success": True, "data": {"predictions": preds}}


@router.post("/collusion/analyze", response_model=CollusionAnalyzeResponse)
def analyze_collusion(payload: CollusionAnalyzeRequest) -> CollusionAnalyzeResponse:
    raw_flags = detect_collusion(payload.state_code, payload.limit)
    flags = [
        CollusionResult(
            type=f["type"],
            description=f["description"],
            vendors_involved=f["vendors_involved"],
            states_involved=f["states_involved"],
            risk_score=f["risk_score"],
            severity=f["severity"],
            details=f["details"],
        )
        for f in raw_flags
    ]
    return CollusionAnalyzeResponse(flags=flags)


@router.post("/retrain", response_model=RetrainResponse)
def retrain_models(payload: RetrainRequest, background_tasks: BackgroundTasks) -> RetrainResponse:
    materials = [payload.material] if payload.material else None
    if payload.force:
        background_tasks.add_task(retrain_all, materials)
        return RetrainResponse(
            status="started",
            message="Retraining started in background",
            models_retrained=0
        )
    else:
        count = retrain_all(materials)
        return RetrainResponse(
            status="complete",
            message=f"Retrained {count} models",
            models_retrained=count
        )


@router.get("/states")
def get_state_predictions(item: str = Query("cement")) -> dict:
    material = item if item in VALID_MATERIALS else "cement"
    preds = predict_all_states(material)
    return {"success": True, "data": {"material": material, "predictions": preds}}
