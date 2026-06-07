import { MODEM_CUSTOMERS } from "../../data/mock";
import Card from "../ui/Card";
import Donut from "../ui/Donut";

function pct(part: number, total: number): number {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

export default function ModemCustomerSection() {
  const total = MODEM_CUSTOMERS.reduce((s, d) => s + d.units, 0);
  return (
    <Card title="Pelanggan Modem" action="Lihat Semua" className="h-full">
      <div className="flex items-center gap-3">
        <Donut data={MODEM_CUSTOMERS} total={total} unit="unit" centerTop="Total" />
        <div className="flex-1 flex flex-col gap-3">
          {MODEM_CUSTOMERS.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="rounded-full shrink-0" style={{ width: 9, height: 9, background: d.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700">{d.name}</div>
                <div className="text-xs text-slate-400">{d.units.toLocaleString("id-ID")} unit</div>
              </div>
              <span className="text-sm font-semibold" style={{ color: d.color }}>{pct(d.units, total)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 mt-4">
        <span className="text-sm font-medium text-slate-600">Total Modem Aktif</span>
        <span className="text-sm font-bold text-slate-800">{total.toLocaleString("id-ID")} unit</span>
      </div>
    </Card>
  );
}
