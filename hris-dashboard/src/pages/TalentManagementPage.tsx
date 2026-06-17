import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Save, ChevronDown, ChevronUp, Star, TrendingUp, Users, Award } from "lucide-react";
import {
  previewTalent, fetchTalentReviews, saveTalentReviews, updateTalentReview,
  type TalentRow, TALENT_LABELS, SUCCESSION_CATEGORIES,
} from "../services/api";

const LABEL_STYLE: Record<string, string> = {
  "High Performer":   "bg-emerald-100 text-emerald-700",
  "Future Leader":    "bg-violet-100 text-violet-700",
  "Core Talent":      "bg-sky-100 text-sky-700",
  "Need Development": "bg-amber-100 text-amber-700",
  "Under Performer":  "bg-red-100 text-red-700",
};

const SUCC_STYLE: Record<string, string> = {
  "Ready Now":         "bg-emerald-100 text-emerald-700",
  "Ready <1 Tahun":    "bg-sky-100 text-sky-700",
  "Ready 1-2 Tahun":   "bg-amber-100 text-amber-700",
  "Not Ready":         "bg-slate-100 text-slate-500",
};

function ScoreBar({ value, max = 100, color = "#0284c7" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function TalentManagementPage() {
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    const sem = now.getMonth() < 6 ? "S1" : "S2";
    return `${now.getFullYear()}-${sem}`;
  });
  const [rows, setRows] = useState<TalentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [filterLabel, setFilterLabel] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [sortField, setSortField] = useState<keyof TalentRow>("kpi_score");
  const [sortAsc, setSortAsc] = useState(false);
  const [editing, setEditing] = useState<{ id: number; field: string } | null>(null);
  const [editVal, setEditVal] = useState("");

  async function loadPreview() {
    setLoading(true); setErr(null);
    try {
      const data = await previewTalent(period);
      setRows(data);
      setSaved(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }

  async function loadSaved() {
    setLoading(true); setErr(null);
    try {
      const data = await fetchTalentReviews(period);
      if (data.length === 0) {
        await loadPreview();
        return;
      }
      setRows(data);
      setSaved(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSaved(); }, [period]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await saveTalentReviews(period);
      setSaved(true);
      alert(`Talent review ${period} berhasil disimpan untuk ${res.saved} karyawan.`);
      await loadSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function handleCellEdit(row: TalentRow, field: "leadership_score" | "succession_category" | "notes", val: string) {
    if (!saved) {
      alert("Simpan dulu sebelum mengedit detail.");
      return;
    }
    try {
      const payload: Record<string, unknown> = {};
      if (field === "leadership_score") payload.leadership_score = val ? parseFloat(val) : null;
      else payload[field] = val || null;
      const updated = await updateTalentReview(period, row.employee_id, payload);
      setRows(r => r.map(x => x.employee_id === row.employee_id ? { ...x, ...updated } : x));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menyimpan");
    }
    setEditing(null);
  }

  const departments = [...new Set(rows.map(r => r.employee_department).filter(Boolean))].sort();

  let filtered = rows
    .filter(r => !filterLabel || r.final_label === filterLabel)
    .filter(r => !filterDept || r.employee_department === filterDept);

  filtered = [...filtered].sort((a, b) => {
    const av = a[sortField] as number | string | null ?? 0;
    const bv = b[sortField] as number | string | null ?? 0;
    if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
    return sortAsc
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  function toggleSort(field: keyof TalentRow) {
    if (sortField === field) setSortAsc(a => !a);
    else { setSortField(field); setSortAsc(false); }
  }

  function Th({ label, field }: { label: string; field?: keyof TalentRow }) {
    const active = field && sortField === field;
    return (
      <th className={`py-3 px-3 font-bold text-left text-slate-500 whitespace-nowrap ${field ? "cursor-pointer hover:text-slate-700 select-none" : ""}`}
        onClick={() => field && toggleSort(field)}>
        <span className="inline-flex items-center gap-1">
          {label}
          {active && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
        </span>
      </th>
    );
  }

  // Distribusi label
  const dist: Record<string, number> = {};
  TALENT_LABELS.forEach(l => { dist[l] = rows.filter(r => r.final_label === l).length; });

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Talent Management</h1>
          <p className="text-sm text-slate-400">Klasifikasi talenta berdasarkan KPI, Kompetensi, Disiplin, dan Leadership</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="e.g. 2025-S1"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-300 w-28" />
          <button onClick={loadPreview} disabled={loading}
            className="flex items-center gap-1.5 text-sm px-3 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 disabled:opacity-50">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Preview
          </button>
          <button onClick={handleSave} disabled={saving || loading}
            className="flex items-center gap-1.5 text-sm px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Finalisasi
          </button>
        </div>
      </div>

      {saved && (
        <div className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg px-3 py-2">
          Data talent review periode <strong>{period}</strong> sudah disimpan. Klik "Preview" untuk kalkulasi ulang dari data KPI & Disiplin terbaru, lalu "Finalisasi" untuk update.
        </div>
      )}
      {!saved && rows.length > 0 && (
        <div className="text-xs bg-amber-50 border border-amber-100 text-amber-700 rounded-lg px-3 py-2">
          Mode preview — kalkulasi langsung dari KPI &amp; Disiplin terbaru. Klik "Finalisasi" untuk menyimpan.
        </div>
      )}

      {/* Distribusi */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {TALENT_LABELS.map(label => (
            <button key={label} onClick={() => setFilterLabel(filterLabel === label ? "" : label)}
              className={`text-left rounded-xl border p-3 transition-all ${filterLabel === label ? "ring-2 ring-sky-400" : "hover:shadow-sm"} ${LABEL_STYLE[label] ?? "bg-slate-100 text-slate-600"} border-transparent`}>
              <div className="text-xl font-bold">{dist[label] ?? 0}</div>
              <div className="text-[11px] font-medium mt-0.5">{label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Quick summary cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Users size={14} /> Total Karyawan</div>
            <div className="text-2xl font-bold text-slate-800">{rows.length}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Star size={14} /> Eligible Promosi</div>
            <div className="text-2xl font-bold text-emerald-600">{rows.filter(r => r.promotion_eligible).length}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><TrendingUp size={14} /> Avg KPI Score</div>
            <div className="text-2xl font-bold text-sky-700">
              {rows.length > 0 ? (rows.reduce((s, r) => s + r.kpi_score, 0) / rows.length).toFixed(1) : "—"}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Award size={14} /> Ready Now</div>
            <div className="text-2xl font-bold text-violet-600">
              {rows.filter(r => r.succession_category === "Ready Now").length}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {rows.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-sky-300 bg-white">
            <option value="">Semua Departemen</option>
            {departments.map(d => <option key={d!} value={d!}>{d}</option>)}
          </select>
          {filterLabel && (
            <button onClick={() => setFilterLabel("")}
              className="text-sm text-slate-500 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50">
              × {filterLabel}
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center">
          <Loader2 size={16} className="animate-spin" /> Memuat...
        </div>
      )}
      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{err}</div>}

      {!loading && rows.length === 0 && !err && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400">
          Klik "Preview" untuk melihat kalkulasi talent review periode <strong>{period}</strong>.
        </div>
      )}

      {/* Matrix Table */}
      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[12px]">
                  <Th label="Nama" field="employee_nama" />
                  <Th label="Departemen" field="employee_department" />
                  <Th label="Jabatan" />
                  <Th label="KPI" field="kpi_score" />
                  <Th label="Kompetensi" field="competency_score" />
                  <Th label="Disiplin" field="discipline_score" />
                  <Th label="Leadership" field="leadership_score" />
                  <Th label="Talent Label" field="final_label" />
                  <Th label="Succession" field="succession_category" />
                  <Th label="Promosi" field="promotion_eligible" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.employee_id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-800 text-[13px]">{row.employee_nama}</div>
                      {!row.has_kpi && row.has_kpi !== undefined && (
                        <div className="text-[10px] text-amber-500">Belum ada KPI final</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[12px]">{row.employee_department}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-[12px]">{row.employee_position}</td>

                    {/* KPI */}
                    <td className="py-2.5 px-3 min-w-[80px]">
                      <div className="font-semibold text-slate-800 text-[13px]">{row.kpi_score.toFixed(1)}</div>
                      <ScoreBar value={row.kpi_score} color={row.kpi_score >= 75 ? "#10b981" : row.kpi_score >= 60 ? "#f59e0b" : "#ef4444"} />
                    </td>

                    {/* Kompetensi */}
                    <td className="py-2.5 px-3 min-w-[80px]">
                      <div className="font-semibold text-slate-800 text-[13px]">{row.competency_score.toFixed(1)}</div>
                      <ScoreBar value={row.competency_score} color="#818cf8" />
                    </td>

                    {/* Disiplin */}
                    <td className="py-2.5 px-3 min-w-[80px]">
                      <div className="font-semibold text-slate-800 text-[13px]">{row.discipline_score.toFixed(0)}</div>
                      <ScoreBar value={row.discipline_score} color={row.discipline_score >= 80 ? "#10b981" : row.discipline_score >= 50 ? "#f59e0b" : "#ef4444"} />
                    </td>

                    {/* Leadership - editable */}
                    <td className="py-2.5 px-3 min-w-[80px]">
                      {editing?.id === row.employee_id && editing.field === "leadership" ? (
                        <input
                          type="number" min="0" max="100" step="0.5"
                          autoFocus defaultValue={row.leadership_score ?? ""}
                          className="w-16 border border-sky-300 rounded px-1 py-0.5 text-sm outline-none"
                          onBlur={e => handleCellEdit(row, "leadership_score", e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        />
                      ) : (
                        <button
                          onClick={() => { setEditing({ id: row.employee_id, field: "leadership" }); setEditVal(String(row.leadership_score ?? "")); }}
                          className="text-[13px] font-semibold text-slate-800 hover:text-sky-600 cursor-pointer min-w-[40px] text-left">
                          {row.leadership_score != null ? row.leadership_score.toFixed(1) : <span className="text-slate-300">—</span>}
                        </button>
                      )}
                    </td>

                    {/* Talent Label */}
                    <td className="py-2.5 px-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${LABEL_STYLE[row.final_label] ?? "bg-slate-100 text-slate-600"}`}>
                        {row.final_label}
                      </span>
                    </td>

                    {/* Succession - editable */}
                    <td className="py-2.5 px-3">
                      {editing?.id === row.employee_id && editing.field === "succession" ? (
                        <select autoFocus defaultValue={row.succession_category ?? ""}
                          className="border border-sky-300 rounded px-1 py-0.5 text-[12px] outline-none"
                          onBlur={e => handleCellEdit(row, "succession_category", e.target.value)}
                          onChange={e => handleCellEdit(row, "succession_category", e.target.value)}>
                          <option value="">— Pilih —</option>
                          {SUCCESSION_CATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditing({ id: row.employee_id, field: "succession" })}
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap cursor-pointer ${row.succession_category ? SUCC_STYLE[row.succession_category] ?? "bg-slate-100 text-slate-600" : "text-slate-300 hover:text-sky-500"}`}>
                          {row.succession_category ?? "Set..."}
                        </button>
                      )}
                    </td>

                    {/* Promosi */}
                    <td className="py-2.5 px-3">
                      {row.promotion_eligible ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Eligible</span>
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-3">Kriteria Klasifikasi Talent</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[12px]">
          {[
            { label: "High Performer",   rule: "KPI ≥ 90 & Kompetensi ≥ 80" },
            { label: "Future Leader",    rule: "KPI ≥ 80 & Kompetensi ≥ 80 & Leadership ≥ 70" },
            { label: "Core Talent",      rule: "KPI ≥ 75 & Kompetensi ≥ 70" },
            { label: "Need Development", rule: "KPI ≥ 60" },
            { label: "Under Performer",  rule: "KPI < 60" },
          ].map(({ label, rule }) => (
            <div key={label} className="flex items-start gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${LABEL_STYLE[label]}`}>{label}</span>
              <span className="text-slate-500">{rule}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[11px] text-slate-400">
          Disiplin Score = 100 − (total poin aktif / 60 × 100). Klik kolom Leadership & Succession untuk edit langsung (hanya setelah Finalisasi).
          Promosi eligible jika KPI ≥ 85, Kompetensi ≥ 70, masa kerja ≥ 1 tahun.
        </div>
      </div>
    </div>
  );
}
