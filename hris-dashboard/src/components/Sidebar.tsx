import { useState } from "react";
import {
  Home, Users, BarChart3, FolderKanban, CalendarDays, Radio,
  Building2, Wallet, FileText, FileBarChart, Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ====== Role & izin ======
export type Role = "Super Admin" | "Direksi" | "HR" | "Manager" | "Finance" | "NOC" | "Karyawan";
const ROLES: Role[] = ["Super Admin", "Direksi", "HR", "Manager", "Finance", "NOC", "Karyawan"];

type Group = "Utama" | "Operasional" | "Sistem";
interface Sub { label: string; roles: Role[]; built?: boolean }
interface Item { key: string; label: string; Icon: LucideIcon; group: Group; roles: Role[]; built?: boolean; sub?: Sub[] }

const MENU: Item[] = [
  { key: "dashboard", label: "Dashboard", Icon: Home, group: "Utama", built: true,
    roles: ["Direksi", "HR", "Manager", "Finance", "NOC", "Karyawan"] },

  { key: "karyawan", label: "Karyawan", Icon: Users, group: "Utama", built: true,
    roles: ["Direksi", "HR", "Manager", "Karyawan"], sub: [
      { label: "Data Karyawan", roles: ["Direksi", "HR", "Manager"], built: true },
      { label: "Kehadiran & Absensi", roles: ["HR", "Manager", "Karyawan"], built: true },
      { label: "Cuti & Izin", roles: ["HR", "Manager", "Karyawan"] },
      { label: "KPI Karyawan", roles: ["Direksi", "HR", "Manager", "Karyawan"], built: true },
      { label: "Rekrutmen", roles: ["HR"] },
    ] },

  { key: "kpi", label: "KPI & Performance", Icon: BarChart3, group: "Utama", built: true,
    roles: ["Direksi", "HR", "Manager", "Finance", "NOC"], sub: [
      { label: "KPI Perusahaan", roles: ["Direksi", "Finance"], built: true },
      { label: "KPI Divisi", roles: ["Direksi", "HR", "Manager", "Finance"], built: true },
      { label: "KPI Pelanggan (SLA/Uptime)", roles: ["Direksi", "NOC"] },
      { label: "Dashboard Eksekutif", roles: ["Direksi"] },
    ] },

  { key: "project", label: "Project Record", Icon: FolderKanban, group: "Operasional",
    roles: ["Direksi", "HR", "Manager"], sub: [
      { label: "Project Aktif", roles: ["Direksi", "HR", "Manager"] },
      { label: "Project Selesai", roles: ["Direksi", "HR", "Manager"] },
      { label: "Project Bermasalah", roles: ["Direksi", "Manager"] },
      { label: "Timeline (Gantt)", roles: ["Direksi", "Manager"] },
    ] },

  { key: "meeting", label: "Meeting (MoM)", Icon: CalendarDays, group: "Operasional",
    roles: ["Direksi", "HR", "Manager", "Finance", "NOC"], sub: [
      { label: "Meeting Internal", roles: ["Direksi", "HR", "Manager", "Finance", "NOC"], built: true },
      { label: "Meeting Pelanggan", roles: ["Direksi", "Manager", "NOC"], built: true },
      { label: "Action Item", roles: ["Direksi", "HR", "Manager"], built: true },
      { label: "Arsip Meeting", roles: ["Direksi", "HR", "Manager", "Finance", "NOC"] },
    ] },

  { key: "modem", label: "Operasional Modem", Icon: Radio, group: "Operasional",
    roles: ["Direksi", "Manager", "NOC"], sub: [
      { label: "Inventory Modem", roles: ["NOC", "Manager", "Direksi"] },
      { label: "Barang Masuk", roles: ["NOC", "Manager"] },
      { label: "Barang Keluar", roles: ["NOC", "Manager"] },
      { label: "Alokasi Modem", roles: ["NOC", "Manager"] },
      { label: "Instalasi", roles: ["NOC"] },
      { label: "RMA / Repair", roles: ["NOC"] },
      { label: "Mutasi Modem", roles: ["NOC", "Manager"] },
      { label: "Monitoring Stok", roles: ["NOC", "Manager", "Direksi"] },
    ] },

  { key: "pelanggan", label: "Pelanggan", Icon: Building2, group: "Operasional",
    roles: ["Direksi", "Manager", "NOC", "Finance"], sub: [
      { label: "Master Pelanggan", roles: ["Direksi", "Manager", "Finance"] },
      { label: "Kontrak", roles: ["Direksi", "Manager", "Finance"] },
      { label: "Lokasi Site", roles: ["Manager", "NOC"] },
      { label: "Modem Aktif", roles: ["Manager", "NOC"] },
      { label: "Ticket", roles: ["NOC", "Manager"] },
      { label: "SLA", roles: ["Direksi", "NOC", "Manager"] },
    ] },

  { key: "keuangan", label: "Keuangan & Payroll", Icon: Wallet, group: "Operasional",
    roles: ["Direksi", "Finance"], sub: [
      { label: "Struktur Gaji", roles: ["Direksi", "Finance"] },
      { label: "Tunjangan & Potongan", roles: ["Direksi", "Finance"] },
      { label: "Slip Gaji", roles: ["Direksi", "Finance"], built: true },
      { label: "Approval Payroll", roles: ["Direksi", "Finance"] },
      { label: "Laporan Payroll", roles: ["Direksi", "Finance"] },
    ] },

  { key: "dokumen", label: "Dokumen", Icon: FileText, group: "Sistem",
    roles: ["Direksi", "HR", "Manager", "Finance", "NOC"], sub: [
      { label: "SOP", roles: ["Direksi", "HR", "Manager", "Finance", "NOC"] },
      { label: "Perjanjian", roles: ["Direksi", "HR", "Finance"] },
      { label: "Legal", roles: ["Direksi", "HR", "Finance"] },
      { label: "Template", roles: ["Direksi", "HR", "Manager", "Finance", "NOC"] },
      { label: "Arsip", roles: ["Direksi", "HR", "Manager", "Finance", "NOC"] },
    ] },

  { key: "laporan", label: "Laporan", Icon: FileBarChart, group: "Sistem",
    roles: ["Direksi", "HR", "Manager", "Finance", "NOC"], sub: [
      { label: "Laporan Karyawan", roles: ["Direksi", "HR"] },
      { label: "Laporan KPI", roles: ["Direksi", "HR", "Manager"] },
      { label: "Laporan Project", roles: ["Direksi", "Manager"] },
      { label: "Laporan Modem", roles: ["Direksi", "NOC", "Manager"] },
      { label: "Laporan Pelanggan", roles: ["Direksi", "Manager", "Finance"] },
      { label: "Export Excel", roles: ["Direksi", "HR", "Manager", "Finance", "NOC"] },
    ] },

  { key: "pengaturan", label: "Pengaturan", Icon: Settings, group: "Sistem",
    roles: [], sub: [
      { label: "User Management", roles: [] },
      { label: "Role & Permission", roles: [] },
      { label: "Workflow Approval", roles: [] },
      { label: "Notifikasi", roles: [] },
      { label: "Audit Log", roles: [] },
    ] },
];

const GROUPS: Group[] = ["Utama", "Operasional", "Sistem"];
const canSee = (roles: Role[], role: Role) => role === "Super Admin" || roles.includes(role);

// Panel melayang berisi nama modul + submenu (muncul saat ikon diklik)
function Flyout({ item, role, onPick }: { item: Item; role: Role; onPick: (sub?: Sub) => void }) {
  const subs = (item.sub || []).filter((s) => canSee(s.roles, role));
  return (
    <div className="absolute left-full top-0 ml-2 z-50 bg-white border border-slate-100 rounded-xl shadow-xl p-2"
      style={{ width: 212, maxHeight: "72vh", overflowY: "auto" }}>
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-sm font-semibold text-slate-800">{item.label}</span>
        {!item.built && <span className="text-[9px] bg-amber-100 text-amber-700 rounded px-1 py-0.5">segera</span>}
      </div>
      {subs.length > 0 ? (
        <div className="mt-1">
          {subs.map((s) => (
            <button key={s.label} onClick={() => onPick(s)}
              className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-md text-[13px] text-slate-600 hover:bg-slate-50">
              <span className="flex-1 truncate">{s.label}</span>
              {!s.built && <span className="text-[9px] text-amber-500 shrink-0">●</span>}
            </button>
          ))}
        </div>
      ) : (
        <button onClick={() => onPick()} className="w-full text-left py-1.5 px-2 rounded-md text-[13px] text-slate-500 hover:bg-slate-50">
          Buka halaman
        </button>
      )}
    </div>
  );
}

// Peta submenu -> route aplikasi. Yang belum dibangun jatuh ke "soon:".
function routeFor(moduleKey: string, sub?: Sub): string {
  if (moduleKey === "dashboard") return "dashboard";
  if (moduleKey === "karyawan" && sub && sub.label === "Data Karyawan") return "karyawan.data";
  if (moduleKey === "karyawan" && sub && sub.label === "KPI Karyawan") return "kpi.karyawan";
  if (moduleKey === "karyawan" && sub && sub.label === "Kehadiran & Absensi") return "kehadiran.absensi";
  if (moduleKey === "keuangan" && sub && sub.label === "Slip Gaji") return "payroll.slip";
  if (moduleKey === "meeting" && sub && sub.label === "Meeting Internal") return "meeting.internal";
  if (moduleKey === "meeting" && sub && sub.label === "Meeting Pelanggan") return "meeting.pelanggan";
  if (moduleKey === "meeting" && sub && sub.label === "Action Item") return "meeting.actions";
  if (moduleKey === "kpi" && sub && sub.label === "KPI Perusahaan") return "kpi.perusahaan";
  if (moduleKey === "kpi" && sub && sub.label === "KPI Divisi") return "kpi.divisi";
  return "soon:" + (sub ? sub.label : moduleKey);
}

export default function Sidebar({ current, onNavigate, role, onRoleChange }: { current: string; onNavigate: (route: string) => void; role: Role; onRoleChange: (r: Role) => void }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [active, setActive] = useState("dashboard");

  const toggle = (k: string) => setOpenKey((o) => (o === k ? null : k));

  // Klik ikon modul: kalau tak punya submenu -> langsung pindah halaman;
  // kalau punya submenu -> buka panel flyout.
  const handleModule = (m: Item) => {
    setActive(m.key);
    if (!m.sub || m.sub.length === 0) {
      setOpenKey(null);
      onNavigate(routeFor(m.key));
      return;
    }
    toggle(m.key);
  };

  // Klik submenu di flyout: pindah halaman + tutup flyout.
  const handlePick = (m: Item, sub?: Sub) => {
    setActive(m.key);
    setOpenKey(null);
    onNavigate(routeFor(m.key, sub));
  };
  const visibleGroups = GROUPS.map((g) => ({ g, items: MENU.filter((m) => m.group === g && canSee(m.roles, role)) }))
    .filter((x) => x.items.length > 0);

  return (
    <aside className="relative flex flex-col items-center border-r border-slate-100 bg-white shrink-0 py-3" style={{ width: 64 }}>
      {/* Logo */}
      <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 38, height: 38, background: "linear-gradient(135deg,#06b6d4,#2563eb)" }}>
        <span className="text-white font-bold text-lg">a</span>
      </div>

      {/* Ikon menu */}
      <nav className="flex flex-col items-center gap-1 mt-5 flex-1">
        {visibleGroups.map(({ g, items }, gi) => (
          <div key={g} className="flex flex-col items-center gap-1">
            {gi > 0 && <div className="my-1.5 border-t border-slate-100" style={{ width: 28 }} />}
            {items.map((m) => {
              const activeKey =
                current === "karyawan.data" ? "karyawan" : current === "dashboard" ? "dashboard" : active;
              const isActive = activeKey === m.key;
              const isOpen = openKey === m.key;
              return (
                <div key={m.key} className="relative">
                  <button
                    onClick={() => handleModule(m)}
                    className="group flex items-center justify-center rounded-xl"
                    style={{ width: 40, height: 40, background: isActive ? "#e0f2fe" : "transparent" }}
                  >
                    <m.Icon size={19} color={isActive ? "#0284c7" : "#64748b"} />
                    {!isOpen && (
                      <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-slate-800 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                        {m.label}{!m.built ? " · segera" : ""}
                      </span>
                    )}
                  </button>
                  {isOpen && <Flyout item={m} role={role} onPick={(sub) => handlePick(m, sub)} />}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Avatar + role */}
      <div className="relative mt-2">
        <button onClick={() => toggle("__role__")}
          className="rounded-full flex items-center justify-center text-white text-[10px] font-bold"
          style={{ width: 32, height: 32, background: "linear-gradient(135deg,#818cf8,#6366f1)" }}>
          AK
        </button>
        {openKey === "__role__" && (
          <div className="absolute left-full bottom-0 ml-2 z-50 bg-white border border-slate-100 rounded-xl shadow-xl p-3" style={{ width: 200 }}>
            <div className="text-xs font-semibold text-slate-700 truncate">Anggi Kurnianto</div>
            <div className="text-[10px] text-slate-400 mb-2">Pratinjau tampilan per role</div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Tampil sebagai</div>
            <select value={role} onChange={(e) => { onRoleChange(e.target.value as Role); setActive("dashboard"); }}
              className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Backdrop untuk menutup (hanya menutupi area konten, ikon tetap bisa diklik) */}
      {openKey && (
        <div className="fixed top-0 bottom-0 right-0 z-40" style={{ left: 64 }} onClick={() => setOpenKey(null)} />
      )}
    </aside>
  );
}
