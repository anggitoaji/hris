import { SlidersHorizontal } from "lucide-react";
import type { VisibilityState, WidgetKey } from "../types";

const WIDGET_DEFS: { key: WidgetKey; label: string }[] = [
  { key: "kpi",           label: "KPI Perusahaan" },
  { key: "project",       label: "Project Record" },
  { key: "meeting",       label: "Meeting (MoM)" },
  { key: "marketing",     label: "Kegiatan Marketing" },
  { key: "modemCustomer", label: "Pelanggan Modem" },
  { key: "modemStock",    label: "Stok Modem" },
  { key: "quickAction",   label: "Quick Action" },
];

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center justify-between w-full py-2">
      <span className="text-sm text-slate-600">{label}</span>
      <span
        className="relative inline-flex rounded-full transition-colors shrink-0"
        style={{ width: 34, height: 20, background: on ? "#2563eb" : "#cbd5e1" }}
      >
        <span
          className="absolute rounded-full bg-white shadow transition-all"
          style={{ width: 16, height: 16, top: 2, left: on ? 16 : 2 }}
        />
      </span>
    </button>
  );
}

interface Props {
  open: boolean;
  onToggleOpen: () => void;
  visible: VisibilityState;
  onToggle: (key: WidgetKey) => void;
}

export default function WidgetToggle({ open, onToggleOpen, visible, onToggle }: Props) {
  return (
    <div className="px-6 mb-1 flex justify-end relative">
      <button
        onClick={onToggleOpen}
        className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm text-sm text-slate-600 hover:border-blue-300 transition-colors"
      >
        <SlidersHorizontal size={15} /> Atur Widget
      </button>
      {open && (
        <div
          className="absolute right-6 z-40 bg-white border border-slate-100 rounded-2xl shadow-lg p-4"
          style={{ top: 48, width: 250 }}
        >
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Tampilkan Widget
          </div>
          {WIDGET_DEFS.map((w) => (
            <Switch key={w.key} on={visible[w.key]} onClick={() => onToggle(w.key)} label={w.label} />
          ))}
        </div>
      )}
    </div>
  );
}
