from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Employee(Base):
    """Tabel karyawan.

    Field status / contract_type / ai_risk disimpan sebagai string biasa
    (validasi nilai dilakukan di layer Pydantic schema). Ini lebih sederhana
    dan aman untuk SQLite maupun PostgreSQL dibanding native ENUM.
    """

    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nik: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    nama: Mapped[str] = mapped_column(String(128), index=True)
    email: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)

    department: Mapped[str] = mapped_column(String(64), index=True)  # divisi
    position: Mapped[str] = mapped_column(String(64))                # jabatan

    status: Mapped[str] = mapped_column(String(16), default="Aktif", index=True)
    contract_type: Mapped[str] = mapped_column(String(16), default="Kontrak")
    join_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    kpi_score: Mapped[float] = mapped_column(Float, default=0.0)
    ai_risk: Mapped[str] = mapped_column(String(8), default="Low")

    photo_url: Mapped[str | None] = mapped_column(String(256), nullable=True)

    # ===== Biodata lengkap (semua opsional / nullable) =====
    ktp: Mapped[str | None] = mapped_column(String(32), nullable=True)            # No. KTP
    gender: Mapped[str | None] = mapped_column(String(16), nullable=True)         # Laki-laki / Perempuan
    birth_place: Mapped[str | None] = mapped_column(String(64), nullable=True)    # Tempat lahir
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)          # Tanggal lahir
    religion: Mapped[str | None] = mapped_column(String(32), nullable=True)       # Agama
    marital_status: Mapped[str | None] = mapped_column(String(32), nullable=True) # Status pernikahan
    address: Mapped[str | None] = mapped_column(String(512), nullable=True)       # Alamat
    education: Mapped[str | None] = mapped_column(String(64), nullable=True)      # Pendidikan terakhir

    npwp: Mapped[str | None] = mapped_column(String(32), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    bank_account: Mapped[str | None] = mapped_column(String(64), nullable=True)
    bpjs_kesehatan: Mapped[str | None] = mapped_column(String(32), nullable=True)
    bpjs_ketenagakerjaan: Mapped[str | None] = mapped_column(String(32), nullable=True)

    emergency_name: Mapped[str | None] = mapped_column(String(128), nullable=True)     # Kontak darurat: nama
    emergency_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)     # Kontak darurat: telp
    emergency_relation: Mapped[str | None] = mapped_column(String(64), nullable=True)  # Kontak darurat: hubungan

    # ===== Kompetensi & uraian tugas =====
    skills: Mapped[str | None] = mapped_column(String(512), nullable=True)     # Keahlian/kompetensi (pisah koma)
    job_desc: Mapped[str | None] = mapped_column(String(2000), nullable=True)  # Jobdesk / uraian tugas
    catatan: Mapped[str | None] = mapped_column(String(1000), nullable=True)   # Catatan umum

    # ===== Tambahan Fase 1: field dasar =====
    nama_panggilan: Mapped[str | None] = mapped_column(String(64), nullable=True)
    blood_type: Mapped[str | None] = mapped_column(String(4), nullable=True)        # Golongan darah
    no_kk: Mapped[str | None] = mapped_column(String(32), nullable=True)            # Nomor KK
    contract_date: Mapped[date | None] = mapped_column(Date, nullable=True)         # Tanggal kontrak
    permanent_date: Mapped[date | None] = mapped_column(Date, nullable=True)        # Tanggal tetap
    resign_date: Mapped[date | None] = mapped_column(Date, nullable=True)           # Tanggal resign
    probation: Mapped[str | None] = mapped_column(String(64), nullable=True)        # Masa percobaan
    grade: Mapped[str | None] = mapped_column(String(32), nullable=True)
    work_location: Mapped[str | None] = mapped_column(String(128), nullable=True)   # Lokasi kerja
    supervisor: Mapped[str | None] = mapped_column(String(128), nullable=True)      # Atasan langsung

    # Soft delete: data tidak dihapus permanen, hanya ditandai non-aktif.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
