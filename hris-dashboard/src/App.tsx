import { useState, useEffect, type ReactNode } from "react";
import { Hammer, Loader2, X } from "lucide-react";
import type { VisibilityState, WidgetKey } from "./types";
import Sidebar, { type Role } from "./components/Sidebar";
import Header from "./components/Header";
import WidgetToggle from "./components/WidgetToggle";
import KPISection from "./components/sections/KPISection";
import ProjectSection from "./components/sections/ProjectSection";
import MeetingSection from "./components/sections/MeetingSection";
import MarketingActivitySection from "./components/sections/MarketingActivitySection";
import ModemCustomerSection from "./components/sections/ModemCustomerSection";
import ModemStockSection from "./components/sections/ModemStockSection";
import QuickActionSection from "./components/sections/QuickActionSection";
import DataKaryawanPage from "./pages/DataKaryawanPage";
import KpiKaryawanPage from "./pages/KpiKaryawanPage";
import KehadiranPage from "./pages/KehadiranPage";
import SlipGajiPage from "./pages/SlipGajiPage";
import MeetingPage from "./pages/MeetingPage";
import ActionItemsPage from "./pages/ActionItemsPage";
import KpiPerusahaanPage from "./pages/KpiPerusahaanPage";
import KpiDivisiPage from "./pages/KpiDivisiPage";
import LoginPage from "./pages/LoginPage";
import {
  fetchMe, setAuthToken, getAuthToken, setOnUnauthorized,
  changePassword as apiChangePassword, type AuthUser, type LoginResult,
} from "./services/api";

const GRID_ORDER: WidgetKey[] = [
  "kpi", "project", "meeting", "marketing", "modemCustomer", "modemStock",
];

const NODES: Record<WidgetKey, ReactNode> = {
  kpi: <KPISection />,
  project: <ProjectSection />,
  meeting: <MeetingSection />,
  marketing: <MarketingActivitySection />,
  modemCustomer: <ModemCustomerSection />,
  modemStock: <ModemStockSection />,
  quickAction: <QuickActionSection />,
};

function ComingSoon({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 text-slate-400">
      <Hammer size={30} className="mb-3" />
      <div className="text-lg font-semibold text-slate-600">{name}</div>
      <div className="text-sm">Modul ini sedang dibangun.</div>
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit() {
    if (newPw.length < 6) { setErr("Password baru minimal 6 karakter."); return; }
    if (newPw !== confirmPw) { setErr("Konfirmasi password tidak sama."); return; }
    setBusy(true); setErr(null);
    try {
      await apiChangePassword(oldPw, newPw);
      setOk(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal mengganti password.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-sky-300";
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-slate-800">Ganti Password</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {ok ? (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-3">
            Password berhasil diganti. Gunakan password baru saat login berikutnya.
            <button onClick={onClose} className="block mt-3 px-4 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700">Tutup</button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] text-slate-500 font-medium block mb-1">Password Lama</label>
              <input type="password" className={inputCls} value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-medium block mb-1">Password Baru</label>
              <input type="password" className={inputCls} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-medium block mb-1">Konfirmasi Password Baru</label>
              <input type="password" className={inputCls} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
            {err && <div className="text-sm text-red-600">{err}</div>}
            <div className="flex justify-end gap-2 mt-1">
              <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Batal</button>
              <button onClick={submit} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700 flex items-center gap-2 disabled:opacity-60">
                {busy && <Loader2 size={14} className="animate-spin" />} Simpan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [route, setRoute] = useState("dashboard");
  const [role, setRole] = useState<Role>("Super Admin");
  const [pwOpen, setPwOpen] = useState(false);

  // State widget dashboard (di memori - prototipe).
  const [visible, setVisible] = useState<VisibilityState>({
    kpi: true, project: true, meeting: true, marketing: true,
    modemCustomer: true, modemStock: true, quickAction: true,
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const toggle = (k: WidgetKey) => setVisible((v) => ({ ...v, [k]: !v[k] }));

  useEffect(() => {
    setOnUnauthorized(() => { setAuthToken(null); setUser(null); });
    const t = getAuthToken();
    if (!t) { setBooting(false); return; }
    fetchMe()
      .then((u) => { setUser(u); setRole(u.role as Role); })
      .catch(() => setAuthToken(null))
      .finally(() => setBooting(false));
  }, []);

  function handleSuccess(r: LoginResult) {
    setAuthToken(r.token);
    setUser(r.user);
    setRole(r.user.role as Role);
    setRoute("dashboard");
  }
  function handleLogout() {
    setAuthToken(null);
    setUser(null);
    setRoute("dashboard");
  }

  if (booting) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 gap-2"><Loader2 size={18} className="animate-spin" /> Memuat...</div>;
  }
  if (!user) {
    return <LoginPage onSuccess={handleSuccess} />;
  }

  const gridKeys = GRID_ORDER.filter((k) => visible[k]);
  const isDash = route === "dashboard";

  return (
    <div className="flex min-h-screen text-slate-800">
      <Sidebar
        current={route}
        onNavigate={setRoute}
        role={role}
        onRoleChange={setRole}
        username={user.username}
        realRole={user.role as Role}
        canPreview={user.role === "Super Admin"}
        onLogout={handleLogout}
        onChangePassword={() => setPwOpen(true)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          actions={
            isDash ? (
              <WidgetToggle
                open={panelOpen}
                onToggleOpen={() => setPanelOpen((o) => !o)}
                visible={visible}
                onToggle={toggle}
              />
            ) : null
          }
        />
        <main className="flex-1 px-4 pb-4 flex flex-col gap-3">
          {isDash && (
            <>
              {gridKeys.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {gridKeys.map((k) => <div key={k}>{NODES[k]}</div>)}
                </div>
              )}
              {visible.quickAction && NODES.quickAction}
              {gridKeys.length === 0 && !visible.quickAction && (
                <div className="text-center text-sm text-slate-400 py-20">
                  Semua widget disembunyikan. Buka <span className="font-medium text-slate-600">Atur Widget</span> untuk menampilkannya.
                </div>
              )}
            </>
          )}

          {route === "karyawan.data" && <DataKaryawanPage role={role} />}

          {route === "kpi.karyawan" && <KpiKaryawanPage />}

          {route === "kehadiran.absensi" && <KehadiranPage />}

          {route === "payroll.slip" && <SlipGajiPage />}

          {route === "meeting.internal" && <MeetingPage category="Internal" />}

          {route === "meeting.pelanggan" && <MeetingPage category="Pelanggan" />}

          {route === "meeting.actions" && <ActionItemsPage />}

          {route === "kpi.perusahaan" && <KpiPerusahaanPage />}

          {route === "kpi.divisi" && <KpiDivisiPage />}

          {route.startsWith("soon:") && <ComingSoon name={route.slice(5)} />}
        </main>
      </div>

      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
    </div>
  );
}
