from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.benchmarks import run_benchmark_suite
from app.services.policy_store import get_policy

router = APIRouter(tags=["evaluation"])

REPORT_PATH = os.getenv("EVAL_REPORT_PATH") or os.path.join(os.path.dirname(__file__), "..", "..", "reports", "eval_latest.json")
REPORT_PATH = os.path.abspath(REPORT_PATH)

@router.get("/evaluation/latest")
def evaluation_latest():
    if not os.path.exists(REPORT_PATH):
        return {"status": "missing", "report_path": REPORT_PATH}
    with open(REPORT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

@router.post("/evaluation/run")
def evaluation_run(db: Session = Depends(get_db)):
    policy = get_policy()
    report = run_benchmark_suite(db, k_min=policy['k_min'], l_min=policy['l_min'], enable_drop_predicate=policy['enable_drop_predicate'])
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    report["generated_at"] = datetime.now(timezone.utc).isoformat()
    report["report_path"] = REPORT_PATH
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    return report
