"""Modul Master Divisi (mandiri dalam satu file).

Berisi: model tabel `divisions`, skema Pydantic, dan router API
(lihat/tambah/ubah/hapus). Tabel dibuat otomatis oleh create_all saat
startup, dan terisi otomatis (sekali) dari divisi yang sudah ada di data
karyawan ketika endpoint daftar pertama kali dipanggil.

Catatan desain: kolom `department` pada tabel karyawan tetap berupa teks
(nama divisi). Master divisi ini jadi sumber pilihan dropdown + tempat
mengelola daftar divisi. Saat nama divisi diubah di sini, nama divisi pada
karyawan terkait ikut diperbarui agar tetap konsisten.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.database import Base, get_db
from app.models.employee import Employee


# ===================== Model =====================
class Division(Base):
    __tablename__ = "divisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(256), nullable=True)
    head: Mapped[str | None] = mapped_column(String(128), nullable=True)  # kepala/PIC divisi
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ===================== Skema =====================
class DivisionBase(BaseModel):
    name: str = Field(..., max_length=64, examples=["Engineering"])
    description: str | None = Field(default=None, max_length=256)
    head: str | None = Field(default=None, max_length=128)
    is_active: bool = True


class DivisionCreate(DivisionBase):
    pass


class DivisionUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=64)
    description: str | None = Field(default=None, max_length=256)
    head: str | None = Field(default=None, max_length=128)
    is_active: bool | None = None


class DivisionOut(DivisionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_count: int = 0


# ===================== Helper =====================
def _seed_if_empty(db: Session) -> None:
    """Isi master divisi dari divisi unik pada data karyawan (sekali saja)."""
    if db.query(Division).count() > 0:
        return
    rows = db.query(Employee.department).filter(Employee.department.isnot(None)).distinct().all()
    names = sorted({(r[0] or "").strip() for r in rows if (r[0] or "").strip()})
    for n in names:
        db.add(Division(name=n))
    if names:
        db.commit()


def _count_for(db: Session, name: str) -> int:
    return (
        db.query(Employee)
        .filter(Employee.department == name, Employee.is_active.is_(True))
        .count()
    )


def _to_out(db: Session, d: Division) -> DivisionOut:
    o = DivisionOut.model_validate(d)
    o.employee_count = _count_for(db, d.name)
    return o


# ===================== Router =====================
router = APIRouter(prefix="/divisions", tags=["divisions"])


@router.get("", response_model=list[DivisionOut])
def list_divisions(db: Session = Depends(get_db)):
    _seed_if_empty(db)
    items = db.query(Division).order_by(Division.name).all()
    return [_to_out(db, d) for d in items]


@router.post("", response_model=DivisionOut, status_code=status.HTTP_201_CREATED)
def create_division(payload: DivisionCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Nama divisi wajib diisi.")
    if db.query(Division).filter(Division.name == name).first():
        raise HTTPException(status_code=409, detail=f"Divisi '{name}' sudah ada.")
    d = Division(name=name, description=payload.description, head=payload.head, is_active=payload.is_active)
    db.add(d)
    db.commit()
    db.refresh(d)
    return _to_out(db, d)


@router.patch("/{division_id}", response_model=DivisionOut)
def update_division(division_id: int, payload: DivisionUpdate, db: Session = Depends(get_db)):
    d = db.get(Division, division_id)
    if not d:
        raise HTTPException(status_code=404, detail="Divisi tidak ditemukan.")
    data = payload.model_dump(exclude_unset=True)
    old_name = d.name
    new_name = data.get("name")
    if new_name is not None:
        new_name = new_name.strip()
        if not new_name:
            raise HTTPException(status_code=422, detail="Nama divisi tidak boleh kosong.")
        exists = db.query(Division).filter(Division.name == new_name, Division.id != division_id).first()
        if exists:
            raise HTTPException(status_code=409, detail=f"Divisi '{new_name}' sudah ada.")
        data["name"] = new_name

    for k, v in data.items():
        setattr(d, k, v)

    # Jaga konsistensi: kalau nama divisi berubah, perbarui di data karyawan.
    if new_name and new_name != old_name:
        db.query(Employee).filter(Employee.department == old_name).update(
            {Employee.department: new_name}, synchronize_session=False
        )

    db.commit()
    db.refresh(d)
    return _to_out(db, d)


@router.delete("/{division_id}", status_code=status.HTTP_200_OK)
def delete_division(division_id: int, db: Session = Depends(get_db)):
    d = db.get(Division, division_id)
    if not d:
        raise HTTPException(status_code=404, detail="Divisi tidak ditemukan.")
    cnt = _count_for(db, d.name)
    if cnt > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Tidak bisa dihapus: masih ada {cnt} karyawan di divisi '{d.name}'.",
        )
    db.delete(d)
    db.commit()
    return {"ok": True, "id": division_id}
