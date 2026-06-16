import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Award, ShieldCheck, CheckCircle2, Circle } from "lucide-react";
import { fetchKpiAssessments, fetchSanksiSummary, type SanksiSummary } from "../services/api";
import type { KpiAssessment, KpiWorkflowStatus } from "../types";

const DISIPLIN_COLOR: Record<string, string> = {
  CLEAR: "bg-emerald-100 text-emerald-700",
  Hijau: "bg-emerald-100 text-emerald-700",
  Kuning: "bg-amber-100 text-amber-700",
  SP1: "bg-orange-100 text-orange-700",
  SP2: "bg-red-100 text-red-700",
  SP3: "bg-red-200 text-red-800",
};

const STATUS_COLOR: Record<string, string> = {
  Excellent: "bg-emerald-100 text-emerald-700",
  Good: "bg-sky-100 text-sky-700",
  Below: "bg-amber-100 text-amber-700",
  Poor: "bg-red-100 text-red-700",
};

const WORKFLOW_STEPS: { key: KpiWorkflowStatus; label: string }[] = [
  { key: "draft", label: "Manager Review" },
  { key: "hrd_review", label: "HR Review" },
  { key: "final_approved", label: "Final Approval" },
];

function stepDone(current: KpiWorkflowStatus, step: KpiWorkflowStatus): boolean {
  const order: KpiWorkflowStatus[] = ["draft", "hrd_review", "final_approved"];
  return order.indexOf(current) >= order.indexOf(step);
}

