import {
  Home, Users, BarChart3, FolderKanban, CalendarDays,
  FileText, FileBarChart, Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Daftar modul terpusat — ubah ikon / tambah modul cukup di sini.
interface NavItem { label: string; Icon: LucideIcon; active?: boolean; bottom?: boolean; }

const NAV: NavItem[] = [
  { label: "Dashboard",      Icon: Home, active: true },
  { label: "Karyawan",       Icon: Users },
  { label: "KPI Perusahaan", Icon: BarChart3 },
  { label: "Project Record", Icon: FolderKanban },
  { label: "Meeting (MoM)",  Icon: CalendarDays },
  { label: "Dokumen",        Icon: FileText },
  { label: "Laporan",        Icon: FileBarChart },
  { label: "Pengaturan",     Icon: Settings, bottom: true },
];

function Item({ item }: { item: NavItem }) {
  return (
    <button
      className="group relative flex items-center justify-center rounded-xl transition-colors"
      style={{ width: 40, height: 40, background: item.active ? "#e0f2fe" : "transparent" }}
    >
      <item.Icon size={19} color={item.active ? "#0284c7" : "#64748b"} />
      <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-slate-800 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
        {item.label}
      </span>
    </button>
  );
}

export default function Sidebar() {
  const top = NAV.filter((n) => !n.bottom);
  const bottom = NAV.filter((n) => n.bottom);
  return (
    <aside className="flex flex-col items-center py-4 border-r border-slate-100 bg-white shrink-0" style={{ width: 64 }}>
      <div
        className="flex items-center justify-center rounded-xl mb-6"
        style={{ width: 40, height: 40, background: "linear-gradient(135deg,#06b6d4,#2563eb)" }}
      >
        <span className="text-white font-bold text-lg">a</span>
      </div>
      <nav className="flex flex-col gap-2 flex-1">
        {top.map((s, i) => <Item key={i} item={s} />)}
      </nav>
      <div className="flex flex-col gap-2">
        {bottom.map((s, i) => <Item key={i} item={s} />)}
      </div>
    </aside>
  );
}
