import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Trophy, AlertTriangle } from "lucide-react";
import { fetchKpiAssessments, fetchKpiPeriods, type KpiAssessment } from "../services/api";

const STATUS_ORDER = ["Excellent", "Good", "Below", "Poor"] as const;
const STATUS_BAR: Record<string, string> = {
  Excellent: "bg-emerald-500", Good: "bg-sky-500", Below: "bg-amber-500", Poor: "bg-red-500",
};
const STATUS_LABEL: Record<string, string> = {
  Excellent: "Sangat Baik", Good: "Baik", Below: "Di Bawah", Poor: "Kurang",
};

export default function KpiPerusahaanPage() {
  const [periods, setPeriods] = useState<string[]>([]);
  const [period, setPeriod] = useState<string>("");
  const [rows, setRows] = useState<KpiAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchKpiPeriods().then((ps) => {
      setPeriods(ps);
      if (ps.length) setPeriod((cur) => cur || ps[0]);
      else setLoading(false);
    }).catch((e) => { setErr(e instanceof Error ? e.message : "Gagal memuat periode"); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!period) return;
    setLoading(true);
    fetchKpiAssessments(period)
      .then((d) => { setRows(d); setErr(null); })
      .catch((e) => setErr(e instanceof Error ? e.message : "Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [period]);

  const m = useMemo(() => {
    const count = rows.length;
    const avg = count ? rows.reduce((a, r) => a + r.overall_score, 0) / count : 0;
    const coaching = rows.filter((r) => r.needs_coaching).length;
    const statusCounts: Record<string, number> = { Excellent: 0, Good: 0, Below: 0, Poor: 0 };
    rows.forEach((r) => { statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1; });

    const divMap = new Map<string, { count: number; sum: number }>();
    rows.forEach((r) => {
      const d = r.employee_department || "(Tanpa Divisi)";
      const cur = divMap.get(d) ?? { count: 0, sum: 0 };
      cur.count += 1; cur.sum += r.overall_score;
      divMap.set(d, cur);
    });
    const byDivision = [...divMap.entries()]
      .map(([dept, v]) => ({ dept, count: v.count, avg: v.sum / v.count }))
      .sort((a, b) => b.avg - a.avg);

    const top = [...rows]
      .sort((a, b) => b.overall_score - a.overall_score)
      .slice(0, 5);

    return { count, avg, coaching, statusCounts, byDivision, top, divisions: divMap.size };
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">KPI Perusahaan</h1>
          <p className="text-sm text-slate-400">Ringkasan kinerja seluruh karyawan per periode.</p>
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-sky-300 bg-white">
          {periods.length === 0 && <option value="">- belum ada periode -</option>}
          {periods.map((p) => <option key={p} value={p}>{p}</option>)}
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
      {!loading && !err && rows.length === 0 && (
        <div className="text-sm text-slate-400 bg-white border border-slate-100 rounded-2xl p-8 text-center">
          Belum ada penilaian KPI pada periode ini. Isi dulu di menu Karyawan -&gt; KPI Karyawan.
        </div>
      )}

      {!loading && !err && rows.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3">
            <StatCard label="Karyawan Dinilai" value={m.count} sub={`${m.divisions} divisi`} />
            <StatCard label="Rata-rata Skor" value={m.avg.toFixed(1)} sub="dari 100" />
            <StatCard label="Perlu Coaching" value={m.coaching} sub="karyawan ditandai" />
            <StatCard label="Divisi Terbaik" value={m.byDivision[0]?.dept ?? "-"} sub={m.byDivision[0] ? `skor ${m.byDivision[0].avg.toFixed(1)}` : ""} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Distribusi status */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="font-bold text-slate-700 mb-3 text-sm">Distribusi Status Kinerja</div>
              <div className="flex h-3 rounded-full overflow-hidden mb-3">
                {STATUS_ORDER.map((s) => {
                  const pct = m.count ? (m.statusCounts[s] / m.count) * 100 : 0;
                  return pct > 0 ? <div key={s} className={STATUS_BAR[s]} style={{ width: `${pct}%` }} /> : null;
                })}
              </div>
              <div className="flex flex-col gap-2">
                {STATUS_ORDER.map((s) => (
                  <div key={s} className="flex items-center gap-2 text-sm">
                    <span className={`w-3 h-3 rounded-full ${STATUS_BAR[s]}`} />
                    <span className="text-slate-600 flex-1">{STATUS_LABEL[s]} <span className="text-slate-400">({s})</span></span>
                    <span className="font-semibold text-slate-700">{m.statusCounts[s]}</span>
                    <span className="text-slate-400 text-xs w-12 text-right">{m.count ? ((m.statusCounts[s] / m.count) * 100).toFixed(0) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top performer */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="font-bold text-slate-700 mb-3 text-sm flex items-center gap-1.5"><Trophy size={15} className="text-amber-500" /> Top Performer</div>
              <div className="flex flex-col gap-2">
                {m.top.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3 text-sm">
                    <span className="w-5 text-slate-400 font-bold">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-700 truncate">{r.employee_nama || "-"}</div>
                      <div className="text-[11px] text-slate-400">{r.employee_department || "-"}</div>
                    </div>
                    <span className="font-bold text-slate-800">{r.overall_score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Peringkat divisi */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="font-bold text-slate-700 mb-3 text-sm">Peringkat Divisi (rata-rata skor)</div>
            <div className="flex flex-col gap-3">
              {m.byDivision.map((d) => (
                <div key={d.dept} className="flex items-center gap-3">
                  <div className="w-40 truncate text-sm text-slate-600">{d.dept} <span className="text-slate-400 text-xs">({d.count})</span></div>
                  <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className={`h-full ${d.avg >= 90 ? "bg-emerald-500" : d.avg >= 75 ? "bg-sky-500" : d.avg >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(d.avg, 100)}%` }} />
                  </div>
                  <div className="w-12 text-right text-sm font-semibold text-slate-700">{d.avg.toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>

          {m.coaching > 0 && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle size={14} /> {m.coaching} karyawan ditandai perlu coaching pada periode ini.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex-1 min-w-[160px]">
      <div className="text-[12px] font-bold text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-800 mt-1 truncate">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
