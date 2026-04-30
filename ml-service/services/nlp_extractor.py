from typing import Dict
import requests

OLLAMA_BASE_URL = "http://127.0.0.1:11434"
OLLAMA_MODEL = "qwen2.5-coder:7b"


def _fallback_extract(text: str) -> Dict[str, str]:
    lowered = text.lower()
    if "cement" in lowered:
        return {"material": "cement", "unit": "per_bag_50kg"}
    if "steel" in lowered or "tmt" in lowered:
        return {"material": "steel_rod", "unit": "per_tonne"}
    if "sand" in lowered:
        if "fine" in lowered:
            return {"material": "fine_sand", "unit": "per_cft"}
        return {"material": "coarse_sand", "unit": "per_cft"}
    if "aggregate" in lowered:
        return {"material": "aggregate_20mm", "unit": "per_cft"}
    if "brick" in lowered:
        return {"material": "brick", "unit": "per_piece"}
    if "bitumen" in lowered:
        return {"material": "bitumen", "unit": "unit"}
    if "rcc" in lowered and "pipe" in lowered:
        return {"material": "rcc_pipe", "unit": "per_metre"}
    return {"material": "other", "unit": "unit"}

CANONICAL = {
    "cement",
    "steel_rod",
    "coarse_sand",
    "fine_sand",
    "aggregate_20mm",
    "brick",
    "bitumen",
    "rcc_pipe",
    "other",
}


def extract_material_entity(text: str) -> Dict[str, str]:
    prompt = (
        "Map this construction material description to exactly one canonical name. "
        f"Description: '{text}'. "
        "Choose from: cement, steel_rod, coarse_sand, fine_sand, aggregate_20mm, brick, bitumen, rcc_pipe, other. "
        "Return ONLY the canonical name, nothing else."
    )

    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
            },
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
        material = str(payload.get("response", "")).strip().lower()
        if material in CANONICAL:
            return {"material": material, "unit": _fallback_extract(text)["unit"]}
    except Exception:
        pass

    return _fallback_extract(text)
