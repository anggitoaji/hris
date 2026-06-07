import type {
  Employee, EmployeeListResponse, KpiAssessment,
} from "../types";

// =====================================================================
//  API CLIENT untuk backend FastAPI.
//  Modul Karyawan & KPI sudah jalan.
// =====================================================================

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} gagal: ${res.status}`);
  return res.json() as Promise<T>;
}

async function sendJSON<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    // Coba ambil pesan detail dari backend (mis. NIK duplikat -> 409).
    let msg = `Gagal (${res.status})`;
    try {
      const j = await res.json();
      if (j?.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* abaikan */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

/** Daftar karyawan. */
export async function fetchEmployees(): Promise<Employee[]> {
  const data = await getJSON<EmployeeListResponse>("/employees?page_size=100");
  return data.items;
}

/** Tambah karyawan baru (POST). */
export async function createEmployee(data: Record<string, unknown>): Promise<Employee> {
  return sendJSON<Employee>("/employees", "POST", data);
}

/** Ubah data karyawan (PATCH, parsial). */
export async function updateEmployee(id: number, data: Record<string, unknown>): Promise<Employee> {
  return sendJSON<Employee>(`/employees/${id}`, "PATCH", data);
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
