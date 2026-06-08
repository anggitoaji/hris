// ============================================================
//  Tipe data aplikasi HRIS — Workspace Dashboard
//  Bagian "Dashboard data" dipakai kartu di halaman utama.
//  Bagian "Backend entities" cocok dengan API FastAPI yang sudah ada
//  (modul Karyawan & KPI di http://localhost:8000/api).
// ============================================================

// ---------- Dashboard data (saat ini mock) ----------
export type AccentKey = "green" | "amber" | "violet";

export interface Kpi {
  label: string;
  value: number;            // 0-100 (persen)
  change: number;           // selisih dari bulan lalu
  direction: "up" | "down";
  trend: number[];          // titik sparkline
  accent: AccentKey;
}

export interface Project {
  name: string;
  progress: number;         // 0-100
  status: "Berjalan" | "Selesai";
  deadline: string;
  color: string;
}

export interface Meeting {
  name: string;
  subtitle: string;
  date: string;
}

export interface MarketingItem {
  name: string;
  time: string;
  color: string;
}

export interface DonutItem {
  name: string;
  units: number;
  color: string;
  sub?: string;
}

export type WidgetKey =
  | "kpi" | "project" | "meeting" | "marketing"
  | "modemCustomer" | "modemStock" | "quickAction";

export type VisibilityState = Record<WidgetKey, boolean>;

// ---------- Backend entities (API yang sudah ada) ----------
export type EmployeeStatus = "Aktif" | "Cuti" | "Probasi";
export type ContractType = "Tetap" | "Kontrak" | "Probasi";
export type AiRisk = "Low" | "Medium" | "High";

export interface Employee {
  id: number;
  nik: string;
  nama: string;
  email: string | null;
  phone: string | null;
  department: string;
  position: string;
  status: EmployeeStatus;
  contract_type: ContractType;
  join_date: string | null;
  kpi_score: number;
  ai_risk: AiRisk;
  photo_url: string | null;

  // ---- Biodata lengkap (opsional / bisa null) ----
  ktp: string | null;
  gender: string | null;
  birth_place: string | null;
  birth_date: string | null;
  religion: string | null;
  marital_status: string | null;
  address: string | null;
  education: string | null;
  npwp: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bpjs_kesehatan: string | null;
  bpjs_ketenagakerjaan: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  emergency_relation: string | null;
  skills: string | null;
  job_desc: string | null;
}

export interface EmployeeListResponse {
  total: number;
  page: number;
  page_size: number;
  items: Employee[];
}

export interface KpiAspect {
  id: number;
  aspect: string;
  score: number;
  target: number;
}

export interface KpiAssessment {
  id: number;
  employee_id: number;
  period: string;
  needs_coaching: boolean;
  aspects: KpiAspect[];
  employee_nama: string | null;
  employee_department: string | null;
  overall_score: number;
  status: "Excellent" | "Good" | "Below" | "Poor";
}
