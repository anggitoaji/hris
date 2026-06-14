import { useState, useEffect, useCallback } from "react";
import ReactFlow, {
  useNodesState, useEdgesState, addEdge,
  Controls, MiniMap, Background, BackgroundVariant, Panel,
  Handle, Position, MarkerType,
  type NodeProps, type Edge, type Node, type Connection,
} from "reactflow";
import "reactflow/dist/style.css";
import { Plus, Trash2, FileSpreadsheet, Printer, X, ZoomIn, ZoomOut } from "lucide-react";
import {
  fetchOrgNodes, createOrgNode, updateOrgNode, deleteOrgNode,
  fetchOrgEdges, createOrgEdge, deleteOrgEdge,
  type OrgNodeRecord,
} from "../services/api";

type Role = "Super Admin" | "Direksi" | "HR" | "Manager" | "Finance" | "NOC" | "Karyawan";

// ─── Types ───────────────────────────────────────────────────────────────────
interface OrgBoxData {
  title: string; employee_name: string; department: string;
  color: string; text_color: string; notes: string; dbId: number;
}

// ─── Color templates (sesuai warna di Excel perusahaan) ──────────────────────
const COLOR_TEMPLATES = [
  { label: "Direksi",     bg: "#ffffff", text: "#1e293b" },
  { label: "Head",        bg: "#4ade80", text: "#14532d" },
  { label: "Manager",     bg: "#86efac", text: "#166534" },
  { label: "SPV",         bg: "#fbbf24", text: "#7c2d12" },
  { label: "Staff",       bg: "#d1fae5", text: "#065f46" },
  { label: "Tim Khusus",  bg: "#64748b", text: "#f1f5f9" },
  { label: "IT / Cloud",  bg: "#93c5fd", text: "#1e3a8a" },
  { label: "Project",     bg: "#e2e8f0", text: "#334155" },
];

const DIVISI_LABELS: Record<string, string> = {
  itvpn:    "Divisi IT VPN",
  finance:  "Divisi Finance",
  marketing: "Marketing",
  hrdga:    "HRD & GA",
  overview: "Perusahaan (Overview)",
};

