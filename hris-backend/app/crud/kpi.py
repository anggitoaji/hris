from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.employee import Employee
from app.models.kpi import KpiAspectScore, KpiAssessment, KpiPeriod, KpiQualScore
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


def get_or_create_period(db: Session, period: str) -> KpiPeriod:
    row = db.scalar(select(KpiPeriod).where(KpiPeriod.period == period))
    if row:
        return row
    row = KpiPeriod(period=period)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_kpi_periods_meta(db: Session) -> list[KpiPeriod]:
    return list(db.scalars(select(KpiPeriod).order_by(KpiPeriod.period)).all())


def direct_reports(db: Session, atasan_employee_id: int) -> list[Employee]:
    stmt = select(Employee).where(
        Employee.supervisor_id == atasan_employee_id, Employee.is_active == True  # noqa: E712
    )
    return list(db.scalars(stmt).all())


def compliance_for_period(db: Session, period: str) -> list[dict]:
    """Hitung kepatuhan People Management: tiap atasan (punya >=1 bawahan langsung)
    wajib menyelesaikan penilaian KPI seluruh bawahannya pada periode tertentu."""
    all_atasan_ids = set(
        db.scalars(select(Employee.supervisor_id).where(Employee.supervisor_id.isnot(None))).all()
    )
    rows = []
    for atasan_id in all_atasan_ids:
        atasan = db.get(Employee, atasan_id)
        if not atasan:
            continue
        reports = direct_reports(db, atasan_id)
        if not reports:
            continue
        report_ids = {r.id for r in reports}
        done_ids = set(
            db.scalars(
                select(KpiAssessment.employee_id).where(
                    KpiAssessment.period == period,
                    KpiAssessment.employee_id.in_(report_ids),
                    KpiAssessment.status != "draft",
                )
            ).all()
        )
        selesai = len(done_ids)
        total = len(report_ids)
        pct = round(selesai / total * 100, 1) if total else 100.0
        pos = (atasan.position or "").lower()
        role_hint = "Manager" if ("manager" in pos or "direktur" in pos) else "Supervisor"
        rows.append({
            "atasan_id": atasan.id,
            "atasan_nama": atasan.nama,
            "atasan_role_hint": role_hint,
            "total_bawahan": total,
            "selesai": selesai,
            "compliance_pct": pct,
            "compliant": selesai == total,
        })
    return sorted(rows, key=lambda r: r["compliance_pct"])


def close_period(db: Session, period: str, closed_by: str) -> dict:
    """Tutup periode: atasan yang belum 100% menilai bawahannya -> FINAL KPI-nya dipaksa 0."""
    compliance = compliance_for_period(db, period)
    affected = []
    for row in compliance:
        if row["compliant"]:
            continue
        atasan_assessment = db.scalar(
            select(KpiAssessment).where(
                KpiAssessment.employee_id == row["atasan_id"],
                KpiAssessment.period == period,
            )
        )
        if atasan_assessment:
            atasan_assessment.compliance_override = True
            atasan_assessment.compliance_reason = (
                f"People Management Compliance: hanya menyelesaikan {row['selesai']}/{row['total_bawahan']} "
                f"penilaian bawahan pada periode {period}. FINAL KPI otomatis 0 sesuai kebijakan wajib."
            )
            db.add(atasan_assessment)
            affected.append(row["atasan_nama"])

    period_row = get_or_create_period(db, period)
    period_row.closed = True
    period_row.closed_at = datetime.utcnow()
    period_row.closed_by = closed_by
    db.add(period_row)
    db.commit()
    return {"period": period, "non_compliant_count": len(affected), "non_compliant_names": affected}
