"""Modul Kehadiran & Absensi (mandiri dalam satu file).

Berisi: model tabel `attendance`, skema Pydantic, dan router API
(lihat/ringkasan/tambah/ubah/hapus). Tiap catatan menempel ke seorang
karyawan (`employee_id`) pada satu `date` tertentu.

Aturan: satu karyawan hanya boleh punya satu catatan per tanggal
(dijaga oleh UniqueConstraint). Tabel dibuat otomatis oleh create_all
saat startup.
"""

from __future__ import annotations

from datetime import date as Date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import (
    Date as SADate,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.database import Base, get_db
from app.models.employee import Employee


# Status kehadiran yang diizinkan.
STATUSES = ["Hadir", "Terlambat", "WFH", "Izin", "Sakit", "Cuti", "Alpa"]
# Status yang dihitung sebagai "masuk kerja" (boleh punya jam masuk/keluar).
PRESENT_STATUSES = {"Hadir", "Terlambat", "WFH"}


# ===================== Model =====================
class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("employee_id", "date", name="uq_attendance_emp_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id"), index=True
    )
    date: Mapped[Date] = mapped_column(SADate, index=True)
    status: Mapped[str] = mapped_column(String(16), default="Hadir")
    check_in: Mapped[str | None] = mapped_column(String(5), nullable=True)   # "HH:MM"
    check_out: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "HH:MM"
    note: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ===================== Skema =====================
class AttendanceBase(BaseModel):
    employee_id: int = Field(..., examples=[1])
    date: Date = Field(..., examples=["2026-06-08"])
    status: str = Field(default="Hadir", examples=["Hadir"])
    check_in: str | None = Field(default=None, max_length=5, examples=["08:00"])
    check_out: str | None = Field(default=None, max_length=5, examples=["17:00"])
    note: str | None = Field(default=None, max_length=256)


class AttendanceCreate(AttendanceBase):
    pass


class AttendanceUpdate(BaseModel):
    # employee_id sengaja TIDAK bisa diubah (pindah orang = catatan baru).
    date: Date | None = None
    status: str | None = None
    check_in: str | None = Field(default=None, max_length=5)
    check_out: str | None = Field(default=None, max_length=5)
    note: str | None = Field(default=None, max_length=256)


class AttendanceOut(AttendanceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_nama: str = ""
    employee_department: str | None = None


class AttendanceSummary(BaseModel):
    date: Date
    total_karyawan: int = 0
    Hadir: int = 0
    Terlambat: int = 0
    WFH: int = 0
    Izin: int = 0
    Sakit: int = 0
    Cuti: int = 0
    Alpa: int = 0
    belum_dicatat: int = 0


# ===================== Helper =====================
def _validate_status(s: str) -> str:
    s = (s or "").strip()
    if s not in STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Status '{s}' tidak valid. Pilihan: {', '.join(STATUSES)}.",
        )
    return s


def _emp_map(db: Session, ids: list[int]) -> dict[int, Employee]:
    if not ids:
        return {}
    rows = db.query(Employee).filter(Employee.id.in_(set(ids))).all()
    return {e.id: e for e in rows}


def _to_out(a: Attendance, emp: Employee | None) -> AttendanceOut:
    o = AttendanceOut.model_validate(a)
    if emp is not None:
        o.employee_nama = emp.nama
        o.employee_department = emp.department
    return o


# ===================== Router =====================
router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.get("/dates", response_model=list[Date])
def list_dates(db: Session = Depends(get_db)):
    """Daftar tanggal yang sudah punya catatan kehadiran (terbaru dulu)."""
    rows = db.query(Attendance.date).distinct().order_by(Attendance.date.desc()).all()
    return [r[0] for r in rows]


@router.get("/summary", response_model=AttendanceSummary)
def summary(
    date: Date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Ringkasan kehadiran untuk satu tanggal (default: hari ini)."""
    the_date = date or Date.today()
    out = AttendanceSummary(date=the_date)
    out.total_karyawan = db.query(Employee).filter(Employee.is_active.is_(True)).count()

    recs = db.query(Attendance).filter(Attendance.date == the_date).all()
    for a in recs:
        if a.status in STATUSES:
            setattr(out, a.status, getattr(out, a.status) + 1)
    out.belum_dicatat = max(out.total_karyawan - len(recs), 0)
    return out


@router.get("", response_model=list[AttendanceOut])
def list_attendance(
    date: Date | None = Query(default=None),
    employee_id: int | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
):
    q = db.query(Attendance)
    if date is not None:
        q = q.filter(Attendance.date == date)
    if employee_id is not None:
        q = q.filter(Attendance.employee_id == employee_id)
    if status_filter:
        q = q.filter(Attendance.status == status_filter)
    items = q.order_by(Attendance.date.desc(), Attendance.id.desc()).all()
    emap = _emp_map(db, [a.employee_id for a in items])
    return [_to_out(a, emap.get(a.employee_id)) for a in items]


@router.post("", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
def create_attendance(payload: AttendanceCreate, db: Session = Depends(get_db)):
    emp = db.get(Employee, payload.employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan.")
    st = _validate_status(payload.status)

    dup = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == payload.employee_id,
            Attendance.date == payload.date,
        )
        .first()
    )
    if dup:
        raise HTTPException(
            status_code=409,
            detail=f"Catatan kehadiran {emp.nama} pada {payload.date} sudah ada.",
        )

    a = Attendance(
        employee_id=payload.employee_id,
        date=payload.date,
        status=st,
        check_in=(payload.check_in or None) if st in PRESENT_STATUSES else None,
        check_out=(payload.check_out or None) if st in PRESENT_STATUSES else None,
        note=payload.note or None,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _to_out(a, emp)


@router.patch("/{attendance_id}", response_model=AttendanceOut)
def update_attendance(
    attendance_id: int, payload: AttendanceUpdate, db: Session = Depends(get_db)
):
    a = db.get(Attendance, attendance_id)
    if not a:
        raise HTTPException(status_code=404, detail="Catatan tidak ditemukan.")
    data = payload.model_dump(exclude_unset=True)

    if "status" in data and data["status"] is not None:
        data["status"] = _validate_status(data["status"])

    # Cek bentrok unik bila tanggal diubah.
    new_date = data.get("date")
    if new_date is not None and new_date != a.date:
        dup = (
            db.query(Attendance)
            .filter(
                Attendance.employee_id == a.employee_id,
                Attendance.date == new_date,
                Attendance.id != a.id,
            )
            .first()
        )
        if dup:
            raise HTTPException(
                status_code=409,
                detail=f"Sudah ada catatan untuk karyawan ini pada {new_date}.",
            )

    for k, v in data.items():
        setattr(a, k, v)

    # Kalau status akhir bukan "masuk kerja", kosongkan jam.
    if a.status not in PRESENT_STATUSES:
        a.check_in = None
        a.check_out = None

    db.commit()
    db.refresh(a)
    return _to_out(a, db.get(Employee, a.employee_id))


@router.delete("/{attendance_id}", status_code=status.HTTP_200_OK)
def delete_attendance(attendance_id: int, db: Session = Depends(get_db)):
    a = db.get(Attendance, attendance_id)
    if not a:
        raise HTTPException(status_code=404, detail="Catatan tidak ditemukan.")
    db.delete(a)
    db.commit()
    return {"ok": True, "id": attendance_id}
