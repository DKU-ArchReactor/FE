import { memo } from 'react';
import type { TutorBundle, TutorInstruction } from '../utils/tutorAnalysis';

type Observation = {history_index: number; step: number; cycle?: number; summary: string; kind?: string};
type HazardRecord = NonNullable<TutorBundle['performance_analysis']>['records'][number];
type InstructionHistory = {stages: Map<string, Observation[]>; completions: {history_index: number}[]; hazards: HazardRecord[]};
// Run payloads are immutable; replacing a run creates a separate, GC-managed index.
const evidenceIndexes = new WeakMap<TutorBundle, {instructions: Map<number, InstructionHistory>; firstCompletion?: number}>();

function evidenceIndex(bundle: TutorBundle) {
  const cached = evidenceIndexes.get(bundle);
  if (cached) return cached;
  const instructions = new Map<number, InstructionHistory>();
  let firstCompletion: number | undefined;
  const entry = (pc: string | null | undefined) => {
    const address = Number.parseInt(pc ?? '', 16);
    if (!Number.isFinite(address)) return undefined;
    let value = instructions.get(address);
    if (!value) {
      value = {stages: new Map(), completions: [], hazards: []};
      instructions.set(address, value);
    }
    return value;
  };
  for (const step of bundle.execution_steps ?? []) {
    if (step.retired_pc !== undefined) {
      firstCompletion = Math.min(firstCompletion ?? Infinity, step.history_index);
      entry(step.retired_pc)?.completions.push({history_index: step.history_index});
    }
    for (const observation of step.instruction_observations ?? []) {
      const instruction = entry(observation.pc);
      if (!instruction) continue;
      const values = instruction.stages.get(observation.stage) ?? [];
      values.push({history_index: step.history_index, step: step.display_clock, cycle: step.cycle,
        summary: observation.summary, kind: observation.kind});
      instruction.stages.set(observation.stage, values);
    }
  }
  for (const record of bundle.performance_analysis?.records ?? []) entry(record.instruction.pc)?.hazards.push(record);
  for (const instruction of instructions.values()) {
    for (const values of [...instruction.stages.values(), instruction.completions, instruction.hazards]) {
      values.sort((a, b) => a.history_index - b.history_index);
    }
  }
  const index = {instructions, firstCompletion};
  evidenceIndexes.set(bundle, index);
  return index;
}

function prefixLength(values: {history_index: number}[], historyIndex: number) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (values[middle].history_index <= historyIndex) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function TutorText({text}: {text: string}) {
  const tokens = text.split(/(\b(?:0x[\da-f]+|x(?:[12]?\d|3[01])|a[0-7]|s(?:\d|1[01])|t[0-6]|sp|fp|ra|gp|tp|zero|PC|MEM(?:8|16|32))\b)/gi);
  return <>{tokens.map((token, index) => index % 2 === 1
    ? <code key={index} className="rounded bg-[var(--ar-header-bg)] px-1 py-0.5 font-mono text-[0.95em] text-[var(--ar-text-primary)] break-all">{token}</code>
    : token)}</>;
}

const MAPPING_LABELS: Record<string, string> = {
  elf_dwarf: 'ELF 디버그 정보 (DWARF)',
  provided_code_mapping: 'CORE 코드 매핑',
  instruction_table_without_source_lines: '정적 명령어 테이블',
  none: '소스 매핑 근거 없음',
};

