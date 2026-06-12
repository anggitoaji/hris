import { useEffect, useMemo, useState, Fragment, type ReactNode } from "react";
import { Search, X, Loader2, Plus, Pencil, Building2, Trash2, Check, Upload, Download, Eye, FileText, Camera } from "lucide-react";
import {
  fetchEmployees, createEmployee, updateEmployee,
  fetchDivisions, createDivision, updateDivision, deleteDivision, type Division,
  fetchEducation, createEducation, updateEducation, deleteEducation, type EducationRecord,
  fetchCertifications, createCertification, updateCertification, deleteCertification, type CertificationRecord,
  fetchJobHistory, createJobHistory, updateJobHistory, deleteJobHistory, type JobHistoryRecord,
  fetchFamily, createFamily, updateFamily, deleteFamily, type FamilyRecord,
  fetchTraining, createTraining, updateTraining, deleteTraining, type TrainingRecord,
  fetchDocuments, uploadDocument, docPreviewUrl, docDownloadUrl, deleteDocument, type DocumentRecord,
  fetchAuditLogs, type AuditLogRecord,
  photoUrl, uploadPhoto,
} from "../services/api";
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


function Avatar({ name, src, size = 28, gradient }: { name: string; src?: string; size?: number; gradient?: boolean }) {
  const [failed, setFailed] = useState(false);
  const ini = name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  if (src && !failed) {
    return <img src={src} alt="" onError={() => setFailed(true)} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-full flex items-center justify-center font-bold" style={{
      width: size, height: size,
      fontSize: size < 32 ? 10 : 14,
      background: gradient ? "linear-gradient(135deg,#818cf8,#6366f1)" : "#e2e8f0",
      color: gradient ? "#fff" : "#64748b",
    }}>{ini}</div>
  );
}

function initials(nama: string): string {
  return nama.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function masaKerja(join?: string | null): string {
  if (!join) return "-";
  const start = new Date(join);
  if (isNaN(start.getTime())) return "-";
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 0) months = 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y > 0 ? y + " thn " : ""}${m} bln`;
}

function waLink(phone: string): string {
  const d = phone.replace(/\D/g, "");
  const intl = d.startsWith("0") ? "62" + d.slice(1) : d;
  return `https://wa.me/${intl}`;
}

const PROFILE_TABS: { key: string; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "pribadi", label: "Pribadi" },
  { key: "kontak", label: "Kontak" },
  { key: "kepegawaian", label: "Kepegawaian" },
  { key: "keuangan", label: "Keuangan & BPJS" },
  { key: "kompetensi", label: "Kompetensi" },
  { key: "pendidikan", label: "Pendidikan" },
  { key: "sertifikasi", label: "Sertifikasi" },
  { key: "riwayat", label: "Riwayat Jabatan" },
  { key: "keluarga", label: "Keluarga" },
  { key: "training", label: "Training" },
  { key: "dokumen", label: "Dokumen" },
  { key: "audit", label: "Audit Log" },
];

function ComingSoonTab({ name }: { name: string }) {
  return (
    <div className="text-center text-slate-400 py-12">
      <div className="text-sm">Bagian <span className="font-semibold text-slate-500">{name}</span> (data multi-baris)</div>
      <div className="text-xs mt-1">akan ditambahkan di langkah Fase 2 berikutnya.</div>
    </div>
  );
}


const JENJANG_OPTS = ["SD", "SMP", "SMA/SMK", "D1", "D2", "D3", "D4", "S1", "S2", "S3"];

