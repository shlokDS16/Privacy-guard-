from __future__ import annotations

import math
import re
import statistics
import time
from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.risk_engine import analyze_sql, K_MIN_DEFAULT, L_MIN_DEFAULT
from app.services.rewrite_engine import propose_rewrite
from app.services.sql_safe import parse_aggregate_query, execute_aggregate, SqlNotAllowed

# -------------------------
# Benchmark design (demo)
# -------------------------
# We generate a fixed-size query suite with a mix of:
# - broad aggregates (safe)
# - narrow slices (risky)
# - exact-age + exact-cp slices (rewriteable by our demo rules)
#
# Methods compared:
# 1) No Controls: execute as-is (if SQL shape is allowed), even if privacy risk
# 2) Global Recoding: always generalize quasi-identifiers in WHERE (age -> age_band, cp -> cp_group)
# 3) JIT Lattice: only rewrite if policy requires (uses existing propose_rewrite)
# 4) JIT + Heatmap: search minimal rewrite that satisfies policy (simulates heatmap-guided choice)

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

def _rewrite_age(sql: str) -> str:
    m = re.search(r"(?i)\bage\s*=\s*(\d+)\b", sql)
    if not m:
        return sql
    age = int(m.group(1))
    band = _age_to_band(age, 10)
    return re.sub(r"(?i)\bage\s*=\s*\d+\b", f"age_band = '{band}'", sql)

def _rewrite_cp(sql: str) -> str:
    m = re.search(r"(?i)\bcp\s*=\s*(\d+)\b", sql)
    if not m:
        return sql
    v = int(m.group(1))
    grp = CP_GROUP.get(v, "MediumRiskSymptoms")
    return re.sub(r"(?i)\bcp\s*=\s*\d+\b", f"cp_group = '{grp}'", sql)


def _drop_predicate(sql: str, field: str) -> tuple[str, list[str]]:
    """Remove a single simple predicate like `sex = 1` from a WHERE clause.

    Assumes the allowlisted query shape: WHERE <cond> AND <cond> ...
    Returns (new_sql, applied_rules).
    """
    s = sql.strip()
    m = re.search(r"(?is)\bwhere\b\s+(.*)$", s)
    if not m:
        return s, []

    where_clause = m.group(1)
    # Split by AND (case-insensitive). This is sufficient for our demo allowlist.
    parts = [p.strip() for p in re.split(r"(?i)\s+and\s+", where_clause) if p.strip()]

    # Keep everything except the target field predicate.
    kept = []
    dropped = False
    for p in parts:
        if re.fullmatch(fr"(?i){re.escape(field)}\s*=\s*[^\s]+", p):
            dropped = True
            continue
        kept.append(p)

    if not dropped:
        return s, []

    prefix = s[: m.start()]  # everything before WHERE
    if kept:
        return (prefix + "WHERE " + " AND ".join(kept)), ["R4"]
    else:
        # Removing the last predicate removes WHERE entirely
        return (prefix.strip()), ["R4"]

def _info_loss(raw_sql: str, final_sql: str) -> float:
    # Simple, explainable IL proxy for demo + patent table:
    # - age exact -> age_band (10y) counts as 0.6 loss
    # - cp exact -> cp_group counts as 0.4 loss
    # - dropping a predicate (e.g., sex=) counts as 0.3 loss
    age_loss = 0.0
    cp_loss = 0.0
    drop_loss = 0.0

    if re.search(r"(?i)\bage\s*=\s*\d+\b", raw_sql) and re.search(r"(?i)\bage_band\s*=\s*'\d+-\d+'", final_sql):
        age_loss = 0.6

    if re.search(r"(?i)\bcp\s*=\s*\d+\b", raw_sql) and re.search(r"(?i)\bcp_group\s*=\s*'[^']+'", final_sql):
        cp_loss = 0.4

    # If raw had sex predicate and final removed it, count as information loss.
    if re.search(r"(?i)\bsex\s*=\s*[01]\b", raw_sql) and not re.search(r"(?i)\bsex\s*=\s*[01]\b", final_sql):
        drop_loss = 0.3

    return age_loss + cp_loss + drop_loss



