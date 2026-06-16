from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.employee import Employee


class KpiAssessment(Base):
    """Satu penilaian KPI untuk satu karyawan pada satu periode (semester)."""

    __tablename__ = "kpi_assessments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"), index=True
    )
    period: Mapped[str] = mapped_column(String(32), index=True)  # mis. "2026 Semester 1"
    needs_coaching: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Workflow: draft -> hrd_review -> final_approved
    status: Mapped[str] = mapped_column(String(20), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    aspects: Mapped[list["KpiAspectScore"]] = relationship(
        back_populates="assessment",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    qual_scores: Mapped[list["KpiQualScore"]] = relationship(
        back_populates="assessment",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    employee: Mapped["Employee"] = relationship(lazy="joined")


class KpiAspectScore(Base):
    """Nilai satu aspek (mis. Disiplin) di dalam sebuah penilaian KPI."""

    __tablename__ = "kpi_aspect_scores"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("kpi_assessments.id", ondelete="CASCADE"), index=True
    )
    aspect: Mapped[str] = mapped_column(String(64))
    score: Mapped[float] = mapped_column(Float, default=0.0)
    target: Mapped[float] = mapped_column(Float, default=80.0)

    assessment: Mapped["KpiAssessment"] = relationship(back_populates="aspects")


class KpiQualScore(Base):
    """Nilai Kompetensi atau Perilaku Kerja (skala 1-5), dinilai Manager + HRD."""

    __tablename__ = "kpi_qual_scores"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("kpi_assessments.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[str] = mapped_column(String(16))  # "competency" | "behavior"
    parameter: Mapped[str] = mapped_column(String(64))
    manager_score: Mapped[float] = mapped_column(Float, default=0.0)  # skala 1-5
    hrd_score: Mapped[float] = mapped_column(Float, default=0.0)  # skala 1-5

    assessment: Mapped["KpiAssessment"] = relationship(back_populates="qual_scores")
