"""Migrasi: tambah kolom biodata ke tabel `employees`, lalu isi contoh biodata
untuk karyawan seed (EMP-001..EMP-005).

Aman dijalankan berulang (idempotent):
- Kolom yang sudah ada akan dilewati (tidak menimpa).
- Data karyawan yang sudah Anda input TIDAK dihapus.
- Contoh biodata hanya diisi pada record yang masih kosong.

Jalankan dari folder hris-backend (venv aktif):
    python -m app.migrate_biodata

CATATAN: skrip ini memakai sintaks SQLite (PRAGMA table_info). Kalau nanti
pindah ke PostgreSQL, bagian penambahan kolom perlu disesuaikan (atau pakai
alembic). Logika pengisian datanya tetap sama.
"""

from datetime import date

from sqlalchemy import text

from app.core.database import SessionLocal, engine
from app.models.employee import Employee

# Kolom biodata baru -> tipe SQL untuk ALTER TABLE
NEW_COLUMNS: dict[str, str] = {
    "ktp": "VARCHAR(32)",
    "gender": "VARCHAR(16)",
    "birth_place": "VARCHAR(64)",
    "birth_date": "DATE",
    "religion": "VARCHAR(32)",
    "marital_status": "VARCHAR(32)",
    "address": "VARCHAR(512)",
    "education": "VARCHAR(64)",
    "npwp": "VARCHAR(32)",
    "bank_name": "VARCHAR(64)",
    "bank_account": "VARCHAR(64)",
    "bpjs_kesehatan": "VARCHAR(32)",
    "bpjs_ketenagakerjaan": "VARCHAR(32)",
    "emergency_name": "VARCHAR(128)",
    "emergency_phone": "VARCHAR(32)",
    "emergency_relation": "VARCHAR(64)",
}

# Contoh biodata untuk karyawan seed (dipakai hanya jika field masih kosong).
DEMO: dict[str, dict] = {
    "EMP-001": dict(
        gender="Laki-laki", birth_place="Bandung", birth_date=date(1990, 5, 12),
        religion="Islam", marital_status="Menikah",
        address="Jl. Merdeka No. 10, Bandung", education="S1 Teknik Informatika",
        ktp="3273011205900001", npwp="09.123.456.7-001.000",
        bank_name="BCA", bank_account="1234567890",
        bpjs_kesehatan="0001234567890", bpjs_ketenagakerjaan="11AA22334455",
        emergency_name="Sari Santoso", emergency_phone="0812-1111-2222", emergency_relation="Istri",
    ),
    "EMP-002": dict(
        gender="Perempuan", birth_place="Jakarta", birth_date=date(1992, 8, 20),
        religion="Islam", marital_status="Menikah",
        address="Jl. Sudirman No. 5, Jakarta Selatan", education="S1 Manajemen SDM",
        ktp="3174012008920002", npwp="09.123.456.7-002.000",
        bank_name="Mandiri", bank_account="1300012345678",
        bpjs_kesehatan="0002234567890", bpjs_ketenagakerjaan="11AA22334466",
        emergency_name="Ahmad Fauzi", emergency_phone="0813-3333-4444", emergency_relation="Suami",
    ),
    "EMP-003": dict(
        gender="Laki-laki", birth_place="Surabaya", birth_date=date(1995, 3, 3),
        religion="Islam", marital_status="Belum Menikah",
        address="Jl. Pemuda No. 21, Surabaya", education="D3 Teknik Komputer",
        ktp="3578010303950003", npwp="09.123.456.7-003.000",
        bank_name="BNI", bank_account="0234567891",
        bpjs_kesehatan="0003234567890", bpjs_ketenagakerjaan="11AA22334477",
        emergency_name="Wati Wijaya", emergency_phone="0814-5555-6666", emergency_relation="Ibu",
    ),
    "EMP-004": dict(
        gender="Perempuan", birth_place="Yogyakarta", birth_date=date(1998, 11, 1),
        religion="Katolik", marital_status="Belum Menikah",
        address="Jl. Malioboro No. 8, Yogyakarta", education="S1 Desain Komunikasi Visual",
        ktp="3471010111980004", npwp="09.123.456.7-004.000",
        bank_name="BCA", bank_account="3456789012",
        bpjs_kesehatan="0004234567890", bpjs_ketenagakerjaan="11AA22334488",
        emergency_name="Budi Lestari", emergency_phone="0815-7777-8888", emergency_relation="Ayah",
    ),
    "EMP-005": dict(
        gender="Laki-laki", birth_place="Medan", birth_date=date(1988, 9, 25),
        religion="Kristen", marital_status="Menikah",
        address="Jl. Gatot Subroto No. 30, Medan", education="S1 Akuntansi",
        ktp="1271012509880005", npwp="09.123.456.7-005.000",
        bank_name="Mandiri", bank_account="1300098765432",
        bpjs_kesehatan="0005234567890", bpjs_ketenagakerjaan="11AA22334499",
        emergency_name="Linda Hartono", emergency_phone="0816-9999-0000", emergency_relation="Istri",
    ),
}


def _existing_columns(conn) -> set[str]:
    rows = conn.execute(text("PRAGMA table_info(employees)")).fetchall()
    return {row[1] for row in rows}  # row[1] = nama kolom


def add_columns() -> int:
    """Tambah kolom yang belum ada. Mengembalikan jumlah kolom yang ditambahkan."""
    added = 0
    with engine.begin() as conn:
        existing = _existing_columns(conn)
        for col, sqltype in NEW_COLUMNS.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE employees ADD COLUMN {col} {sqltype}"))
                added += 1
                print(f"  + kolom ditambahkan: {col} ({sqltype})")
            else:
                print(f"  . kolom sudah ada, dilewati: {col}")
    return added


def fill_demo() -> int:
    """Isi contoh biodata untuk EMP-001..005 pada field yang masih kosong."""
    filled = 0
    db = SessionLocal()
    try:
        for nik, data in DEMO.items():
            emp = db.query(Employee).filter(Employee.nik == nik).first()
            if not emp:
                continue
            changed = False
            for field, value in data.items():
                if getattr(emp, field, None) in (None, ""):
                    setattr(emp, field, value)
                    changed = True
            if changed:
                filled += 1
                print(f"  ~ biodata contoh diisi: {nik} ({emp.nama})")
        db.commit()
    finally:
        db.close()
    return filled


def main() -> None:
    print("== Migrasi biodata karyawan ==")
    print("1) Menambah kolom biodata ...")
    added = add_columns()
    print(f"   Selesai. {added} kolom baru ditambahkan.\n")

    print("2) Mengisi contoh biodata (hanya yang kosong) ...")
    filled = fill_demo()
    print(f"   Selesai. {filled} karyawan seed terisi contoh biodata.\n")

    print("Migrasi selesai. Silakan restart server (uvicorn) lalu cek di /docs atau di app.")


if __name__ == "__main__":
    main()
