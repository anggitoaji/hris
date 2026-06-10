"""Modul Sertifikasi karyawan (mandiri dalam satu file).

Tabel `certification_records` (multi-baris per karyawan).
CRUD endpoint di /certifications.
"""

from __future__ import annotations

from datetime import date as DateType

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.database import Base, get_db


# ===================== Model =====================
class CertificationRecord(Base):
    __tablename__ = "certification_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    nama: Mapped[str] = mapped_column(String(256), nullable=False)
    nomor: Mapped[str | None] = mapped_column(String(128), nullable=True)
    penerbit: Mapped[str | None] = mapped_column(String(256), nullable=True)
    tanggal_terbit: Mapped[DateType | None] = mapped_column(Date, nullable=True)
    tanggal_kadaluarsa: Mapped[DateType | None] = mapped_column(Date, nullable=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)


# ===================== Schema =====================
class CertBase(BaseModel):
    nama: str = Field(..., max_length=256, examples=["CCNA"])
    nomor: str | None = Field(default=None, max_length=128)
    penerbit: str | None = Field(default=None, max_length=256, examples=["Cisco"])
    tanggal_terbit: DateType | None = None
    tanggal_kadaluarsa: DateType | None = None


class CertCreate(CertBase):
    employee_id: int


class CertUpdate(BaseModel):
    nama: str | None = Field(default=None, max_length=256)
    nomor: str | None = Field(default=None, max_length=128)
    penerbit: str | None = Field(default=None, max_length=256)
    tanggal_terbit: DateType | None = None
    tanggal_kadaluarsa: DateType | None = None


class CertOut(CertBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: int
    sort: int


# ===================== Router =====================
router = APIRouter(prefix="/certifications", tags=["Certifications"])


@router.get("", response_model=list[CertOut])
def list_certifications(
    employee_id: int = Query(...),
    db: Session = Depends(get_db),
):
    return (
        db.query(CertificationRecord)
        .filter(CertificationRecord.employee_id == employee_id)
        .order_by(CertificationRecord.sort, CertificationRecord.tanggal_terbit.desc())
        .all()
    )


@router.post("", response_model=CertOut, status_code=status.HTTP_201_CREATED)
def create_certification(payload: CertCreate, db: Session = Depends(get_db)):
    rec = CertificationRecord(**payload.model_dump())
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.patch("/{rec_id}", response_model=CertOut)
def update_certification(rec_id: int, payload: CertUpdate, db: Session = Depends(get_db)):
    rec = db.get(CertificationRecord, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Sertifikasi tidak ditemukan.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(rec, k, v)
    db.commit()
    db.refresh(rec)
    return rec


@router.delete("/{rec_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_certification(rec_id: int, db: Session = Depends(get_db)):
    rec = db.get(CertificationRecord, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Sertifikasi tidak ditemukan.")
    db.delete(rec)
    db.commit()
