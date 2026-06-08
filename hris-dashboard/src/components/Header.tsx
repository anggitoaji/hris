import { Bell, MessageSquare, Search, ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

function todayID(): string {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default function Header({
  actions, username = "User", role = "", onLogout, onChangePassword,
}: {
  actions?: ReactNode;
  username?: string;
  role?: string;
  onLogout?: () => void;
  onChangePassword?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const initials = (username || "?").slice(0, 2).toUpperCase();

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

        <div className="relative">
          <button onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 pl-3 border-l border-slate-200 hover:opacity-80">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg,#818cf8,#6366f1)" }}
            >{initials}</div>
            <div className="leading-tight text-left">
              <div className="text-sm font-semibold text-slate-800">{username}</div>
              <div className="text-xs text-slate-400">{role}</div>
            </div>
            <ChevronDown size={15} className="text-slate-400" />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-slate-100 rounded-xl shadow-xl p-2" style={{ width: 200 }}>
                <div className="px-2 py-1.5 mb-1 border-b border-slate-100">
                  <div className="text-sm font-semibold text-slate-700 truncate">{username}</div>
                  <div className="text-[11px] text-slate-400">{role}</div>
                </div>
                <button onClick={() => { setOpen(false); onChangePassword?.(); }}
                  className="w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-slate-50 text-slate-600">Ganti Password</button>
                <button onClick={() => { setOpen(false); onLogout?.(); }}
                  className="w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-red-50 text-red-600">Keluar (Logout)</button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