// ─── Custom Node ──────────────────────────────────────────────────────────────
function OrgBoxNode({ data, selected }: NodeProps<OrgBoxData>) {
  return (
    <div style={{
      background: data.color, color: data.text_color,
      borderRadius: 8, padding: "10px 14px", minWidth: 160,
      boxShadow: selected ? "0 0 0 2.5px #0ea5e9, 0 4px 12px rgba(0,0,0,.15)"
                          : "0 2px 8px rgba(0,0,0,.12)",
      border: "1.5px solid rgba(0,0,0,.09)",
      userSelect: "none", fontSize: 12,
    }}>
      <Handle type="target" position={Position.Top}
        style={{ background: "#94a3b8", width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} id="left"
        style={{ background: "#94a3b8", width: 8, height: 8 }} />
      <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".6px" }}>
        {data.title || "—"}
      </div>
      {data.employee_name && (
        <div style={{ fontWeight: 600, marginTop: 3 }}>{data.employee_name}</div>
      )}
      {data.department && (
        <div style={{ opacity: .65, fontSize: 10, marginTop: 2 }}>{data.department}</div>
      )}
      {data.notes && (
        <div style={{ opacity: .5, fontSize: 10, marginTop: 3, fontStyle: "italic",
          borderTop: "1px solid rgba(0,0,0,.08)", paddingTop: 3 }}>{data.notes}</div>
      )}
      <Handle type="source" position={Position.Bottom}
        style={{ background: "#94a3b8", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="right"
        style={{ background: "#94a3b8", width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = { orgBox: OrgBoxNode };

// ─── Edit Modal ───────────────────────────────────────────────────────────────
interface EditForm {
  title: string; employee_name: string; department: string;
  color: string; text_color: string; notes: string;
}
interface EditModalProps {
  node: Node<OrgBoxData>; onClose: () => void;
  onSave: (id: string, d: Partial<OrgBoxData>) => void;
  onDelete: (id: string) => void; canEdit: boolean;
}

function EditModal({ node, onClose, onSave, onDelete, canEdit }: EditModalProps) {
  const [f, setF] = useState<EditForm>({
    title: node.data.title, employee_name: node.data.employee_name,
    department: node.data.department, color: node.data.color,
    text_color: node.data.text_color, notes: node.data.notes,
  });
  const upd = (k: keyof EditForm, v: string) => setF(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-5 w-80 flex flex-col gap-3"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-bold text-slate-800">Edit Node</div>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>

        {["title","employee_name","department","notes"].map(k => (
          <div key={k}>
            <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">
              {k === "title" ? "Jabatan" : k === "employee_name" ? "Nama Pegawai"
                : k === "department" ? "Divisi / Dept" : "Keterangan"}
            </label>
            <input value={f[k as keyof EditForm]}
              onChange={e => upd(k as keyof EditForm, e.target.value)}
              disabled={!canEdit}
              className="mt-0.5 w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-sky-300 disabled:bg-slate-50 disabled:text-slate-400" />
          </div>
        ))}

        {/* Color template picker */}
        {canEdit && (
          <div>
            <label className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Warna</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {COLOR_TEMPLATES.map(ct => (
                <button key={ct.label} title={ct.label}
                  onClick={() => setF(p => ({ ...p, color: ct.bg, text_color: ct.text }))}
                  className="flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium"
                  style={{
                    background: ct.bg, color: ct.text,
                    border: f.color === ct.bg ? "2px solid #0ea5e9" : "1.5px solid rgba(0,0,0,.12)",
                  }}>
                  {ct.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <div className="flex-1">
                <label className="text-[10px] text-slate-400">BG color</label>
                <input type="color" value={f.color} onChange={e => upd("color", e.target.value)}
                  className="w-full h-7 rounded border border-slate-200 cursor-pointer" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-slate-400">Text color</label>
                <input type="color" value={f.text_color} onChange={e => upd("text_color", e.target.value)}
                  className="w-full h-7 rounded border border-slate-200 cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="rounded-xl p-3 text-center text-sm" style={{ background: f.color, color: f.text_color, border: "1.5px solid rgba(0,0,0,.08)" }}>
          <div className="font-bold text-[11px] uppercase tracking-wide">{f.title || "Jabatan"}</div>
          {f.employee_name && <div className="font-medium mt-1">{f.employee_name}</div>}
          {f.department && <div className="opacity-60 text-[10px] mt-0.5">{f.department}</div>}
        </div>

        <div className="flex gap-2">
          {canEdit && (
            <>
              <button onClick={() => onSave(node.id, f)}
                className="flex-1 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700">Simpan</button>
              <button onClick={() => { if (confirm("Hapus node ini?")) onDelete(node.id); }}
                className="py-2 px-3 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                <Trash2 size={14} />
              </button>
            </>
          )}
          {!canEdit && (
            <button onClick={onClose} className="flex-1 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg">Tutup</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helper: convert backend record → React Flow node ────────────────────────
function toFlowNode(n: OrgNodeRecord): Node<OrgBoxData> {
  return {
    id: String(n.id),
    type: "orgBox",
    position: { x: n.x, y: n.y },
    style: { width: n.width },
    data: {
      title: n.title, employee_name: n.employee_name,
      department: n.department, color: n.color,
      text_color: n.text_color, notes: n.notes, dbId: n.id,
    },
  };
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OrgDesignerPage({ divisi, role }: { divisi: string; role: Role }) {
  const canEdit = role === "Super Admin";
  const [nodes, setNodes, onNodesChange] = useNodesState<OrgBoxData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading]  = useState(true);
  const [saving, setSaving]    = useState(false);
  const [editNode, setEditNode] = useState<Node<OrgBoxData> | null>(null);

  // Load data dari backend
  async function load() {
    setLoading(true);
    try {
      const [ns, es] = await Promise.all([fetchOrgNodes(divisi), fetchOrgEdges(divisi)]);
      setNodes(ns.map(toFlowNode));
      setEdges(es.map(e => ({
        id: `e${e.id}`,
        source: e.source_id, target: e.target_id,
        type: "smoothstep",
        style: e.line_type === "dashed"
          ? { strokeDasharray: "6,4", stroke: "#94a3b8", strokeWidth: 1.5 }
          : { stroke: "#94a3b8", strokeWidth: 1.5 },
        markerEnd: e.arrow_end === "arrow"
          ? { type: MarkerType.ArrowClosed, color: "#94a3b8", width: 18, height: 18 }
          : undefined,
        data: { dbId: e.id, line_type: e.line_type, arrow_end: e.arrow_end },
      })));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [divisi]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  // Simpan posisi setelah drag
  const onNodeDragStop = useCallback(async (_: unknown, node: Node<OrgBoxData>) => {
    await updateOrgNode(node.data.dbId, { x: node.position.x, y: node.position.y }).catch(() => {});
  }, []);

  // Buat koneksi baru
  const onConnect = useCallback(async (params: Connection) => {
    if (!params.source || !params.target) return;
    try {
      const e = await createOrgEdge({
        division_key: divisi, source_id: params.source, target_id: params.target,
      });
      setEdges(eds => addEdge({
        ...params, id: `e${e.id}`, type: "smoothstep",
        style: { stroke: "#94a3b8", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8", width: 18, height: 18 },
        data: { dbId: e.id, line_type: "solid", arrow_end: "arrow" },
      }, eds));
    } catch {}
  }, [divisi, setEdges]);

  // Hapus node (dari keyboard Delete)
  const onNodesDelete = useCallback(async (deleted: Node<OrgBoxData>[]) => {
    for (const n of deleted) await deleteOrgNode(n.data.dbId).catch(() => {});
  }, []);

  // Hapus edge (dari keyboard Delete)
  const onEdgesDelete = useCallback(async (deleted: Edge[]) => {
    for (const e of deleted) {
      if (e.data?.dbId) await deleteOrgEdge(e.data.dbId).catch(() => {});
    }
  }, []);

  // Double-click → buka modal edit
  const onNodeDoubleClick = useCallback((_: unknown, node: Node<OrgBoxData>) => {
    setEditNode(node);
  }, []);

  // Tambah node baru
  async function addNode() {
    setSaving(true);
    try {
      const n = await createOrgNode({
        division_key: divisi, title: "Jabatan Baru",
        x: 80 + Math.random() * 300, y: 80 + Math.random() * 200,
        color: "#ffffff", text_color: "#1e293b",
      });
      setNodes(ns => [...ns, toFlowNode(n)]);
    } catch {}
    setSaving(false);
  }

  // Simpan edit dari modal
  async function saveEdit(id: string, data: Partial<OrgBoxData>) {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    await updateOrgNode(node.data.dbId, data);
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n));
    setEditNode(null);
  }

  // Hapus node dari modal
  async function deleteNodeById(id: string) {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    await deleteOrgNode(node.data.dbId);
    setNodes(ns => ns.filter(n => n.id !== id));
    setEdges(es => es.filter(e => e.source !== id && e.target !== id));
    setEditNode(null);
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  function exportCSV() {
    const header = ["Jabatan","Nama Pegawai","Divisi/Dept","Keterangan","X","Y","Warna BG"];
    const rows = nodes.map(n => [
      n.data.title, n.data.employee_name, n.data.department,
      n.data.notes, String(Math.round(n.position.x)), String(Math.round(n.position.y)), n.data.color,
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `struktur-org-${divisi}.csv`; a.click();
  }

  function exportPDF() {
    const style = document.createElement("style");
    style.innerHTML = `@media print {
      body > * { display: none !important; }
      #org-print-area { display: block !important; position: fixed; inset: 0; z-index: 9999; }
      .react-flow__minimap, .react-flow__controls, .react-flow__panel { display: none !important; }
    }`;
    document.head.appendChild(style);
    const el = document.getElementById("org-canvas-wrap");
    if (el) el.id = "org-print-area";
    window.print();
    if (el) el.id = "org-canvas-wrap";
    document.head.removeChild(style);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 110px)" }}>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Struktur Organisasi</h1>
          <p className="text-sm text-slate-400">{DIVISI_LABELS[divisi] ?? divisi}
            {canEdit && <span className="ml-2 text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-semibold">Edit Mode</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <button onClick={addNode} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60">
              <Plus size={15} /> Tambah Node
            </button>
          )}
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button onClick={exportPDF}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            <Printer size={15} /> PDF
          </button>
        </div>
      </div>

      {/* Help text */}
      {canEdit && (
        <div className="text-[11px] text-slate-400 shrink-0 -mt-1">
          Drag kotak untuk memindahkan • Tarik dari titik hijau antar kotak untuk membuat koneksi • Double-click kotak untuk edit • Pilih lalu Delete untuk hapus
        </div>
      )}

      {/* Canvas */}
      <div id="org-canvas-wrap" className="flex-1 rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-slate-50/50 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">Memuat bagan…</div>
        ) : (
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={canEdit ? onConnect : undefined}
            onNodeDragStop={canEdit ? onNodeDragStop : undefined}
            onNodesDelete={canEdit ? onNodesDelete : undefined}
            onEdgesDelete={canEdit ? onEdgesDelete : undefined}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={nodeTypes}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            deleteKeyCode={canEdit ? "Delete" : null}
            connectionLineStyle={{ stroke: "#94a3b8", strokeWidth: 1.5 }}
            fitView fitViewOptions={{ padding: 0.25 }}
          >
            <Controls showInteractive={false} />
            <MiniMap nodeColor={n => n.data?.color ?? "#e2e8f0"} maskColor="rgba(241,245,249,0.7)" />
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#e2e8f0" />
            {!canEdit && (
              <Panel position="top-right">
                <div className="bg-slate-100 border border-slate-200 text-slate-500 text-xs px-2 py-1 rounded-lg">
                  View only
                </div>
              </Panel>
            )}
            {nodes.length === 0 && canEdit && (
              <Panel position="top-center">
                <div className="bg-white border border-dashed border-slate-300 text-slate-400 text-sm px-4 py-3 rounded-xl mt-16">
                  Canvas kosong — klik <strong>Tambah Node</strong> untuk mulai
                </div>
              </Panel>
            )}
          </ReactFlow>
        )}
      </div>

      {/* Edit Modal */}
      {editNode && (
        <EditModal node={editNode} onClose={() => setEditNode(null)}
          onSave={saveEdit} onDelete={deleteNodeById} canEdit={canEdit} />
      )}
    </div>
  );
}
