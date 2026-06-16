import { useState, useEffect, type ReactNode } from "react";
import { Hammer, Loader2 } from "lucide-react";
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
import KpiAssessmentFormPage from "./pages/KpiAssessmentFormPage";
import KpiDashboardHrdPage from "./pages/KpiDashboardHrdPage";
import MyKpiDashboardPage from "./pages/MyKpiDashboardPage";
import LoginPage from "./pages/LoginPage";
import UserManagementPage from "./pages/UserManagementPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import OrgChartPage from "./pages/OrgChartPage";
import OrgDesignerPage from "./pages/OrgDesignerPage";
import {
  fetchMe, setAuthToken, getAuthToken, setOnUnauthorized,
  type AuthUser, type LoginResult,
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

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [route, setRoute] = useState("dashboard");
  const [role, setRole] = useState<Role>("Super Admin");

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
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          username={user.username}
          role={user.role}
          onLogout={handleLogout}
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

          {route === "kpi.assessment" && <KpiAssessmentFormPage role={role} />}

          {route === "kpi.dashboard_hrd" && <KpiDashboardHrdPage />}

          {route === "kpi.myself" && <MyKpiDashboardPage employeeId={user.employee_id} />}

          {route === "users.manage" && <UserManagementPage />}

          {route === "settings.password" && <ChangePasswordPage />}

          {route === "orgchart.overview"  && <OrgChartPage divisi="overview" role={role} />}
          {route === "orgchart.itvpn"     && <OrgDesignerPage divisi="itvpn"    role={role} />}
          {route === "orgchart.finance"  && <OrgDesignerPage divisi="finance"   role={role} />}
          {route === "orgchart.marketing"&& <OrgDesignerPage divisi="marketing" role={role} />}
          {route === "orgchart.hrdga"    && <OrgDesignerPage divisi="hrdga"     role={role} />}

          {route.startsWith("soon:") && <ComingSoon name={route.slice(5)} />}
        </main>
      </div>
    </div>
  );
}
