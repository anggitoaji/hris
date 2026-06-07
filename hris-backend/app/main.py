import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api.routes import employees, kpi
from app.divisi import router as divisi_router
from app.attendance import router as attendance_router
from app.payroll import router as payroll_router
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

app.include_router(employees.router, prefix=settings.API_PREFIX)
app.include_router(kpi.router, prefix=settings.API_PREFIX)
app.include_router(divisi_router, prefix=settings.API_PREFIX)
app.include_router(attendance_router, prefix=settings.API_PREFIX)
app.include_router(payroll_router, prefix=settings.API_PREFIX)


@app.get("/", include_in_schema=False)
def dashboard():
    """Sajikan halaman dashboard. Buka http://localhost:8000/ di browser."""
    return FileResponse(os.path.join(STATIC_DIR, "dashboard.html"))


@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
