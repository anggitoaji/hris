import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, X, Loader2, Plus, Trash2, FileText, Save, Download } from "lucide-react";
import {
  fetchPayslips, fetchPayrollSummary, createPayslip, updatePayslip, deletePayslip,
  fetchSalaryTemplate, saveSalaryTemplate, fetchEmployees,
  type Payslip, type PayslipItem, type PayrollSummary,
} from "../services/api";
import type { Employee } from "../types";

const STATUS_COLOR: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  Final: "bg-emerald-100 text-emerald-700",
};

function rupiah(n: number): string {
  return "Rp " + Math.round(n || 0).toLocaleString("id-ID");
}

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function initials(nama: string): string {
  return nama.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

type ItemForm = { kind: string; label: string; amount: string };
type SlipForm = {
  employeeId: string;
  period: string;
  status: string;
  note: string;
  items: ItemForm[];
};

function emptyForm(period: string): SlipForm {
  return { employeeId: "", period, status: "Draft", note: "", items: [] };
}
function fromRow(r: Payslip): SlipForm {
  return {
    employeeId: String(r.employee_id),
    period: r.period,
    status: r.status,
    note: r.note ?? "",
    items: r.items.map((i) => ({ kind: i.kind, label: i.label, amount: String(i.amount) })),
  };
}
function toItems(items: ItemForm[]): PayslipItem[] {
  return items
    .filter((i) => i.label.trim())
    .map((i) => ({ kind: i.kind, label: i.label.trim(), amount: Number(i.amount) || 0 }));
}

export default function SlipGajiPage() {
  const [rows, setRows] = useState<Payslip[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState(thisMonth());

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formId, setFormId] = useState<number | null>(null);
  const [f, setF] = useState<SlipForm>(emptyForm(thisMonth()));
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [tplBusy, setTplBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [slips, sum] = await Promise.all([
        fetchPayslips(period),
        fetchPayrollSummary(period).catch(() => null),
      ]);
      setRows(slips);
      setSummary(sum);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period]);
  useEffect(() => { fetchEmployees().then(setEmployees).catch(() => {}); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) =>
      !s || [r.employee_nama, r.employee_department].some((v) => (v ?? "").toLowerCase().includes(s))
    );
  }, [rows, q]);

  const formTotals = useMemo(() => {
    const e = f.items.filter((i) => i.kind === "earning").reduce((a, i) => a + (Number(i.amount) || 0), 0);
    const d = f.items.filter((i) => i.kind === "deduction").reduce((a, i) => a + (Number(i.amount) || 0), 0);
    return { e, d, net: e - d };
  }, [f.items]);

  function openCreate() {
    setFormMode("create"); setFormId(null); setF(emptyForm(period));
    setFormErr(null); setFormOpen(true);
  }
  function openEdit(r: Payslip) {
    setFormMode("edit"); setFormId(r.id); setF(fromRow(r));
    setFormErr(null); setFormOpen(true);
  }

  const setField = (key: keyof SlipForm, v: string) => setF((p) => ({ ...p, [key]: v }));
  const setItem = (i: number, key: keyof ItemForm, v: string) =>
    setF((p) => ({ ...p, items: p.items.map((it, idx) => (idx === i ? { ...it, [key]: v } : it)) }));
  const addItem = (kind: string) =>
    setF((p) => ({ ...p, items: [...p.items, { kind, label: "", amount: "0" }] }));
  const removeItem = (i: number) =>
    setF((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));

  async function onPickEmployee(id: string) {
    setF((p) => ({ ...p, employeeId: id }));
    if (id && f.items.length === 0) {
      try {
        const tpl = await fetchSalaryTemplate(Number(id));
        if (tpl.length) setF((p) => ({ ...p, items: tpl.map((t) => ({ kind: t.kind, label: t.label, amount: String(t.amount) })) }));
      } catch { /* abaikan */ }
    }
  }

  async function loadTemplate() {
    const id = f.employeeId;
    if (!id) { setFormErr("Pilih karyawan dulu."); return; }
    setTplBusy(true); setFormErr(null);
    try {
      const tpl = await fetchSalaryTemplate(Number(id));
      if (!tpl.length) { setFormErr("Karyawan ini belum punya template."); return; }
      setF((p) => ({ ...p, items: tpl.map((t) => ({ kind: t.kind, label: t.label, amount: String(t.amount) })) }));
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Gagal memuat template.");
    } finally {
      setTplBusy(false);
    }
  }

  async function saveTemplate() {
    const id = f.employeeId;
    if (!id) { setFormErr("Pilih karyawan dulu."); return; }
    if (!window.confirm("Simpan susunan komponen ini sebagai template karyawan tersebut?")) return;
    setTplBusy(true); setFormErr(null);
    try {
      await saveSalaryTemplate(Number(id), toItems(f.items));
      window.alert("Template tersimpan.");
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Gagal menyimpan template.");
    } finally {
      setTplBusy(false);
    }
  }

  async function save() {
    if (formMode === "create" && !f.employeeId) { setFormErr("Pilih karyawan dulu."); return; }
    if (!f.period.trim()) { setFormErr("Periode wajib diisi."); return; }
    setSaving(true); setFormErr(null);
    try {
      if (formMode === "create") {
        await createPayslip({
          employee_id: Number(f.employeeId),
          period: f.period.trim(),
          status: f.status,
          note: f.note.trim() || null,
          items: toItems(f.items),
        });
      } else if (formId != null) {
        await updatePayslip(formId, {
          period: f.period.trim(),
          status: f.status,
          note: f.note.trim() || null,
          items: toItems(f.items),
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
    if (!window.confirm("Hapus slip gaji ini?")) return;
    setSaving(true); setFormErr(null);
    try {
      await deletePayslip(formId);
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";
  const editEmp = rows.find((r) => r.id === formId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Slip Gaji</h1>
          <p className="text-sm text-slate-400">Payroll per karyawan per periode - data langsung dari database.</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-sky-300 bg-white" />
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700">
            <Plus size={16} /> Buat Slip
          </button>
        </div>
      </div>

      {!loading && !err && (
        <div className="flex flex-wrap gap-3">
          <StatCard label="Jumlah Slip" value={summary?.count ?? 0} sub="pada periode ini" />
          <StatCard label="Total Pendapatan" value={rupiah(summary?.total_earning ?? 0)} sub="bruto" />
          <StatCard label="Total Potongan" value={rupiah(summary?.total_deduction ?? 0)} sub="seluruh potongan" />
          <StatCard label="Total Gaji Bersih" value={rupiah(summary?.total_net ?? 0)} sub={`rata-rata ${rupiah(summary?.avg_net ?? 0)}`} />
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="relative mb-3 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau divisi..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300" />
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
                  <th className="py-2 px-2 font-bold text-right">Pendapatan</th>
                  <th className="py-2 px-2 font-bold text-right">Potongan</th>
                  <th className="py-2 px-2 font-bold text-right">Gaji Bersih</th>
                  <th className="py-2 px-2 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} onClick={() => openEdit(r)} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
                    <td className="py-2 px-2 font-medium text-slate-800">{r.employee_nama || "-"}</td>
                    <td className="py-2 px-2 text-slate-600">{r.employee_department || "-"}</td>
                    <td className="py-2 px-2 text-right text-slate-600">{rupiah(r.total_earning)}</td>
                    <td className="py-2 px-2 text-right text-red-500">{rupiah(r.total_deduction)}</td>
                    <td className="py-2 px-2 text-right font-semibold text-slate-800">{rupiah(r.net)}</td>
                    <td className="py-2 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status] ?? "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-slate-400 py-8">Belum ada slip gaji pada periode ini.</td></tr>
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
          <div className="fixed top-0 right-0 h-full bg-white shadow-2xl z-50 overflow-y-auto flex flex-col" style={{ width: "52vw", minWidth: 480, maxWidth: "96vw" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-sky-600" />
                {formMode === "create" ? "Buat Slip Gaji" : "Edit Slip Gaji"}
              </div>
              <button onClick={() => !saving && setFormOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="p-5 flex flex-col gap-4 flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 font-medium block mb-1">Karyawan <span className="text-red-400">*</span></label>
                  {formMode === "create" ? (
                    <select className={inputCls} value={f.employeeId} onChange={(e) => onPickEmployee(e.target.value)}>
                      <option value="">- pilih karyawan -</option>
                      {employees.map((e) => <option key={e.id} value={e.id}>{e.nama} ({e.department})</option>)}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2 h-[38px]">
                      <div className="rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ width: 32, height: 32, background: "linear-gradient(135deg,#34d399,#10b981)" }}>
                        {initials(editEmp?.employee_nama ?? "?")}
                      </div>
                      <span className="text-sm font-medium text-slate-700 truncate">{editEmp?.employee_nama ?? "-"}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-medium block mb-1">Periode <span className="text-red-400">*</span></label>
                  <input type="month" className={inputCls} value={f.period} onChange={(e) => setField("period", e.target.value)} />
                </div>
              </div>

              {/* Tombol template */}
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={loadTemplate} disabled={tplBusy || !f.employeeId}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  <Download size={14} /> Muat dari template
                </button>
                <button onClick={saveTemplate} disabled={tplBusy || !f.employeeId}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  <Save size={14} /> Simpan sebagai template
                </button>
                {tplBusy && <Loader2 size={14} className="animate-spin text-slate-400" />}
              </div>

              {/* Komponen */}
              <ItemSection title="Pendapatan" kind="earning" items={f.items}
                setItem={setItem} removeItem={removeItem} addItem={() => addItem("earning")} inputCls={inputCls} />
              <ItemSection title="Potongan" kind="deduction" items={f.items}
                setItem={setItem} removeItem={removeItem} addItem={() => addItem("deduction")} inputCls={inputCls} />

              {/* Ringkasan total */}
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm">
                <div className="flex justify-between py-0.5"><span className="text-slate-500">Total Pendapatan</span><span className="text-slate-700">{rupiah(formTotals.e)}</span></div>
                <div className="flex justify-between py-0.5"><span className="text-slate-500">Total Potongan</span><span className="text-red-500">- {rupiah(formTotals.d)}</span></div>
                <div className="flex justify-between pt-1 mt-1 border-t border-slate-200 font-bold"><span className="text-slate-700">Gaji Bersih</span><span className="text-slate-900">{rupiah(formTotals.net)}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 font-medium block mb-1">Status</label>
                  <select className={inputCls} value={f.status} onChange={(e) => setField("status", e.target.value)}>
                    <option value="Draft">Draft</option>
                    <option value="Final">Final</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Catatan</label>
                <textarea className={inputCls} rows={2} value={f.note} onChange={(e) => setField("note", e.target.value)} />
              </div>

              {formMode === "edit" && (
                <button onClick={removeRow} disabled={saving}
                  className="flex items-center justify-center gap-2 w-full py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60">
                  <Trash2 size={15} /> Hapus slip
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

function ItemSection({
  title, kind, items, setItem, removeItem, addItem, inputCls,
}: {
  title: string; kind: string; items: ItemForm[];
  setItem: (i: number, key: keyof ItemForm, v: string) => void;
  removeItem: (i: number) => void;
  addItem: () => void;
  inputCls: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={`text-[11px] font-bold uppercase tracking-wide ${kind === "earning" ? "text-emerald-600" : "text-red-500"}`}>{title}</label>
        <button onClick={addItem} className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"><Plus size={13} /> Tambah</button>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((it, i) => (it.kind === kind ? (
          <div key={i} className="flex items-center gap-2">
            <input className={`${inputCls} flex-1 min-w-0`} value={it.label} placeholder={kind === "earning" ? "mis. Gaji Pokok" : "mis. BPJS"}
              onChange={(e) => setItem(i, "label", e.target.value)} />
            <input className={`${inputCls} w-40 text-right`} type="number" min={0} step={1000} value={it.amount}
              onChange={(e) => setItem(i, "amount", e.target.value)} />
            <button onClick={() => removeItem(i)} className="text-slate-300 hover:text-red-500 w-6 flex justify-center"><Trash2 size={15} /></button>
          </div>
        ) : null))}
        {items.filter((it) => it.kind === kind).length === 0 && (
          <div className="text-xs text-slate-300 py-1">Belum ada komponen. Klik "Tambah".</div>
        )}
      </div>
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
