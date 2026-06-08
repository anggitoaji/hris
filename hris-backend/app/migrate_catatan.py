"""Migrasi: tambah kolom `catatan` ke tabel `employees` (idempotent).

Jalankan dari folder hris-backend (venv aktif):
    python -m app.migrate_catatan
"""

from sqlalchemy import text

from app.core.database import engine

NEW_COLUMNS: dict[str, str] = {
    "catatan": "VARCHAR(1000)",
}


def main() -> None:
    print("== Migrasi kolom catatan ==")
    added = 0
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(employees)")).fetchall()
        existing = {row[1] for row in rows}
        for col, sqltype in NEW_COLUMNS.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE employees ADD COLUMN {col} {sqltype}"))
                added += 1
                print(f"  + kolom ditambahkan: {col} ({sqltype})")
            else:
                print(f"  . kolom sudah ada, dilewati: {col}")
    print(f"Selesai. {added} kolom baru. Restart server lalu lanjut ke frontend.")


if __name__ == "__main__":
    main()