const TutorTeaching = memo(function TutorTeaching({teaching}: {teaching: TutorInstruction['teaching']}) {
  return <>
    {teaching && <details className="border-t border-[var(--ar-border)] pt-2">
      <summary className="cursor-pointer py-1 text-xs font-semibold text-[var(--ar-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--ar-accent)]">처리 순서와 항목별 역할</summary>
      <div className="space-y-3 pt-2">
      {!!teaching.walkthrough?.length && <section aria-label="명령어 한눈에 읽기" className="rounded-lg border border-[var(--ar-border)] bg-[var(--ar-header-bg)] p-3">
        <h4 className="mb-3 text-xs font-semibold text-[var(--ar-text-primary)]">이 명령어를 읽는 순서</h4>
        <ol className="grid gap-3 @sm:grid-cols-3">
          {teaching.walkthrough.map((step, index) => <li key={step.title} className="min-w-0 rounded-md border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-[var(--ar-text-primary)]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ar-accent)] text-white">{index + 1}</span>
              {step.title}
            </div>
            <p className="text-xs leading-6"><TutorText text={step.text} /></p>
          </li>)}
        </ol>
      </section>}
      {teaching.operand_roles.length > 0 && <div className="overflow-hidden rounded-md border border-[var(--ar-border)]">
        <table className="w-full table-fixed border-collapse text-left text-xs leading-6">
          <thead className="bg-[var(--ar-header-bg)] text-[var(--ar-text-primary)]">
            <tr><th scope="col" className="w-[30%] px-3 py-2 font-semibold">명령어의 항목</th><th scope="col" className="px-3 py-2 font-semibold">역할</th></tr>
          </thead>
          <tbody>
            {teaching.operand_roles.map(operand => <tr key={operand.operand + operand.role} className="border-t border-[var(--ar-border)] align-top">
              <th scope="row" className="px-3 py-2 font-mono font-medium text-[var(--ar-text-primary)] break-all">{operand.operand}</th>
              <td className="px-3 py-2">{operand.role}</td>
            </tr>)}
          </tbody>
        </table>
      </div>}
      {teaching.principle && <p className="border-l-2 border-[var(--ar-border)] pl-3 text-[var(--ar-text-primary)]"><TutorText text={teaching.principle} /></p>}
      {teaching.register_connections.length > 0 && <div className="space-y-2">
        <strong className="block text-xs font-semibold text-[var(--ar-text-primary)]">같은 C 줄의 정적 레지스터 연결</strong>
        {teaching.register_connections.map(connection => <div key={connection.register} className="flex flex-wrap items-baseline gap-x-2 rounded-md bg-[var(--ar-header-bg)] px-3 py-2">
          <code className="font-semibold text-[var(--ar-text-primary)]">{connection.register}</code>
          <span aria-label="앞선 기록 명령어">←</span>
          <code className="break-all">{connection.text}</code>
          <span className="font-mono text-[10px] text-[var(--ar-text-muted)]">PC {connection.pc}</span>
        </div>)}
      </div>}

      </div>
    </details>}
      {!!teaching?.concepts?.length && <details className="border-t border-[var(--ar-border)] pt-2">
        <summary className="cursor-pointer py-1 text-xs font-semibold text-[var(--ar-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--ar-accent)]">관련 핵심 개념 · {teaching.concepts.length}개</summary>
        <section aria-label="관련 RISC-V 핵심 개념" className="space-y-2 pt-2">
        <p className="text-xs">개념과 예제를 참고할 수 있습니다. 예제의 숫자는 현재 실행값과 별개입니다.</p>
        {teaching?.concepts.map(concept => <details key={concept.id} className="tutor-concept">
          <summary className="cursor-pointer font-semibold text-[var(--ar-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--ar-accent)]">{concept.title}</summary>
          <div className="space-y-3 pt-3">
            <p className="font-medium text-[var(--ar-text-primary)]"><TutorText text={concept.plain ?? concept.explanation} /></p>
            <div className="rounded-md bg-[var(--ar-header-bg)] px-3 py-2">
              <strong className="block text-xs text-[var(--ar-text-primary)]">학습 예제</strong>
              <p><TutorText text={concept.example} /></p>
            </div>
            <div className="border-l-2 border-[var(--ar-accent)] pl-3">
              <strong className="block text-xs text-[var(--ar-text-primary)]">헷갈리기 쉬운 점</strong>
              <p><TutorText text={concept.question} /></p>
              <p className="pt-2"><TutorText text={concept.answer} /></p>
            </div>
            {concept.plain && <details className="border-t border-[var(--ar-border)] pt-2">
              <summary className="cursor-pointer text-xs font-semibold text-[var(--ar-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--ar-accent)]">원리와 주의사항 더 보기</summary>
              <p className="pt-2"><TutorText text={concept.explanation} /></p>
            </details>}
            <ul aria-label="개념 참고 자료" className="space-y-1 border-t border-[var(--ar-border)] pt-2 text-xs">
              {concept.sources.filter(source => source.url.startsWith('https://')).map(source => <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-[var(--ar-accent)] underline underline-offset-2">{source.title} <span className="sr-only">(새 탭)</span></a>
              </li>)}
            </ul>
          </div>
        </details>)}
        </section>
      </details>}
  </>;
});

