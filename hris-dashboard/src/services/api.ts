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

async function sendJSON<T>(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
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
export async function createKpiAssessment(data: Record<string, unknown>): Promise<KpiAssessment> {
  return sendJSON<KpiAssessment>("/kpi/assessments", "POST", data);
}

export async function updateKpiAssessment(id: number, data: Record<string, unknown>): Promise<KpiAssessment> {
  return sendJSON<KpiAssessment>(`/kpi/assessments/${id}`, "PATCH", data);
}

export interface Division {
  id: number;
  name: string;
  description: string | null;
  head: string | null;
  is_active: boolean;
  employee_count: number;
}

export async function fetchDivisions(): Promise<Division[]> {
  return getJSON<Division[]>("/divisions");
}

export async function createDivision(data: Record<string, unknown>): Promise<Division> {
  return sendJSON<Division>("/divisions", "POST", data);
}

export async function updateDivision(id: number, data: Record<string, unknown>): Promise<Division> {
  return sendJSON<Division>(`/divisions/${id}`, "PATCH", data);
}

export async function deleteDivision(id: number): Promise<unknown> {
  return sendJSON<unknown>(`/divisions/${id}`, "DELETE");
}

export async function deleteEmployee(id: number): Promise<unknown> {
  return sendJSON<unknown>(`/employees/${id}`, "DELETE");
}

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


// ===================== Kehadiran & Absensi =====================
export interface Attendance {
  id: number;
  employee_id: number;
  date: string;            // "YYYY-MM-DD"
  status: string;
  check_in: string | null; // "HH:MM"
  check_out: string | null;
  note: string | null;
  employee_nama: string;
  employee_department: string | null;
}

export interface AttendanceSummary {
  date: string;
  total_karyawan: number;
  Hadir: number;
  Terlambat: number;
  WFH: number;
  Izin: number;
  Sakit: number;
  Cuti: number;
  Alpa: number;
  belum_dicatat: number;
}

export async function fetchAttendance(date?: string): Promise<Attendance[]> {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  return getJSON<Attendance[]>(`/attendance${q}`);
}

export async function fetchAttendanceSummary(date?: string): Promise<AttendanceSummary> {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  return getJSON<AttendanceSummary>(`/attendance/summary${q}`);
}

export async function createAttendance(data: Record<string, unknown>): Promise<Attendance> {
  return sendJSON<Attendance>("/attendance", "POST", data);
}

export async function updateAttendance(id: number, data: Record<string, unknown>): Promise<Attendance> {
  return sendJSON<Attendance>(`/attendance/${id}`, "PATCH", data);
}

export async function deleteAttendance(id: number): Promise<unknown> {
  return sendJSON<unknown>(`/attendance/${id}`, "DELETE");
}


// ===================== Payroll / Slip Gaji =====================
export interface PayslipItem {
  id?: number;
  kind: string;       // "earning" | "deduction"
  label: string;
  amount: number;
}

export interface Payslip {
  id: number;
  employee_id: number;
  period: string;     // "YYYY-MM"
  status: string;
  note: string | null;
  items: PayslipItem[];
  total_earning: number;
  total_deduction: number;
  net: number;
  employee_nama: string;
  employee_department: string | null;
}

export interface PayrollSummary {
  period: string;
  count: number;
  total_earning: number;
  total_deduction: number;
  total_net: number;
  avg_net: number;
}

export async function fetchPayslips(period?: string): Promise<Payslip[]> {
  const q = period ? `?period=${encodeURIComponent(period)}` : "";
  return getJSON<Payslip[]>(`/payroll/payslips${q}`);
}

export async function fetchPayrollSummary(period?: string): Promise<PayrollSummary> {
  const q = period ? `?period=${encodeURIComponent(period)}` : "";
  return getJSON<PayrollSummary>(`/payroll/summary${q}`);
}

export async function createPayslip(data: Record<string, unknown>): Promise<Payslip> {
  return sendJSON<Payslip>("/payroll/payslips", "POST", data);
}

export async function updatePayslip(id: number, data: Record<string, unknown>): Promise<Payslip> {
  return sendJSON<Payslip>(`/payroll/payslips/${id}`, "PATCH", data);
}

export async function deletePayslip(id: number): Promise<unknown> {
  return sendJSON<unknown>(`/payroll/payslips/${id}`, "DELETE");
}

export async function fetchSalaryTemplate(employeeId: number): Promise<PayslipItem[]> {
  return getJSON<PayslipItem[]>(`/payroll/template/${employeeId}`);
}

export async function saveSalaryTemplate(employeeId: number, items: PayslipItem[]): Promise<PayslipItem[]> {
  return sendJSON<PayslipItem[]>(`/payroll/template/${employeeId}`, "PUT", { items });
}
