# PROPOSAL APLIKASI
# Solusi Group HRIS — Enterprise AI Platform
## Sistem Manajemen SDM Berbasis Kecerdasan Buatan

---

## 1. LATAR BELAKANG & TUJUAN

Solusi Group HRIS adalah platform manajemen sumber daya manusia enterprise yang menggabungkan workflow HR konvensional dengan kecerdasan buatan (Claude AI). Sistem ini dirancang untuk technology holding company yang mengelola banyak perusahaan, divisi, dan tim teknis sekaligus.

**Tujuan utama:**
- Mengelola seluruh siklus karyawan dari rekrutmen hingga offboarding
- Memantau KPI, performa, dan kesehatan tim secara real-time
- Mengintegrasikan AI untuk analisis prediktif workforce
- Menyediakan dashboard berbeda per role (CEO, HR, NOC, Developer)
- Mengelola dokumen, kontrak, surat menyurat, dan proyek dalam satu platform

---

## 2. STATUS PENGEMBANGAN SAAT INI

### Yang Sudah Selesai (Frontend)
Prototype frontend telah dibuat dan berjalan di `http://localhost:3000` menggunakan Next.js 15.

**Teknologi yang sudah digunakan:**
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Recharts (grafik)
- Lucide React (ikon)

**Halaman yang sudah ada:**
1. **Workspace** — dashboard utama dengan proyek, MOM, aktivitas, jadwal, target marketing, KPI divisi
2. **KPI & Performa** — tabel KPI individual, divisi, trend chart, top performers, burnout risk
3. **AI Analysis** — insights otomatis, profil 6 dimensi karyawan, prediksi, screening kandidat
4. **Data Karyawan** — tabel lengkap dengan filter, badge status, KPI bar, AI risk

**Komponen UI yang sudah dibuat:**
- `StatCard` — kartu statistik dengan border warna per kategori
- `Card` + `CardHeader` — container reusable
- `Badge` — status badge dengan auto-color
- `Avatar` — avatar initials
- `ProgressBar` — progress bar animasi

**Struktur file:**
```
hris-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── layout/
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── PageTabs.tsx
│   │   ├── pages/
│   │   │   ├── WorkspacePage.tsx
│   │   │   ├── KPIPage.tsx
│   │   │   ├── AnalysisPage.tsx
│   │   │   └── KaryawanPage.tsx
│   │   └── ui/
│   │       ├── StatCard.tsx
│   │       ├── Card.tsx
│   │       ├── Badge.tsx
│   │       ├── Avatar.tsx
│   │       └── ProgressBar.tsx
│   ├── lib/
│   │   ├── data.ts       ← mock data, nanti diganti API calls
│   │   └── utils.ts      ← helper: kpiColor, statusConfig, dll
│   └── types/
│       └── index.ts      ← TypeScript types semua entitas
```

---

## 3. DESAIN & UI/UX

### Referensi Aplikasi
- **Workday** — enterprise dashboard, talent management
- **SAP SuccessFactors** — struktur HR enterprise, KPI
- **BambooHR** — employee profile, onboarding
- **Accurate Online** — layout widget dashboard (referensi utama)
- **Linear** — clean UI, minimal, fast
- **Jira / ClickUp** — sprint & project management
- **Zabbix** — monitoring dashboard (NOC)

### Sistem Warna
```
Primary:   #2563eb (Blue)       → aksi utama, brand
Secondary: #0891b2 (Cyan)       → aksen, gradient
Success:   #16a34a (Green)      → status aktif, KPI tinggi
Warning:   #d97706 (Amber)      → perhatian, KPI medium
Danger:    #dc2626 (Red)        → error, KPI rendah, burnout
Purple:    #7c3aed (Violet)     → AI features, premium
```

### Layout Utama
```
[Sidebar 44px] [Main Content]
                 ├── Topbar (46px)
                 ├── PageTabs
                 └── Page Content (scrollable)
```

### Struktur Navigasi (Tab)
1. Workspace
2. KPI & Performa
3. AI Analysis
4. Data Karyawan
5. *(Rekrutmen — hidden, siap diaktifkan)*

