import { Bell, MessageSquare, Search, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

function todayID(): string {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default function Header({ actions }: { actions?: ReactNode }) {
  return (
    <header className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
      <div className="shrink-0">
        <div className="text-xs text-slate-400 mb-0.5">{todayID()}</div>
        <h1 className="text-lg font-bold text-slate-800">Workspace Dashboard</h1>
      </div>

      <div className="flex-1 min-w-[240px] max-w-xl mx-auto">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
          <Search size={17} className="text-slate-400" />
          <input
            className="flex-1 bg-transparent outline-none text-sm text-slate-600 placeholder-slate-400"
            placeholder="Cari karyawan, divisi, dokumen..."
          />
          <kbd className="text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Ctrl + K</kbd>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {actions}
        <button className="relative">
          <Bell size={20} className="text-slate-500" />
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">2</span>
        </button>
        <button><MessageSquare size={20} className="text-slate-500" /></button>
        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "linear-gradient(135deg,#818cf8,#6366f1)" }}
          >AK</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-800">Anggi Kurnianto</div>
            <div className="text-xs text-slate-400">Super Admin</div>
          </div>
          <ChevronDown size={15} className="text-slate-400" />
        </div>
      </div>
    </header>
  );
}