function EducationTab({ employeeId }: { employeeId: number }) {
  const [rows, setRows] = useState<EducationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const blank = { jenjang: "S1", institusi: "", jurusan: "", ipk: "", tahun_masuk: "", tahun_lulus: "" };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setRows(await fetchEducation(employeeId)); } catch { /* */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, [employeeId]);

  function openEdit(r: EducationRecord) {
    setEditId(r.id);
    setForm({ jenjang: r.jenjang, institusi: r.institusi, jurusan: r.jurusan ?? "", ipk: r.ipk != null ? String(r.ipk) : "", tahun_masuk: r.tahun_masuk != null ? String(r.tahun_masuk) : "", tahun_lulus: r.tahun_lulus != null ? String(r.tahun_lulus) : "" });
    setShowAdd(false); setErr(null);
  }
  function openAdd() {
    setEditId(null); setForm(blank); setShowAdd(true); setErr(null);
  }
  function cancel() { setEditId(null); setShowAdd(false); setErr(null); }

  async function save() {
    if (!form.institusi.trim()) { setErr("Institusi wajib diisi."); return; }
    setSaving(true); setErr(null);
    const data: Record<string, unknown> = {
      jenjang: form.jenjang, institusi: form.institusi.trim(),
      jurusan: form.jurusan.trim() || null,
      ipk: form.ipk ? Number(form.ipk) : null,
      tahun_masuk: form.tahun_masuk ? Number(form.tahun_masuk) : null,
      tahun_lulus: form.tahun_lulus ? Number(form.tahun_lulus) : null,
    };
    try {
      if (editId != null) { await updateEducation(editId, data); }
      else { await createEducation({ ...data, employee_id: employeeId }); }
      cancel(); await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Gagal menyimpan."); }
    setSaving(false);
  }

  async function remove(id: number) {
    if (!window.confirm("Hapus data pendidikan ini?")) return;
    try { await deleteEducation(id); await load(); } catch { /* */ }
  }

  const ic = "w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";

  function FormRow() {
    return (
      <tr className="bg-sky-50/50">
        <td className="py-2 px-2"><select className={ic} value={form.jenjang} onChange={(ev) => setForm({ ...form, jenjang: ev.target.value })}>{JENJANG_OPTS.map((j) => <option key={j}>{j}</option>)}</select></td>
        <td className="py-2 px-2"><input className={ic} value={form.institusi} onChange={(ev) => setForm({ ...form, institusi: ev.target.value })} placeholder="Nama institusi" /></td>
        <td className="py-2 px-2"><input className={ic} value={form.jurusan} onChange={(ev) => setForm({ ...form, jurusan: ev.target.value })} placeholder="Jurusan" /></td>
        <td className="py-2 px-2"><input className={ic} value={form.ipk} onChange={(ev) => setForm({ ...form, ipk: ev.target.value })} placeholder="0.00" style={{ width: 60 }} /></td>
        <td className="py-2 px-2"><input className={ic} value={form.tahun_masuk} onChange={(ev) => setForm({ ...form, tahun_masuk: ev.target.value })} placeholder="2020" style={{ width: 60 }} /></td>
        <td className="py-2 px-2"><input className={ic} value={form.tahun_lulus} onChange={(ev) => setForm({ ...form, tahun_lulus: ev.target.value })} placeholder="2024" style={{ width: 60 }} /></td>
        <td className="py-2 px-2 whitespace-nowrap">
          <button onClick={save} disabled={saving} className="text-sm text-sky-600 hover:text-sky-700 mr-2">{saving ? "..." : "Simpan"}</button>
          <button onClick={cancel} className="text-sm text-slate-400 hover:text-slate-600">Batal</button>
        </td>
      </tr>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Riwayat Pendidikan</div>
        <button onClick={openAdd} className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700"><Plus size={15} /> Tambah</button>
      </div>
      {err && <div className="text-sm text-red-600 mb-2">{err}</div>}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center"><Loader2 size={16} className="animate-spin" /> Memuat...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 px-2 font-bold">Jenjang</th>
                <th className="py-2 px-2 font-bold">Institusi</th>
                <th className="py-2 px-2 font-bold">Jurusan</th>
                <th className="py-2 px-2 font-bold">IPK</th>
                <th className="py-2 px-2 font-bold">Masuk</th>
                <th className="py-2 px-2 font-bold">Lulus</th>
                <th className="py-2 px-2 font-bold" style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {showAdd && <FormRow />}
              {rows.map((r) =>
                editId === r.id ? (
                  <FormRow key={r.id} />
                ) : (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-2 text-slate-700">{r.jenjang}</td>
                    <td className="py-2 px-2 text-slate-700 font-medium">{r.institusi}</td>
                    <td className="py-2 px-2 text-slate-600">{r.jurusan || "-"}</td>
                    <td className="py-2 px-2 text-slate-600">{r.ipk != null ? r.ipk.toFixed(2) : "-"}</td>
                    <td className="py-2 px-2 text-slate-600">{r.tahun_masuk ?? "-"}</td>
                    <td className="py-2 px-2 text-slate-600">{r.tahun_lulus ?? "-"}</td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <button onClick={() => openEdit(r)} className="text-sm text-sky-600 hover:text-sky-700 mr-2">Edit</button>
                      <button onClick={() => remove(r.id)} className="text-sm text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                )
              )}
              {rows.length === 0 && !showAdd && (
                <tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada data pendidikan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


function CertificationTab({ employeeId }: { employeeId: number }) {
  const [rows, setRows] = useState<CertificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const blank = { nama: "", nomor: "", penerbit: "", tanggal_terbit: "", tanggal_kadaluarsa: "" };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setRows(await fetchCertifications(employeeId)); } catch { /* */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, [employeeId]);

  function openEdit(r: CertificationRecord) {
    setEditId(r.id);
    setForm({ nama: r.nama, nomor: r.nomor ?? "", penerbit: r.penerbit ?? "", tanggal_terbit: r.tanggal_terbit ?? "", tanggal_kadaluarsa: r.tanggal_kadaluarsa ?? "" });
    setShowAdd(false); setErr(null);
  }
  function openAdd() { setEditId(null); setForm(blank); setShowAdd(true); setErr(null); }
  function cancel() { setEditId(null); setShowAdd(false); setErr(null); }

  async function save() {
    if (!form.nama.trim()) { setErr("Nama sertifikasi wajib diisi."); return; }
    setSaving(true); setErr(null);
    const data: Record<string, unknown> = {
      nama: form.nama.trim(),
      nomor: form.nomor.trim() || null,
      penerbit: form.penerbit.trim() || null,
      tanggal_terbit: form.tanggal_terbit || null,
      tanggal_kadaluarsa: form.tanggal_kadaluarsa || null,
    };
    try {
      if (editId != null) { await updateCertification(editId, data); }
      else { await createCertification({ ...data, employee_id: employeeId }); }
      cancel(); await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Gagal menyimpan."); }
    setSaving(false);
  }

  async function remove(id: number) {
    if (!window.confirm("Hapus sertifikasi ini?")) return;
    try { await deleteCertification(id); await load(); } catch { /* */ }
  }

  const ic = "w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";

  function FormRow() {
    return (
      <tr className="bg-sky-50/50">
        <td className="py-2 px-2"><input className={ic} value={form.nama} onChange={(ev) => setForm({ ...form, nama: ev.target.value })} placeholder="Nama sertifikasi" /></td>
        <td className="py-2 px-2"><input className={ic} value={form.nomor} onChange={(ev) => setForm({ ...form, nomor: ev.target.value })} placeholder="Nomor" /></td>
        <td className="py-2 px-2"><input className={ic} value={form.penerbit} onChange={(ev) => setForm({ ...form, penerbit: ev.target.value })} placeholder="Penerbit" /></td>
        <td className="py-2 px-2"><input type="date" className={ic} value={form.tanggal_terbit} onChange={(ev) => setForm({ ...form, tanggal_terbit: ev.target.value })} /></td>
        <td className="py-2 px-2"><input type="date" className={ic} value={form.tanggal_kadaluarsa} onChange={(ev) => setForm({ ...form, tanggal_kadaluarsa: ev.target.value })} /></td>
        <td className="py-2 px-2 whitespace-nowrap">
          <button onClick={save} disabled={saving} className="text-sm text-sky-600 hover:text-sky-700 mr-2">{saving ? "..." : "Simpan"}</button>
          <button onClick={cancel} className="text-sm text-slate-400 hover:text-slate-600">Batal</button>
        </td>
      </tr>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Sertifikasi</div>
        <button onClick={openAdd} className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700"><Plus size={15} /> Tambah</button>
      </div>
      {err && <div className="text-sm text-red-600 mb-2">{err}</div>}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center"><Loader2 size={16} className="animate-spin" /> Memuat...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 px-2 font-bold">Nama Sertifikasi</th>
                <th className="py-2 px-2 font-bold">Nomor</th>
                <th className="py-2 px-2 font-bold">Penerbit</th>
                <th className="py-2 px-2 font-bold">Terbit</th>
                <th className="py-2 px-2 font-bold">Kadaluarsa</th>
                <th className="py-2 px-2 font-bold" style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {showAdd && <FormRow />}
              {rows.map((r) =>
                editId === r.id ? (
                  <FormRow key={r.id} />
                ) : (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-2 text-slate-700 font-medium">{r.nama}</td>
                    <td className="py-2 px-2 text-slate-600">{r.nomor || "-"}</td>
                    <td className="py-2 px-2 text-slate-600">{r.penerbit || "-"}</td>
                    <td className="py-2 px-2 text-slate-600">{r.tanggal_terbit || "-"}</td>
                    <td className="py-2 px-2 text-slate-600">{r.tanggal_kadaluarsa || "-"}</td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <button onClick={() => openEdit(r)} className="text-sm text-sky-600 hover:text-sky-700 mr-2">Edit</button>
                      <button onClick={() => remove(r.id)} className="text-sm text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                )
              )}
              {rows.length === 0 && !showAdd && (
                <tr><td colSpan={6} className="text-center text-slate-400 py-6">Belum ada data sertifikasi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function JobHistoryTab({ employeeId }: { employeeId: number }) {
  const [rows, setRows] = useState<JobHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const blank = { jabatan_lama: "", jabatan_baru: "", divisi_lama: "", divisi_baru: "", tanggal_efektif: "", alasan: "" };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function load() { setLoading(true); try { setRows(await fetchJobHistory(employeeId)); } catch {} setLoading(false); }
  useEffect(() => { load(); }, [employeeId]);
  function openEdit(r: JobHistoryRecord) { setEditId(r.id); setForm({ jabatan_lama: r.jabatan_lama ?? "", jabatan_baru: r.jabatan_baru ?? "", divisi_lama: r.divisi_lama ?? "", divisi_baru: r.divisi_baru ?? "", tanggal_efektif: r.tanggal_efektif ?? "", alasan: r.alasan ?? "" }); setShowAdd(false); setErr(null); }
  function openAdd() { setEditId(null); setForm(blank); setShowAdd(true); setErr(null); }
  function cancel() { setEditId(null); setShowAdd(false); setErr(null); }
  async function save() { setSaving(true); setErr(null); const d: Record<string,unknown> = { jabatan_lama: form.jabatan_lama.trim()||null, jabatan_baru: form.jabatan_baru.trim()||null, divisi_lama: form.divisi_lama.trim()||null, divisi_baru: form.divisi_baru.trim()||null, tanggal_efektif: form.tanggal_efektif||null, alasan: form.alasan.trim()||null }; try { if(editId!=null){await updateJobHistory(editId,d);}else{await createJobHistory({...d,employee_id:employeeId});} cancel(); await load(); } catch(e){setErr(e instanceof Error?e.message:"Gagal.");} setSaving(false); }
  async function remove(id:number){ if(!window.confirm("Hapus riwayat jabatan ini?"))return; try{await deleteJobHistory(id);await load();}catch{} }
  const ic="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";
  function FormRow(){return(
    <tr className="bg-sky-50/50">
      <td className="py-2 px-2"><input className={ic} value={form.jabatan_lama} onChange={ev=>setForm({...form,jabatan_lama:ev.target.value})} placeholder="Jabatan lama"/></td>
      <td className="py-2 px-2"><input className={ic} value={form.jabatan_baru} onChange={ev=>setForm({...form,jabatan_baru:ev.target.value})} placeholder="Jabatan baru"/></td>
      <td className="py-2 px-2"><input className={ic} value={form.divisi_lama} onChange={ev=>setForm({...form,divisi_lama:ev.target.value})} placeholder="Divisi lama"/></td>
      <td className="py-2 px-2"><input className={ic} value={form.divisi_baru} onChange={ev=>setForm({...form,divisi_baru:ev.target.value})} placeholder="Divisi baru"/></td>
      <td className="py-2 px-2"><input type="date" className={ic} value={form.tanggal_efektif} onChange={ev=>setForm({...form,tanggal_efektif:ev.target.value})}/></td>
      <td className="py-2 px-2"><input className={ic} value={form.alasan} onChange={ev=>setForm({...form,alasan:ev.target.value})} placeholder="Alasan"/></td>
      <td className="py-2 px-2 whitespace-nowrap"><button onClick={save} disabled={saving} className="text-sm text-sky-600 hover:text-sky-700 mr-2">{saving?"...":"Simpan"}</button><button onClick={cancel} className="text-sm text-slate-400 hover:text-slate-600">Batal</button></td>
    </tr>);}
  return(<div>
    <div className="flex items-center justify-between mb-3"><div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Riwayat Jabatan</div><button onClick={openAdd} className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700"><Plus size={15}/> Tambah</button></div>
    {err&&<div className="text-sm text-red-600 mb-2">{err}</div>}
    {loading?<div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center"><Loader2 size={16} className="animate-spin"/> Memuat...</div>:
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500 border-b border-slate-100">
      <th className="py-2 px-2 font-bold">Jabatan Lama</th><th className="py-2 px-2 font-bold">Jabatan Baru</th>
      <th className="py-2 px-2 font-bold">Divisi Lama</th><th className="py-2 px-2 font-bold">Divisi Baru</th>
      <th className="py-2 px-2 font-bold">Tgl Efektif</th><th className="py-2 px-2 font-bold">Alasan</th>
      <th className="py-2 px-2 font-bold" style={{width:100}}></th>
    </tr></thead><tbody>
      {showAdd&&<FormRow/>}
      {rows.map(r=>editId===r.id?<FormRow key={r.id}/>:(
        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
          <td className="py-2 px-2 text-slate-700">{r.jabatan_lama||"-"}</td>
          <td className="py-2 px-2 text-slate-700 font-medium">{r.jabatan_baru||"-"}</td>
          <td className="py-2 px-2 text-slate-600">{r.divisi_lama||"-"}</td>
          <td className="py-2 px-2 text-slate-600">{r.divisi_baru||"-"}</td>
          <td className="py-2 px-2 text-slate-600">{r.tanggal_efektif||"-"}</td>
          <td className="py-2 px-2 text-slate-600">{r.alasan||"-"}</td>
          <td className="py-2 px-2 whitespace-nowrap"><button onClick={()=>openEdit(r)} className="text-sm text-sky-600 hover:text-sky-700 mr-2">Edit</button><button onClick={()=>remove(r.id)} className="text-sm text-red-400 hover:text-red-600"><Trash2 size={14}/></button></td>
        </tr>))}
      {rows.length===0&&!showAdd&&<tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada riwayat jabatan.</td></tr>}
    </tbody></table></div>}
  </div>);
}

const HUBUNGAN_OPTS=["Pasangan","Anak"];
const GENDER_OPTS=["Laki-laki","Perempuan"];

function FamilyTab({ employeeId }: { employeeId: number }) {
  const [rows, setRows] = useState<FamilyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const blank = { hubungan: "Anak", nama: "", jenis_kelamin: "", tempat_lahir: "", tanggal_lahir: "", pendidikan: "", no_hp: "" };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function load() { setLoading(true); try { setRows(await fetchFamily(employeeId)); } catch {} setLoading(false); }
  useEffect(() => { load(); }, [employeeId]);
  function openEdit(r: FamilyRecord) { setEditId(r.id); setForm({ hubungan: r.hubungan, nama: r.nama, jenis_kelamin: r.jenis_kelamin??"", tempat_lahir: r.tempat_lahir??"", tanggal_lahir: r.tanggal_lahir??"", pendidikan: r.pendidikan??"", no_hp: r.no_hp??"" }); setShowAdd(false); setErr(null); }
  function openAdd() { setEditId(null); setForm(blank); setShowAdd(true); setErr(null); }
  function cancel() { setEditId(null); setShowAdd(false); setErr(null); }
  async function save() { if(!form.nama.trim()){setErr("Nama wajib diisi.");return;} setSaving(true); setErr(null); const d:Record<string,unknown>={ hubungan:form.hubungan, nama:form.nama.trim(), jenis_kelamin:form.jenis_kelamin||null, tempat_lahir:form.tempat_lahir.trim()||null, tanggal_lahir:form.tanggal_lahir||null, pendidikan:form.pendidikan.trim()||null, no_hp:form.no_hp.trim()||null }; try{ if(editId!=null){await updateFamily(editId,d);}else{await createFamily({...d,employee_id:employeeId});} cancel();await load(); }catch(e){setErr(e instanceof Error?e.message:"Gagal.");} setSaving(false); }
  async function remove(id:number){ if(!window.confirm("Hapus data keluarga ini?"))return; try{await deleteFamily(id);await load();}catch{} }
  const ic="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";
  function FormRow(){return(
    <tr className="bg-sky-50/50">
      <td className="py-2 px-2"><select className={ic} value={form.hubungan} onChange={ev=>setForm({...form,hubungan:ev.target.value})}>{HUBUNGAN_OPTS.map(h=><option key={h}>{h}</option>)}</select></td>
      <td className="py-2 px-2"><input className={ic} value={form.nama} onChange={ev=>setForm({...form,nama:ev.target.value})} placeholder="Nama"/></td>
      <td className="py-2 px-2"><select className={ic} value={form.jenis_kelamin} onChange={ev=>setForm({...form,jenis_kelamin:ev.target.value})}><option value="">-</option>{GENDER_OPTS.map(g=><option key={g}>{g}</option>)}</select></td>
      <td className="py-2 px-2"><input className={ic} value={form.tempat_lahir} onChange={ev=>setForm({...form,tempat_lahir:ev.target.value})} placeholder="Kota"/></td>
      <td className="py-2 px-2"><input type="date" className={ic} value={form.tanggal_lahir} onChange={ev=>setForm({...form,tanggal_lahir:ev.target.value})}/></td>
      <td className="py-2 px-2"><input className={ic} value={form.pendidikan} onChange={ev=>setForm({...form,pendidikan:ev.target.value})} placeholder="SD/SMP/..."/></td>
      <td className="py-2 px-2"><input className={ic} value={form.no_hp} onChange={ev=>setForm({...form,no_hp:ev.target.value})} placeholder="08xxx"/></td>
      <td className="py-2 px-2 whitespace-nowrap"><button onClick={save} disabled={saving} className="text-sm text-sky-600 hover:text-sky-700 mr-2">{saving?"...":"Simpan"}</button><button onClick={cancel} className="text-sm text-slate-400 hover:text-slate-600">Batal</button></td>
    </tr>);}
  return(<div>
    <div className="flex items-center justify-between mb-3"><div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Data Keluarga</div><button onClick={openAdd} className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700"><Plus size={15}/> Tambah</button></div>
    {err&&<div className="text-sm text-red-600 mb-2">{err}</div>}
    {loading?<div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center"><Loader2 size={16} className="animate-spin"/> Memuat...</div>:
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500 border-b border-slate-100">
      <th className="py-2 px-2 font-bold">Hubungan</th><th className="py-2 px-2 font-bold">Nama</th>
      <th className="py-2 px-2 font-bold">JK</th><th className="py-2 px-2 font-bold">Tempat Lahir</th>
      <th className="py-2 px-2 font-bold">Tgl Lahir</th><th className="py-2 px-2 font-bold">Pendidikan</th>
      <th className="py-2 px-2 font-bold">No HP</th><th className="py-2 px-2 font-bold" style={{width:100}}></th>
    </tr></thead><tbody>
      {showAdd&&<FormRow/>}
      {rows.map(r=>editId===r.id?<FormRow key={r.id}/>:(
        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
          <td className="py-2 px-2"><span className={`text-xs px-2 py-0.5 rounded-full ${r.hubungan==="Pasangan"?"bg-violet-100 text-violet-700":"bg-sky-100 text-sky-700"}`}>{r.hubungan}</span></td>
          <td className="py-2 px-2 text-slate-700 font-medium">{r.nama}</td>
          <td className="py-2 px-2 text-slate-600">{r.jenis_kelamin||"-"}</td>
          <td className="py-2 px-2 text-slate-600">{r.tempat_lahir||"-"}</td>
          <td className="py-2 px-2 text-slate-600">{r.tanggal_lahir||"-"}</td>
          <td className="py-2 px-2 text-slate-600">{r.pendidikan||"-"}</td>
          <td className="py-2 px-2 text-slate-600">{r.no_hp||"-"}</td>
          <td className="py-2 px-2 whitespace-nowrap"><button onClick={()=>openEdit(r)} className="text-sm text-sky-600 hover:text-sky-700 mr-2">Edit</button><button onClick={()=>remove(r.id)} className="text-sm text-red-400 hover:text-red-600"><Trash2 size={14}/></button></td>
        </tr>))}
      {rows.length===0&&!showAdd&&<tr><td colSpan={8} className="text-center text-slate-400 py-6">Belum ada data keluarga.</td></tr>}
    </tbody></table></div>}
  </div>);
}

function TrainingTab({ employeeId }: { employeeId: number }) {
  const [rows, setRows] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const blank = { nama: "", penyelenggara: "", tanggal: "", nilai: "" };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function load() { setLoading(true); try { setRows(await fetchTraining(employeeId)); } catch {} setLoading(false); }
  useEffect(() => { load(); }, [employeeId]);
  function openEdit(r: TrainingRecord) { setEditId(r.id); setForm({ nama: r.nama, penyelenggara: r.penyelenggara??"", tanggal: r.tanggal??"", nilai: r.nilai!=null?String(r.nilai):"" }); setShowAdd(false); setErr(null); }
  function openAdd() { setEditId(null); setForm(blank); setShowAdd(true); setErr(null); }
  function cancel() { setEditId(null); setShowAdd(false); setErr(null); }
  async function save() { if(!form.nama.trim()){setErr("Nama training wajib diisi.");return;} setSaving(true); setErr(null); const d:Record<string,unknown>={ nama:form.nama.trim(), penyelenggara:form.penyelenggara.trim()||null, tanggal:form.tanggal||null, nilai:form.nilai?Number(form.nilai):null }; try{ if(editId!=null){await updateTraining(editId,d);}else{await createTraining({...d,employee_id:employeeId});} cancel();await load(); }catch(e){setErr(e instanceof Error?e.message:"Gagal.");} setSaving(false); }
  async function remove(id:number){ if(!window.confirm("Hapus data training ini?"))return; try{await deleteTraining(id);await load();}catch{} }
  const ic="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";
  function FormRow(){return(
    <tr className="bg-sky-50/50">
      <td className="py-2 px-2"><input className={ic} value={form.nama} onChange={ev=>setForm({...form,nama:ev.target.value})} placeholder="Nama training"/></td>
      <td className="py-2 px-2"><input className={ic} value={form.penyelenggara} onChange={ev=>setForm({...form,penyelenggara:ev.target.value})} placeholder="Penyelenggara"/></td>
      <td className="py-2 px-2"><input type="date" className={ic} value={form.tanggal} onChange={ev=>setForm({...form,tanggal:ev.target.value})}/></td>
      <td className="py-2 px-2"><input className={ic} value={form.nilai} onChange={ev=>setForm({...form,nilai:ev.target.value})} placeholder="0-100" style={{width:60}}/></td>
      <td className="py-2 px-2 whitespace-nowrap"><button onClick={save} disabled={saving} className="text-sm text-sky-600 hover:text-sky-700 mr-2">{saving?"...":"Simpan"}</button><button onClick={cancel} className="text-sm text-slate-400 hover:text-slate-600">Batal</button></td>
    </tr>);}
  return(<div>
    <div className="flex items-center justify-between mb-3"><div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Training & Development</div><button onClick={openAdd} className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700"><Plus size={15}/> Tambah</button></div>
    {err&&<div className="text-sm text-red-600 mb-2">{err}</div>}
    {loading?<div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center"><Loader2 size={16} className="animate-spin"/> Memuat...</div>:
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500 border-b border-slate-100">
      <th className="py-2 px-2 font-bold">Nama Training</th><th className="py-2 px-2 font-bold">Penyelenggara</th>
      <th className="py-2 px-2 font-bold">Tanggal</th><th className="py-2 px-2 font-bold">Nilai</th>
      <th className="py-2 px-2 font-bold" style={{width:100}}></th>
    </tr></thead><tbody>
      {showAdd&&<FormRow/>}
      {rows.map(r=>editId===r.id?<FormRow key={r.id}/>:(
        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
          <td className="py-2 px-2 text-slate-700 font-medium">{r.nama}</td>
          <td className="py-2 px-2 text-slate-600">{r.penyelenggara||"-"}</td>
          <td className="py-2 px-2 text-slate-600">{r.tanggal||"-"}</td>
          <td className="py-2 px-2 text-slate-600">{r.nilai!=null?r.nilai:"-"}</td>
          <td className="py-2 px-2 whitespace-nowrap"><button onClick={()=>openEdit(r)} className="text-sm text-sky-600 hover:text-sky-700 mr-2">Edit</button><button onClick={()=>remove(r.id)} className="text-sm text-red-400 hover:text-red-600"><Trash2 size={14}/></button></td>
        </tr>))}
      {rows.length===0&&!showAdd&&<tr><td colSpan={5} className="text-center text-slate-400 py-6">Belum ada data training.</td></tr>}
    </tbody></table></div>}
  </div>);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

const DOC_CATEGORIES = ["Identitas", "Pendidikan", "Kepegawaian", "Sertifikasi", "Kesehatan", "Lainnya"];

function DocumentsTab({ employeeId }: { employeeId: number }) {
  const [rows, setRows] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [category, setCategory] = useState("Identitas");
  const [subCat, setSubCat] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);

  async function load() { setLoading(true); try { setRows(await fetchDocuments(employeeId)); } catch {} setLoading(false); }
  useEffect(() => { load(); }, [employeeId]);

  async function doUpload() {
    if (!file) { setErr("Pilih file terlebih dahulu."); return; }
    setUploading(true); setErr(null);
    try {
      await uploadDocument(file, employeeId, category, subCat.trim());
      setFile(null); setSubCat(""); setShowUpload(false); await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Upload gagal."); }
    setUploading(false);
  }

  async function remove(id: number) {
    if (!window.confirm("Hapus dokumen ini?")) return;
    try { await deleteDocument(id); await load(); } catch {}
  }

  const grouped = DOC_CATEGORIES.map(cat => ({ cat, docs: rows.filter(r => r.category === cat) })).filter(g => g.docs.length > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Dokumen Karyawan</div>
        <button onClick={() => { setShowUpload(!showUpload); setErr(null); }} className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700">
          <Upload size={15} /> Upload Dokumen
        </button>
      </div>

      {showUpload && (
        <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[11px] text-slate-500 font-medium block mb-1">Kategori</label>
              <select className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300" value={category} onChange={ev => setCategory(ev.target.value)}>
                {DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-medium block mb-1">Jenis Dokumen</label>
              <input className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300" value={subCat} onChange={ev => setSubCat(ev.target.value)} placeholder="mis. KTP, Ijazah, Kontrak Kerja" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg cursor-pointer hover:bg-white">
              <FileText size={15} className="text-slate-400" />
              <span className="text-slate-600">{file ? file.name : "Pilih file (PDF/JPG/PNG, maks 10MB)"}</span>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={ev => { if (ev.target.files?.[0]) setFile(ev.target.files[0]); }} />
            </label>
            <button onClick={doUpload} disabled={uploading} className="px-4 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60 flex items-center gap-2">
              {uploading && <Loader2 size={14} className="animate-spin" />} Upload
            </button>
            <button onClick={() => { setShowUpload(false); setFile(null); setErr(null); }} className="text-sm text-slate-400 hover:text-slate-600">Batal</button>
          </div>
          {err && <div className="text-sm text-red-600 mt-2">{err}</div>}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center"><Loader2 size={16} className="animate-spin" /> Memuat...</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-slate-400 py-8">Belum ada dokumen.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(g => (
            <div key={g.cat}>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{g.cat}</div>
              <div className="flex flex-col gap-1">
                {g.docs.map(d => (
                  <div key={d.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-3 py-2 hover:border-slate-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText size={18} className={d.mime_type.includes("pdf") ? "text-red-400" : "text-sky-400"} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-700 truncate">{d.filename_original}</div>
                        <div className="text-[11px] text-slate-400">
                          {d.sub_category && <span className="mr-2">{d.sub_category}</span>}
                          {formatSize(d.file_size)} — {new Date(d.uploaded_at).toLocaleDateString("id-ID")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setPreviewDoc(d)} className="p-1.5 rounded-md hover:bg-slate-50 text-slate-400 hover:text-sky-600" title="Preview"><Eye size={16} /></button>
                      <a href={docDownloadUrl(d.id)} className="p-1.5 rounded-md hover:bg-slate-50 text-slate-400 hover:text-emerald-600" title="Download"><Download size={16} /></a>
                      <button onClick={() => remove(d.id)} className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600" title="Hapus"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewDoc && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPreviewDoc(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: "70vw", maxWidth: 900, height: "80vh" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-700 truncate">{previewDoc.filename_original}</div>
                <div className="text-[11px] text-slate-400">{previewDoc.sub_category || previewDoc.category}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={docDownloadUrl(previewDoc.id)} className="text-sm text-sky-600 hover:text-sky-700 flex items-center gap-1"><Download size={14} /> Download</a>
                <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-slate-600 ml-2"><X size={20} /></button>
              </div>
            </div>
            <div className="flex items-center justify-center bg-slate-50" style={{ height: "calc(80vh - 52px)" }}>
              {previewDoc.mime_type.startsWith("image/") ? (
                <img src={docPreviewUrl(previewDoc.id)} alt={previewDoc.filename_original} className="max-w-full max-h-full object-contain" />
              ) : (
                <iframe src={docPreviewUrl(previewDoc.id)} className="w-full h-full border-0" title={previewDoc.filename_original} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ACTION_COLOR: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-sky-100 text-sky-700",
  DELETE: "bg-red-100 text-red-700",
};

function DiffView({ label, old_data, new_data }: { label: string; old_data: string | null; new_data: string | null }) {
  const [open, setOpen] = useState(false);
  if (!old_data && !new_data) return null;
  let oldObj: Record<string, unknown> = {};
  let newObj: Record<string, unknown> = {};
  try { if (old_data) oldObj = JSON.parse(old_data); } catch {}
  try { if (new_data) newObj = JSON.parse(new_data); } catch {}
  const allKeys = [...new Set([...Object.keys(oldObj), ...Object.keys(newObj)])];
  const changed = allKeys.filter(k => JSON.stringify(oldObj[k]) !== JSON.stringify(newObj[k]));
  if (changed.length === 0) return null;
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="text-[11px] text-sky-600 hover:text-sky-700">{open ? "Sembunyikan" : `Lihat ${changed.length} perubahan`}</button>
      {open && (
        <div className="mt-1 text-[11px] bg-slate-50 rounded-lg p-2 space-y-1">
          {changed.map(k => (
            <div key={k} className="flex gap-2">
              <span className="font-medium text-slate-500 w-28 shrink-0">{k}</span>
              <span className="text-red-500 line-through">{String(oldObj[k] ?? "-")}</span>
              <span className="text-slate-400">→</span>
              <span className="text-emerald-600">{String(newObj[k] ?? "-")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditTab({ employeeId }: { employeeId: number }) {
  const [rows, setRows] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setRows(await fetchAuditLogs({ employee_id: employeeId, limit: 100 })); } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, [employeeId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Audit Log</div>
        <div className="text-[11px] text-slate-400">{rows.length} entri</div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center"><Loader2 size={16} className="animate-spin" /> Memuat...</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-slate-400 py-8">Belum ada riwayat perubahan.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(r => (
            <div key={r.id} className="bg-white border border-slate-100 rounded-lg px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${ACTION_COLOR[r.action] ?? "bg-slate-100 text-slate-600"}`}>{r.action}</span>
                    <span className="text-[11px] text-slate-400">{r.entity_type}</span>
                  </div>
                  <div className="text-sm text-slate-700">{r.description || "-"}</div>
                  <DiffView label="Perubahan" old_data={r.old_data} new_data={r.new_data} />
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-medium text-slate-600">{r.username}</div>
                  <div className="text-[10px] text-slate-400">{new Date(r.created_at).toLocaleString("id-ID")}</div>
                  <div className="text-[10px] text-slate-300">{r.ip_address}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeeProfile({ e, role }: { e: Employee; role: string }) {
  const [tab, setTab] = useState("overview");
  const visibleTabs = PROFILE_TABS.filter(t => t.key !== "audit" || role === "Super Admin");
  return (
    <div>
      <div className="flex gap-1 border-b border-slate-100 px-3 overflow-x-auto bg-white">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === t.key ? "border-sky-500 text-sky-700 font-semibold" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5 flex flex-col gap-5">
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="NIK" value={e.nik} />
              <Field label="Status" value={e.status} />
              <Field label="Divisi" value={e.department} />
              <Field label="Jabatan" value={e.position} />
              <Field label="Masa Kerja" value={masaKerja(e.join_date)} />
              <Field label="Atasan Langsung" value={e.supervisor} />
              <Field label="Lokasi Kerja" value={e.work_location} />
              <Field label="Skor KPI" value={e.kpi_score} />
            </div>
            <Group title="Kontak Cepat">
              <Field label="Email" value={e.email} />
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400">No WhatsApp</span>
                {e.phone
                  ? <a href={waLink(e.phone)} target="_blank" rel="noreferrer" className="text-sm text-emerald-600 hover:underline">{e.phone}</a>
                  : <span className="text-sm text-slate-300">-</span>}
              </div>
            </Group>
          </>
        )}

        {tab === "pribadi" && (
          <>
            <Group title="Data Pribadi">
              <Field label="NIK" value={e.nik} />
              <Field label="Nama Panggilan" value={e.nama_panggilan} />
              <Field label="No. KTP" value={e.ktp} />
              <Field label="No. KK" value={e.no_kk} />
              <Field label="Jenis Kelamin" value={e.gender} />
              <Field label="Golongan Darah" value={e.blood_type} />
              <Field label="Tempat Lahir" value={e.birth_place} />
              <Field label="Tanggal Lahir" value={e.birth_date} />
              <Field label="Agama" value={e.religion} />
              <Field label="Status Pernikahan" value={e.marital_status} />
              <Field label="Pendidikan" value={e.education} />
            </Group>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Alamat</div>
              <div className={`text-sm ${e.address ? "text-slate-700" : "text-slate-300"}`}>{e.address ?? "-"}</div>
            </div>
          </>
        )}

        {tab === "kontak" && (
          <>
            <Group title="Kontak">
              <Field label="Email" value={e.email} />
              <Field label="Telepon" value={e.phone} />
            </Group>
            <Group title="Kontak Darurat">
              <Field label="Nama" value={e.emergency_name} />
              <Field label="Telepon" value={e.emergency_phone} />
              <Field label="Hubungan" value={e.emergency_relation} />
            </Group>
          </>
        )}

        {tab === "kepegawaian" && (
          <>
            <Group title="Kepegawaian">
              <Field label="Status" value={e.status} />
              <Field label="Tipe Kontrak" value={e.contract_type} />
              <Field label="Tanggal Masuk" value={e.join_date} />
              <Field label="Skor KPI" value={e.kpi_score} />
            </Group>
            <Group title="Struktur Organisasi">
              <Field label="Divisi" value={e.department} />
              <Field label="Jabatan" value={e.position} />
              <Field label="Grade" value={e.grade} />
              <Field label="Lokasi Kerja" value={e.work_location} />
              <Field label="Atasan Langsung" value={e.supervisor} />
            </Group>
          </>
        )}

        {tab === "keuangan" && (
          <Group title="Keuangan & BPJS">
            <Field label="NPWP" value={e.npwp} />
            <Field label="Bank" value={e.bank_name} />
            <Field label="No. Rekening" value={e.bank_account} />
            <Field label="BPJS Kesehatan" value={e.bpjs_kesehatan} />
            <Field label="BPJS Ketenagakerjaan" value={e.bpjs_ketenagakerjaan} />
          </Group>
        )}

        {tab === "kompetensi" && (
          <>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Keahlian / Kompetensi</div>
              {e.skills ? (
                <div className="flex flex-wrap gap-1.5">
                  {e.skills.split(",").map((x) => x.trim()).filter(Boolean).map((x, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">{x}</span>
                  ))}
                </div>
              ) : <div className="text-sm text-slate-300">-</div>}
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Jobdesk / Uraian Tugas</div>
              <div className={`text-sm whitespace-pre-line ${e.job_desc ? "text-slate-700" : "text-slate-300"}`}>{e.job_desc ?? "-"}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Catatan</div>
              <div className={`text-sm whitespace-pre-line ${e.catatan ? "text-slate-700" : "text-slate-300"}`}>{e.catatan ?? "-"}</div>
            </div>
          </>
        )}

        {tab === "pendidikan" && <EducationTab employeeId={e.id} />}
        {tab === "sertifikasi" && <CertificationTab employeeId={e.id} />}
        {tab === "riwayat" && <JobHistoryTab employeeId={e.id} />}
        {tab === "keluarga" && <FamilyTab employeeId={e.id} />}
        {tab === "training" && <TrainingTab employeeId={e.id} />}

        {tab === "dokumen" && <DocumentsTab employeeId={e.id} />}

        {tab === "audit" && <AuditTab employeeId={e.id} />}
      </div>
    </div>
  );
}


type FormState = Record<string, string>;
const FIELD_KEYS = [
  "nik", "nama", "email", "phone", "department", "position", "status", "contract_type",
  "join_date", "kpi_score", "ktp", "gender", "birth_place", "birth_date", "religion",
  "marital_status", "address", "education", "npwp", "bank_name", "bank_account",
  "bpjs_kesehatan", "bpjs_ketenagakerjaan", "emergency_name", "emergency_phone", "emergency_relation",
  "skills", "job_desc", "catatan",
  "nama_panggilan", "blood_type", "no_kk",
  "grade", "work_location", "supervisor",
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
    { key: "status", label: "Status", type: "select", options: STATUS_OPTS, required: true },
    { key: "contract_type", label: "Tipe Kontrak", type: "select", options: ["Tetap", "Kontrak", "Magang", "Outsourcing"], required: true },
    { key: "join_date", label: "Tanggal Masuk", type: "date" },
    { key: "kpi_score", label: "Skor KPI", type: "number" },
  ] },
  { title: "Struktur Organisasi", fields: [
    { key: "department", label: "Divisi", required: true },
    { key: "position", label: "Jabatan", required: true },
    { key: "grade", label: "Grade" },
    { key: "work_location", label: "Lokasi Kerja" },
    { key: "supervisor", label: "Atasan Langsung" },
  ] },
  { title: "Data Pribadi", fields: [
    { key: "nama_panggilan", label: "Nama Panggilan" },
    { key: "ktp", label: "No. KTP" },
    { key: "no_kk", label: "No. KK" },
    { key: "gender", label: "Jenis Kelamin", type: "select", options: ["Laki-laki", "Perempuan"] },
    { key: "blood_type", label: "Golongan Darah", type: "select", options: ["A", "B", "AB", "O"] },
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

  const COLS = 10;
  function Row({ e }: { e: Employee }) {
    return (
      <tr onClick={() => setSel(e)} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
        <td className="py-2 px-1">
          <Avatar name={e.nama} src={e.photo_url ? photoUrl(e.id) : undefined} size={36} />
        </td>
        <td className="py-2 px-2 text-slate-500">{e.nik}</td>
        <td className="py-2 px-2 font-medium text-slate-800">{e.nama}</td>
        <td className="py-2 px-2 text-slate-600">{e.department}</td>
        <td className="py-2 px-2 text-slate-600">{e.position}</td>
        <td className="py-2 px-2 text-slate-600 truncate">{e.email || "-"}</td>
        <td className="py-2 px-2 text-slate-600">{e.phone || "-"}</td>
        <td className="py-2 px-2 text-slate-600 truncate">{e.work_location || "-"}</td>
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
                <col style={{ width: "4%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "17%" }} />
              </colgroup>
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="py-2 px-1"></th>
                  <th className="py-2 px-2 font-bold">NIK</th>
                  <th className="py-2 px-2 font-bold">Nama</th>
                  <th className="py-2 px-2 font-bold">Divisi</th>
                  <th className="py-2 px-2 font-bold">Jabatan</th>
                  <th className="py-2 px-2 font-bold">Email</th>
                  <th className="py-2 px-2 font-bold">No HP</th>
                  <th className="py-2 px-2 font-bold">Lokasi Kerja</th>
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
                <label className="relative rounded-full shrink-0 cursor-pointer group" style={{ width: 44, height: 44 }}>
                  <Avatar name={sel.nama} src={sel.photo_url ? photoUrl(sel.id) : undefined} size={44} gradient />
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={16} className="text-white" />
                  </div>
                  <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={async (ev) => {
                    const f = ev.target.files?.[0]; if (!f) return;
                    try {
                      const updated = await uploadPhoto(sel.id, f) as Employee;
                      await load();
                      setSel(updated);
                    } catch {}
                  }} />
                </label>
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

            <EmployeeProfile e={sel} role={role} />
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
