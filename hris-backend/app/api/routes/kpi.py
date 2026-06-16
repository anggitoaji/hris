from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import employee as emp_crud
from app.crud import kpi as crud
from app.models.kpi import KpiAssessment
from app.schemas.kpi import (
    AspectOut,
    AssessmentCreate,
    AssessmentListOut,
    AssessmentOut,
    AssessmentUpdate,
    QualScoreOut,
    StatusUpdate,
)

router = APIRouter(prefix="/kpi", tags=["KPI & Performa"])

# Bobot sesuai struktur penilaian KPI (lihat aturan modul KPI):
# A. KPI Jabatan 70% | B. Kompetensi 20% | C. Perilaku Kerja 10%
W_JABATAN = 0.70
W_COMPETENCY = 0.20
W_BEHAVIOR = 0.10


def _status_label(overall: float) -> str:
    if overall >= 90:
        return "Excellent"
    if overall >= 75:
        return "Good"
    if overall >= 60:
        return "Below"
    return "Poor"


def _grade(final_score: float) -> str:
    if final_score >= 95:
        return "A+"
    if final_score >= 90:
        return "A"
    if final_score >= 85:
        return "B+"
    if final_score >= 80:
        return "B"
    if final_score >= 75:
        return "C+"
    if final_score >= 70:
        return "C"
    return "D"


def _qual_pct(qual_scores: list, category: str) -> float:
    """Rata-rata (manager+hrd)/2 dinormalisasi dari skala 1-5 ke persen 0-100."""
    items = [q for q in qual_scores if q.category == category]
    if not items:
        return 0.0
    avgs = [(q.manager_score + q.hrd_score) / 2 for q in items]
    return round((sum(avgs) / len(avgs)) / 5 * 100, 1)


def _to_out(a: KpiAssessment) -> AssessmentOut:
    scores = [x.score for x in a.aspects]
    targets = [x.target for x in a.aspects]
    overall = round(sum(scores) / len(scores), 1) if scores else 0.0
    overall_target = round(sum(targets) / len(targets), 1) if targets else 0.0
    emp = a.employee

    kpi_jabatan_score = min(overall, 100.0)
    competency_score = _qual_pct(a.qual_scores, "competency")
    behavior_score = _qual_pct(a.qual_scores, "behavior")
    final_score = round(
        kpi_jabatan_score * W_JABATAN
        + competency_score * W_COMPETENCY
        + behavior_score * W_BEHAVIOR,
        1,
    )
    # Hard rule: jika status final_approved tapi belum ada data kompetensi/perilaku,
    # final_score tetap dihitung dari data yang tersedia (tidak dipaksa 0 di level ini;
    # aturan People Management Compliance ditegakkan terpisah di modul People Management).

    return AssessmentOut(
        id=a.id,
        employee_id=a.employee_id,
        period=a.period,
        needs_coaching=a.needs_coaching,
        notes=a.notes,
        workflow_status=a.status,
        aspects=[AspectOut.model_validate(x) for x in a.aspects],
        qual_scores=[
            QualScoreOut(
                id=q.id,
                category=q.category,
                parameter=q.parameter,
                manager_score=q.manager_score,
                hrd_score=q.hrd_score,
                final=round((q.manager_score + q.hrd_score) / 2, 2),
            )
            for q in a.qual_scores
        ],
        created_at=a.created_at,
        updated_at=a.updated_at,
        employee_nama=emp.nama if emp else None,
        employee_department=emp.department if emp else None,
        employee_position=emp.position if emp else None,
        overall_score=overall,
        overall_target=overall_target,
        delta=round(overall - overall_target, 1),
        status=_status_label(overall),
        kpi_jabatan_score=kpi_jabatan_score,
        competency_score=competency_score,
        behavior_score=behavior_score,
        final_score=final_score,
        grade=_grade(final_score),
    )


@router.get("/periods", response_model=list[str])
def get_periods(db: Session = Depends(get_db)):
    return crud.list_periods(db)


@router.get("/assessments", response_model=AssessmentListOut)
def list_assessments(
    period: str | None = Query(None),
    department: str | None = Query(None),
    employee_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    items = crud.list_assessments(
        db, period=period, department=department, employee_id=employee_id
    )
    out = [_to_out(a) for a in items]
    return AssessmentListOut(total=len(out), items=out)


@router.get("/assessments/{assessment_id}", response_model=AssessmentOut)
def get_assessment(assessment_id: int, db: Session = Depends(get_db)):
    a = crud.get_assessment(db, assessment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Penilaian tidak ditemukan")
    return _to_out(a)


@router.post(
    "/assessments", response_model=AssessmentOut, status_code=status.HTTP_201_CREATED
)
def create_assessment(payload: AssessmentCreate, db: Session = Depends(get_db)):
    if not emp_crud.get_employee(db, payload.employee_id):
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan")
    a = crud.create_assessment(db, payload)
    return _to_out(a)


@router.patch("/assessments/{assessment_id}", response_model=AssessmentOut)
def update_assessment(
    assessment_id: int, payload: AssessmentUpdate, db: Session = Depends(get_db)
):
    a = crud.get_assessment(db, assessment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Penilaian tidak ditemukan")
    a = crud.update_assessment(db, a, payload)
    return _to_out(a)


@router.patch("/assessments/{assessment_id}/status", response_model=AssessmentOut)
def update_status(
    assessment_id: int, payload: StatusUpdate, db: Session = Depends(get_db)
):
    a = crud.get_assessment(db, assessment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Penilaian tidak ditemukan")
    a = crud.set_workflow_status(db, a, payload.status)
    return _to_out(a)


@router.delete("/assessments/{assessment_id}", status_code=status.HTTP_200_OK)
def delete_assessment(assessment_id: int, db: Session = Depends(get_db)):
    a = crud.get_assessment(db, assessment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Penilaian tidak ditemukan")
    crud.delete_assessment(db, a)
    return {"detail": "Penilaian dihapus", "id": assessment_id}


@router.get("/summary")
def summary(period: str | None = Query(None), db: Session = Depends(get_db)):
    outs = [_to_out(a) for a in crud.list_assessments(db, period=period)]

    by_div: dict[str, list[float]] = {}
    for o in outs:
        by_div.setdefault(o.employee_department or "-", []).append(o.overall_score)
    by_division = [
        {"department": d, "avg": round(sum(v) / len(v), 1), "count": len(v)}
        for d, v in by_div.items()
    ]

    top = sorted(outs, key=lambda o: o.overall_score, reverse=True)[:3]
    top_performers = [
        {
            "nama": o.employee_nama,
            "department": o.employee_department,
            "score": o.overall_score,
        }
        for o in top
    ]
    return {
        "count": len(outs),
        "by_division": by_division,
        "top_performers": top_performers,
    }
