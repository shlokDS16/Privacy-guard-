from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db import get_db

router = APIRouter(tags=["heatmap"])

@router.get("/heatmap/options")
def heatmap_options(db: Session = Depends(get_db)):
    # Only allow these columns (avoid any SQL injection risk)
    cols = ["age_band", "cp_group", "sex"]

    def distinct(col: str):
        if col not in cols:
            return []
        rows = db.execute(
            text(f"SELECT DISTINCT {col} AS v FROM patient_records WHERE {col} IS NOT NULL ORDER BY {col}")
        ).fetchall()
        return [r[0] for r in rows]

    return {
        "age_bands": distinct("age_band"),
        "cp_groups": distinct("cp_group"),
        "sex_values": distinct("sex"),
    }