export function TutorInstructionEvidence({ item, bundle, historyIndex, focused = false }: {
  item?: TutorInstruction; bundle?: TutorBundle; historyIndex?: number; focused?: boolean;
}) {
  if (!item) return null;
  const observations = new Map<string, Observation>();
  const index = bundle ? evidenceIndex(bundle) : undefined;
  const evidence = index?.instructions.get(Number.parseInt(item.pc ?? '', 16));
  const selectedIndex = historyIndex ?? -1;
  const confirmedCompletions = prefixLength(evidence?.completions ?? [], selectedIndex);
  const hasCompletionEvidence = index?.firstCompletion != null && index.firstCompletion <= selectedIndex;
  for (const [stage, values] of evidence?.stages ?? []) {
    const count = prefixLength(values, selectedIndex);
    if (count > 0) observations.set(stage, values[count - 1]);
  }
  let valueNotice = '선택한 시점까지 이 명령어의 값 처리 기록이 없습니다.';
  const records = evidence?.hazards ?? [];
  const hazardRecords = records.slice(0, prefixLength(records, selectedIndex));
  if (historyIndex === undefined || historyIndex < 0) {
    valueNotice = '실행 전 상태입니다. 스텝을 진행하면서 이 명령어의 실제 값 처리 이력을 확인할 수 있습니다.';
  } else if (confirmedCompletions > 0) {
    valueNotice = '명령어 완료는 확인됐으며, 이 명령어의 별도 연산값·메모리 접근값은 제공되지 않았습니다.';
  } else if (item.retire_count === 0) {
    valueNotice = '전체 실행에서 이 명령어의 완료 기록이 없습니다. 실행 경로·취소 여부·실행 종료 상태를 함께 확인하세요.';
  }
  return <div className="text-[13px] leading-6 space-y-2 text-[var(--ar-text-muted)] break-words">
    {[...observations].filter(([stage, observation]) => stage !== 'WB' && observation.kind !== 'address').map(([stage, observation]) => <div key={stage} className="overflow-hidden rounded-md border border-[var(--ar-border)] border-l-2 border-l-emerald-500">
      <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-3 py-1.5">
        <strong className="text-xs font-semibold text-[var(--ar-text-primary)]">실제 실행</strong>
        <span className="font-mono text-[11px] text-[var(--ar-text-muted)]">Step {observation.step} · {observation.cycle != null && `CORE clock ${observation.cycle} · `}{stage}</span>
      </div>
      <p className="px-3 py-2 text-[var(--ar-text-primary)]"><TutorText text={observation.summary} /></p>
    </div>)}
    {focused && observations.size === 0 && <p className="rounded-lg bg-[var(--ar-header-bg)] px-3 py-2 text-[11px] leading-6">
      {valueNotice}
    </p>}
    <details className="tutor-disclosure tutor-instruction-details">
      <summary className="cursor-pointer py-1 text-xs font-semibold text-[var(--ar-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--ar-accent)]">자세히 보기<span className="tutor-disclosure-state" aria-hidden="true" /></summary>
      <div className="space-y-2 pt-2">
        {hazardRecords.length > 0 && <details className="border-t border-[var(--ar-border)] pt-2">
          <summary className="cursor-pointer py-1 text-xs font-semibold text-[var(--ar-text-primary)]">이 명령어의 해저드 관찰</summary>
          <p className="pt-2">선택한 시점까지 스톨 {hazardRecords.filter(record => record.kind === 'stall').length}클록 · 플러시 {hazardRecords.filter(record => record.kind === 'flush').length}클록 · 포워딩 {hazardRecords.filter(record => record.kind === 'forwarding').length}클록</p>
          <div className="space-y-2 pt-2">{hazardRecords.slice(-5).map(record => <p key={`${record.history_index}-${record.kind}`}><span className="font-mono text-[11px]">Step {record.history_index + 1} · </span><TutorText text={record.detail} /></p>)}</div>
          {hazardRecords.length > 5 && <p className="pt-2 text-xs">최근 5건의 원인을 표시합니다.</p>}
        </details>}
        <TutorTeaching teaching={item.teaching} />
    <details className="border-t border-[var(--ar-border)] pt-2">
    <summary className="cursor-pointer py-1 text-xs font-semibold text-[var(--ar-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--ar-accent)]">매핑·레지스터 정보</summary>
    <div className="space-y-2 pt-2 text-xs leading-6">
    {[...observations].filter(([stage, observation]) => stage === 'WB' || observation.kind === 'address').map(([stage, observation]) => <div key={stage} className="rounded-md bg-[var(--ar-header-bg)] px-3 py-2">
      <p className="font-mono text-[10px] text-[var(--ar-text-muted)]">Step {observation.step} · {observation.cycle != null && `CORE clock ${observation.cycle} · `}{stage}</p>
      <p><TutorText text={observation.summary} /></p>
    </div>)}
    <div className="grid gap-x-4 gap-y-1 @sm:grid-cols-2">
    <p className="font-mono break-all">PC {item.pc}</p>
    <p className="font-mono break-all">원본 기계어 {item.raw_instruction ?? '미제공'}</p>
    <p>{item.function ?? '함수 미확인'} · {item.source_file ?? '파일 미확인'}
      {item.source_line != null ? `:${item.source_line}:${item.source_column ?? '?'}` : ' · 소스 위치 미확인'}</p>
    <p>매핑 근거 {MAPPING_LABELS[item.mapping_basis ?? ''] ?? '미제공'}</p>
    <p>읽기: {item.explanation.reads ? item.explanation.reads.join(', ') || '없음' : '미제공'} · 쓰기: {item.explanation.writes ? item.explanation.writes.join(', ') || '없음' : '미제공'}</p>
    {item.retire_count != null && <p>전체 실행 완료 {item.retire_count}회 · {item.observed_in_history ? '실행 이력에 관찰됨' : '실행 이력에 관찰되지 않음'}</p>}
    {hasCompletionEvidence && <p>선택한 클록까지 확인된 완료 {confirmedCompletions}회</p>}
    </div>
    </div>
    </details>
      </div>
    </details>
  </div>;
}

