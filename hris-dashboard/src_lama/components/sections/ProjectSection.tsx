import { ClipboardCheck } from "lucide-react";
import { PROJECTS } from "../../data/mock";
import Card from "../ui/Card";

export default function ProjectSection() {
  return (
    <Card title="Project Record" action="Lihat Semua" className="h-full">
      <div className="flex flex-col gap-4">
        {PROJECTS.map((p, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex items-center justify-center rounded-xl shrink-0 mt-0.5" style={{ width: 40, height: 40, background: "#f1f5f9" }}>
              <ClipboardCheck size={18} color={p.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-700 truncate">{p.name}</span>
                <span className="text-sm font-bold text-slate-800 shrink-0">{p.progress}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden my-2">
                <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: p.color }} />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className={p.status === "Selesai" ? "text-green-600 font-medium" : ""}>{p.status}</span>
                <span>{p.status === "Selesai" ? "Selesai" : "Deadline"}: {p.deadline}</span>
              </div>
            </div>
          </div>
        ))}
        <a className="text-center text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer mt-1">+ 8 project lainnya</a>
      </div>
    </Card>
  );
}
