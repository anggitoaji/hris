import { useState, type ReactNode } from "react";
import type { VisibilityState, WidgetKey } from "./types";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import WidgetToggle from "./components/WidgetToggle";
import KPISection from "./components/sections/KPISection";
import ProjectSection from "./components/sections/ProjectSection";
import MeetingSection from "./components/sections/MeetingSection";
import MarketingActivitySection from "./components/sections/MarketingActivitySection";
import ModemCustomerSection from "./components/sections/ModemCustomerSection";
import ModemStockSection from "./components/sections/ModemStockSection";
import QuickActionSection from "./components/sections/QuickActionSection";

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

export default function App() {
  // Catatan: state disimpan di memori (prototipe). Untuk permanen per
  // user/role, sambungkan ke API pengaturan backend nanti.
  const [visible, setVisible] = useState<VisibilityState>({
    kpi: true, project: true, meeting: true, marketing: true,
    modemCustomer: true, modemStock: true, quickAction: true,
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const toggle = (k: WidgetKey) => setVisible((v) => ({ ...v, [k]: !v[k] }));

  const gridKeys = GRID_ORDER.filter((k) => visible[k]);

  return (
    <div className="flex min-h-screen text-slate-800">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header />
        <WidgetToggle
          open={panelOpen}
          onToggleOpen={() => setPanelOpen((o) => !o)}
          visible={visible}
          onToggle={toggle}
        />
        <main className="flex-1 px-6 pb-8 flex flex-col gap-5">
          {gridKeys.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {gridKeys.map((k) => <div key={k}>{NODES[k]}</div>)}
            </div>
          )}
          {visible.quickAction && NODES.quickAction}
          {gridKeys.length === 0 && !visible.quickAction && (
            <div className="text-center text-sm text-slate-400 py-20">
              Semua widget disembunyikan. Buka <span className="font-medium text-slate-600">Atur Widget</span> untuk menampilkannya.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
