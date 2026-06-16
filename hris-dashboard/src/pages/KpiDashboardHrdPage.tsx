import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Users, TrendingUp, ShieldAlert, Award, Lock } from "lucide-react";
import {
  fetchKpiAssessments, fetchKpiCompliance, fetchKpiPeriodMeta, setKpiPeriodDeadline, closeKpiPeriod,
  fetchEmployees, type ComplianceRow, type KpiPeriodMeta,
} from "../services/api";
import type { KpiAssessment, Employee } from "../types";

const MIN_TENURE_YEARS = 1;

// Syarat promosi (spec bagian L): KPI >= 85, kompetensi memenuhi standar, masa kerja cukup.
// Catatan: syarat "tidak memiliki SP aktif" belum dicek di sini karena butuh fetch per-karyawan
// ke modul disiplin (terlalu berat untuk daftar besar) - cek manual via tab Sanksi di profil karyawan.
function isPromotionEligible(kpi: number, competency: number, joinDate: string | null): boolean {
  if (kpi < 85 || competency < 70) return false;
  if (!joinDate) return false;
  const years = (Date.now() - new Date(joinDate).getTime()) / (365.25 * 86400000);
  return years >= MIN_TENURE_YEARS;
}

const STATUS_COLOR: Record<string, string> = {
  Excellent: "bg-emerald-100 text-emerald-700",
  Good: "bg-sky-100 text-sky-700",
  Below: "bg-amber-100 text-amber-700",
  Poor: "bg-red-100 text-red-700",
};

function talentLabel(kpi: number, competency: number, disciplinePoint: number): string {
  if (disciplinePoint > 40) return "Under Performer";
  if (kpi >= 85 && competency >= 80) return "High Performer";
  if (kpi >= 85 && competency >= 60) return "Future Leader";
  if (kpi >= 70 && competency >= 60) return "Core Talent";
  if (kpi < 60) return "Under Performer";
  return "Need Development";
}
const TALENT_COLOR: Record<string, string> = {
  "High Performer": "bg-emerald-100 text-emerald-700",
  "Future Leader": "bg-violet-100 text-violet-700",
  "Core Talent": "bg-sky-100 text-sky-700",
  "Need Development": "bg-amber-100 text-amber-700",
  "Under Performer": "bg-red-100 text-red-700",
};

