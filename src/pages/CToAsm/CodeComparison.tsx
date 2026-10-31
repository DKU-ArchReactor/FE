import { useMemo, useRef, useState } from 'react';
import { instructionExplanation, isMappedToSelection, parseAssembly } from './mapping';
import { groupAssembly, operandExplanation } from './blocks';
import type { SourceSelection } from './mapping';

type Props = { source: string; assembly?: string; selection?: SourceSelection | null; onSelectionChange?: (selection: SourceSelection | null) => void };

export default function CodeComparison({ source, assembly, selection: controlledSelection, onSelectionChange }: Props) {
  const [localSelection, setSelection] = useState<SourceSelection | null>(null);
  const [selectedUnmapped, setSelectedUnmapped] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showExplanations, setShowExplanations] = useState(true);
  const selection = controlledSelection === undefined ? localSelection : controlledSelection;
  const anchor = useRef(1);
  const lines = source.split('\n');
  const rows = useMemo(() => parseAssembly(assembly || '', source.split('\n').length), [assembly, source]);
  const blocks = useMemo(() => groupAssembly(rows), [rows]);
  const mappedLines = new Set(rows.flatMap(row => row.sourceLine === null ? [] : [row.sourceLine]));
  const selectedRows = rows.filter(row => isMappedToSelection(row, selection));
  const selectedInstructionCount = selectedRows.filter(row => row.kind === 'instruction').length;
  const ordinals = new Map(rows.filter(row => row.kind === 'instruction').map((row, i) => [row.assemblyLine, i + 1]));

  function select(line: number | null, extend = false) {
    setSelectedUnmapped(null);
    if (line !== null && !extend) anchor.current = line;
    const range = line === null ? null : { start: Math.min(anchor.current, line), end: Math.max(anchor.current, line) };
    setSelection(range);
    onSelectionChange?.(range);
  }

  function sourceButton(line: number) {
    return <button className="compile-block-source" aria-label={`C ${line}행: ${lines[line - 1]}`} aria-pressed={selection !== null && line >= selection.start && line <= selection.end} onClick={event => select(line, event.shiftKey)}>
      <span className="compile-c-badge">C {line}</span><code>{lines[line - 1] || ' '}</code>
    </button>;
  }

  const displayBlocks: (typeof blocks[number] & { contextLine?: number })[] = [];
  const contextLines = lines.flatMap((text, index) => text.trim() && !mappedLines.has(index + 1) ? [{ line: index + 1, text }] : []);
  for (const block of blocks) {
    displayBlocks.push(block);
  }
  const functionGroups = new Map<string, typeof displayBlocks>();
  for (const block of displayBlocks) {
    const name = block.functionName || '전역 코드';
    functionGroups.set(name, [...(functionGroups.get(name) || []), block]);
  }
  const matchingGroups = [...functionGroups].map(([name, groupBlocks]) => [name, groupBlocks.filter(block => {
    if (!query.trim()) return true;
    const needle = query.trim().toLocaleLowerCase();
    const sourceText = block.contextLine ? lines[block.contextLine - 1] : block.sourceLine ? lines[block.sourceLine - 1] : '';
    return `${sourceText} ${block.rows.map(row => row.text).join(' ')}`.toLocaleLowerCase().includes(needle);
  })] as const).filter(([, groupBlocks]) => groupBlocks.length > 0);
  const firstFunction = Math.max(0, matchingGroups.findIndex(([name]) => name !== '전역 코드'));

  return <section className="compile-comparison" aria-label="C와 어셈블리 대응 블록">
    <div className="compile-block-header"><h2>C 소스 코드</h2><h2>생성된 RISC-V 명령어</h2></div>
    {assembly && <div className="compile-comparison-tools"><label className="compile-code-search">코드 찾기<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="함수, C 코드, 명령어 검색" /></label><label className="compile-explanation-toggle"><input type="checkbox" checked={showExplanations} onChange={event => setShowExplanations(event.target.checked)} />명령어 설명</label></div>}
    {!assembly ? <div className="compile-before">{lines.map((_, i) => <div key={i}>{sourceButton(i + 1)}</div>)}</div> : <>
      {matchingGroups.map(([functionName, functionBlocks], groupIndex) => {
        const sourceLineCount = new Set(functionBlocks.flatMap(block => block.sourceLine === null ? [] : [block.sourceLine])).size;
        return <details key={functionName} className="compile-function" open={groupIndex === firstFunction}>
        <summary><strong>{functionName}</strong><span>{sourceLineCount ? `${sourceLineCount}개 C 줄` : '소스 줄 정보 없음'}</span></summary>
        {functionBlocks.map((block, index) => {
        const sourceLine = block.sourceLine;
        const contextLine = block.contextLine;
        const selected = sourceLine !== null && selection !== null && sourceLine >= selection.start && sourceLine <= selection.end;
        return <article key={index} className={`compile-block ${sourceLine === null ? 'compile-block-unmapped' : ''} ${selected ? 'is-selected' : ''}`} aria-label={contextLine ? `C ${contextLine}행, 직접 연결된 명령어 없음` : sourceLine === null ? '소스 위치 없는 출력' : `C ${sourceLine}행 대응 블록`}>
          <div className="compile-block-left">
            {sourceLine !== null ? sourceButton(sourceLine) : <><span className="compile-c-badge">{block.rows.every(row => row.kind === 'label') ? '이동 목적지' : '소스 줄 정보 없음'}</span><p className="compile-block-note">{block.rows.every(row => row.kind === 'label') ? '함수 시작이나 분기 대상을 표시합니다.' : '컴파일러가 C 줄 정보를 제공하지 않은 명령어입니다.'}</p></>}
          </div>
          <div className="compile-block-right">
            {contextLine ? <span className="compile-no-output">이 C 줄에 직접 연결된 명령어 없음</span> : block.rows.map(row => row.kind === 'label' ? <div className="compile-block-label" key={row.assemblyLine}><code>{row.text}</code><span>이동 목적지를 나타내는 레이블</span></div> : <div className="compile-instruction" key={row.assemblyLine}>
              <button aria-label={`ASM ${row.assemblyLine}행: ${row.text}${sourceLine ? `, C ${sourceLine}행` : ', 매핑 없음'}`} aria-pressed={isMappedToSelection(row, selection)} onClick={() => { select(sourceLine); if (sourceLine === null) setSelectedUnmapped(row.text); }} title={`원본 어셈블리 ${row.assemblyLine}행`}><span className="compile-op-number">{ordinals.get(row.assemblyLine)}</span><code>{row.text}</code></button>
              {showExplanations && <p>{operandExplanation(row.text) || instructionExplanation(row.text)}</p>}
            </div>)}
          </div>
        </article>;
        })}
      </details>;
      })}
      {matchingGroups.length === 0 && <p className="compile-no-results">“{query}”에 해당하는 코드나 명령어가 없습니다.</p>}
      {mappedLines.size === 0 && <p className="compile-warning" role="status">C 줄 정보가 없어 대응 관계를 표시할 수 없습니다. 명령어 순서만 표시하며, 연결을 추측하지 않습니다.</p>}
    </>}
    {assembly && contextLines.length > 0 && <details className="compile-unmapped-source"><summary>직접 연결된 명령어가 없는 소스 · {contextLines.length}줄</summary><p>타입·구조체 정의와 주석 등은 실행 명령어를 직접 만들지 않습니다. 나머지 줄도 컴파일러가 위치 정보를 주지 않으면 연결하지 않습니다.</p><pre>{contextLines.map(item => `${item.line}  ${item.text}`).join('\n')}</pre></details>}
    {selection && <div className="compile-selection" role="status"><h2>선택한 코드: C {selection.start}{selection.end !== selection.start ? `–${selection.end}` : ''}행</h2><p>{selectedInstructionCount ? `이 코드에서 생성된 명령어 ${selectedInstructionCount}개를 강조했습니다.` : '연결된 명령어가 없습니다.'} Shift+클릭으로 여러 줄을 함께 선택할 수 있습니다.</p></div>}
    {selectedUnmapped && <div className="compile-selection" role="status"><h2>C 위치가 없는 명령어</h2><code>{selectedUnmapped}</code><p>컴파일러가 이 명령어에 현재 C 소스의 줄 정보를 제공하지 않았습니다.</p></div>}
    <p className="compile-footnote">줄 연결은 컴파일러가 제공한 위치를 따릅니다. 명령어 번호는 표시 순서이며 PC 주소가 아닙니다. 레지스터를 C 변수로 추측하지 않으며, 의사 명령어는 조립 과정에서 확장될 수 있습니다.</p>
  </section>;
}
