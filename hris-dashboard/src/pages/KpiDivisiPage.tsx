import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { fetchKpiAssessments, fetchKpiPeriods, type KpiAssessment } from "../services/api";

const STATUS_ORDER = ["Excellent", "Good", "Below", "Poor"] as const;
const STATUS_BADGE: Record<string, string> = {
  Excellent: "bg-emerald-100 text-emerald-700",
  Good: "bg-sky-100 text-sky-700",
  Below: "bg-amber-100 text-amber-700",
  Poor: "bg-red-100 text-red-700",
};

type Row = {
  dept: string;
  count: number;
  avg: number;
  coaching: number;
  status: Record<string, number>;
};

export default function KpiDivisiPage() {
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

  const data = useMemo(() => {
    const map = new Map<string, Row>();
    rows.forEach((r) => {
      const dept = r.employee_department || "(Tanpa Divisi)";
      const cur = map.get(dept) ?? { dept, count: 0, avg: 0, coaching: 0, status: { Excellent: 0, Good: 0, Below: 0, Poor: 0 } };
      cur.count += 1;
      cur.avg += r.overall_score;
      if (r.needs_coaching) cur.coaching += 1;
      cur.status[r.status] = (cur.status[r.status] ?? 0) + 1;
      map.set(dept, cur);
    });
    const list = [...map.values()].map((d) => ({ ...d, avg: d.avg / d.count })).sort((a, b) => b.avg - a.avg);
    const companyAvg = rows.length ? rows.reduce((a, r) => a + r.overall_score, 0) / rows.length : 0;
    return { list, companyAvg, totalAssessed: rows.length };
  }, [rows]);

  const barColor = (v: number) => (v >= 90 ? "bg-emerald-500" : v >= 75 ? "bg-sky-500" : v >= 60 ? "bg-amber-500" : "bg-red-500");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">KPI Divisi</h1>
          <p className="text-sm text-slate-400">Rata-rata kinerja & sebaran status per divisi.</p>
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
          Belum ada penilaian KPI pada periode ini.
        </div>
      )}

      {!loading && !err && rows.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3">
            <StatCard label="Divisi Dinilai" value={data.list.length} />
            <StatCard label="Karyawan Dinilai" value={data.totalAssessed} />
            <StatCard label="Rata-rata Perusahaan" value={data.companyAvg.toFixed(1)} sub="dari 100" />
            <StatCard label="Divisi Terbaik" value={data.list[0]?.dept ?? "-"} sub={data.list[0] ? `skor ${data.list[0].avg.toFixed(1)}` : ""} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="py-2 px-2 font-bold">Divisi</th>
                  <th className="py-2 px-2 font-bold text-center">Dinilai</th>
                  <th className="py-2 px-2 font-bold">Rata-rata Skor</th>
                  <th className="py-2 px-2 font-bold">Sebaran Status</th>
                  <th className="py-2 px-2 font-bold text-center">Perlu Coaching</th>
                </tr>
              </thead>
              <tbody>
                {data.list.map((d) => (
                  <tr key={d.dept} className="border-b border-slate-50">
                    <td className="py-2.5 px-2 font-medium text-slate-800">{d.dept}</td>
                    <td className="py-2.5 px-2 text-center text-slate-600">{d.count}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-28 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className={`h-full ${barColor(d.avg)}`} style={{ width: `${Math.min(d.avg, 100)}%` }} />
                        </div>
                        <span className="font-semibold text-slate-700 w-10">{d.avg.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex gap-1 flex-wrap">
                        {STATUS_ORDER.map((s) => (d.status[s] > 0 ? (
                          <span key={s} className={`text-[11px] px-1.5 py-0.5 rounded-full ${STATUS_BADGE[s]}`}>{s} {d.status[s]}</span>
                        ) : null))}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {d.coaching > 0 ? <span className="text-amber-600 font-semibold">{d.coaching}</span> : <span className="text-slate-300">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
