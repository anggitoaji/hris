# WORKSPACE MANAGEMENT SYSTEM — PROJECT HANDOFF
Dokumen ini dibuat untuk melanjutkan pengembangan di Claude Code.
Baca seluruh dokumen sebelum mulai coding.

---

## IDENTITAS PROJECT
- **Nama**: Workspace Management System (HRIS)
- **Owner**: Anggi Kurnianto (HRD, Solusi Group, NIK SMS-001)
- **Lokasi**: `C:\Users\angsm\OneDrive\Documents\HRIS\`
- **Status**: Active Development — Production-ready untuk internal use

---

## TECH STACK

### Backend
- **Framework**: FastAPI (Python)
- **Database**: SQLite (`hris-backend/hris.db`)
- **ORM**: SQLAlchemy (mapped_column style)
- **Auth**: Custom HMAC-SHA256 token (JWT-like, tanpa library eksternal)
- **File storage**: Local disk (`uploads/documents/`, `uploads/photos/`)
- **Port**: `localhost:8000`
- **Venv**: `.venv` di dalam `hris-backend/`
- **Run**: `uvicorn app.main:app --reload`

### Frontend
- **Framework**: React + TypeScript
- **Build tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: lucide-react
- **Port**: `localhost:5173`
- **Run**: `npm run dev`

### Environment
- **OS**: Windows 11
- **Shell**: PowerShell 5.1 (TIDAK support `&&` — selalu tulis command terpisah)
- **File delivery**: Download dari Claude → Copy-Item ke project folder
- **Git**: Initialized, root di `C:\Users\angsm\OneDrive\Documents\HRIS\`

---

## STRUKTUR PROJECT

```
HRIS/
├── hris-backend/
│   ├── app/
│   │   ├── main.py              ← Entry point, router registration
│   │   ├── auth.py              ← Login, token, RBAC
│   │   ├── audit.py             ← Audit trail
│   │   ├── attendance.py        ← Kehadiran & Absensi
│   │   ├── certification.py     ← Sertifikasi karyawan
│   │   ├── divisi.py            ← Kelola divisi
│   │   ├── documents.py         ← Upload/download dokumen
│   │   ├── education.py         ← Riwayat pendidikan
│   │   ├── family.py            ← Data keluarga
│   │   ├── job_history.py       ← Riwayat jabatan
│   │   ├── meeting.py           ← Meeting & MoM
│   │   ├── payroll.py           ← Slip gaji
│   │   ├── photo_serve.py       ← Serve foto profil (token via query param)
│   │   ├── training.py          ← Training & development
│   │   ├── api/routes/
│   │   │   ├── employees.py     ← CRUD karyawan + upload foto
│   │   │   └── kpi.py           ← KPI assessment
│   │   ├── models/
│   │   │   ├── employee.py      ← Model SQLAlchemy Employee
│   │   │   └── kpi.py
│   │   ├── schemas/
│   │   │   ├── employee.py      ← Pydantic schema (Base/Create/Update/Out)
│   │   │   └── kpi.py
│   │   ├── crud/
│   │   │   └── employee.py      ← CRUD functions
│   │   └── core/
│   │       ├── database.py      ← Engine, get_db
│   │       └── config.py        ← Settings (SECRET_KEY, TOKEN_HOURS, API_PREFIX)
│   ├── uploads/
│   │   ├── documents/           ← File dokumen (UUID-named)
│   │   └── photos/              ← Foto profil (UUID-named)
│   └── hris.db                  ← SQLite database
│
└── hris-dashboard/
    └── src/
        ├── App.tsx              ← Auth gating, routing, layout
        ├── types/index.ts       ← TypeScript interfaces
        ├── services/api.ts      ← Semua API calls (single file)
        ├── pages/
        │   ├── DataKaryawanPage.tsx   ← TERBESAR — tabel + profil 12 tab
        │   ├── LoginPage.tsx
        │   ├── UserManagementPage.tsx
        │   ├── ChangePasswordPage.tsx
        │   ├── KehadiranPage.tsx
        │   ├── SlipGajiPage.tsx
        │   ├── MeetingPage.tsx
        │   ├── ActionItemsPage.tsx
        │   ├── KpiKaryawanPage.tsx
        │   ├── KpiPerusahaanPage.tsx
        │   └── KpiDivisiPage.tsx
        └── components/
            ├── Sidebar.tsx      ← Navigation + role-based menu
            └── Header.tsx       ← Top bar + user menu
