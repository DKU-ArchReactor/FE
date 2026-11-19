import {useEffect, useMemo, useState} from 'react';
import type {CycleHistoryItem, SimulationResult} from '@/type/simulation';
import type {MappedAssemblyRow} from '../utils/translationCompile';
import {instructionAt} from '../utils/tutorAnalysis';
import {buildInstructionFlow, displayValue, instructionPc, numericPc, registerLabel, type FlowUnit} from '../utils/instructionFlow';
import InstructionFlowDiagram from './InstructionFlowDiagram';
import InstructionFormat from './InstructionFormat';
import {TutorInstructionEvidence, TutorText} from './TutorEvidence';
import './TutorTypography.css';

export interface InstructionLessonContext {
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
  includeTutor?: boolean;
}

function FlowExplanation({flow}: {flow: ReturnType<typeof buildInstructionFlow>}) {
  const [progress, setProgress] = useState({step: -1, playing: false});
  useEffect(() => {
    if (!progress.playing) return;
    const timer = window.setInterval(() => setProgress(previous => previous.step >= flow.steps.length - 1
      ? {...previous, playing: false} : {...previous, step: previous.step + 1}), 1100);
    return () => window.clearInterval(timer);
  }, [progress.playing, flow.steps.length]);
  const choose = (step: number) => setProgress({step, playing: false});
  const chooseUnit = (unit: FlowUnit) => {
    const memory = unit === 'memory' ? flow.steps.findIndex(step => step.id === 'memory') : -1;
    choose(memory >= 0 ? memory : Math.max(0, flow.steps.findIndex(step => step.units.includes(unit))));
  };
  const selected = progress.step < 0 ? {title: '이 명령어가 사용하는 경로', description: flow.system
    ? '명령어를 해석한 뒤 실행 환경 서비스를 요청합니다. 일반 ALU 연산과 데이터 메모리 Load/Store 경로는 사용하지 않습니다.'
    : flow.load ? 'CU의 해석 → 기준 레지스터와 오프셋으로 주소 계산 → 메모리 읽기 → 목적지 레지스터 기록 순서로 살펴보세요.'
    : flow.store ? 'CU의 해석 → 기준 레지스터와 오프셋으로 주소 계산 → 별도로 읽은 데이터를 메모리에 저장합니다. 결과 레지스터 기록은 없습니다.'
    : flow.branch || flow.jump ? '이동 목적지와 다음 PC를 따라가세요. 점프의 복귀 주소 기록은 일반 ALU 결과와 별개의 경로입니다.'
    : 'CU가 동작을 선택하고 입력값이 ALU로 전달됩니다. 연산 결과는 목적지 레지스터로 돌아가며, 데이터 메모리 Load/Store는 없습니다.'} : flow.steps[progress.step];
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold">데이터가 이동하는 순서</h4>
      <button type="button" className="rounded-md border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] px-3 py-1.5 text-xs hover:bg-[var(--ar-header-bg)]"
        onClick={() => setProgress(previous => ({step: previous.step < 0 || previous.step === flow.steps.length - 1 ? 0 : previous.step, playing: !previous.playing}))}>
        {progress.playing ? '설명 일시정지' : '흐름 설명 재생'}
      </button>
    </div>
    <div className="flex flex-wrap gap-1.5" aria-label="한 클록의 동작 설명 순서">
      <button type="button" aria-pressed={progress.step < 0} onClick={() => choose(-1)} className={`rounded-md border px-2.5 py-2 text-xs ${progress.step < 0 ? 'border-[var(--ar-accent)] font-semibold text-[var(--ar-accent)]' : 'border-[var(--ar-border)] text-[var(--ar-text-muted)]'}`}>전체 경로</button>
      {flow.steps.map((step, index) => <button type="button" key={step.id} aria-pressed={progress.step === index}
        onClick={() => choose(index)} className={`rounded-md border px-2.5 py-2 text-xs transition-colors ${progress.step === index ? 'border-[var(--ar-accent)] bg-[var(--ar-header-bg)] font-semibold text-[var(--ar-accent)]' : 'border-[var(--ar-border)] text-[var(--ar-text-muted)]'}`}>
        <span className="mr-1.5 font-mono">{index + 1}</span>{step.title}
      </button>)}
    </div>
    <p className="text-[11px] leading-5 text-[var(--ar-text-muted)]">한 명령어가 한 클록 안에서 하는 일을 나눠 설명합니다. 위 번호는 추가 클록이나 파이프라인 단계가 아닙니다.</p>
    <div className="grid items-start gap-4 @4xl:grid-cols-[minmax(0,1.8fr)_minmax(250px,1fr)]">
    <div className="min-w-0 overflow-x-auto rounded-xl border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] p-2">
      <InstructionFlowDiagram flow={flow} step={progress.step} onUnit={chooseUnit}/>
    </div>
    <div className="min-w-0 space-y-3">
    <section aria-label="현재 동작 상세" className="rounded-lg border border-[var(--ar-border)] border-l-3 border-l-[var(--ar-accent)] bg-[var(--ar-header-bg)] p-4">
      <h4 className="mb-2 text-sm font-semibold">{progress.step >= 0 ? `${progress.step + 1}. ` : ''}{selected.title}</h4>
      <p className="text-[13px] leading-7"><TutorText text={selected.description}/></p>
      {flow.error && <p role="alert" className="mt-2 text-sm text-red-600">실행 오류 · {flow.error.message ?? flow.error.code ?? '자세한 오류 미제공'}. 완료가 확인되지 않은 결과는 기록값으로 표시하지 않습니다.</p>}
    </section>
    <div className="grid gap-3">
      <section className="rounded-lg border border-[var(--ar-border)] p-3" aria-label="레지스터와 ALU의 실제 값">
        <h4 className="mb-2 text-xs font-semibold">입력과 기록 결과</h4>
        <dl className="space-y-2 text-xs leading-6">
          {flow.registerInputs.map(input => <div key={input.name} className="flex flex-wrap justify-between gap-x-2"><dt>{registerLabel(input.name)} 읽기</dt><dd className="font-mono">{displayValue(input.value)}</dd></div>)}
          {!flow.system && !flow.jump && <div><dt>ALU 결과</dt><dd className="font-mono">{displayValue(flow.result)}</dd></div>}
          {flow.writes.length > 0 && <div><dt>{flow.writes.map(registerLabel).join(', ')} 기록값</dt><dd className="font-mono">{displayValue(flow.writeValue)}</dd></div>}
          {(flow.load || flow.store) && <div><dt>메모리 주소 · {flow.width / 8}바이트 {flow.load ? '읽기' : '쓰기'}</dt><dd className="font-mono">{flow.address ?? '미제공'} · {displayValue(flow.memoryValue)}</dd></div>}
        </dl>
      </section>
      <section className="rounded-lg border border-[var(--ar-border)] p-3" aria-label="CU 제어 신호">
        <h4 className="mb-2 text-xs font-semibold">CU가 선택한 동작</h4>
        {flow.controlSignals ? <dl className="grid grid-cols-2 gap-2 font-mono text-xs leading-6">
          <div><dt>RegWrite</dt><dd>{Number(flow.controlSignals.reg_write)} · 레지스터 기록</dd></div>
          <div><dt>ALUSrc</dt><dd>{flow.controlSignals.alu_src} · 입력 선택</dd></div>
          <div><dt>MemRead</dt><dd>{Number(flow.controlSignals.mem_read)} · 데이터 읽기</dd></div>
          <div><dt>MemWrite</dt><dd>{Number(flow.controlSignals.mem_write)} · 데이터 쓰기</dd></div>
          <div><dt>Branch / Jump</dt><dd>{Number(flow.controlSignals.branch)} / {Number(flow.controlSignals.jump)}</dd></div>
          <div><dt>PCSrc</dt><dd>{flow.controlSignals.pc_src}</dd></div>
        </dl> : <p className="text-xs leading-6 text-[var(--ar-text-muted)]">선택한 명령어의 실제 제어 신호는 해당 실행 클록에서 표시합니다. 제공되지 않은 값을 0으로 채우지 않습니다.</p>}
      </section>
    </div>
    </div>
    </div>
    <p className="text-[11px] leading-5 text-[var(--ar-text-muted)]">연결선은 선택한 명령어의 논리적인 데이터 경로입니다. 점선은 제어, 실선은 데이터입니다. 실제 단일 버스 회로나 추가 내부 클록을 모사하는 그림은 아닙니다.</p>
  </div>;
}

export default function InstructionLesson({currentData, prevData, simulationData, context, includeTutor = false}: InstructionLessonProps) {
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
      {simulationData.simulator.mode === 'single' ? <FlowExplanation key={`${row.pc}-${flow.historyIndex}`} flow={flow}/> : <p className="rounded-lg border border-[var(--ar-border)] p-3 text-xs leading-6">파이프라인은 기존 단계별 시각화에서 확인하세요. 이 통합 화면은 선택한 C·ASM의 설명과 실행 근거를 함께 보여줍니다.</p>}
      <InstructionFormat format={item.instruction_format}/>
      {includeTutor && <TutorInstructionEvidence item={item} bundle={simulationData.tutor} historyIndex={flow.historyIndex} focused/>}
    </div>
  </div>;
}
