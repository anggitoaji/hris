import {
  UserPlus, FilePlus, BarChart3, Clock, CalendarPlus, FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Card from "../ui/Card";

interface QuickAction { label: string; Icon: LucideIcon; color: string; bg: string; }

// Placeholder — fitur final belum ditentukan; ganti label & ikon di sini.
const QUICK_ACTIONS: QuickAction[] = [
  { label: "XXXXXX", Icon: UserPlus,     color: "#0284c7", bg: "#e0f2fe" },
  { label: "XXXXXX", Icon: FilePlus,     color: "#7c3aed", bg: "#ede9fe" },
  { label: "XXXXXX", Icon: BarChart3,    color: "#059669", bg: "#d1fae5" },
  { label: "XXXXXX", Icon: Clock,        color: "#d97706", bg: "#fef3c7" },
  { label: "XXXXXX", Icon: CalendarPlus, color: "#db2777", bg: "#fce7f3" },
  { label: "XXXXXX", Icon: FileText,     color: "#0d9488", bg: "#ccfbf1" },
];

export default function QuickActionSection() {
  return (
    <Card title="Quick Action">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {QUICK_ACTIONS.map((q, i) => (
          <button
            key={i}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-colors"
          >
            <div className="flex items-center justify-center rounded-xl" style={{ width: 34, height: 34, background: q.bg }}>
              <q.Icon size={18} color={q.color} />
            </div>
            <span className="text-xs font-medium text-blue-600">{q.label}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
