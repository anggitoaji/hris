"""Modul Riwayat Pendidikan karyawan (mandiri dalam satu file).

Tabel `education_records` (multi-baris per karyawan).
CRUD endpoint di /education.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.database import Base, get_db


# ===================== Model =====================
class EducationRecord(Base):
    __tablename__ = "education_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    jenjang: Mapped[str] = mapped_column(String(32), nullable=False)        # SD/SMP/SMA/D3/S1/S2/S3
    institusi: Mapped[str] = mapped_column(String(256), nullable=False)     # Nama universitas/sekolah
    jurusan: Mapped[str | None] = mapped_column(String(256), nullable=True)
    ipk: Mapped[float | None] = mapped_column(Float, nullable=True)
    tahun_masuk: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tahun_lulus: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)


# ===================== Schema =====================
class EduBase(BaseModel):
    jenjang: str = Field(..., max_length=32, examples=["S1"])
    institusi: str = Field(..., max_length=256, examples=["Universitas Indonesia"])
    jurusan: str | None = Field(default=None, max_length=256)
    ipk: float | None = Field(default=None, ge=0, le=4)
    tahun_masuk: int | None = Field(default=None, ge=1950, le=2100)
    tahun_lulus: int | None = Field(default=None, ge=1950, le=2100)


class EduCreate(EduBase):
    employee_id: int


class EduUpdate(BaseModel):
    jenjang: str | None = Field(default=None, max_length=32)
    institusi: str | None = Field(default=None, max_length=256)
    jurusan: str | None = Field(default=None, max_length=256)
    ipk: float | None = Field(default=None, ge=0, le=4)
    tahun_masuk: int | None = Field(default=None, ge=1950, le=2100)
    tahun_lulus: int | None = Field(default=None, ge=1950, le=2100)


class EduOut(EduBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: int
    sort: int


# ===================== Router =====================
router = APIRouter(prefix="/education", tags=["Education"])


@router.get("", response_model=list[EduOut])
def list_education(
    employee_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Daftar riwayat pendidikan seorang karyawan."""
    return (
        db.query(EducationRecord)
        .filter(EducationRecord.employee_id == employee_id)
        .order_by(EducationRecord.sort, EducationRecord.tahun_masuk)
        .all()
    )


@router.post("", response_model=EduOut, status_code=status.HTTP_201_CREATED)
def create_education(payload: EduCreate, db: Session = Depends(get_db)):
    rec = EducationRecord(**payload.model_dump())
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.patch("/{rec_id}", response_model=EduOut)
def update_education(rec_id: int, payload: EduUpdate, db: Session = Depends(get_db)):
    rec = db.get(EducationRecord, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Data pendidikan tidak ditemukan.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(rec, k, v)
    db.commit()
    db.refresh(rec)
    return rec


@router.delete("/{rec_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_education(rec_id: int, db: Session = Depends(get_db)):
    rec = db.get(EducationRecord, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Data pendidikan tidak ditemukan.")
    db.delete(rec)
    db.commit()