export default function KpiDashboardHrdPage() {
  const [rows, setRows] = useState<KpiAssessment[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [compliance, setCompliance] = useState<ComplianceRow[]>([]);
  const [periodMeta, setPeriodMeta] = useState<KpiPeriodMeta | null>(null);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    setLoading(true);
    fetchKpiAssessments().then((all) => {
      setRows(all);
      setPeriods(Array.from(new Set(all.map((r) => r.period))).sort().reverse());
      setErr(null);
    }).catch((e) => setErr(e instanceof Error ? e.message : "Gagal memuat data")).finally(() => setLoading(false));
    fetchEmployees().then(setEmployees).catch(() => {});
  }, []);
  const joinDateById = useMemo(() => new Map(employees.map((e) => [e.id, e.join_date])), [employees]);

  const activePeriod = period || periods[0] || "";

  useEffect(() => {
    if (!activePeriod) return;
    fetchKpiCompliance(activePeriod).then(setCompliance).catch(() => setCompliance([]));
    fetchKpiPeriodMeta(activePeriod).then((m) => { setPeriodMeta(m); setDeadlineInput(m.deadline ?? ""); }).catch(() => setPeriodMeta(null));
  }, [activePeriod]);

  const periodRows = useMemo(() => rows.filter((r) => r.period === activePeriod), [rows, activePeriod]);

  const reviewPending = periodRows.filter((r) => r.workflow_status !== "final_approved").length;
  const atasanBelumMenilai = compliance.filter((c) => !c.compliant);

  const byDivisi = useMemo(() => {
    const map = new Map<string, KpiAssessment[]>();
    for (const r of periodRows) {
      const k = r.employee_department || "-";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries()).map(([dept, items]) => ({
      dept, count: items.length,
      avg: items.length ? Math.round((items.reduce((a, b) => a + b.final_score, 0) / items.length) * 10) / 10 : 0,
    })).sort((a, b) => b.avg - a.avg);
  }, [periodRows]);

  // Discipline score belum diikutkan di sini (butuh fetch per-karyawan ke modul disiplin,
  // terlalu berat untuk daftar besar) - klasifikasi talent saat ini hanya dari KPI + Kompetensi.
  const talentRows = useMemo(() => periodRows.map((r) => ({
    r, talent: talentLabel(r.final_score, r.competency_score, 0),
  })), [periodRows]);
  const talentCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of talentRows) c[t.talent] = (c[t.talent] ?? 0) + 1;
    return c;
  }, [talentRows]);

  async function saveDeadline() {
    if (!activePeriod) return;
    setBusy(true);
    try {
      const m = await setKpiPeriodDeadline(activePeriod, deadlineInput || null);
      setPeriodMeta(m);
    } catch (e) { setErr(e instanceof Error ? e.message : "Gagal menyimpan deadline."); }
    setBusy(false);
  }

  async function doClosePeriod() {
    if (!activePeriod) return;
    if (!window.confirm(`Tutup periode "${activePeriod}"? Atasan yang belum 100% menilai bawahannya akan otomatis FINAL KPI = 0 tanpa pengecualian.`)) return;
    setBusy(true);
    try {
      const res = await closeKpiPeriod(activePeriod);
      setErr(null);
      window.alert(`Periode ditutup. ${res.non_compliant_count} atasan tidak patuh: ${res.non_compliant_names.join(", ") || "-"}`);
      const m = await fetchKpiPeriodMeta(activePeriod);
      setPeriodMeta(m);
      fetchKpiAssessments().then(setRows);
    } catch (e) { setErr(e instanceof Error ? e.message : "Gagal menutup periode."); }
    setBusy(false);
  }

  let daysLeft: number | null = null;
  if (periodMeta?.deadline) {
    daysLeft = Math.ceil((new Date(periodMeta.deadline).getTime() - Date.now()) / 86400000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Dashboard HRD - KPI &amp; People Management</h1>
          <p className="text-sm text-slate-400">Progress penilaian, kepatuhan atasan, talent review, dan status disiplin perusahaan.</p>
        </div>
        {periods.length > 0 && (
          <select value={activePeriod} onChange={(e) => setPeriod(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-sky-300 bg-white">
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {loading && <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center"><Loader2 size={16} className="animate-spin" /> Memuat data...</div>}
      {err && !loading && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{err}</div>}

      {!loading && (
        <>
          {/* Reminder H-14/H-7/H-1 */}
          {daysLeft !== null && !periodMeta?.closed && daysLeft <= 14 && (
            <div className={`flex items-center gap-2 text-sm rounded-lg p-3 border ${daysLeft <= 1 ? "bg-red-50 border-red-100 text-red-700" : daysLeft <= 7 ? "bg-amber-50 border-amber-100 text-amber-700" : "bg-sky-50 border-sky-100 text-sky-700"}`}>
              <AlertTriangle size={16} />
              {daysLeft <= 0 ? "Batas waktu review KPI sudah berakhir." : `Sisa waktu ${daysLeft} hari sebelum deadline penilaian KPI periode ${activePeriod}.`}
            </div>
          )}

          {/* Period control */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3 flex-wrap">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Periode {activePeriod || "-"}</div>
            <input type="date" value={deadlineInput} onChange={(e) => setDeadlineInput(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-sky-300" disabled={!!periodMeta?.closed} />
            <button onClick={saveDeadline} disabled={busy || !!periodMeta?.closed} className="text-sm text-sky-600 hover:text-sky-700 disabled:opacity-50">Simpan Deadline</button>
            <div className="flex-1" />
            {periodMeta?.closed ? (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600"><Lock size={12} /> Periode Ditutup ({periodMeta.closed_by})</span>
            ) : (
              <button onClick={doClosePeriod} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
                <Lock size={14} /> Tutup Periode
              </button>
            )}
          </div>

          {/* Top metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2"><Users size={14} /> KPI Progress</div>
              <div className="text-2xl font-bold text-slate-800">{periodRows.length}</div>
              <div className="text-[11px] text-slate-400">total penilaian periode ini</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2"><TrendingUp size={14} /> Review Pending</div>
              <div className="text-2xl font-bold text-amber-600">{reviewPending}</div>
              <div className="text-[11px] text-slate-400">belum final approved</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2"><ShieldAlert size={14} /> Atasan Belum Menilai</div>
              <div className="text-2xl font-bold text-red-600">{atasanBelumMenilai.length}</div>
              <div className="text-[11px] text-slate-400">dari {compliance.length} atasan</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2"><Award size={14} /> Top Talent</div>
              <div className="text-2xl font-bold text-emerald-600">{(talentCounts["High Performer"] ?? 0) + (talentCounts["Future Leader"] ?? 0)}</div>
              <div className="text-[11px] text-slate-400">High Performer + Future Leader</div>
            </div>
          </div>

          {/* Atasan Belum Menyelesaikan Penilaian */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">People Management Compliance - Atasan Belum Menyelesaikan Penilaian</div>
            {compliance.length === 0 ? (
              <div className="text-center text-slate-400 py-6">Tidak ada data atasan/bawahan untuk periode ini.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="py-2 px-2 font-bold">Atasan</th>
                    <th className="py-2 px-2 font-bold">Peran</th>
                    <th className="py-2 px-2 font-bold text-right">Selesai / Wajib</th>
                    <th className="py-2 px-2 font-bold text-right">Compliance</th>
                    <th className="py-2 px-2 font-bold">Status</th>
                  </tr></thead>
                  <tbody>
                    {compliance.map((c) => (
                      <tr key={c.atasan_id} className="border-b border-slate-50">
                        <td className="py-2 px-2 text-slate-700 font-medium">{c.atasan_nama}</td>
                        <td className="py-2 px-2 text-slate-600">{c.atasan_role_hint}</td>
                        <td className="py-2 px-2 text-right text-slate-600">{c.selesai} / {c.total_bawahan}</td>
                        <td className="py-2 px-2 text-right font-semibold text-slate-800">{c.compliance_pct.toFixed(0)}%</td>
                        <td className="py-2 px-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${c.compliant ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {c.compliant ? "Patuh" : "Belum Lengkap"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Distribusi KPI per Divisi */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">Distribusi KPI per Divisi</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {byDivisi.map((d) => (
                <div key={d.dept} className="border border-slate-100 rounded-xl p-3">
                  <div className="text-sm font-medium text-slate-700 mb-1">{d.dept}</div>
                  <div className="flex justify-between text-[12px] text-slate-500 mb-1"><span>{d.count} karyawan</span><span>Avg {d.avg.toFixed(1)}</span></div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, d.avg)}%` }} /></div>
                </div>
              ))}
              {byDivisi.length === 0 && <div className="text-sm text-slate-300">Belum ada data.</div>}
            </div>
          </div>

          {/* Talent Pool */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">Talent Review Matrix</div>
            <div className="flex items-center gap-3 flex-wrap mb-3">
              {Object.entries(talentCounts).map(([label, count]) => (
                <span key={label} className={`text-xs px-2.5 py-1 rounded-full font-medium ${TALENT_COLOR[label] ?? "bg-slate-100 text-slate-600"}`}>{label}: {count}</span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="py-2 px-2 font-bold">Nama</th>
                  <th className="py-2 px-2 font-bold">Divisi</th>
                  <th className="py-2 px-2 font-bold text-right">KPI Final</th>
                  <th className="py-2 px-2 font-bold">Grade</th>
                  <th className="py-2 px-2 font-bold">Status KPI</th>
                  <th className="py-2 px-2 font-bold">Talent</th>
                  <th className="py-2 px-2 font-bold">Promosi</th>
                </tr></thead>
                <tbody>
                  {talentRows.sort((a, b) => b.r.final_score - a.r.final_score).map(({ r, talent }) => {
                    const eligible = isPromotionEligible(r.final_score, r.competency_score, joinDateById.get(r.employee_id) ?? null);
                    return (
                      <tr key={r.id} className="border-b border-slate-50">
                        <td className="py-2 px-2 text-slate-700 font-medium">{r.employee_nama}</td>
                        <td className="py-2 px-2 text-slate-600">{r.employee_department}</td>
                        <td className="py-2 px-2 text-right font-semibold text-slate-800">{r.final_score.toFixed(1)}</td>
                        <td className="py-2 px-2 text-slate-600">{r.grade}</td>
                        <td className="py-2 px-2"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status] ?? "bg-slate-100 text-slate-600"}`}>{r.status}</span></td>
                        <td className="py-2 px-2"><span className={`text-xs px-2 py-0.5 rounded-full ${TALENT_COLOR[talent] ?? "bg-slate-100 text-slate-600"}`}>{talent}</span></td>
                        <td className="py-2 px-2">
                          {eligible ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Eligible</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {talentRows.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-6">Belum ada data.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
