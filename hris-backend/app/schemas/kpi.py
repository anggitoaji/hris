from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AspectBase(BaseModel):
    aspect: str = Field(..., max_length=64)
    score: float = Field(default=0.0, ge=0, le=100)
    target: float = Field(default=80.0, ge=0, le=100)


class AspectOut(AspectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class AssessmentCreate(BaseModel):
    employee_id: int
    period: str = Field(..., max_length=32)
    needs_coaching: bool = False
    notes: str | None = None
    aspects: list[AspectBase] = Field(default_factory=list)


class AssessmentUpdate(BaseModel):
    period: str | None = Field(default=None, max_length=32)
    needs_coaching: bool | None = None
    notes: str | None = None
    # Jika 'aspects' dikirim, seluruh aspek lama diganti dengan yang baru.
    aspects: list[AspectBase] | None = None


class AssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    period: str
    needs_coaching: bool
    notes: str | None = None
    aspects: list[AspectOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    # Field hasil hitungan (diisi di layer route).
    employee_nama: str | None = None
    employee_department: str | None = None
    employee_position: str | None = None
    overall_score: float = 0.0
    overall_target: float = 0.0
    delta: float = 0.0
    status: str = ""


class AssessmentListOut(BaseModel):
    total: int
    items: list[AssessmentOut]
