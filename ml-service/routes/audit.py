import os
import re
import json
import requests
from fastapi import APIRouter, HTTPException
from models.schemas import (
    AuditRequest,
    AuditResponse,
    AuditTextLineItem,
    AuditTextRequest,
    AuditTextResponse,
    FullAuditRequest,
    FullAuditResponse,
    FlaggedItem,
)
from services.price_model import audit_line_items

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_AUDIT_MODEL = os.getenv("OLLAMA_AUDIT_MODEL", "llama3.1")

AUDIT_SYSTEM_PROMPT = """You are a procurement auditor for Indian government tenders. Return ONLY valid JSON — no markdown, no explanation.

JSON structure:
{"verdict":"overpriced"|"neutral"|"underpriced","confidence":"high"|"medium"|"low","summary":"2-3 sentences","flagged_items":[{"item":"","quoted_rate":0,"market_rate":0,"deviation_pct":0,"flag":"overpriced"|"underpriced"|"ok"}],"risk_signals":[""],"recommendation":"one sentence"}

2024-25 benchmarks: Cement 350-420/bag, TMT steel 52000-58000/tonne, Bitumen 45000-52000/tonne, Sand 30-45/cft, Aggregate 40-55/cft, Labour 700-900/day.
Flag items >15% above market. If no rates, judge by total value and scope."""


def _preprocess_text(text: str) -> str:
    text = re.sub(r"\r\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.MULTILINE)
    return text.strip()


def _call_ollama_audit(prompt: str) -> dict:
    response = requests.post(
        f"{OLLAMA_BASE_URL}/api/generate",
        json={
            "model": OLLAMA_AUDIT_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"num_predict": 1200, "temperature": 0.1},
        },
        timeout=120,
    )
    response.raise_for_status()
    raw = str(response.json().get("response", "{}"))
    return json.loads(raw)

router = APIRouter(prefix="/audit", tags=["audit"])


@router.post("", response_model=AuditResponse)
def audit_endpoint(payload: AuditRequest) -> AuditResponse:
    flags = audit_line_items(payload.lineItems, payload.region)
    return AuditResponse(flags=flags, modelVersion="rule_v1")


@router.post("/text", response_model=AuditTextResponse)
def audit_text_endpoint(payload: AuditTextRequest) -> AuditTextResponse:
    pattern = re.compile(r"(\d[\d,]*\.?\d*)\s*(bags?|MT|kg|ton|cum|sqm|nos?|units?)\s*[@at]+\s*[₹Rs.INR\s]*([\d,]*\.?\d+)", re.IGNORECASE)
    normalized_prices = [
        {
            "material": p.material.lower().strip(),
            "unit": p.unit.lower().strip(),
            "market_rate": p.marketRatePerUnit,
        }
        for p in payload.prices
    ]

    line_items: list[AuditTextLineItem] = []
    total_overpriced = 0.0
    inflation_values: list[float] = []

    for match in pattern.finditer(payload.text):
        qty = float((match.group(1) or "0").replace(",", ""))
        unit = (match.group(2) or "nos").lower()
        quoted_rate = float((match.group(3) or "0").replace(",", ""))
        description = match.group(0)

        best = None
        desc_lower = description.lower()
        for candidate in normalized_prices:
            if candidate["unit"] == unit and candidate["material"] in desc_lower:
                best = candidate
                break

        market_rate = best["market_rate"] if best else None
        inflation_pct = None
        flagged = False

        if market_rate and market_rate > 0:
            inflation_pct = ((quoted_rate - market_rate) / market_rate) * 100.0
            inflation_values.append(inflation_pct)
            if inflation_pct > 15.0:
                flagged = True
                total_overpriced += max(0.0, quoted_rate - market_rate) * qty

        line_items.append(
            AuditTextLineItem(
                description=description,
                quantity=qty,
                unit=unit,
                quotedRateINR=quoted_rate,
                marketRateINR=market_rate,
                inflationPct=inflation_pct,
                flagged=flagged,
            )
        )

    overall_inflation = sum(inflation_values) / len(inflation_values) if inflation_values else 0.0

    if overall_inflation > 50:
        risk = "critical"
    elif overall_inflation > 30:
        risk = "high"
    elif overall_inflation > 10:
        risk = "medium"
    else:
        risk = "low"

    return AuditTextResponse(
        lineItems=line_items,
        riskLevel=risk,
        overallInflationPct=round(overall_inflation, 2),
        totalOverpricedINR=round(total_overpriced, 2),
        summary=f"Analyzed {len(line_items)} line items from provided text.",
    )