def _classify_rewrite(raw_sql: str, final_sql: str, rules: list[str]) -> str:
    """Classify the *dominant* rewrite type for ablation reporting (Table T2).

    Categories:
      - age_band: exact age -> age_band (R2)
      - cp_group: exact cp -> cp_group (R3')
      - drop_predicate: predicate dropped (R4_DROP_*)
      - combo: two or more of the above applied
      - other: rewrite occurred but none of the above patterns matched
    """
    age = ("R2" in rules) or (
        re.search(r"(?i)\bage\s*=\s*\d+\b", raw_sql) and re.search(r"(?i)\bage_band\s*=\s*'\d+-\d+'", final_sql)
    )
    cp = ("R3'" in rules) or (
        re.search(r"(?i)\bcp\s*=\s*\d+\b", raw_sql) and re.search(r"(?i)\bcp_group\s*=\s*'[^']+'", final_sql)
    )
    dropped = any(r.startswith("R4_DROP_") for r in rules) or (
        re.search(r"(?i)\bsex\s*=\s*[01]\b", raw_sql) and not re.search(r"(?i)\bsex\s*=\s*[01]\b", final_sql)
    )

    n = int(bool(age)) + int(bool(cp)) + int(bool(dropped))
    if n >= 2:
        return "combo"
    if age:
        return "age_band"
    if cp:
        return "cp_group"
    if dropped:
        return "drop_predicate"
    return "other"


def _execute(db: Session, sql: str) -> tuple[bool, float | None, str | None]:
    # Returns (ok, value, error)
    try:
        pq = parse_aggregate_query(sql)
        val = execute_aggregate(db, pq)
        return True, float(val) if val is not None else None, None
    except SqlNotAllowed as e:
        return False, None, str(e)
    except Exception as e:
        return False, None, f"{e.__class__.__name__}: {e}"

def _pick_minimal_safe_rewrite(db: Session, raw_sql: str, *, k_min: int, l_min: int, enable_drop_predicate: bool = True) -> tuple[str, list[str]]:
    # Candidate search ordered by increasing information loss
    candidates: list[tuple[str, list[str]]] = [(raw_sql, [])]
    has_age = bool(re.search(r"(?i)\bage\s*=\s*\d+\b", raw_sql))
    has_cp = bool(re.search(r"(?i)\bcp\s*=\s*\d+\b", raw_sql))
    has_sex = bool(re.search(r"(?i)\bsex\s*=\s*[01]\b", raw_sql))

    # Base generalizations
    if has_age:
        candidates.append((_rewrite_age(raw_sql), ["R2"]))
    if has_cp:
        candidates.append((_rewrite_cp(raw_sql), ["R3'"]))
    if has_age and has_cp:
        candidates.append((_rewrite_age(_rewrite_cp(raw_sql)), ["R3'", "R2"]))

    # R4: predicate dropping (demo: drop sex=...) as an alternative path to reach k/l
    if enable_drop_predicate and has_sex:
        dropped_sql, r4 = _drop_predicate(raw_sql, "sex")
        if r4:
            candidates.append((dropped_sql, r4))
            if has_age:
                candidates.append((_rewrite_age(dropped_sql), r4 + ["R2"]))
            if has_cp:
                candidates.append((_rewrite_cp(dropped_sql), r4 + ["R3'"]))
            if has_age and has_cp:
                candidates.append((_rewrite_age(_rewrite_cp(dropped_sql)), r4 + ["R3'", "R2"]))

    # Deduplicate candidates while keeping order
    seen = set()
    uniq: list[tuple[str, list[str]]] = []
    for s, r in candidates:
        key = s.strip()
        if key in seen:
            continue
        seen.add(key)
        uniq.append((s, r))
    candidates = uniq

    # Evaluate candidates: prefer ALLOW and minimal IL
    scored: list[tuple[float, str, list[str], dict]] = []
    for cand_sql, rules in candidates:
        a = analyze_sql(cand_sql, db=db, k_min=k_min, l_min=l_min)
        il = _info_loss(raw_sql, cand_sql)
        ok = (a["k_est"] >= k_min and a["l_est"] >= l_min and a["decision"] == "ALLOW")
        # Sort: safe first, then IL
        score = (0.0 if ok else 1.0) + il
        scored.append((score, cand_sql, rules, a))
    scored.sort(key=lambda x: x[0])
    best = scored[0]
    return best[1], best[2]

def _global_recoding(sql: str) -> tuple[str, list[str]]:
    s = sql
    rules: list[str] = []
    s2 = _rewrite_age(s)
    if s2 != s:
        rules.append("R2")
        s = s2
    s2 = _rewrite_cp(s)
    if s2 != s:
        rules.append("R3'")
        s = s2
    return s, rules

