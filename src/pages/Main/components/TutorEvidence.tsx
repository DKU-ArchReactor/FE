import TutorDetailPages from './TutorDetailPages';
import {tutorInstructionDetails} from '../utils/tutorInstructionDetails';
import type { TutorBundle, TutorInstruction } from '../utils/tutorAnalysis';
import {tutorReadingText} from '../utils/tutorReadable';

export function TutorText({text}: {text: string}) {
  const tokens = tutorReadingText(text).split(/(\b(?:0x[\da-f]+|x(?:[12]?\d|3[01])|a[0-7]|s(?:\d|1[01])|t[0-6]|sp|fp|ra|gp|tp|zero|PC|MEM(?:8|16|32))\b)/gi);
  return <>{tokens.map((token, index) => index % 2 === 1
    ? <code key={index} className="rounded bg-[var(--ar-header-bg)] px-1 py-0.5 font-mono text-[0.95em] text-[var(--ar-text-primary)] break-all">{token}</code>
    : token)}</>;
}

export function TutorInstructionEvidence({item,bundle,historyIndex,focused=false}:{item?:TutorInstruction;bundle?:TutorBundle;historyIndex?:number;focused?:boolean}){
  if(!item)return null;
  const {pages:detailPages,observations,valueNotice}=tutorInstructionDetails(item,bundle,historyIndex);
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
    <TutorDetailPages title="자세히 보기" context={item.text} pages={detailPages}/>

  </div>;
}

export function TutorCycleEvidence({ bundle, historyIndex,compact=false }: { bundle?: TutorBundle; historyIndex?: number;compact?:boolean }) {
  const step = bundle?.execution_steps?.find(item => item.history_index === historyIndex);
  if (!step) return null;
  const events = bundle?.cycle_explanations?.find(item => item.history_index === historyIndex)?.events ?? [];
  if(compact)return <TutorDetailPages title="현재 클록의 실제 상태 변화" context={`Step ${step.display_clock} · 실제 상태 변화`} pages={[{title:'현재 클록의 실제 상태 변화',blocks:[
    {text:`Step ${step.display_clock} · CORE clock ${step.cycle} · 완료 PC ${step.retired_pc??'없음'}`},
    ...step.register_changes.map(change=>({label:`레지스터 ${change.key}`,text:`${String(change.before??'미제공')} → ${String(change.after)}`})),
    ...step.memory_changes.map(change=>({label:`메모리 ${change.key}`,text:`${String(change.before??'미제공')} → ${String(change.after)}`})),
    ...(!step.register_changes.length&&!step.memory_changes.length?[{text:'레지스터·메모리 값 변화 없음'}]:[]),
    ...(step.memory_transfer?[{label:step.memory_transfer.memory_operation==='load'?'메모리 읽기':'메모리 쓰기',text:`주소 ${String(step.memory_transfer.target_address??'미제공')} · 값 ${String((step.memory_transfer.memory_operation==='load'?step.memory_transfer.read_data:step.memory_transfer.write_data)??'미제공')}`}]:[]),
    ...events.map(event=>({label:event.title,text:event.detail})),
  ]}]}/>;
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