@router.post("/full", response_model=FullAuditResponse)
def audit_full_endpoint(payload: FullAuditRequest) -> FullAuditResponse:
    context = ""
    if payload.title:
        context += f"Tender: {payload.title}\n"
    if payload.department:
        context += f"Dept: {payload.department}\n"

    cleaned_text = _preprocess_text(payload.text)[:5000]
    prompt = f"{AUDIT_SYSTEM_PROMPT}\n\n{context}--- DOCUMENT ---\n{cleaned_text}\n--- END ---"

    try:
        data = _call_ollama_audit(prompt)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"Ollama returned malformed JSON: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Ollama unreachable: {exc}") from exc

    verdict = data.get("verdict", "neutral")
    if verdict not in ("overpriced", "neutral", "underpriced"):
        verdict = "neutral"
    confidence = data.get("confidence", "low")
    if confidence not in ("high", "medium", "low"):
        confidence = "low"

    raw_items = data.get("flagged_items", [])
    flagged_items: list[FlaggedItem] = []
    for it in raw_items:
        if not isinstance(it, dict):
            continue
        flag_val = it.get("flag", "ok")
        if flag_val not in ("overpriced", "underpriced", "ok"):
            flag_val = "ok"
        try:
            flagged_items.append(
                FlaggedItem(
                    item=str(it.get("item", "Unknown")),
                    quoted_rate=float(it.get("quoted_rate", 0)),
                    market_rate=float(it.get("market_rate", 0)),
                    deviation_pct=float(it.get("deviation_pct", 0)),
                    flag=flag_val,
                )
            )
        except (TypeError, ValueError):
            continue

    total_abs_dev = sum(abs(item.deviation_pct) for item in flagged_items) if flagged_items else 0.0
    enriched_items: list[FlaggedItem] = []
    for item in flagged_items:
        deviation = float(item.deviation_pct)
        if deviation > 15:
            item_verdict = "OVERPRICED"
        elif deviation < -10:
            item_verdict = "UNDERPRICED"
        else:
            item_verdict = "FAIR"
        risk_contribution = (abs(deviation) / total_abs_dev) if total_abs_dev > 0 else (1.0 / len(flagged_items) if flagged_items else 0.0)
        direction = "higher" if deviation >= 0 else "lower"
        human_summary = (
            f"{item.item} is quoted {abs(deviation):.1f}% {direction} than benchmark rates. "
            f"Quoted ₹{item.quoted_rate:.2f} vs benchmark ₹{item.market_rate:.2f}."
        )
        enriched_items.append(
            FlaggedItem(
                item=item.item,
                quoted_rate=item.quoted_rate,
                market_rate=item.market_rate,
                deviation_pct=item.deviation_pct,
                flag=item.flag,
                human_summary=human_summary,
                verdict=item_verdict,
                top_factors=[],
                risk_contribution=round(risk_contribution, 4),
            )
        )

    plain_english_summary = (
        f"We reviewed {len(enriched_items)} high-impact line items and found pricing deviations against current benchmarks. "
        f"The strongest concerns are concentrated in items with the largest deviation percentages. "
        f"This report highlights where scrutiny and supporting records are most needed."
    )
    overall_verdict = "Likely overpricing risk" if verdict == "overpriced" else "Needs review" if verdict == "neutral" else "Likely underpricing"

    return FullAuditResponse(
        verdict=verdict,
        confidence=confidence,
        summary=str(data.get("summary", "Audit complete.")),
        flagged_items=enriched_items,
        risk_signals=[str(s) for s in data.get("risk_signals", []) if isinstance(s, str)],
        recommendation=str(data.get("recommendation", "Review flagged items with a domain expert.")),
        plain_english_summary=plain_english_summary,
        overall_verdict=overall_verdict,
        explanation_version="shap-treexplainer-v1",
    )