def _generate_query_suite(db: Session, n: int = 60) -> list[str]:
    # Pull representative rows from the dataset to build realistic slices.
    rows = db.execute(text("SELECT age, sex, cp FROM patient_records ORDER BY random() LIMIT :n"), {"n": 30}).fetchall()
    queries: list[str] = []

    # Broad safe queries
    queries.extend([
        "SELECT COUNT(*) FROM patient_records",
        "SELECT AVG(chol) FROM patient_records",
        "SELECT AVG(chol) FROM patient_records WHERE sex = 1",
        "SELECT AVG(chol) FROM patient_records WHERE sex = 0",
        "SELECT AVG(chol) FROM patient_records WHERE age_band = '50-59'",
        "SELECT AVG(chol) FROM patient_records WHERE cp_group = 'MediumRiskSymptoms'",
    ])

    # Narrow queries from sampled rows (some will be risky)
    for (age, sex, cp) in rows:
        queries.append(f"SELECT AVG(chol) FROM patient_records WHERE age = {int(age)} AND sex = {int(sex)} AND cp = {int(cp)}")
        queries.append(f"SELECT COUNT(*) FROM patient_records WHERE age = {int(age)} AND cp = {int(cp)}")

    # Trim/pad deterministically
    queries = queries[:n]
    return queries

def _p95(values: list[float]) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    k = int(math.ceil(0.95 * len(values))) - 1
    k = max(0, min(len(values)-1, k))
    return float(values[k])

