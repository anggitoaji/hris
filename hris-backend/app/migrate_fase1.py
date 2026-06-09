"""Migrasi Fase 1: tambah field dasar ke tabel `employees` (idempotent).

Jalankan dari folder hris-backend (venv aktif):
    python -m app.migrate_fase1
"""

from sqlalchemy import text

from app.core.database import engine

NEW_COLUMNS: dict[str, str] = {
    "nama_panggilan": "VARCHAR(64)",
    "blood_type": "VARCHAR(4)",
    "no_kk": "VARCHAR(32)",
    "contract_date": "DATE",
    "permanent_date": "DATE",
    "resign_date": "DATE",
    "probation": "VARCHAR(64)",
    "grade": "VARCHAR(32)",
    "work_location": "VARCHAR(128)",
    "supervisor": "VARCHAR(128)",
}


def main() -> None:
    print("== Migrasi Fase 1 (field dasar Employee Master) ==")
    added = 0
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(employees)")).fetchall()
        existing = {row[1] for row in rows}
        for col, sqltype in NEW_COLUMNS.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE employees ADD COLUMN {col} {sqltype}"))
                added += 1
                print(f"  + {col} ({sqltype})")
            else:
                print(f"  . {col} sudah ada, dilewati")
    print(f"Selesai. {added} kolom baru. Restart server lalu lanjut frontend.")


if __name__ == "__main__":
    main()
