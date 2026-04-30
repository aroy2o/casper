from typing import List
from models.schemas import ParsedLineItem, AuditFlag
from services.nlp_extractor import extract_material_entity
import requests

CPWD_FALLBACK = {
    "cement": 370.0,
    "steel_rod": 56000.0,
    "coarse_sand": 42.0,
    "fine_sand": 35.0,
    "aggregate_20mm": 1750.0,
    "brick": 6800.0,
    "bitumen": 50000.0,
    "rcc_pipe": 2650.0,
    "other": 100.0,
}

MATERIAL_ENCODING = {
    "cement": 0,
    "steel_rod": 1,
    "coarse_sand": 2,
    "fine_sand": 3,
    "aggregate_20mm": 4,
    "brick": 5,
    "bitumen": 6,
    "rcc_pipe": 7,
    "other": 8,
}

REGION_ENCODING = {"assam": 0, "meghalaya": 1, "arunachal": 2, "manipur": 3, "national": 4}


def _get_market_rate(material: str, region: str) -> float:
    for candidate_region in [region, "national"]:
        try:
            response = requests.get(
                "http://127.0.0.1:4000/api/prices",
                params={"material": material, "region": candidate_region, "limit": 1},
                timeout=15,
            )
            response.raise_for_status()
            payload = response.json()
            rows = payload.get("data", [])
            if isinstance(rows, list) and rows:
                rate = float(rows[0].get("priceINR", 0))
                if rate > 0:
                    return rate
        except Exception:
            continue
    return CPWD_FALLBACK.get(material, CPWD_FALLBACK["other"])


def _confidence_for_inflation(inflation_pct: float) -> float:
    if inflation_pct >= 60:
        return 0.95
    if inflation_pct >= 40:
        return 0.85
    if inflation_pct >= 25:
        return 0.75
    if inflation_pct >= 15:
        return 0.65
    return 0.0


def _generate_explanation(description: str, quoted_rate: float, market_rate: float, inflation_pct: float, unit: str) -> str:
    prompt = f"""
Generate a single factual sentence explaining why this
infrastructure cost line item appears inflated.
Item: {description}
Quoted rate: INR {quoted_rate} per {unit}
Market rate: INR {market_rate} per {unit}
Inflation: {inflation_pct}% above market
Write exactly ONE sentence. Be specific. Mention the rupee
amounts. Do not use words like "fraud" or "corruption".
Use "above market rate" instead.
"""
    try:
        response = requests.post(
            "http://127.0.0.1:11434/api/generate",
            json={"model": "llama3.1", "prompt": prompt, "stream": False},
            timeout=20,
        )
        response.raise_for_status()
        text = str(response.json().get("response", "")).strip()
        if text:
            return text.replace("\n", " ")
    except Exception:
        pass
    return (
        f"{description} quoted at ₹{quoted_rate:.2f}/{unit} vs current market rate of "
        f"₹{market_rate:.2f}/{unit} — {inflation_pct:.2f}% above market. Exceeds the 15% acceptable variance threshold."
    )


def audit_line_items(items: List[ParsedLineItem], region: str) -> List[AuditFlag]:
    flags: List[AuditFlag] = []

    for item in items:
        entity = extract_material_entity(item.description)
        material = entity["material"]
        _ = MATERIAL_ENCODING.get(material, MATERIAL_ENCODING["other"])
        _ = REGION_ENCODING.get(region, REGION_ENCODING["national"])
        market = _get_market_rate(material, region)
        inflation_pct = ((item.quotedRateINR - market) / market) * 100.0
        confidence = _confidence_for_inflation(inflation_pct)

        if confidence > 0:
            flags.append(
                AuditFlag(
                    lineItemDescription=item.description,
                    quotedRateINR=item.quotedRateINR,
                    marketRateINR=market,
                    inflationPct=round(inflation_pct, 2),
                    confidence=confidence,
                    explanation=_generate_explanation(
                        item.description, item.quotedRateINR, market, round(inflation_pct, 2), item.unit
                    ),
                )
            )

    return flags
