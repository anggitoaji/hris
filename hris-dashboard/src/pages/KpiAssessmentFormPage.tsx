import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Search, Send, CheckCircle2, Save } from "lucide-react";
import {
  fetchEmployees, fetchKpiAssessments, createKpiAssessment,
  updateKpiAssessment, updateKpiAssessmentStatus,
} from "../services/api";
import type { Employee, KpiWorkflowStatus, QualCategory } from "../types";

const DEFAULT_ASPECTS = ["Disiplin", "Pencapaian Target", "Kerjasama Tim", "Komunikasi", "Inisiatif"];
const COMPETENCY_PARAMS = [
  "Technical Knowledge", "Problem Solving", "Communication",
  "Collaboration", "Initiative", "Leadership",
];
const BEHAVIOR_PARAMS = ["Disiplin", "Integritas", "Tanggung Jawab", "Kepatuhan SOP", "Orientasi Hasil"];

const W_JABATAN = 0.7;
const W_COMPETENCY = 0.2;
const W_BEHAVIOR = 0.1;

function grade(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "B+";
  if (score >= 80) return "B";
  if (score >= 75) return "C+";
  if (score >= 70) return "C";
  return "D";
}

const STATUS_LABEL: Record<KpiWorkflowStatus, string> = {
  draft: "Draft",
  hrd_review: "Menunggu Review HRD",
  final_approved: "Final Approved",
};
const STATUS_COLOR: Record<KpiWorkflowStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  hrd_review: "bg-amber-100 text-amber-700",
  final_approved: "bg-emerald-100 text-emerald-700",
};

type AspectForm = { aspect: string; score: string; target: string };
type QualForm = { category: QualCategory; parameter: string; managerScore: string; hrdScore: string };

