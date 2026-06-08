import { useState, type ReactNode } from "react";
import { Hammer } from "lucide-react";
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
  const [route, setRoute] = useState("dashboard");
  const [role, setRole] = useState<Role>("Super Admin");

  // State widget dashboard (di memori — prototipe).
  const [visible, setVisible] = useState<VisibilityState>({
    kpi: true, project: true, meeting: true, marketing: true,
    modemCustomer: true, modemStock: true, quickAction: true,
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const toggle = (k: WidgetKey) => setVisible((v) => ({ ...v, [k]: !v[k] }));

  const gridKeys = GRID_ORDER.filter((k) => visible[k]);
  const isDash = route === "dashboard";

  return (
    <div className="flex min-h-screen text-slate-800">
      <Sidebar current={route} onNavigate={setRoute} role={role} onRoleChange={setRole} />
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
    </div>
  );
}
