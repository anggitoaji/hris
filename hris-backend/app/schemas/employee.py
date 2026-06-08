from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class EmployeeStatus(str, Enum):
    aktif = "Aktif"
    cuti = "Cuti"
    probasi = "Probasi"


class ContractType(str, Enum):
    tetap = "Tetap"
    kontrak = "Kontrak"
    probasi = "Probasi"


class AIRisk(str, Enum):
    low = "Low"
    medium = "Medium"
    high = "High"


class EmployeeBase(BaseModel):
    nik: str = Field(..., max_length=32, examples=["EMP-001"])
    nama: str = Field(..., max_length=128, examples=["Budi Santoso"])
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=32)
    department: str = Field(..., max_length=64, examples=["Engineering"])
    position: str = Field(..., max_length=64, examples=["Backend Developer"])
    status: EmployeeStatus = EmployeeStatus.aktif
    contract_type: ContractType = ContractType.kontrak
    join_date: date | None = None
    kpi_score: float = Field(default=0.0, ge=0, le=100)
    ai_risk: AIRisk = AIRisk.low
    photo_url: str | None = Field(default=None, max_length=256)

    # ===== Biodata lengkap (opsional) =====
    ktp: str | None = Field(default=None, max_length=32, examples=["3175xxxxxxxxxxxx"])
    gender: str | None = Field(default=None, max_length=16, examples=["Laki-laki"])
    birth_place: str | None = Field(default=None, max_length=64, examples=["Bandung"])
    birth_date: date | None = None
    religion: str | None = Field(default=None, max_length=32, examples=["Islam"])
    marital_status: str | None = Field(default=None, max_length=32, examples=["Menikah"])
    address: str | None = Field(default=None, max_length=512)
    education: str | None = Field(default=None, max_length=64, examples=["S1 Teknik Informatika"])
    npwp: str | None = Field(default=None, max_length=32)
    bank_name: str | None = Field(default=None, max_length=64, examples=["BCA"])
    bank_account: str | None = Field(default=None, max_length=64)
    bpjs_kesehatan: str | None = Field(default=None, max_length=32)
    bpjs_ketenagakerjaan: str | None = Field(default=None, max_length=32)
    emergency_name: str | None = Field(default=None, max_length=128)
    emergency_phone: str | None = Field(default=None, max_length=32)
    emergency_relation: str | None = Field(default=None, max_length=64, examples=["Istri"])
    skills: str | None = Field(default=None, max_length=512, examples=["Mikrotik, Linux, Networking"])
    job_desc: str | None = Field(default=None, max_length=2000)
    catatan: str | None = Field(default=None, max_length=1000)


class EmployeeCreate(EmployeeBase):
    """Payload untuk membuat karyawan baru."""

    pass


class EmployeeUpdate(BaseModel):
    """Payload untuk update parsial — semua field opsional."""

    nik: str | None = Field(default=None, max_length=32)
    nama: str | None = Field(default=None, max_length=128)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=32)
    department: str | None = Field(default=None, max_length=64)
    position: str | None = Field(default=None, max_length=64)
    status: EmployeeStatus | None = None
    contract_type: ContractType | None = None
    join_date: date | None = None
    kpi_score: float | None = Field(default=None, ge=0, le=100)
    ai_risk: AIRisk | None = None
    photo_url: str | None = Field(default=None, max_length=256)

    # ===== Biodata lengkap (opsional) =====
    ktp: str | None = Field(default=None, max_length=32)
    gender: str | None = Field(default=None, max_length=16)
    birth_place: str | None = Field(default=None, max_length=64)
    birth_date: date | None = None
    religion: str | None = Field(default=None, max_length=32)
    marital_status: str | None = Field(default=None, max_length=32)
    address: str | None = Field(default=None, max_length=512)
    education: str | None = Field(default=None, max_length=64)
    npwp: str | None = Field(default=None, max_length=32)
    bank_name: str | None = Field(default=None, max_length=64)
    bank_account: str | None = Field(default=None, max_length=64)
    bpjs_kesehatan: str | None = Field(default=None, max_length=32)
    bpjs_ketenagakerjaan: str | None = Field(default=None, max_length=32)
    emergency_name: str | None = Field(default=None, max_length=128)
    emergency_phone: str | None = Field(default=None, max_length=32)
    emergency_relation: str | None = Field(default=None, max_length=64)
    skills: str | None = Field(default=None, max_length=512)
    job_desc: str | None = Field(default=None, max_length=2000)
    catatan: str | None = Field(default=None, max_length=1000)


class EmployeeOut(EmployeeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class EmployeeListOut(BaseModel):
    """Respons list dengan info pagination."""

    total: int
    page: int
    page_size: int
    items: list[EmployeeOut]