export default function MyKpiDashboardPage({ employeeId }: { employeeId: number | null }) {
  const [rows, setRows] = useState<KpiAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [period, setPeriod] = useState("");
  const [disiplin, setDisiplin] = useState<SanksiSummary | null>(null);

  useEffect(() => {
    if (!employeeId) { setLoading(false); return; }
    setLoading(true);
    fetchKpiAssessments(undefined, employeeId)
      .then((data) => { setRows(data); setErr(null); })
      .catch((e) => setErr(e instanceof Error ? e.message : "Gagal memuat data"))
      .finally(() => setLoading(false));
    fetchSanksiSummary(employeeId).then(setDisiplin).catch(() => setDisiplin(null));
  }, [employeeId]);

  const periods = useMemo(() => Array.from(new Set(rows.map((r) => r.period))).sort().reverse(), [rows]);
  const activePeriod = period || periods[0] || "";
  const sel = rows.find((r) => r.period === activePeriod) || null;

  const prevPeriod = periods[periods.indexOf(activePeriod) + 1];
  const prev = rows.find((r) => r.period === prevPeriod) || null;

  if (!employeeId) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center text-slate-400">
        Akun Anda belum terhubung ke data karyawan. Hubungi HR untuk menautkan akun.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">My KPI Dashboard</h1>
          <p className="text-sm text-slate-400">Tampilan khusus Anda - view only.</p>
        </div>
        {periods.length > 0 && (
          <select value={activePeriod} onChange={(e) => setPeriod(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-sky-300 bg-white">
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center">
          <Loader2 size={16} className="animate-spin" /> Memuat data...
        </div>
      )}
      {err && !loading && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
          Gagal memuat data: {err}.
        </div>
      )}
      {!loading && !err && !sel && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center text-slate-400">
          Belum ada penilaian KPI untuk Anda.
        </div>
      )}

      {!loading && !err && sel && (
        <>
          {/* Overall score */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-6 flex-wrap">
            <div>
              <div className="text-[11px] text-slate-400">Overall KPI Score</div>
              <div className="text-4xl font-bold text-slate-800">{sel.final_score.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Grade</div>
              <div className="text-2xl font-bold text-sky-600">{sel.grade}</div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[sel.status] ?? "bg-slate-100 text-slate-600"}`}>{sel.status}</span>
            {sel.needs_coaching && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                <AlertTriangle size={13} /> Perlu Coaching
              </span>
            )}
            <div className="flex-1 min-w-[180px] text-right text-[12px] text-slate-400">
              KPI Jabatan {sel.kpi_jabatan_score.toFixed(1)} (70%) - Kompetensi {sel.competency_score.toFixed(1)} (20%) - Perilaku {sel.behavior_score.toFixed(1)} (10%)
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">KPI Breakdown</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sel.aspects.map((a) => {
                const achievement = a.target > 0 ? Math.min(100, (a.score / a.target) * 100) : 0;
                const ok = a.score >= a.target;
                return (
                  <div key={a.id} className="border border-slate-100 rounded-xl p-3">
                    <div className="text-sm font-medium text-slate-700 mb-1">{a.aspect}</div>
                    <div className="flex justify-between text-[12px] text-slate-500 mb-1">
                      <span>Target {a.target.toFixed(0)}</span><span>Aktual {a.score.toFixed(0)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
                      <div className="h-full rounded-full" style={{ width: `${achievement}%`, background: ok ? "#10b981" : "#f59e0b" }} />
                    </div>
                    <div className="text-[11px] text-slate-400">Achievement {achievement.toFixed(0)}%</div>
                  </div>
                );
              })}
              {sel.aspects.length === 0 && <div className="text-sm text-slate-300">Belum ada rincian.</div>}
            </div>
          </div>

          {/* Trend */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">KPI Trend</div>
            <div className="flex items-end gap-6 h-32">
              {[prev, sel].map((r, i) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <div className="text-sm font-bold text-slate-700">{r ? r.final_score.toFixed(1) : "-"}</div>
                  <div className="w-full bg-slate-100 rounded-t-lg flex items-end" style={{ height: 90 }}>
                    <div className="w-full rounded-t-lg" style={{
                      height: r ? `${Math.max(4, r.final_score)}%` : "4%",
                      background: i === 1 ? "#0284c7" : "#94a3b8",
                    }} />
                  </div>
                  <div className="text-[11px] text-slate-400">{r ? r.period : (prevPeriod ?? "Semester sebelumnya")}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Review status */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">Review Status</div>
            <div className="flex items-center gap-4 flex-wrap">
              {WORKFLOW_STEPS.map((s, i) => {
                const done = stepDone(sel.workflow_status, s.key);
                return (
                  <div key={s.key} className="flex items-center gap-2">
                    {done ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} className="text-slate-300" />}
                    <span className={`text-sm ${done ? "text-slate-700 font-medium" : "text-slate-400"}`}>{s.label}</span>
                    {i < WORKFLOW_STEPS.length - 1 && <span className="text-slate-200 mx-1">-</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reward & Disiplin (placeholder, modul belum tersedia) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                <Award size={14} /> Reward
              </div>
              <div className="text-sm text-slate-400">Belum ada data reward. Modul Reward Management segera tersedia.</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                <ShieldCheck size={14} /> Status Disiplin
              </div>
              {disiplin ? (
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full ${DISIPLIN_COLOR[disiplin.status_label] ?? "bg-slate-100 text-slate-600"}`}>
                    {disiplin.status_label}
                  </span>
                  {disiplin.active_count > 0 && (
                    <span className="text-[12px] text-slate-500">{disiplin.active_count} sanksi aktif</span>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-400">Tidak ada data disiplin.</div>
              )}
            </div>
          </div>

          {sel.notes && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Catatan Atasan</div>
              <div className="text-sm text-slate-700">{sel.notes}</div>
            </div>
          )}

          {/* History */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">Riwayat KPI</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="py-2 px-2 font-bold">Periode</th>
                    <th className="py-2 px-2 font-bold text-right">Nilai Akhir</th>
                    <th className="py-2 px-2 font-bold">Grade</th>
                    <th className="py-2 px-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice().sort((a, b) => b.period.localeCompare(a.period)).map((r) => (
                    <tr key={r.id} className="border-b border-slate-50">
                      <td className="py-2 px-2 text-slate-700">{r.period}</td>
                      <td className="py-2 px-2 text-right font-semibold text-slate-800">{r.final_score.toFixed(1)}</td>
                      <td className="py-2 px-2 text-slate-600">{r.grade}</td>
                      <td className="py-2 px-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status] ?? "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