```

---

## AUTH & ROLES

### Roles (7):
`Super Admin`, `Direksi`, `HR`, `Manager`, `Finance`, `NOC`, `Karyawan`

### Mekanisme:
- Token disimpan di `localStorage("hris_token")`
- Setiap request kirim `Authorization: Bearer <token>`
- Foto & dokumen preview/download pakai `?token=` query param (karena `<img src>` tidak bisa kirim header)
- Default admin: `admin / admin123` (sudah diganti oleh owner)

### Endpoint protection (di `main.py`):
- Semua data endpoint: `dependencies=[Depends(get_current_user)]`
- Payroll: `dependencies=[Depends(require_roles("Direksi", "Finance"))]`
- Audit Trail: `dependencies=[Depends(require_roles())]` → Super Admin only
- Auth router: terbuka
- Documents & Photos: auth per-endpoint (token query param)

---

## FITUR YANG SUDAH SELESAI

### 1. Employee Master Data (`DataKaryawanPage.tsx`)
**Tabel utama:**
- Kolom: Foto (36px bulat) | NIK | Nama | Divisi | Jabatan | Email | No HP | Lokasi Kerja | KPI | Catatan
- Filter: Cari teks, Semua Divisi, Semua Status, Kelompokkan per divisi
- Tambah/Edit/Hapus karyawan

**Profil 12 Tab:**
1. **Overview** — ringkasan + No WA klik langsung
2. **Pribadi** — data diri lengkap
3. **Kontak** — email, telp, kontak darurat
4. **Kepegawaian** — status, kontrak, join date
5. **Keuangan & BPJS** — bank, NPWP, BPJS
6. **Kompetensi** — skill chips, jobdesk, catatan
7. **Pendidikan** — CRUD multi-baris (jenjang, institusi, jurusan, IPK)
8. **Sertifikasi** — CRUD multi-baris (nama, nomor, penerbit, expired)
9. **Riwayat Jabatan** — CRUD multi-baris (jabatan lama/baru, divisi, tgl efektif)
10. **Keluarga** — CRUD multi-baris (Pasangan/Anak, badge warna berbeda)
11. **Training** — CRUD multi-baris (nama, penyelenggara, nilai)
12. **Dokumen** — upload PDF/JPG/PNG (maks 10MB), preview inline modal, download, hapus, grouped by kategori
13. **Audit Log** — riwayat perubahan (Super Admin only) + DiffView (data lama vs baru)

**Foto profil:**
- Upload lewat hover avatar di profil header
- Tampil di tabel dan profil
- Serve via `/api/photos/{id}?token=`
- Fallback ke inisial kalau belum ada foto

### 2. Kehadiran & Absensi
- CRUD per hari per karyawan
- Status: Hadir/Terlambat/WFH/Izin/Sakit/Cuti/Alpa
- Check in/out time, summary stat cards

### 3. Payroll / Slip Gaji
- Template gaji per karyawan (earning + deduction items)
- Generate slip per periode (YYYY-MM)
- Status Draft/Final
- Auto-hitung total dari template

### 4. Meeting & MoM
- Meeting Internal & Pelanggan
- Action Items (done/undone, overdue merah)
- Status: Terjadwal/Selesai/Batal

### 5. KPI
- KPI Karyawan (assessment per periode, per aspek)
- KPI Perusahaan (summary distribution, top performer)
- KPI Divisi (ranking per divisi)

### 6. Login & Hak Akses
- LoginPage, token persist, auto-logout saat 401
- 7 role, role-based sidebar menu
- Super Admin: bisa "Tampil sebagai" role lain (preview mode)
- User Management: buat/edit/hapus akun, set role, kaitkan ke karyawan
- Ganti Password (semua role, di menu Pengaturan)

### 7. Kelola Divisi
- Tambah/rename/hapus divisi
- Hapus blocked kalau masih ada karyawan

---

## YANG BELUM DIBANGUN (PRIORITAS)

### Tier 1 — Segera
- **Modul Cuti & Izin**: pengajuan, approval, saldo cuti per karyawan
- **Modul Operasional Modem**: paling sering dipakai oleh tim NOC (data pelanggan modem, stok, aktivasi)
- **Dashboard Eksekutif**: widget KPI real, headcount, absensi summary (sekarang masih dummy data)

### Tier 2 — Menengah
- **PostgreSQL migration**: SQLite → PostgreSQL untuk production
- **Deploy cloud/VPS**: Docker + Nginx + HTTPS + backup otomatis
- **ESS (Employee Self Service)**: karyawan lihat/update profil sendiri
- **Notifikasi**: reminder dokumen expired, approval cuti

### Tier 3 — Nice to Have
- **Audit Trail lebih luas**: sekarang hanya employee CRUD, belum ke modul lain
- **Dokumen versioning & e-signature**
- **PDF slip gaji** (download slip sebagai PDF)
- **Rekrutmen & Onboarding**
- **Arsip Meeting** submenu

---

## POLA PENGEMBANGAN (WAJIB DIPAHAMI)

### Backend pattern (semua modul mengikuti ini):
```python
# Satu file = model + schema + router
# Contoh: education.py

