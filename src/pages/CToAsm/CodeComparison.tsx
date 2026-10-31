import { useMemo, useRef, useState } from 'react';
import { instructionExplanation, isMappedToSelection, parseAssembly } from './mapping';
import { groupAssembly, operandExplanation } from './blocks';
import type { SourceSelection } from './mapping';

type Props = { source: string; assembly?: string; selection?: SourceSelection | null; onSelectionChange?: (selection: SourceSelection | null) => void };

export default function CodeComparison({ source, assembly, selection: controlledSelection, onSelectionChange }: Props) {
  const [localSelection, setSelection] = useState<SourceSelection | null>(null);
  const [selectedUnmapped, setSelectedUnmapped] = useState<string | null>(null);
  const selection = controlledSelection === undefined ? localSelection : controlledSelection;
  const anchor = useRef(1);
  const lines = source.split('\n');
  const rows = useMemo(() => parseAssembly(assembly || '', source.split('\n').length), [assembly, source]);
  const blocks = useMemo(() => groupAssembly(rows), [rows]);
  const mappedLines = new Set(rows.flatMap(row => row.sourceLine === null ? [] : [row.sourceLine]));
  const selectedRows = rows.filter(row => isMappedToSelection(row, selection));
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
  let lastContextLine = 0;
  for (const block of blocks) {
    if (block.sourceLine !== null) {
      for (let line = lastContextLine + 1; line < block.sourceLine; line += 1) {
        if (lines[line - 1]?.trim() && !mappedLines.has(line)) displayBlocks.push({ sourceLine: null, contextLine: line, rows: [] });
      }
      lastContextLine = Math.max(lastContextLine, block.sourceLine);
    }
    displayBlocks.push(block);
  }
  for (let line = lastContextLine + 1; line <= lines.length; line += 1) {
    if (lines[line - 1]?.trim() && !mappedLines.has(line)) displayBlocks.push({ sourceLine: null, contextLine: line, rows: [] });
  }

  return <section className="compile-comparison" aria-label="C와 어셈블리 대응 블록">
    <div className="compile-block-header"><h2>C 소스</h2><h2>대응 어셈블리 <span>명령어별 역할</span></h2></div>
    <p className="compile-block-guide">{assembly ? '같은 블록의 C와 명령어가 함께 보입니다. 명령어는 컴파일 출력 순서를 따릅니다.' : '컴파일하면 각 C 줄 옆에 해당 명령어와 역할이 함께 표시됩니다.'}</p>
    {!assembly ? <div className="compile-before">{lines.map((_, i) => <div key={i}>{sourceButton(i + 1)}</div>)}</div> : <>
      {displayBlocks.map((block, index) => {
        const sourceLine = block.sourceLine;
        const contextLine = block.contextLine;
        const repeated = sourceLine !== null && blocks.filter(item => item.sourceLine === sourceLine).length > 1;
        const selected = sourceLine !== null && selection !== null && sourceLine >= selection.start && sourceLine <= selection.end;
        return <article key={index} className={`compile-block ${sourceLine === null ? 'compile-block-unmapped' : ''} ${selected ? 'is-selected' : ''}`} aria-label={contextLine ? `C ${contextLine}행, 직접 연결된 명령어 없음` : sourceLine === null ? '소스 위치 없는 출력' : `C ${sourceLine}행 대응 블록`}>
          <div className="compile-block-left">
            {sourceLine !== null ? <>{sourceButton(sourceLine)}<span className="compile-block-note">{block.rows.filter(row => row.kind === 'instruction').length}개 명령어{repeated ? ' · 같은 줄에서 나온 다른 명령어 묶음' : ''}</span></> : contextLine ? <><span className="compile-c-badge">C {contextLine}</span><code className="compile-context-source">{lines[contextLine - 1]}</code><p className="compile-block-note">이 줄에 직접 연결된 명령어가 없습니다.</p></> : <><span className="compile-c-badge">소스 위치 없음</span><p className="compile-block-note">컴파일러가 소스 위치를 제공하지 않은 출력입니다.</p></>}
          </div>
          <div className="compile-block-right">
            {contextLine ? <span className="compile-no-output">이 C 줄에 직접 연결된 명령어 없음</span> : block.rows.map(row => row.kind === 'label' ? <div className="compile-block-label" key={row.assemblyLine}><code>{row.text}</code><span>이동 목적지를 나타내는 레이블</span></div> : <div className="compile-instruction" key={row.assemblyLine}>
              <button aria-label={`ASM ${row.assemblyLine}행: ${row.text}${sourceLine ? `, C ${sourceLine}행` : ', 매핑 없음'}`} aria-pressed={isMappedToSelection(row, selection)} onClick={() => { select(sourceLine); if (sourceLine === null) setSelectedUnmapped(row.text); }} title={`원본 어셈블리 ${row.assemblyLine}행`}><span className="compile-op-number">{ordinals.get(row.assemblyLine)}</span><code>{row.text}</code></button>
              <p>{operandExplanation(row.text) || instructionExplanation(row.text)}</p>
            </div>)}
          </div>
        </article>;
      })}
      {mappedLines.size === 0 && <p className="compile-warning" role="status">C 줄 정보가 없어 대응 관계를 표시할 수 없습니다. 명령어 순서만 표시하며, 연결을 추측하지 않습니다.</p>}
    </>}
    {selection && <div className="compile-selection" role="status"><h2>C {selection.start}{selection.end !== selection.start ? `–${selection.end}` : ''}행 → {selectedRows.length}개 어셈블리 명령</h2><p>같은 C 위치의 블록이 함께 강조됩니다. Shift+클릭으로 범위를 선택할 수 있습니다.</p></div>}
    {selectedUnmapped && <div className="compile-selection" role="status"><h2>C 위치가 없는 명령어</h2><code>{selectedUnmapped}</code><p>컴파일러가 이 명령어에 현재 C 소스의 줄 정보를 제공하지 않았습니다.</p></div>}
    <p className="compile-footnote">줄 연결은 컴파일러가 제공한 위치를 따릅니다. 명령어 번호는 표시 순서이며 PC 주소가 아닙니다. 레지스터를 C 변수로 추측하지 않으며, 의사 명령어는 조립 과정에서 확장될 수 있습니다.</p>
  </section>;
}
