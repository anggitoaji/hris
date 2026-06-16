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
      if (typeof j?.detail === "string") {
        msg = j.detail;
      } else if (Array.isArray(j?.detail)) {
        // Error validasi FastAPI/Pydantic: ringkas jadi pesan yang mudah dibaca.
        msg = j.detail
          .map((d: { loc?: unknown[]; msg?: string }) => {
            const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "";
            return field ? `${field}: ${d.msg}` : d.msg;
          })
          .join("; ");
      }
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

export async function updateKpiAssessmentStatus(id: number, status: string): Promise<KpiAssessment> {
  return sendJSON<KpiAssessment>(`/kpi/assessments/${id}/status`, "PATCH", { status });
}

export async function fetchKpiAssessment(id: number): Promise<KpiAssessment> {
  return getJSON<KpiAssessment>(`/kpi/assessments/${id}`);
}

export async function deleteKpiAssessment(id: number): Promise<unknown> {
  return sendJSON(`/kpi/assessments/${id}`, "DELETE");
}

/** People Management Compliance (modul People Management). */
export interface ComplianceRow {
  atasan_id: number;
  atasan_nama: string;
  atasan_role_hint: string;
  total_bawahan: number;
  selesai: number;
  compliance_pct: number;
  compliant: boolean;
}
export async function fetchKpiCompliance(period: string): Promise<ComplianceRow[]> {
  return getJSON(`/kpi/periods/${encodeURIComponent(period)}/compliance`);
}
export interface KpiPeriodMeta {
  period: string;
  deadline: string | null;
  closed: boolean;
  closed_at: string | null;
  closed_by: string | null;
}
export async function fetchKpiPeriodMeta(period: string): Promise<KpiPeriodMeta> {
  return getJSON(`/kpi/periods/${encodeURIComponent(period)}/meta`);
}
export async function setKpiPeriodDeadline(period: string, deadline: string | null): Promise<KpiPeriodMeta> {
  return sendJSON(`/kpi/periods/${encodeURIComponent(period)}/deadline`, "PATCH", { deadline });
}
export async function closeKpiPeriod(period: string): Promise<{ period: string; non_compliant_count: number; non_compliant_names: string[] }> {
  return sendJSON(`/kpi/periods/${encodeURIComponent(period)}/close`, "POST");
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

export async function fetchKpiAssessments(period?: string, employeeId?: number): Promise<KpiAssessment[]> {
  const params = new URLSearchParams();
  if (period) params.set("period", period);
  if (employeeId) params.set("employee_id", String(employeeId));
  const q = params.toString() ? `?${params.toString()}` : "";
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

// ===================== Sertifikasi =====================
export interface CertificationRecord {
  id: number;
  employee_id: number;
  nama: string;
  nomor: string | null;
  penerbit: string | null;
  tanggal_terbit: string | null;
  tanggal_kadaluarsa: string | null;
  sort: number;
}
export async function fetchCertifications(employee_id: number): Promise<CertificationRecord[]> {
  return getJSON<CertificationRecord[]>(`/certifications?employee_id=${employee_id}`);
}
export async function createCertification(data: Record<string, unknown>): Promise<CertificationRecord> {
  return sendJSON<CertificationRecord>("/certifications", "POST", data);
}
export async function updateCertification(id: number, data: Record<string, unknown>): Promise<CertificationRecord> {
  return sendJSON<CertificationRecord>(`/certifications/${id}`, "PATCH", data);
}
export async function deleteCertification(id: number): Promise<unknown> {
  return sendJSON<unknown>(`/certifications/${id}`, "DELETE");
}

// ===================== Riwayat Jabatan =====================
export interface JobHistoryRecord {
  id: number; employee_id: number;
  jabatan_lama: string | null; jabatan_baru: string | null;
  divisi_lama: string | null; divisi_baru: string | null;
  tanggal_efektif: string | null; alasan: string | null; sort: number;
}
export async function fetchJobHistory(eid: number): Promise<JobHistoryRecord[]> { return getJSON(`/job-history?employee_id=${eid}`); }
export async function createJobHistory(d: Record<string, unknown>): Promise<JobHistoryRecord> { return sendJSON("/job-history", "POST", d); }
export async function updateJobHistory(id: number, d: Record<string, unknown>): Promise<JobHistoryRecord> { return sendJSON(`/job-history/${id}`, "PATCH", d); }
export async function deleteJobHistory(id: number): Promise<unknown> { return sendJSON(`/job-history/${id}`, "DELETE"); }

// ===================== Keluarga =====================
export interface FamilyRecord {
  id: number; employee_id: number;
  hubungan: string; nama: string; jenis_kelamin: string | null;
  tempat_lahir: string | null; tanggal_lahir: string | null;
  pendidikan: string | null; no_hp: string | null; sort: number;
}
export async function fetchFamily(eid: number): Promise<FamilyRecord[]> { return getJSON(`/family?employee_id=${eid}`); }
export async function createFamily(d: Record<string, unknown>): Promise<FamilyRecord> { return sendJSON("/family", "POST", d); }
export async function updateFamily(id: number, d: Record<string, unknown>): Promise<FamilyRecord> { return sendJSON(`/family/${id}`, "PATCH", d); }
export async function deleteFamily(id: number): Promise<unknown> { return sendJSON(`/family/${id}`, "DELETE"); }

// ===================== Training =====================
export interface TrainingRecord {
  id: number; employee_id: number;
  nama: string; penyelenggara: string | null;
  tanggal: string | null; nilai: number | null; sort: number;
}
export async function fetchTraining(eid: number): Promise<TrainingRecord[]> { return getJSON(`/training?employee_id=${eid}`); }
export async function createTraining(d: Record<string, unknown>): Promise<TrainingRecord> { return sendJSON("/training", "POST", d); }
export async function updateTraining(id: number, d: Record<string, unknown>): Promise<TrainingRecord> { return sendJSON(`/training/${id}`, "PATCH", d); }
export async function deleteTraining(id: number): Promise<unknown> { return sendJSON(`/training/${id}`, "DELETE"); }

// ===================== Dokumen Karyawan =====================
export interface DocumentRecord {
  id: number;
  employee_id: number;
  category: string;
  sub_category: string | null;
  filename_original: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}
export const DOC_CATEGORIES = ["Identitas", "Pendidikan", "Kepegawaian", "Sertifikasi", "Kesehatan", "Lainnya"];
export async function fetchDocuments(eid: number): Promise<DocumentRecord[]> { return getJSON(`/documents?employee_id=${eid}`); }
export async function uploadDocument(file: File, employee_id: number, category: string, sub_category: string): Promise<DocumentRecord> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("employee_id", String(employee_id));
  fd.append("category", category);
  fd.append("sub_category", sub_category);
  const res = await fetch(`${BASE}/documents`, { method: "POST", headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}, body: fd });
  if (res.status === 401) { onUnauthorized?.(); throw new Error("Sesi berakhir."); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `Upload gagal: ${res.status}`); }
  return res.json();
}
export function docPreviewUrl(id: number): string { return `${BASE}/documents/${id}/preview${authToken ? "?token=" + encodeURIComponent(authToken) : ""}`; }
export function docDownloadUrl(id: number): string { return `${BASE}/documents/${id}/download${authToken ? "?token=" + encodeURIComponent(authToken) : ""}`; }
export async function deleteDocument(id: number): Promise<unknown> { return sendJSON(`/documents/${id}`, "DELETE"); }

