from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.schemas.employee import EmployeeCreate, EmployeeUpdate


def get_employee(db: Session, employee_id: int) -> Employee | None:
    return db.get(Employee, employee_id)


def get_employee_by_nik(db: Session, nik: str) -> Employee | None:
    return db.scalar(select(Employee).where(Employee.nik == nik))


def list_employees(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    department: str | None = None,
    status: str | None = None,
    include_inactive: bool = False,
) -> tuple[list[Employee], int]:
    """Ambil daftar karyawan dengan filter + pagination.

    Mengembalikan (items, total).
    """
    stmt = select(Employee)
    count_stmt = select(func.count()).select_from(Employee)

    conditions = []
    if not include_inactive:
        conditions.append(Employee.is_active.is_(True))
    if search:
        like = f"%{search}%"
        conditions.append(
            or_(
                Employee.nama.ilike(like),
                Employee.nik.ilike(like),
                Employee.email.ilike(like),
            )
        )
    if department:
        conditions.append(Employee.department == department)
    if status:
        conditions.append(Employee.status == status)

    for cond in conditions:
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    total = db.scalar(count_stmt) or 0

    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    offset = (page - 1) * page_size

    stmt = stmt.order_by(Employee.nama).offset(offset).limit(page_size)
    items = list(db.scalars(stmt).all())
    return items, total


def create_employee(db: Session, payload: EmployeeCreate) -> Employee:
    data = payload.model_dump()
    # Konversi enum -> nilai string sebelum disimpan.
    for key in ("status", "contract_type", "ai_risk"):
        if data.get(key) is not None and hasattr(data[key], "value"):
            data[key] = data[key].value
    employee = Employee(**data)
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


def update_employee(
    db: Session, employee: Employee, payload: EmployeeUpdate
) -> Employee:
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        if hasattr(value, "value"):  # enum
            value = value.value
        setattr(employee, key, value)
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


def soft_delete_employee(db: Session, employee: Employee) -> Employee:
    """Tandai karyawan non-aktif (tidak menghapus data permanen)."""
    employee.is_active = False
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee
