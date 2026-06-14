import { useState, useEffect, useCallback } from "react";
import ReactFlow, {
  useNodesState, useEdgesState, addEdge,
  Controls, MiniMap, Background, BackgroundVariant, Panel,
  Handle, Position, MarkerType, ConnectionMode, ConnectionLineType,
  type NodeProps, type Edge, type Node, type Connection,
} from "reactflow";
import "reactflow/dist/style.css";
import { Plus, Trash2, FileSpreadsheet, Printer, X, AlignLeft, AlignCenter, AlignRight, Loader2 } from "lucide-react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { CustomEdge } from "../components/CustomEdge";
import {
  fetchOrgNodes, createOrgNode, updateOrgNode, deleteOrgNode,
  fetchOrgEdges, createOrgEdge, updateOrgEdge, deleteOrgEdge,
  type OrgNodeRecord,
} from "../services/api";

type Role = "Super Admin" | "Direksi" | "HR" | "Manager" | "Finance" | "NOC" | "Karyawan";

interface OrgBoxData {
  title: string; employee_name: string; department: string;
  color: string; text_color: string; title_color: string; name_color: string;
  text_align: string; notes: string; dbId: number;
}

const COLOR_TEMPLATES = [
  { label: "Direksi",    bg: "#ffffff", text: "#1e293b" },
  { label: "Head",       bg: "#4ade80", text: "#14532d" },
  { label: "Manager",    bg: "#86efac", text: "#166534" },
  { label: "SPV",        bg: "#fbbf24", text: "#7c2d12" },
  { label: "Staff",      bg: "#d1fae5", text: "#065f46" },
  { label: "Tim Khusus", bg: "#64748b", text: "#f1f5f9" },
  { label: "IT/Cloud",   bg: "#93c5fd", text: "#1e3a8a" },
  { label: "Project",    bg: "#e2e8f0", text: "#334155" },
];

const DIVISI_LABELS: Record<string, string> = {
  itvpn: "Divisi IT VPN", finance: "Divisi Finance",
  marketing: "Marketing",  hrdga: "HRD & GA", overview: "Perusahaan",
};

// ─── Custom Node ──────────────────────────────────────────────────────────────
// Handles hanya muncul saat hover (via CSS di bawah), bukan selalu terlihat
const HANDLE_STYLE: React.CSSProperties = {
  background: "#22c55e", border: "2px solid #fff",
  width: 11, height: 11, zIndex: 10,
};

// CSS global agar handle muncul hanya saat node di-hover / selected
const HANDLE_CSS = `
  .react-flow__node .react-flow__handle { opacity: 0; transition: opacity .15s; }
  .react-flow__node:hover .react-flow__handle,
  .react-flow__node.selected .react-flow__handle { opacity: 1; }
`;

