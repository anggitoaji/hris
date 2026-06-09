import { useEffect, useMemo, useState, Fragment, type ReactNode } from "react";
import { Search, X, Loader2, Plus, Pencil, Building2, Trash2, Check } from "lucide-react";
import { fetchEmployees, createEmployee, updateEmployee, fetchDivisions, createDivision, updateDivision, deleteDivision, type Division } from "../services/api";
import type { Role } from "../components/Sidebar";
import type { Employee } from "../types";

const STATUS_OPTS = ["Aktif", "Cuti", "Probasi"];

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className={`text-sm ${empty ? "text-slate-300" : "text-slate-700"}`}>{empty ? "-" : value}</span>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function initials(nama: string): string {
  return nama.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

type FormState = Record<string, string>;
const FIELD_KEYS = [
  "nik", "nama", "email", "phone", "department", "position", "status", "contract_type",
  "join_date", "kpi_score", "ktp", "gender", "birth_place", "birth_date", "religion",
  "marital_status", "address", "education", "npwp", "bank_name", "bank_account",
  "bpjs_kesehatan", "bpjs_ketenagakerjaan", "emergency_name", "emergency_phone", "emergency_relation",
  "skills", "job_desc", "catatan",
] as const;

function emptyForm(): FormState {
  const f: FormState = {};
  FIELD_KEYS.forEach((k) => (f[k] = ""));
  f.status = "Aktif";
  f.contract_type = "Kontrak";
  f.kpi_score = "0";
  return f;
}
function fromEmployee(e: Employee): FormState {
  const f = emptyForm();
  FIELD_KEYS.forEach((k) => {
    const v = e[k as keyof Employee] as unknown;
    f[k] = v === null || v === undefined ? "" : String(v);
  });
  return f;
}
function buildPayload(f: FormState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  FIELD_KEYS.forEach((k) => {
    const v = (f[k] ?? "").trim();
    if (k === "kpi_score") { out[k] = v === "" ? 0 : Number(v); return; }
    out[k] = v === "" ? null : v;
  });
  return out;
}

interface FieldCfg { key: string; label: string; type?: string; options?: string[]; required?: boolean; full?: boolean }
const SECTIONS: { title: string; fields: FieldCfg[] }[] = [
  { title: "Identitas", fields: [
    { key: "nik", label: "NIK", required: true },
    { key: "nama", label: "Nama Lengkap", required: true, full: true },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Telepon", type: "tel" },
  ] },
  { title: "Kepegawaian", fields: [
    { key: "department", label: "Divisi", required: true },
    { key: "position", label: "Jabatan", required: true },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTS, required: true },
    { key: "contract_type", label: "Tipe Kontrak", type: "select", options: ["Tetap", "Kontrak", "Probasi"], required: true },
    { key: "join_date", label: "Tanggal Masuk", type: "date" },
    { key: "kpi_score", label: "Skor KPI", type: "number" },
  ] },
  { title: "Data Pribadi", fields: [
    { key: "ktp", label: "No. KTP" },
    { key: "gender", label: "Jenis Kelamin", type: "select", options: ["Laki-laki", "Perempuan"] },
    { key: "birth_place", label: "Tempat Lahir" },
    { key: "birth_date", label: "Tanggal Lahir", type: "date" },
    { key: "religion", label: "Agama" },
    { key: "marital_status", label: "Status Pernikahan" },
    { key: "education", label: "Pendidikan", full: true },
  ] },
  { title: "Alamat", fields: [{ key: "address", label: "Alamat", type: "textarea", full: true }] },
  { title: "Keuangan & BPJS", fields: [
    { key: "npwp", label: "NPWP" },
    { key: "bank_name", label: "Bank" },
    { key: "bank_account", label: "No. Rekening" },
    { key: "bpjs_kesehatan", label: "BPJS Kesehatan" },
    { key: "bpjs_ketenagakerjaan", label: "BPJS Ketenagakerjaan" },
  ] },
  { title: "Kontak Darurat", fields: [
    { key: "emergency_name", label: "Nama" },
    { key: "emergency_phone", label: "Telepon", type: "tel" },
    { key: "emergency_relation", label: "Hubungan" },
  ] },
  { title: "Kompetensi & Jobdesk", fields: [
    { key: "skills", label: "Keahlian / Kompetensi (pisahkan dengan koma)", full: true },
    { key: "job_desc", label: "Jobdesk / Uraian Tugas", type: "textarea", full: true },
    { key: "catatan", label: "Catatan", type: "textarea", full: true },
  ] },
];

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";

