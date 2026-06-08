import { useEffect, useMemo, useState } from "react";
import { Loader2, CheckSquare, Square, Search } from "lucide-react";
import { fetchActionItems, patchActionItem, type ActionItemFlat } from "../services/api";

const CAT_COLOR: Record<string, string> = {
  Internal: "bg-sky-100 text-sky-700",
  Pelanggan: "bg-violet-100 text-violet-700",
};

function fmtDate(s: string | null): string {
  if (!s) return "-";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function isOverdue(s: string | null, done: boolean): boolean {
  if (!s || done) return false;
  const d = new Date(s + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

export default function ActionItemsPage() {
  const [rows, setRows] = useState<ActionItemFlat[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const done = filter === "all" ? undefined : filter === "done";
      const data = await fetchActionItems(done);
      setRows(data);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => [r.task, r.assignee, r.meeting_title].some((v) => (v ?? "").toLowerCase().includes(s)));
  }, [rows, q]);

  async function toggle(r: ActionItemFlat) {
    setBusyId(r.id);
    try {
      await patchActionItem(r.id, { done: !r.done });
      await load();
    } catch {
      /* abaikan */
    } finally {
      setBusyId(null);
    }
  }

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 text-sm rounded-lg ${active ? "bg-sky-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Action Item</h1>
        <p className="text-sm text-slate-400">Daftar tindak lanjut dari seluruh rapat - centang bila sudah selesai.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-2">
            <button className={tabCls(filter === "open")} onClick={() => setFilter("open")}>Belum selesai</button>
            <button className={tabCls(filter === "done")} onClick={() => setFilter("done")}>Selesai</button>
            <button className={tabCls(filter === "all")} onClick={() => setFilter("all")}>Semua</button>
          </div>
          <div className="relative flex-1 min-w-[180px] max-w-sm ml-auto">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari tugas, PIC, rapat..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300" />
          </div>
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
          <div className="flex flex-col divide-y divide-slate-100">
            {filtered.map((r) => (
              <div key={r.id} className="flex items-start gap-3 py-3">
                <button onClick={() => toggle(r)} disabled={busyId === r.id}
                  className={`mt-0.5 ${r.done ? "text-emerald-600" : "text-slate-300 hover:text-slate-500"}`}>
                  {busyId === r.id ? <Loader2 size={18} className="animate-spin" /> : r.done ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm ${r.done ? "line-through text-slate-400" : "text-slate-800 font-medium"}`}>{r.task}</div>
                  <div className="flex items-center gap-2 flex-wrap text-[12px] text-slate-400 mt-0.5">
                    {r.assignee && <span>PIC: <span className="text-slate-600">{r.assignee}</span></span>}
                    {r.due_date && (
                      <span className={isOverdue(r.due_date, r.done) ? "text-red-500 font-medium" : ""}>
                        Tenggat: {fmtDate(r.due_date)}{isOverdue(r.due_date, r.done) ? " (lewat)" : ""}
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${CAT_COLOR[r.meeting_category] ?? "bg-slate-100 text-slate-500"}`}>{r.meeting_category}</span>
                    <span className="truncate">dari: {r.meeting_title}{r.meeting_date ? ` (${fmtDate(r.meeting_date)})` : ""}</span>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center text-slate-400 py-8 text-sm">Tidak ada action item pada filter ini.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
