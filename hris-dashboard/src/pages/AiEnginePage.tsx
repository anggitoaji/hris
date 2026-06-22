import { useState, useEffect, useCallback } from "react";
import {
  Brain, Zap, Target, BookOpen, Users2, ChevronRight,
  TrendingUp, AlertTriangle, CheckCircle, XCircle, Loader2,
  Wifi, WifiOff, RefreshCw, Sparkles, BarChart2,
} from "lucide-react";
import type { Employee } from "../types";
import {
  fetchEmployees, fetchAiPromotionReadiness, fetchAiSkillGap,
  fetchAiReviewSummary, fetchAiOllamaPerformanceReview, fetchAiOllamaTraining,
  fetchOllamaStatus, fetchPositions,
  fetchAiSuccession,
  type AiPromotionResult, type AiSkillGapResult, type AiReviewResult,
  type AiOllamaResult, type AiSuccessionResult, type OllamaStatus,
  type PositionRecord,
} from "../services/api";

type Tab = "promotion" | "skillgap" | "review" | "training" | "succession";

const TAB_META: { key: Tab; label: string; icon: React.ReactNode; phase: 1 | 2 }[] = [
  { key: "promotion", label: "Promotion Readiness", icon: <TrendingUp size={15} />, phase: 1 },
  { key: "skillgap", label: "Skill Gap Analysis", icon: <Target size={15} />, phase: 1 },
  { key: "review", label: "Review Summary", icon: <BarChart2 size={15} />, phase: 1 },
  { key: "training", label: "Training Recommendation", icon: <BookOpen size={15} />, phase: 2 },
  { key: "succession", label: "Succession Planning", icon: <Users2 size={15} />, phase: 1 },
];

function ScoreGauge({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = pct >= 80 ? "#22c55e" : pct >= 65 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
      <svg width={100} height={100} className="-rotate-90">
        <circle cx={50} cy={50} r={40} fill="none" stroke="#f1f5f9" strokeWidth={10} />
        <circle cx={50} cy={50} r={40} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <span className="absolute text-2xl font-bold" style={{ color }}>{score.toFixed(0)}</span>
    </div>
  );
}

