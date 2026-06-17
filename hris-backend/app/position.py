"""Modul Position Management — posisi jabatan terpisah dari karyawan.

Setiap posisi punya kode unik dan status Filled/Vacant/Planned.
Ketika karyawan resign, posisi tetap ada dengan status Vacant.
FK ke employees (nullable) dan job_profiles (nullable).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.audit import log_audit, get_client_ip
from app.auth import get_current_user, require_roles, User
from app.core.database import Base, get_db

# ===================== Model =====================


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kode: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    nama_jabatan: Mapped[str] = mapped_column(String(128), index=True)
    department: Mapped[str] = mapped_column(String(64), index=True)
    level: Mapped[str] = mapped_column(String(32))         # Staff/Supervisor/Manager/Direksi
    status: Mapped[str] = mapped_column(String(16), default="Vacant", index=True)  # Filled/Vacant/Planned

    employee_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )
    job_profile_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("job_profiles.id", ondelete="SET NULL"), nullable=True
    )

    keterangan: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


# ===================== Schemas =====================


class PositionCreate(BaseModel):
    kode: str
    nama_jabatan: str
    department: str
    level: str
    status: str = "Vacant"
    employee_id: int | None = None
    job_profile_id: int | None = None
    keterangan: str | None = None


class PositionUpdate(BaseModel):
    nama_jabatan: str | None = None
    department: str | None = None
    level: str | None = None
    status: str | None = None
    employee_id: int | None = None
    job_profile_id: int | None = None
    keterangan: str | None = None


# ===================== Router =====================

router = APIRouter(prefix="/positions", tags=["Position Management"])


def _to_out(pos: Position, db: Session) -> dict[str, Any]:
    # Ambil nama karyawan & job profile jika ada FK
    emp_nama = None
    if pos.employee_id:
        from sqlalchemy import text
        row = db.execute(text("SELECT nama FROM employees WHERE id = :eid"), {"eid": pos.employee_id}).fetchone()
        if row:
            emp_nama = row[0]

    jp_nama = None
    if pos.job_profile_id:
        from sqlalchemy import text
        row = db.execute(text("SELECT nama FROM job_profiles WHERE id = :jid"), {"jid": pos.job_profile_id}).fetchone()
        if row:
            jp_nama = row[0]

    return {
        "id": pos.id,
        "kode": pos.kode,
        "nama_jabatan": pos.nama_jabatan,
        "department": pos.department,
        "level": pos.level,
        "status": pos.status,
        "employee_id": pos.employee_id,
        "employee_nama": emp_nama,
        "job_profile_id": pos.job_profile_id,
        "job_profile_nama": jp_nama,
        "keterangan": pos.keterangan,
        "created_at": pos.created_at.isoformat() if pos.created_at else None,
        "updated_at": pos.updated_at.isoformat() if pos.updated_at else None,
    }


@router.get("")
def list_positions(
    department: str | None = None,
    status: str | None = None,
    level: str | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(Position)
    if department:
        q = q.filter(Position.department == department)
    if status:
        q = q.filter(Position.status == status)
    if level:
        q = q.filter(Position.level == level)
    return [_to_out(p, db) for p in q.order_by(Position.department, Position.level, Position.nama_jabatan).all()]


@router.get("/summary")
def positions_summary(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Ringkasan jumlah Filled/Vacant/Planned."""
    from sqlalchemy import func as sqlfunc
    rows = db.query(Position.status, sqlfunc.count(Position.id)).group_by(Position.status).all()
    return {r[0]: r[1] for r in rows}


@router.get("/{pos_id}")
def get_position(
    pos_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    pos = db.get(Position, pos_id)
    if not pos:
        raise HTTPException(status_code=404, detail="Posisi tidak ditemukan")
    return _to_out(pos, db)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_position(
    payload: PositionCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR")),
):
    if db.query(Position).filter(Position.kode == payload.kode).first():
        raise HTTPException(status_code=409, detail=f"Kode posisi '{payload.kode}' sudah digunakan")
    if payload.status not in ("Filled", "Vacant", "Planned"):
        raise HTTPException(status_code=422, detail="Status harus Filled, Vacant, atau Planned")
    pos = Position(**payload.model_dump())
    db.add(pos)
    db.commit()
    db.refresh(pos)
    log_audit(db, user.id, "positions", pos.id, "CREATE", None, payload.model_dump(), get_client_ip(request))
    return _to_out(pos, db)


@router.patch("/{pos_id}")
def update_position(
    pos_id: int,
    payload: PositionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR")),
):
    pos = db.get(Position, pos_id)
    if not pos:
        raise HTTPException(status_code=404, detail="Posisi tidak ditemukan")
    before = _to_out(pos, db)
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in ("Filled", "Vacant", "Planned"):
        raise HTTPException(status_code=422, detail="Status harus Filled, Vacant, atau Planned")
    for k, v in data.items():
        setattr(pos, k, v)
    # Sinkronisasi status otomatis
    if pos.employee_id:
        pos.status = "Filled"
    elif pos.status == "Filled":
        pos.status = "Vacant"
    db.commit()
    db.refresh(pos)
    log_audit(db, user.id, "positions", pos.id, "UPDATE", before, _to_out(pos, db), get_client_ip(request))
    return _to_out(pos, db)


@router.delete("/{pos_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_position(
    pos_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR")),
):
    pos = db.get(Position, pos_id)
    if not pos:
        raise HTTPException(status_code=404, detail="Posisi tidak ditemukan")
    before = _to_out(pos, db)
    db.delete(pos)
    db.commit()
    log_audit(db, user.id, "positions", pos_id, "DELETE", before, None, get_client_ip(request))
