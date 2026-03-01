import argparse
import os
from pathlib import Path

import pandas as pd
from sqlalchemy import text

# Allow running as `python scripts/import_uci_heart.py` from backend/
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db import engine, Base
from app import models  # noqa: F401

SAMPLE_CSV = Path(__file__).resolve().parents[1] / "data" / "heart_sample.csv"
DEFAULT_CSV = Path(__file__).resolve().parents[1] / "data" / "uci_heart.csv"

# Optional download URL (may change over time). Use only if you have internet.
DEFAULT_DOWNLOAD_URL = "https://raw.githubusercontent.com/plotly/datasets/master/heart.csv"

def age_band(age: float | int | None) -> str | None:
    if age is None:
        return None
    try:
        a = int(age)
    except Exception:
        return None
    start = (a // 10) * 10
    return f"{start}-{start+9}"

def cp_group(cp: float | int | None) -> str | None:
    if cp is None:
        return None
    try:
        c = int(cp)
    except Exception:
        return None
    if c == 4:
        return "HighRiskSymptoms"
    return "OtherSymptoms"

def chol_level(chol: float | int | None) -> str | None:
    if chol is None:
        return None
    try:
        x = float(chol)
    except Exception:
        return None
    if x < 200:
        return "Normal"
    if x < 240:
        return "BorderlineHigh"
    return "High"

def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    cols = {c: c.strip().lower() for c in df.columns}
    df = df.rename(columns=cols)

    # Common synonyms across heart datasets
    rename_map = {
        "sex": "sex",
        "age": "age",
        "cp": "cp",
        "chol": "chol",
        "trestbps": "trestbps",
        "trtbps": "trestbps",
        "thalach": "thalach",
        "thalachh": "thalach",
        "fbs": "fbs",
        "target": "target",
        "output": "target",
    }
    df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})
    return df

def main():
    ap = argparse.ArgumentParser(description="Import UCI Heart dataset into Postgres (patient_records).")
    ap.add_argument("--csv", type=str, default="", help="Path to CSV file. If omitted, uses backend/data/uci_heart.csv if present, else sample.")
    ap.add_argument("--download", action="store_true", help="Download a heart dataset CSV into backend/data/uci_heart.csv (requires internet).")
    ap.add_argument("--url", type=str, default=DEFAULT_DOWNLOAD_URL, help="Download URL to use with --download.")
    ap.add_argument("--replace", action="store_true", help="Truncate patient_records before import (recommended for demo).")
    args = ap.parse_args()

    Base.metadata.create_all(bind=engine)

    if args.download:
        print(f"Downloading CSV from: {args.url}")
        df = pd.read_csv(args.url)
        DEFAULT_CSV.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(DEFAULT_CSV, index=False)
        print(f"Saved to: {DEFAULT_CSV}")

    csv_path = Path(args.csv) if args.csv else (DEFAULT_CSV if DEFAULT_CSV.exists() else SAMPLE_CSV)
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    print(f"Loading: {csv_path}")
    df = pd.read_csv(csv_path)

    df = normalize_columns(df)

    required = ["age", "sex", "cp", "chol"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        print("Columns present:", list(df.columns))
        raise SystemExit(f"Missing required columns: {missing}")

    # Keep only supported columns; anything missing becomes NaN/None.
    keep_cols = ["age", "sex", "cp", "trestbps", "chol", "fbs", "thalach", "target"]
    for c in keep_cols:
        if c not in df.columns:
            df[c] = pd.NA
    df = df[keep_cols]

    # Derived columns
    df["age_band"] = df["age"].apply(age_band)
    df["cp_group"] = df["cp"].apply(cp_group)
    df["chol_level"] = df["chol"].apply(chol_level)

    # Light cleaning
    df = df.dropna(subset=["age", "sex", "cp", "chol"])
    df["age"] = df["age"].astype(int)
    df["sex"] = df["sex"].astype(int)
    df["cp"] = df["cp"].astype(int)
    df["chol"] = df["chol"].astype(int)

    with engine.begin() as conn:
        if args.replace:
            print("Truncating patient_records...")
            conn.execute(text("TRUNCATE TABLE patient_records RESTART IDENTITY"))
        print(f"Inserting rows: {len(df)}")
        df.to_sql("patient_records", con=conn, if_exists="append", index=False, method="multi")

    print("Import complete.")
    print("Try in UI: SELECT AVG(chol) FROM patient_records WHERE age = 63 AND sex = 1 AND cp = 4")

if __name__ == "__main__":
    main()
