"""Modul Training & Development karyawan."""

from __future__ import annotations

from datetime import date as DateType

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Date, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.database import Base, get_db


class TrainingRecord(Base):
    __tablename__ = "training_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    nama: Mapped[str] = mapped_column(String(256), nullable=False)
    penyelenggara: Mapped[str | None] = mapped_column(String(256), nullable=True)
    tanggal: Mapped[DateType | None] = mapped_column(Date, nullable=True)
    nilai: Mapped[float | None] = mapped_column(Float, nullable=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class TrainBase(BaseModel):
    nama: str = Field(..., max_length=256, examples=["Leadership Training"])
    penyelenggara: str | None = Field(default=None, max_length=256)
    tanggal: DateType | None = None
    nilai: float | None = None

class TrainCreate(TrainBase):
    employee_id: int

class TrainUpdate(BaseModel):
    nama: str | None = Field(default=None, max_length=256)
    penyelenggara: str | None = Field(default=None, max_length=256)
    tanggal: DateType | None = None
    nilai: float | None = None

class TrainOut(TrainBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: int
    sort: int


router = APIRouter(prefix="/training", tags=["Training"])

@router.get("", response_model=list[TrainOut])
def list_training(employee_id: int = Query(...), db: Session = Depends(get_db)):
    return db.query(TrainingRecord).filter(TrainingRecord.employee_id == employee_id).order_by(TrainingRecord.tanggal.desc()).all()

@router.post("", response_model=TrainOut, status_code=status.HTTP_201_CREATED)
def create_training(payload: TrainCreate, db: Session = Depends(get_db)):
    rec = TrainingRecord(**payload.model_dump())
    db.add(rec); db.commit(); db.refresh(rec)
    return rec

@router.patch("/{rec_id}", response_model=TrainOut)
def update_training(rec_id: int, payload: TrainUpdate, db: Session = Depends(get_db)):
    rec = db.get(TrainingRecord, rec_id)
    if not rec: raise HTTPException(status_code=404, detail="Tidak ditemukan.")
    for k, v in payload.model_dump(exclude_unset=True).items(): setattr(rec, k, v)
    db.commit(); db.refresh(rec)
    return rec

@router.delete("/{rec_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_training(rec_id: int, db: Session = Depends(get_db)):
    rec = db.get(TrainingRecord, rec_id)
    if not rec: raise HTTPException(status_code=404, detail="Tidak ditemukan.")
    db.delete(rec); db.commit()
