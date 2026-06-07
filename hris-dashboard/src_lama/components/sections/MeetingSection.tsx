import { CalendarDays } from "lucide-react";
import { MEETINGS } from "../../data/mock";
import Card from "../ui/Card";

export default function MeetingSection() {
  return (
    <Card title="Meeting (MoM)" action="Lihat Semua" className="h-full">
      <div className="flex flex-col gap-3">
        {MEETINGS.map((m, i) => (
          <div key={i} className="flex items-center gap-3 border border-slate-100 rounded-xl p-3">
            <div className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 38, height: 38, background: "#ede9fe" }}>
              <CalendarDays size={17} color="#7c3aed" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-700 truncate">{m.name}</div>
              <div className="text-xs text-slate-400">{m.subtitle}</div>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
              <CalendarDays size={12} />{m.date}
            </div>
          </div>
        ))}
        <a className="text-center text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer mt-1">+ 12 meeting lainnya</a>
      </div>
    </Card>
  );
}
