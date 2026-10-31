import { useEffect, useMemo, useRef, useState } from 'react';
import { instructionExplanation, isMappedToSelection, parseAssembly } from './mapping';
import type { SourceSelection } from './mapping';

type Props = { source: string; assembly?: string; onSelectionChange?: (selection: SourceSelection | null) => void };

export default function CodeComparison({ source, assembly, onSelectionChange }: Props) {
  const [selection, setSelection] = useState<SourceSelection | null>(null);
  const [selectedAssembly, setSelectedAssembly] = useState<number | null>(null);
  const [rawVisible, setRawVisible] = useState(false);
  const anchor = useRef(1);
  const sourceRef = useRef<HTMLDivElement>(null);
  const assemblyRef = useRef<HTMLDivElement>(null);
  const scrollTarget = useRef<'source' | 'assembly' | null>(null);
  const lines = source.split('\n');
  const rows = useMemo(() => parseAssembly(assembly || '', source.split('\n').length), [assembly, source]);
  const selectedRows = rows.filter(row => isMappedToSelection(row, selection));
  const mappedCount = new Set(rows.flatMap(row => row.sourceLine === null ? [] : [row.sourceLine])).size;

  useEffect(() => {
    const container = scrollTarget.current === 'source' ? sourceRef.current : assemblyRef.current;
    const selected = container?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (selected && container) container.scrollTo({ top: Math.max(0, selected.offsetTop - container.offsetTop - 60), behavior: 'smooth' });
  }, [selection, selectedAssembly]);

  function selectSource(line: number, extend: boolean) {
    if (!extend) anchor.current = line;
    const range = { start: Math.min(anchor.current, line), end: Math.max(anchor.current, line) };
    scrollTarget.current = 'assembly';
    setSelection(range);
    setSelectedAssembly(null);
    onSelectionChange?.(range);
  }

  return <>
    <div className="compile-columns">
      <section className="compile-panel" aria-label="C 소스 코드">
        <div className="compile-panel-heading"><h2><span>01</span> C 소스</h2><span>클릭 · Shift+클릭으로 범위 선택</span></div>
        <div className="compile-code" ref={sourceRef}>
          {lines.map((line, i) => <button key={i} className="compile-code-line" aria-label={`C ${i + 1}행: ${line}`} aria-pressed={selection !== null && i + 1 >= selection.start && i + 1 <= selection.end} onClick={event => selectSource(i + 1, event.shiftKey)}>
            <span className="compile-line-number">{i + 1}</span><code>{line || ' '}</code>
            {rows.some(row => row.sourceLine === i + 1) && <span className="compile-mapping-dot" title="대응 어셈블리 있음">●</span>}
          </button>)}
        </div>
      </section>
      <section className="compile-panel" aria-label="RISC-V 어셈블리">
        <div className="compile-panel-heading"><h2><span>02</span> RISC-V 어셈블리</h2><span>{assembly ? `${mappedCount}개 C 줄 연결` : '컴파일 결과'}</span></div>
        {assembly ? <div className="compile-code" ref={assemblyRef}>
          {rows.map(row => row.kind === 'label' ? <div key={row.assemblyLine} className="compile-code-line compile-label"><span className="compile-line-number">{row.assemblyLine}</span><code>{row.text}</code></div> :
            <button key={row.assemblyLine} className={`compile-code-line ${selectedAssembly === row.assemblyLine ? 'compile-selected-instruction' : ''}`} aria-label={`ASM ${row.assemblyLine}행: ${row.text}${row.sourceLine ? `, C ${row.sourceLine}행` : ', 매핑 없음'}`} aria-pressed={isMappedToSelection(row, selection) || selectedAssembly === row.assemblyLine} onClick={() => {
              const range = row.sourceLine === null ? null : { start: row.sourceLine, end: row.sourceLine };
              scrollTarget.current = 'source';
              setSelection(range);
              setSelectedAssembly(row.assemblyLine);
              if (row.sourceLine !== null) anchor.current = row.sourceLine;
              onSelectionChange?.(range);
            }}><span className="compile-line-number">{row.assemblyLine}</span><code>{row.text}</code><span className="compile-source-badge">{row.sourceLine ? `C ${row.sourceLine}` : '연결 없음'}</span></button>)}
          {rows.length === 0 && <p className="compile-footnote">표시할 실행 명령어를 찾지 못했습니다. 원본 어셈블리를 확인해 주세요.</p>}
        </div> : <div className="compile-empty"><strong>C → Assembly</strong><p>컴파일하면 C 코드와 연결된 명령어가 표시됩니다.</p><p>먼저 산술 예제 또는 작은 C 파일로 시작하세요.</p></div>}
      </section>
    </div>
    <section className="compile-selection" aria-label="선택한 코드 설명" aria-live="polite">
      <h2>{selection ? `C ${selection.start}${selection.end !== selection.start ? `–${selection.end}` : ''}행 → ${selectedRows.length}개 어셈블리 명령` : selectedAssembly ? 'C 위치가 없는 명령어' : '코드의 한 줄을 선택해 보세요'}</h2>
      {!assembly ? <p>컴파일 후 대응 관계를 확인할 수 있습니다.</p> : selection && selectedRows.length === 0 ? <p>이 줄에 대응하는 컴파일러 줄 정보가 없습니다. 주석·선언이거나, 다른 줄에 귀속된 코드일 수 있습니다. 대응 관계를 추측하지 않습니다.</p> : !selection ? <p>{selectedAssembly ? '컴파일러가 이 명령어에 현재 소스의 위치를 제공하지 않았습니다.' : 'C 또는 어셈블리를 클릭하면 양쪽의 대응 코드가 함께 강조됩니다.'}</p> : <>
        <code className="compile-selected-source">{lines.slice(selection.start - 1, selection.end).join('\n')}</code>
        <ul>{[...new Set(selectedRows.map(row => instructionExplanation(row.text)))].map(explanation => <li key={explanation}>{explanation}</li>)}</ul>
      </>}
    </section>
    {assembly && mappedCount === 0 && <p className="compile-warning" role="status">C 줄 정보가 없어 매핑을 표시하지 않습니다. 서버가 디버그 정보를 포함한 RV32IM 어셈블리를 반환하는지 확인해 주세요.</p>}
    <p className="compile-footnote">컴파일러 줄 정보(.loc) 기준입니다. 한 줄이 여러 명령어로 바뀔 수 있으며, 함수 진입·복귀 코드도 포함됩니다. ASM 번호는 원본 파일의 줄 번호이며 PC 주소가 아닙니다. 의사 명령어는 조립 과정에서 확장될 수 있습니다.</p>
    {assembly && <details className="compile-log" onToggle={event => setRawVisible(event.currentTarget.open)}><summary>원본 어셈블리 · 디버그 지시문 포함</summary>{rawVisible && <pre>{assembly}</pre>}</details>}
  </>;
}
