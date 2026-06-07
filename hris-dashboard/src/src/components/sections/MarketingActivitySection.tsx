import { MARKETING } from "../../data/mock";
import Card from "../ui/Card";

export default function MarketingActivitySection() {
  return (
    <Card title="Kegiatan Marketing" action="Lihat Semua" className="h-full">
      <div className="flex flex-col gap-2">
        {MARKETING.map((m, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="rounded-full" style={{ width: 8, height: 8, background: m.color }} />
              <span className="text-sm text-slate-600">{m.name}</span>
            </div>
            <span className="text-xs text-slate-400">{m.time}</span>
          </div>
        ))}
        <a className="text-center text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer mt-1">+ 10 kegiatan lainnya</a>
      </div>
    </Card>
  );
}
