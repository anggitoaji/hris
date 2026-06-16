from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.employee import Employee
from app.models.kpi import KpiAspectScore, KpiAssessment, KpiQualScore
from app.schemas.kpi import AssessmentCreate, AssessmentUpdate


def list_assessments(
    db: Session,
    *,
    period: str | None = None,
    department: str | None = None,
    employee_id: int | None = None,
) -> list[KpiAssessment]:
    stmt = select(KpiAssessment).options(joinedload(KpiAssessment.employee))
    if period:
        stmt = stmt.where(KpiAssessment.period == period)
    if employee_id:
        stmt = stmt.where(KpiAssessment.employee_id == employee_id)
    if department:
        stmt = stmt.join(Employee).where(Employee.department == department)
    stmt = stmt.order_by(KpiAssessment.id)
    return list(db.scalars(stmt).unique().all())


def get_assessment(db: Session, assessment_id: int) -> KpiAssessment | None:
    return db.get(KpiAssessment, assessment_id)


def list_periods(db: Session) -> list[str]:
    stmt = select(KpiAssessment.period).distinct().order_by(KpiAssessment.period)
    return [p for p in db.scalars(stmt).all()]


def create_assessment(db: Session, payload: AssessmentCreate) -> KpiAssessment:
    assessment = KpiAssessment(
        employee_id=payload.employee_id,
        period=payload.period,
        needs_coaching=payload.needs_coaching,
        notes=payload.notes,
    )
    for asp in payload.aspects:
        assessment.aspects.append(
            KpiAspectScore(aspect=asp.aspect, score=asp.score, target=asp.target)
        )
    for q in payload.qual_scores:
        assessment.qual_scores.append(
            KpiQualScore(
                category=q.category,
                parameter=q.parameter,
                manager_score=q.manager_score,
                hrd_score=q.hrd_score,
            )
        )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


def update_assessment(
    db: Session, assessment: KpiAssessment, payload: AssessmentUpdate
) -> KpiAssessment:
    data = payload.model_dump(exclude_unset=True)
    new_aspects = data.pop("aspects", None)
    new_qual_scores = data.pop("qual_scores", None)
    for key, value in data.items():
        setattr(assessment, key, value)
    if new_aspects is not None:
        assessment.aspects.clear()  # delete-orphan menghapus aspek lama
        for asp in new_aspects:
            assessment.aspects.append(
                KpiAspectScore(
                    aspect=asp["aspect"],
                    score=asp.get("score", 0.0),
                    target=asp.get("target", 80.0),
                )
            )
    if new_qual_scores is not None:
        assessment.qual_scores.clear()
        for q in new_qual_scores:
            assessment.qual_scores.append(
                KpiQualScore(
                    category=q["category"],
                    parameter=q["parameter"],
                    manager_score=q.get("manager_score", 0.0),
                    hrd_score=q.get("hrd_score", 0.0),
                )
            )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


def set_workflow_status(db: Session, assessment: KpiAssessment, status: str) -> KpiAssessment:
    assessment.status = status
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


def delete_assessment(db: Session, assessment: KpiAssessment) -> None:
    db.delete(assessment)
    db.commit()
