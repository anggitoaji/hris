"""Modul Audit Trail — mencatat perubahan data.

Helper `log_audit()` dipanggil dari endpoint mana pun.
GET /audit-logs untuk melihat riwayat.
"""

from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.database import Base, get_db


# ===================== Model =====================
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(16), nullable=False)       # CREATE / UPDATE / DELETE
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)  # employee / education / document / ...
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    employee_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # karyawan terkait
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    old_data: Mapped[str | None] = mapped_column(Text, nullable=True)     # JSON
    new_data: Mapped[str | None] = mapped_column(Text, nullable=True)     # JSON
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ===================== Helper =====================
def log_audit(
    db: Session,
    *,
    user_id: int | None = None,
    username: str = "system",
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    employee_id: int | None = None,
    description: str | None = None,
    old_data: dict | None = None,
    new_data: dict | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    """Catat satu entri audit log."""
    entry = AuditLog(
        user_id=user_id,
        username=username,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        employee_id=employee_id,
        description=description,
        old_data=json.dumps(old_data, default=str) if old_data else None,
        new_data=json.dumps(new_data, default=str) if new_data else None,
        ip_address=ip_address,
    )
    db.add(entry)
    db.commit()
    return entry


def get_client_ip(request: Request) -> str:
    """Ambil IP client dari request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ===================== Schema =====================
class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int | None
    username: str
    action: str
    entity_type: str
    entity_id: int | None
    employee_id: int | None
    description: str | None
    old_data: str | None
    new_data: str | None
    ip_address: str | None
    created_at: datetime


# ===================== Router =====================
router = APIRouter(prefix="/audit-logs", tags=["Audit Trail"])


@router.get("", response_model=list[AuditLogOut])
def list_audit_logs(
    employee_id: int | None = Query(None),
    entity_type: str | None = Query(None),
    username: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if employee_id is not None:
        q = q.filter(AuditLog.employee_id == employee_id)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if username:
        q = q.filter(AuditLog.username.ilike(f"%{username}%"))
    return q.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
