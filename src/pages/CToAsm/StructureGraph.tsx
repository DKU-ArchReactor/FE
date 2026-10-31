import { useId } from 'react';
export type GraphNode = { id: string; title: string; subtitle?: string; fields: { name: string; value: string; changed?: boolean }[]; line: number; changed?: boolean };
export type GraphEdge = { from: string; to: string; label: string };
type Props = { nodes: GraphNode[]; edges: GraphEdge[]; onSelectLine: (line: number) => void };
export default function StructureGraph({ nodes, edges, onSelectLine }: Props) {
  const markerId = useId().replace(/:/g, '') + '-pointer-arrow';
  const visible = nodes.slice(0, 40);
  if (!visible.length) return null;
  const rowHeight = Math.max(120, ...visible.map(node => 62 + Math.min(node.fields.length, 8) * 20));
  const width = visible.length > 1 ? 560 : 280;
  const positions = new Map<string, { x: number; y: number }>();
  const order = new Map(visible.map((node, index) => [node.id, index]));
  const remaining = new Set(visible.map(node => node.id));
  let row = 0;
  while (remaining.size) {
    const component = new Set<string>(), pending = [remaining.values().next().value!];
    while (pending.length) { const id = pending.pop()!; if (component.has(id)) continue; component.add(id); remaining.delete(id); for (const edge of edges) { const other = edge.from === id ? edge.to : edge.to === id ? edge.from : undefined; if (other && remaining.has(other)) pending.push(other); } }
    const unplaced = new Set(component);
    while (unplaced.size) {
      let layer = [...unplaced].filter(id => !edges.some(edge => edge.to === id && unplaced.has(edge.from)));
      if (!layer.length) layer = [...unplaced]; // Cycles retain explicit edges; do not invent a root.
      layer.sort((left, right) => order.get(left)! - order.get(right)!);
      for (let i = 0; i < layer.length; i += 2) {
        const batch = layer.slice(i, i + 2);
        batch.forEach((id, index) => { positions.set(id, { x: batch.length === 1 ? (width - 240) / 2 : index * 280 + 15, y: row * rowHeight + 16 }); unplaced.delete(id); });
        row++;
      }
    }
  }
  const height = row * rowHeight;
  return <div className="compile-object-graph">
    <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: Math.min(width, 560), maxWidth: width, height: 'auto' }} role="img" aria-label="코드에서 확인한 노드와 포인터 연결">
      <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#0284c7" /></marker><marker id={`${markerId}-changed`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#d97706" /></marker></defs>
      {edges.map((edge, index) => {
        const from = positions.get(edge.from), to = positions.get(edge.to); if (!from || !to) return null;
        const sx = from.x + 240, sy = from.y + 25, tx = to.x, ty = to.y + 25;
        const bend = Math.max(sx, tx) + 20;
        const fromNode = visible.find(node => node.id === edge.from)!;
        const bottom = from.y + Math.min(rowHeight - 25, 56 + Math.min(fromNode.fields.length, 8) * 20);
        const path = to.y > from.y ? `M${from.x + 120},${bottom} C${from.x + 120},${bottom + 12} ${to.x + 120},${to.y - 12} ${to.x + 120},${to.y}` : from === to ? `M${sx},${sy} c35,-45 -50,-45 -50,0` : `M${sx},${sy} C${bend},${sy - 35} ${tx - 20},${ty - 35} ${tx},${ty}`;
        const changed = fromNode.fields.some(field => field.name === edge.label && field.changed);
        return <g key={`${edge.from}-${edge.label}-${index}`}><path d={path} fill="none" stroke={changed ? '#d97706' : '#0284c7'} strokeWidth={changed ? 3 : 1.6} markerEnd={`url(#${markerId}${changed ? '-changed' : ''})`} /><text x={to.y > from.y ? (from.x + to.x) / 2 + 126 : (sx + tx) / 2} y={to.y > from.y ? (bottom + to.y) / 2 : Math.min(sy, ty) - 12} fontSize="11" fill={changed ? '#92400e' : '#0369a1'}>{edge.label}</text></g>;
      })}
      {visible.map(node => {
        const pos = positions.get(node.id)!;
        return <g key={node.id} transform={`translate(${pos.x},${pos.y})`} role="button" tabIndex={0} aria-label={`${node.title}, C ${node.line}행`} onClick={() => onSelectLine(node.line)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectLine(node.line); } }}>
          <rect width="240" height={Math.min(rowHeight - 25, 56 + Math.min(node.fields.length, 8) * 20)} rx="9" fill={node.changed ? '#fffbeb' : '#f8fafc'} stroke={node.changed ? '#d97706' : '#cbd5e1'} />
          <text x="12" y="23" fontSize="13" fontWeight="700" fill="#0f172a">{node.title.slice(0, 30)}</text>
          <text x="12" y="41" fontSize="10" fill="#64748b">{node.subtitle?.slice(0, 38)}</text>
          {node.fields.slice(0, 8).map((field, index) => <text key={`${field.name}-${index}`} x="12" y={62 + index * 20} fontSize="11" fontWeight={field.changed ? 700 : 400} fill={field.changed ? '#92400e' : '#334155'}>{`${field.name}: ${field.value}`.slice(0, 34)}</text>)}
        </g>;
      })}
    </svg>
    {nodes.length > 40 && <p>노드는 앞 40개까지 표시합니다.</p>}
  </div>;
}
