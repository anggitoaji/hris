from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

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
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)):
    if crud.get_employee_by_nik(db, payload.nik):
        raise HTTPException(status_code=409, detail="NIK sudah terpakai")
    return crud.create_employee(db, payload)


@router.patch("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int, payload: EmployeeUpdate, db: Session = Depends(get_db)
):
    employee = crud.get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan")

    # Cek bentrok NIK jika NIK diubah.
    if payload.nik and payload.nik != employee.nik:
        existing = crud.get_employee_by_nik(db, payload.nik)
        if existing and existing.id != employee.id:
            raise HTTPException(status_code=409, detail="NIK sudah terpakai")

    return crud.update_employee(db, employee, payload)


@router.delete("/{employee_id}", status_code=status.HTTP_200_OK)
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    employee = crud.get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan")
    crud.soft_delete_employee(db, employee)
    return {"detail": "Karyawan ditandai non-aktif", "id": employee_id}