---

## 4. FITUR LENGKAP (RENCANA)

### 4.1 Dashboard & Workspace
- [x] Stat cards (karyawan, proyek, surat, marketing, meeting)
- [x] Tabel proyek aktif dengan progress & status
- [x] Minutes of Meeting (MOM) terbaru
- [x] Record aktivitas real-time (surat, kontrak, marketing, proyek)
- [x] Jadwal harian
- [x] Target marketing dengan progress per metrik
- [x] KPI per divisi
- [x] Kegiatan mendatang & deadline alert
- [ ] Dashboard CEO view
- [ ] Dashboard HR view
- [ ] Dashboard NOC view
- [ ] Dashboard Developer view

### 4.2 Manajemen Karyawan
- [x] Tabel karyawan dengan filter divisi/status
- [x] Badge status (Aktif, Cuti, Probasi)
- [x] Tipe kontrak (Tetap, Kontrak, Probasi)
- [x] KPI bar per karyawan
- [x] AI Risk indicator (Low, Medium, High)
- [x] Import / Export (UI sudah ada)
- [x] Pagination
- [ ] Modal detail karyawan
- [ ] Form tambah/edit karyawan
- [ ] Upload foto karyawan
- [ ] Riwayat jabatan & promosi
- [ ] Skill matrix
- [ ] Dokumen karyawan (KTP, kontrak, ijazah)
- [ ] Timeline karyawan

### 4.3 KPI & Performa
- [x] Tabel KPI individual dengan score, target, delta
- [x] Status Excellent / Good / Below / Poor
- [x] Flag "Perlu Coaching"
- [x] KPI per divisi dengan bar chart
- [x] Trend KPI 6 bulan (line chart)
- [x] Top 3 Performers
- [x] Burnout risk dengan AI scoring
- [x] Target KPI Q2 per divisi
- [ ] Form input KPI
- [ ] Review cycle management
- [ ] Notifikasi deadline review
- [ ] Ekspor laporan KPI ke PDF/Excel

### 4.4 AI Analysis 
- [ ] AI Workforce Insights (rekomendasi otomatis)
- [ ] Profil 6 dimensi karyawan (Leadership, Communication, Discipline, Teamwork, Learning Speed, Burnout Risk)
- [ ] Prediksi turnover, rekrutmen, burnout
- [ ] AI Screening Pipeline kandidat
- [ ] Koneksi real ke Claude API
- [ ] Analisis komunikasi email/slack
- [ ] Coaching assistant AI
- [ ] Personality analysis dari data historis
- [ ] Rekomendasi training

### 4.5 Rekrutmen (UI sudah ada, belum aktif)
- Pipeline: Request → Vacancy → Screening → Interview → Offer → Hired
- Tabel lowongan aktif
- Tracking kandidat per posisi
- AI screening score kandidat
- Time-to-hire analytics

### 4.6 Kehadiran & Absensi
- [ ] Check-in / Check-out
- [ ] Kalender kehadiran
- [ ] Manajemen shift
- [ ] Pengajuan & approval cuti
- [ ] Rekap lembur
- [ ] Integrasi payroll

### 4.7 Payroll
- [ ] Struktur gaji per karyawan
- [ ] Kalkulasi tunjangan & potongan
- [ ] Slip gaji digital
- [ ] Approval flow payroll
- [ ] Laporan biaya payroll per divisi

### 4.8 Proyek & Tugas
- [x] Tabel proyek aktif
- [x] Progress tracking
- [x] Status & PIC
- [ ] Detail proyek (milestones, tasks)
- [ ] Sprint management (Jira-style)
- [ ] Workload monitoring per anggota
- [ ] Integrasi dengan tiket

### 4.9 Dokumen & Surat
- [x] Record aktivitas surat keluar
- [x] Record kontrak
- [ ] Form buat surat keluar
- [ ] Template surat (penawaran, undangan, SP)
- [ ] Nomor surat otomatis
- [ ] Digital signature
- [ ] Manajemen kontrak (upload, notifikasi habis)
- [ ] Ekspor PDF

