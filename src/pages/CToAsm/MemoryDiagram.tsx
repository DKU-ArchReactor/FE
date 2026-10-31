import type { MemoryValue, MemoryView } from './runtime';
import { hex } from './runtime';
import type { MemoryChange } from './memoryTimeline';
import StructureGraph from './StructureGraph';

type Props = { view: MemoryView; changes: MemoryChange[]; onSelectLine: (line: number) => void; finished?: boolean };
export default function MemoryDiagram({ view, changes, onSelectLine, finished = false }: Props) {
  const changed = new Set(changes.map(change => change.address));
  const targets = new Map(view.nodes.map(node => [hex(node.address!), node]));
  const incoming = new Set([...view.variables, ...view.nodes.flatMap(node => node.children)].filter(value => !value.unavailable && value.pointer).map(value => value.pointer));
  const visibleNodes = view.nodes.filter(node => node.children.some(field => !field.unavailable) || incoming.has(node.address));
  const display = (value: MemoryValue) => {
    if (value.unavailable) return '미확인';
    if (value.pointer !== undefined) { const target = targets.get(hex(value.pointer)); return value.pointer === 0 ? 'NULL' : target && target.typeId === value.targetType ? target.name : '대상 미확인'; }
    return value.value;
  };
  const scalars = view.variables.filter(value => !value.children.length && !value.unavailable).slice(0, 24);
  const arrays = view.variables.filter(value => value.children.length && value.value !== 'struct').slice(0, 8);
  const nodes = visibleNodes.map(value => ({ id: hex(value.address!), title: value.name, subtitle: `${value.type} · 상자는 구조체 하나`, line: value.line, changed: value.children.some(child => child.address !== undefined && changed.has(child.address)), fields: value.children.map(child => ({ name: child.name, value: display(child), changed: child.address !== undefined && changed.has(child.address) })) }));
  const edges = visibleNodes.flatMap(value => value.children.flatMap(child => child.pointer && child.targetType !== undefined && targets.get(hex(child.pointer))?.typeId === child.targetType ? [{ from: hex(value.address!), to: hex(child.pointer), label: child.name }] : []));
  const cell = (value: MemoryValue, label: string) => <button key={value.name} className={`compile-memory-cell ${value.unavailable ? 'is-unknown' : ''} ${value.address !== undefined && changed.has(value.address) ? 'is-changed' : ''}`} onClick={() => onSelectLine(value.line)} title={`${value.type}${value.address !== undefined ? ` · ${hex(value.address)}` : ''}${value.unavailable ? ` · ${value.unavailable}` : ''}`} aria-label={`${value.name}: ${display(value)}`}><span>{label}</span><strong>{value.pointer !== undefined && value.pointer !== 0 ? '→ ' : ''}{display(value)}</strong></button>;
  const nodeChanged = visibleNodes.some(node => node.children.some(field => field.address !== undefined && changed.has(field.address)));
  const arrayChanged = arrays.some(array => array.children.some(value => value.address !== undefined && changed.has(value.address)));
  return <div className={`compile-memory-diagram ${nodeChanged ? 'is-node-step' : arrayChanged ? 'is-array-step' : ''}`}>
    <div className="compile-memory-legend"><span><i className="known" />확인된 값</span><span><i className="changed" />이번에 바뀐 값·연결</span><span><i className="unknown" />기록·위치 미확인</span></div>
    {scalars.length > 0 && <section className="compile-variable-board" aria-label="변수 값 그림"><h3>변수에 담긴 값</h3><div className="compile-variable-cells">{scalars.map(value => cell(value, value.name))}</div></section>}
    {arrays.length > 0 && <section className="compile-array-board" aria-label="배열 메모리 그림"><h3>배열 — 원소가 차례로 놓인 공간</h3>{arrays.map(array => <div key={`${array.name}-${array.address}`} className="compile-array-strip"><div className="compile-array-caption"><strong>{array.name}</strong><span>{array.value}</span></div><div className="compile-array-cells">{array.children.map((value, index) => value.value === 'struct' ? <button className={`compile-memory-cell is-node ${value.children.every(field => field.unavailable) ? 'is-unknown' : ''} ${value.children.some(field => field.address !== undefined && changed.has(field.address)) ? 'is-changed' : ''}`} key={value.name} onClick={() => onSelectLine(value.line)}><span>[{index}]</span><strong>{value.children.find(field => field.pointer === undefined && !field.unavailable)?.value || '미기록'}</strong><small>{value.children.every(field => field.unavailable) ? '값이 기록되면 노드로 표시' : '아래 연결 그림에서 보기'}</small></button> : cell(value, `[${index}]`))}</div></div>)}</section>}
    {nodes.length > 0 && <section className="compile-pointer-board" aria-label="포인터 연결 그림"><h3>노드와 포인터 — 화살표는 실제로 가리키는 대상</h3><p>상자 안에는 필드 값, 화살표 위에는 포인터 필드 이름이 표시됩니다. NULL은 가리키는 대상이 없다는 뜻입니다.</p><StructureGraph nodes={nodes} edges={edges} onSelectLine={onSelectLine} /></section>}
    {!scalars.length && !arrays.length && !nodes.length && <div className="compile-memory-intro"><strong>현재 위치에는 그림으로 표시할 변수 값이 없습니다.</strong><p>{finished ? '기록의 끝입니다. 이전 변화로 이동하면 함수 실행 중의 메모리를 볼 수 있습니다.' : '다음 변화로 이동하면 변수와 배열에 값이 기록되는 모습을 볼 수 있습니다. 확인하지 못한 값의 이유는 아래 상세 값에서 볼 수 있습니다.'}</p></div>}
    {view.variables.length > 24 && <p className="compile-footnote">변수 상자는 앞 24개까지 표시합니다. 전체 확인 가능한 값은 아래 상세 값에 있습니다.</p>}
  </div>;
}
