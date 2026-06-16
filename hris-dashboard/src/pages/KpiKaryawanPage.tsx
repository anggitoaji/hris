import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, X, Loader2, AlertTriangle, Plus, Pencil, Trash2, FileSpreadsheet, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import { saveAs } from "file-saver";
import { fetchKpiAssessments, fetchEmployees, createKpiAssessment, updateKpiAssessment } from "../services/api";
import type { KpiAssessment, Employee } from "../types";

type KpiRow = KpiAssessment & {
  employee_position?: string | null;
  overall_target?: number;
  delta?: number;
  notes?: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  Excellent: "bg-emerald-100 text-emerald-700",
  Good: "bg-sky-100 text-sky-700",
  Below: "bg-amber-100 text-amber-700",
  Poor: "bg-red-100 text-red-700",
};

const DEFAULT_ASPECTS = ["Disiplin", "Pencapaian Target", "Kerjasama Tim", "Komunikasi", "Inisiatif"];

type AspectForm = { aspect: string; score: string; target: string };
type KpiForm = {
  employeeId: string;
  period: string;
  needsCoaching: boolean;
  notes: string;
  aspects: AspectForm[];
};

function emptyForm(period: string): KpiForm {
  return {
    employeeId: "",
    period: period || "",
    needsCoaching: false,
    notes: "",
    aspects: DEFAULT_ASPECTS.map((a) => ({ aspect: a, score: "0", target: "80" })),
  };
}

function fromRow(r: KpiRow): KpiForm {
  return {
    employeeId: String(r.employee_id),
    period: r.period,
    needsCoaching: r.needs_coaching,
    notes: r.notes ?? "",
    aspects: r.aspects.map((a) => ({ aspect: a.aspect, score: String(a.score), target: String(a.target) })),
  };
}

