import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, X, Loader2, Plus, Trash2, CalendarDays, Clock, MapPin, Users, CheckSquare, Square } from "lucide-react";
import {
  fetchMeetings, createMeeting, updateMeeting, deleteMeeting,
  type Meeting,
} from "../services/api";

const STATUSES = ["Terjadwal", "Selesai", "Batal"];
const STATUS_COLOR: Record<string, string> = {
  Terjadwal: "bg-sky-100 text-sky-700",
  Selesai: "bg-emerald-100 text-emerald-700",
  Batal: "bg-slate-100 text-slate-500",
};

function fmtDate(s: string | null): string {
  if (!s) return "-";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

type AForm = { task: string; assignee: string; dueDate: string; done: boolean };
type MForm = {
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  organizer: string;
  participants: string;
  agenda: string;
  notes: string;
  status: string;
  actions: AForm[];
};

function emptyForm(category: string): MForm {
  return {
    title: "", category, date: "", time: "", location: "", organizer: "",
    participants: "", agenda: "", notes: "", status: "Terjadwal", actions: [],
  };
}
function fromRow(r: Meeting): MForm {
  return {
    title: r.title, category: r.category, date: r.date, time: r.time ?? "",
    location: r.location ?? "", organizer: r.organizer ?? "", participants: r.participants ?? "",
    agenda: r.agenda ?? "", notes: r.notes ?? "", status: r.status,
    actions: r.action_items.map((a) => ({ task: a.task, assignee: a.assignee ?? "", dueDate: a.due_date ?? "", done: a.done })),
  };
}
function toActions(actions: AForm[]) {
  return actions
    .filter((a) => a.task.trim())
    .map((a) => ({ task: a.task.trim(), assignee: a.assignee.trim() || null, due_date: a.dueDate || null, done: a.done }));
}

export default function MeetingPage({ category }: { category: "Internal" | "Pelanggan" }) {
  const [rows, setRows] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formId, setFormId] = useState<number | null>(null);
  const [f, setF] = useState<MForm>(emptyForm(category));
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchMeetings(category);
      setRows(data);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [category]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (!s) return true;
      return [r.title, r.organizer, r.participants, r.location].some((v) => (v ?? "").toLowerCase().includes(s));
    });
  }, [rows, q, filterStatus]);

  const cards = useMemo(() => ({
    total: rows.length,
    terjadwal: rows.filter((r) => r.status === "Terjadwal").length,
    selesai: rows.filter((r) => r.status === "Selesai").length,
    openActions: rows.reduce((a, r) => a + (r.open_actions || 0), 0),
  }), [rows]);

  function openCreate() {
    setFormMode("create"); setFormId(null); setF(emptyForm(category));
    setFormErr(null); setFormOpen(true);
  }
  function openEdit(r: Meeting) {
    setFormMode("edit"); setFormId(r.id); setF(fromRow(r));
    setFormErr(null); setFormOpen(true);
  }
  const setField = (k: keyof MForm, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setAction = (i: number, k: keyof AForm, v: string | boolean) =>
    setF((p) => ({ ...p, actions: p.actions.map((a, idx) => (idx === i ? { ...a, [k]: v } : a)) }));
  const addAction = () => setF((p) => ({ ...p, actions: [...p.actions, { task: "", assignee: "", dueDate: "", done: false }] }));
  const removeAction = (i: number) => setF((p) => ({ ...p, actions: p.actions.filter((_, idx) => idx !== i) }));

  async function save() {
    if (!f.title.trim()) { setFormErr("Judul rapat wajib diisi."); return; }
    if (!f.date) { setFormErr("Tanggal wajib diisi."); return; }
    const payload = {
      title: f.title.trim(),
      category: f.category,
      date: f.date,
      time: f.time || null,
      location: f.location.trim() || null,
      organizer: f.organizer.trim() || null,
      participants: f.participants.trim() || null,
      agenda: f.agenda.trim() || null,
      notes: f.notes.trim() || null,
      status: f.status,
      action_items: toActions(f.actions),
    };
    setSaving(true); setFormErr(null);
    try {
      if (formMode === "create") await createMeeting(payload);
      else if (formId != null) await updateMeeting(formId, payload);
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
    if (!window.confirm("Hapus rapat ini beserta action item-nya?")) return;
    setSaving(true); setFormErr(null);
    try {
      await deleteMeeting(formId);
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
          <h1 className="text-lg font-bold text-slate-800">Meeting {category}</h1>
          <p className="text-sm text-slate-400">Notulen rapat {category.toLowerCase()} &amp; tindak lanjutnya - data langsung dari database.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700">
          <Plus size={16} /> Catat Rapat
        </button>
      </div>

      {!loading && !err && (
        <div className="flex flex-wrap gap-3">
          <StatCard label="Total Rapat" value={cards.total} sub={`kategori ${category}`} />
          <StatCard label="Terjadwal" value={cards.terjadwal} sub="belum berlangsung" />
          <StatCard label="Selesai" value={cards.selesai} sub="sudah berlangsung" />
          <StatCard label="Action Item Terbuka" value={cards.openActions} sub="tugas belum selesai" />
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari judul, penyelenggara, peserta..."
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
                  <th className="py-2 px-2 font-bold">Tanggal</th>
                  <th className="py-2 px-2 font-bold">Judul</th>
                  <th className="py-2 px-2 font-bold">Penyelenggara</th>
                  <th className="py-2 px-2 font-bold text-center">Action Item</th>
                  <th className="py-2 px-2 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} onClick={() => openEdit(r)} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
                    <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{fmtDate(r.date)}{r.time ? ` ${r.time}` : ""}</td>
                    <td className="py-2 px-2 font-medium text-slate-800">{r.title}</td>
                    <td className="py-2 px-2 text-slate-600">{r.organizer || "-"}</td>
                    <td className="py-2 px-2 text-center text-slate-600">
                      {r.action_items.length === 0
                        ? <span className="text-slate-300">-</span>
                        : <span>{r.action_items.length - r.open_actions}/{r.action_items.length} selesai</span>}
                    </td>
                    <td className="py-2 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status] ?? "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-8">Belum ada rapat {category.toLowerCase()}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form drawer */}
      {formOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => !saving && setFormOpen(false)} />
          <div className="fixed top-0 right-0 h-full bg-white shadow-2xl z-50 overflow-y-auto flex flex-col" style={{ width: "54vw", minWidth: 500, maxWidth: "96vw" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <CalendarDays size={18} className="text-sky-600" />
                {formMode === "create" ? "Catat Rapat" : "Edit Rapat"}
              </div>
              <button onClick={() => !saving && setFormOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="p-5 flex flex-col gap-4 flex-1">
              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Judul Rapat <span className="text-red-400">*</span></label>
                <input className={inputCls} value={f.title} onChange={(e) => setField("title", e.target.value)} placeholder="mis. Rapat Mingguan NOC" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 font-medium block mb-1">Kategori</label>
                  <select className={inputCls} value={f.category} onChange={(e) => setField("category", e.target.value)}>
                    <option value="Internal">Internal</option>
                    <option value="Pelanggan">Pelanggan</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-medium block mb-1">Status</label>
                  <select className={inputCls} value={f.status} onChange={(e) => setField("status", e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 font-medium block mb-1"><CalendarDays size={12} className="inline -mt-0.5" /> Tanggal <span className="text-red-400">*</span></label>
                  <input type="date" className={inputCls} value={f.date} onChange={(e) => setField("date", e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-medium block mb-1"><Clock size={12} className="inline -mt-0.5" /> Jam</label>
                  <input type="time" className={inputCls} value={f.time} onChange={(e) => setField("time", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1"><MapPin size={12} className="inline -mt-0.5" /> Tempat / Link</label>
                <input className={inputCls} value={f.location} onChange={(e) => setField("location", e.target.value)} placeholder="Ruang Meeting / Zoom" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 font-medium block mb-1">Penyelenggara</label>
                  <input className={inputCls} value={f.organizer} onChange={(e) => setField("organizer", e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-medium block mb-1"><Users size={12} className="inline -mt-0.5" /> Peserta</label>
                  <input className={inputCls} value={f.participants} onChange={(e) => setField("participants", e.target.value)} placeholder="pisahkan dengan koma" />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Agenda</label>
                <textarea className={inputCls} rows={2} value={f.agenda} onChange={(e) => setField("agenda", e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Notulen / Hasil</label>
                <textarea className={inputCls} rows={3} value={f.notes} onChange={(e) => setField("notes", e.target.value)} />
              </div>

              {/* Action items */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Action Item</label>
                  <button onClick={addAction} className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"><Plus size={13} /> Tambah</button>
                </div>
                <div className="flex flex-col gap-2">
                  {f.actions.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button onClick={() => setAction(i, "done", !a.done)} className={a.done ? "text-emerald-600" : "text-slate-300 hover:text-slate-500"} title="Tandai selesai">
                        {a.done ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                      <input className={`${inputCls} flex-1 min-w-0 ${a.done ? "line-through text-slate-400" : ""}`} value={a.task} placeholder="Tugas tindak lanjut"
                        onChange={(e) => setAction(i, "task", e.target.value)} />
                      <input className={`${inputCls} w-28`} value={a.assignee} placeholder="PIC"
                        onChange={(e) => setAction(i, "assignee", e.target.value)} />
                      <input type="date" className={`${inputCls} w-36`} value={a.dueDate}
                        onChange={(e) => setAction(i, "dueDate", e.target.value)} />
                      <button onClick={() => removeAction(i)} className="text-slate-300 hover:text-red-500 w-6 flex justify-center"><Trash2 size={15} /></button>
                    </div>
                  ))}
                  {f.actions.length === 0 && <div className="text-xs text-slate-300 py-1">Belum ada action item. Klik "Tambah".</div>}
                </div>
              </div>

              {formMode === "edit" && (
                <button onClick={removeRow} disabled={saving}
                  className="flex items-center justify-center gap-2 w-full py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60">
                  <Trash2 size={15} /> Hapus rapat
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex-1 min-w-[160px]">
      <div className="text-[12px] font-bold text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
