from datetime import date as DateType, datetime

from pydantic import BaseModel, ConfigDict, Field

WORKFLOW_STATUSES = ["draft", "supervisor_review", "manager_review", "hrd_review", "calibration", "final_approved"]


class AspectBase(BaseModel):
    aspect: str = Field(..., max_length=64)
    score: float = Field(default=0.0, ge=0, le=100)
    target: float = Field(default=80.0, ge=0, le=100)


class AspectOut(AspectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class QualScoreBase(BaseModel):
    category: str = Field(..., max_length=16)  # "competency" | "behavior"
    parameter: str = Field(..., max_length=64)
    manager_score: float = Field(default=0.0, ge=0, le=5)
    hrd_score: float = Field(default=0.0, ge=0, le=5)


class QualScoreOut(QualScoreBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    final: float = 0.0  # rata-rata manager+hrd, skala 1-5


class AssessmentCreate(BaseModel):
    employee_id: int
    period: str = Field(..., max_length=32)
    needs_coaching: bool = False
    notes: str | None = None
    aspects: list[AspectBase] = Field(default_factory=list)
    qual_scores: list[QualScoreBase] = Field(default_factory=list)


class AssessmentUpdate(BaseModel):
    period: str | None = Field(default=None, max_length=32)
    needs_coaching: bool | None = None
    notes: str | None = None
    # Jika 'aspects'/'qual_scores' dikirim, seluruh data lama diganti dengan yang baru.
    aspects: list[AspectBase] | None = None
    qual_scores: list[QualScoreBase] | None = None


class StatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(draft|supervisor_review|manager_review|hrd_review|calibration|final_approved)$")


class AssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    period: str
    needs_coaching: bool
    notes: str | None = None
    workflow_status: str = "draft"  # lihat WORKFLOW_STATUSES
    compliance_override: bool = False
    compliance_reason: str | None = None
    aspects: list[AspectOut] = Field(default_factory=list)
    qual_scores: list[QualScoreOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    # Field hasil hitungan (diisi di layer route).
    employee_nama: str | None = None
    employee_department: str | None = None
    employee_position: str | None = None
    overall_score: float = 0.0
    overall_target: float = 0.0
    delta: float = 0.0
    status: str = ""  # label kualitatif: Excellent/Good/Below/Poor (kompatibel lama)

    # Skor tertimbang sesuai struktur penilaian KPI (KPI Jabatan 70% + Kompetensi 20% + Perilaku 10%)
    kpi_jabatan_score: float = 0.0
    competency_score: float = 0.0
    behavior_score: float = 0.0
    final_score: float = 0.0
    grade: str = ""


class AssessmentListOut(BaseModel):
    total: int
    items: list[AssessmentOut]


class KpiPeriodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    period: str
    deadline: DateType | None
    closed: bool
    closed_at: datetime | None
    closed_by: str | None


class KpiPeriodSetDeadline(BaseModel):
    deadline: DateType | None = None


class ComplianceRow(BaseModel):
    atasan_id: int
    atasan_nama: str
    atasan_role_hint: str  # "Supervisor" | "Manager" (perkiraan dari jabatan/role)
    total_bawahan: int
    selesai: int
    compliance_pct: float
    compliant: bool
