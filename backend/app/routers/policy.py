from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.policy_store import get_policy, set_policy

router = APIRouter(tags=["policy"])

class PolicyResponse(BaseModel):
    policy_id: str
    k_min: int
    l_min: int
    enable_drop_predicate: bool
    updated_at: str

class PolicyUpdateRequest(BaseModel):
    k_min: int | None = Field(default=None, ge=2, le=50)
    l_min: int | None = Field(default=None, ge=2, le=10)
    enable_drop_predicate: bool | None = None

@router.get("/policy", response_model=PolicyResponse)
def policy_get():
    return get_policy()

@router.post("/policy", response_model=PolicyResponse)
def policy_set(req: PolicyUpdateRequest):
    return set_policy(k_min=req.k_min, l_min=req.l_min, enable_drop_predicate=req.enable_drop_predicate)
