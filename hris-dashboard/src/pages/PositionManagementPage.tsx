import { useEffect, useState } from "react";
import { Plus, Loader2, X, Briefcase, CheckCircle, AlertCircle, Clock } from "lucide-react";
import {
  fetchPositions, fetchPositionSummary, createPosition, updatePosition, deletePosition,
  fetchEmployees, fetchJobProfiles, fetchDivisions,
  type PositionRecord, type PositionSummary, type Division, POSITION_STATUSES, JOB_LEVELS,
} from "../services/api";
import type { Employee } from "../types";
import type { JobProfile } from "../services/api";

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  Filled:  { bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle },
  Vacant:  { bg: "bg-amber-100",   text: "text-amber-700",   icon: AlertCircle },
  Planned: { bg: "bg-slate-100",   text: "text-slate-500",   icon: Clock },
};

const EMPTY_POS: {
  kode: string; nama_jabatan: string; department: string; level: string;
  status: string; employee_id: number | null; job_profile_id: number | null; keterangan: string;
} = {
  kode: "", nama_jabatan: "", department: "", level: "Staff",
  status: "Vacant", employee_id: null, job_profile_id: null, keterangan: "",
};

export default function PositionManagementPage() {
  const [rows, setRows] = useState<PositionRecord[]>([]);
  const [summary, setSummary] = useState<PositionSummary>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobProfiles, setJobProfiles] = useState<JobProfile[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept, setFilterDept] = useState("");

  const [drawer, setDrawer] = useState<typeof EMPTY_POS | (PositionRecord & { keterangan: string }) | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [data, sum] = await Promise.all([
        fetchPositions({ status: filterStatus || undefined, department: filterDept || undefined }),
        fetchPositionSummary(),
      ]);
      setRows(data);
      setSummary(sum);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterStatus, filterDept]);

  useEffect(() => {
    fetchEmployees().catch(() => []).then(e => setEmployees(e));
    fetchJobProfiles().catch(() => []).then(jp => setJobProfiles(jp));
    fetchDivisions().catch(() => []).then(d => setDivisions(d));
  }, []);

  const departments = [...new Set(rows.map(r => r.department))].sort();

  function openNew() {
    setIsNew(true);
    setDrawer({ ...EMPTY_POS });
    setSaveErr(null);
  }

  function openEdit(pos: PositionRecord) {
    setIsNew(false);
    setDrawer({ ...pos, keterangan: pos.keterangan ?? "" });
    setSaveErr(null);
  }

  async function handleSave() {
    if (!drawer) return;
    setSaving(true); setSaveErr(null);
    try {
      const payload: Record<string, unknown> = {
        kode: drawer.kode,
        nama_jabatan: drawer.nama_jabatan,
        department: drawer.department,
        level: drawer.level,
        status: drawer.status,
        employee_id: (drawer as PositionRecord).employee_id ?? null,
        job_profile_id: (drawer as PositionRecord).job_profile_id ?? null,
        keterangan: drawer.keterangan || null,
      };
      if (isNew) {
        const created = await createPosition(payload);
        setRows(r => [...r, created]);
        setSummary(s => ({ ...s, [created.status]: (s[created.status as keyof PositionSummary] ?? 0) + 1 }));
      } else {
        const pos = drawer as PositionRecord;
        const updated = await updatePosition(pos.id, payload);
        setRows(r => r.map(x => x.id === updated.id ? updated : x));
      }
      setDrawer(null);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(pos: PositionRecord) {
    if (!confirm(`Hapus posisi "${pos.kode} - ${pos.nama_jabatan}"?\nPosisi Filled tidak bisa dihapus, harap kosongkan dulu.`)) return;
    try {
      await deletePosition(pos.id);
      setRows(r => r.filter(x => x.id !== pos.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menghapus");
    }
  }

  const total = (summary.Filled ?? 0) + (summary.Vacant ?? 0) + (summary.Planned ?? 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Position Management</h1>
          <p className="text-sm text-slate-400">Posisi jabatan terpisah dari karyawan — status otomatis update saat assignment berubah</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-xl">
          <Plus size={15} /> Tambah Posisi
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Posisi", value: total, color: "text-slate-800", bg: "bg-slate-50" },
          { label: "Filled", value: summary.Filled ?? 0, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Vacant", value: summary.Vacant ?? 0, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "Planned", value: summary.Planned ?? 0, color: "text-slate-500", bg: "bg-slate-50" },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-4 border border-slate-100`}>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-sky-300 bg-white">
          <option value="">Semua Status</option>
          {POSITION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-sky-300 bg-white">
          <option value="">Semua Departemen</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center">
          <Loader2 size={16} className="animate-spin" /> Memuat...
        </div>
      )}
      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{err}</div>}

      {!loading && !err && rows.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400">
          <Briefcase size={28} className="mx-auto mb-2 text-slate-300" />
          Belum ada posisi. Klik "Tambah Posisi" untuk mulai.
        </div>
      )}

      {/* Table */}
      {!loading && rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 bg-slate-50">
                  <th className="py-3 px-4 font-bold">Kode</th>
                  <th className="py-3 px-4 font-bold">Nama Jabatan</th>
                  <th className="py-3 px-4 font-bold">Departemen</th>
                  <th className="py-3 px-4 font-bold">Level</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Karyawan</th>
                  <th className="py-3 px-4 font-bold">Job Profile</th>
                  <th className="py-3 px-2 font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(pos => {
                  const st = STATUS_STYLE[pos.status] ?? STATUS_STYLE.Vacant;
                  const Icon = st.icon;
                  return (
                    <tr key={pos.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-[12px] text-slate-500">{pos.kode}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">{pos.nama_jabatan}</td>
                      <td className="py-2.5 px-4 text-slate-600">{pos.department}</td>
                      <td className="py-2.5 px-4 text-slate-600">{pos.level}</td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${st.bg} ${st.text}`}>
                          <Icon size={11} /> {pos.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{pos.employee_nama ?? <span className="text-slate-300">—</span>}</td>
                      <td className="py-2.5 px-4 text-slate-500 text-[12px]">{pos.job_profile_nama ?? <span className="text-slate-300">—</span>}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(pos)}
                            className="text-xs px-3 py-1 border border-slate-200 rounded-lg hover:bg-sky-50 hover:text-sky-700 text-slate-500">
                            Edit
                          </button>
                          <button onClick={() => handleDelete(pos)}
                            className="text-xs px-3 py-1 border border-red-100 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-700">
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setDrawer(null)} />
          <div className="w-[480px] bg-white h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">{isNew ? "Tambah Posisi" : "Edit Posisi"}</h2>
              <button onClick={() => setDrawer(null)}><X size={18} className="text-slate-400" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Kode Posisi *</label>
                  <input value={drawer.kode} onChange={e => setDrawer(d => d ? { ...d, kode: e.target.value } : d)}
                    placeholder="e.g. SPV-NET-001"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-300" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Level *</label>
                  <select value={drawer.level} onChange={e => setDrawer(d => d ? { ...d, level: e.target.value } : d)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-300">
                    {JOB_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Nama Jabatan *</label>
                <input value={drawer.nama_jabatan} onChange={e => setDrawer(d => d ? { ...d, nama_jabatan: e.target.value } : d)}
                  placeholder="e.g. Supervisor Network"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-300" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Departemen *</label>
                <select value={drawer.department} onChange={e => setDrawer(d => d ? { ...d, department: e.target.value } : d)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-300">
                  <option value="">— Pilih Departemen —</option>
                  {divisions.filter(d => d.is_active).map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Status</label>
                <select value={drawer.status} onChange={e => setDrawer(d => d ? { ...d, status: e.target.value } : d)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-300">
                  {POSITION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                  Karyawan Pengisi{" "}
                  <span className="text-slate-400 normal-case font-normal">(kosongkan jika Vacant)</span>
                </label>
                <select
                  value={(drawer as PositionRecord).employee_id ?? ""}
                  onChange={e => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    setDrawer(d => d ? { ...d, employee_id: v, status: v ? "Filled" : "Vacant" } : d);
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-300">
                  <option value="">— Kosong (Vacant) —</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.nama} — {e.position} ({e.department})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Job Profile</label>
                <select
                  value={(drawer as PositionRecord).job_profile_id ?? ""}
                  onChange={e => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    setDrawer(d => d ? { ...d, job_profile_id: v } : d);
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-300">
                  <option value="">— Belum ditautkan —</option>
                  {jobProfiles.map(jp => (
                    <option key={jp.id} value={jp.id}>[{jp.level}] {jp.nama} ({jp.kode})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Keterangan</label>
                <textarea value={drawer.keterangan ?? ""} onChange={e => setDrawer(d => d ? { ...d, keterangan: e.target.value } : d)}
                  rows={3} placeholder="Catatan tambahan..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-300 resize-y" />
              </div>
            </div>

            {saveErr && (
              <div className="mx-6 mb-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">{saveErr}</div>
            )}
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setDrawer(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Batal</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm bg-sky-600 hover:bg-sky-700 text-white rounded-xl disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 size={13} className="animate-spin" />} Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
