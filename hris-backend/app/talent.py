"""Modul Talent Management — review talenta per karyawan per periode.

Mengintegrasikan:
  - KPI Score (dari KpiAssessment final_approved)
  - Competency Score (dari KpiAssessment competency_score)
  - Discipline Score (dihitung dari total poin aktif DisciplinaryAction)
  - Leadership Score (input manual oleh HR/Direksi)

Output:
  - Talent Label: High Performer / Future Leader / Core Talent / Need Development / Under Performer
  - Succession Category: Ready Now / Ready <1yr / Ready 1-2yr / Not Ready
  - Promotion Eligible (KPI≥85, competency≥70, tenure≥1yr, no active SP3)
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.audit import log_audit, get_client_ip
from app.auth import get_current_user, require_roles, User
from app.core.database import Base, get_db


# ===================== Constants =====================

TALENT_LABELS = [
    "High Performer",
    "Future Leader",
    "Core Talent",
    "Need Development",
    "Under Performer",
]

SUCCESSION_CATEGORIES = [
    "Ready Now",
    "Ready <1 Tahun",
    "Ready 1-2 Tahun",
    "Not Ready",
]

# Discipline score: mulai 100, dikurangi poin aktif (referensi max = 60 → SP3)
DISCIPLINE_POINT_REF = 60.0


def compute_talent_label(kpi: float, competency: float, leadership: float | None) -> str:
    lead = leadership or 0.0
    if kpi >= 90 and competency >= 80:
        return "High Performer"
    if kpi >= 80 and competency >= 80 and lead >= 70:
        return "Future Leader"
    if kpi >= 75 and competency >= 70:
        return "Core Talent"
    if kpi >= 60:
        return "Need Development"
    return "Under Performer"


def compute_discipline_score(total_active_points: int) -> float:
    penalty = (total_active_points / DISCIPLINE_POINT_REF) * 100.0
    return max(0.0, 100.0 - penalty)


# ===================== Model =====================


class TalentReview(Base):
    __tablename__ = "talent_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    period: Mapped[str] = mapped_column(String(16), nullable=False, index=True)  # e.g. "2025-S1"

    kpi_score: Mapped[float] = mapped_column(Float, default=0.0)
    competency_score: Mapped[float] = mapped_column(Float, default=0.0)
    discipline_score: Mapped[float] = mapped_column(Float, default=100.0)
    leadership_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    final_label: Mapped[str] = mapped_column(String(32), default="Core Talent")
    succession_category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    promotion_eligible: Mapped[bool] = mapped_column(Boolean, default=False)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[str] = mapped_column(String(64), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


# ===================== Schemas =====================


class TalentReviewCreate(BaseModel):
    employee_id: int
    period: str
    kpi_score: float = 0.0
    competency_score: float = 0.0
    discipline_score: float = 100.0
    leadership_score: float | None = None
    succession_category: str | None = None
    notes: str | None = None


class TalentReviewUpdate(BaseModel):
    kpi_score: float | None = None
    competency_score: float | None = None
    discipline_score: float | None = None
    leadership_score: float | None = None
    succession_category: str | None = None
    promotion_eligible: bool | None = None
    notes: str | None = None


# ===================== Router =====================

router = APIRouter(prefix="/talent", tags=["Talent Management"])


def _to_out(tr: TalentReview, db: Session) -> dict[str, Any]:
    from sqlalchemy import text
    emp = db.execute(
        text("SELECT nama, department, position, join_date FROM employees WHERE id = :eid"),
        {"eid": tr.employee_id}
    ).fetchone()
    return {
        "id": tr.id,
        "employee_id": tr.employee_id,
        "employee_nama": emp[0] if emp else None,
        "employee_department": emp[1] if emp else None,
        "employee_position": emp[2] if emp else None,
        "employee_join_date": emp[3] if emp else None,
        "period": tr.period,
        "kpi_score": tr.kpi_score,
        "competency_score": tr.competency_score,
        "discipline_score": tr.discipline_score,
        "leadership_score": tr.leadership_score,
        "final_label": tr.final_label,
        "succession_category": tr.succession_category,
        "promotion_eligible": tr.promotion_eligible,
        "notes": tr.notes,
        "reviewed_by": tr.reviewed_by,
        "created_at": tr.created_at.isoformat() if tr.created_at else None,
        "updated_at": tr.updated_at.isoformat() if tr.updated_at else None,
    }


def _check_promotion(kpi: float, competency: float, join_date: str | None) -> bool:
    tenure_ok = False
    if join_date:
        try:
            jd = date.fromisoformat(str(join_date))
            tenure_ok = (date.today() - jd).days >= 365
        except Exception:
            pass
    return kpi >= 85.0 and competency >= 70.0 and tenure_ok


@router.get("/preview/{period}")
def preview_talent(
    period: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Hitung talent score secara on-the-fly dari data KPI + Disiplin yang ada.
    Tidak menyimpan — gunakan untuk pratinjau sebelum finalisasi.
    """
    from sqlalchemy import text

    # Ambil semua karyawan aktif
    emps = db.execute(text(
        "SELECT id, nama, department, position, join_date FROM employees WHERE is_active = 1"
    )).fetchall()

    # Ambil semua KPI final_approved untuk periode ini
    kpi_map: dict[int, tuple[float, float]] = {}
    kpi_rows = db.execute(text(
        "SELECT employee_id, final_score, competency_score FROM kpi_assessments "
        "WHERE period = :p AND workflow_status = 'final_approved'"
    ), {"p": period}).fetchall()
    for r in kpi_rows:
        kpi_map[r[0]] = (r[1] or 0.0, r[2] or 0.0)

    # Hitung total poin disiplin aktif per karyawan
    disc_rows = db.execute(text(
        "SELECT employee_id, SUM(point) FROM disciplinary_actions "
        "WHERE status = 'Aktif' GROUP BY employee_id"
    )).fetchall()
    disc_map: dict[int, int] = {r[0]: (r[1] or 0) for r in disc_rows}

    # Cek existing talent review untuk periode ini (jika sudah disimpan)
    existing_map: dict[int, dict] = {}
    existing_rows = db.execute(text(
        "SELECT employee_id, leadership_score, succession_category, notes "
        "FROM talent_reviews WHERE period = :p"
    ), {"p": period}).fetchall()
    for r in existing_rows:
        existing_map[r[0]] = {
            "leadership_score": r[1],
            "succession_category": r[2],
            "notes": r[3],
        }

    result = []
    for emp in emps:
        emp_id, nama, dept, pos_name, join_date = emp
        kpi_score, competency_score = kpi_map.get(emp_id, (0.0, 0.0))
        disc_pts = disc_map.get(emp_id, 0)
        discipline_score = compute_discipline_score(disc_pts)

        ex = existing_map.get(emp_id, {})
        leadership_score = ex.get("leadership_score")

        label = compute_talent_label(kpi_score, competency_score, leadership_score)
        promo = _check_promotion(kpi_score, competency_score, str(join_date) if join_date else None)

        result.append({
            "employee_id": emp_id,
            "employee_nama": nama,
            "employee_department": dept,
            "employee_position": pos_name,
            "employee_join_date": str(join_date) if join_date else None,
            "period": period,
            "kpi_score": round(kpi_score, 1),
            "competency_score": round(competency_score, 1),
            "discipline_score": round(discipline_score, 1),
            "discipline_points": disc_pts,
            "leadership_score": leadership_score,
            "final_label": label,
            "succession_category": ex.get("succession_category"),
            "promotion_eligible": promo,
            "notes": ex.get("notes"),
            "has_kpi": emp_id in kpi_map,
        })

    result.sort(key=lambda x: (-x["kpi_score"], x["employee_nama"] or ""))
    return result


