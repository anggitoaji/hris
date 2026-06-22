import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api.routes import employees, kpi
from app.divisi import router as divisi_router
from app.attendance import router as attendance_router
from app.payroll import router as payroll_router
from app.meeting import router as meeting_router
from app.education import router as education_router
from app.certification import router as certification_router
from app.job_history import router as job_history_router
from app.family import router as family_router
from app.training import router as training_router
from app.documents import router as documents_router
from app.disciplinary import router as disciplinary_router
from app.reward import router as reward_router
from app.job_profile import router as job_profile_router
from app.ai_engine import router as ai_router
from app.position import router as position_router
from app.talent import router as talent_router
from app.photo_serve import router as photo_serve_router
from app.audit import router as audit_router
from app.org_chart import router as org_chart_router
from app.app_settings import router as app_settings_router
from app.auth import router as auth_router, ensure_default_admin, get_current_user, require_roles
from app.core.config import settings
from app.core.database import Base, engine

# Import semua model agar terdaftar sebelum create_all.
from app.models import employee as _employee_model  # noqa: F401
from app.models import kpi as _kpi_model  # noqa: F401

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Buat tabel yang belum ada saat startup (termasuk tabel KPI yang baru).
    Base.metadata.create_all(bind=engine)
    ensure_default_admin()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Semua endpoint data WAJIB login (token dikirim dari frontend).
login_required = [Depends(get_current_user)]
app.include_router(employees.router, prefix=settings.API_PREFIX, dependencies=login_required)
app.include_router(kpi.router, prefix=settings.API_PREFIX, dependencies=login_required)
app.include_router(divisi_router, prefix=settings.API_PREFIX, dependencies=login_required)
app.include_router(attendance_router, prefix=settings.API_PREFIX, dependencies=login_required)
# Payroll: hanya Direksi/Finance (Super Admin selalu boleh).
app.include_router(payroll_router, prefix=settings.API_PREFIX, dependencies=[Depends(require_roles("Direksi", "Finance"))])
app.include_router(meeting_router, prefix=settings.API_PREFIX, dependencies=login_required)
app.include_router(education_router, prefix=settings.API_PREFIX, dependencies=login_required)
app.include_router(certification_router, prefix=settings.API_PREFIX, dependencies=login_required)
app.include_router(job_history_router, prefix=settings.API_PREFIX, dependencies=login_required)
app.include_router(family_router, prefix=settings.API_PREFIX, dependencies=login_required)
app.include_router(training_router, prefix=settings.API_PREFIX, dependencies=login_required)
app.include_router(org_chart_router, prefix=settings.API_PREFIX, dependencies=login_required)
# Audit Trail: hanya Super Admin
app.include_router(audit_router, prefix=settings.API_PREFIX, dependencies=[Depends(require_roles())])
# Foto profil: auth via token query param
app.include_router(photo_serve_router, prefix=settings.API_PREFIX)
# Documents: auth per-endpoint (download/preview pakai token query param)
app.include_router(documents_router, prefix=settings.API_PREFIX)
# Disciplinary Action (Sanksi): auth per-endpoint (POST/cabut dibatasi role di dalam router, lampiran pakai token query param)
app.include_router(disciplinary_router, prefix=settings.API_PREFIX)
# Reward Management: auth per-endpoint (create dibatasi role di dalam router)
app.include_router(reward_router, prefix=settings.API_PREFIX)
# App Settings (Super Admin only via require_roles() per-endpoint)
app.include_router(app_settings_router, prefix=settings.API_PREFIX)
# Job Profile, Position Management, Talent Management
app.include_router(job_profile_router, prefix=settings.API_PREFIX, dependencies=login_required)
# AI HR Engine
app.include_router(ai_router, prefix=settings.API_PREFIX, dependencies=login_required)
app.include_router(position_router, prefix=settings.API_PREFIX, dependencies=login_required)
app.include_router(talent_router, prefix=settings.API_PREFIX, dependencies=login_required)
# Auth: login terbuka; kelola user sudah dibatasi Super Admin di dalam router.
app.include_router(auth_router, prefix=settings.API_PREFIX)


@app.get("/", include_in_schema=False)
def dashboard():
    """Sajikan halaman dashboard. Buka http://localhost:8000/ di browser."""
    return FileResponse(os.path.join(STATIC_DIR, "dashboard.html"))


@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
