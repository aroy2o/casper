"""FastAPI router for cost estimation prediction endpoint."""
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from services.cost_estimator import predict

router = APIRouter(prefix="/estimate", tags=["estimate"])


class EstimatePredictRequest(BaseModel):
    project_type: str
    inputs: dict[str, Any]


class EstimatePredictResponse(BaseModel):
    ml_estimate_cr: float | None
    ml_model_version: str | None
    feature_importances: dict[str, float]
    explanations: dict[str, Any] | None = None


@router.post("/predict", response_model=EstimatePredictResponse)
def estimate_predict(req: EstimatePredictRequest) -> EstimatePredictResponse:
    result = predict(req.project_type, req.inputs)
    return EstimatePredictResponse(**result)
