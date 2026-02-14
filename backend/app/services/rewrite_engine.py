import re

CP_GROUP = {
    0: "LowRiskSymptoms",
    1: "LowRiskSymptoms",
    2: "MediumRiskSymptoms",
    3: "MediumRiskSymptoms",
    4: "HighRiskSymptoms",
}

def _age_to_band(age: int, width: int = 10) -> str:
    start = (age // width) * width
    end = start + (width - 1)
    return f"{start}-{end}"

def _drop_predicate(sql: str, field: str) -> str:
    """Remove a single simple predicate like `sex = 1` from a WHERE clause.

    Assumes the allowlisted query shape: WHERE <cond> AND <cond> ...
    """
    s = sql.strip()
    m = re.search(r"(?is)\bwhere\b\s+(.*)$", s)
    if not m:
        return s

    where_clause = m.group(1)
    parts = [p.strip() for p in re.split(r"(?i)\s+and\s+", where_clause) if p.strip()]
    kept = []
    for p in parts:
        if re.fullmatch(fr"(?i){re.escape(field)}\s*=\s*[^\s]+", p):
            continue
        kept.append(p)

    prefix = s[: m.start()]  # everything before WHERE
    if kept:
        return (prefix + "WHERE " + " AND ".join(kept)).strip()
    return prefix.strip()

def propose_rewrite(sql: str, analysis: dict, *, enable_drop_predicate: bool = True) -> dict:
    """Rewrite engine for demo (R1–R4).

    R1: raw `SELECT chol FROM ...` -> `SELECT AVG(chol) FROM ...`
    R2: exact age -> age_band
    R3': exact cp -> cp_group
    R4: drop a highly identifying predicate (demo: drop sex=...) if still risky
    """
    s = sql.strip()
    applied: list[str] = []

    # R1: chol raw -> AVG(chol)
    if re.search(r"(?i)select\s+chol\s+from\s+", s) and not re.search(r"(?i)avg\(", s):
        s = re.sub(r"(?i)select\s+chol\s+from", "SELECT AVG(chol) FROM", s)
        applied.append("R1")

    # R2: age exact -> age_band
    m = re.search(r"(?i)\bage\s*=\s*(\d+)\b", s)
    if m:
        age = int(m.group(1))
        band = _age_to_band(age, 10)
        s = re.sub(r"(?i)\bage\s*=\s*\d+\b", f"age_band = '{band}'", s)
        applied.append("R2")

    # R3': cp exact -> cp_group
    m = re.search(r"(?i)\bcp\s*=\s*(\d+)\b", s)
    if m:
        v = int(m.group(1))
        grp = CP_GROUP.get(v, "MediumRiskSymptoms")
        s = re.sub(r"(?i)\bcp\s*=\s*\d+\b", f"cp_group = '{grp}'", s)
        applied.append("R3'")

    # R4: drop sex predicate if enabled, policy signaled risk and sex predicate exists
    factors = [f.get("code") for f in (analysis.get("factors") or [])]
    still_risky_signal = analysis.get("decision") == "REWRITE" or ("SMALL_GROUP" in factors) or ("LOW_DIVERSITY" in factors)
    if enable_drop_predicate and still_risky_signal and re.search(r"(?i)\bsex\s*=\s*[01]\b", s):
        s2 = _drop_predicate(s, "sex")
        if s2 != s:
            s = s2
            applied.append("R4")

    return {"rewritten_sql": s, "applied_rules": applied}
