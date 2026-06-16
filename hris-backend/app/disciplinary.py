"""Modul Disciplinary Action (Sanksi) & Discipline Point System.

Diisi oleh Manager dan/atau HRD (Super Admin selalu boleh). Riwayat bersifat
permanen — tidak ada endpoint hapus. Status "Aktif" otomatis berubah menjadi
"Expired" begitu melewati `masa_berlaku` (dihitung saat data dibaca/listing,
tanpa perlu job terjadwal terpisah).
"""

from __future__ import annotations

import os
import uuid
from datetime import date as DateType, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, UploadFile, File, Form, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.audit import log_audit, get_client_ip
from app.auth import get_current_user, require_roles, User
from app.core.database import Base, get_db

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "disciplinary")
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

JENIS_SANKSI = ["Teguran Lisan", "Teguran Tertulis", "SP1", "SP2", "SP3", "Skorsing", "PHK"]
# Kategori pelanggaran & poin baku (Discipline Point System).
KATEGORI_POINT: dict[str, int] = {
    "Terlambat Berulang": 5,
    "Pelanggaran SOP": 10,
    "Mangkir": 20,
    "Manipulasi Data": 25,
    "Pelanggaran Security": 30,
    "Lainnya": 0,
}
# Masa berlaku default untuk SP1/SP2/SP3 (bulan).
DEFAULT_MASA_BERLAKU_BULAN = {"SP1": 6, "SP2": 6, "SP3": 6}


# ===================== Model =====================
class DisciplinaryAction(Base):
    __tablename__ = "disciplinary_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)

    jenis_sanksi: Mapped[str] = mapped_column(String(32), nullable=False)
    kategori_pelanggaran: Mapped[str] = mapped_column(String(64), nullable=False)
    point: Mapped[int] = mapped_column(Integer, default=0)

    tanggal_pelanggaran: Mapped[DateType] = mapped_column(Date, nullable=False)
    tanggal_diberikan: Mapped[DateType] = mapped_column(Date, nullable=False)
    masa_berlaku: Mapped[DateType | None] = mapped_column(Date, nullable=True)

    deskripsi: Mapped[str] = mapped_column(Text, nullable=False)

    lampiran_stored: Mapped[str | None] = mapped_column(String(256), nullable=True)
    lampiran_original: Mapped[str | None] = mapped_column(String(256), nullable=True)
    lampiran_mime: Mapped[str | None] = mapped_column(String(64), nullable=True)

    catatan_manager: Mapped[str | None] = mapped_column(Text, nullable=True)
    catatan_hrd: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(16), default="Aktif", index=True)

    created_by_username: Mapped[str] = mapped_column(String(64), nullable=False)
    created_by_role: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ===================== Schema =====================
class SanksiOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: int
    jenis_sanksi: str
    kategori_pelanggaran: str
    point: int
    tanggal_pelanggaran: DateType
    tanggal_diberikan: DateType
    masa_berlaku: DateType | None
    deskripsi: str
    lampiran_original: str | None
    catatan_manager: str | None
    catatan_hrd: str | None
    status: str
    created_by_username: str
    created_by_role: str
    created_at: datetime


class SummaryOut(BaseModel):
    employee_id: int
    total_point: int
    status_label: str
    active_count: int
    active_items: list[dict]


router = APIRouter(prefix="/disciplinary", tags=["Disciplinary Action"])


