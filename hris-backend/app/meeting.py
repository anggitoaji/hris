"""Modul Meeting / Notulen Rapat (mandiri dalam satu file).

Berisi:
- Tabel `meetings` (induk: satu rapat) dan `meeting_action_items`
  (rincian: tugas tindak lanjut / action item).
- Router API: CRUD rapat (dengan action item bersarang), filter per
  kategori/status, ringkasan, serta daftar action item lintas rapat
  (untuk submenu "Action Item") dan toggle selesai per item.
"""

from __future__ import annotations

from datetime import date as Date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import (
    Boolean, Date as SADate, DateTime, ForeignKey, Integer, String, func,
)
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.database import Base, get_db


CATEGORIES = {"Internal", "Pelanggan"}
STATUSES = ["Terjadwal", "Selesai", "Batal"]


# ===================== Model =====================
class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(160), index=True)
    category: Mapped[str] = mapped_column(String(16), default="Internal", index=True)
    date: Mapped[Date] = mapped_column(SADate, index=True)
    time: Mapped[str | None] = mapped_column(String(5), nullable=True)   # "HH:MM"
    location: Mapped[str | None] = mapped_column(String(160), nullable=True)
    organizer: Mapped[str | None] = mapped_column(String(128), nullable=True)
    participants: Mapped[str | None] = mapped_column(String(512), nullable=True)
    agenda: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(4000), nullable=True)  # notulen
    status: Mapped[str] = mapped_column(String(12), default="Terjadwal")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ActionItem(Base):
    __tablename__ = "meeting_action_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(Integer, ForeignKey("meetings.id"), index=True)
    task: Mapped[str] = mapped_column(String(400))
    assignee: Mapped[str | None] = mapped_column(String(128), nullable=True)
    due_date: Mapped[Date | None] = mapped_column(SADate, nullable=True)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    sort: Mapped[int] = mapped_column(Integer, default=0)


# ===================== Skema =====================
class ActionItemIn(BaseModel):
    task: str = Field(..., max_length=400)
    assignee: str | None = Field(default=None, max_length=128)
    due_date: Date | None = None
    done: bool = False


class ActionItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    task: str
    assignee: str | None = None
    due_date: Date | None = None
    done: bool = False


class ActionItemPatch(BaseModel):
    task: str | None = Field(default=None, max_length=400)
    assignee: str | None = Field(default=None, max_length=128)
    due_date: Date | None = None
    done: bool | None = None


class ActionItemFlat(ActionItemOut):
    meeting_id: int
    meeting_title: str = ""
    meeting_date: Date | None = None
    meeting_category: str = ""


class MeetingBase(BaseModel):
    title: str = Field(..., max_length=160)
    category: str = Field(default="Internal")
    date: Date
    time: str | None = Field(default=None, max_length=5)
    location: str | None = Field(default=None, max_length=160)
    organizer: str | None = Field(default=None, max_length=128)
    participants: str | None = Field(default=None, max_length=512)
    agenda: str | None = None
    notes: str | None = None
    status: str = "Terjadwal"


class MeetingCreate(MeetingBase):
    action_items: list[ActionItemIn] | None = None


class MeetingUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    category: str | None = None
    date: Date | None = None
    time: str | None = Field(default=None, max_length=5)
    location: str | None = Field(default=None, max_length=160)
    organizer: str | None = Field(default=None, max_length=128)
    participants: str | None = Field(default=None, max_length=512)
    agenda: str | None = None
    notes: str | None = None
    status: str | None = None
    action_items: list[ActionItemIn] | None = None  # bila dikirim, mengganti seluruh action item


