import { useId } from 'react';

export type GraphNode = { id: string; title: string; subtitle?: string; fields: { name: string; value: string; changed?: boolean }[]; line: number; changed?: boolean };
export type GraphEdge = { from: string; to: string; label: string };
type Props = { nodes: GraphNode[]; edges: GraphEdge[]; onSelectLine: (line: number) => void };
const CARD_WIDTH = 240;
const COLUMN_GAP = 40;

export default function StructureGraph({ nodes, edges, onSelectLine }: Props) {
  const markerId = useId().replace(/:/g, '') + '-pointer-arrow';
  const visible = nodes.slice(0, 40);
  if (!visible.length) return null;

  const maxFields = Math.max(0, ...visible.map(node => Math.min(node.fields.length, 8)));
  const rowHeight = Math.max(156, 92 + maxFields * 20);
  const cardHeight = (node: GraphNode) => Math.max(96, 72 + Math.min(node.fields.length, 8) * 20);
  const positions = new Map<string, { x: number; y: number }>();
  const incoming = new Set(edges.map(edge => edge.to));
  const treeShape = edges.some(edge => edge.label === 'left' || edge.label === 'right');
  const listShape = !treeShape && edges.length > 0 && edges.every(edge => edge.label === 'next');

  if (treeShape) {
    let leaf = 0;
    const placed = new Set<string>();
    const visiting = new Set<string>();
    const childrenOf = (id: string) => edges.filter(edge => edge.from === id && visible.some(node => node.id === edge.to))
      .sort((a, b) => (a.label === 'left' ? 0 : a.label === 'right' ? 1 : 2) - (b.label === 'left' ? 0 : b.label === 'right' ? 1 : 2));
    const place = (id: string, depth: number): number => {
      const existing = positions.get(id);
      if (existing) return existing.x + CARD_WIDTH / 2;
      const childEdges = childrenOf(id).filter(edge => !placed.has(edge.to) && !visiting.has(edge.to));
      let center: number;
      visiting.add(id);
      if (!childEdges.length) {
        center = 20 + leaf * (CARD_WIDTH + COLUMN_GAP) + CARD_WIDTH / 2;
        leaf++;
      } else {
        const childCenters = childEdges.map(edge => place(edge.to, depth + 1));
        center = childCenters.reduce((sum, value) => sum + value, 0) / childCenters.length;
      }
      positions.set(id, { x: center - CARD_WIDTH / 2, y: depth * rowHeight + 16 });
      visiting.delete(id);
      placed.add(id);
      return center;
    };
    for (const node of visible) if (!incoming.has(node.id)) place(node.id, 0);
    for (const node of visible) if (!placed.has(node.id)) place(node.id, 0);
  } else if (listShape) {
    const byId = new Map(visible.map(node => [node.id, node]));
    const next = new Map(edges.map(edge => [edge.from, edge.to]));
    const roots = visible.filter(node => !incoming.has(node.id));
    let row = 0;
    const placed = new Set<string>();
    for (const root of [...roots, ...visible]) {
      let node: GraphNode | undefined = root;
      while (node && !placed.has(node.id)) {
        positions.set(node.id, { x: (CARD_WIDTH + COLUMN_GAP) / 2, y: row++ * rowHeight + 16 });
        placed.add(node.id);
        node = byId.get(next.get(node.id) || '');
      }
    }
  } else {
    const order = new Map(visible.map((node, index) => [node.id, index]));
    const remaining = new Set(visible.map(node => node.id));
    let row = 0;
    while (remaining.size) {
      const component = new Set<string>(), pending = [remaining.values().next().value!];
      while (pending.length) {
        const id = pending.pop()!;
        if (component.has(id)) continue;
        component.add(id); remaining.delete(id);
        for (const edge of edges) {
          const other = edge.from === id ? edge.to : edge.to === id ? edge.from : undefined;
          if (other && remaining.has(other)) pending.push(other);
        }
      }
      const unplaced = new Set(component);
      while (unplaced.size) {
        let layer = [...unplaced].filter(id => !edges.some(edge => edge.to === id && unplaced.has(edge.from)));
        if (!layer.length) layer = [...unplaced];
        layer.sort((left, right) => order.get(left)! - order.get(right)!);
        for (let i = 0; i < layer.length; i += 2) {
          const batch = layer.slice(i, i + 2);
          batch.forEach((id, index) => { positions.set(id, { x: batch.length === 1 ? 160 : index * (CARD_WIDTH + COLUMN_GAP) + 20, y: row * rowHeight + 16 }); unplaced.delete(id); });
          row++;
        }
      }
    }
  }

  const width = Math.max(560, ...[...positions.values()].map(pos => pos.x + CARD_WIDTH + 20));
  const height = Math.max(rowHeight, ...[...positions.values()].map(pos => pos.y + rowHeight));
  const visibleEdges = edges.filter(edge => positions.has(edge.from) && positions.has(edge.to));
  return <div className="compile-object-graph">
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: Math.min(width, 560), maxWidth: width, height: 'auto' }} role="img" aria-label={treeShape ? '트리 구조와 실제 포인터 연결' : listShape ? '연결 리스트와 실제 포인터 연결' : '구조체와 실제 포인터 연결'}>
      <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#0284c7" /></marker><marker id={`${markerId}-changed`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#d97706" /></marker></defs>
      {visibleEdges.map((edge, index) => {
        const from = positions.get(edge.from)!, to = positions.get(edge.to)!;
        const fromNode = visible.find(node => node.id === edge.from)!;
        const sx = from.x + CARD_WIDTH / 2, sy = from.y + cardHeight(fromNode), tx = to.x + CARD_WIDTH / 2, ty = to.y;
        const downward = ty > sy;
        const path = downward
          ? `M${sx},${sy} C${sx},${sy + 20} ${tx},${ty - 20} ${tx},${ty}`
          : `M${sx + CARD_WIDTH / 2 - 8},${from.y + 25} C${sx + CARD_WIDTH / 2 + 34},${from.y - 35} ${tx + CARD_WIDTH / 2 + 34},${to.y - 35} ${tx + CARD_WIDTH / 2 - 8},${to.y + 25}`;
        const changed = fromNode.fields.some(field => field.name === edge.label && field.changed);
        const side = edge.label === 'left' ? -12 : edge.label === 'right' ? 12 : 15;
        const labelX = downward ? sx + (tx - sx) * .52 + side : Math.max(sx, tx) + CARD_WIDTH / 2 + 24;
        const labelY = downward ? sy + (ty - sy) * .54 : Math.min(from.y, to.y) - 12;
        return <g key={`${edge.from}-${edge.label}-${index}`}><path d={path} fill="none" stroke={changed ? '#d97706' : '#0284c7'} strokeWidth={changed ? 3 : 1.6} markerEnd={`url(#${markerId}${changed ? '-changed' : ''})`} /><text x={labelX} y={labelY} textAnchor="middle" paintOrder="stroke" stroke="#fff" strokeWidth="4" strokeLinejoin="round" fontSize="11" fill={changed ? '#92400e' : '#0369a1'}>{edge.label}</text></g>;
      })}
      {visible.map(node => {
        const pos = positions.get(node.id)!;
        return <g key={node.id} transform={`translate(${pos.x},${pos.y})`} role="button" tabIndex={0} aria-label={`${node.title}, C ${node.line}행`} onClick={() => onSelectLine(node.line)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectLine(node.line); } }}>
          <rect width={CARD_WIDTH} height={cardHeight(node)} rx="9" fill={node.changed ? '#fffbeb' : '#f8fafc'} stroke={node.changed ? '#d97706' : '#cbd5e1'} />
          <text x="12" y="23" fontSize="13" fontWeight="700" fill="#0f172a">{node.title.slice(0, 30)}</text>
          <text x="12" y="41" fontSize="10" fill="#64748b">{node.subtitle?.slice(0, 38)}</text>
          {node.fields.slice(0, 8).map((field, index) => <text key={`${field.name}-${index}`} x="12" y={62 + index * 20} fontSize="11" fontWeight={field.changed ? 700 : 400} fill={field.changed ? '#92400e' : '#334155'}>{`${field.name}: ${field.value}`.slice(0, 34)}</text>)}
        </g>;
      })}
    </svg>
    {nodes.length > 40 && <p>노드는 앞 40개까지 표시합니다.</p>}
  </div>;
}
