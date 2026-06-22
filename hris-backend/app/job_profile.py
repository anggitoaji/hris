"""Modul Job Profile — template per jabatan yang menjadi engine utama HRIS.

Satu Job Profile bisa diacu banyak Position. Berisi tujuan jabatan, tugas,
tanggung jawab, wewenang, persyaratan, template KPI, kompetensi, career path,
dan training matrix.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.audit import log_audit, get_client_ip
from app.auth import get_current_user, require_roles, User
from app.core.database import Base, get_db

# ===================== Model =====================


class JobProfile(Base):
    __tablename__ = "job_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kode: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    nama: Mapped[str] = mapped_column(String(128), index=True)
    level: Mapped[str] = mapped_column(String(32))      # Staff/Supervisor/Manager/Direksi
    department: Mapped[str] = mapped_column(String(64))

    tujuan_jabatan: Mapped[str | None] = mapped_column(Text, nullable=True)
    tugas: Mapped[str | None] = mapped_column(Text, nullable=True)
    tanggung_jawab: Mapped[str | None] = mapped_column(Text, nullable=True)
    wewenang: Mapped[str | None] = mapped_column(Text, nullable=True)

    persyaratan_pendidikan: Mapped[str | None] = mapped_column(String(128), nullable=True)
    persyaratan_pengalaman: Mapped[str | None] = mapped_column(String(256), nullable=True)
    persyaratan_keahlian: Mapped[str | None] = mapped_column(Text, nullable=True)

    # JSON string — frontend parse sebagai array/object
    kompetensi: Mapped[str | None] = mapped_column(Text, nullable=True)       # [{nama, level_required}]
    kpi_template: Mapped[str | None] = mapped_column(Text, nullable=True)     # [{aspek, bobot, target, satuan}]
    training_mandatory: Mapped[str | None] = mapped_column(Text, nullable=True)
    training_recommended: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Career path
    career_path_naik: Mapped[str | None] = mapped_column(String(128), nullable=True)
    career_path_turun: Mapped[str | None] = mapped_column(String(128), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


# ===================== Schemas =====================


class JobProfileBase(BaseModel):
    kode: str
    nama: str
    level: str
    department: str
    tujuan_jabatan: str | None = None
    tugas: str | None = None
    tanggung_jawab: str | None = None
    wewenang: str | None = None
    persyaratan_pendidikan: str | None = None
    persyaratan_pengalaman: str | None = None
    persyaratan_keahlian: str | None = None
    kompetensi: str | None = None
    kpi_template: str | None = None
    training_mandatory: str | None = None
    training_recommended: str | None = None
    career_path_naik: str | None = None
    career_path_turun: str | None = None


class JobProfileCreate(JobProfileBase):
    pass


class JobProfileUpdate(BaseModel):
    nama: str | None = None
    level: str | None = None
    department: str | None = None
    tujuan_jabatan: str | None = None
    tugas: str | None = None
    tanggung_jawab: str | None = None
    wewenang: str | None = None
    persyaratan_pendidikan: str | None = None
    persyaratan_pengalaman: str | None = None
    persyaratan_keahlian: str | None = None
    kompetensi: str | None = None
    kpi_template: str | None = None
    training_mandatory: str | None = None
    training_recommended: str | None = None
    career_path_naik: str | None = None
    career_path_turun: str | None = None


class JobProfileOut(JobProfileBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


# ===================== Router =====================

router = APIRouter(prefix="/job-profiles", tags=["Job Profile"])

HR_ROLES = ("HR", "Super Admin")


def _to_out(jp: JobProfile) -> dict[str, Any]:
    return {
        "id": jp.id,
        "kode": jp.kode,
        "nama": jp.nama,
        "level": jp.level,
        "department": jp.department,
        "tujuan_jabatan": jp.tujuan_jabatan,
        "tugas": jp.tugas,
        "tanggung_jawab": jp.tanggung_jawab,
        "wewenang": jp.wewenang,
        "persyaratan_pendidikan": jp.persyaratan_pendidikan,
        "persyaratan_pengalaman": jp.persyaratan_pengalaman,
        "persyaratan_keahlian": jp.persyaratan_keahlian,
        "kompetensi": jp.kompetensi,
        "kpi_template": jp.kpi_template,
        "training_mandatory": jp.training_mandatory,
        "training_recommended": jp.training_recommended,
        "career_path_naik": jp.career_path_naik,
        "career_path_turun": jp.career_path_turun,
        "created_at": jp.created_at.isoformat() if jp.created_at else None,
        "updated_at": jp.updated_at.isoformat() if jp.updated_at else None,
    }


@router.get("")
def list_job_profiles(
    department: str | None = None,
    level: str | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(JobProfile)
    if department:
        q = q.filter(JobProfile.department == department)
    if level:
        q = q.filter(JobProfile.level == level)
    return [_to_out(jp) for jp in q.order_by(JobProfile.department, JobProfile.level, JobProfile.nama).all()]


@router.get("/{jp_id}")
def get_job_profile(
    jp_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    jp = db.get(JobProfile, jp_id)
    if not jp:
        raise HTTPException(status_code=404, detail="Job Profile tidak ditemukan")
    return _to_out(jp)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_job_profile(
    payload: JobProfileCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR")),
):
    if db.query(JobProfile).filter(JobProfile.kode == payload.kode).first():
        raise HTTPException(status_code=409, detail=f"Kode '{payload.kode}' sudah digunakan")
    jp = JobProfile(**payload.model_dump())
    db.add(jp)
    db.commit()
    db.refresh(jp)
    log_audit(db, user_id=user.id, username=user.username, action="CREATE", entity_type="job_profiles", entity_id=jp.id, new_data=payload.model_dump(), ip_address=get_client_ip(request))
    return _to_out(jp)


@router.patch("/{jp_id}")
def update_job_profile(
    jp_id: int,
    payload: JobProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR")),
):
    jp = db.get(JobProfile, jp_id)
    if not jp:
        raise HTTPException(status_code=404, detail="Job Profile tidak ditemukan")
    before = _to_out(jp)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(jp, k, v)
    db.commit()
    db.refresh(jp)
    log_audit(db, user_id=user.id, username=user.username, action="UPDATE", entity_type="job_profiles", entity_id=jp.id, old_data=before, new_data=_to_out(jp), ip_address=get_client_ip(request))
    return _to_out(jp)


@router.delete("/{jp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job_profile(
    jp_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR")),
):
    jp = db.get(JobProfile, jp_id)
    if not jp:
        raise HTTPException(status_code=404, detail="Job Profile tidak ditemukan")
    before = _to_out(jp)
    db.delete(jp)
    db.commit()
    log_audit(db, user_id=user.id, username=user.username, action="DELETE", entity_type="job_profiles", entity_id=jp_id, old_data=before, ip_address=get_client_ip(request))