function FormField({ cfg, value, onChange }: { cfg: FieldCfg; value: string; onChange: (v: string) => void }) {
  return (
    <div className={cfg.full ? "col-span-2" : ""}>
      <label className="text-[11px] text-slate-500 font-medium block mb-1">
        {cfg.label}{cfg.required && <span className="text-red-400"> *</span>}
      </label>
      {cfg.type === "select" ? (
        <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
          {!cfg.required && <option value="">-</option>}
          {(cfg.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : cfg.type === "textarea" ? (
        <textarea className={inputCls} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={inputCls} type={cfg.type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function KelolaDivisiModal({ divisions, onClose, reload }: { divisions: Division[]; onClose: () => void; reload: () => Promise<void> }) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await fn(); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Terjadi kesalahan."); }
    finally { setBusy(false); }
  }
  async function add() {
    const name = newName.trim();
    if (!name) return;
    await run(async () => { await createDivision({ name }); setNewName(""); });
  }
  function startEdit(d: Division) { setEditId(d.id); setEditName(d.name); setError(null); }
  async function saveEdit(d: Division) {
    const name = editName.trim();
    if (!name || name === d.name) { setEditId(null); return; }
    await run(async () => { await updateDivision(d.id, { name }); setEditId(null); });
  }
  async function remove(d: Division) {
    if (d.employee_count > 0) {
      setError(`Divisi "${d.name}" masih punya ${d.employee_count} karyawan. Pindahkan dulu karyawannya sebelum menghapus.`);
      return;
    }
    if (!window.confirm(`Hapus divisi "${d.name}"?`)) return;
    await run(async () => { await deleteDivision(d.id); });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-sky-600" />
            <span className="font-bold text-slate-800">Kelola Divisi</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100">
          <div className="text-[11px] text-slate-400 mb-1">Tambah divisi baru</div>
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
              placeholder="Nama divisi, mis. Marketing"
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-sky-300" />
            <button onClick={add} disabled={busy || !newName.trim()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">
              <Plus size={16} /> Tambah
            </button>
          </div>
        </div>

        {error && <div className="mx-5 mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex-1 overflow-auto px-5 py-3">
          {divisions.length === 0 && <div className="text-sm text-slate-400 py-6 text-center">Belum ada divisi.</div>}
          <div className="flex flex-col divide-y divide-slate-100">
            {divisions.map((d) => (
              <div key={d.id} className="flex items-center gap-2 py-2">
                {editId === d.id ? (
                  <>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(d); if (e.key === "Escape") setEditId(null); }}
                      autoFocus
                      className="flex-1 text-sm border border-sky-300 rounded-lg px-2 py-1.5 outline-none" />
                    <button onClick={() => saveEdit(d)} disabled={busy} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50" title="Simpan"><Check size={16} /></button>
                    <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" title="Batal"><X size={16} /></button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">{d.name}</div>
                      <div className="text-[11px] text-slate-400">{d.employee_count} karyawan</div>
                    </div>
                    <button onClick={() => startEdit(d)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" title="Ubah nama"><Pencil size={15} /></button>
                    <button onClick={() => remove(d)}
                      className={`p-1.5 rounded-lg ${d.employee_count > 0 ? "text-slate-300 cursor-not-allowed" : "text-red-500 hover:bg-red-50"}`}
                      title={d.employee_count > 0 ? "Tidak bisa dihapus (masih ada karyawan)" : "Hapus divisi"}><Trash2 size={15} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 text-[11px] text-slate-400">
          Mengubah nama divisi otomatis memperbarui divisi semua karyawan terkait. Divisi yang masih memiliki karyawan tidak bisa dihapus.
        </div>
      </div>
    </div>
  );
}

export default function DataKaryawanPage({ role }: { role: Role }) {
  const [rows, setRows] = useState<Employee[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filterDiv, setFilterDiv] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [groupByDiv, setGroupByDiv] = useState(false);
  const [sel, setSel] = useState<Employee | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formId, setFormId] = useState<number | null>(null);
  const [f, setF] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [divOpen, setDivOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [emps, divs] = await Promise.all([fetchEmployees(), fetchDivisions().catch(() => [])]);
      setRows(emps);
      setDivisions(divs);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((e) => {
      if (filterDiv && e.department !== filterDiv) return false;
      if (filterStatus && e.status !== filterStatus) return false;
      if (!s) return true;
      return [e.nama, e.nik, e.department, e.position].some((v) => (v ?? "").toLowerCase().includes(s));
    });
  }, [rows, q, filterDiv, filterStatus]);

  const groups = useMemo(() => {
    if (!groupByDiv) return null;
    const map = new Map<string, Employee[]>();
    for (const e of filtered) {
      const k = e.department || "(Tanpa Divisi)";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupByDiv]);

  function openCreate() {
    setFormMode("create"); setFormId(null); setF(emptyForm());
    setFormErr(null); setSel(null); setFormOpen(true);
  }
  function openEdit(e: Employee) {
    setFormMode("edit"); setFormId(e.id); setF(fromEmployee(e));
    setFormErr(null); setSel(null); setFormOpen(true);
  }
  const setField = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!f.nik.trim() || !f.nama.trim() || !f.department.trim() || !f.position.trim()) {
      setFormErr("NIK, Nama, Divisi, dan Jabatan wajib diisi.");
      return;
    }
    setSaving(true); setFormErr(null);
    try {
      const payload = buildPayload(f);
      if (formMode === "create") await createEmployee(payload);
      else if (formId != null) await updateEmployee(formId, payload);
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  const COLS = 8;
  function Row({ e }: { e: Employee }) {
    return (
      <tr onClick={() => setSel(e)} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
        <td className="py-2 px-2 text-slate-500">{e.nik}</td>
        <td className="py-2 px-2 font-medium text-slate-800">{e.nama}</td>
        <td className="py-2 px-2 text-slate-600">{e.department}</td>
        <td className="py-2 px-2 text-slate-600">{e.position}</td>
        <td className="py-2 px-2 text-slate-600 truncate">{e.email || "-"}</td>
        <td className="py-2 px-2 text-slate-600">{e.phone || "-"}</td>
        <td className="py-2 px-2 text-right text-slate-700 pr-4">{e.kpi_score.toFixed(1)}</td>
        <td className="py-2 px-2 text-slate-500 truncate">{e.catatan || "-"}</td>
      </tr>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Data Karyawan</h1>
          <p className="text-sm text-slate-400">Biodata lengkap karyawan - data langsung dari database.</p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && !err && <span className="text-sm text-slate-500">{filtered.length} karyawan</span>}
          {role === "Super Admin" && (
            <button onClick={() => setDivOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              <Building2 size={16} /> Kelola Divisi
            </button>
          )}
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700">
            <Plus size={16} /> Tambah Karyawan
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        {/* Toolbar: cari + filter + grup */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, NIK, jabatan..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300" />
          </div>
          <select value={filterDiv} onChange={(e) => setFilterDiv(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-sky-300 bg-white">
            <option value="">Semua Divisi</option>
            {divisions.map((d) => <option key={d.id} value={d.name}>{d.name} ({d.employee_count})</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-sky-300 bg-white">
            <option value="">Semua Status</option>
            {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer px-2">
            <input type="checkbox" checked={groupByDiv} onChange={(e) => setGroupByDiv(e.target.checked)} />
            Kelompokkan per divisi
          </label>
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
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: "8%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "19%" }} />
              </colgroup>
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="py-2 px-2 font-bold">NIK</th>
                  <th className="py-2 px-2 font-bold">Nama</th>
                  <th className="py-2 px-2 font-bold">Divisi</th>
                  <th className="py-2 px-2 font-bold">Jabatan</th>
                  <th className="py-2 px-2 font-bold">Email</th>
                  <th className="py-2 px-2 font-bold">No HP</th>
                  <th className="py-2 px-2 font-bold text-right pr-4">KPI</th>
                  <th className="py-2 px-2 font-bold">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {groups
                  ? groups.map(([div, emps]) => (
                      <Fragment key={div}>
                        <tr className="bg-slate-50">
                          <td colSpan={COLS} className="py-1.5 px-2 font-semibold text-slate-600 text-[13px]">
                            {div} <span className="text-slate-400 font-normal">({emps.length})</span>
                          </td>
                        </tr>
                        {emps.map((e) => <Row key={e.id} e={e} />)}
                      </Fragment>
                    ))
                  : filtered.map((e) => <Row key={e.id} e={e} />)}
                {filtered.length === 0 && (
                  <tr><td colSpan={COLS} className="text-center text-slate-400 py-8">Tidak ada karyawan yang cocok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer detail */}
      {sel && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSel(null)} />
          <div className="fixed top-0 right-0 h-full bg-white shadow-2xl z-50 overflow-y-auto" style={{ width: "50vw", minWidth: 460, maxWidth: "96vw" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ width: 40, height: 40, background: "linear-gradient(135deg,#818cf8,#6366f1)" }}>
                  {initials(sel.nama)}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 truncate">{sel.nama}</div>
                  <div className="text-xs text-slate-400 truncate">{sel.position} - {sel.department}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(sel)} className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 px-2 py-1 rounded-md hover:bg-sky-50">
                  <Pencil size={15} /> Edit
                </button>
                <button onClick={() => setSel(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-5">
              <Group title="Data Pribadi">
                <Field label="NIK" value={sel.nik} />
                <Field label="No. KTP" value={sel.ktp} />
                <Field label="Jenis Kelamin" value={sel.gender} />
                <Field label="Tempat Lahir" value={sel.birth_place} />
                <Field label="Tanggal Lahir" value={sel.birth_date} />
                <Field label="Agama" value={sel.religion} />
                <Field label="Status Pernikahan" value={sel.marital_status} />
                <Field label="Pendidikan" value={sel.education} />
              </Group>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Alamat</div>
                <div className={`text-sm ${sel.address ? "text-slate-700" : "text-slate-300"}`}>{sel.address ?? "-"}</div>
              </div>
              <Group title="Kontak">
                <Field label="Email" value={sel.email} />
                <Field label="Telepon" value={sel.phone} />
              </Group>
              <Group title="Kepegawaian">
                <Field label="Divisi" value={sel.department} />
                <Field label="Jabatan" value={sel.position} />
                <Field label="Status" value={sel.status} />
                <Field label="Tipe Kontrak" value={sel.contract_type} />
                <Field label="Tanggal Masuk" value={sel.join_date} />
                <Field label="Skor KPI" value={sel.kpi_score} />
              </Group>
              <Group title="Keuangan & BPJS">
                <Field label="NPWP" value={sel.npwp} />
                <Field label="Bank" value={sel.bank_name} />
                <Field label="No. Rekening" value={sel.bank_account} />
                <Field label="BPJS Kesehatan" value={sel.bpjs_kesehatan} />
                <Field label="BPJS Ketenagakerjaan" value={sel.bpjs_ketenagakerjaan} />
              </Group>
              <Group title="Kontak Darurat">
                <Field label="Nama" value={sel.emergency_name} />
                <Field label="Telepon" value={sel.emergency_phone} />
                <Field label="Hubungan" value={sel.emergency_relation} />
              </Group>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Keahlian / Kompetensi</div>
                {sel.skills ? (
                  <div className="flex flex-wrap gap-1.5">
                    {sel.skills.split(",").map((x) => x.trim()).filter(Boolean).map((x, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">{x}</span>
                    ))}
                  </div>
                ) : <div className="text-sm text-slate-300">-</div>}
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Jobdesk / Uraian Tugas</div>
                <div className={`text-sm whitespace-pre-line ${sel.job_desc ? "text-slate-700" : "text-slate-300"}`}>{sel.job_desc ?? "-"}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Catatan</div>
                <div className={`text-sm whitespace-pre-line ${sel.catatan ? "text-slate-700" : "text-slate-300"}`}>{sel.catatan ?? "-"}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Drawer form */}
      {formOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => !saving && setFormOpen(false)} />
          <div className="fixed top-0 right-0 h-full bg-white shadow-2xl z-50 overflow-y-auto flex flex-col" style={{ width: 480, maxWidth: "96vw" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="font-bold text-slate-800">{formMode === "create" ? "Tambah Karyawan" : "Edit Karyawan"}</div>
              <button onClick={() => !saving && setFormOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="p-5 flex flex-col gap-5 flex-1">
              {SECTIONS.map((sec) => (
                <div key={sec.title}>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">{sec.title}</div>
                  <div className="grid grid-cols-2 gap-3">
                    {sec.fields.map((cfg) => {
                      if (cfg.key === "department") {
                        return (
                          <div key={cfg.key}>
                            <label className="text-[11px] text-slate-500 font-medium block mb-1">Divisi <span className="text-red-400">*</span></label>
                            <select className={inputCls} value={f.department} onChange={(e) => setField("department", e.target.value)}>
                              <option value="">- pilih divisi -</option>
                              {divisions.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                            </select>
                          </div>
                        );
                      }
                      return <FormField key={cfg.key} cfg={cfg} value={f[cfg.key] ?? ""} onChange={(v) => setField(cfg.key, v)} />;
                    })}
                  </div>
                </div>
              ))}
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

      {divOpen && <KelolaDivisiModal divisions={divisions} onClose={() => setDivOpen(false)} reload={load} />}
    </div>
  );
}
