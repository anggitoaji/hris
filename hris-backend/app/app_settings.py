from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.auth import require_roles, User
from app.core.database import Base, get_db

DEFAULTS: dict[str, str] = {
    "company_name": "Solusi Group",
    "company_address": "",
    "company_email": "",
    "company_phone": "",
    "app_version": "1.0.0",
    "app_build": "2026.06",
}


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)


class SettingsPatch(BaseModel):
    data: dict[str, str]


router = APIRouter(prefix="/app-settings", tags=["App Settings"])


@router.get("")
def get_settings(
    _user: User = Depends(require_roles()),
    db: Session = Depends(get_db),
):
    rows = db.query(AppSetting).all()
    result = dict(DEFAULTS)
    for r in rows:
        result[r.key] = r.value or ""
    return result


@router.patch("")
def update_settings(
    payload: SettingsPatch,
    _request: Request,
    _user: User = Depends(require_roles()),
    db: Session = Depends(get_db),
):
    for k, v in payload.data.items():
        row = db.get(AppSetting, k)
        if row:
            row.value = v
        else:
            db.add(AppSetting(key=k, value=v))
    db.commit()
    return {"ok": True}
