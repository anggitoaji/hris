"""Endpoint serve foto profil karyawan (auth via token query param)."""

import os

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import employee as crud

PHOTO_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "photos")

router = APIRouter(prefix="/photos", tags=["Karyawan"])


@router.get("/{employee_id}")
def get_photo(employee_id: int, token: str = Query(None), db: Session = Depends(get_db)):
    """Serve foto profil. Auth via ?token= untuk <img src>."""
    from app.auth import verify_token
    if token:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Token tidak valid.")
    employee = crud.get_employee(db, employee_id)
    if not employee or not employee.photo_url:
        raise HTTPException(status_code=404, detail="Foto tidak ditemukan.")
    filepath = os.path.join(PHOTO_DIR, employee.photo_url)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File foto tidak ditemukan.")
    ext = os.path.splitext(employee.photo_url)[1].lower()
    media = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext.lstrip("."), "image/jpeg")
    return FileResponse(path=filepath, media_type=media, headers={"Cache-Control": "max-age=3600"})
