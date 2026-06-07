import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, X, Loader2, Plus, Trash2 } from "lucide-react";
import {
  fetchAttendance, fetchAttendanceSummary, createAttendance, updateAttendance, deleteAttendance,
  fetchEmployees, type Attendance, type AttendanceSummary,
} from "../services/api";
import type { Employee } from "../types";

const STATUSES = ["Hadir", "Terlambat", "WFH", "Izin", "Sakit", "Cuti", "Alpa"];
const PRESENT = new Set(["Hadir", "Terlambat", "WFH"]);
const STATUS_COLOR: Record<string, string> = {
  Hadir: "bg-emerald-100 text-emerald-700",
  Terlambat: "bg-amber-100 text-amber-700",
  WFH: "bg-sky-100 text-sky-700",
  Izin: "bg-violet-100 text-violet-700",
  Sakit: "bg-rose-100 text-rose-700",
  Cuti: "bg-indigo-100 text-indigo-700",
  Alpa: "bg-red-100 text-red-700",
};

function todayStr(): string {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function initials(nama: string): string {
  return nama.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

type AttForm = {
  employeeId: string;
  date: string;
  status: string;
  checkIn: string;
  checkOut: string;
  note: string;
};

function emptyForm(date: string): AttForm {
  return { employeeId: "", date, status: "Hadir", checkIn: "", checkOut: "", note: "" };
}
function fromRow(r: Attendance): AttForm {
  return {
    employeeId: String(r.employee_id),
    date: r.date,
    status: r.status,
    checkIn: r.check_in ?? "",
    checkOut: r.check_out ?? "",
    note: r.note ?? "",
  };
}

export default function KehadiranPage() {
  const [rows, setRows] = useState<Attendance[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [date, setDate] = useState(todayStr());

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formId, setFormId] = useState<number | null>(null);
  const [f, setF] = useState<AttForm>(emptyForm(todayStr()));
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [recs, sum] = await Promise.all([
        fetchAttendance(date),
        fetchAttendanceSummary(date).catch(() => null),
      ]);
      setRows(recs);
      setSummary(sum);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);
  useEffect(() => { fetchEmployees().then(setEmployees).catch(() => {}); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (!s) return true;
      return [r.employee_nama, r.employee_department].some((v) => (v ?? "").toLowerCase().includes(s));
    });
  }, [rows, q, filterStatus]);

  const cards = useMemo(() => {
    const s = summary;
    const hadir = (s?.Hadir ?? 0) + (s?.WFH ?? 0);
    const izin = (s?.Izin ?? 0) + (s?.Sakit ?? 0) + (s?.Cuti ?? 0);
    return {
      hadir,
      terlambat: s?.Terlambat ?? 0,
      izin,
      alpa: s?.Alpa ?? 0,
      belum: s?.belum_dicatat ?? 0,
      total: s?.total_karyawan ?? 0,
    };
  }, [summary]);

  function openCreate() {
    setFormMode("create"); setFormId(null); setF(emptyForm(date));
    setFormErr(null); setFormOpen(true);
  }
  function openEdit(r: Attendance) {
    setFormMode("edit"); setFormId(r.id); setF(fromRow(r));
    setFormErr(null); setFormOpen(true);
  }
  const set = (key: keyof AttForm, v: string) => setF((p) => ({ ...p, [key]: v }));

  async function save() {
    if (formMode === "create" && !f.employeeId) { setFormErr("Pilih karyawan dulu."); return; }
    if (!f.date) { setFormErr("Tanggal wajib diisi."); return; }
    const present = PRESENT.has(f.status);
    setSaving(true); setFormErr(null);
    try {
      if (formMode === "create") {
        await createAttendance({
          employee_id: Number(f.employeeId),
          date: f.date,
          status: f.status,
          check_in: present ? (f.checkIn || null) : null,
          check_out: present ? (f.checkOut || null) : null,
          note: f.note.trim() || null,
        });
      } else if (formId != null) {
        await updateAttendance(formId, {
          date: f.date,
          status: f.status,
          check_in: present ? (f.checkIn || null) : null,
          check_out: present ? (f.checkOut || null) : null,
          note: f.note.trim() || null,
        });
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow() {
    if (formId == null) return;
    if (!window.confirm("Hapus catatan kehadiran ini?")) return;
    setSaving(true); setFormErr(null);
    try {
      await deleteAttendance(formId);
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Kehadiran &amp; Absensi</h1>
          <p className="text-sm text-slate-400">Catatan kehadiran harian per karyawan - data langsung dari database.</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-sky-300 bg-white" />
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700">
            <Plus size={16} /> Catat Kehadiran
          </button>
        </div>
      </div>

      {!loading && !err && (
        <div className="flex flex-wrap gap-3">
          <StatCard label="Hadir" value={cards.hadir} sub="termasuk WFH" />
          <StatCard label="Terlambat" value={cards.terlambat} sub="masuk tapi telat" />
          <StatCard label="Izin / Sakit / Cuti" value={cards.izin} sub="tidak masuk (berizin)" />
          <StatCard label="Alpa" value={cards.alpa} sub="tanpa keterangan" />
          <StatCard label="Belum Dicatat" value={cards.belum} sub={`dari ${cards.total} karyawan`} />
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau divisi..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300" />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-sky-300 bg-white">
            <option value="">Semua Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center">
            <Loader2 size={16} className="animate-spin" /> Memuat data...
          </div>
        )}
        {err && !loading && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
            Gagal memuat data: {err}. Pastikan server backend menyala di http://localhost:8000.
          </div>
        )}
        {!loading && !err && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="py-2 px-2 font-bold">Nama</th>
                  <th className="py-2 px-2 font-bold">Divisi</th>
                  <th className="py-2 px-2 font-bold">Status</th>
                  <th className="py-2 px-2 font-bold text-center">Jam Masuk</th>
                  <th className="py-2 px-2 font-bold text-center">Jam Keluar</th>
                  <th className="py-2 px-2 font-bold">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} onClick={() => openEdit(r)} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
                    <td className="py-2 px-2 font-medium text-slate-800">{r.employee_nama || "-"}</td>
                    <td className="py-2 px-2 text-slate-600">{r.employee_department || "-"}</td>
                    <td className="py-2 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status] ?? "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-600">{r.check_in || "-"}</td>
                    <td className="py-2 px-2 text-center text-slate-600">{r.check_out || "-"}</td>
                    <td className="py-2 px-2 text-slate-500 truncate max-w-[220px]">{r.note || "-"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-slate-400 py-8">Belum ada catatan kehadiran pada tanggal ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form drawer (catat/edit) */}
      {formOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => !saving && setFormOpen(false)} />
          <div className="fixed top-0 right-0 h-full bg-white shadow-2xl z-50 overflow-y-auto flex flex-col" style={{ width: 440, maxWidth: "94vw" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="font-bold text-slate-800">{formMode === "create" ? "Catat Kehadiran" : "Edit Kehadiran"}</div>
              <button onClick={() => !saving && setFormOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="p-5 flex flex-col gap-4 flex-1">
              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Karyawan <span className="text-red-400">*</span></label>
                {formMode === "create" ? (
                  <select className={inputCls} value={f.employeeId} onChange={(e) => set("employeeId", e.target.value)}>
                    <option value="">- pilih karyawan -</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.nama} ({e.department})</option>)}
                  </select>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ width: 36, height: 36, background: "linear-gradient(135deg,#818cf8,#6366f1)" }}>
                      {initials(rows.find((r) => r.id === formId)?.employee_nama ?? "?")}
                    </div>
                    <div className="text-sm font-medium text-slate-700">{rows.find((r) => r.id === formId)?.employee_nama ?? "-"}</div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Tanggal <span className="text-red-400">*</span></label>
                <input type="date" className={inputCls} value={f.date} onChange={(e) => set("date", e.target.value)} />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Status</label>
                <select className={inputCls} value={f.status} onChange={(e) => set("status", e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {PRESENT.has(f.status) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium block mb-1">Jam Masuk</label>
                    <input type="time" className={inputCls} value={f.checkIn} onChange={(e) => set("checkIn", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium block mb-1">Jam Keluar</label>
                    <input type="time" className={inputCls} value={f.checkOut} onChange={(e) => set("checkOut", e.target.value)} />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Keterangan</label>
                <textarea className={inputCls} rows={3} value={f.note} placeholder="mis. sakit demam, izin acara keluarga..."
                  onChange={(e) => set("note", e.target.value)} />
              </div>

              {formMode === "edit" && (
                <button onClick={removeRow} disabled={saving}
                  className="flex items-center justify-center gap-2 w-full mt-1 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60">
                  <Trash2 size={15} /> Hapus catatan
                </button>
              )}
            </div>

            <div className="border-t border-slate-100 px-5 py-3 sticky bottom-0 bg-white">
              {formErr && <div className="text-sm text-red-600 mb-2">{formErr}</div>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setFormOpen(false)} disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60">Batal</button>
                <button onClick={save} disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700 flex items-center gap-2 disabled:opacity-60">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {formMode === "create" ? "Simpan" : "Simpan Perubahan"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex-1 min-w-[150px]">
      <div className="text-[12px] font-bold text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
