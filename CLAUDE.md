# HRIS App — Konteks Proyek untuk Claude

## Stack
- **Backend**: FastAPI + SQLAlchemy (Mapped/mapped_column) + SQLite (dev) / PostgreSQL (prod)
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Auth**: HMAC-SHA256 custom, PBKDF2 password hash, Bearer token
- **Root**: `C:\Users\angsm\OneDrive\Documents\HRIS`

## Struktur Folder
```
hris-backend/app/
  main.py              # register semua router
  auth.py              # login, token, require_roles()
  core/database.py     # engine, Base, get_db
  core/config.py       # settings dari .env (DATABASE_URL, SECRET_KEY)
  models/employee.py   # model Employee
  models/kpi.py        # model KpiAssessment, KpiAspect, KpiPeriod
  schemas/employee.py  # Pydantic schema Employee
  schemas/kpi.py       # Pydantic schema KPI
  crud/employee.py     # CRUD helpers Employee
  crud/kpi.py          # CRUD helpers KPI
  api/routes/employees.py  # endpoint /employees
  api/routes/kpi.py        # endpoint /kpi/*
  disciplinary.py      # model + schema + router (1 file)
  reward.py            # model + schema + router (1 file)
  job_profile.py       # model + schema + router (1 file)
  position.py          # model + schema + router (1 file)
  talent.py            # model + schema + router (1 file)
  training.py, payroll.py, attendance.py, ... (pola sama)
  audit.py             # log_audit(), get_client_ip()

hris-dashboard/src/
  App.tsx              # routing utama (route === "xxx" → render page)
  components/Sidebar.tsx  # MENU array, routeFor(), role gating
  services/api.ts      # semua fetch ke backend
  pages/               # satu file per halaman
  types/index.ts       # shared TypeScript types
```

## Pola Modul Backend (1 file)
Semua modul baru pakai pola ini — model + schema + router dalam 1 file:

```python
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, Session, mapped_column
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from app.core.database import Base, get_db
from app.auth import get_current_user, require_roles, User
from app.audit import log_audit, get_client_ip

class MyModel(Base):
    __tablename__ = "my_table"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # ... fields
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

class MyCreate(BaseModel): ...
class MyUpdate(BaseModel): ...

router = APIRouter(prefix="/my-route", tags=["My Module"])

@router.get("")
def list_items(_user: User = Depends(get_current_user), db: Session = Depends(get_db)): ...

@router.post("", status_code=201)
def create_item(payload: MyCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles("HR"))): ...
```

Lalu di `main.py`:
```python
from app.my_module import router as my_router
app.include_router(my_router, prefix=settings.API_PREFIX, dependencies=login_required)
```

## Pola Frontend — Tambah Halaman Baru
1. Buat `hris-dashboard/src/pages/NamaPage.tsx`
2. Tambah fungsi API di `services/api.ts`
3. Tambah submenu di `Sidebar.tsx` → array `MENU` + `routeFor()`
4. Tambah route di `App.tsx` → `{route === "xxx" && <NamaPage />}`

## Role yang Ada
`"Super Admin" | "Direksi" | "HR" | "Manager" | "Supervisor" | "Finance" | "NOC" | "Karyawan"`
- Super Admin selalu lolos `require_roles()` tanpa argumen
- `require_roles("HR", "Manager")` → hanya HR dan Manager (+ Super Admin)

## Modul KPI — Key Files
- **Model**: `models/kpi.py` — KpiAssessment, KpiAspect, KpiPeriod
- **Schema**: `schemas/kpi.py` — WORKFLOW_STATUSES, AssessmentOut, dll
- **CRUD**: `crud/kpi.py` — get_or_create_period, compliance_for_period, close_period
- **Router**: `api/routes/kpi.py` — TRANSITIONS dict (workflow gating per role)
- **Frontend Form**: `pages/KpiAssessmentFormPage.tsx`
- **Frontend Dashboard Karyawan**: `pages/MyKpiDashboardPage.tsx`
- **Frontend Dashboard HRD**: `pages/KpiDashboardHrdPage.tsx`

Workflow KPI: `draft → supervisor_review → manager_review → hrd_review → calibration → final_approved`

Bobot KPI:
- Staff: KPI Jabatan 70%, Kompetensi 20%, Perilaku 10%
- Supervisor/Manager: KPI Jabatan 60%, Kompetensi 20%, Perilaku 10%, People Management 10%

## Modul Disiplin
- File: `disciplinary.py`
- Point system: Terlambat=5, SOP=10, Mangkir=20, Manipulasi=25, Security=30
- Status: Hijau(0-10), Kuning(11-20), SP1(21-40), SP2(41-60), SP3(>60), CLEAR(3thn bersih)
- Tidak ada endpoint DELETE — riwayat permanen

## Modul Talent
- File: `talent.py`
- Label: High Performer / Future Leader / Core Talent / Need Development / Under Performer
- Input: KPI score + competency score + discipline score (100 - poin/60×100) + leadership score
- Endpoint preview: `/talent/preview/{period}` (on-the-fly, tidak simpan)
- Endpoint finalisasi: POST `/talent/save/{period}`

## Database
- Dev: SQLite (`hris.db`) — aktif via `.env`
- Prod: PostgreSQL — uncomment di `.env` saat deploy
- Tabel dibuat otomatis via `Base.metadata.create_all()` saat startup
- Raw SQL boolean: pakai `TRUE/FALSE` (bukan 1/0) supaya kompatibel PostgreSQL

## Audit Trail
Semua CREATE/UPDATE/DELETE wajib memanggil:
```python
log_audit(db, user.id, "table_name", record_id, "ACTION", before_dict, after_dict, get_client_ip(request))
```

## Konvensi Kode
- Tidak ada endpoint DELETE data karyawan/sanksi (soft delete atau permanen)
- Konfirmasi user sebelum hapus data (sesuai policy: tambah/edit bebas, hapus minta izin)
- Tidak ada komentar kode kecuali WHY yang tidak jelas
- Backend: Python type hints wajib (`Mapped[...]`, Pydantic model)
- Frontend: TypeScript strict, tidak ada `any` yang tidak perlu
- UI style: clean/modern card-based, Tailwind, sky-blue sebagai primary color
