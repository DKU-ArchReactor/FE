import type { TutorBundle, TutorInstruction } from '../utils/tutorAnalysis';

export function TutorInstructionEvidence({ item }: { item?: TutorInstruction }) {
  if (!item) return null;
  return <div className="text-[11px] space-y-1 text-[var(--ar-text-secondary)]">
    <p>PC {item.pc} · {item.function ?? '함수 미확인'} · {item.source_file ?? '파일 미확인'}
      {item.source_line != null ? `:${item.source_line}:${item.source_column ?? '?'}` : ' · 소스 위치 미확인'}</p>
    <p>읽기: {item.explanation.reads?.join(', ') || '없음'} · 쓰기: {item.explanation.writes?.join(', ') || '없음'}</p>
    {item.retire_count != null && <p>전체 실행 완료 {item.retire_count}회 · {item.observed_in_history ? '실행 이력에 관찰됨' : '실행 이력에 관찰되지 않음'}</p>}
    {item.explanation.notes?.map(note => <p key={note}>{note}</p>)}
  </div>;
}

export function TutorCycleEvidence({ bundle, historyIndex }: { bundle?: TutorBundle; historyIndex?: number }) {
  const step = bundle?.execution_steps?.find(item => item.history_index === historyIndex);
  if (!step) return null;
  return <div className="rounded-lg border border-[var(--ar-border)] p-2.5 text-[11px] space-y-1">
    <strong>현재 클록의 실제 상태 변화</strong>
    <p>Clock {step.display_clock} · 원본 clock {step.cycle} · 완료 PC {step.retired_pc ?? '없음'}</p>
    {step.register_changes.map(change => <p key={change.key}>레지스터 {change.key}: {String(change.before ?? '미제공')} → {String(change.after)}</p>)}
    {step.memory_changes.map(change => <p key={change.key}>메모리 {change.key}: {String(change.before ?? '미제공')} → {String(change.after)}</p>)}
    {!step.register_changes.length && !step.memory_changes.length && <p>레지스터·메모리 값 변화 없음</p>}
    {step.memory_transfer && <pre className="whitespace-pre-wrap break-all">{JSON.stringify(step.memory_transfer, null, 2)}</pre>}
    <p>정적 명령어의 의미와 관찰된 값 변화를 구분합니다.</p>
  </div>;
}
