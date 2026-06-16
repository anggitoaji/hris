"""Modul Reward Management — penghargaan karyawan, tersimpan permanen di profil karyawan."""

from __future__ import annotations

from datetime import date as DateType, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.audit import get_client_ip, log_audit
from app.auth import User, get_current_user, require_roles
from app.core.database import Base, get_db

JENIS_REWARD = [
    "Employee of The Semester", "Best Attendance", "Best Performance",
    "Innovation Award", "Leadership Award", "Special Achievement Award",
]


class RewardGrant(Base):
    __tablename__ = "reward_grants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    jenis_reward: Mapped[str] = mapped_column(String(64), nullable=False)
    period: Mapped[str | None] = mapped_column(String(32), nullable=True)
    tanggal: Mapped[DateType] = mapped_column(Date, nullable=False)
    deskripsi: Mapped[str | None] = mapped_column(Text, nullable=True)
    given_by_username: Mapped[str] = mapped_column(String(64), nullable=False)
    given_by_role: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RewardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: int
    jenis_reward: str
    period: str | None
    tanggal: DateType
    deskripsi: str | None
    given_by_username: str
    given_by_role: str
    created_at: datetime


class RewardCreate(BaseModel):
    employee_id: int
    jenis_reward: str = Field(..., max_length=64)
    period: str | None = Field(default=None, max_length=32)
    tanggal: DateType
    deskripsi: str | None = None


router = APIRouter(prefix="/rewards", tags=["Reward Management"])


@router.get("", response_model=list[RewardOut])
def list_rewards(employee_id: int = Query(...), db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return (
        db.query(RewardGrant)
        .filter(RewardGrant.employee_id == employee_id)
        .order_by(RewardGrant.tanggal.desc())
        .all()
    )


@router.post("", response_model=RewardOut, status_code=status.HTTP_201_CREATED)
def create_reward(
    payload: RewardCreate, request: Request, db: Session = Depends(get_db),
    user: User = Depends(require_roles("Manager", "Supervisor", "HR")),
):
    if payload.jenis_reward not in JENIS_REWARD:
        raise HTTPException(status_code=400, detail=f"Jenis reward tidak valid. Pilih: {', '.join(JENIS_REWARD)}")
    rec = RewardGrant(
        employee_id=payload.employee_id,
        jenis_reward=payload.jenis_reward,
        period=payload.period,
        tanggal=payload.tanggal,
        deskripsi=payload.deskripsi,
        given_by_username=user.username,
        given_by_role=user.role,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    log_audit(
        db, user_id=user.id, username=user.username, action="CREATE", entity_type="reward_grant",
        entity_id=rec.id, employee_id=payload.employee_id,
        description=f"Reward {payload.jenis_reward} untuk employee #{payload.employee_id}",
        new_data={"jenis_reward": payload.jenis_reward, "period": payload.period},
        ip_address=get_client_ip(request),
    )
    return rec


@router.delete("/{reward_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reward(
    reward_id: int, request: Request, db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR")),
):
    rec = db.get(RewardGrant, reward_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Reward tidak ditemukan.")
    log_audit(
        db, user_id=user.id, username=user.username, action="DELETE", entity_type="reward_grant",
        entity_id=rec.id, employee_id=rec.employee_id, description=f"Hapus reward {rec.jenis_reward}",
        ip_address=get_client_ip(request),
    )
    db.delete(rec)
    db.commit()
