import { TrendingUp, TrendingDown, Activity, Target, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AccentKey } from "../../types";
import { KPIS } from "../../data/mock";
import Card from "../ui/Card";
import Sparkline from "../ui/Sparkline";

const ACCENTS: Record<AccentKey, { text: string; soft: string; Icon: LucideIcon }> = {
  green:  { text: "#16a34a", soft: "#dcfce7", Icon: Activity },
  amber:  { text: "#f59e0b", soft: "#fef3c7", Icon: Target },
  violet: { text: "#7c3aed", soft: "#ede9fe", Icon: Wallet },
};

export default function KPISection() {
  return (
    <Card title="KPI Perusahaan" action="Lihat Dashboard KPI" className="h-full">
      <div className="flex flex-col gap-5">
        {KPIS.map((k, i) => {
          const a = ACCENTS[k.accent];
          const up = k.direction === "up";
          return (
            <div key={i} className="flex items-center gap-4">
              <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 44, height: 44, background: a.soft }}>
                <a.Icon size={20} color={a.text} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-700">{k.label}</div>
                <Sparkline values={k.trend} color={a.text} />
              </div>
              <div className="text-right shrink-0">
                <div className="text-xl font-bold text-slate-800">{k.value}%</div>
                <div className="flex items-center gap-1 justify-end text-xs font-medium" style={{ color: up ? "#16a34a" : "#dc2626" }}>
                  {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{k.change}%
                </div>
                <div className="text-[10px] text-slate-400">dari bulan lalu</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
