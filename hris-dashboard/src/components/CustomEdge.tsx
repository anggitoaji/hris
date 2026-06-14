import { EdgeProps, getBezierPath, MarkerType, BaseEdge } from "reactflow";

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

  // Determine path (smoothstep by default)
  const [path] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  // Style based on edge type
  let stroke = "#475569";
  let strokeWidth = 1.8;
  let opacity = 1;

  if (edgeType === "reporting") {
    stroke = "#e11d48"; // Red untuk reporting (ada panah)
    strokeWidth = 2.2;
  } else if (edgeType === "reference") {
    stroke = "#94a3b8"; // Gray untuk reference (tanpa panah)
    strokeWidth = 1.5;
    opacity = 0.7;
  } else if (edgeType === "connection") {
    stroke = "#06b6d4"; // Cyan untuk connection
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
