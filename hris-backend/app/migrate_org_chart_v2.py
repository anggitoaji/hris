"""Tambah kolom text_align, title_color, name_color ke org_nodes (idempotent)."""
import sqlite3, os

DB = os.path.join(os.path.dirname(__file__), "..", "hris.db")

def migrate():
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    cols = {r[1] for r in c.execute("PRAGMA table_info(org_nodes)").fetchall()}

    for col, dflt in [
        ("text_align",  "'center'"),
        ("title_color", "''"),
        ("name_color",  "''"),
    ]:
        if col not in cols:
            c.execute(f"ALTER TABLE org_nodes ADD COLUMN {col} VARCHAR(20) DEFAULT {dflt}")
            print(f"[+] Kolom {col} ditambahkan.")
        else:
            print(f"  {col} sudah ada.")

    conn.commit(); conn.close()
    print("Migration v2 selesai.")

if __name__ == "__main__":
    migrate()
