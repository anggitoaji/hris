# Solusi Group HRIS — Workspace Dashboard (React)

Halaman utama (Workspace Dashboard) aplikasi HRIS, dibangun dengan
**React + TypeScript + Vite + Tailwind**, arsitektur berbasis komponen.

Ini adalah versi React untuk dikerjakan/diteruskan developer. Backend
FastAPI yang sudah ada (modul **Karyawan** & **KPI**) berjalan terpisah
di `http://localhost:8000`.

## Menjalankan

```bash
npm install
npm run dev
```

Buka alamat yang ditampilkan (default http://localhost:5173).

Build untuk produksi:

```bash
npm run build      # cek TypeScript + bundling
npm run preview    # pratinjau hasil build
```

## Struktur

```
src/
├── App.tsx                  # komposisi layout + state "Atur Widget"
├── main.tsx
├── index.css
├── types/index.ts           # semua tipe data (termasuk entitas backend)
├── data/mock.ts             # MOCK DATA kartu dashboard
├── services/api.ts          # API client ke FastAPI (Karyawan & KPI siap pakai)
└── components/
    ├── Sidebar.tsx          # menu ikon + tooltip (daftar modul terpusat)
    ├── Header.tsx
    ├── WidgetToggle.tsx      # tombol "Atur Widget" + panel on/off
    ├── ui/                   # Card, Sparkline, Donut
    └── sections/
        ├── KPISection.tsx
        ├── ProjectSection.tsx
        ├── MeetingSection.tsx
        ├── MarketingActivitySection.tsx
        ├── ModemCustomerSection.tsx
        ├── ModemStockSection.tsx
        └── QuickActionSection.tsx
```

## Menyambungkan ke backend (catatan untuk developer)

- `src/services/api.ts` sudah berisi fungsi siap pakai untuk endpoint yang
  **sudah ada**: `fetchEmployees()`, `fetchKpiAssessments()`, `fetchKpiSummary()`.
- Komponen saat ini membaca dari `src/data/mock.ts`. Untuk data nyata,
  ganti sumbernya dengan pemanggilan dari `services/api.ts`
  (mis. di `useEffect` + `useState`).
- Alamat backend diatur lewat `VITE_API_BASE` (lihat `.env.example`),
  default `http://localhost:8000/api`.
- Modul yang belum punya backend (Project, Meeting, Marketing, Modem)
  masih memakai mock; tambahkan endpoint-nya di `services/api.ts` saat siap.

## Mengubah / menambah modul

- **Menu sidebar**: edit daftar `NAV` di `components/Sidebar.tsx`
  (ganti ikon dari lucide-react atau tambah baris baru).
- **Widget dashboard**: daftar `WIDGET_DEFS` di `components/WidgetToggle.tsx`
  dan urutan grid (`GRID_ORDER`) + peta `NODES` di `App.tsx`.

## Catatan

- Kontrol "Atur Widget" saat ini disimpan di memori (reset saat refresh).
  Untuk permanen per user/role, sambungkan ke API pengaturan backend.
- Ikon memakai lucide-react sebagai placeholder; ikon final tinggal diganti
  tanpa mengubah struktur.
