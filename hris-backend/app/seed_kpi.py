"""Isi data KPI contoh untuk semua karyawan yang ada.

Jalankan: python -m app.seed_kpi
"""

import random

from app.core.database import Base, SessionLocal, engine
from app.models.employee import Employee
from app.models.kpi import KpiAspectScore, KpiAssessment

ASPECTS = ["Disiplin", "Pencapaian Target", "Kerjasama Tim", "Komunikasi", "Inisiatif"]
# Penilaian per 6 bulan (semester). Dua periode supaya bisa lihat perbandingan.
PERIODS = ["2025 Semester 2", "2026 Semester 1"]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        employees = db.query(Employee).all()
        if not employees:
            print("Belum ada karyawan. Jalankan dulu: python -m app.seed")
            return

        created = 0
        for emp in employees:
            base = emp.kpi_score or 75.0
            for i, period in enumerate(PERIODS):
                exists = (
                    db.query(KpiAssessment)
                    .filter_by(employee_id=emp.id, period=period)
                    .first()
                )
                if exists:
                    continue
                # Periode terbaru sedikit lebih tinggi (seolah ada perbaikan).
                drift = 2 if i == len(PERIODS) - 1 else -2
                assessment = KpiAssessment(employee_id=emp.id, period=period)
                aspect_scores = []
                for aspect in ASPECTS:
                    sc = max(0, min(100, round(base + drift + random.uniform(-7, 7))))
                    assessment.aspects.append(
                        KpiAspectScore(aspect=aspect, score=sc, target=80)
                    )
                    aspect_scores.append(sc)
                avg = sum(aspect_scores) / len(aspect_scores)
                assessment.needs_coaching = avg < 70
                db.add(assessment)
                created += 1
        db.commit()
        print(f"Seed KPI selesai. {created} penilaian ditambahkan.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
