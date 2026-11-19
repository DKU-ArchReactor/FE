import {useEffect, useState} from 'react';
import {displayValue, registerLabel, type FlowUnit, type buildInstructionFlow} from '../utils/instructionFlow';
import InstructionFlowDiagram from './InstructionFlowDiagram';
import {TutorText} from './TutorEvidence';
import './SingleInstructionFlow.css';

export default function SingleInstructionFlow({flow, duration = 3600, onPause}: {flow: ReturnType<typeof buildInstructionFlow>; duration?: number; onPause?: () => void}) {
  const [view, setView] = useState({selected: -1, phase: 0, replay: 0, duration});
  useEffect(() => {
    if (view.selected >= 0) return;
    const timers = Array.from({length: flow.steps.length - 1}, (_, index) => window.setTimeout(() => setView(value => ({...value, phase: index + 1})), (index + 1) * view.duration / flow.steps.length));
    return () => timers.forEach(window.clearTimeout);
  }, [view.selected, view.replay, view.duration, flow.steps.length]);
  const choose = (index: number) => {onPause?.(); setView(value => ({...value, selected: index, phase: index, replay: value.replay + 1, duration: 2000}));};
  const unit = (id: FlowUnit) => {
    const preferred = {cu: 'decode', registers: 'read', alu: 'execute', memory: flow.load || flow.store ? 'memory' : 'decode', pc: 'commit'}[id];
    choose(Math.max(0, flow.steps.findIndex(value => value.id === preferred)));
  };
  const current = flow.steps[view.phase];
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-[var(--ar-text-muted)]">움직이는 점과 숫자를 따라가세요. 다시 보기는 현재 클록에서 멈춰 설명합니다.</p><button type="button" className="rounded-md border border-[var(--ar-border)] px-3 py-2 text-xs font-semibold" onClick={() => {onPause?.(); setView(value => ({selected: -1, phase: 0, replay: value.replay + 1, duration: 5000}));}}>천천히 다시 보기</button></div>
    <div className="grid items-start gap-3 @4xl:grid-cols-[minmax(0,1.7fr)_minmax(230px,1fr)]">
      <div className="min-w-0 overflow-x-auto rounded-lg border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] p-2"><div className="h-[clamp(400px,calc(100dvh-430px),650px)] min-w-[500px]"><InstructionFlowDiagram flow={flow} step={view.selected} replay={view.replay} duration={view.duration} onUnit={unit}/></div></div>
      <div className="space-y-3"><nav className="flex flex-wrap gap-1.5" aria-label="한 클록의 동작 설명 순서">{flow.steps.map((step, i) => <button key={step.id} type="button" aria-pressed={view.phase === i} onClick={() => choose(i)} className={`rounded border px-2 py-1.5 text-xs ${view.phase === i ? 'border-[var(--ar-accent)] bg-[var(--ar-header-bg)] text-[var(--ar-accent)] font-semibold' : 'border-[var(--ar-border)] text-[var(--ar-text-muted)]'}`}>{i + 1}. {step.title}</button>)}</nav>
        <section aria-label="현재 동작 상세" className="rounded-lg border border-[var(--ar-border)] border-l-3 border-l-[var(--ar-accent)] bg-[var(--ar-header-bg)] p-4"><h4 className="mb-2 text-sm font-semibold">{view.phase + 1}. {current.title}</h4><p className="text-[13px] leading-7"><TutorText text={current.description}/></p></section>
        <section aria-label="입력과 기록 결과" className="rounded-lg border border-[var(--ar-border)] p-3 text-xs leading-6"><h4 className="mb-2 font-semibold">이 클록에서 관찰된 값</h4>{flow.registerInputs.map(value => <p key={value.name}>{registerLabel(value.name)}: <code>{displayValue(value.value)}</code></p>)}{!flow.system && !flow.jump && <p>ALU 결과: <code>{displayValue(flow.result)}</code></p>}{flow.writes.length > 0 && <p>기록: {flow.writes.map(registerLabel).join(', ')} ← <code>{displayValue(flow.writeValue)}</code></p>}{(flow.load || flow.store) && <p>메모리 {flow.width / 8}바이트 {flow.load ? '읽기' : '쓰기'}: <code>{flow.address ?? '미제공'} · {displayValue(flow.memoryValue)}</code></p>}</section>
        <details className="rounded-lg border border-[var(--ar-border)] p-3 text-xs leading-6"><summary className="cursor-pointer font-semibold">CU가 선택한 제어 신호</summary>{flow.controlSignals ? <dl className="mt-2 grid grid-cols-2 gap-2 font-mono">{Object.entries(flow.controlSignals).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === 'boolean' ? Number(value) : value}</dd></div>)}</dl> : <p className="mt-2">실제 제어 신호가 제공되지 않았습니다.</p>}</details>
        {flow.error && <p role="alert" className="text-xs text-red-600">실행 오류: {flow.error.message ?? flow.error.code}. 확인되지 않은 기록값은 표시하지 않습니다.</p>}
      </div>
    </div>
    <p className="text-[11px] leading-5 text-[var(--ar-text-muted)]">파란 실선과 이동점은 데이터, 보라 점선은 제어 신호입니다. 한 클록 안의 동작을 이해하기 위한 느린 설명이며, 단계별 시간이 실제 하드웨어 지연이나 추가 클록을 뜻하지 않습니다. 명령어 메모리와 데이터 메모리는 역할을 나누어 그렸습니다.</p>
  </div>;
}