class MeetingOut(MeetingBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    action_items: list[ActionItemOut] = []
    open_actions: int = 0


class MeetingSummary(BaseModel):
    total: int = 0
    terjadwal: int = 0
    selesai: int = 0
    open_actions: int = 0


# ===================== Helper =====================
def _validate_category(c: str) -> str:
    c = (c or "").strip()
    if c not in CATEGORIES:
        raise HTTPException(status_code=422, detail="Kategori harus 'Internal' atau 'Pelanggan'.")
    return c


def _validate_status(s: str) -> str:
    s = (s or "").strip()
    if s not in STATUSES:
        raise HTTPException(status_code=422, detail=f"Status tidak valid. Pilihan: {', '.join(STATUSES)}.")
    return s


def _items_of(db: Session, meeting_id: int) -> list[ActionItem]:
    return (
        db.query(ActionItem)
        .filter(ActionItem.meeting_id == meeting_id)
        .order_by(ActionItem.sort, ActionItem.id)
        .all()
    )


def _to_out(db: Session, m: Meeting) -> MeetingOut:
    items = _items_of(db, m.id)
    o = MeetingOut.model_validate(m)
    o.action_items = [ActionItemOut.model_validate(i) for i in items]
    o.open_actions = sum(1 for i in items if not i.done)
    return o


def _replace_items(db: Session, meeting_id: int, items: list[ActionItemIn]) -> None:
    db.query(ActionItem).filter(ActionItem.meeting_id == meeting_id).delete(synchronize_session=False)
    for idx, it in enumerate(items):
        task = (it.task or "").strip()
        if not task:
            continue
        db.add(ActionItem(
            meeting_id=meeting_id,
            task=task,
            assignee=(it.assignee or None),
            due_date=it.due_date,
            done=bool(it.done),
            sort=idx,
        ))


# ===================== Router =====================
router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.get("/summary", response_model=MeetingSummary)
def summary(db: Session = Depends(get_db)):
    out = MeetingSummary()
    out.total = db.query(Meeting).count()
    out.terjadwal = db.query(Meeting).filter(Meeting.status == "Terjadwal").count()
    out.selesai = db.query(Meeting).filter(Meeting.status == "Selesai").count()
    out.open_actions = db.query(ActionItem).filter(ActionItem.done.is_(False)).count()
    return out


@router.get("/action-items", response_model=list[ActionItemFlat])
def list_action_items(
    done: bool | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Daftar action item lintas rapat (untuk submenu Action Item)."""
    q = db.query(ActionItem)
    if done is not None:
        q = q.filter(ActionItem.done.is_(done))
    items = q.order_by(ActionItem.done, ActionItem.due_date.is_(None), ActionItem.due_date, ActionItem.id).all()
    mids = {i.meeting_id for i in items}
    mmap = {m.id: m for m in db.query(Meeting).filter(Meeting.id.in_(mids)).all()} if mids else {}
    out: list[ActionItemFlat] = []
    for i in items:
        m = mmap.get(i.meeting_id)
        fa = ActionItemFlat.model_validate(i)
        fa.meeting_id = i.meeting_id
        if m is not None:
            fa.meeting_title = m.title
            fa.meeting_date = m.date
            fa.meeting_category = m.category
        out.append(fa)
    return out


@router.patch("/action-items/{item_id}", response_model=ActionItemOut)
def patch_action_item(item_id: int, payload: ActionItemPatch, db: Session = Depends(get_db)):
    it = db.get(ActionItem, item_id)
    if not it:
        raise HTTPException(status_code=404, detail="Action item tidak ditemukan.")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(it, k, v)
    db.commit()
    db.refresh(it)
    return ActionItemOut.model_validate(it)


@router.get("", response_model=list[MeetingOut])
def list_meetings(
    category: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
):
    q = db.query(Meeting)
    if category:
        q = q.filter(Meeting.category == category)
    if status_filter:
        q = q.filter(Meeting.status == status_filter)
    items = q.order_by(Meeting.date.desc(), Meeting.id.desc()).all()
    return [_to_out(db, m) for m in items]


@router.get("/{meeting_id}", response_model=MeetingOut)
def get_meeting(meeting_id: int, db: Session = Depends(get_db)):
    m = db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Rapat tidak ditemukan.")
    return _to_out(db, m)


@router.post("", response_model=MeetingOut, status_code=status.HTTP_201_CREATED)
def create_meeting(payload: MeetingCreate, db: Session = Depends(get_db)):
    m = Meeting(
        title=payload.title.strip(),
        category=_validate_category(payload.category),
        date=payload.date,
        time=(payload.time or None),
        location=(payload.location or None),
        organizer=(payload.organizer or None),
        participants=(payload.participants or None),
        agenda=(payload.agenda or None),
        notes=(payload.notes or None),
        status=_validate_status(payload.status),
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    if payload.action_items:
        _replace_items(db, m.id, payload.action_items)
        db.commit()
    return _to_out(db, m)


@router.patch("/{meeting_id}", response_model=MeetingOut)
def update_meeting(meeting_id: int, payload: MeetingUpdate, db: Session = Depends(get_db)):
    m = db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Rapat tidak ditemukan.")
    data = payload.model_dump(exclude_unset=True)

    if "category" in data and data["category"] is not None:
        m.category = _validate_category(data["category"])
    if "status" in data and data["status"] is not None:
        m.status = _validate_status(data["status"])
    for k in ["title", "date", "time", "location", "organizer", "participants", "agenda", "notes"]:
        if k not in data:
            continue
        v = data[k]
        if k == "title":
            setattr(m, k, v.strip() if v is not None else m.title)
        else:
            setattr(m, k, v if v not in ("", None) else None)

    if payload.action_items is not None:
        _replace_items(db, m.id, payload.action_items)

    db.commit()
    db.refresh(m)
    return _to_out(db, m)


@router.delete("/{meeting_id}", status_code=status.HTTP_200_OK)
def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    m = db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Rapat tidak ditemukan.")
    db.query(ActionItem).filter(ActionItem.meeting_id == meeting_id).delete(synchronize_session=False)
    db.delete(m)
    db.commit()
    return {"ok": True, "id": meeting_id}
