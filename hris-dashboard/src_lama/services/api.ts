import type {
  Employee, EmployeeListResponse, KpiAssessment,
} from "../types";

// =====================================================================
//  API CLIENT untuk backend FastAPI yang SUDAH ADA.
//  Modul Karyawan & KPI sudah jalan; fungsi di bawah siap dipakai
//  untuk menggantikan mock data di komponen.
//
//  Cara pakai di komponen (contoh):
//    const emps = await fetchEmployees();
//
//  Modul yang BELUM ada backend (Project, Meeting, Marketing, Modem)
//  tinggal ditambahkan di sini begitu endpoint-nya dibuat.
// =====================================================================

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} gagal: ${res.status}`);
  return res.json() as Promise<T>;
}

/** Daftar karyawan (modul Karyawan — sudah ada). */
export async function fetchEmployees(): Promise<Employee[]> {
  const data = await getJSON<EmployeeListResponse>("/employees?page_size=100");
  return data.items;
}

/** Penilaian KPI (modul KPI — sudah ada). */
export async function fetchKpiAssessments(period?: string): Promise<KpiAssessment[]> {
  const q = period ? `?period=${encodeURIComponent(period)}` : "";
  const data = await getJSON<{ total: number; items: KpiAssessment[] }>(`/kpi/assessments${q}`);
  return data.items;
}

/** Ringkasan KPI per divisi + top performer (modul KPI — sudah ada). */
export async function fetchKpiSummary(period?: string): Promise<{
  count: number;
  by_division: { department: string; avg: number; count: number }[];
  top_performers: { nama: string; department: string; score: number }[];
}> {
  const q = period ? `?period=${encodeURIComponent(period)}` : "";
  return getJSON(`/kpi/summary${q}`);
}

// TODO (developer): tambahkan saat backend-nya siap:
// export async function fetchProjects() {...}
// export async function fetchMeetings() {...}
// export async function fetchMarketingActivities() {...}
// export async function fetchModemCustomers() {...}
// export async function fetchModemStock() {...}