### 4.10 Meeting & MOM
- [x] Daftar MOM terbaru
- [x] Status Draft / Final
- [x] Poin keputusan
- [ ] Form buat MOM
- [ ] Peserta meeting
- [ ] Action items & PIC
- [ ] Notifikasi follow-up
- [ ] Lampiran meeting

### 4.11 Tiket & Helpdesk
- [ ] Form buat tiket
- [ ] Kategori (IT, HR, Finance, dll)
- [ ] Priority & SLA
- [ ] Assignment & eskalasi
- [ ] Status tracking
- [ ] Integrasi NOC monitoring

### 4.12 Laporan
- [ ] Laporan KPI bulanan
- [ ] Laporan kehadiran
- [ ] Laporan rekrutmen
- [ ] Laporan payroll
- [ ] Ekspor Excel
- [ ] Ekspor PDF
- [ ] Scheduled report via email

### 4.13 Multi Company 
- [ ] Pilih company/anak usaha dari topbar
- [ ] Data ter-isolasi per entity
- [ ] Cross-company reporting untuk holding
- [ ] Role permission per company

### 4.14 Notifikasi & Alert
- [ ] Notifikasi in-app (By WA dan Email)
- [ ] Alert burnout risk
- [ ] Alert kontrak hampir habis
- [ ] Alert KPI di bawah target
- [ ] Reminder deadline review 
- [ ] Email notification

---

## 5. ARSITEKTUR TEKNIS

```
┌─────────────────────────────────────────────┐
│              FRONTEND (Next.js 15)           │
│  - App Router + TypeScript + Tailwind CSS   │
│  - Recharts + Lucide React                  │
│  - Deploy: Vercel / Nginx                   │
└─────────────────┬───────────────────────────┘
                  │ REST API / WebSocket
┌─────────────────▼───────────────────────────┐
│              BACKEND (FastAPI)               │
│  - Python 3.11+                             │
│  - SQLAlchemy ORM                           │
│  - Pydantic v2                              │
│  - JWT Authentication                       │
│  - Deploy: Docker + Nginx                   │
└──────┬──────────┬──────────┬────────────────┘
       │          │          │
┌──────▼──┐ ┌────▼────┐ ┌───▼──────────────┐
│PostgreSQL│ │  Redis  │ │   Claude API      │
│ (data)  │ │(cache,  │ │ (AI features)     │
│         │ │realtime)│ │                   │
└─────────┘ └─────────┘ └───────────────────┘
                                │
┌───────────────────────────────▼────────────┐
│           Cloudflare R2 (Storage)           │
│  - Foto karyawan                           │
│  - Dokumen / kontrak                       │
│  - Lampiran MOM                            │
└────────────────────────────────────────────┘
```

### Deployment
```
VPS (Ubuntu 24.04)
├── Docker Compose
│   ├── frontend (Next.js)   → port 3000
│   ├── backend (FastAPI)    → port 8000
│   ├── postgres             → port 5432
│   └── redis                → port 6379
└── Nginx (reverse proxy)    → port 80/443
```

---

## 6. DATABASE SCHEMA (Rencana)

### Tabel Utama
```sql
companies          -- perusahaan/entitas
branches           -- cabang per perusahaan
departments        -- divisi
positions          -- jabatan
employees          -- karyawan
employee_contracts -- kontrak karyawan
employee_documents -- dokumen karyawan

attendance         -- kehadiran
leave_requests     -- pengajuan cuti
shifts             -- shift kerja

kpi_periods        -- periode penilaian KPI
kpi_targets        -- target KPI per karyawan
kpi_scores         -- nilai KPI aktual

projects           -- proyek
project_members    -- anggota proyek
tasks              -- tugas dalam proyek

meetings           -- rapat
meeting_participants
mom_items          -- poin keputusan MOM
action_items       -- tindak lanjut

letters            -- surat keluar
contracts          -- kontrak dokumen
activities         -- log aktivitas

recruitment_jobs   -- lowongan
candidates         -- kandidat
recruitment_stages -- stage pipeline

tickets            -- tiket helpdesk
payroll_periods    -- periode payroll
payroll_items      -- rincian gaji

users              -- akun login
roles              -- role (CEO, HR, Manager, dll)
permissions        -- hak akses per modul
```

