"""Migrasi: tambah kolom `skills` & `job_desc` ke tabel `employees` (idempotent).

Aman dijalankan berulang:
- Kolom yang sudah ada akan dilewati (tidak menimpa).
- Data karyawan yang sudah ada TIDAK diubah.

Jalankan dari folder hris-backend (venv aktif):
    python -m app.migrate_skills

Catatan: memakai sintaks SQLite (PRAGMA table_info). Bila pindah ke
PostgreSQL, bagian ALTER TABLE perlu disesuaikan (atau pakai alembic).
"""

from sqlalchemy import text

from app.core.database import engine

NEW_COLUMNS: dict[str, str] = {
    "skills": "VARCHAR(512)",
    "job_desc": "VARCHAR(2000)",
}


def main() -> None:
    print("== Migrasi kompetensi/keahlian & jobdesk ==")
    added = 0
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(employees)")).fetchall()
        existing = {row[1] for row in rows}  # row[1] = nama kolom
        for col, sqltype in NEW_COLUMNS.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE employees ADD COLUMN {col} {sqltype}"))
                added += 1
                print(f"  + kolom ditambahkan: {col} ({sqltype})")
            else:
                print(f"  . kolom sudah ada, dilewati: {col}")
    print(f"Selesai. {added} kolom baru ditambahkan.")
    print("Silakan restart server (uvicorn) lalu cek di /api/docs atau di aplikasi.")


if __name__ == "__main__":
    main()