function CategoryBadge({ cat, color }: { cat: string; color: string }) {
  const bg = color === "green" ? "bg-emerald-50 text-emerald-700" :
             color === "yellow" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600";
  const Icon = color === "green" ? CheckCircle : color === "yellow" ? AlertTriangle : XCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${bg}`}>
      <Icon size={14} /> {cat}
    </span>
  );
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm text-slate-700 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-semibold text-slate-900 mt-3 mb-1">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <p key={i} className="flex gap-2"><span className="text-sky-500 shrink-0">•</span>{line.slice(2)}</p>;
        }
        if (/^\d+\./.test(line)) {
          return <p key={i} className="flex gap-2"><span className="text-sky-500 shrink-0 font-semibold">{line.split(".")[0]}.</span>{line.split(".").slice(1).join(".").trim()}</p>;
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

// ─── Tab: Promotion Readiness ───
function PromotionTab({ employeeId }: { employeeId: number }) {
  const [data, setData] = useState<AiPromotionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(() => {
    setLoading(true); setErr(null);
    fetchAiPromotionReadiness(employeeId)
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => { run(); }, [run]);

  if (loading) return <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Loader2 size={18} className="animate-spin" /> Menganalisis...</div>;
  if (err) return <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm">{err} <button onClick={run} className="underline ml-2">Coba lagi</button></div>;
  if (!data) return null;

  const bk = data.breakdown;
  const items = [
    { label: "KPI Score", score: bk.kpi_score, weight: bk.kpi_weight, color: "sky" },
    { label: "Competency", score: bk.competency_score, weight: bk.competency_weight, color: "violet" },
    { label: "Disiplin", score: bk.discipline_score, weight: bk.discipline_weight, color: "emerald" },
    { label: "Tenure", score: bk.tenure_score, weight: bk.tenure_weight, color: "amber" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-6 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <ScoreGauge score={data.final_score} />
        <div>
          <CategoryBadge cat={data.category} color={data.category_color} />
          <p className="mt-2 text-slate-600 text-sm">{data.description}</p>
          {data.kpi_period && <p className="text-xs text-slate-400 mt-1">Berdasarkan data KPI periode {data.kpi_period}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map(it => (
          <div key={it.label} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-500">{it.label}</span>
              <span className="text-xs text-slate-400">Bobot {it.weight}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-2 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(it.score, 100)}%`, background: it.score >= 80 ? "#22c55e" : it.score >= 60 ? "#f59e0b" : "#ef4444" }} />
              </div>
              <span className="text-sm font-semibold text-slate-700 w-10 text-right">{it.score.toFixed(0)}</span>
            </div>
            {it.label === "Tenure" && (
              <p className="text-[10px] text-slate-400 mt-1">{bk.tenure_months.toFixed(0)} bulan masa kerja</p>
            )}
          </div>
        ))}
      </div>

      {data.gaps.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-1"><AlertTriangle size={14} /> Gap yang Perlu Dipenuhi</p>
          <ul className="space-y-1">
            {data.gaps.map((g, i) => <li key={i} className="text-sm text-amber-700 flex gap-2"><span>•</span>{g}</li>)}
          </ul>
        </div>
      )}

      {data.promotion_eligible && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700 font-medium">Semua kriteria promosi terpenuhi</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Skill Gap ───
function SkillGapTab({ employeeId }: { employeeId: number }) {
  const [data, setData] = useState<AiSkillGapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(() => {
    setLoading(true); setErr(null);
    fetchAiSkillGap(employeeId).then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => { run(); }, [run]);

  if (loading) return <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Loader2 size={18} className="animate-spin" /> Menganalisis...</div>;
  if (err) return <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm">{err} <button onClick={run} className="underline ml-2">Coba lagi</button></div>;
  if (!data) return null;

  const riskColor = data.risk_level === "High" ? "text-red-600 bg-red-50" :
                    data.risk_level === "Medium" ? "text-amber-600 bg-amber-50" :
                    data.risk_level === "Low" ? "text-emerald-600 bg-emerald-50" : "text-slate-500 bg-slate-50";

  const statusColor = (s: string) =>
    s === "OK" ? "text-emerald-600 bg-emerald-50" :
    s === "Minor" ? "text-amber-600 bg-amber-50" :
    s === "Major" ? "text-red-600 bg-red-50" : "text-slate-500 bg-slate-50";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <div>
          <p className="text-sm text-slate-500">Jabatan: <span className="font-medium text-slate-700">{data.position}</span></p>
          <p className="text-xs text-slate-400 mt-0.5">Job Profile: {data.has_job_profile ? "Terhubung" : "Belum dikaitkan"}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${riskColor}`}>Risk: {data.risk_level}</span>
      </div>

      {!data.has_job_profile && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500 text-center">
          Job Profile belum dikaitkan ke posisi ini. Kaitkan di modul Position Management → Job Profile untuk melihat gap kompetensi.
        </div>
      )}

      {data.competency_gaps.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50">
            <p className="text-sm font-semibold text-slate-700">Kompetensi vs Requirement Job Profile</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-slate-500 font-medium">Kompetensi</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500 font-medium">Required</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500 font-medium">Current</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500 font-medium">Gap</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.competency_gaps.map((g, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700 font-medium">{g.competency}</td>
                  <td className="px-4 py-2.5 text-center text-slate-500">{g.required}</td>
                  <td className="px-4 py-2.5 text-center text-slate-700">{g.current ?? "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    {g.gap !== null ? (
                      <span className={g.gap > 0 ? "text-red-600 font-medium" : "text-emerald-600"}>
                        {g.gap > 0 ? `+${g.gap.toFixed(1)}` : g.gap.toFixed(1)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(g.status)}`}>{g.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.job_profile_training && (data.job_profile_training.mandatory || data.job_profile_training.recommended) && (
        <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
          <p className="text-sm font-semibold text-sky-700 mb-2 flex items-center gap-1"><BookOpen size={14} /> Training dari Job Profile</p>
          {data.job_profile_training.mandatory && (
            <p className="text-xs text-sky-600 mb-1"><span className="font-medium">Wajib:</span> {data.job_profile_training.mandatory}</p>
          )}
          {data.job_profile_training.recommended && (
            <p className="text-xs text-sky-600"><span className="font-medium">Direkomendasikan:</span> {data.job_profile_training.recommended}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Review Summary (Rule-based) ───
function ReviewTab({ employeeId }: { employeeId: number }) {
  const [period, setPeriod] = useState("");
  const [notes, setNotes] = useState("");
  const [data, setData] = useState<AiReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = () => {
    if (!period.trim()) return;
    setLoading(true); setErr(null);
    fetchAiReviewSummary({ employee_id: employeeId, period, manager_notes: notes })
      .then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false));
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Periode KPI</label>
            <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="mis: 2026 Semester 1"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Catatan Atasan (opsional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Tulis catatan singkat tentang karyawan ini..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200 resize-none" />
        </div>
        <button onClick={run} disabled={loading || !period.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 disabled:opacity-50 transition-colors">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Generate Review Summary
        </button>
      </div>

      {err && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm">{err}</div>}

      {data && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Ringkasan Performa</p>
            <p className="text-sm text-slate-700 leading-relaxed">{data.performance_summary}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "KPI Score", val: data.kpi_score },
              { label: "Competency", val: data.competency_score },
              { label: "Behavior", val: data.behavior_score },
            ].map(it => (
              <div key={it.label} className="bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
                <p className="text-xs text-slate-400">{it.label}</p>
                <p className="text-2xl font-bold text-slate-700 mt-1">{it.val?.toFixed(0) ?? "—"}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1"><CheckCircle size={12} /> Kekuatan</p>
              {data.strengths.length > 0 ? data.strengths.map((s, i) => (
                <p key={i} className="text-xs text-emerald-700 flex gap-1.5 mt-1"><span>•</span>{s}</p>
              )) : <p className="text-xs text-slate-400">Belum teridentifikasi</p>}
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1"><AlertTriangle size={12} /> Area Pengembangan</p>
              {data.development_areas.length > 0 ? data.development_areas.map((d, i) => (
                <p key={i} className="text-xs text-amber-700 flex gap-1.5 mt-1"><span>•</span>{d}</p>
              )) : <p className="text-xs text-slate-400">Tidak ada area kritis</p>}
            </div>
          </div>

          <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-sky-700 mb-2 flex items-center gap-1"><ChevronRight size={12} /> Rekomendasi</p>
            {data.recommendations.map((r, i) => (
              <p key={i} className="text-xs text-sky-700 flex gap-1.5 mt-1"><span className="font-bold">{i + 1}.</span>{r}</p>
            ))}
          </div>

          {data.talent_label && (
            <div className="flex items-center gap-3 bg-violet-50 border border-violet-100 rounded-xl p-3">
              <span className="text-xs text-violet-600"><span className="font-medium">Talent Label:</span> {data.talent_label}</span>
              {data.promotion_eligible && <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Kandidat Promosi</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: AI Training (Ollama) ───
function TrainingTab({ employeeId, ollamaOnline, availableModels }: { employeeId: number; ollamaOnline: boolean; availableModels: string[] }) {
  const [model, setModel] = useState(availableModels[0] ?? "qwen2.5");
  const [data, setData] = useState<AiOllamaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = () => {
    setLoading(true); setErr(null);
    fetchAiOllamaTraining({ employee_id: employeeId, model })
      .then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false));
  };

  if (!ollamaOnline) return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
      <WifiOff size={28} />
      <p className="text-sm text-center">Ollama tidak aktif.<br />Jalankan <code className="bg-slate-100 px-1 rounded text-slate-700">ollama serve</code> di terminal untuk mengaktifkan AI lokal.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs text-slate-500 mb-1">Model Ollama</label>
          {availableModels.length > 0 ? (
            <select value={model} onChange={e => setModel(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200">
              {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <input value={model} onChange={e => setModel(e.target.value)} placeholder="qwen2.5"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200" />
          )}
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-600 disabled:opacity-50 transition-colors self-end">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Generate
        </button>
      </div>

      {err && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm">{err}</div>}
      {loading && (
        <div className="flex flex-col items-center py-10 text-slate-400 gap-2">
          <Loader2 size={22} className="animate-spin text-violet-400" />
          <p className="text-sm">AI sedang menganalisis data karyawan...</p>
          <p className="text-xs">Proses ini bisa memakan waktu 30-120 detik</p>
        </div>
      )}

      {data && !loading && (
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} className="text-violet-400" />
            <p className="text-xs text-slate-400">Dihasilkan oleh {data.model}</p>
          </div>
          <MarkdownText text={data.ai_response} />
        </div>
      )}
    </div>
  );
}

// ─── Tab: Succession ───
function SuccessionTab() {
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [posId, setPosId] = useState<number | null>(null);
  const [data, setData] = useState<AiSuccessionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { fetchPositions().then(setPositions).catch(() => {}); }, []);

  const run = () => {
    if (!posId) return;
    setLoading(true); setErr(null);
    fetchAiSuccession(posId).then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false));
  };

  const readinessColor = (r: string) =>
    r === "Ready Now" ? "text-emerald-600 bg-emerald-50" :
    r === "Ready < 1 Tahun" ? "text-sky-600 bg-sky-50" :
    r === "Ready 1-2 Tahun" ? "text-amber-600 bg-amber-50" : "text-slate-500 bg-slate-50";

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs text-slate-500 mb-1">Pilih Posisi</label>
          <select value={posId ?? ""} onChange={e => setPosId(Number(e.target.value) || null)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200">
            <option value="">— Pilih jabatan —</option>
            {positions.map(p => (
              <option key={p.id} value={p.id}>{p.nama_jabatan} ({p.department})</option>
            ))}
          </select>
        </div>
        <button onClick={run} disabled={loading || !posId}
          className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 disabled:opacity-50 transition-colors">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Users2 size={14} />}
          Cari Kandidat
        </button>
      </div>

      {err && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm">{err}</div>}
      {loading && <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Loader2 size={18} className="animate-spin" /> Menganalisis kandidat...</div>}

      {data && !loading && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">{data.position_name}</p>
              <p className="text-xs text-slate-400">{data.department} — Level {data.level}</p>
            </div>
            <span className="text-xs text-slate-400">{data.candidates.length} kandidat</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-slate-500 font-medium">#</th>
                <th className="px-4 py-2 text-left text-xs text-slate-500 font-medium">Karyawan</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500 font-medium">Score</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500 font-medium">KPI</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500 font-medium">Kompetensi</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500 font-medium">Talent</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500 font-medium">Readiness</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.candidates.map((c, i) => (
                <tr key={c.employee_id} className={`hover:bg-slate-50 ${i === 0 ? "bg-emerald-50/30" : ""}`}>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${i === 0 ? "bg-emerald-100 text-emerald-700" : i === 1 ? "bg-sky-100 text-sky-600" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">{c.nama}</p>
                    <p className="text-xs text-slate-400">{c.current_position}</p>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700">{c.succession_score.toFixed(0)}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{c.kpi_score.toFixed(0)}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{c.competency_score.toFixed(0)}</td>
                  <td className="px-4 py-3 text-center">
                    {c.talent_label ? <span className="text-xs text-violet-600">{c.talent_label}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${readinessColor(c.readiness)}`}>{c.readiness}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.candidates.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400">Belum ada kandidat yang teridentifikasi</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───
export default function AiEnginePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("promotion");
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({ online: false, models: [] });

  useEffect(() => {
    fetchEmployees().then(d => setEmployees(Array.isArray(d) ? d : (d as { employees: Employee[] }).employees ?? [])).catch(() => {});
    fetchOllamaStatus().then(setOllamaStatus).catch(() => {});
  }, []);

  const filtered = employees.filter(e =>
    !search || e.nama?.toLowerCase().includes(search.toLowerCase()) ||
    e.department?.toLowerCase().includes(search.toLowerCase()) ||
    e.position?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex gap-4 min-h-0" style={{ maxHeight: "calc(100vh - 120px)" }}>
      {/* Left: employee list */}
      <div className="w-64 shrink-0 flex flex-col gap-3">
        <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Brain size={16} className="text-violet-500" />
            <span className="text-sm font-semibold text-slate-700">AI HR Engine</span>
          </div>
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${ollamaStatus.online ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
            {ollamaStatus.online ? <Wifi size={11} /> : <WifiOff size={11} />}
            {ollamaStatus.online ? `Ollama Online (${ollamaStatus.models.length} model)` : "Ollama Offline"}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col min-h-0 flex-1">
          <div className="p-3 border-b border-slate-50">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari karyawan..."
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-sky-200" />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.slice(0, 50).map(emp => (
              <button key={emp.id} onClick={() => { setSelectedEmp(emp); setTab("promotion"); }}
                className={`w-full text-left px-3 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${selectedEmp?.id === emp.id ? "bg-sky-50 border-l-2 border-l-sky-400" : ""}`}>
                <p className="text-xs font-medium text-slate-700 truncate">{emp.nama}</p>
                <p className="text-[10px] text-slate-400 truncate">{emp.position || emp.department || "—"}</p>
              </button>
            ))}
            {filtered.length === 0 && <p className="p-4 text-xs text-slate-400 text-center">Tidak ada karyawan</p>}
          </div>
        </div>
      </div>

      {/* Right: analysis panel */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto">
        {!selectedEmp ? (
          <div className="flex flex-col items-center justify-center flex-1 text-slate-400 gap-3">
            <Brain size={32} className="text-slate-200" />
            <p className="text-sm">Pilih karyawan untuk memulai analisis AI</p>
          </div>
        ) : (
          <>
            {/* Employee header */}
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {selectedEmp.nama?.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-700 truncate">{selectedEmp.nama}</p>
                <p className="text-xs text-slate-400 truncate">{selectedEmp.position} — {selectedEmp.department}</p>
              </div>
              <button onClick={() => fetchOllamaStatus().then(setOllamaStatus)} className="text-slate-300 hover:text-slate-500 transition-colors">
                <RefreshCw size={14} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {TAB_META.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${tab === t.key ? "bg-white text-slate-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  {t.icon}
                  <span className="hidden lg:inline">{t.label}</span>
                  {t.phase === 2 && (
                    <span className="hidden lg:inline px-1 py-0.5 rounded bg-violet-100 text-violet-500 text-[9px] font-bold">AI</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="pb-4">
              {tab === "promotion" && <PromotionTab key={selectedEmp.id} employeeId={selectedEmp.id} />}
              {tab === "skillgap" && <SkillGapTab key={selectedEmp.id} employeeId={selectedEmp.id} />}
              {tab === "review" && <ReviewTab key={selectedEmp.id} employeeId={selectedEmp.id} />}
              {tab === "training" && <TrainingTab key={selectedEmp.id} employeeId={selectedEmp.id} ollamaOnline={ollamaStatus.online} availableModels={ollamaStatus.models} />}
              {tab === "succession" && <SuccessionTab />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
