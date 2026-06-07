from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

# SQLite butuh argumen khusus karena dipakai lintas thread oleh FastAPI.
connect_args = (
    {"check_same_thread": False}
    if settings.DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class untuk semua model SQLAlchemy."""

    pass


def get_db() -> Generator[Session, None, None]:
    """Dependency FastAPI: buka sesi DB lalu tutup otomatis setelah request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
