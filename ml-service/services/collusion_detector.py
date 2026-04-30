"""
Collusion and bid-pattern detection for All-India tender data.
"""
import os
import logging
import requests
from typing import Optional

logger = logging.getLogger(__name__)
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:4000")

SEVERITY_THRESHOLDS = {"low": 20, "medium": 40, "high": 65, "critical": 85}


def _severity(score: float) -> str:
    if score >= SEVERITY_THRESHOLDS["critical"]:
        return "critical"
    if score >= SEVERITY_THRESHOLDS["high"]:
        return "high"
    if score >= SEVERITY_THRESHOLDS["medium"]:
        return "medium"
    return "low"


def _fetch_tenders(state_code: Optional[str], limit: int) -> list:
    params = {"limit": limit}
    if state_code:
        params["state"] = state_code
    try:
        r = requests.get(f"{BACKEND_URL}/api/tenders", params=params, timeout=15)
        r.raise_for_status()
        data = r.json().get("data", [])
        return data if isinstance(data, list) else []
    except Exception as e:
        logger.warning("Could not fetch tenders: %s", e)
        return []


def detect_collusion(state_code: Optional[str] = None, limit: int = 200) -> list:
    tenders = _fetch_tenders(state_code, limit)
    if not tenders:
        return []

    flags = []

    # ── 1. Cross-state repeat winner ──
    vendor_states: dict[str, set] = {}
    vendor_tenders: dict[str, list] = {}
    for t in tenders:
        vendor = (t.get("vendorName") or "").strip().lower()
        sc = t.get("stateCode") or t.get("state") or ""
        if not vendor:
            continue
        if vendor not in vendor_states:
            vendor_states[vendor] = set()
            vendor_tenders[vendor] = []
        if sc:
            vendor_states[vendor].add(sc)
        vendor_tenders[vendor].append(t)

    for vendor, states in vendor_states.items():
        if len(states) >= 3:
            flagged = [t for t in vendor_tenders[vendor] if t.get("status") == "flagged"]
            if flagged:
                score = min(100, len(states) * 8 + len(flagged) * 6)
                flags.append({
                    "type": "cross_state_repeat_winner",
                    "description": f'Vendor "{vendor}" active in {len(states)} states with {len(flagged)} flagged tenders',
                    "vendors_involved": [vendor],
                    "states_involved": list(states),
                    "risk_score": round(score, 1),
                    "severity": _severity(score),
                    "details": {"states_count": len(states), "flagged_count": len(flagged), "total_tenders": len(vendor_tenders[vendor])},
                })

    # ── 2. Bid clustering — bids suspiciously close within same project type ──
    by_type: dict[str, list] = {}
    for t in tenders:
        pt = t.get("projectType", "other")
        amt = float(t.get("totalEstimatedCostINR", 0))
        vendor = (t.get("vendorName") or "").strip().lower()
        if amt <= 0 or not vendor:
            continue
        if pt not in by_type:
            by_type[pt] = []
        by_type[pt].append({"vendor": vendor, "amount": amt, "sc": t.get("stateCode", "")})

    for pt, bids in by_type.items():
        if len(bids) < 3:
            continue
        amounts = sorted([b["amount"] for b in bids])
        for i in range(len(amounts) - 2):
            window = amounts[i:i+3]
            spread_pct = (window[-1] - window[0]) / window[0] * 100 if window[0] else 0
            if spread_pct < 3.0 and window[0] > 100_000:
                vendors_in_window = [b["vendor"] for b in bids if window[0] <= b["amount"] <= window[-1]]
                if len(set(vendors_in_window)) >= 2:
                    score = min(100, 55 + (3.0 - spread_pct) * 10)
                    flags.append({
                        "type": "bid_cluster",
                        "description": f"Bids within {spread_pct:.1f}% of each other in {pt} category — possible collusion",
                        "vendors_involved": list(set(vendors_in_window)),
                        "states_involved": list({b["sc"] for b in bids if b["vendor"] in vendors_in_window}),
                        "risk_score": round(score, 1),
                        "severity": _severity(score),
                        "details": {"project_type": pt, "spread_pct": round(spread_pct, 2), "bid_count": len(vendors_in_window)},
                    })
                    break

    # ── 3. Threshold bidding — vendor consistently bids just below tender limit ──
    tender_threshold_map: list = []
    for t in tenders:
        est = float(t.get("totalEstimatedCostINR", 0))
        vendor = (t.get("vendorName") or "").strip().lower()
        if est <= 0 or not vendor:
            continue
        threshold = est * 1.15
        amt = est
        ratio = amt / threshold if threshold else 0
        if 0.92 <= ratio <= 0.99:
            tender_threshold_map.append({"vendor": vendor, "sc": t.get("stateCode", ""), "ratio": ratio})

    threshold_vendors: dict[str, list] = {}
    for item in tender_threshold_map:
        v = item["vendor"]
        if v not in threshold_vendors:
            threshold_vendors[v] = []
        threshold_vendors[v].append(item)

    for vendor, items in threshold_vendors.items():
        if len(items) >= 3:
            score = min(100, 40 + len(items) * 8)
            flags.append({
                "type": "threshold_bid",
                "description": f'Vendor "{vendor}" consistently bids just below procurement threshold ({len(items)} times)',
                "vendors_involved": [vendor],
                "states_involved": list({i["sc"] for i in items}),
                "risk_score": round(score, 1),
                "severity": _severity(score),
                "details": {"occurrences": len(items), "avg_ratio": round(sum(i["ratio"] for i in items) / len(items), 3)},
            })

    # ── 4. Single-bidder tenders ──
    single_bidder_states: dict[str, int] = {}
    for t in tenders:
        vendor = (t.get("vendorName") or "").strip().lower()
        sc = t.get("stateCode", "")
        if not vendor or not sc:
            continue
        if t.get("procurementMethod") == "nomination":
            single_bidder_states[sc] = single_bidder_states.get(sc, 0) + 1

    for sc, count in single_bidder_states.items():
        if count >= 5:
            score = min(100, 30 + count * 5)
            flags.append({
                "type": "single_bidder",
                "description": f"State {sc} has {count} nomination-method tenders — suppressed competition",
                "vendors_involved": [],
                "states_involved": [sc],
                "risk_score": round(score, 1),
                "severity": _severity(score),
                "details": {"state_code": sc, "nomination_count": count},
            })

    def to_risk_level(score: float) -> str:
        # Thresholds calibrated to existing score ranges:
        # >=70 has repeated structural anomalies, >=45 has notable but mixed signals.
        if score >= 70:
            return "HIGH"
        if score >= 45:
            return "MEDIUM"
        return "LOW"

    def build_evidence(flag: dict) -> list[str]:
        details = flag.get("details", {}) if isinstance(flag.get("details"), dict) else {}
        evidence: list[str] = []
        if flag.get("type") == "cross_state_repeat_winner":
            evidence.append(f'Won tenders across {details.get("states_count", 0)} states with repeated flagged outcomes.')
            evidence.append(f'Participated in {details.get("total_tenders", 0)} tenders under similar departments.')
        if flag.get("type") == "bid_cluster":
            evidence.append(f'Competing bids grouped within {details.get("spread_pct", 0)}% spread, unusually tight for open bidding.')
            evidence.append("Bid values appear near-identical across multiple vendors in the same category.")
        if flag.get("type") == "threshold_bid":
            evidence.append(f'Quoted just below threshold in {details.get("occurrences", 0)} tenders.')
            evidence.append(f'Average threshold proximity ratio is {details.get("avg_ratio", 0)}, indicating strategic bid placement.')
        if flag.get("type") == "single_bidder":
            evidence.append(f'Procurement relied on nomination route in {details.get("nomination_count", 0)} tenders.')
            evidence.append("Competition appears constrained due to frequent single-bidder participation.")
        if not evidence:
            evidence.append("Pattern indicates repeated abnormal bid behavior.")
        return evidence[:3]

    for flag in flags:
        flag["evidence"] = build_evidence(flag)
        flag["risk_level"] = to_risk_level(float(flag.get("risk_score", 0)))

    # Sort by risk score descending
    flags.sort(key=lambda f: f["risk_score"], reverse=True)
    return flags