def run_benchmark_suite(db: Session, *, k_min: int = K_MIN_DEFAULT, l_min: int = L_MIN_DEFAULT, enable_drop_predicate: bool = True) -> dict[str, Any]:
    suite = _generate_query_suite(db)
    # Determine which queries are "risky" under policy, using raw SQL analysis
    raw_risky = []
    raw_truth_value: dict[str, float | None] = {}
    for q in suite:
        a = analyze_sql(q, db=db, k_min=k_min, l_min=l_min)
        if a["k_est"] < k_min or a["l_est"] < l_min or a["decision"] != "ALLOW":
            raw_risky.append(q)
        ok, val, _ = _execute(db, q)
        raw_truth_value[q] = val if ok else None
    risky_total = len(raw_risky)

    def eval_method(method_id: str, method_name: str):
        executed = 0
        blocked = 0
        rewritten = 0
        rewrite_attempted = 0
        rewrite_success = 0
        violations = 0
        prevented = 0
        il_vals: list[float] = []
        util_vals: list[float] = []
        lat_ms: list[float] = []
        outcomes = {"executed": 0, "rewritten": 0, "blocked": 0}
        rewrite_types = {"age_band": 0, "cp_group": 0, "drop_predicate": 0, "combo": 0, "other": 0}

        for q in suite:
            t0 = time.perf_counter()

            raw_a = analyze_sql(q, db=db, k_min=k_min, l_min=l_min)

            final_sql = q
            rules: list[str] = []

            if method_id == "no_controls":
                # execute as-is
                pass
            elif method_id == "global_recoding":
                final_sql, rules = _global_recoding(q)
                if final_sql != q:
                    rewritten += 1
            elif method_id == "jit":
                if raw_a["decision"] != "ALLOW":
                    rewrite_attempted += 1
                    rw = propose_rewrite(q, raw_a, enable_drop_predicate=enable_drop_predicate)
                    final_sql, rules = rw["rewritten_sql"], rw["applied_rules"]
                    if final_sql != q:
                        rewritten += 1
                # else keep raw
            elif method_id == "jit_heatmap":
                if raw_a["decision"] != "ALLOW":
                    rewrite_attempted += 1
                    final_sql, rules = _pick_minimal_safe_rewrite(db, q, k_min=k_min, l_min=l_min, enable_drop_predicate=enable_drop_predicate)
                    if final_sql != q:
                        rewritten += 1

            if final_sql != q:
                cat = _classify_rewrite(q, final_sql, rules)
                rewrite_types[cat] = rewrite_types.get(cat, 0) + 1

            ok, val, err = _execute(db, final_sql)
            final_a = analyze_sql(final_sql, db=db, k_min=k_min, l_min=l_min)

            # latency
            lat_ms.append((time.perf_counter() - t0) * 1000.0)

            # privacy violation if executed but still below thresholds
            is_violation = (final_a["k_est"] < k_min or final_a["l_est"] < l_min)

            if not ok:
                blocked += 1
                outcomes["blocked"] += 1
            else:
                executed += 1
                outcomes["executed"] += 1
                if final_sql != q:
                    outcomes["rewritten"] += 1

                if is_violation:
                    violations += 1

                # Prevented risky exposure?
                raw_is_risky = (q in raw_risky)
                if raw_is_risky and (not is_violation):
                    prevented += 1
                if raw_is_risky and (not ok):
                    prevented += 1

                # IL and utility
                il = _info_loss(q, final_sql)
                il_vals.append(il)

                truth = raw_truth_value.get(q)
                if truth is None or val is None:
                    util = 0.0
                else:
                    denom = max(1e-9, abs(truth))
                    util = max(0.0, 1.0 - (abs(val - truth) / denom))
                util_vals.append(util)

                if method_id != "no_controls" and raw_a["decision"] != "ALLOW":
                    rewrite_attempted += 0  # already counted
                    if final_sql != q:
                        rewrite_success += 1

        sqr = executed / len(suite)
        bqr = blocked / len(suite)
        rsr = (rewrite_success / rewrite_attempted) if rewrite_attempted else None
        mean_il = statistics.mean(il_vals) if il_vals else 0.0
        mean_util = statistics.mean(util_vals) if util_vals else 0.0
        avg_lat = statistics.mean(lat_ms) if lat_ms else 0.0
        p95_lat = _p95(lat_ms)

        asr = (prevented / risky_total) if risky_total else 0.0

        row = {
            "method": method_name,
            "method_id": method_id,
            "total_queries": len(suite),
            "executed": executed,
            "rewritten": rewritten,
            "blocked": blocked,
            "privacy_violations": violations,
            "sqr": round(sqr * 100, 1),
            "bqr": round(bqr * 100, 1),
            "rsr": (round(rsr * 100, 1) if rsr is not None else None),
            "mean_il": round(mean_il, 3),
            "mean_utility": round(mean_util, 3),
            "asr": round(asr * 100, 1),
            "avg_latency_ms": round(avg_lat, 1),
            "p95_latency_ms": round(p95_lat, 1),
        }
        return row, outcomes, rewrite_types

    methods = [
        ("no_controls", "No Controls"),
        ("global_recoding", "Global Recoding"),
        ("jit", "JIT Lattice"),
        ("jit_heatmap", "JIT + Heatmap"),
    ]

    table_rows = []
    outcome_rows = []
    table_T2 = []
    for mid, mname in methods:
        row, out, rewrite_types = eval_method(mid, mname)
        table_rows.append(row)
        outcome_rows.append({"method": mname, **out})

        total_rw = sum(rewrite_types.values())
        def _pct(x: int) -> float:
            return round((x / total_rw) * 100.0, 1) if total_rw else 0.0

        table_T2.append({
            "method": mname,
            "method_id": mid,
            "rewrites": int(total_rw),
            "age_band_count": int(rewrite_types.get("age_band", 0)),
            "age_band_pct": _pct(int(rewrite_types.get("age_band", 0))),
            "cp_group_count": int(rewrite_types.get("cp_group", 0)),
            "cp_group_pct": _pct(int(rewrite_types.get("cp_group", 0))),
            "drop_predicate_count": int(rewrite_types.get("drop_predicate", 0)),
            "drop_predicate_pct": _pct(int(rewrite_types.get("drop_predicate", 0))),
            "combo_count": int(rewrite_types.get("combo", 0)),
            "combo_pct": _pct(int(rewrite_types.get("combo", 0))),
            "other_count": int(rewrite_types.get("other", 0)),
            "other_pct": _pct(int(rewrite_types.get("other", 0))),
        })

    # Build a chart-friendly KPI series (same fields as our table)
    kpi_series = []
    for r in table_rows:
        kpi_series.append({
            "method": r["method"],
            "SQR": r["sqr"],
            "BQR": r["bqr"],
            "ASR": r["asr"],
            "Utility": round(r["mean_utility"] * 100, 1),
            "InfoLoss": r["mean_il"],
            "P95(ms)": r["p95_latency_ms"],
        })

    return {
        "status": "ok",
        "dataset_id": "uci_heart_v1",
        "k_min": k_min,
        "l_min": l_min,
        "enable_drop_predicate": enable_drop_predicate,
        "query_count": len(_generate_query_suite(db)),
        "notes": {
            "privacy_violation_definition": "k_est < k_min OR l_est < l_min after any rewrite; NoControls may execute despite violation (baseline).",
            "utility_definition": "1 - |final_value - raw_value|/|raw_value| averaged over executable queries (demo proxy).",
            "info_loss_definition": "0.6 if age exact is generalized to age_band + 0.4 if cp exact is generalized to cp_group (demo proxy).",
            "rewrite_ablation_definition": "Table T2 reports dominant rewrite type per rewritten query: age_band (R2), cp_group (R3'), drop_predicate (R4_DROP_*), combo (>=2), other.",
        },
        "table_T1": table_rows,
        "table_T2": table_T2,
        "charts": {
            "outcomes": outcome_rows,
            "kpi": kpi_series,
        }
    }
