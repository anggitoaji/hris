import { MODEM_STOCK } from "../../data/mock";
import Card from "../ui/Card";
import Donut from "../ui/Donut";

function pct(part: number, total: number): number {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

export default function ModemStockSection() {
  const total = MODEM_STOCK.reduce((s, d) => s + d.units, 0);
  return (
    <Card title="Stok Modem" action="Lihat Semua" className="h-full">
      <div className="flex items-center gap-3">
        <Donut data={MODEM_STOCK} total={total} unit="unit" centerTop="Total" />
        <div className="flex-1 flex flex-col gap-2">
          {MODEM_STOCK.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="rounded-full shrink-0" style={{ width: 9, height: 9, background: d.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700">{d.sub}</div>
                <div className="text-xs text-slate-400">{d.name} · {d.units} unit</div>
              </div>
              <span className="text-sm font-semibold" style={{ color: d.color }}>{pct(d.units, total)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
