# Solusi Group HRIS — Backend API (Modul Karyawan)

Backend FastAPI untuk modul karyawan. Default pakai **SQLite** supaya
langsung jalan di laptop tanpa perlu install PostgreSQL.

## Struktur

```
hris-backend/
├── app/
│   ├── main.py              # entry point FastAPI
│   ├── seed.py              # isi data contoh
│   ├── core/
│   │   ├── config.py        # konfigurasi (.env)
│   │   └── database.py      # koneksi & sesi DB
│   ├── models/employee.py   # tabel SQLAlchemy
│   ├── schemas/employee.py  # validasi Pydantic
│   ├── crud/employee.py     # logika query
│   └── api/routes/employees.py  # endpoint REST
├── requirements.txt
├── .env.example
└── README.md
```

## Cara Menjalankan di Laptop

### 1. Siapkan environment

```bash
cd hris-backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. (Opsional) Konfigurasi

```bash
cp .env.example .env
```

Tanpa langkah ini pun jalan — default-nya SQLite (`hris.db`).

### 3. Isi data contoh (opsional)

```bash
python -m app.seed
```

### 4. Jalankan server

```bash
uvicorn app.main:app --reload
```

Buka dokumentasi interaktif:
- Swagger UI: http://localhost:8000/docs
- Cek kesehatan: http://localhost:8000/health

## Endpoint

| Method | Path | Fungsi |
|--------|------|--------|
| GET    | `/api/employees` | List + filter (`search`, `department`, `status`) + pagination (`page`, `page_size`) |
| GET    | `/api/employees/{id}` | Detail satu karyawan |
| POST   | `/api/employees` | Tambah karyawan |
| PATCH  | `/api/employees/{id}` | Update sebagian field |
| DELETE | `/api/employees/{id}` | Soft delete (tandai non-aktif) |

### Contoh tambah karyawan

```bash
curl -X POST http://localhost:8000/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "nik": "EMP-010",
    "nama": "Joko Susilo",
    "email": "joko@solusigroup.id",
    "department": "Engineering",
    "position": "DevOps Engineer",
    "status": "Aktif",
    "contract_type": "Tetap",
    "kpi_score": 85,
    "ai_risk": "Low"
  }'
```

## Menyambungkan ke Frontend Next.js

Frontend memanggil `http://localhost:8000/api/employees` menggantikan
mock data di `src/lib/data.ts`. CORS sudah diizinkan untuk
`http://localhost:3000`.

## Pindah ke Produksi (VPS) nanti

1. Install PostgreSQL di VPS.
2. Tambahkan `psycopg[binary]` ke `requirements.txt`.
3. Set `DATABASE_URL` di `.env` ke connection string PostgreSQL.
4. **Penting:** mount volume Postgres ke disk permanen + backup rutin
   supaya data tidak hilang lagi.

Kode aplikasi tidak perlu diubah — cukup ganti `DATABASE_URL`.

## Catatan

- Tabel dibuat otomatis saat startup. Untuk produksi, sebaiknya pindah
  ke migration (Alembic).
- Authentication (JWT + role) belum termasuk di modul ini — itu langkah
  berikutnya sesuai roadmap Version 1.
- Simpan kode ini di Git (GitHub/GitLab) supaya tidak bergantung pada VPS.
```
