from pathlib import Path
from typing import List
import requests
from pdfminer.high_level import extract_text
import json
import re
import fitz
from models.schemas import ParsedLineItem

OLLAMA_BASE_URL = "http://127.0.0.1:11434"
OLLAMA_MODEL = "qwen2.5-coder:7b"

VALID_UNITS = {"bag", "tonne", "cft", "sqm", "sqft", "rmt", "piece", "cum", "litre", "kg", "metre", "lot"}


def _clean_json(raw: str) -> str:
    cleaned = raw.strip().replace("```json", "").replace("```", "").strip()
    return cleaned


def _regex_fallback(raw_text: str) -> List[ParsedLineItem]:
    pattern = re.compile(r"(.+?)\s+(\d+\.?\d*)\s+(bag|tonne|cft|sqm|cum|rmt|metre)\s+[\₹Rs\.]*\s*([\d,]+\.?\d*)", re.IGNORECASE)
    items: List[ParsedLineItem] = []
    for match in pattern.finditer(raw_text):
        description = match.group(1).strip()
        quantity = float(match.group(2))
        unit = match.group(3).lower()
        rate = float(match.group(4).replace(",", ""))
        if description and quantity > 0 and rate > 0:
            items.append(
                ParsedLineItem(
                    description=description,
                    quantity=quantity,
                    unit=unit,
                    quotedRateINR=rate,
                )
            )
    return items


def parse_pdf(file_path: str) -> List[ParsedLineItem]:
    path = Path(file_path)
    if not path.exists() or path.suffix.lower() != ".pdf":
        return []

    try:
        raw_text = extract_text(str(path)).strip()
    except Exception:
        raw_text = ""

    if len(raw_text) < 50:
        try:
            doc = fitz.open(str(path))
            raw_text = "\n".join(page.get_text() for page in doc)
            doc.close()
        except Exception:
            raw_text = ""

    if len(raw_text.strip()) < 50:
        return []

    prompt = f"""
You are analyzing an Indian government infrastructure tender document.
Extract ALL cost line items from the text below.

RULES:
- Only extract items that have a clear quantity AND price
- quotedRateINR must be a number (the unit rate, not total)
- If you see "Total: X" without unit rate, skip that row
- unit must be one of: bag, tonne, cft, sqm, sqft, rmt,
  piece, cum, litre, kg, metre, lot
- description must be the material/work name only

TEXT:
{raw_text[:4000]}

Return ONLY a valid JSON array. No explanation. No markdown.
Example: [{{"description":"Cement OPC","quantity":1000,"unit":"bag","quotedRateINR":420}}]
If no line items found return: []
"""
    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=45,
        )
        response.raise_for_status()
        payload = response.json()
        raw_array = _clean_json(str(payload.get("response", "[]")))
        parsed = json.loads(raw_array)
        items: List[ParsedLineItem] = []
        if isinstance(parsed, list):
            for row in parsed:
                if not isinstance(row, dict):
                    continue
                description = str(row.get("description", "")).strip()
                quantity = float(row.get("quantity", 0))
                unit = str(row.get("unit", "")).strip().lower()
                quoted_rate = float(row.get("quotedRateINR", 0))
                if description and quantity > 0 and quoted_rate > 0 and unit in VALID_UNITS:
                    items.append(
                        ParsedLineItem(
                            description=description,
                            quantity=quantity,
                            unit=unit,
                            quotedRateINR=quoted_rate,
                        )
                    )
        if items:
            return items
    except Exception:
        pass

    return _regex_fallback(raw_text)
