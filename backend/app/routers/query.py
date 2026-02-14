from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.risk_engine import analyze_sql
from app.services.policy_store import get_policy
from app.services.rewrite_engine import propose_rewrite
from app.services.receipts import issue_receipt
from app.services.sql_safe import parse_aggregate_query, execute_aggregate
import time

router = APIRouter(tags=["query"])

class AnalyzeRequest(BaseModel):
    dataset_id: str = "uci_heart_v1"
    sql: str = Field(..., min_length=1)
    mode: str = "jit"  # jit | global_recoding | dp

class AnalyzeResponse(BaseModel):
    risk_score: int
    risk_level: str
    k_est: int
    l_est: int
    decision: str
    factors: list[dict]
    suggested_rewrite_sql: str | None = None

@router.post("/query/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest, db: Session = Depends(get_db)):
    policy = get_policy()

    t0 = time.time()
    print("[analyze] calling analyze_sql...")
    analysis = analyze_sql(
        req.sql,
        db=db,
        k_min=policy["k_min"],
        l_min=policy["l_min"],
    )
    print(f"[analyze] analyze_sql returned in {time.time() - t0:.3f}s")

    rewrite = (
        propose_rewrite(
            req.sql,
            analysis,
            enable_drop_predicate=policy["enable_drop_predicate"],
        )
        if analysis["decision"] == "REWRITE"
        else None
    )

    return {
        **analysis,
        "suggested_rewrite_sql": (rewrite["rewritten_sql"] if rewrite else None),
        "policy": policy,
    }

class ExecuteRequest(BaseModel):
    dataset_id: str = "uci_heart_v1"
    sql: str = Field(..., min_length=1)
    accept_rewrite: bool = True

@router.post("/query/execute")
def execute(req: ExecuteRequest, db: Session = Depends(get_db)):
    policy = get_policy()
    raw_analysis = analyze_sql(req.sql, db=db, k_min=policy['k_min'], l_min=policy['l_min'])

    # Always block if the engine says BLOCK
    if raw_analysis["decision"] == "BLOCK":
        return {"status": "blocked", "analysis": raw_analysis}

    # NEW: enforce rewrite when required by policy
    if raw_analysis["decision"] == "REWRITE" and not req.accept_rewrite:
        return {
            "status": "blocked",
            "analysis": raw_analysis,
            "reason": "Rewrite required by policy. Use 'Execute (accept rewrite)'."
        }

    final_sql = req.sql
    applied_rules: list[str] = []

    if raw_analysis["decision"] == "REWRITE" and req.accept_rewrite:
        rw = propose_rewrite(req.sql, raw_analysis, enable_drop_predicate=policy['enable_drop_predicate'])
        final_sql = rw["rewritten_sql"]
        applied_rules = rw["applied_rules"]

    # Execute the (possibly rewritten) query with strict allowlist parsing.
    try:
        pq = parse_aggregate_query(final_sql)
        value = execute_aggregate(db, pq)
    except SqlNotAllowed as e:
        return {"status": "blocked", "analysis": raw_analysis, "reason": str(e), "final_sql": final_sql}

    metric = f"{pq.agg_fn.upper()}({pq.agg_col})"
    result = {"rows": 1, "data": [{"metric": metric, "value": value}]}

    final_analysis = analyze_sql(final_sql, db=db, k_min=policy['k_min'], l_min=policy['l_min'])

    receipt = issue_receipt(
        raw_sql=req.sql,
        rewritten_sql=(final_sql if final_sql != req.sql else None),
        decision=("REWRITE_AND_EXECUTE" if final_sql != req.sql else raw_analysis["decision"]),
        analysis=final_analysis,
        applied_rules=applied_rules,
        result_summary={"rows": result["rows"], "aggregates": [metric]},
    )

    return {"status": "ok", "final_sql": final_sql, "result": result, "receipt": receipt, "analysis": final_analysis}


