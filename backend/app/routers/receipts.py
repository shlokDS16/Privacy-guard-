from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.services.receipts import verify_receipt

router = APIRouter(tags=["receipts"])

class VerifyRequest(BaseModel):
    receipt: dict = Field(...)

@router.post("/receipts/verify")
def verify(req: VerifyRequest):
    return verify_receipt(req.receipt)