export function TutorCycleEvidence({ bundle, historyIndex }: { bundle?: TutorBundle; historyIndex?: number }) {
  const step = bundle?.execution_steps?.find(item => item.history_index === historyIndex);
  if (!step) return null;
  const events = bundle?.cycle_explanations?.find(item => item.history_index === historyIndex)?.events ?? [];
  return <div className="rounded-lg border border-[var(--ar-border)] p-4 text-[13px] leading-7 space-y-3 text-[var(--ar-text-muted)] break-words">
    <strong>현재 클록의 실제 상태 변화</strong>
    <p className="font-mono text-[11px] text-[var(--ar-text-muted)]">Step {step.display_clock} · CORE clock {step.cycle} · 완료 PC {step.retired_pc ?? '없음'}</p>
    {step.register_changes.map(change => <p key={change.key} className="rounded-md bg-[var(--ar-header-bg)] px-3 py-1 font-mono break-all">레지스터 {change.key}: {String(change.before ?? '미제공')} → {String(change.after)}</p>)}
    {step.memory_changes.map(change => <p key={change.key} className="rounded-md bg-[var(--ar-header-bg)] px-3 py-1 font-mono break-all">메모리 {change.key}: {String(change.before ?? '미제공')} → {String(change.after)}</p>)}
    {!step.register_changes.length && !step.memory_changes.length && <p>레지스터·메모리 값 변화 없음</p>}
    {step.memory_transfer && <p>
      {step.memory_transfer.memory_operation === 'load' ? '메모리 읽기' : '메모리 쓰기'} · 주소 {String(step.memory_transfer.target_address ?? '미제공')} · 값 {String(
        (step.memory_transfer.memory_operation === 'load' ? step.memory_transfer.read_data : step.memory_transfer.write_data) ?? '미제공')}
    </p>}
    {events.map((event, index) => <div key={`${event.type}-${index}`} className="border-t border-[var(--ar-border)] pt-3 space-y-1">
      <strong className="block text-[var(--ar-text-primary)]">{event.title}</strong>
      <p><TutorText text={event.detail} /></p>
    </div>)}
    <p>정적 명령어의 의미와 관찰된 값 변화를 구분합니다.</p>
  </div>;
}
