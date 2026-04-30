from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class ParseRequest(BaseModel):
    filePath: str = Field(min_length=1)


class ParsedLineItem(BaseModel):
    description: str
    quantity: float
    unit: str
    quotedRateINR: float


class ParseResponse(BaseModel):
    lineItems: List[ParsedLineItem]


class AuditRequest(BaseModel):
    lineItems: List[ParsedLineItem]
    region: str


class AuditFlag(BaseModel):
    lineItemDescription: str
    quotedRateINR: float
    marketRateINR: float
    inflationPct: float
    confidence: float
    explanation: str


class AuditResponse(BaseModel):
    flags: List[AuditFlag]
    modelVersion: str


class AuditTextPrice(BaseModel):
    material: str
    marketRatePerUnit: float
    unit: str


class AuditTextRequest(BaseModel):
    text: str = Field(min_length=1)
    prices: List[AuditTextPrice]


class AuditTextLineItem(BaseModel):
    description: str
    quantity: Optional[float]
    unit: str
    quotedRateINR: Optional[float]
    marketRateINR: Optional[float]
    inflationPct: Optional[float]
    flagged: bool


class AuditTextResponse(BaseModel):
    lineItems: List[AuditTextLineItem]
    riskLevel: Literal["low", "medium", "high", "critical"]
    overallInflationPct: float
    totalOverpricedINR: float
    summary: str


class FullAuditRequest(BaseModel):
    text: str = Field(min_length=1)
    title: str = ""
    department: str = ""


class FlaggedItem(BaseModel):
    item: str
    quoted_rate: float
    market_rate: float
    deviation_pct: float
    flag: Literal["overpriced", "underpriced", "ok"]
    human_summary: Optional[str] = None
    verdict: Optional[str] = None
    top_factors: List[dict] = []
    risk_contribution: Optional[float] = None


class FullAuditResponse(BaseModel):
    verdict: Literal["overpriced", "neutral", "underpriced"]
    confidence: Literal["high", "medium", "low"]
    summary: str
    flagged_items: List[FlaggedItem]
    risk_signals: List[str]
    recommendation: str
    plain_english_summary: Optional[str] = None
    overall_verdict: Optional[str] = None
    explanation_version: Optional[str] = None
