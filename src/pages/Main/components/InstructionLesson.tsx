import {useMemo} from 'react';
import type {CycleHistoryItem, SimulationResult} from '@/type/simulation';
import type {MappedAssemblyRow} from '../utils/translationCompile';
import {instructionAt} from '../utils/tutorAnalysis';
import {buildInstructionFlow, instructionPc, numericPc} from '../utils/instructionFlow';
import SingleInstructionFlow from './SingleInstructionFlow';
import {TutorText} from './TutorEvidence';
import './TutorTypography.css';

export interface InstructionLessonContext {
  flowDurationMs?: number;
  onPausePlayback?: () => void;
  source?: string;
  rows?: MappedAssemblyRow[];
  selectedAsmIndex?: number | null;
  selectedCLine?: number | null;
  onSelectAsm?: (line: number | null, index: number) => void;
  onJumpToCycle?: (cycle: number) => void;
}
export interface InstructionLessonProps {
  currentData: CycleHistoryItem | null;
  prevData?: CycleHistoryItem | null;
  simulationData?: SimulationResult | null;
  context?: InstructionLessonContext;
}

export default function InstructionLesson({currentData, prevData, simulationData, context}: InstructionLessonProps) {
  const items = simulationData?.tutor?.asm_instructions;
  const fallbackRows = useMemo(() => items?.map(item => ({pc: item.pc ?? '', text: item.text, sourceLine: item.source_line ?? null})) ?? [], [items]);
  const rows = context?.rows?.length ? context.rows : fallbackRows;
  const currentPc = instructionPc(currentData);
  const currentIndex = rows.findIndex(row => numericPc(row.pc) === numericPc(currentPc));
  const line = context?.selectedCLine;
  const selectedIndex = context?.selectedAsmIndex != null ? context.selectedAsmIndex
    : line != null ? currentIndex >= 0 && rows[currentIndex].sourceLine === line ? currentIndex : rows.findIndex(row => row.sourceLine === line)
    : currentIndex;
  const row = rows[selectedIndex];
  const item = instructionAt(simulationData?.tutor, row?.pc);
  const sourceLine = context?.source != null ? row?.sourceLine ?? line : null;
  const sourceLines = useMemo(() => context?.source?.split(/\r?\n/) ?? [], [context?.source]);
  const source = sourceLine != null ? sourceLines[sourceLine - 1] : undefined;
  const mappedLines = useMemo(() => [...new Set(rows.flatMap(value => value.sourceLine != null ? [value.sourceLine] : []))].sort((a, b) => a - b), [rows]);
  const siblings = useMemo(() => sourceLine != null ? rows.map((value, index) => ({...value, index})).filter(value => value.sourceLine === sourceLine)
    : row ? [{...row, index: selectedIndex}] : [], [rows, sourceLine, row, selectedIndex]);
  const flow = useMemo(() => buildInstructionFlow(item, currentData, prevData, simulationData), [item, currentData, prevData, simulationData]);
  const occurrences = useMemo(() => row ? simulationData?.history.flatMap((frame, index) => numericPc(instructionPc(frame)) === numericPc(row.pc) ? [index] : []) ?? [] : [], [row, simulationData?.history]);
  const target = occurrences.find(index => index >= flow.historyIndex) ?? occurrences[occurrences.length - 1];
  if (!simulationData) return <div className="p-6 text-sm leading-7 text-[var(--ar-text-muted)]">코드를 컴파일하고 실행하면 C·ASM 줄별 데이터 흐름을 확인할 수 있습니다.</div>;
  if (!row || !item) return <div className="p-6 text-sm leading-7 text-[var(--ar-text-muted)]">{line != null && !row ? '선택한 C 줄에 연결된 실행 명령어가 없습니다. 선언·주석·최적화 또는 매핑 정보 누락으로 명령어가 없을 수 있습니다.' : 'C 줄이나 ASM 명령어를 선택하거나 한 클록 진행하세요. 선택한 줄의 해설이 제공되지 않으면 실행 경로를 추정하지 않습니다.'}</div>;
  return <div className="ar-tutor @container min-h-0 overflow-y-auto p-4 text-[var(--ar-text-primary)]">
    <div className="mx-auto max-w-[1180px] space-y-4">
      <section className="rounded-lg border border-[var(--ar-border)] bg-[var(--ar-header-bg)] p-3">
        {context?.source != null && context.onSelectAsm && mappedLines.length > 1 && <label className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--ar-text-muted)]">
          다른 C 줄 보기
          <select aria-label="설명할 C 줄 선택" value={sourceLine ?? ''} className="min-w-0 max-w-full rounded-md border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] px-2 py-1.5 text-[var(--ar-text-primary)]"
            onChange={event => {const selected = Number(event.target.value); const index = rows.findIndex(value => value.sourceLine === selected); if (index >= 0) context.onSelectAsm?.(selected, index);}}>
            {sourceLine == null && <option value="">C 위치 없는 명령어</option>}
            {mappedLines.map(number => <option key={number} value={number}>L{number} · {sourceLines[number - 1]?.trim().slice(0, 90) ?? '소스 텍스트 미제공'}</option>)}
          </select>
        </label>}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <strong>{sourceLine != null ? `C ${sourceLine}줄 → ASM ${siblings.length}개` : 'C 위치가 없는 명령어'}</strong>
          <span className="text-[var(--ar-text-muted)]">{flow.actual ? `현재 실행 · Step ${flow.historyIndex + 1} · CORE clock ${currentData?.clock}` : '선택 명령어의 의미 · 현재 클록의 실행값과 구분'}</span>
        </div>
        {source && <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-6">{source}</pre>}
        <div className="mt-3 flex flex-wrap gap-2" aria-label="선택 C 줄의 ASM 명령어">{siblings.map(sibling => <button type="button" key={sibling.index}
          onClick={() => context?.onSelectAsm?.(sibling.sourceLine, sibling.index)} disabled={!context?.onSelectAsm}
          aria-pressed={sibling.index === selectedIndex} className={`rounded-md border px-3 py-2 text-left font-mono text-xs ${sibling.index === selectedIndex ? 'border-[var(--ar-accent)] bg-[var(--ar-panel-bg)] text-[var(--ar-accent)]' : 'border-[var(--ar-border)] text-[var(--ar-text-muted)]'}`}>
          <span className="mr-2 opacity-60">{sibling.index + 1}</span>{sibling.text}
        </button>)}</div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-sm font-semibold">{row.text} <span className="ml-2 text-xs font-normal text-[var(--ar-text-muted)]">PC {row.pc}</span></h3>
        {!flow.actual && target != null && context?.onJumpToCycle && <button type="button" className="rounded-md bg-[var(--ar-accent)] px-3 py-2 text-xs text-white" onClick={() => context.onJumpToCycle?.(target + 1)}>이 명령어의 실행 시점으로 이동</button>}
      </div>
      <p className="text-[13px] leading-7"><TutorText text={item.explanation.summary}/></p>
      {simulationData.simulator.mode === 'single' ? <SingleInstructionFlow key={`${row.pc}-${flow.historyIndex}-${context?.flowDurationMs}`} flow={flow} duration={context?.flowDurationMs} onPause={context?.onPausePlayback}/> : <p className="rounded-lg border border-[var(--ar-border)] p-3 text-xs leading-6">파이프라인은 기존 단계별 시각화에서 확인하세요.</p>}
    </div>
  </div>;
}
