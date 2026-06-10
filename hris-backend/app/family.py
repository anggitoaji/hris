"""Modul Data Keluarga karyawan (Pasangan & Anak)."""

from __future__ import annotations

from datetime import date as DateType

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.database import Base, get_db

RELATIONS = ["Pasangan", "Anak"]


class FamilyRecord(Base):
    __tablename__ = "family_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    hubungan: Mapped[str] = mapped_column(String(32), nullable=False)          # Pasangan / Anak
    nama: Mapped[str] = mapped_column(String(128), nullable=False)
    jenis_kelamin: Mapped[str | None] = mapped_column(String(16), nullable=True)
    tempat_lahir: Mapped[str | None] = mapped_column(String(128), nullable=True)
    tanggal_lahir: Mapped[DateType | None] = mapped_column(Date, nullable=True)
    pendidikan: Mapped[str | None] = mapped_column(String(64), nullable=True)
    no_hp: Mapped[str | None] = mapped_column(String(32), nullable=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class FamBase(BaseModel):
    hubungan: str = Field(..., max_length=32, examples=["Anak"])
    nama: str = Field(..., max_length=128)
    jenis_kelamin: str | None = Field(default=None, max_length=16)
    tempat_lahir: str | None = Field(default=None, max_length=128)
    tanggal_lahir: DateType | None = None
    pendidikan: str | None = Field(default=None, max_length=64)
    no_hp: str | None = Field(default=None, max_length=32)

class FamCreate(FamBase):
    employee_id: int

class FamUpdate(BaseModel):
    hubungan: str | None = Field(default=None, max_length=32)
    nama: str | None = Field(default=None, max_length=128)
    jenis_kelamin: str | None = Field(default=None, max_length=16)
    tempat_lahir: str | None = Field(default=None, max_length=128)
    tanggal_lahir: DateType | None = None
    pendidikan: str | None = Field(default=None, max_length=64)
    no_hp: str | None = Field(default=None, max_length=32)

class FamOut(FamBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: int
    sort: int


router = APIRouter(prefix="/family", tags=["Family"])

@router.get("", response_model=list[FamOut])
def list_family(employee_id: int = Query(...), db: Session = Depends(get_db)):
    return db.query(FamilyRecord).filter(FamilyRecord.employee_id == employee_id).order_by(FamilyRecord.sort, FamilyRecord.id).all()

@router.post("", response_model=FamOut, status_code=status.HTTP_201_CREATED)
def create_family(payload: FamCreate, db: Session = Depends(get_db)):
    rec = FamilyRecord(**payload.model_dump())
    db.add(rec); db.commit(); db.refresh(rec)
    return rec

@router.patch("/{rec_id}", response_model=FamOut)
def update_family(rec_id: int, payload: FamUpdate, db: Session = Depends(get_db)):
    rec = db.get(FamilyRecord, rec_id)
    if not rec: raise HTTPException(status_code=404, detail="Tidak ditemukan.")
    for k, v in payload.model_dump(exclude_unset=True).items(): setattr(rec, k, v)
    db.commit(); db.refresh(rec)
    return rec

@router.delete("/{rec_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_family(rec_id: int, db: Session = Depends(get_db)):
    rec = db.get(FamilyRecord, rec_id)
    if not rec: raise HTTPException(status_code=404, detail="Tidak ditemukan.")
    db.delete(rec); db.commit()
