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
)

router = APIRouter(prefix="/kpi", tags=["KPI & Performa"])


def _status_label(overall: float) -> str:
    if overall >= 90:
        return "Excellent"
    if overall >= 75:
        return "Good"
    if overall >= 60:
        return "Below"
    return "Poor"


def _to_out(a: KpiAssessment) -> AssessmentOut:
    scores = [x.score for x in a.aspects]
    targets = [x.target for x in a.aspects]
    overall = round(sum(scores) / len(scores), 1) if scores else 0.0
    overall_target = round(sum(targets) / len(targets), 1) if targets else 0.0
    emp = a.employee
    return AssessmentOut(
        id=a.id,
        employee_id=a.employee_id,
        period=a.period,
        needs_coaching=a.needs_coaching,
        notes=a.notes,
        aspects=[AspectOut.model_validate(x) for x in a.aspects],
        created_at=a.created_at,
        updated_at=a.updated_at,
        employee_nama=emp.nama if emp else None,
        employee_department=emp.department if emp else None,
        employee_position=emp.position if emp else None,
        overall_score=overall,
        overall_target=overall_target,
        delta=round(overall - overall_target, 1),
        status=_status_label(overall),
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
