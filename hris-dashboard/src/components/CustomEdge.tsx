import { EdgeProps, getSmoothStepPath, BaseEdge } from "reactflow";

export interface CustomEdgeData {
  dbId?: number;
  line_type?: string; // solid | dashed
  arrow_end?: string; // arrow | none
  edge_type?: string; // reporting | reference | connection
  routing_type?: string; // smoothstep | straight
}

export function CustomEdge({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data = {} as CustomEdgeData,
  markerEnd,
}: EdgeProps<CustomEdgeData>) {
  const edgeType = data.edge_type || "reporting";
  const lineType = data.line_type || "solid";

  const [path] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    borderRadius: 8,
  });

  // Style based on edge type — sesuai referensi VPN chart
  let stroke = "#1F4E78";
  let strokeWidth = 2;
  let opacity = 1;

  if (edgeType === "reporting") {
    stroke = "#1F4E78";      // Navy — garis komando/perintah
    strokeWidth = 2;
  } else if (edgeType === "reference") {
    stroke = "#888888";      // Gray — garis koordinasi/dotted-line (tanpa panah)
    strokeWidth = 1.8;
    opacity = 0.85;
  } else if (edgeType === "connection") {
    stroke = "#0ea5e9";      // Biru — koneksi lintas divisi
    strokeWidth = 1.8;
  }

  return (
    <BaseEdge
      path={path}
      markerEnd={edgeType === "reference" ? undefined : markerEnd}
      style={{
        stroke,
        strokeWidth,
        opacity,
        strokeDasharray: lineType === "dashed" ? "6,4" : undefined,
        transition: "all 0.2s",
      }}
    />
  );
}