export default function KpiAssessmentFormPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [period, setPeriod] = useState("");
  const [periods, setPeriods] = useState<string[]>([]);

  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<KpiWorkflowStatus>("draft");

  const [aspects, setAspects] = useState<AspectForm[]>(DEFAULT_ASPECTS.map((a) => ({ aspect: a, score: "0", target: "80" })));
  const [qualScores, setQualScores] = useState<QualForm[]>([
    ...COMPETENCY_PARAMS.map((p) => ({ category: "competency" as QualCategory, parameter: p, managerScore: "0", hrdScore: "0" })),
    ...BEHAVIOR_PARAMS.map((p) => ({ category: "behavior" as QualCategory, parameter: p, managerScore: "0", hrdScore: "0" })),
  ]);
  const [notes, setNotes] = useState("");

  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState<"" | "draft" | "hrd_review" | "final_approved">("");
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => { fetchEmployees().then(setEmployees).catch(() => {}); }, []);
  useEffect(() => {
    fetchKpiAssessments().then((rows) => {
      setPeriods(Array.from(new Set(rows.map((r) => r.period))).sort().reverse());
    }).catch(() => {});
  }, []);

  function resetForm() {
    setAssessmentId(null);
    setWorkflowStatus("draft");
    setAspects(DEFAULT_ASPECTS.map((a) => ({ aspect: a, score: "0", target: "80" })));
    setQualScores([
      ...COMPETENCY_PARAMS.map((p) => ({ category: "competency" as QualCategory, parameter: p, managerScore: "0", hrdScore: "0" })),
      ...BEHAVIOR_PARAMS.map((p) => ({ category: "behavior" as QualCategory, parameter: p, managerScore: "0", hrdScore: "0" })),
    ]);
    setNotes("");
  }

  async function loadExisting() {
    if (!employeeId || !period.trim()) { setErr("Pilih karyawan dan isi periode terlebih dahulu."); return; }
    setLoadingExisting(true); setErr(null); setOkMsg(null);
    try {
      const rows = await fetchKpiAssessments(period.trim(), Number(employeeId));
      const found = rows[0];
      if (found) {
        setAssessmentId(found.id);
        setWorkflowStatus(found.workflow_status);
        setAspects(found.aspects.length
          ? found.aspects.map((a) => ({ aspect: a.aspect, score: String(a.score), target: String(a.target) }))
          : DEFAULT_ASPECTS.map((a) => ({ aspect: a, score: "0", target: "80" })));
        const byKey = new Map(found.qual_scores.map((q) => [`${q.category}::${q.parameter}`, q]));
        setQualScores([
          ...COMPETENCY_PARAMS.map((p) => {
            const q = byKey.get(`competency::${p}`);
            return { category: "competency" as QualCategory, parameter: p, managerScore: String(q?.manager_score ?? 0), hrdScore: String(q?.hrd_score ?? 0) };
          }),
          ...BEHAVIOR_PARAMS.map((p) => {
            const q = byKey.get(`behavior::${p}`);
            return { category: "behavior" as QualCategory, parameter: p, managerScore: String(q?.manager_score ?? 0), hrdScore: String(q?.hrd_score ?? 0) };
          }),
        ]);
        setNotes(found.notes ?? "");
        setOkMsg("Data penilaian existing dimuat - silakan lanjutkan/edit.");
      } else {
        resetForm();
        setOkMsg("Belum ada penilaian untuk kombinasi ini - mulai isi formulir baru.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat data.");
    } finally {
      setLoadingExisting(false);
    }
  }

  const setAspectField = (i: number, key: keyof AspectForm, v: string) =>
    setAspects((p) => p.map((a, idx) => (idx === i ? { ...a, [key]: v } : a)));
  const addAspect = () => setAspects((p) => [...p, { aspect: "", score: "0", target: "80" }]);
  const removeAspect = (i: number) => setAspects((p) => p.filter((_, idx) => idx !== i));

  const setQualField = (i: number, key: "managerScore" | "hrdScore", v: string) => {
    // Skala wajib 1-5 (bukan 0-100 seperti KPI Jabatan) - cegah input di luar rentang.
    let clamped = v;
    if (v !== "") {
      const n = Number(v);
      if (!Number.isNaN(n)) {
        if (n > 5) clamped = "5";
        else if (n < 0) clamped = "0";
      }
    }
    setQualScores((p) => p.map((q, idx) => (idx === i ? { ...q, [key]: clamped } : q)));
  };

  const computed = useMemo(() => {
    const scores = aspects.filter((a) => a.aspect.trim()).map((a) => Number(a.score) || 0);
    const kpiJabatan = scores.length ? Math.min(100, scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    const competencyItems = qualScores.filter((q) => q.category === "competency");
    const behaviorItems = qualScores.filter((q) => q.category === "behavior");
    const avgPct = (items: QualForm[]) => {
      if (!items.length) return 0;
      const avgs = items.map((q) => ((Number(q.managerScore) || 0) + (Number(q.hrdScore) || 0)) / 2);
      return (avgs.reduce((a, b) => a + b, 0) / avgs.length) / 5 * 100;
    };
    const competencyPct = avgPct(competencyItems);
    const behaviorPct = avgPct(behaviorItems);
    const final = kpiJabatan * W_JABATAN + competencyPct * W_COMPETENCY + behaviorPct * W_BEHAVIOR;
    return {
      kpiJabatan: Math.round(kpiJabatan * 10) / 10,
      competencyPct: Math.round(competencyPct * 10) / 10,
      behaviorPct: Math.round(behaviorPct * 10) / 10,
      final: Math.round(final * 10) / 10,
      grade: grade(final),
    };
  }, [aspects, qualScores]);

  async function persist(): Promise<number> {
    const payload = {
      employee_id: Number(employeeId),
      period: period.trim(),
      notes: notes.trim() || null,
      aspects: aspects.filter((a) => a.aspect.trim()).map((a) => ({
        aspect: a.aspect.trim(), score: Number(a.score) || 0, target: Number(a.target) || 0,
      })),
      qual_scores: qualScores.map((q) => ({
        category: q.category, parameter: q.parameter,
        manager_score: Math.min(5, Math.max(0, Number(q.managerScore) || 0)),
        hrd_score: Math.min(5, Math.max(0, Number(q.hrdScore) || 0)),
      })),
    };
    if (assessmentId != null) {
      await updateKpiAssessment(assessmentId, payload);
      return assessmentId;
    }
    const created = await createKpiAssessment(payload);
    setAssessmentId(created.id);
    return created.id;
  }

  async function handleAction(target: "draft" | "hrd_review" | "final_approved") {
    if (!employeeId) { setErr("Pilih karyawan terlebih dahulu."); return; }
    if (!period.trim()) { setErr("Periode wajib diisi."); return; }
    setSaving(target); setErr(null); setOkMsg(null);
    try {
      const id = await persist();
      if (target !== "draft") {
        await updateKpiAssessmentStatus(id, target);
      }
      setWorkflowStatus(target);
      setOkMsg(
        target === "draft" ? "Draft tersimpan." :
        target === "hrd_review" ? "Penilaian dikirim ke HRD untuk review." :
        "Penilaian difinalisasi."
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving("");
    }
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";
  const cellCls = "px-2 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Form Penilaian KPI</h1>
          <p className="text-sm text-slate-400">Untuk Manager &amp; HRD - KPI Jabatan 70%, Kompetensi 20%, Perilaku Kerja 10%.</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[workflowStatus]}`}>{STATUS_LABEL[workflowStatus]}</span>
      </div>

      {/* Pemilihan karyawan & periode */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="text-[11px] text-slate-500 font-medium block mb-1">Karyawan</label>
          <select className={inputCls} value={employeeId} onChange={(e) => { setEmployeeId(e.target.value); setAssessmentId(null); }}>
            <option value="">- pilih karyawan -</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.nama} ({e.department})</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] text-slate-500 font-medium block mb-1">Periode</label>
          <input className={inputCls} value={period} placeholder="mis. 2026 Semester 1"
            onChange={(e) => { setPeriod(e.target.value); setAssessmentId(null); }} list="periods-list" />
          <datalist id="periods-list">{periods.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <button onClick={loadExisting} disabled={loadingExisting}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          {loadingExisting ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Muat Data
        </button>
      </div>

      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{err}</div>}
      {okMsg && !err && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">{okMsg}</div>}

      {/* A. KPI Jabatan */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm font-bold text-slate-800">A. KPI Jabatan</div>
            <div className="text-[11px] text-slate-400">Bobot 70% - diambil dari pencapaian KPI</div>
          </div>
          <button onClick={addAspect} className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"><Plus size={13} /> Tambah item</button>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1 mb-1">
          <span className="flex-1">Item KPI</span><span className="w-20 text-center">Realisasi</span><span className="w-20 text-center">Target</span><span className="w-6" />
        </div>
        <div className="flex flex-col gap-2">
          {aspects.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={`${cellCls} flex-1 min-w-0`} value={a.aspect} placeholder="Nama item KPI"
                onChange={(e) => setAspectField(i, "aspect", e.target.value)} />
              <input className={`${cellCls} w-20 text-center`} type="number" min={0} max={100} value={a.score}
                onChange={(e) => setAspectField(i, "score", e.target.value)} />
              <input className={`${cellCls} w-20 text-center`} type="number" min={0} max={100} value={a.target}
                onChange={(e) => setAspectField(i, "target", e.target.value)} />
              <button onClick={() => removeAspect(i)} className="text-slate-300 hover:text-red-500 w-6 flex justify-center"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <div className="text-right text-sm mt-2 text-slate-600">
          Skor KPI Jabatan: <span className="font-bold text-slate-800">{computed.kpiJabatan.toFixed(1)}</span>
        </div>
      </div>

      {/* B. Kompetensi */}
      <QualSection
        title="B. Kompetensi" weightLabel="Bobot 20% - dinilai Manager & HRD (skala 1-5)"
        items={qualScores} category="competency" onChange={setQualField}
        resultLabel="Skor Kompetensi" resultPct={computed.competencyPct}
      />

      {/* C. Perilaku Kerja */}
      <QualSection
        title="C. Perilaku Kerja" weightLabel="Bobot 10% - dinilai Manager & HRD (skala 1-5)"
        items={qualScores} category="behavior" onChange={setQualField}
        resultLabel="Skor Perilaku Kerja" resultPct={computed.behaviorPct}
      />

      {/* Hasil akhir */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-6 flex-wrap">
        <div>
          <div className="text-[11px] text-slate-400">Nilai Akhir</div>
          <div className="text-3xl font-bold text-slate-800">{computed.final.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-[11px] text-slate-400">Grade</div>
          <div className="text-2xl font-bold text-sky-600">{computed.grade}</div>
        </div>
        <div className="text-[12px] text-slate-500 flex-1">
          (KPI Jabatan x 70%) + (Kompetensi x 20%) + (Perilaku x 10%) = {computed.kpiJabatan.toFixed(1)}x0.7 + {computed.competencyPct.toFixed(1)}x0.2 + {computed.behaviorPct.toFixed(1)}x0.1
        </div>
      </div>

      {/* Catatan */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <label className="text-[11px] text-slate-500 font-medium block mb-1">Catatan / Feedback Atasan</label>
        <textarea className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {/* Aksi */}
      <div className="flex justify-end gap-2 pb-4">
        <button onClick={() => handleAction("draft")} disabled={!!saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60">
          {saving === "draft" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Draft
        </button>
        <button onClick={() => handleAction("hrd_review")} disabled={!!saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-sky-200 text-sky-600 hover:bg-sky-50 disabled:opacity-60">
          {saving === "hrd_review" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Kirim ke HRD
        </button>
        <button onClick={() => handleAction("final_approved")} disabled={!!saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60">
          {saving === "final_approved" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Finalisasi Penilaian
        </button>
      </div>
    </div>
  );
}

function QualSection({ title, weightLabel, items, category, onChange, resultLabel, resultPct }: {
  title: string; weightLabel: string; items: QualForm[]; category: QualCategory;
  onChange: (i: number, key: "managerScore" | "hrdScore", v: string) => void;
  resultLabel: string; resultPct: number;
}) {
  const inputCls = "w-16 text-center px-1 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
      <div className="mb-2">
        <div className="text-sm font-bold text-slate-800">{title}</div>
        <div className="text-[11px] text-slate-400">{weightLabel}</div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1 mb-1">
        <span className="flex-1">Parameter</span><span className="w-16 text-center">Manager</span><span className="w-16 text-center">HRD</span><span className="w-16 text-center">Rata-rata</span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((q, i) => q.category === category && (
          <div key={i} className="flex items-center gap-2">
            <span className="flex-1 text-sm text-slate-600">{q.parameter}</span>
            <input className={inputCls} type="number" min={1} max={5} step={0.5} value={q.managerScore}
              onChange={(e) => onChange(i, "managerScore", e.target.value)} />
            <input className={inputCls} type="number" min={1} max={5} step={0.5} value={q.hrdScore}
              onChange={(e) => onChange(i, "hrdScore", e.target.value)} />
            <span className="w-16 text-center text-sm text-slate-500">
              {(((Number(q.managerScore) || 0) + (Number(q.hrdScore) || 0)) / 2).toFixed(1)}
            </span>
          </div>
        ))}
      </div>
      <div className="text-right text-sm mt-2 text-slate-600">
        {resultLabel}: <span className="font-bold text-slate-800">{resultPct.toFixed(1)}</span>
      </div>
    </div>
  );
}
