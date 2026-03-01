from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import heatmap


from app.routers import datasets, query, receipts, evaluation, policy
from app.db import engine, Base
from app import models  # noqa: F401 (register models)

app = FastAPI(title="PrivacyGuard API", version="0.7.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def _startup():
    # Create tables if they do not exist (demo convenience).
    Base.metadata.create_all(bind=engine)

app.include_router(datasets.router, prefix="/api")
app.include_router(query.router, prefix="/api")
app.include_router(receipts.router, prefix="/api")
app.include_router(evaluation.router, prefix="/api")
app.include_router(policy.router, prefix="/api")
app.include_router(heatmap.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
