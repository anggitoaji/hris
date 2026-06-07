import type { ReactNode } from "react";

interface Props {
  title?: string;
  action?: string;
  children: ReactNode;
  className?: string;
}

export default function Card({ title, action, children, className = "" }: Props) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 ${className}`}>
      {title && (
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-[15px] font-semibold text-slate-800">{title}</h3>
          {action && (
            <a className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer">
              {action}
            </a>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
