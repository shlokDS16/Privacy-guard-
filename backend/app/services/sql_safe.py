import re
from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import PatientRecord

AggFn = Literal["avg", "sum", "count", "min", "max"]

ALLOWED_TABLE = "patient_records"
ALLOWED_AGGS: set[str] = {"avg", "sum", "count", "min", "max"}

# Limit columns that can appear in WHERE for the demo.
ALLOWED_FILTER_COLS: set[str] = {
    "age", "sex", "cp",
    "age_band", "cp_group", "chol_level",
    "trestbps", "chol", "fbs", "thalach",
    "target",
}

# Columns considered sensitive (for raw-output checks, etc.)
SENSITIVE_COLS: set[str] = {"chol", "trestbps", "fbs", "thalach", "target"}

OP_MAP = {
    "=": "eq",
    "!=": "ne",
    "<": "lt",
    "<=": "le",
    ">": "gt",
    ">=": "ge",
}

@dataclass
class ParsedQuery:
    agg_fn: AggFn
    agg_col: str  # "*" allowed for count(*)
    filters: list[tuple[str, str, Any]]  # (col, op, value)

class SqlNotAllowed(ValueError):
    pass

def _canonicalize(sql: str) -> str:
    # Hard reject obvious injection characters for this demo.
    if ";" in sql or "--" in sql or "/*" in sql or "*/" in sql:
        raise SqlNotAllowed("Comments/semicolons are not allowed")
    return re.sub(r"\s+", " ", sql.strip())

def parse_aggregate_query(sql: str) -> ParsedQuery:
    s = _canonicalize(sql)
    m = re.match(
        r"(?is)^select\s+(avg|sum|count|min|max)\s*\(\s*([a-zA-Z_][\w]*|\*)\s*\)\s+from\s+([a-zA-Z_][\w]*)\s*(where\s+(.+))?$",
        s,
    )
    if not m:
        raise SqlNotAllowed("Only single aggregate queries are allowed (e.g., SELECT AVG(chol) FROM patient_records WHERE ...)")
    agg = m.group(1).lower()
    col = m.group(2)
    table = m.group(3)
    where = (m.group(5) or "").strip()

    if agg not in ALLOWED_AGGS:
        raise SqlNotAllowed("Aggregate not allowed")
    if table.lower() != ALLOWED_TABLE:
        raise SqlNotAllowed("Only patient_records table is allowed")

    filters: list[tuple[str, str, Any]] = []
    if where:
        # Reject OR to keep safe/simple demo grammar
        if re.search(r"(?i)\bor\b", where):
            raise SqlNotAllowed("OR is not allowed in demo queries")
        parts = re.split(r"(?i)\s+and\s+", where)
        for p in parts:
            p = p.strip()
            m2 = re.match(r"(?is)^([a-zA-Z_][\w]*)\s*(=|!=|<=|>=|<|>)\s*(.+)$", p)
            if not m2:
                raise SqlNotAllowed(f"Unsupported WHERE clause: {p}")
            c = m2.group(1)
            op = m2.group(2)
            raw_val = m2.group(3).strip()

            if c not in ALLOWED_FILTER_COLS:
                raise SqlNotAllowed(f"Filter column not allowed: {c}")
            if op not in OP_MAP:
                raise SqlNotAllowed(f"Operator not allowed: {op}")

            # Parse value
            val: Any
            if re.match(r"^'.*'$", raw_val):
                # simple single-quoted string
                val = raw_val[1:-1]
                if "'" in val:
                    raise SqlNotAllowed("Embedded quotes not allowed in demo string literals")
            elif re.match(r"^-?\d+(\.\d+)?$", raw_val):
                val = float(raw_val) if "." in raw_val else int(raw_val)
            else:
                raise SqlNotAllowed(f"Value format not allowed: {raw_val}")

            filters.append((c, op, val))

    return ParsedQuery(agg_fn=agg, agg_col=col, filters=filters)

def _col_expr(col_name: str):
    if not hasattr(PatientRecord, col_name):
        raise SqlNotAllowed(f"Unknown column: {col_name}")
    return getattr(PatientRecord, col_name)

def _apply_filters(stmt, filters):
    for (c, op, v) in filters:
        col = _col_expr(c)
        if op == "=":
            stmt = stmt.where(col == v)
        elif op == "!=":
            stmt = stmt.where(col != v)
        elif op == "<":
            stmt = stmt.where(col < v)
        elif op == "<=":
            stmt = stmt.where(col <= v)
        elif op == ">":
            stmt = stmt.where(col > v)
        elif op == ">=":
            stmt = stmt.where(col >= v)
        else:
            raise SqlNotAllowed("Operator not allowed")
    return stmt

def cohort_size(db: Session, pq: ParsedQuery) -> int:
    stmt = select(func.count()).select_from(PatientRecord)
    stmt = _apply_filters(stmt, pq.filters)
    return int(db.execute(stmt).scalar_one())

def l_diversity(db: Session, pq: ParsedQuery, sensitive_bucket_col: str = "chol_level") -> int:
    col = _col_expr(sensitive_bucket_col)
    stmt = select(func.count(func.distinct(col))).select_from(PatientRecord)
    stmt = _apply_filters(stmt, pq.filters)
    return int(db.execute(stmt).scalar_one())

def execute_aggregate(db: Session, pq: ParsedQuery) -> float | int | None:
    if pq.agg_fn == "count" and pq.agg_col == "*":
        agg_expr = func.count()
    else:
        col = _col_expr(pq.agg_col)
        agg_expr = getattr(func, pq.agg_fn)(col)

    stmt = select(agg_expr).select_from(PatientRecord)
    stmt = _apply_filters(stmt, pq.filters)
    return db.execute(stmt).scalar_one()
