"""Buat tabel org_nodes dan org_edges (idempotent)."""
import sqlite3, os

DB = os.path.join(os.path.dirname(__file__), "..", "hris.db")

def migrate():
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    tables = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}

    if "org_nodes" not in tables:
        c.execute("""CREATE TABLE org_nodes (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            division_key  VARCHAR(50)  NOT NULL,
            title         VARCHAR(200) DEFAULT '',
            employee_name VARCHAR(200) DEFAULT '',
            department    VARCHAR(200) DEFAULT '',
            color         VARCHAR(20)  DEFAULT '#ffffff',
            text_color    VARCHAR(20)  DEFAULT '#1e293b',
            x             REAL DEFAULT 100.0,
            y             REAL DEFAULT 100.0,
            width         REAL DEFAULT 180.0,
            height        REAL DEFAULT 80.0,
            notes         TEXT DEFAULT '',
            updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")
        print("✓ Tabel org_nodes dibuat.")
    else:
        print("  org_nodes sudah ada.")

    if "org_edges" not in tables:
        c.execute("""CREATE TABLE org_edges (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            division_key VARCHAR(50) NOT NULL,
            source_id    VARCHAR(50) NOT NULL,
            target_id    VARCHAR(50) NOT NULL,
            line_type    VARCHAR(20) DEFAULT 'solid',
            arrow_end    VARCHAR(20) DEFAULT 'arrow',
            label        VARCHAR(200) DEFAULT ''
        )""")
        print("✓ Tabel org_edges dibuat.")
    else:
        print("  org_edges sudah ada.")

    conn.commit(); conn.close()
    print("Migration selesai.")

if __name__ == "__main__":
    migrate()