// ===================== Disciplinary Action (Sanksi) =====================
export interface SanksiRecord {
  id: number;
  employee_id: number;
  jenis_sanksi: string;
  kategori_pelanggaran: string;
  point: number;
  tanggal_pelanggaran: string;
  tanggal_diberikan: string;
  masa_berlaku: string | null;
  deskripsi: string;
  lampiran_original: string | null;
  catatan_manager: string | null;
  catatan_hrd: string | null;
  status: string;
  created_by_username: string;
  created_by_role: string;
  created_at: string;
}
export interface SanksiSummary {
  employee_id: number;
  total_point: number;
  status_label: string;
  active_count: number;
  active_items: { jenis_sanksi: string; tanggal_diberikan: string; masa_berlaku: string | null }[];
}
export const JENIS_SANKSI_OPTS = ["Teguran Lisan", "Teguran Tertulis", "SP1", "SP2", "SP3", "Skorsing", "PHK"];
export const KATEGORI_PELANGGARAN_OPTS = ["Terlambat Berulang", "Pelanggaran SOP", "Mangkir", "Manipulasi Data", "Pelanggaran Security", "Lainnya"];

export async function fetchSanksi(eid: number): Promise<SanksiRecord[]> { return getJSON(`/disciplinary?employee_id=${eid}`); }
export async function fetchSanksiSummary(eid: number): Promise<SanksiSummary> { return getJSON(`/disciplinary/summary?employee_id=${eid}`); }
export async function createSanksi(d: {
  employee_id: number; jenis_sanksi: string; kategori_pelanggaran: string;
  tanggal_pelanggaran: string; tanggal_diberikan: string; masa_berlaku?: string;
  deskripsi: string; catatan_manager?: string; catatan_hrd?: string; file?: File | null;
}): Promise<SanksiRecord> {
  const fd = new FormData();
  fd.append("employee_id", String(d.employee_id));
  fd.append("jenis_sanksi", d.jenis_sanksi);
  fd.append("kategori_pelanggaran", d.kategori_pelanggaran);
  fd.append("tanggal_pelanggaran", d.tanggal_pelanggaran);
  fd.append("tanggal_diberikan", d.tanggal_diberikan);
  if (d.masa_berlaku) fd.append("masa_berlaku", d.masa_berlaku);
  fd.append("deskripsi", d.deskripsi);
  if (d.catatan_manager) fd.append("catatan_manager", d.catatan_manager);
  if (d.catatan_hrd) fd.append("catatan_hrd", d.catatan_hrd);
  if (d.file) fd.append("file", d.file);
  const res = await fetch(`${BASE}/disciplinary`, { method: "POST", headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}, body: fd });
  if (res.status === 401) { onUnauthorized?.(); throw new Error("Sesi berakhir."); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `Gagal (${res.status})`); }
  return res.json();
}
export async function cabutSanksi(id: number, catatan_hrd: string): Promise<SanksiRecord> {
  const fd = new FormData();
  fd.append("catatan_hrd", catatan_hrd);
  const res = await fetch(`${BASE}/disciplinary/${id}/cabut`, { method: "PATCH", headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}, body: fd });
  if (res.status === 401) { onUnauthorized?.(); throw new Error("Sesi berakhir."); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `Gagal (${res.status})`); }
  return res.json();
}
export function sanksiLampiranUrl(id: number): string { return `${BASE}/disciplinary/${id}/lampiran${authToken ? "?token=" + encodeURIComponent(authToken) : ""}`; }

