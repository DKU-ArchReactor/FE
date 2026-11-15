import type {TutorBundle} from '../utils/tutorAnalysis';

export default function TutorPerformanceSummary({bundle, historyIndex}: {bundle?: TutorBundle; historyIndex?: number}) {
  const analysis = bundle?.performance_analysis;
  const snapshot = analysis?.snapshots.find(item => item.history_index === historyIndex);
  if (!analysis || !snapshot || historyIndex == null) return null;
  const priorities = {stall: 3, flush: 2, forwarding: 1};
  const groups = new Map<string, {pc: string | null; assembly: string | null; line: number | null; stalls: number; flushes: number; forwards: number; detail: string; priority: number}>();
  for (const record of analysis.records) {
    if (record.history_index > historyIndex) continue;
    const actor = record.instruction;
    const key = actor.pc ?? `unknown-${actor.assembly ?? ''}`;
    const group = groups.get(key) ?? {pc: actor.pc, assembly: actor.assembly, line: actor.source_line, stalls: 0, flushes: 0, forwards: 0, detail: '', priority: 0};
    if (record.kind === 'stall') group.stalls++;
    if (record.kind === 'flush') group.flushes++;
    if (record.kind === 'forwarding') group.forwards++;
    if (priorities[record.kind] >= group.priority) {
      group.detail = record.detail;
      group.priority = priorities[record.kind];
    }
    groups.set(key, group);
  }
  const hotspots = [...groups.values()].sort((left, right) => right.stalls - left.stalls || right.flushes - left.flushes || right.forwards - left.forwards).slice(0, 3);
  return <div className="ar-tutor text-[var(--ar-text-muted)]">
    <details className="tutor-disclosure text-xs leading-6">
      <summary className="cursor-pointer text-xs font-semibold text-[var(--ar-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--ar-accent)]">CPI와 해저드 분석</summary>
      <div className="space-y-3">
        <p className="text-[var(--ar-text-primary)]">선택한 시점까지 {snapshot.cycles}클록을 실행했습니다. {snapshot.completed != null ? `완료 명령어는 ${snapshot.completed}개입니다.` : '완료 명령어 수는 제공되지 않았습니다.'}
          {snapshot.cpi != null && ` CPI는 ${snapshot.cycles} ÷ ${snapshot.completed} = ${snapshot.cpi.toFixed(2)}클록/명령어입니다.`}</p>
        <dl className="grid grid-cols-2 gap-2 rounded-md bg-[var(--ar-header-bg)] p-3">
          <div><dt>스톨 관찰</dt><dd className="font-mono font-semibold text-[var(--ar-text-primary)]">{snapshot.stall_cycles}클록</dd></div>
          <div><dt>플러시 관찰</dt><dd className="font-mono font-semibold text-[var(--ar-text-primary)]">{snapshot.flush_cycles}클록</dd></div>
          <div><dt>같은 클록에서 겹침</dt><dd className="font-mono">{snapshot.overlap_cycles}클록</dd></div>
          <div><dt>중복 제외 관찰</dt><dd className="font-mono">{snapshot.hazard_cycles}클록</dd></div>
          <div><dt>포워딩 관찰</dt><dd className="font-mono">{snapshot.forwarding_cycles}클록</dd></div>
          <div><dt>명령어 완료 없음</dt><dd className="font-mono">{snapshot.idle_cycles}클록</dd></div>
        </dl>
        {snapshot.extra_cycles != null && <p>매 클록 1개 완료를 기준으로 총 클록과 완료 명령어 수의 차이는 {snapshot.extra_cycles}클록입니다. 파이프라인 초기 채우기·종료 비우기와 대기 등의 영향을 함께 확인해야 합니다.</p>}
        <p>완료가 없는 클록 중 스톨·플러시가 함께 관찰된 시점은 {snapshot.hazard_idle_cycles}클록, 해당 표시가 없는 시점은 {snapshot.other_idle_cycles}클록입니다.</p>
        {snapshot.unknown_completion_cycles > 0 && <p>완료 카운터를 확인할 수 없는 {snapshot.unknown_completion_cycles}클록은 완료 없음 집계에서 제외했습니다.</p>}
        {hotspots.length > 0 && <section aria-label="명령어별 해저드 관찰" className="space-y-2">
          <h4 className="font-semibold text-[var(--ar-text-primary)]">대기·플러시가 많은 명령어부터 최대 3개</h4>
          {hotspots.map((item, index) => <div key={item.pc ?? index} className="space-y-1 border-t border-[var(--ar-border)] pt-2">
            <p className="font-mono break-all text-[var(--ar-text-primary)]">{item.pc ?? 'PC 미제공'} · {item.assembly ?? '명령어 미제공'}</p>
            <p>{item.line != null && `C L${item.line} · `}스톨 {item.stalls} · 플러시 {item.flushes} · 포워딩 {item.forwards}클록</p>
            <details><summary className="cursor-pointer font-medium text-[var(--ar-text-primary)]">주요 관찰 원인</summary><p className="pt-2">{item.detail}</p></details>
          </div>)}
        </section>}
        <ul className="space-y-1 border-t border-[var(--ar-border)] pt-2">{analysis.notes.map(note => <li key={note}>{note}</li>)}</ul>
      </div>
    </details>
  </div>;
}
