"""Modul Dokumen Karyawan — upload, download, preview, hapus.

File disimpan di folder `uploads/documents/` (relatif terhadap root backend).
Tabel `documents` menyimpan metadata + path file.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.database import Base, get_db

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "documents")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

CATEGORIES = [
    "Identitas", "Pendidikan", "Kepegawaian",
    "Sertifikasi", "Kesehatan", "Lainnya",
]


# ===================== Model =====================
class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    sub_category: Mapped[str | None] = mapped_column(String(128), nullable=True)  # mis. KTP, Ijazah, Kontrak Kerja
    filename_stored: Mapped[str] = mapped_column(String(256), nullable=False)      # nama unik di disk
    filename_original: Mapped[str] = mapped_column(String(256), nullable=False)    # nama asli saat upload
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    mime_type: Mapped[str] = mapped_column(String(64), default="application/octet-stream")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ===================== Schema =====================
class DocOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: int
    category: str
    sub_category: str | None
    filename_original: str
    file_size: int
    mime_type: str
    uploaded_at: datetime


# ===================== Router =====================
router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("", response_model=list[DocOut])
def list_documents(employee_id: int = Query(...), db: Session = Depends(get_db)):
    return (
        db.query(Document)
        .filter(Document.employee_id == employee_id)
        .order_by(Document.category, Document.uploaded_at.desc())
        .all()
    )


@router.post("", response_model=DocOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    employee_id: int = Form(...),
    category: str = Form(...),
    sub_category: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Validasi ekstensi
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipe file tidak didukung ({ext}). Gunakan: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Validasi kategori
    if category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Kategori tidak valid. Pilih: {', '.join(CATEGORIES)}")

    # Baca isi file
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 10 MB.")

    # Simpan ke disk dengan nama unik
    stored_name = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, stored_name)
    with open(filepath, "wb") as f:
        f.write(content)

    # Simpan metadata ke database
    doc = Document(
        employee_id=employee_id,
        category=category,
        sub_category=sub_category.strip() if sub_category else None,
        filename_stored=stored_name,
        filename_original=file.filename or "unknown",
        file_size=len(content),
        mime_type=file.content_type or "application/octet-stream",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{doc_id}/download")
def download_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan.")
    filepath = os.path.join(UPLOAD_DIR, doc.filename_stored)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File tidak ditemukan di server.")
    return FileResponse(
        path=filepath,
        filename=doc.filename_original,
        media_type=doc.mime_type,
    )


@router.get("/{doc_id}/preview")
def preview_document(doc_id: int, db: Session = Depends(get_db)):
    """Serve file untuk preview (inline, bukan download)."""
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan.")
    filepath = os.path.join(UPLOAD_DIR, doc.filename_stored)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File tidak ditemukan di server.")
    return FileResponse(
        path=filepath,
        media_type=doc.mime_type,
        headers={"Content-Disposition": "inline"},
    )


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan.")
    # Hapus file dari disk
    filepath = os.path.join(UPLOAD_DIR, doc.filename_stored)
    if os.path.exists(filepath):
        os.remove(filepath)
    db.delete(doc)
    db.commit()
