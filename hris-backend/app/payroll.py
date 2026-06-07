"""Modul Payroll / Slip Gaji (mandiri dalam satu file) - versi template manual.

Berisi:
- Tabel `payslips` (induk: satu slip per karyawan per periode) dan
  `payslip_items` (rincian komponen: pendapatan/potongan).
- Tabel `salary_template_items` (template komponen per karyawan, untuk
  mempercepat pembuatan slip baru).
- Router API: kelola template + CRUD slip + ringkasan per periode.

Tidak ada rumus pajak/BPJS otomatis di versi ini; semua nominal diisi
manual. Total pendapatan, total potongan, dan gaji bersih dihitung
otomatis dari komponen.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.database import Base, get_db
from app.models.employee import Employee


KINDS = {"earning", "deduction"}  # pendapatan / potongan
STATUSES = ["Draft", "Final"]


# ===================== Model =====================
class Payslip(Base):
    __tablename__ = "payslips"
    __table_args__ = (
        UniqueConstraint("employee_id", "period", name="uq_payslip_emp_period"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), index=True)
    period: Mapped[str] = mapped_column(String(7), index=True)  # "YYYY-MM"
    status: Mapped[str] = mapped_column(String(8), default="Draft")
    note: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class PayslipItem(Base):
    __tablename__ = "payslip_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    payslip_id: Mapped[int] = mapped_column(Integer, ForeignKey("payslips.id"), index=True)
    kind: Mapped[str] = mapped_column(String(10))  # earning / deduction
    label: Mapped[str] = mapped_column(String(64))
    amount: Mapped[float] = mapped_column(Float, default=0)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class SalaryTemplateItem(Base):
    __tablename__ = "salary_template_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), index=True)
    kind: Mapped[str] = mapped_column(String(10))
    label: Mapped[str] = mapped_column(String(64))
    amount: Mapped[float] = mapped_column(Float, default=0)
    sort: Mapped[int] = mapped_column(Integer, default=0)


# ===================== Skema =====================
class ItemIn(BaseModel):
    kind: str = Field(..., examples=["earning"])
    label: str = Field(..., max_length=64, examples=["Gaji Pokok"])
    amount: float = Field(default=0, examples=[5000000])


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    kind: str
    label: str
    amount: float


class PayslipCreate(BaseModel):
    employee_id: int
    period: str = Field(..., max_length=7, examples=["2026-06"])
    status: str = "Draft"
    note: str | None = None
    # Jika kosong / tidak dikirim, otomatis diisi dari template karyawan.
    items: list[ItemIn] | None = None


class PayslipUpdate(BaseModel):
    period: str | None = Field(default=None, max_length=7)
    status: str | None = None
    note: str | None = None
    items: list[ItemIn] | None = None  # bila dikirim, mengganti seluruh komponen


class PayslipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: int
    period: str
    status: str
    note: str | None = None
    items: list[ItemOut] = []
    total_earning: float = 0
    total_deduction: float = 0
    net: float = 0
    employee_nama: str = ""
    employee_department: str | None = None


class TemplateReplace(BaseModel):
    items: list[ItemIn] = []


class PayrollSummary(BaseModel):
    period: str
    count: int = 0
    total_earning: float = 0
    total_deduction: float = 0
    total_net: float = 0
    avg_net: float = 0


# ===================== Helper =====================
def _validate_kind(k: str) -> str:
    k = (k or "").strip().lower()
    if k not in KINDS:
        raise HTTPException(status_code=422, detail="Jenis komponen harus 'earning' atau 'deduction'.")
    return k


def _items_of(db: Session, payslip_id: int) -> list[PayslipItem]:
    return (
        db.query(PayslipItem)
        .filter(PayslipItem.payslip_id == payslip_id)
        .order_by(PayslipItem.sort, PayslipItem.id)
        .all()
    )


def _to_out(db: Session, p: Payslip, emp: Employee | None) -> PayslipOut:
    items = _items_of(db, p.id)
    earning = sum(i.amount for i in items if i.kind == "earning")
    deduction = sum(i.amount for i in items if i.kind == "deduction")
    o = PayslipOut.model_validate(p)
    o.items = [ItemOut.model_validate(i) for i in items]
    o.total_earning = earning
    o.total_deduction = deduction
    o.net = earning - deduction
    if emp is not None:
        o.employee_nama = emp.nama
        o.employee_department = emp.department
    return o


def _replace_items(db: Session, payslip_id: int, items: list[ItemIn]) -> None:
    db.query(PayslipItem).filter(PayslipItem.payslip_id == payslip_id).delete(synchronize_session=False)
    for idx, it in enumerate(items):
        db.add(PayslipItem(
            payslip_id=payslip_id,
            kind=_validate_kind(it.kind),
            label=it.label.strip() or "(tanpa nama)",
            amount=float(it.amount or 0),
            sort=idx,
        ))


# ===================== Router =====================
router = APIRouter(prefix="/payroll", tags=["payroll"])


# ---- Template per karyawan ----
@router.get("/template/{employee_id}", response_model=list[ItemOut])
def get_template(employee_id: int, db: Session = Depends(get_db)):
    if not db.get(Employee, employee_id):
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan.")
    rows = (
        db.query(SalaryTemplateItem)
        .filter(SalaryTemplateItem.employee_id == employee_id)
        .order_by(SalaryTemplateItem.sort, SalaryTemplateItem.id)
        .all()
    )
    return [ItemOut.model_validate(r) for r in rows]


@router.put("/template/{employee_id}", response_model=list[ItemOut])
def put_template(employee_id: int, payload: TemplateReplace, db: Session = Depends(get_db)):
    if not db.get(Employee, employee_id):
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan.")
    db.query(SalaryTemplateItem).filter(
        SalaryTemplateItem.employee_id == employee_id
    ).delete(synchronize_session=False)
    for idx, it in enumerate(payload.items):
        db.add(SalaryTemplateItem(
            employee_id=employee_id,
            kind=_validate_kind(it.kind),
            label=it.label.strip() or "(tanpa nama)",
            amount=float(it.amount or 0),
            sort=idx,
        ))
    db.commit()
    rows = (
        db.query(SalaryTemplateItem)
        .filter(SalaryTemplateItem.employee_id == employee_id)
        .order_by(SalaryTemplateItem.sort, SalaryTemplateItem.id)
        .all()
    )
    return [ItemOut.model_validate(r) for r in rows]


# ---- Periode & ringkasan ----
@router.get("/periods", response_model=list[str])
def list_periods(db: Session = Depends(get_db)):
    rows = db.query(Payslip.period).distinct().order_by(Payslip.period.desc()).all()
    return [r[0] for r in rows]


@router.get("/summary", response_model=PayrollSummary)
def summary(period: str | None = Query(default=None), db: Session = Depends(get_db)):
    q = db.query(Payslip)
    if period:
        q = q.filter(Payslip.period == period)
    slips = q.all()
    out = PayrollSummary(period=period or "")
    out.count = len(slips)
    for p in slips:
        items = _items_of(db, p.id)
        e = sum(i.amount for i in items if i.kind == "earning")
        d = sum(i.amount for i in items if i.kind == "deduction")
        out.total_earning += e
        out.total_deduction += d
        out.total_net += (e - d)
    out.avg_net = (out.total_net / out.count) if out.count else 0
    return out


# ---- Slip gaji ----
@router.get("/payslips", response_model=list[PayslipOut])
def list_payslips(
    period: str | None = Query(default=None),
    employee_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(Payslip)
    if period:
        q = q.filter(Payslip.period == period)
    if employee_id is not None:
        q = q.filter(Payslip.employee_id == employee_id)
    slips = q.order_by(Payslip.period.desc(), Payslip.id.desc()).all()
    emp_ids = {s.employee_id for s in slips}
    emap = {e.id: e for e in db.query(Employee).filter(Employee.id.in_(emp_ids)).all()} if emp_ids else {}
    return [_to_out(db, s, emap.get(s.employee_id)) for s in slips]


@router.post("/payslips", response_model=PayslipOut, status_code=status.HTTP_201_CREATED)
def create_payslip(payload: PayslipCreate, db: Session = Depends(get_db)):
    emp = db.get(Employee, payload.employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan.")
    if db.query(Payslip).filter(
        Payslip.employee_id == payload.employee_id, Payslip.period == payload.period
    ).first():
        raise HTTPException(
            status_code=409,
            detail=f"Slip gaji {emp.nama} periode {payload.period} sudah ada.",
        )

    p = Payslip(
        employee_id=payload.employee_id,
        period=payload.period.strip(),
        status=payload.status if payload.status in STATUSES else "Draft",
        note=(payload.note or None),
    )
    db.add(p)
    db.commit()
    db.refresh(p)

    # Komponen: pakai yang dikirim; jika kosong, ambil dari template karyawan.
    items = payload.items
    if not items:
        tpl = (
            db.query(SalaryTemplateItem)
            .filter(SalaryTemplateItem.employee_id == payload.employee_id)
            .order_by(SalaryTemplateItem.sort, SalaryTemplateItem.id)
            .all()
        )
        items = [ItemIn(kind=t.kind, label=t.label, amount=t.amount) for t in tpl]
    _replace_items(db, p.id, items)
    db.commit()
    return _to_out(db, p, emp)


@router.patch("/payslips/{payslip_id}", response_model=PayslipOut)
def update_payslip(payslip_id: int, payload: PayslipUpdate, db: Session = Depends(get_db)):
    p = db.get(Payslip, payslip_id)
    if not p:
        raise HTTPException(status_code=404, detail="Slip gaji tidak ditemukan.")
    data = payload.model_dump(exclude_unset=True)

    new_period = data.get("period")
    if new_period is not None and new_period != p.period:
        if db.query(Payslip).filter(
            Payslip.employee_id == p.employee_id,
            Payslip.period == new_period,
            Payslip.id != p.id,
        ).first():
            raise HTTPException(status_code=409, detail=f"Sudah ada slip periode {new_period} untuk karyawan ini.")
        p.period = new_period.strip()
    if "status" in data and data["status"] in STATUSES:
        p.status = data["status"]
    if "note" in data:
        p.note = data["note"] or None
    if payload.items is not None:
        _replace_items(db, p.id, payload.items)

    db.commit()
    db.refresh(p)
    return _to_out(db, p, db.get(Employee, p.employee_id))


@router.delete("/payslips/{payslip_id}", status_code=status.HTTP_200_OK)
def delete_payslip(payslip_id: int, db: Session = Depends(get_db)):
    p = db.get(Payslip, payslip_id)
    if not p:
        raise HTTPException(status_code=404, detail="Slip gaji tidak ditemukan.")
    db.query(PayslipItem).filter(PayslipItem.payslip_id == payslip_id).delete(synchronize_session=False)
    db.delete(p)
    db.commit()
    return {"ok": True, "id": payslip_id}
