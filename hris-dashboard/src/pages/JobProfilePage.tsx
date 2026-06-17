import { useEffect, useState } from "react";
import { Plus, Loader2, ChevronRight, Pencil, Trash2, X, BookOpen, Route } from "lucide-react";
import {
  fetchJobProfiles, createJobProfile, updateJobProfile, deleteJobProfile,
  fetchDivisions, type JobProfile, JOB_LEVELS,
} from "../services/api";

const LABEL_COLOR: Record<string, string> = {
  Staff: "bg-slate-100 text-slate-600",
  Supervisor: "bg-sky-100 text-sky-700",
  Manager: "bg-violet-100 text-violet-700",
  Direksi: "bg-amber-100 text-amber-700",
};

const EMPTY: Partial<JobProfile> = {
  kode: "", nama: "", level: "Staff", department: "",
  tujuan_jabatan: "", tugas: "", tanggung_jawab: "", wewenang: "",
  persyaratan_pendidikan: "", persyaratan_pengalaman: "", persyaratan_keahlian: "",
  kompetensi: "", kpi_template: "", training_mandatory: "", training_recommended: "",
  career_path_naik: "", career_path_turun: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-300" />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-300 resize-y" />
  );
}

export default function JobProfilePage() {
  const [rows, setRows] = useState<JobProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);

  const [filterDept, setFilterDept] = useState("");
  const [filterLevel, setFilterLevel] = useState("");

  const [drawer, setDrawer] = useState<Partial<JobProfile> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"utama" | "kompetensi" | "kpi" | "training" | "karir">("utama");

  const [selected, setSelected] = useState<JobProfile | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchJobProfiles(filterDept || undefined, filterLevel || undefined);
      setRows(data);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterDept, filterLevel]);

  useEffect(() => {
    fetchDivisions().then(ds => setDepartments(ds.map(d => d.name))).catch(() => {});
  }, []);

  function openNew() {
    setIsNew(true);
    setDrawer({ ...EMPTY });
    setActiveTab("utama");
    setSaveErr(null);
  }

  function openEdit(jp: JobProfile) {
    setIsNew(false);
    setDrawer({ ...jp });
    setActiveTab("utama");
    setSaveErr(null);
  }

  function closeDrawer() { setDrawer(null); }

  function setField(key: keyof JobProfile, val: string) {
    setDrawer(d => d ? { ...d, [key]: val } : d);
  }

  async function handleSave() {
    if (!drawer) return;
    setSaving(true); setSaveErr(null);
    try {
      const payload: Record<string, unknown> = {};
      Object.entries(drawer).forEach(([k, v]) => { if (v !== undefined) payload[k] = v; });
      if (isNew) {
        const created = await createJobProfile(payload);
        setRows(r => [...r, created]);
      } else {
        const updated = await updateJobProfile(drawer.id!, payload);
        setRows(r => r.map(x => x.id === updated.id ? updated : x));
      }
      closeDrawer();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(jp: JobProfile) {
    if (!confirm(`Hapus Job Profile "${jp.nama}"?`)) return;
    try {
      await deleteJobProfile(jp.id);
      setRows(r => r.filter(x => x.id !== jp.id));
      if (selected?.id === jp.id) setSelected(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menghapus");
    }
  }

  const filtered = rows;
  const byDept: Record<string, JobProfile[]> = {};
  filtered.forEach(jp => {
    if (!byDept[jp.department]) byDept[jp.department] = [];
    byDept[jp.department].push(jp);
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Job Profile</h1>
          <p className="text-sm text-slate-400">Template jabatan — engine utama HRIS</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-xl">
          <Plus size={15} /> Tambah Job Profile
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-sky-300 bg-white">
          <option value="">Semua Level</option>
          {JOB_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-sky-300 bg-white">
          <option value="">Semua Departemen</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center">
          <Loader2 size={16} className="animate-spin" /> Memuat...
        </div>
      )}
      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{err}</div>}

      {!loading && !err && rows.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400">
          <BookOpen size={28} className="mx-auto mb-2 text-slate-300" />
          Belum ada Job Profile. Klik "Tambah" untuk mulai.
        </div>
      )}

      {/* Daftar per departemen */}
      <div className="flex gap-4 items-start">
        <div className="flex-1 flex flex-col gap-3">
          {Object.entries(byDept).map(([dept, items]) => (
            <div key={dept} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50 bg-slate-50 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">{dept}</span>
                <span className="text-xs text-slate-400">{items.length} jabatan</span>
              </div>
              <div className="divide-y divide-slate-50">
                {items.map(jp => (
                  <div key={jp.id}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer ${selected?.id === jp.id ? "bg-sky-50" : ""}`}
                    onClick={() => setSelected(selected?.id === jp.id ? null : jp)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800">{jp.nama}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${LABEL_COLOR[jp.level] ?? "bg-slate-100 text-slate-600"}`}>{jp.level}</span>
                        <span className="text-[11px] text-slate-400 font-mono">{jp.kode}</span>
                      </div>
                      {jp.tujuan_jabatan && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{jp.tujuan_jabatan}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={e => { e.stopPropagation(); openEdit(jp); }}
                        className="p-1.5 hover:bg-sky-50 rounded-lg text-slate-400 hover:text-sky-600">
                        <Pencil size={14} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(jp); }}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                      <ChevronRight size={14} className={`text-slate-300 transition-transform ${selected?.id === jp.id ? "rotate-90" : ""}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 bg-white rounded-2xl border border-slate-100 shadow-sm flex-shrink-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">{selected.nama}</span>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="p-4 flex flex-col gap-3 text-sm">
              <div className="flex gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full ${LABEL_COLOR[selected.level] ?? ""}`}>{selected.level}</span>
                <span className="text-xs text-slate-400 font-mono">{selected.kode}</span>
              </div>
              {selected.tujuan_jabatan && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Tujuan Jabatan</div>
                  <p className="text-slate-700 text-[13px]">{selected.tujuan_jabatan}</p>
                </div>
              )}
              {selected.tugas && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Tugas Utama</div>
                  <p className="text-slate-700 text-[13px] whitespace-pre-line">{selected.tugas}</p>
                </div>
              )}
              {selected.persyaratan_pendidikan && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Persyaratan Pendidikan</div>
                  <p className="text-slate-700 text-[13px]">{selected.persyaratan_pendidikan}</p>
                </div>
              )}
              {(selected.career_path_turun || selected.career_path_naik) && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Career Path</div>
                  <div className="flex items-center gap-1 text-[13px] text-slate-600">
                    {selected.career_path_turun && <span className="text-slate-400">{selected.career_path_turun} →</span>}
                    <span className="font-semibold text-sky-700">{selected.nama}</span>
                    {selected.career_path_naik && <span className="text-slate-400">→ {selected.career_path_naik}</span>}
                  </div>
                </div>
              )}
              {selected.kpi_template && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">KPI Template</div>
                  <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2 font-mono whitespace-pre-wrap">{selected.kpi_template}</div>
                </div>
              )}
            </div>
            <div className="px-4 pb-4">
              <button onClick={() => openEdit(selected)}
                className="w-full text-center text-sm text-sky-600 hover:text-sky-800 py-2 border border-sky-100 rounded-xl hover:bg-sky-50">
                Edit Job Profile
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer tambah/edit */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={closeDrawer} />
          <div className="w-[640px] bg-white h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">{isNew ? "Tambah Job Profile" : "Edit Job Profile"}</h2>
              <button onClick={closeDrawer}><X size={18} className="text-slate-400" /></button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-3 border-b border-slate-100 text-[13px] overflow-x-auto">
              {(["utama", "kompetensi", "kpi", "training", "karir"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`px-3 py-2 rounded-t-lg capitalize whitespace-nowrap ${activeTab === t ? "bg-sky-50 text-sky-700 font-semibold border-b-2 border-sky-500" : "text-slate-500 hover:text-slate-700"}`}>
                  {t === "kpi" ? "Template KPI" : t === "karir" ? "Career Path" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "utama" && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Kode Jabatan *">
                      <Input value={drawer.kode ?? ""} onChange={v => setField("kode", v)} placeholder="e.g. SPV-NET-001" />
                    </Field>
                    <Field label="Level *">
                      <select value={drawer.level ?? "Staff"} onChange={e => setField("level", e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-300">
                        {JOB_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Nama Jabatan *">
                    <Input value={drawer.nama ?? ""} onChange={v => setField("nama", v)} placeholder="e.g. Supervisor Network" />
                  </Field>
                  <Field label="Departemen *">
                    <select value={drawer.department ?? ""} onChange={e => setField("department", e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-300">
                      <option value="">-- Pilih Departemen --</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>
                  <Field label="Tujuan Jabatan">
                    <Textarea value={drawer.tujuan_jabatan ?? ""} onChange={v => setField("tujuan_jabatan", v)}
                      placeholder="Tujuan utama jabatan ini dalam organisasi..." />
                  </Field>
                  <Field label="Tugas & Tanggung Jawab">
                    <Textarea value={drawer.tugas ?? ""} onChange={v => setField("tugas", v)}
                      placeholder="1. Memimpin tim...\n2. Memastikan SLA..." rows={4} />
                  </Field>
                  <Field label="Wewenang">
                    <Textarea value={drawer.wewenang ?? ""} onChange={v => setField("wewenang", v)}
                      placeholder="Wewenang yang dimiliki jabatan ini..." />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Persyaratan Pendidikan">
                      <Input value={drawer.persyaratan_pendidikan ?? ""} onChange={v => setField("persyaratan_pendidikan", v)}
                        placeholder="e.g. S1 Teknik Informatika" />
                    </Field>
                    <Field label="Persyaratan Pengalaman">
                      <Input value={drawer.persyaratan_pengalaman ?? ""} onChange={v => setField("persyaratan_pengalaman", v)}
                        placeholder="e.g. Min 2 tahun di bidang jaringan" />
                    </Field>
                  </div>
                  <Field label="Persyaratan Keahlian / Skill">
                    <Textarea value={drawer.persyaratan_keahlian ?? ""} onChange={v => setField("persyaratan_keahlian", v)}
                      placeholder="Cisco, Linux, Python..." rows={2} />
                  </Field>
                </div>
              )}

              {activeTab === "kompetensi" && (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-slate-500">Masukkan kompetensi yang dibutuhkan jabatan ini. Format bebas atau JSON array.</p>
                  <Field label="Kompetensi (nama : level_required)">
                    <Textarea value={drawer.kompetensi ?? ""} onChange={v => setField("kompetensi", v)}
                      placeholder={'[\n  {"nama": "Leadership", "level_required": 3},\n  {"nama": "Teknis Jaringan", "level_required": 4}\n]'}
                      rows={10} />
                  </Field>
                </div>
              )}

              {activeTab === "kpi" && (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-slate-500">Template KPI untuk jabatan ini. Akan digunakan sebagai acuan saat membuat penilaian KPI.</p>
                  <Field label="Template KPI (aspek, bobot, target, satuan)">
                    <Textarea value={drawer.kpi_template ?? ""} onChange={v => setField("kpi_template", v)}
                      placeholder={'[\n  {"aspek": "Ketersediaan Jaringan", "bobot": 30, "target": 99.5, "satuan": "%"},\n  {"aspek": "Response Time Ticket", "bobot": 25, "target": 2, "satuan": "jam"}\n]'}
                      rows={12} />
                  </Field>
                </div>
              )}

              {activeTab === "training" && (
                <div className="flex flex-col gap-4">
                  <Field label="Training Wajib (Mandatory)">
                    <Textarea value={drawer.training_mandatory ?? ""} onChange={v => setField("training_mandatory", v)}
                      placeholder={'["CCNA", "ISO 27001 Awareness", "K3"]'}
                      rows={4} />
                  </Field>
                  <Field label="Training Rekomendasi">
                    <Textarea value={drawer.training_recommended ?? ""} onChange={v => setField("training_recommended", v)}
                      placeholder={'["Python for Network", "ITIL Foundation"]'}
                      rows={4} />
                  </Field>
                </div>
              )}

              {activeTab === "karir" && (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-slate-500">Jalur karir dari dan menuju jabatan ini.</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Field label="Jabatan Asal (Naik ke sini dari)">
                        <Input value={drawer.career_path_turun ?? ""} onChange={v => setField("career_path_turun", v)}
                          placeholder="e.g. Staff Teknis" />
                      </Field>
                    </div>
                    <div className="text-slate-400 mt-6"><Route size={20} /></div>
                    <div className="flex-1">
                      <Field label="Jabatan Tujuan (Naik ke)">
                        <Input value={drawer.career_path_naik ?? ""} onChange={v => setField("career_path_naik", v)}
                          placeholder="e.g. Manager IT" />
                      </Field>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 text-center text-sm text-slate-500 mt-2">
                    <span className="text-slate-400">{drawer.career_path_turun || "—"}</span>
                    <span className="mx-2 text-slate-300">→</span>
                    <span className="font-semibold text-sky-700">{drawer.nama || "Jabatan ini"}</span>
                    <span className="mx-2 text-slate-300">→</span>
                    <span className="text-slate-400">{drawer.career_path_naik || "—"}</span>
                  </div>
                </div>
              )}
            </div>

            {saveErr && (
              <div className="mx-6 mb-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">{saveErr}</div>
            )}
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={closeDrawer} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Batal</button>
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