---

## 7. ROLE & PERMISSION

| Role | Akses |
|------|-------|
| Super Admin | Semua fitur, semua company |
| CEO | Dashboard CEO, laporan, analytics |
| HR Manager | Semua modul HR |
| HR Staff | Karyawan, kehadiran, rekrutmen |
| Manager | Dashboard divisi, KPI tim, proyek |
| Employee | Self-service (data diri, cuti, slip gaji) |
| NOC Engineer | Dashboard NOC, tiket |
| Developer | Sprint, tugas, proyek |
| Finance | Payroll, laporan keuangan |

---

## 8. RENCANA PENGEMBANGAN (MVP)

### Version 1 — MVP (Prioritas Sekarang)
- [ ] Backend FastAPI setup + PostgreSQL
- [ ] Authentication (login, JWT, role)
- [ ] API CRUD karyawan
- [ ] Sambungkan frontend ke API (hapus mock data)
- [ ] Form tambah/edit karyawan
- [ ] Modal detail karyawan
- [ ] Deploy ke VPS dengan Docker

### Version 2
- [ ] Modul KPI (input, review, approval)
- [ ] Modul kehadiran & cuti
- [ ] Rekrutmen pipeline aktif
- [ ] Notifikasi in-app
- [ ] Integrasi Claude API untuk AI features

### Version 3
- [ ] Payroll
- [ ] Manajemen surat & kontrak dengan PDF
- [ ] Tiket & helpdesk
- [ ] Multi company support
- [ ] Mobile responsive / PWA

### Version 4
- [ ] Mobile app (React Native / Flutter)
- [ ] Advanced AI forecasting
- [ ] Integrasi ERP
- [ ] Enterprise SSO
- [ ] Audit log lengkap

---

## 9. CARA MENJALANKAN (SAAT INI)

### Prasyarat
- Node.js v18+
- npm atau yarn

### Jalankan Frontend
```bash
unzip hris-nextjs-project.zip
cd hris-app
npm install
npm run dev
# Buka http://localhost:3000
```

### Edit Komponen
- Buka dengan VS Code: `code .`
- Setiap save otomatis hot-reload di browser
- Halaman ada di: `src/components/pages/`
- Komponen UI ada di: `src/components/ui/`
- Data mock ada di: `src/lib/data.ts`
- Warna & helper: `src/lib/utils.ts`

---

## 10. KONVENSI KODE

### Naming
- Komponen: PascalCase (`WorkspacePage.tsx`)
- Functions/variables: camelCase (`kpiColor`)
- Types: PascalCase (`Employee`, `KPIEntry`)
- File CSS class: kebab-case

### Struktur Komponen
```tsx
'use client'            // selalu di atas kalau pakai state/event
import { ... }          // imports
interface Props { ... } // TypeScript props
export default function NamaKomponen({ ... }: Props) {
  // state
  // handlers
  return (
    // JSX
  )
}
```

### Warna — Selalu pakai konstanta dari `utils.ts`
```tsx
import { kpiColor, kpiBg, statusConfig } from '@/lib/utils'
// Jangan hardcode warna langsung di komponen
```

---

## 11. PERTANYAAN & KEPUTUSAN YANG MASIH TERBUKA

1. **Nama sistem final** — Solusi Group Information System?
2. **Multi company** — berapa perusahaan yang dikelola? Solusi Group, Satata, PMIS, GAI, Yayasan
3. **Integrasi eksternal** — WA,Pdf,word,excel, bpjs, dan lain-lain pengembangan
4. ** Fitur AI pengembangan
5. **Mobile** — apakah perlu aplikasi mobile terpisah atau cukup responsive web?
6. **Bahasa** — full Indonesia 

---

*Dokumen ini adalah living proposal — diperbarui seiring pengembangan.*
*Dibuat: Juni 2026*
