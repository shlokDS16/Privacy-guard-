from sqlalchemy import Integer, String, Float, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base

class PatientRecord(Base):
    __tablename__ = "patient_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sex: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cp: Mapped[int | None] = mapped_column(Integer, nullable=True)

    trestbps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chol: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fbs: Mapped[int | None] = mapped_column(Integer, nullable=True)
    thalach: Mapped[int | None] = mapped_column(Integer, nullable=True)

    target: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Derived / generalized fields
    age_band: Mapped[str | None] = mapped_column(String(16), nullable=True)
    cp_group: Mapped[str | None] = mapped_column(String(32), nullable=True)
    chol_level: Mapped[str | None] = mapped_column(String(32), nullable=True)

class ReceiptRow(Base):
    __tablename__ = "receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    receipt_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    receipt_hash: Mapped[str] = mapped_column(String(80), index=True)
    receipt_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