@router.get("/{period}")
def list_talent_reviews(
    period: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    rows = db.query(TalentReview).filter(TalentReview.period == period).all()
    return [_to_out(r, db) for r in rows]


@router.post("/save/{period}", status_code=status.HTTP_200_OK)
def save_talent_reviews(
    period: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR")),
):
    """Finalisasi talent review: hitung + simpan semua karyawan aktif untuk periode ini."""
    from sqlalchemy import text

    emps = db.execute(text(
        "SELECT id, join_date FROM employees WHERE is_active = 1"
    )).fetchall()

    kpi_rows = db.execute(text(
        "SELECT employee_id, final_score, competency_score FROM kpi_assessments "
        "WHERE period = :p AND workflow_status = 'final_approved'"
    ), {"p": period}).fetchall()
    kpi_map: dict[int, tuple[float, float]] = {r[0]: (r[1] or 0.0, r[2] or 0.0) for r in kpi_rows}

    disc_rows = db.execute(text(
        "SELECT employee_id, SUM(point) FROM disciplinary_actions "
        "WHERE status = 'Aktif' GROUP BY employee_id"
    )).fetchall()
    disc_map: dict[int, int] = {r[0]: (r[1] or 0) for r in disc_rows}

    # Ambil leadership_score & succession dari yang sudah ada (jika pernah di-input manual)
    existing: dict[int, TalentReview] = {
        tr.employee_id: tr
        for tr in db.query(TalentReview).filter(TalentReview.period == period).all()
    }

    saved = 0
    for emp in emps:
        emp_id, join_date = emp
        kpi_score, competency_score = kpi_map.get(emp_id, (0.0, 0.0))
        disc_pts = disc_map.get(emp_id, 0)
        discipline_score = compute_discipline_score(disc_pts)
        leadership_score = existing.get(emp_id, None) and existing[emp_id].leadership_score
        succession = existing.get(emp_id, None) and existing[emp_id].succession_category
        notes = existing.get(emp_id, None) and existing[emp_id].notes

        label = compute_talent_label(kpi_score, competency_score, leadership_score)
        promo = _check_promotion(kpi_score, competency_score, str(join_date) if join_date else None)

        if emp_id in existing:
            tr = existing[emp_id]
            tr.kpi_score = kpi_score
            tr.competency_score = competency_score
            tr.discipline_score = discipline_score
            tr.final_label = label
            tr.promotion_eligible = promo
            tr.reviewed_by = user.username
        else:
            tr = TalentReview(
                employee_id=emp_id,
                period=period,
                kpi_score=kpi_score,
                competency_score=competency_score,
                discipline_score=discipline_score,
                leadership_score=None,
                final_label=label,
                succession_category=None,
                promotion_eligible=promo,
                notes=None,
                reviewed_by=user.username,
            )
            db.add(tr)
        saved += 1

    db.commit()
    log_audit(db, user.id, "talent_reviews", 0, "SAVE_PERIOD", None, {"period": period, "count": saved}, get_client_ip(request))
    return {"saved": saved, "period": period}


@router.patch("/{period}/{employee_id}")
def update_talent_review(
    period: str,
    employee_id: int,
    payload: TalentReviewUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR")),
):
    """Update leadership score / succession category / notes untuk satu karyawan."""
    tr = db.query(TalentReview).filter(
        TalentReview.period == period,
        TalentReview.employee_id == employee_id
    ).first()
    if not tr:
        raise HTTPException(status_code=404, detail="Talent review tidak ditemukan untuk karyawan & periode ini")
    before = _to_out(tr, db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(tr, k, v)
    # Hitung ulang label jika score berubah
    tr.final_label = compute_talent_label(tr.kpi_score, tr.competency_score, tr.leadership_score)
    tr.reviewed_by = user.username
    db.commit()
    db.refresh(tr)
    log_audit(db, user.id, "talent_reviews", tr.id, "UPDATE", before, _to_out(tr, db), get_client_ip(request))
    return _to_out(tr, db)
