import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user, User
from app.audit import log_audit, get_client_ip

from app.core.database import get_db
from app.crud import employee as crud
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeListOut,
    EmployeeOut,
    EmployeeUpdate,
)

router = APIRouter(prefix="/employees", tags=["Karyawan"])


@router.get("", response_model=EmployeeListOut)
def list_employees(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="Cari di nama / NIK / email"),
    department: str | None = Query(None, description="Filter divisi"),
    status: str | None = Query(None, description="Filter status (Aktif/Cuti/Probasi)"),
    include_inactive: bool = Query(False, description="Sertakan karyawan non-aktif"),
    db: Session = Depends(get_db),
):
    items, total = crud.list_employees(
        db,
        page=page,
        page_size=page_size,
        search=search,
        department=department,
        status=status,
        include_inactive=include_inactive,
    )
    return EmployeeListOut(total=total, page=page, page_size=page_size, items=items)


@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    employee = crud.get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan")
    return employee


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(payload: EmployeeCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if crud.get_employee_by_nik(db, payload.nik):
        raise HTTPException(status_code=409, detail="NIK sudah terpakai")
    emp = crud.create_employee(db, payload)
    log_audit(db, user_id=user.id, username=user.username, action="CREATE", entity_type="employee", entity_id=emp.id, employee_id=emp.id, description=f"Tambah karyawan: {emp.nama} ({emp.nik})", new_data=payload.model_dump(), ip_address=get_client_ip(request))
    return emp


@router.patch("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int, payload: EmployeeUpdate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    employee = crud.get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan")

    # Cek bentrok NIK jika NIK diubah.
    if payload.nik and payload.nik != employee.nik:
        existing = crud.get_employee_by_nik(db, payload.nik)
        if existing and existing.id != employee.id:
            raise HTTPException(status_code=409, detail="NIK sudah terpakai")

    changes = payload.model_dump(exclude_unset=True)
    old_vals = {k: getattr(employee, k, None) for k in changes}
    result = crud.update_employee(db, employee, payload)
    log_audit(db, user_id=user.id, username=user.username, action="UPDATE", entity_type="employee", entity_id=employee_id, employee_id=employee_id, description=f"Ubah data: {employee.nama}", old_data=old_vals, new_data=changes, ip_address=get_client_ip(request))
    return result


@router.delete("/{employee_id}", status_code=status.HTTP_200_OK)
def delete_employee(employee_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    employee = crud.get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan")
    log_audit(db, user_id=user.id, username=user.username, action="DELETE", entity_type="employee", entity_id=employee_id, employee_id=employee_id, description=f"Nonaktifkan: {employee.nama} ({employee.nik})", old_data={"nama": employee.nama, "nik": employee.nik, "status": employee.status}, ip_address=get_client_ip(request))
    crud.soft_delete_employee(db, employee)
    return {"detail": "Karyawan ditandai non-aktif", "id": employee_id}


# ===================== Foto Profil =====================
PHOTO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "photos")
os.makedirs(PHOTO_DIR, exist_ok=True)
PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp"}


@router.post("/{employee_id}/photo", response_model=EmployeeOut)
async def upload_photo(
    employee_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    request: Request = None,
):
    employee = crud.get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in PHOTO_EXT:
        raise HTTPException(status_code=400, detail=f"Format foto tidak didukung. Gunakan: {', '.join(PHOTO_EXT)}")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran foto maksimal 5 MB.")

    # Hapus foto lama jika ada
    if employee.photo_url:
        old_path = os.path.join(PHOTO_DIR, employee.photo_url)
        if os.path.exists(old_path):
            os.remove(old_path)

    stored_name = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(PHOTO_DIR, stored_name), "wb") as f:
        f.write(content)

    employee.photo_url = stored_name
    db.commit()
    db.refresh(employee)

    log_audit(db, user_id=user.id, username=user.username, action="UPDATE",
              entity_type="employee", entity_id=employee_id, employee_id=employee_id,
              description=f"Upload foto profil: {employee.nama}",
              ip_address=get_client_ip(request) if request else None)

    return employee


@router.get("/{employee_id}/photo")
def get_photo(employee_id: int, token: str = Query(None), db: Session = Depends(get_db)):
    """Serve foto profil (token via query param untuk <img src>)."""
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
    return FileResponse(path=filepath, media_type="image/jpeg")
