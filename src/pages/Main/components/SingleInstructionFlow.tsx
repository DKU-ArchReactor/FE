import {useEffect, useState} from 'react';
import {singleFlowDuration, type FlowUnit, type buildInstructionFlow} from '../utils/instructionFlow';
import InstructionFlowDiagram from './InstructionFlowDiagram';
import './SingleInstructionFlow.css';

export default function SingleInstructionFlow({flow, duration = singleFlowDuration(1000), onPause}: {flow: ReturnType<typeof buildInstructionFlow>; duration?: number; onPause?: () => void}) {
  const [view, setView] = useState({selected: -1, phase: 0, replay: 0, duration});
  useEffect(() => {
    if (view.selected >= 0) return;
    const timers = Array.from({length: flow.steps.length - 1}, (_, index) => window.setTimeout(() => setView(value => ({...value, phase: index + 1})), (index + 1) * view.duration / flow.steps.length));
    return () => timers.forEach(window.clearTimeout);
  }, [view.selected, view.replay, view.duration, flow.steps.length]);
  const choose = (index: number) => {onPause?.(); setView(value => ({...value, selected: index, phase: index, replay: value.replay + 1, duration: 4000}));};
  const unit = (id: FlowUnit) => {
    const preferred = {cu: 'decode', registers: 'read', alu: 'execute', memory: flow.load || flow.store ? 'memory' : 'decode', pc: 'commit'}[id];
    choose(Math.max(0, flow.steps.findIndex(value => value.id === preferred)));
  };
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
      <span className="text-[var(--ar-text-muted)]" aria-live="off">{view.phase + 1} / {flow.steps.length} · {flow.steps[view.phase].title}</span>
      <div className="flex items-center gap-3"><span className="text-[var(--ar-text-muted)]">{view.selected < 0 ? '전체 흐름' : '선택 경로'} {Number((view.duration / 1000).toFixed(1))}초</span><button type="button" className="rounded-md border border-[var(--ar-border)] px-3 py-1.5 font-semibold hover:bg-[var(--ar-header-bg)]" onClick={() => {onPause?.(); setView(value => ({selected: -1, phase: 0, replay: value.replay + 1, duration: singleFlowDuration(1000)}));}}>천천히 다시 보기</button></div>
    </div>
    {flow.error && <p role="alert" className="shrink-0 px-3 pb-1 text-xs text-red-600">실행 오류: {flow.error.message ?? flow.error.code}</p>}
    <div className="min-h-0 flex-1 overflow-auto px-2 pb-2"><div className="h-full min-h-[440px] min-w-[440px]"><InstructionFlowDiagram flow={flow} step={view.selected} replay={view.replay} duration={view.duration} onUnit={unit}/></div></div>
    <p className="sr-only">파란 실선은 데이터, 보라 점선은 제어입니다. 한 CPU 클록 안의 흐름을 교육용으로 느리게 표시하며 실제 하드웨어 지연을 뜻하지 않습니다.</p>
  </div>;
}
