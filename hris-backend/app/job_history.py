"""Modul Riwayat Jabatan karyawan."""

from __future__ import annotations

from datetime import date as DateType

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.database import Base, get_db


class JobHistoryRecord(Base):
    __tablename__ = "job_history_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    jabatan_lama: Mapped[str | None] = mapped_column(String(128), nullable=True)
    jabatan_baru: Mapped[str | None] = mapped_column(String(128), nullable=True)
    divisi_lama: Mapped[str | None] = mapped_column(String(128), nullable=True)
    divisi_baru: Mapped[str | None] = mapped_column(String(128), nullable=True)
    tanggal_efektif: Mapped[DateType | None] = mapped_column(Date, nullable=True)
    alasan: Mapped[str | None] = mapped_column(String(512), nullable=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class JHBase(BaseModel):
    jabatan_lama: str | None = Field(default=None, max_length=128)
    jabatan_baru: str | None = Field(default=None, max_length=128)
    divisi_lama: str | None = Field(default=None, max_length=128)
    divisi_baru: str | None = Field(default=None, max_length=128)
    tanggal_efektif: DateType | None = None
    alasan: str | None = Field(default=None, max_length=512)

class JHCreate(JHBase):
    employee_id: int

class JHUpdate(JHBase):
    pass

class JHOut(JHBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: int
    sort: int


router = APIRouter(prefix="/job-history", tags=["Job History"])

@router.get("", response_model=list[JHOut])
def list_jh(employee_id: int = Query(...), db: Session = Depends(get_db)):
    return db.query(JobHistoryRecord).filter(JobHistoryRecord.employee_id == employee_id).order_by(JobHistoryRecord.tanggal_efektif.desc()).all()

@router.post("", response_model=JHOut, status_code=status.HTTP_201_CREATED)
def create_jh(payload: JHCreate, db: Session = Depends(get_db)):
    rec = JobHistoryRecord(**payload.model_dump())
    db.add(rec); db.commit(); db.refresh(rec)
    return rec

@router.patch("/{rec_id}", response_model=JHOut)
def update_jh(rec_id: int, payload: JHUpdate, db: Session = Depends(get_db)):
    rec = db.get(JobHistoryRecord, rec_id)
    if not rec: raise HTTPException(status_code=404, detail="Tidak ditemukan.")
    for k, v in payload.model_dump(exclude_unset=True).items(): setattr(rec, k, v)
    db.commit(); db.refresh(rec)
    return rec

@router.delete("/{rec_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_jh(rec_id: int, db: Session = Depends(get_db)):
    rec = db.get(JobHistoryRecord, rec_id)
    if not rec: raise HTTPException(status_code=404, detail="Tidak ditemukan.")
    db.delete(rec); db.commit()