function initials(nama: string): string {
  return nama.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function KpiKaryawanPage() {
  const [rows, setRows] = useState<KpiRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState("");
  const [sel, setSel] = useState<KpiRow | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formId, setFormId] = useState<number | null>(null);
  const [f, setF] = useState<KpiForm>(emptyForm(""));
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchKpiAssessments();
      setRows(data);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { fetchEmployees().then(setEmployees).catch(() => {}); }, []);

  const periods = useMemo(() => {
    const set = Array.from(new Set(rows.map((r) => r.period)));
    return set.sort().reverse();
  }, [rows]);

  const activePeriod = period || periods[0] || "";

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (activePeriod && r.period !== activePeriod) return false;
      if (!s) return true;
      return [r.employee_nama, r.employee_department].some((v) => (v ?? "").toLowerCase().includes(s));
    });
  }, [rows, activePeriod, q]);

  const summary = useMemo(() => {
    const n = filtered.length;
    const avg = n ? filtered.reduce((a, r) => a + r.overall_score, 0) / n : 0;
    const coaching = filtered.filter((r) => r.needs_coaching).length;
    return { n, avg, coaching };
  }, [filtered]);

  const [exporting, setExporting] = useState(false);

  async function exportExcel() {
    setExporting(true);
    try {
      const { Workbook } = await import("exceljs");
      const wb = new Workbook();
      const ws = wb.addWorksheet("Rekap KPI");

      ws.columns = [
        { header: "Nama", key: "nama", width: 26 },
        { header: "Divisi", key: "div", width: 20 },
        { header: "Periode", key: "periode", width: 18 },
        { header: "Skor", key: "skor", width: 10 },
        { header: "Target", key: "target", width: 10 },
        { header: "Delta", key: "delta", width: 10 },
        { header: "Status", key: "status", width: 12 },
        { header: "Coaching", key: "coaching", width: 12 },
        { header: "Catatan", key: "notes", width: 30 },
      ];
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

      filtered.forEach((r) => {
        const target = r.overall_target ?? 0;
        const delta = r.delta ?? (r.overall_score - target);
        ws.addRow({
          nama: r.employee_nama ?? "-",
          div: r.employee_department ?? "-",
          periode: r.period,
          skor: r.overall_score,
          target,
          delta,
          status: r.status,
          coaching: r.needs_coaching ? "Perlu" : "-",
          notes: r.notes ?? "",
        });
      });

      // Sheet rincian per aspek
      const wsDetail = wb.addWorksheet("Rincian Aspek");
      wsDetail.columns = [
        { header: "Nama", key: "nama", width: 26 },
        { header: "Periode", key: "periode", width: 18 },
        { header: "Aspek", key: "aspek", width: 24 },
        { header: "Skor", key: "skor", width: 10 },
        { header: "Target", key: "target", width: 10 },
      ];
      wsDetail.getRow(1).font = { bold: true };
      wsDetail.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      filtered.forEach((r) => {
        r.aspects.forEach((a) => {
          wsDetail.addRow({
            nama: r.employee_nama ?? "-",
            periode: r.period,
            aspek: a.aspect,
            skor: a.score,
            target: a.target,
          });
        });
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `rekap-kpi-${activePeriod || "all"}.xlsx`);
    } catch (e) {
      alert(`Export Excel gagal: ${(e as Error).message}`);
    }
    setExporting(false);
  }

  function exportPDF(r: KpiRow) {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const target = r.overall_target ?? 0;
    const delta = r.delta ?? (r.overall_score - target);

    pdf.setFontSize(14);
    pdf.setTextColor(30, 41, 59);
    pdf.text("LAPORAN PENILAIAN KPI KARYAWAN", 105, 18, { align: "center" });

    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Periode: ${r.period}`, 105, 25, { align: "center" });

    let y = 38;
    pdf.setFontSize(11);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`Nama: ${r.employee_nama ?? "-"}`, 15, y); y += 6;
    pdf.text(`Divisi: ${r.employee_department ?? "-"}`, 15, y); y += 6;
    pdf.text(`Skor Keseluruhan: ${r.overall_score.toFixed(1)}  (Target: ${target.toFixed(0)}, Delta: ${delta >= 0 ? "+" : ""}${delta.toFixed(1)})`, 15, y); y += 6;
    pdf.text(`Status: ${r.status}${r.needs_coaching ? "  -  Perlu Coaching" : ""}`, 15, y); y += 10;

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("Rincian per Aspek", 15, y); y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    pdf.setDrawColor(226, 232, 240);
    pdf.line(15, y, 195, y); y += 6;

    r.aspects.forEach((a) => {
      pdf.text(a.aspect, 15, y);
      pdf.text(`${a.score.toFixed(0)} / target ${a.target.toFixed(0)}`, 150, y);
      y += 6;
    });

    if (r.notes) {
      y += 6;
      pdf.setFont("helvetica", "bold");
      pdf.text("Catatan:", 15, y); y += 6;
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(r.notes, 175);
      pdf.text(lines, 15, y);
    }

    pdf.save(`kpi-${(r.employee_nama ?? "karyawan").replace(/\s+/g, "-")}-${r.period}.pdf`);
  }

  function openCreate() {
    setFormMode("create"); setFormId(null); setF(emptyForm(activePeriod));
    setFormErr(null); setSel(null); setFormOpen(true);
  }
  function openEdit(r: KpiRow) {
    setFormMode("edit"); setFormId(r.id); setF(fromRow(r));
    setFormErr(null); setSel(null); setFormOpen(true);
  }
  const setAspect = (i: number, key: keyof AspectForm, v: string) =>
    setF((p) => ({ ...p, aspects: p.aspects.map((a, idx) => (idx === i ? { ...a, [key]: v } : a)) }));
  const addAspect = () => setF((p) => ({ ...p, aspects: [...p.aspects, { aspect: "", score: "0", target: "80" }] }));
  const removeAspect = (i: number) => setF((p) => ({ ...p, aspects: p.aspects.filter((_, idx) => idx !== i) }));

  async function save() {
    if (formMode === "create" && !f.employeeId) { setFormErr("Pilih karyawan dulu."); return; }
    if (!f.period.trim()) { setFormErr("Periode wajib diisi."); return; }
    const aspects = f.aspects
      .filter((a) => a.aspect.trim())
      .map((a) => ({ aspect: a.aspect.trim(), score: Number(a.score) || 0, target: Number(a.target) || 0 }));

    setSaving(true); setFormErr(null);
    try {
      if (formMode === "create") {
        await createKpiAssessment({
          employee_id: Number(f.employeeId),
          period: f.period.trim(),
          needs_coaching: f.needsCoaching,
          notes: f.notes.trim() || null,
          aspects,
        });
      } else if (formId != null) {
        await updateKpiAssessment(formId, {
          period: f.period.trim(),
          needs_coaching: f.needsCoaching,
          notes: f.notes.trim() || null,
          aspects,
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

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";
  const cellCls = "px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">KPI Karyawan</h1>
          <p className="text-sm text-slate-400">Penilaian kinerja per karyawan - data langsung dari database.</p>
        </div>
        <div className="flex items-center gap-3">
          {periods.length > 0 && (
            <select value={activePeriod} onChange={(e) => setPeriod(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-sky-300 bg-white">
              {periods.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          <button onClick={exportExcel} disabled={exporting || filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Export Excel
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700">
            <Plus size={16} /> Tambah Penilaian
          </button>
        </div>
      </div>

      {!loading && !err && (
        <div className="flex flex-wrap gap-3">
          <StatCard label="Dinilai" value={summary.n} sub="karyawan pada periode ini" />
          <StatCard label="Rata-rata Skor" value={summary.avg.toFixed(1)} sub="dari 100" />
          <StatCard label="Perlu Coaching" value={summary.coaching} sub="karyawan ditandai" />
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
                  <th className="py-2 px-2 font-bold text-right">Skor</th>
                  <th className="py-2 px-2 font-bold text-right">Target</th>
                  <th className="py-2 px-2 font-bold text-right">Delta</th>
                  <th className="py-2 px-2 font-bold">Status</th>
                  <th className="py-2 px-2 font-bold">Coaching</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const target = r.overall_target ?? 0;
                  const delta = r.delta ?? (r.overall_score - target);
                  return (
                    <tr key={r.id} onClick={() => setSel(r)} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
                      <td className="py-2 px-2 font-medium text-slate-800">{r.employee_nama ?? "-"}</td>
                      <td className="py-2 px-2 text-slate-600">{r.employee_department ?? "-"}</td>
                      <td className="py-2 px-2 text-right font-semibold text-slate-800">{r.overall_score.toFixed(1)}</td>
                      <td className="py-2 px-2 text-right text-slate-500">{target ? target.toFixed(0) : "-"}</td>
                      <td className={`py-2 px-2 text-right font-medium ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {delta >= 0 ? "+" : ""}{delta.toFixed(1)}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status] ?? "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                      </td>
                      <td className="py-2 px-2">
                        {r.needs_coaching
                          ? <span className="inline-flex items-center gap-1 text-xs text-amber-600"><AlertTriangle size={13} /> Perlu</span>
                          : <span className="text-xs text-slate-300">-</span>}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-slate-400 py-8">Belum ada penilaian pada periode ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {sel && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSel(null)} />
          <div className="fixed top-0 right-0 h-full bg-white shadow-2xl z-50 overflow-y-auto" style={{ width: 420, maxWidth: "92vw" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ width: 40, height: 40, background: "linear-gradient(135deg,#818cf8,#6366f1)" }}>
                  {initials(sel.employee_nama ?? "?")}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 truncate">{sel.employee_nama ?? "-"}</div>
                  <div className="text-xs text-slate-400 truncate">{sel.employee_department ?? "-"} - {sel.period}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => exportPDF(sel)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 px-2 py-1 rounded-md hover:bg-slate-50">
                  <FileDown size={15} /> PDF
                </button>
                <button onClick={() => openEdit(sel)} className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 px-2 py-1 rounded-md hover:bg-sky-50">
                  <Pencil size={15} /> Edit
                </button>
                <button onClick={() => setSel(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-[11px] text-slate-400">Skor Keseluruhan</div>
                  <div className="text-2xl font-bold text-slate-800">{sel.overall_score.toFixed(1)}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLOR[sel.status] ?? "bg-slate-100 text-slate-600"}`}>{sel.status}</span>
                {sel.needs_coaching && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                    <AlertTriangle size={13} /> Perlu Coaching
                  </span>
                )}
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Rincian per Aspek</div>
                <div className="flex flex-col gap-3">
                  {sel.aspects.map((a) => {
                    const pct = Math.max(0, Math.min(100, a.score));
                    const ok = a.score >= a.target;
                    return (
                      <div key={a.id}>
                        <div className="flex justify-between text-[13px] mb-1">
                          <span className="text-slate-600">{a.aspect}</span>
                          <span className="text-slate-500">{a.score.toFixed(0)} <span className="text-slate-300">/ target {a.target.toFixed(0)}</span></span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ok ? "#10b981" : "#f59e0b" }} />
                        </div>
                      </div>
                    );
                  })}
                  {sel.aspects.length === 0 && <div className="text-sm text-slate-300">Belum ada rincian aspek.</div>}
                </div>
              </div>

              {sel.notes && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Catatan</div>
                  <div className="text-sm text-slate-700">{sel.notes}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Form drawer (tambah/edit) */}
      {formOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => !saving && setFormOpen(false)} />
          <div className="fixed top-0 right-0 h-full bg-white shadow-2xl z-50 overflow-y-auto flex flex-col" style={{ width: "50vw", minWidth: 460, maxWidth: "96vw" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="font-bold text-slate-800">{formMode === "create" ? "Tambah Penilaian KPI" : "Edit Penilaian KPI"}</div>
              <button onClick={() => !saving && setFormOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="p-5 flex flex-col gap-4 flex-1">
              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Karyawan <span className="text-red-400">*</span></label>
                {formMode === "create" ? (
                  <select className={inputCls} value={f.employeeId} onChange={(e) => setF((p) => ({ ...p, employeeId: e.target.value }))}>
                    <option value="">- pilih karyawan -</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.nama} ({e.department})</option>)}
                  </select>
                ) : (
                  <input className={`${inputCls} bg-slate-50 text-slate-500`} value={sel?.employee_nama ?? f.employeeId} disabled />
                )}
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Periode <span className="text-red-400">*</span></label>
                <input className={inputCls} value={f.period} placeholder="mis. 2026 Semester 1"
                  onChange={(e) => setF((p) => ({ ...p, period: e.target.value }))} list="kpi-periods" />
                <datalist id="kpi-periods">{periods.map((p) => <option key={p} value={p} />)}</datalist>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-500 font-medium">Aspek Penilaian</label>
                  <button onClick={addAspect} className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"><Plus size={13} /> Tambah aspek</button>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1 mb-1">
                  <span className="flex-1">Aspek</span><span className="w-16 text-center">Skor</span><span className="w-16 text-center">Target</span><span className="w-6" />
                </div>
                <div className="flex flex-col gap-2">
                  {f.aspects.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input className={`${cellCls} flex-1 min-w-0`} value={a.aspect} placeholder="Nama aspek"
                        onChange={(e) => setAspect(i, "aspect", e.target.value)} />
                      <input className={`${cellCls} w-16 text-center px-1`} type="number" min={0} max={100} value={a.score}
                        onChange={(e) => setAspect(i, "score", e.target.value)} />
                      <input className={`${cellCls} w-16 text-center px-1`} type="number" min={0} max={100} value={a.target}
                        onChange={(e) => setAspect(i, "target", e.target.value)} />
                      <button onClick={() => removeAspect(i)} className="text-slate-300 hover:text-red-500 w-6 flex justify-center"><Trash2 size={15} /></button>
                    </div>
                  ))}
                  {f.aspects.length === 0 && <div className="text-xs text-slate-300 py-1">Belum ada aspek. Klik "Tambah aspek".</div>}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={f.needsCoaching} onChange={(e) => setF((p) => ({ ...p, needsCoaching: e.target.checked }))} />
                Perlu coaching
              </label>

              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Catatan</label>
                <textarea className={inputCls} rows={3} value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} />
              </div>
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


