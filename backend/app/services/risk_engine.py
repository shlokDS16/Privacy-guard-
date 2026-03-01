import re
from sqlalchemy.orm import Session

from app.services.sql_safe import (
    parse_aggregate_query,
    cohort_size,
    l_diversity,
    SqlNotAllowed,
)

K_MIN_DEFAULT = 5
L_MIN_DEFAULT = 2

def analyze_sql(sql: str, db: Session | None = None, *, k_min: int = K_MIN_DEFAULT, l_min: int = L_MIN_DEFAULT) -> dict:
    """Policy-driven privacy risk analysis for demo.

    Allowed query shape (strict):
      SELECT <AGG>(<col>|*) FROM patient_records [WHERE <simple AND filters>]

    Risk signals (current demo):
      - k-anonymity proxy: cohort_size (k_est)
      - l-diversity proxy: distinct count of chol_level buckets (l_est)
      - exact-age slicing increases score (encourages generalization to age_band)
    """
    s = sql.strip()
    lower = s.lower()

    try:
        pq = parse_aggregate_query(s)
    except SqlNotAllowed as e:
        return {
            "risk_score": 95,
            "risk_level": "HIGH",
            "k_est": 0,
            "l_est": 0,
            "decision": "BLOCK",
            "factors": [{"code": "SQL_NOT_ALLOWED", "severity": "HIGH", "evidence": {"reason": str(e)}}],
        }

    # If DB is not available, return conservative estimates (keeps UI usable).
    if db is None:
        k_est = 10
        l_est = 2
    else:
        try:
            k_est = cohort_size(db, pq)
            l_est = l_diversity(db, pq, sensitive_bucket_col="chol_level")
        except Exception as e:
            # If DB is not reachable / dataset not imported yet, return a helpful factor.
            return {
                "risk_score": 80,
                "risk_level": "HIGH",
                "k_est": 0,
                "l_est": 0,
                "decision": "REWRITE",
                "factors": [{"code": "DB_NOT_READY", "severity": "HIGH", "evidence": {"reason": str(e)}}],
            }

    factors: list[dict] = []
    score = 0

    # k-anonymity proxy
    if k_est < k_min:
        factors.append({"code": "SMALL_GROUP", "severity": "HIGH", "evidence": {"k_est": k_est, "k_min": k_min}})
        score += 45
    elif k_est < 10:
        factors.append({"code": "SMALL_GROUP", "severity": "MEDIUM", "evidence": {"k_est": k_est, "k_min": k_min}})
        score += 20

    # l-diversity proxy
    if l_est < l_min:
        factors.append({"code": "LOW_DIVERSITY", "severity": "MEDIUM", "evidence": {"l_est": l_est, "l_min": l_min}})
        score += 20

    # Encourage generalization instead of exact age
    if re.search(r"\bage\s*=\s*\d+\b", lower):
        factors.append({"code": "EXACT_AGE_SLICE", "severity": "LOW", "evidence": {}})
        score += 10

    # Clamp and map to level
    score = max(0, min(100, score))
    if score >= 70:
        level = "HIGH"
    elif score >= 35:
        level = "MEDIUM"
    else:
        level = "LOW"

    # Decision policy
    decision = "ALLOW"
    if k_est < k_min or l_est < l_min or score >= 35:
        decision = "REWRITE"

    return {
        "risk_score": score,
        "risk_level": level,
        "k_est": int(k_est),
        "l_est": int(l_est),
        "decision": decision,
        "factors": factors,
    }
