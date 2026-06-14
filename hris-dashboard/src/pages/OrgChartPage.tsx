import { useState } from "react";
import { Users, ChevronDown, ChevronRight } from "lucide-react";

type Role = "Super Admin" | "Direksi" | "HR" | "Manager" | "Finance" | "NOC" | "Karyawan";

interface OrgNode {
  id: string;
  nama: string;
  jabatan: string;
  nik?: string;
  children?: OrgNode[];
}

// ─── Data per divisi ───────────────────────────────────────────────────────────
const ORG_IT_VPN: OrgNode = {
  id: "1", nama: "Pak Bonard", jabatan: "Direktur Utama", nik: "340290934",
  children: [
    {
      id: "2", nama: "Efri Utoro", jabatan: "SPV Produksi VPN", nik: "SMS-005",
      children: [
        { id: "3", nama: "IhsanYullianta", jabatan: "SPV NOC", nik: "EMP-004",
          children: [
            { id: "4", nama: "Pak Be", jabatan: "SPV VPN Modem", nik: "EMP-001" },
          ]
        },
      ]
    },
  ]
};

const ORG_FINANCE: OrgNode = {
  id: "1", nama: "Pak Bonard", jabatan: "Direktur Utama", nik: "340290934",
  children: [
    {
      id: "2", nama: "Vinny V", jabatan: "Manager Finance", nik: "EMP-005",
      children: [
        { id: "3", nama: "-", jabatan: "Staff Keuangan" },
        { id: "4", nama: "-", jabatan: "Staff Akuntansi" },
      ]
    },
  ]
};

const ORG_MARKETING: OrgNode = {
  id: "1", nama: "Pak Bonard", jabatan: "Direktur Utama", nik: "340290934",
  children: [
    {
      id: "2", nama: "-", jabatan: "Manager Marketing",
      children: [
        { id: "3", nama: "-", jabatan: "Staff Marketing" },
        { id: "4", nama: "-", jabatan: "Content Creator" },
      ]
    },
  ]
};

const ORG_HRD: OrgNode = {
  id: "1", nama: "Pak Bonard", jabatan: "Direktur Utama", nik: "340290934",
  children: [
    {
      id: "2", nama: "Anggi Kurnianto", jabatan: "Manager HRD", nik: "SMS-001",
      children: [
        { id: "3", nama: "Desy", jabatan: "HR Staff", nik: "SMS-002" },
        { id: "4", nama: "-", jabatan: "Staff GA" },
      ]
    },
  ]
};

const DIVISI = [
  { key: "itvpn",   label: "Divisi IT VPN",  data: ORG_IT_VPN,   color: "#0ea5e9" },
  { key: "finance", label: "Divisi Finance",  data: ORG_FINANCE,  color: "#10b981" },
  { key: "marketing", label: "Marketing",     data: ORG_MARKETING, color: "#f59e0b" },
  { key: "hrdga",   label: "HRD & GA",       data: ORG_HRD,      color: "#8b5cf6" },
];

// ─── Komponen Node ──────────────────────────────────────────────────────────
function OrgCard({ node, color, depth = 0 }: { node: OrgNode; color: string; depth?: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isRoot = depth === 0;

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div
        className="relative rounded-xl border shadow-sm px-4 py-3 text-center cursor-default select-none"
        style={{
          minWidth: isRoot ? 180 : 160,
          borderColor: isRoot ? color : "#e2e8f0",
          background: isRoot ? color : "#fff",
          color: isRoot ? "#fff" : "#1e293b",
        }}
      >
        {/* avatar inisial */}
        <div className="mx-auto mb-1.5 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            width: 32, height: 32,
            background: isRoot ? "rgba(255,255,255,0.25)" : color + "22",
            color: isRoot ? "#fff" : color,
          }}>
          {node.nama === "-" ? "?" : node.nama.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div className={`font-semibold text-sm leading-tight ${isRoot ? "text-white" : "text-slate-800"}`}>
          {node.nama}
        </div>
        <div className={`text-xs mt-0.5 ${isRoot ? "text-white/80" : "text-slate-500"}`}>
          {node.jabatan}
        </div>
        {node.nik && (
          <div className={`text-[10px] mt-0.5 ${isRoot ? "text-white/60" : "text-slate-400"}`}>
            {node.nik}
          </div>
        )}

        {/* toggle expand */}
        {hasChildren && (
          <button
            onClick={() => setOpen(o => !o)}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-slate-200 bg-white shadow-sm p-0.5 z-10"
          >
            {open
              ? <ChevronDown size={12} style={{ color }} />
              : <ChevronRight size={12} style={{ color }} />}
          </button>
        )}
      </div>

      {/* garis + children */}
      {hasChildren && open && (
        <div className="flex flex-col items-center mt-3">
          {/* garis vertikal ke bawah */}
          <div className="w-px bg-slate-200" style={{ height: 20 }} />
          {/* garis horizontal */}
          {node.children!.length > 1 && (
            <div className="relative flex items-start" style={{ width: "100%" }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-200"
                style={{
                  height: 1,
                  width: `${(node.children!.length - 1) * 100}%`,
                  left: `${100 / node.children!.length / 2}%`,
                }} />
            </div>
          )}
          {/* children row */}
          <div className="flex items-start gap-6 mt-0">
            {node.children!.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px bg-slate-200" style={{ height: 20 }} />
                <OrgCard node={child} color={color} depth={depth + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page utama ─────────────────────────────────────────────────────────────
export default function OrgChartPage({ divisi, role: _role }: { divisi: string; role?: Role }) {
  const d = DIVISI.find(x => x.key === divisi) ?? DIVISI[0];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Struktur Organisasi</h1>
          <p className="text-sm text-slate-400">{d.label}</p>
        </div>
      </div>

      {/* Tab divisi */}
      <div className="flex gap-2 flex-wrap">
        {DIVISI.map(item => (
          <a
            key={item.key}
            href={`#${item.key}`}
            onClick={e => { e.preventDefault(); window.history.replaceState(null, "", `#${item.key}`); }}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
            style={
              item.key === d.key
                ? { background: d.color, color: "#fff", borderColor: d.color }
                : { background: "#fff", color: "#64748b", borderColor: "#e2e8f0" }
            }
          >
            {item.label}
          </a>
        ))}
      </div>

      {/* Bagan */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-x-auto">
        <div className="flex justify-center min-w-max">
          <OrgCard node={d.data} color={d.color} depth={0} />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Users size={13} />
        <span>Klik tanda panah pada node untuk expand/collapse. Data posisi bisa diperbarui sesuai data karyawan aktual.</span>
      </div>
    </div>
  );
}
