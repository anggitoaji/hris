"""Isi database dengan data karyawan contoh untuk testing.

Jalankan: python -m app.seed
"""

from datetime import date

from app.core.database import Base, SessionLocal, engine
from app.models.employee import Employee

SAMPLE = [
    dict(nik="EMP-001", nama="Budi Santoso", email="budi@solusigroup.id",
         department="Engineering", position="Backend Developer",
         status="Aktif", contract_type="Tetap", join_date=date(2023, 1, 15),
         kpi_score=88.5, ai_risk="Low"),
    dict(nik="EMP-002", nama="Siti Aminah", email="siti@solusigroup.id",
         department="HR", position="HR Staff",
         status="Aktif", contract_type="Tetap", join_date=date(2022, 6, 1),
         kpi_score=92.0, ai_risk="Low"),
    dict(nik="EMP-003", nama="Andi Wijaya", email="andi@solusigroup.id",
         department="NOC", position="NOC Engineer",
         status="Cuti", contract_type="Kontrak", join_date=date(2024, 3, 10),
         kpi_score=74.0, ai_risk="Medium"),
    dict(nik="EMP-004", nama="Dewi Lestari", email="dewi@solusigroup.id",
         department="Engineering", position="Frontend Developer",
         status="Probasi", contract_type="Probasi", join_date=date(2025, 11, 1),
         kpi_score=65.0, ai_risk="High"),
    dict(nik="EMP-005", nama="Rudi Hartono", email="rudi@solusigroup.id",
         department="Finance", position="Finance Officer",
         status="Aktif", contract_type="Tetap", join_date=date(2021, 9, 20),
         kpi_score=81.0, ai_risk="Low"),
]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        created = 0
        for row in SAMPLE:
            exists = db.query(Employee).filter(Employee.nik == row["nik"]).first()
            if exists:
                continue
            db.add(Employee(**row))
            created += 1
        db.commit()
        print(f"Seed selesai. {created} karyawan ditambahkan.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