def verify_token_param(token: str = Query(None), authorization: str = Header(None), db: Session = Depends(get_db)) -> User:
    """Izinkan akses via query param ?token= ATAU header Authorization (untuk link <a>/<img> langsung)."""
    from app.auth import verify_token
    t = token or (authorization.removeprefix("Bearer ").strip() if authorization else None)
    if not t:
        raise HTTPException(status_code=401, detail="Token tidak ada.")
    payload = verify_token(t)
    if not payload:
        raise HTTPException(status_code=401, detail="Token tidak valid atau kedaluwarsa.")
    user = db.get(User, int(payload["uid"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Akun tidak ditemukan.")
    return user


def _refresh_expired(db: Session, rows: list[DisciplinaryAction]) -> None:
    """Tandai otomatis jadi Expired bila masa_berlaku sudah lewat."""
    today = DateType.today()
    changed = False
    for r in rows:
        if r.status == "Aktif" and r.masa_berlaku and r.masa_berlaku < today:
            r.status = "Expired"
            changed = True
    if changed:
        db.commit()


def _discipline_status_label(total_point: int, last_violation: DateType | None) -> str:
    if last_violation is not None:
        years_since = (DateType.today() - last_violation).days / 365.25
        if years_since >= 3:
            return "CLEAR"
    if total_point <= 10:
        return "Hijau"
    if total_point <= 20:
        return "Kuning"
    if total_point <= 40:
        return "SP1"
    if total_point <= 60:
        return "SP2"
    return "SP3"


@router.get("", response_model=list[SanksiOut])
def list_sanksi(employee_id: int = Query(...), db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    rows = (
        db.query(DisciplinaryAction)
        .filter(DisciplinaryAction.employee_id == employee_id)
        .order_by(DisciplinaryAction.tanggal_diberikan.desc())
        .all()
    )
    _refresh_expired(db, rows)
    return rows


@router.get("/summary", response_model=SummaryOut)
def summary(employee_id: int = Query(...), db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    rows = (
        db.query(DisciplinaryAction)
        .filter(DisciplinaryAction.employee_id == employee_id)
        .order_by(DisciplinaryAction.tanggal_pelanggaran.desc())
        .all()
    )
    _refresh_expired(db, rows)
    valid = [r for r in rows if r.status != "Dicabut"]
    total_point = sum(r.point for r in valid)
    last_violation = valid[0].tanggal_pelanggaran if valid else None
    active = [r for r in rows if r.status == "Aktif"]
    return SummaryOut(
        employee_id=employee_id,
        total_point=total_point,
        status_label=_discipline_status_label(total_point, last_violation),
        active_count=len(active),
        active_items=[{"jenis_sanksi": r.jenis_sanksi, "tanggal_diberikan": str(r.tanggal_diberikan), "masa_berlaku": str(r.masa_berlaku) if r.masa_berlaku else None} for r in active],
    )


@router.post("", response_model=SanksiOut, status_code=status.HTTP_201_CREATED)
async def create_sanksi(
    request: Request,
    employee_id: int = Form(...),
    jenis_sanksi: str = Form(...),
    kategori_pelanggaran: str = Form(...),
    tanggal_pelanggaran: DateType = Form(...),
    tanggal_diberikan: DateType = Form(...),
    masa_berlaku: str | None = Form(None),
    deskripsi: str = Form(...),
    catatan_manager: str | None = Form(None),
    catatan_hrd: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("Manager", "HR")),
):
    if jenis_sanksi not in JENIS_SANKSI:
        raise HTTPException(status_code=400, detail=f"Jenis sanksi tidak valid. Pilih: {', '.join(JENIS_SANKSI)}")
    if kategori_pelanggaran not in KATEGORI_POINT:
        raise HTTPException(status_code=400, detail=f"Kategori pelanggaran tidak valid. Pilih: {', '.join(KATEGORI_POINT)}")

    masa_berlaku_date: DateType | None = None
    if masa_berlaku:
        masa_berlaku_date = DateType.fromisoformat(masa_berlaku)
    elif jenis_sanksi in DEFAULT_MASA_BERLAKU_BULAN:
        masa_berlaku_date = tanggal_diberikan + timedelta(days=30 * DEFAULT_MASA_BERLAKU_BULAN[jenis_sanksi])

    lampiran_stored = lampiran_original = lampiran_mime = None
    if file is not None and file.filename:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Tipe lampiran tidak didukung ({ext}). Gunakan: {', '.join(ALLOWED_EXTENSIONS)}")
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Ukuran lampiran maksimal 10 MB.")
        lampiran_stored = f"{uuid.uuid4().hex}{ext}"
        with open(os.path.join(UPLOAD_DIR, lampiran_stored), "wb") as f:
            f.write(content)
        lampiran_original = file.filename
        lampiran_mime = file.content_type or "application/octet-stream"

    rec = DisciplinaryAction(
        employee_id=employee_id,
        jenis_sanksi=jenis_sanksi,
        kategori_pelanggaran=kategori_pelanggaran,
        point=KATEGORI_POINT[kategori_pelanggaran],
        tanggal_pelanggaran=tanggal_pelanggaran,
        tanggal_diberikan=tanggal_diberikan,
        masa_berlaku=masa_berlaku_date,
        deskripsi=deskripsi,
        lampiran_stored=lampiran_stored,
        lampiran_original=lampiran_original,
        lampiran_mime=lampiran_mime,
        catatan_manager=catatan_manager,
        catatan_hrd=catatan_hrd if user.role in ("HR", "Super Admin") else None,
        status="Aktif",
        created_by_username=user.username,
        created_by_role=user.role,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    log_audit(
        db, user_id=user.id, username=user.username, action="CREATE", entity_type="disciplinary_action",
        entity_id=rec.id, employee_id=employee_id,
        description=f"Sanksi {jenis_sanksi} ({kategori_pelanggaran}) untuk employee #{employee_id}",
        new_data={"jenis_sanksi": jenis_sanksi, "kategori_pelanggaran": kategori_pelanggaran, "tanggal_pelanggaran": str(tanggal_pelanggaran)},
        ip_address=get_client_ip(request),
    )
    return rec


@router.patch("/{sanksi_id}/cabut", response_model=SanksiOut)
def cabut_sanksi(
    sanksi_id: int,
    request: Request,
    catatan_hrd: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR")),
):
    rec = db.get(DisciplinaryAction, sanksi_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Data sanksi tidak ditemukan.")
    if rec.status == "Dicabut":
        raise HTTPException(status_code=400, detail="Sanksi ini sudah dicabut sebelumnya.")
    rec.status = "Dicabut"
    rec.catatan_hrd = f"{rec.catatan_hrd + chr(10) if rec.catatan_hrd else ''}[Pencabutan] {catatan_hrd}"
    db.commit()
    db.refresh(rec)
    log_audit(
        db, user_id=user.id, username=user.username, action="UPDATE", entity_type="disciplinary_action",
        entity_id=rec.id, employee_id=rec.employee_id, description=f"Cabut sanksi {rec.jenis_sanksi}: {catatan_hrd}",
        ip_address=get_client_ip(request),
    )
    return rec


@router.get("/{sanksi_id}/lampiran")
def download_lampiran(sanksi_id: int, db: Session = Depends(get_db), _user: User = Depends(verify_token_param)):
    rec = db.get(DisciplinaryAction, sanksi_id)
    if not rec or not rec.lampiran_stored:
        raise HTTPException(status_code=404, detail="Lampiran tidak ditemukan.")
    filepath = os.path.join(UPLOAD_DIR, rec.lampiran_stored)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File tidak ditemukan di server.")
    from fastapi.responses import FileResponse
    return FileResponse(path=filepath, filename=rec.lampiran_original, media_type=rec.lampiran_mime)
