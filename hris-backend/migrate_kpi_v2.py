"""
Migrasi DB untuk KPI v2 (form penilaian Manager/HRD + dashboard My KPI):
- Tambah kolom 'status' di kpi_assessments (draft/hrd_review/final_approved)
- Buat tabel kpi_qual_scores (Kompetensi & Perilaku Kerja, skala 1-5, dinilai Manager+HRD)
"""

import sqlite3

DB_PATH = "hris.db"


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("PRAGMA table_info(kpi_assessments)")
    cols = [row[1] for row in cur.fetchall()]
    if "status" not in cols:
        cur.execute(
            "ALTER TABLE kpi_assessments ADD COLUMN status TEXT DEFAULT 'draft'"
        )
        print("[+] Kolom 'status' ditambahkan ke kpi_assessments")
    else:
        print("[i] Kolom 'status' sudah ada")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS kpi_qual_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessment_id INTEGER NOT NULL REFERENCES kpi_assessments(id) ON DELETE CASCADE,
            category VARCHAR(16) NOT NULL,
            parameter VARCHAR(64) NOT NULL,
            manager_score FLOAT DEFAULT 0.0,
            hrd_score FLOAT DEFAULT 0.0
        )
        """
    )
    print("[+] Tabel kpi_qual_scores siap")

    conn.commit()
    conn.close()
    print("\n[+] Migrasi selesai.")


if __name__ == "__main__":
    main()