function OrgBoxNode({ data, selected }: NodeProps<OrgBoxData>) {
  const people  = (data.employee_name || "").split("\n").filter(Boolean);
  const align   = (data.text_align || "center") as "left" | "center" | "right";
  const titleCl = data.title_color || data.text_color;
  const nameCl  = data.name_color  || data.text_color;

  return (
    <div style={{
      background: data.color, borderRadius: 8, minWidth: 160,
      border: selected ? "2.5px solid #0ea5e9" : "1.5px solid rgba(0,0,0,.14)",
      boxShadow: selected
        ? "0 0 0 3px rgba(14,165,233,.18), 0 4px 14px rgba(0,0,0,.12)"
        : "0 2px 8px rgba(0,0,0,.10)",
      overflow: "hidden", userSelect: "none",
    }}>
      {/* 4 handles — atas/bawah/kiri/kanan, muncul saat hover */}
      <Handle type="source" position={Position.Top}    style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Left}   style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right}  style={HANDLE_STYLE} />

      {/* ── Jabatan (header) ── */}
      <div style={{
        padding: "8px 12px",
        textAlign: align, color: titleCl,
        fontWeight: 700, fontSize: 11,
        textTransform: "uppercase", letterSpacing: ".55px",
        borderBottom: (people.length > 0 || data.department)
          ? `1.5px solid ${titleCl}40` : "none",
      }}>
        {data.title || "—"}
      </div>

      {/* ── Divisi / dept kecil (opsional) ── */}
      {data.department && (
        <div style={{
          padding: "3px 12px 0", textAlign: align,
          color: titleCl, opacity: .65, fontSize: 10, fontStyle: "italic",
          borderBottom: people.length > 0 ? `1px solid ${titleCl}20` : "none",
          paddingBottom: people.length > 0 ? 3 : 0,
        }}>
          {data.department}
        </div>
      )}

      {/* ── Daftar nama (multi-orang) ── */}
      {people.length > 0 && (
        <div style={{ padding: "5px 12px 8px" }}>
          {people.map((p, i) => (
            <div key={i} style={{
              textAlign: align, color: nameCl,
              fontSize: 11, fontWeight: 500, lineHeight: 1.55,
            }}>
              {people.length > 1 ? `- ${p}` : p}
            </div>
          ))}
        </div>
      )}

      {/* ── Notes (jika tidak ada nama) ── */}
      {data.notes && people.length === 0 && (
        <div style={{
          padding: "4px 12px 8px", textAlign: align,
          color: nameCl, opacity: .55, fontSize: 10, fontStyle: "italic",
        }}>
          {data.notes}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { orgBox: OrgBoxNode };
const edgeTypes = { custom: CustomEdge };

// ─── Edit Modal ───────────────────────────────────────────────────────────────
interface EditForm {
  title: string; employee_name: string; department: string; notes: string;
  color: string; text_color: string; title_color: string; name_color: string;
  text_align: string;
}

function EditModal({ node, onClose, onSave, onDelete, canEdit }: {
  node: Node<OrgBoxData>; onClose: () => void; canEdit: boolean;
  onSave: (id: string, d: Partial<OrgBoxData>) => void;
  onDelete: (id: string) => void;
}) {
  const [f, setF] = useState<EditForm>({
    title: node.data.title, employee_name: node.data.employee_name,
    department: node.data.department, notes: node.data.notes,
    color: node.data.color, text_color: node.data.text_color,
    title_color: node.data.title_color, name_color: node.data.name_color,
    text_align: node.data.text_align || "center",
  });
  const upd = (k: keyof EditForm, v: string) => setF(p => ({ ...p, [k]: v }));
  const people = f.employee_name.split("\n").filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[340px] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 z-10">
          <div className="font-bold text-slate-800 text-sm">Edit Node</div>
          <button onClick={onClose}><X size={17} className="text-slate-400" /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {/* Jabatan */}
          <div>
            <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Jabatan / Judul</label>
            <input value={f.title} onChange={e => upd("title", e.target.value)} disabled={!canEdit}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-sky-300 disabled:bg-slate-50" />
          </div>

          {/* Dept */}
          <div>
            <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Sub-judul / Dept (opsional)</label>
            <input value={f.department} onChange={e => upd("department", e.target.value)} disabled={!canEdit}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-sky-300 disabled:bg-slate-50" />
          </div>

          {/* Multi-nama */}
          <div>
            <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">
              Nama Pegawai <span className="text-slate-400 font-normal normal-case">(satu nama per baris)</span>
            </label>
            <textarea value={f.employee_name} onChange={e => upd("employee_name", e.target.value)}
              disabled={!canEdit} rows={4} placeholder={"Nama Pegawai 1\nNama Pegawai 2\n..."}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-300 resize-y disabled:bg-slate-50 font-mono" />
            {people.length > 0 && (
              <div className="text-[10px] text-slate-400 mt-0.5">{people.length} orang terdaftar</div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Keterangan</label>
            <input value={f.notes} onChange={e => upd("notes", e.target.value)} disabled={!canEdit}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-sky-300 disabled:bg-slate-50" />
          </div>

          {canEdit && (
            <>
              {/* Alignment */}
              <div>
                <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Posisi Teks</label>
                <div className="mt-1 flex gap-1">
                  {([["left","Kiri"],["center","Tengah"],["right","Kanan"]] as const).map(([v, label]) => (
                    <button key={v} onClick={() => upd("text_align", v)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs transition-colors"
                      style={f.text_align === v
                        ? { background: "#0ea5e9", color: "#fff", borderColor: "#0ea5e9" }
                        : { background: "#fff", color: "#64748b", borderColor: "#e2e8f0" }}>
                      {v === "left" ? <AlignLeft size={13}/> : v === "center" ? <AlignCenter size={13}/> : <AlignRight size={13}/>}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color template */}
              <div>
                <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Template Warna</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {COLOR_TEMPLATES.map(ct => (
                    <button key={ct.label} title={ct.label}
                      onClick={() => setF(p => ({ ...p, color: ct.bg, text_color: ct.text, title_color: "", name_color: "" }))}
                      className="px-2 py-1 rounded-md border text-[10px] font-semibold transition-all"
                      style={{
                        background: ct.bg, color: ct.text,
                        border: f.color === ct.bg ? "2px solid #0ea5e9" : "1.5px solid rgba(0,0,0,.12)",
                      }}>
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color pickers */}
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["color",       "BG Kotak"],
                  ["text_color",  "Teks Default"],
                  ["title_color", "Warna Jabatan"],
                  ["name_color",  "Warna Nama"],
                ] as const).map(([k, lbl]) => (
                  <div key={k}>
                    <label className="text-[10px] text-slate-400">{lbl}</label>
                    <input type="color" value={f[k] || f.text_color || "#1e293b"}
                      onChange={e => upd(k, e.target.value)}
                      className="mt-0.5 w-full h-8 rounded-lg border border-slate-200 cursor-pointer" />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Preview */}
          <div>
            <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Preview</label>
            <div className="mt-1 rounded-xl overflow-hidden border border-slate-100 shadow-sm"
              style={{ background: f.color }}>
              <div style={{
                padding: "8px 12px", textAlign: f.text_align as "left"|"center"|"right",
                color: f.title_color || f.text_color,
                fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px",
                borderBottom: f.employee_name ? `1.5px solid ${(f.title_color || f.text_color)}40` : "none",
              }}>
                {f.title || "Jabatan"}
              </div>
              {f.employee_name && (
                <div style={{ padding: "5px 12px 8px" }}>
                  {f.employee_name.split("\n").filter(Boolean).map((p, i, arr) => (
                    <div key={i} style={{
                      textAlign: f.text_align as "left"|"center"|"right",
                      color: f.name_color || f.text_color,
                      fontSize: 11, fontWeight: 500, lineHeight: 1.55,
                    }}>
                      {arr.length > 1 ? `- ${p}` : p}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            {canEdit ? (
              <>
                <button onClick={() => onSave(node.id, f)}
                  className="flex-1 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium">
                  Simpan
                </button>
                <button onClick={() => { if (confirm("Hapus node ini?")) onDelete(node.id); }}
                  className="py-2 px-3 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </>
            ) : (
              <button onClick={onClose}
                className="flex-1 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg">Tutup</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function toFlowNode(n: OrgNodeRecord): Node<OrgBoxData> {
  return {
    id: String(n.id), type: "orgBox",
    position: { x: n.x, y: n.y },
    style: { width: n.width },
    data: {
      title: n.title, employee_name: n.employee_name,
      department: n.department, color: n.color, text_color: n.text_color,
      title_color: n.title_color || "", name_color: n.name_color || "",
      text_align: n.text_align || "center", notes: n.notes, dbId: n.id,
    },
  };
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OrgDesignerPage({ divisi, role }: { divisi: string; role: Role }) {
  const canEdit = role === "Super Admin";
  const [nodes, setNodes, onNodesChange] = useNodesState<OrgBoxData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [editNode, setEditNode] = useState<Node<OrgBoxData> | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<{ edge: Edge; x: number; y: number } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [ns, es] = await Promise.all([fetchOrgNodes(divisi), fetchOrgEdges(divisi)]);
      setNodes(ns.map(toFlowNode));
      setEdges(es.map(e => ({
        id: `e${e.id}`, source: e.source_id, target: e.target_id,
        type: "custom",
        markerEnd: e.arrow_end === "arrow"
          ? { type: MarkerType.ArrowClosed, color: "#475569", width: 16, height: 16 } : undefined,
        data: {
          dbId: e.id, line_type: e.line_type, arrow_end: e.arrow_end,
          edge_type: e.edge_type || "reporting", routing_type: e.routing_type || "smoothstep",
        },
      })));
    } catch(e) { console.error(e); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [divisi]);

  const onNodeDragStop = useCallback(async (_: unknown, node: Node<OrgBoxData>) => {
    await updateOrgNode(node.data.dbId, { x: node.position.x, y: node.position.y }).catch(()=>{});
  }, []);

  const onConnect = useCallback(async (params: Connection) => {
    if (!params.source || !params.target || params.source === params.target) return;
    try {
      const e = await createOrgEdge({ division_key: divisi, source_id: params.source, target_id: params.target });
      setEdges(eds => addEdge({
        ...params, id: `e${e.id}`, type: "custom",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#475569", width: 16, height: 16 },
        data: { dbId: e.id, line_type: "solid", arrow_end: "arrow", edge_type: "reporting", routing_type: "smoothstep" },
      }, eds));
    } catch(err) { console.error(err); }
  }, [divisi, setEdges]);

  const onNodesDelete = useCallback(async (deleted: Node<OrgBoxData>[]) => {
    for (const n of deleted) await deleteOrgNode(n.data.dbId).catch(()=>{});
  }, []);

  const onEdgesDelete = useCallback(async (deleted: Edge[]) => {
    for (const e of deleted) if (e.data?.dbId) await deleteOrgEdge(e.data.dbId).catch(()=>{});
  }, []);

  const onNodeDoubleClick = useCallback((_: unknown, node: Node<OrgBoxData>) => {
    setEditNode(node);
  }, []);

  // Klik garis → tampilkan menu
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    if (!canEdit) return;
    event.stopPropagation();
    setEdgeMenu({ edge, x: event.clientX, y: event.clientY });
  }, [canEdit]);

  // Toggle solid ↔ dashed
  async function toggleEdgeDash(edge: Edge) {
    const newType = edge.data?.line_type === "dashed" ? "solid" : "dashed";
    await updateOrgEdge(edge.data!.dbId, { line_type: newType }).catch(() => {});
    setEdges(es => es.map(e => e.id !== edge.id ? e : {
      ...e, data: { ...e.data, line_type: newType },
    }));
    setEdgeMenu(null);
  }

  // Change edge type (reporting/reference/connection)
  async function changeEdgeType(edge: Edge, newEdgeType: string) {
    await updateOrgEdge(edge.data!.dbId, { edge_type: newEdgeType }).catch(() => {});
    const arrow = newEdgeType === "reference" ? "none" : "arrow";
    setEdges(es => es.map(e => e.id !== edge.id ? e : {
      ...e,
      markerEnd: arrow === "arrow"
        ? { type: MarkerType.ArrowClosed, color: "#475569", width: 16, height: 16 } : undefined,
      data: { ...e.data, edge_type: newEdgeType, arrow_end: arrow },
    }));
    setEdgeMenu(null);
  }

  // Hapus garis dari menu
  async function deleteEdgeFromMenu(edge: Edge) {
    await deleteOrgEdge(edge.data?.dbId).catch(() => {});
    setEdges(es => es.filter(e => e.id !== edge.id));
    setEdgeMenu(null);
  }

  async function addNode() {
    setSaving(true);
    try {
      const n = await createOrgNode({
        division_key: divisi, title: "Jabatan Baru",
        x: 100 + Math.random() * 280, y: 80 + Math.random() * 180,
        color: "#ffffff", text_color: "#1e293b", text_align: "center",
        title_color: "", name_color: "", width: 200,
      });
      setNodes(ns => [...ns, toFlowNode(n)]);
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  async function saveEdit(id: string, data: Partial<OrgBoxData>) {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    await updateOrgNode(node.data.dbId, data);
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n));
    setEditNode(null);
  }

  async function deleteNodeById(id: string) {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    await deleteOrgNode(node.data.dbId);
    setNodes(ns => ns.filter(n => n.id !== id));
    setEdges(es => es.filter(e => e.source !== id && e.target !== id));
    setEditNode(null);
  }

  async function exportPDF() {
    const el = document.getElementById("org-canvas-wrap");
    if (!el) return;
    setExporting(true);
    try {
      // Sembunyikan kontrol UI sebelum capture
      const hide = el.querySelectorAll<HTMLElement>(
        ".react-flow__controls, .react-flow__minimap, .react-flow__panel"
      );
      hide.forEach(h => { h.style.visibility = "hidden"; });

      const dataUrl = await toPng(el, {
        backgroundColor: "#f8fafc",
        pixelRatio: 2,
        cacheBust: true,
      });

      hide.forEach(h => { h.style.visibility = ""; });

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
      const W = pdf.internal.pageSize.getWidth();
      const H = pdf.internal.pageSize.getHeight();

      pdf.setFontSize(12);
      pdf.setTextColor(51, 65, 85);
      pdf.text(`Struktur Organisasi — ${DIVISI_LABELS[divisi] ?? divisi}`, W / 2, 8, { align: "center" });

      pdf.addImage(dataUrl, "PNG", 0, 13, W, H - 13);
      pdf.save(`struktur-org-${divisi}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Export PDF gagal. Coba lagi.");
    }
    setExporting(false);
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const label = DIVISI_LABELS[divisi] ?? divisi;

      // Capture canvas as image
      const el = document.getElementById("org-canvas-wrap");
      if (!el) throw new Error("Canvas not found");

      const toHide = el.querySelectorAll<HTMLElement>(
        ".react-flow__controls, .react-flow__minimap, .react-flow__panel"
      );
      toHide.forEach(h => { h.style.visibility = "hidden"; });
      await new Promise(r => setTimeout(r, 100));

      const chartImage = await toPng(el, { backgroundColor: "#f8fafc", pixelRatio: 1.5, cacheBust: true });
      toHide.forEach(h => { h.style.visibility = ""; });

      // Create workbook
      const wb = new ExcelJS.Workbook();

      // Sheet 1: Visual Chart
      const wsChart = wb.addWorksheet("Visual Chart");
      wsChart.pageSetup = { paperSize: 9, orientation: "landscape" };

      const imageId = wb.addImage({
        base64: chartImage.split(",")[1],
        extension: "png",
      });
      wsChart.addImage(imageId, "B2:M20");
      wsChart.getCell("A1").value = `Struktur Organisasi — ${label}`;
      wsChart.getCell("A1").font = { bold: true, size: 14 };
      wsChart.mergeCells("A1:M1");

      // Sheet 2: Data Nodes
      const wsData = wb.addWorksheet("Data Nodes");
      wsData.columns = [
        { header: "No", width: 5 },
        { header: "Jabatan", width: 25 },
        { header: "Sub-judul/Dept", width: 20 },
        { header: "Nama Pegawai", width: 40 },
        { header: "Keterangan", width: 20 },
        { header: "Warna", width: 12 },
      ];

      nodes.forEach((n, i) => {
        wsData.addRow([
          i + 1, n.data.title, n.data.department,
          n.data.employee_name.replace(/\n/g, " | "),
          n.data.notes, n.data.color,
        ]);
      });

      wsData.getRow(1).font = { bold: true };
      wsData.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

      // Sheet 3: Garis Pelaporan
      const wsEdges = wb.addWorksheet("Garis Pelaporan");
      wsEdges.columns = [
        { header: "Dari (Jabatan)", width: 25 },
        { header: "Ke (Jabatan)", width: 25 },
        { header: "Tipe Garis", width: 14 },
      ];

      edges.forEach(e => {
        const src = nodes.find(n => n.id === e.source)?.data.title ?? e.source;
        const tgt = nodes.find(n => n.id === e.target)?.data.title ?? e.target;
        wsEdges.addRow([src, tgt, e.data?.line_type ?? "solid"]);
      });

      wsEdges.getRow(1).font = { bold: true };
      wsEdges.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

      // Save
      await wb.xlsx.writeFile(`struktur-org-${divisi}.xlsx`);
    } catch (e) {
      console.error(e);
      alert("Export Excel gagal. Coba lagi.");
    }
    setExporting(false);
  }

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
        <div className="flex items-center gap-2">
          {canEdit && (
            <button onClick={addNode} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60">
              <Plus size={15}/> Tambah Node
            </button>
          )}
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            <FileSpreadsheet size={15}/> Excel
          </button>
          <button onClick={exportPDF} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60">
            {exporting ? <Loader2 size={15} className="animate-spin"/> : <Printer size={15}/>}
            {exporting ? "Mengekspor…" : "PDF"}
          </button>
        </div>
      </div>

      {canEdit && (
        <div className="text-[11px] text-slate-400 shrink-0 -mt-1 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
          <b>Tips:</b> Drag kotak untuk pindah (snap ke grid 20px) • Hover kotak → 4 titik <span className="text-green-600 font-bold">●</span> hijau → drag ke kotak lain untuk buat garis • Double-click untuk edit isi • Pilih lalu <kbd className="bg-white border border-slate-200 px-1 rounded text-[10px]">Delete</kbd> untuk hapus
        </div>
      )}

      {/* Canvas */}
      <style>{HANDLE_CSS}</style>
      <div id="org-canvas-wrap" className="flex-1 rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-slate-50/40 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">Memuat bagan…</div>
        ) : (
          <ReactFlow nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={canEdit ? onConnect : undefined}
            onNodeDragStop={canEdit ? onNodeDragStop : undefined}
            onNodesDelete={canEdit ? onNodesDelete : undefined}
            onEdgesDelete={canEdit ? onEdgesDelete : undefined}
            onEdgeClick={canEdit ? onEdgeClick : undefined}
            onNodeDoubleClick={onNodeDoubleClick}
            onPaneClick={() => setEdgeMenu(null)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={canEdit} nodesConnectable={canEdit}
            deleteKeyCode={canEdit ? "Delete" : null}
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{ stroke: "#475569", strokeWidth: 1.8 }}
            snapToGrid={canEdit} snapGrid={[20, 20]}
            defaultEdgeOptions={{ type: "smoothstep" }}
            fitView fitViewOptions={{ padding: 0.3 }}>
            <Controls showInteractive={false}/>
            <MiniMap nodeColor={n => n.data?.color ?? "#e2e8f0"} maskColor="rgba(241,245,249,.7)"/>
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#e2e8f0"/>
            {!canEdit && (
              <Panel position="top-right">
                <div className="bg-slate-100 border border-slate-200 text-slate-500 text-xs px-2 py-1 rounded-lg">View only</div>
              </Panel>
            )}
            {nodes.length === 0 && canEdit && (
              <Panel position="top-center">
                <div className="bg-white border border-dashed border-slate-300 text-slate-400 text-sm px-4 py-3 rounded-xl mt-20">
                  Canvas kosong — klik <b>Tambah Node</b> untuk mulai
                </div>
              </Panel>
            )}
          </ReactFlow>
        )}
      </div>

      {editNode && (
        <EditModal node={editNode} onClose={() => setEditNode(null)}
          onSave={saveEdit} onDelete={deleteNodeById} canEdit={canEdit}/>
      )}

      {/* Menu klik garis */}
      {edgeMenu && (
        <div
          className="fixed z-[70] bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 min-w-[160px]"
          style={{ left: edgeMenu.x + 8, top: edgeMenu.y + 8 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wide border-b border-slate-100 mb-1">
            Garis
          </div>
          <div className="text-[10px] text-slate-500 px-3 py-1 font-semibold">Jenis</div>
          {(["reporting", "reference", "connection"] as const).map(t => (
            <button
              key={t}
              onClick={() => changeEdgeType(edgeMenu.edge, t)}
              className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${
                edgeMenu.edge.data?.edge_type === t
                  ? "bg-sky-100 text-sky-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={`w-4 h-0.5 ${
                t === "reporting" ? "bg-red-500" : t === "reference" ? "bg-gray-400" : "bg-cyan-500"
              }`} />
              {t === "reporting" ? "Pelaporan (↓)" : t === "reference" ? "Referensi" : "Koneksi"}
            </button>
          ))}
          <div className="border-t border-slate-100 my-1" />
          <button
            onClick={() => toggleEdgeDash(edgeMenu.edge)}
            className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <span className="text-base leading-none">
              {edgeMenu.edge.data?.line_type === "dashed" ? "— " : "- -"}
            </span>
            {edgeMenu.edge.data?.line_type === "dashed" ? "Ubah ke Solid" : "Ubah ke Dashed"}
          </button>
          <button
            onClick={() => deleteEdgeFromMenu(edgeMenu.edge)}
            className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
          >
            <Trash2 size={13}/> Hapus Garis
          </button>
          <button
            onClick={() => setEdgeMenu(null)}
            className="w-full text-left px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-50 border-t border-slate-100 mt-1"
          >
            Batal
          </button>
        </div>
      )}
      {edgeMenu && <div className="fixed inset-0 z-[60]" onClick={() => setEdgeMenu(null)} />}
    </div>
  );
}