class EducationRecord(Base):          # Model SQLAlchemy
class EduCreate(BaseModel):           # Pydantic schema
class EduOut(BaseModel): ...          # Response schema
router = APIRouter(prefix="/education")
@router.get("") → list by employee_id
@router.post("") → create
@router.patch("/{id}") → update
@router.delete("/{id}") → delete
```

### Frontend pattern (semua tab multi-baris mengikuti ini):
```tsx
// State: rows, loading, editId, showAdd, form, saving, err
// Functions: load(), openEdit(), openAdd(), cancel(), save(), remove()
// FormRow() inline di dalam tabel (bukan modal terpisah)
// useEffect(() => { load(); }, [employeeId])
```

### File delivery ke user:
- Semua file dikirim via present_files
- User download → Copy-Item ke folder tujuan
- PowerShell 5.1: JANGAN gunakan `&&`, tulis per baris
- Git selalu dari root HRIS: `cd C:\Users\angsm\OneDrive\Documents\HRIS`

### Routing frontend (App.tsx):
- Single-page app dengan custom router (bukan React Router)
- Route disimpan sebagai string state: `"karyawan.data"`, `"kehadiran.absensi"`, dll.
- Tambah route baru: (1) import page, (2) tambah `{route === "xxx" && <Page />}`, (3) tambah submenu di Sidebar

### Migrasi database:
- Selalu idempotent (cek `PRAGMA table_info` dulu)
- Jalankan: `python -m app.migrate_xxx`
- Tidak pakai Alembic — custom migration scripts

---

## CATATAN TEKNIS PENTING

1. **Photo serve**: endpoint `/api/photos/{id}` di `photo_serve.py` (router terpisah, tanpa global auth). Upload tetap di `/api/employees/{id}/photo` (dengan Authorization header).

2. **Document preview/download**: endpoint di `documents.py` menggunakan `verify_token_param` (token via query param `?token=`). Router documents tidak pakai global `login_required`.

3. **PHOTO_DIR di employees.py**: pakai `dirname x4` karena file ada di `app/api/routes/employees.py` (4 level dalam dari root backend).

4. **DataKaryawanPage.tsx** adalah file terbesar (~1250+ baris) — berisi semua komponen profil, 12 tab, semua fungsi CRUD multi-baris. Hati-hati saat edit, selalu cek brace balance.

5. **api.ts** adalah single file untuk semua API calls — ~500+ baris. Semua fungsi export dari sini.

6. **Token** di `api.ts` disimpan sebagai module-level variable `authToken` (bukan hanya localStorage) supaya tersedia untuk `photoUrl()` dan `docPreviewUrl()` yang butuh token sync.

7. **ContractType enum**: Tetap/Kontrak/Magang/Outsourcing (Probasi ada di DB untuk backward compat tapi tidak ditampilkan di form).

8. **Sidebar role filter**: module dengan `roles: []` = Super Admin only. `roles: ["Super Admin", "Direksi", ...]` = semua role yang disebutkan.

9. **SQLite WAL mode** belum diaktifkan — kalau ada concurrent access issue, tambahkan di `database.py`.

---

## SARAN UNTUK CLAUDE CODE

1. **Baca file sebelum edit** — selalu `cat` atau `read` file target dulu, jangan asumsi isinya.

2. **Jangan kirim file penuh** kalau perubahan kecil — gunakan search/replace atau diff patch. `DataKaryawanPage.tsx` sangat besar, kirim ulang penuh setiap kali akan boros token.

3. **Test compile sebelum kirim** — untuk Python: `python3 -m py_compile file.py`. Untuk TypeScript: cek brace balance minimal.

4. **Pola iteratif** yang terbukti berhasil:
   - Backend dulu (model + schema + router)
   - Test endpoint di `localhost:8000/api/docs`
   - Baru frontend (API function → komponen → wire ke App/Sidebar)
   - Satu fitur = satu commit

5. **Jangan gabungkan terlalu banyak perubahan** dalam satu langkah — user non-programmer, butuh verifikasi step by step.

6. **PowerShell 5.1 gotchas**:
   - `&&` tidak supported → tulis terpisah
   - Heredoc pakai `@'...'@` atau `-Value` approach
   - Path separator `\` bukan `/`

7. **Foto & Dokumen** — dua hal yang sering bermasalah karena auth. Ingat: `<img src>` dan `<a href>` tidak kirim header, jadi gunakan `?token=` query param untuk endpoint-endpoint ini.

8. **Saat ada error "Belum login"** di endpoint yang seharusnya publik — cek apakah router terdaftar dengan `dependencies=login_required` di `main.py`.

9. **Setiap modul baru** butuh:
   - `from app.xxx import router as xxx_router` di `main.py`
   - `app.include_router(xxx_router, prefix=settings.API_PREFIX, dependencies=login_required)`
   - Tabel otomatis terbuat saat restart (SQLAlchemy `create_all`)

10. **Backup database** sebelum perubahan besar: `hris.db` tidak di-git, harus backup manual.

---

## SEED DATA (untuk testing)
Karyawan: Anggi Kurnianto (SMS-001/HRD), Desy (SMS-002/HRD), Efri Utoro (SMS-005), IhsanYullianta (EMP-004), Pak Be (EMP-001), Pak Bonard/Direktur Utama (340290934), Vinny V/Finance (EMP-005)

---

*Dokumen ini dibuat pada 13 Juni 2026. Selalu cek git log untuk perubahan terbaru.*
