import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { DonutItem } from "../../types";

interface Props {
  data: DonutItem[];
  total: number;
  unit: string;
  centerTop: string;
}

export default function Donut({ data, total, unit, centerTop }: Props) {
  return (
    <div className="relative mx-auto" style={{ width: 112, height: 112 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="units"
            innerRadius={36}
            outerRadius={52}
            paddingAngle={2}
            stroke="none"
            startAngle={90}
            endAngle={-270}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xs text-slate-400">{centerTop}</span>
        <span className="text-lg font-bold text-slate-800 leading-none">
          {total.toLocaleString("id-ID")}
        </span>
        <span className="text-xs text-slate-400">{unit}</span>
      </div>
    </div>
  );
}
