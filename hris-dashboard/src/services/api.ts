import type {
  Employee, EmployeeListResponse, KpiAssessment,
} from "../types";

// =====================================================================
//  API CLIENT untuk backend FastAPI.
//  Modul Karyawan & KPI sudah jalan.
// =====================================================================

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

// ===== Token login (disimpan di localStorage) =====
const TOKEN_KEY = "hris_token";
let authToken: string | null = (typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(t: string | null) {
  authToken = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* abaikan */ }
}
export function getAuthToken(): string | null { return authToken; }
export function setOnUnauthorized(cb: () => void) { onUnauthorized = cb; }

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...(extra ?? {}) };
  if (authToken) h["Authorization"] = `Bearer ${authToken}`;
  return h;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (res.status === 401) { onUnauthorized?.(); throw new Error("Sesi berakhir. Silakan login lagi."); }
  if (!res.ok) throw new Error(`API ${path} gagal: ${res.status}`);
  return res.json() as Promise<T>;
}

async function sendJSON<T>(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) { onUnauthorized?.(); throw new Error("Sesi berakhir. Silakan login lagi."); }
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


// ===================== Meeting / MoM =====================
export interface ActionItem {
  id: number;
  task: string;
  assignee: string | null;
  due_date: string | null;
  done: boolean;
}

export interface ActionItemFlat extends ActionItem {
  meeting_id: number;
  meeting_title: string;
  meeting_date: string | null;
  meeting_category: string;
}

export interface Meeting {
  id: number;
  title: string;
  category: string;
  date: string;
  time: string | null;
  location: string | null;
  organizer: string | null;
  participants: string | null;
  agenda: string | null;
  notes: string | null;
  status: string;
  action_items: ActionItem[];
  open_actions: number;
}

export interface MeetingSummary {
  total: number;
  terjadwal: number;
  selesai: number;
  open_actions: number;
}

export async function fetchMeetings(category?: string, status?: string): Promise<Meeting[]> {
  const p = new URLSearchParams();
  if (category) p.set("category", category);
  if (status) p.set("status", status);
  const qs = p.toString() ? `?${p.toString()}` : "";
  return getJSON<Meeting[]>(`/meetings${qs}`);
}

export async function fetchMeetingSummary(): Promise<MeetingSummary> {
  return getJSON<MeetingSummary>("/meetings/summary");
}

export async function createMeeting(data: Record<string, unknown>): Promise<Meeting> {
  return sendJSON<Meeting>("/meetings", "POST", data);
}

export async function updateMeeting(id: number, data: Record<string, unknown>): Promise<Meeting> {
  return sendJSON<Meeting>(`/meetings/${id}`, "PATCH", data);
}

export async function deleteMeeting(id: number): Promise<unknown> {
  return sendJSON<unknown>(`/meetings/${id}`, "DELETE");
}

export async function fetchActionItems(done?: boolean): Promise<ActionItemFlat[]> {
  const qs = done === undefined ? "" : `?done=${done}`;
  return getJSON<ActionItemFlat[]>(`/meetings/action-items${qs}`);
}

export async function patchActionItem(id: number, data: Record<string, unknown>): Promise<ActionItem> {
  return sendJSON<ActionItem>(`/meetings/action-items/${id}`, "PATCH", data);
}


/** Daftar periode KPI yang tersedia (untuk dropdown). */
export async function fetchKpiPeriods(): Promise<string[]> {
  return getJSON<string[]>("/kpi/periods");
}


// ===================== Auth / User =====================
export interface AuthUser {
  id: number;
  username: string;
  role: string;
  employee_id: number | null;
  employee_nama: string | null;
  is_active: boolean;
}
export interface LoginResult { token: string; user: AuthUser; }

export async function login(username: string, password: string): Promise<LoginResult> {
  return sendJSON<LoginResult>("/auth/login", "POST", { username, password });
}
export async function fetchMe(): Promise<AuthUser> {
  return getJSON<AuthUser>("/auth/me");
}
export async function changePassword(old_password: string, new_password: string): Promise<unknown> {
  return sendJSON<unknown>("/auth/change-password", "POST", { old_password, new_password });
}
export async function fetchRoles(): Promise<string[]> {
  return getJSON<string[]>("/auth/roles");
}
export async function fetchUsers(): Promise<AuthUser[]> {
  return getJSON<AuthUser[]>("/auth/users");
}
export async function createUser(data: Record<string, unknown>): Promise<AuthUser> {
  return sendJSON<AuthUser>("/auth/users", "POST", data);
}
export async function updateUser(id: number, data: Record<string, unknown>): Promise<AuthUser> {
  return sendJSON<AuthUser>(`/auth/users/${id}`, "PATCH", data);
}
export async function deleteUser(id: number): Promise<unknown> {
  return sendJSON<unknown>(`/auth/users/${id}`, "DELETE");
}

// ===================== Riwayat Pendidikan =====================
export interface EducationRecord {
  id: number;
  employee_id: number;
  jenjang: string;
  institusi: string;
  jurusan: string | null;
  ipk: number | null;
  tahun_masuk: number | null;
  tahun_lulus: number | null;
  sort: number;
}
export async function fetchEducation(employee_id: number): Promise<EducationRecord[]> {
  return getJSON<EducationRecord[]>(`/education?employee_id=${employee_id}`);
}
export async function createEducation(data: Record<string, unknown>): Promise<EducationRecord> {
  return sendJSON<EducationRecord>("/education", "POST", data);
}
export async function updateEducation(id: number, data: Record<string, unknown>): Promise<EducationRecord> {
  return sendJSON<EducationRecord>(`/education/${id}`, "PATCH", data);
}
export async function deleteEducation(id: number): Promise<unknown> {
  return sendJSON<unknown>(`/education/${id}`, "DELETE");
}

