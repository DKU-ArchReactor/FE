import type { LearningExample } from './examples';
import type { SourceSelection } from './mapping';

type Props = { example?: LearningExample; selection: SourceSelection | null; onSelect: (selection: SourceSelection) => void };

export default function StructureDiagram({ example, selection, onSelect }: Props) {
  if (!example?.nodes) return <aside className="compile-structure compile-structure-empty" aria-label="자료구조">
    <h2>자료구조</h2>
    <p>제공 예제를 선택하면 배열·리스트·트리의 예제 구조를 볼 수 있습니다.</p>
    <p>업로드한 코드의 동적 포인터 관계는 실행 메모리 정보가 필요합니다.</p>
  </aside>;

  const nodes = example.nodes;
  const edges = example.edges || [];
  const active = (node: typeof nodes[number]) => selection !== null && node.lines.some(line => line >= selection.start && line <= selection.end);
  const nodeCard = (node: typeof nodes[number]) => <button key={node.id} className={`compile-structure-node ${active(node) ? 'is-active' : ''}`} aria-label={`${node.title}: C ${node.focusLine}행 선택`} aria-pressed={active(node)} onClick={() => onSelect({ start: node.focusLine, end: node.focusLine })}>
    <strong>{node.title}</strong><span>{node.fields}</span>
  </button>;

  return <aside className="compile-structure" aria-label="자료구조 설명">
    <div className="compile-structure-heading"><span>구조 보기</span><span>{example.name}</span></div>
    {example.id === 'tree' ? <div className="compile-tree-layout">
      {nodeCard(nodes[0])}
      <div className="compile-tree-branches"><span>left ↓</span><span>right ↓</span></div>
      <div className="compile-tree-children">{nodes.slice(1).map(nodeCard)}</div>
    </div> : <div className="compile-structure-flow">
      {nodes.map((node, index) => <div className="compile-structure-step" key={node.id}>
        {nodeCard(node)}
        {index < nodes.length - 1 && <span className="compile-structure-edge" aria-label={edges[index]?.label || '다음'}><span>{edges[index]?.label || ''}</span>→</span>}
      </div>)}
    </div>}
    <details className="compile-structure-explanation"><summary>그림 읽는 법</summary><p>{example.explanation}</p></details>
    <p className="compile-structure-note">예제 설명 · 실제 실행 메모리 아님</p>
  </aside>;
}