// ===================== Reward Management =====================
export interface RewardRecord {
  id: number;
  employee_id: number;
  jenis_reward: string;
  period: string | null;
  tanggal: string;
  deskripsi: string | null;
  given_by_username: string;
  given_by_role: string;
  created_at: string;
}
export const JENIS_REWARD_OPTS = [
  "Employee of The Semester", "Best Attendance", "Best Performance",
  "Innovation Award", "Leadership Award", "Special Achievement Award",
];
export async function fetchRewards(eid: number): Promise<RewardRecord[]> { return getJSON(`/rewards?employee_id=${eid}`); }
export async function createReward(d: {
  employee_id: number; jenis_reward: string; period?: string; tanggal: string; deskripsi?: string;
}): Promise<RewardRecord> { return sendJSON("/rewards", "POST", d); }
export async function deleteReward(id: number): Promise<unknown> { return sendJSON(`/rewards/${id}`, "DELETE"); }

// ===================== Audit Trail =====================
export interface AuditLogRecord {
  id: number;
  user_id: number | null;
  username: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  employee_id: number | null;
  description: string | null;
  old_data: string | null;
  new_data: string | null;
  ip_address: string | null;
  created_at: string;
}
export async function fetchAuditLogs(params: Record<string, string | number>): Promise<AuditLogRecord[]> {
  const qs = Object.entries(params).filter(([,v]) => v != null && v !== "").map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return getJSON(`/audit-logs?${qs}`);
}

// ===================== Foto Profil =====================
export function photoUrl(employeeId: number): string {
  return `${BASE}/photos/${employeeId}${authToken ? "?token=" + encodeURIComponent(authToken) : ""}`;
}
export async function uploadPhoto(employeeId: number, file: File): Promise<unknown> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/employees/${employeeId}/photo`, { method: "POST", headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}, body: fd });
  if (res.status === 401) { onUnauthorized?.(); throw new Error("Sesi berakhir."); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `Upload gagal: ${res.status}`); }
  return res.json();
}



// ===================== Org Chart Designer =====================
export interface OrgNodeRecord {
  id: number; division_key: string; title: string; employee_name: string;
  department: string; color: string; text_color: string;
  x: number; y: number; width: number; height: number;
  notes: string; text_align: string; title_color: string; name_color: string;
  updated_at: string;
}
export interface OrgEdgeRecord {
  id: number; division_key: string; source_id: string; target_id: string;
  line_type: string; arrow_end: string; edge_type: string; routing_type: string; label: string;
}
export async function fetchOrgNodes(key: string): Promise<OrgNodeRecord[]> { return getJSON(`/orgchart/nodes/${key}`); }
export async function createOrgNode(d: Record<string, unknown>): Promise<OrgNodeRecord> { return sendJSON("/orgchart/nodes", "POST", d); }
export async function updateOrgNode(id: number, d: Record<string, unknown>): Promise<OrgNodeRecord> { return sendJSON(`/orgchart/nodes/${id}`, "PATCH", d); }
export async function deleteOrgNode(id: number): Promise<unknown> { return sendJSON(`/orgchart/nodes/${id}`, "DELETE"); }
export async function fetchOrgEdges(key: string): Promise<OrgEdgeRecord[]> { return getJSON(`/orgchart/edges/${key}`); }
export async function createOrgEdge(d: Record<string, unknown>): Promise<OrgEdgeRecord> { return sendJSON("/orgchart/edges", "POST", d); }
export async function updateOrgEdge(id: number, d: Record<string, unknown>): Promise<OrgEdgeRecord> { return sendJSON(`/orgchart/edges/${id}`, "PATCH", d); }
export async function deleteOrgEdge(id: number): Promise<unknown> { return sendJSON(`/orgchart/edges/${id}`, "DELETE"); }
