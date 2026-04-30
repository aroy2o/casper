from pydantic import BaseModel
from typing import List, Optional, Literal


class PredictRequest(BaseModel):
    material: str
    state_code: Optional[str] = None
    district_code: Optional[str] = None


class StatePrediction(BaseModel):
    material: str
    stateCode: str
    stateName: str
    districtCode: Optional[str] = None
    districtName: Optional[str] = None
    predictedPriceINR: float
    lowerBoundINR: float
    upperBoundINR: float
    currentPriceINR: float
    deviationPct: float
    forecastMonth: str
    modelVersion: str
    confidence: float
    dataPointsUsed: int
    fallbackLevel: Literal["district", "state", "national"]


class PredictResponse(BaseModel):
    predictions: List[StatePrediction]


class CollusionAnalyzeRequest(BaseModel):
    state_code: Optional[str] = None
    limit: int = 100


class BidEntry(BaseModel):
    tender_number: str
    vendor: str
    amount: float
    state_code: str
    status: str


class CollusionResult(BaseModel):
    type: str
    description: str
    vendors_involved: List[str]
    states_involved: List[str]
    risk_score: float
    severity: Literal["low", "medium", "high", "critical"]
    details: dict


class CollusionAnalyzeResponse(BaseModel):
    flags: List[CollusionResult]


class RetrainRequest(BaseModel):
    material: Optional[str] = None
    force: bool = False


class RetrainResponse(BaseModel):
    status: str
    message: str
    models_retrained: int
