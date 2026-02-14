# PrivacyGuard Analytics (Option A Starter)

This starter provides:
- Frontend: Next.js + Tailwind + lightweight shadcn-like components + Recharts + TanStack Table
- Backend: FastAPI + signed receipts + strict aggregate-only query execution
- Postgres via docker-compose

## 1) Start Postgres
```bash
docker compose up -d
```

## 2) Import dataset into Postgres (patient_records)
From `backend/`:

### Option A (recommended for demo): import the included sample CSV
```bash
python scripts/import_uci_heart.py --replace
```

### Option B: import a real CSV you downloaded (UCI / Kaggle / etc.)
```bash
python scripts/import_uci_heart.py --csv "C:\path\to\heart.csv" --replace
```

### Option C: download a public heart CSV automatically (requires internet)
```bash
python scripts/import_uci_heart.py --download --replace
```

## 3) Backend
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

## 4) Frontend
```bash
cd frontend
npm install
npm run dev
```

Open:
- http://localhost:3000/app/dashboard
- http://localhost:3000/app/query/new
- http://localhost:3000/app/analytics
- http://localhost:3000/app/policy-studio
- http://localhost:3000/app/receipts
- http://localhost:3000/app/audit-log

Notes:
- Only **single-aggregate** SQL queries are allowed (demo safety):
  `SELECT AVG(chol) FROM patient_records WHERE ...` with simple `AND` filters.
- Risk uses k-est (cohort size) and l-est (chol_level bucket diversity) under a default policy (k>=5, l>=2).
- Receipts are Ed25519-signed (demo-only deterministic key) and hash-linked for auditability.

## Frontend API base
Create `frontend/.env.local` from `frontend/.env.local.example` if backend is not on localhost:8000.


## v0.4: Evaluation Harness
- Backend: POST /api/evaluation/run generates backend/reports/eval_latest.json
- Frontend: /app/analytics fetches latest report and can run evaluation from the UI


## Policy Studio
The policy is stored in `backend/data/policy.json` and controls:
- `k_min` (k-anonymity threshold)
- `l_min` (l-diversity threshold)
- `enable_drop_predicate` (enables/disables R4 predicate-dropping rewrite)

Update it in the UI at `http://localhost:3000/app/policy-studio`.
