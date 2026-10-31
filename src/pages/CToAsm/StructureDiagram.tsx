import { useId } from 'react';
import type { LearningExample } from './examples';
import type { SourceSelection } from './mapping';

type Props = { example?: LearningExample; selection: SourceSelection | null; onSelect: (selection: SourceSelection) => void };

export default function StructureDiagram({ example, selection, onSelect }: Props) {
  const markerId = useId().replace(/:/g, '');
  if (!example?.nodes) return null;
  const nodes = example.nodes;
  return <section className="compile-structure" aria-label="자료구조 설명">
    <div className="compile-panel-heading"><h2><span>03</span> {example.name}의 구조</h2><span>예제 구조 설명 · 실행 스냅샷 아님</span></div>
    <p>{example.explanation}</p>
    <div className="compile-diagram-scroll">
      <svg viewBox={`0 0 760 ${example.id === 'tree' ? 230 : 155}`} aria-label={`${example.name} 예제 구조`}>
        <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#64748b" /></marker></defs>
        {example.edges?.map(edge => {
          const from = nodes.find(node => node.id === edge.from)!;
          const to = nodes.find(node => node.id === edge.to)!;
          const tree = example.id === 'tree';
          const x1 = from.x + (tree ? 100 : 200), y1 = from.y + (tree ? 60 : 30);
          const x2 = to.x + (tree ? 100 : 0), y2 = to.y + (tree ? 0 : 30);
          return <g key={`${edge.from}-${edge.to}`}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth="2" markerEnd={`url(#${markerId})`} /><text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle" fontSize="12" fill="#475569">{edge.label}</text></g>;
        })}
        {nodes.map(node => {
          const active = selection !== null && node.lines.some(line => line >= selection.start && line <= selection.end);
          return <g key={node.id} role="button" tabIndex={0} aria-label={`${node.title}: C ${node.focusLine}행 선택`} aria-pressed={active} onClick={() => onSelect({ start: node.focusLine, end: node.focusLine })} onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect({ start: node.focusLine, end: node.focusLine }); }
          }} className="compile-diagram-node">
            <rect x={node.x} y={node.y} width="200" height="60" rx="10" fill={active ? '#e0f2fe' : '#f8fafc'} stroke={active ? '#0284c7' : '#cbd5e1'} strokeWidth={active ? 2 : 1} />
            <text x={node.x + 100} y={node.y + 23} textAnchor="middle" fill="#0f172a" fontSize="14" fontWeight="600">{node.title}</text>
            <text x={node.x + 100} y={node.y + 44} textAnchor="middle" fill="#475569" fontSize="11">{node.fields}</text>
          </g>;
        })}
      </svg>
    </div>
    <p className="compile-footnote">노드를 누르면 관련 C 줄과 컴파일된 어셈블리가 강조됩니다. 제공 예제의 관계만 표시하며, 업로드한 임의 C 코드의 자료구조를 자동 추론하지 않습니다.</p>
  </section>;
}
