import {useId} from 'react';
import {displayValue, registerLabel, type FlowUnit, type buildInstructionFlow} from '../utils/instructionFlow';

type Flow = ReturnType<typeof buildInstructionFlow>;
export default function InstructionFlowDiagram({flow, step, onUnit}: {flow: Flow; step: number; onUnit: (unit: FlowUnit) => void}) {
  const marker = useId().replace(/:/g, '');
  const active = step < 0 ? {id: 'all', units: [...new Set(flow.steps.flatMap(value => value.units))], routes: flow.steps.flatMap(value => value.routes)} : flow.steps[step];
  const routes = new Set(active?.routes);
  const block = (id: FlowUnit, x: number, y: number, width: number, title: string, subtitle: string, lines: string[]) => {
    const selected = active?.units.includes(id);
    return <g role="button" tabIndex={0} aria-label={`${title} 설명 보기`} onClick={() => onUnit(id)}
      onKeyDown={event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); onUnit(id);}}}
      className="cursor-pointer outline-none focus-visible:drop-shadow-md">
      <rect x={x} y={y} width={width} height={100} rx={10} fill={selected ? 'var(--ar-header-bg)' : 'var(--ar-panel-bg)'} stroke={selected ? 'var(--ar-accent)' : 'var(--ar-border)'} strokeWidth={selected ? 2 : 1}/>
      <text x={x + 14} y={y + 22} fill="var(--ar-text-primary)" fontSize={14} fontWeight={650}>{title}</text>
      <text x={x + 14} y={y + 41} fill="var(--ar-text-muted)" fontSize={11}>{subtitle}</text>
      {lines.slice(0, 3).map((line, i) => <text key={i} x={x + 14} y={y + 61 + i * 15} fill="var(--ar-text-primary)" fontSize={12} fontFamily="Consolas, monospace"><title>{line}</title>{line.length > 25 ? `${line.slice(0, 24)}…` : line}</text>)}
    </g>;
  };
  const edge = (id: string, d: string, label: string, x: number, y: number, control = false) => {
    const enabled = routes.has(id);
    return <g key={id} data-flow-route={id} data-active={enabled}>
      <path d={d} fill="none" stroke={enabled ? 'var(--ar-accent)' : 'var(--ar-border)'} strokeWidth={enabled ? 3 : 1.2}
        strokeDasharray={control ? '5 5' : undefined} markerEnd={`url(#${marker}-${enabled ? 'active' : 'idle'})`}/>
      <text x={x} y={y} textAnchor="middle" fontSize={10} fill={enabled ? 'var(--ar-accent)' : 'var(--ar-text-muted)'} fontWeight={enabled ? 600 : 400}>{label}</text>
    </g>;
  };
  return <svg viewBox="0 0 820 450" className="w-full min-w-[640px]" role="group" aria-label="선택 명령어의 데이터 흐름">
    <defs>{['active', 'idle'].map(state => <marker key={state} id={`${marker}-${state}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={state === 'active' ? 'var(--ar-accent)' : 'var(--ar-border)'}/></marker>)}</defs>
    {edge('fetch', 'M 686 185 V 60 H 510', '명령어', 620, 51)}
    {(flow.registerInputs.length > 0 || flow.writes.length > 0) && edge('control', 'M 310 90 H 118 V 185', '읽기 / 기록 제어', 208, 80, true)}
    {flow.registerInputs.length > 0 && edge('operands', 'M 230 230 H 310', '입력값', 270, 218)}
    {flow.usesImmediate && edge('immediate', 'M 410 120 V 185', '즉치값 / PC', 355, 154)}
    {!flow.system && edge('alu-control', 'M 480 120 V 175 H 496 V 185', 'ALU 제어', 512, 153, true)}
    {(flow.load || flow.store) && edge('memory-control', 'M 510 90 H 765 V 185', '읽기 / 쓰기 제어', 700, 105, true)}
    {(flow.load || flow.store) && edge('address', 'M 510 220 H 590', '계산한 주소', 550, 207)}
    {flow.store && edge('store', 'M 160 285 V 340 H 700 V 285', '저장할 값', 440, 331)}
    {flow.load && flow.writes.length > 0 && edge('load', 'M 625 285 V 365 H 90 V 285', '읽은 값 → 목적지', 357, 383)}
    {!flow.load && !flow.store && !flow.jump && !flow.system && flow.writes.length > 0 && edge('writeback', 'M 380 285 V 320 H 90 V 285', '계산 결과 → 목적지', 235, 311)}
    {flow.jump && flow.writes.length > 0 && edge('link', 'M 310 392 H 30 V 270', 'PC + 4 → 목적지', 165, 414)}
    {edge('nextpc', 'M 510 115 H 557 V 407 H 510', 'PC 선택', 580, 320, true)}
    {block('cu', 310, 20, 200, 'CU · 제어 장치', '명령어 해석 · 동작 선택', [flow.op.toUpperCase(), flow.controlSignals ? `RegWrite ${Number(flow.controlSignals.reg_write)} · MemRead ${Number(flow.controlSignals.mem_read)}` : '의미 설명 · 제어값 미제공'])}
    {block('registers', 30, 185, 200, '레지스터', '입력 읽기 · 결과 기록', [...(flow.registerInputs.length ? flow.registerInputs.map(input => `${registerLabel(input.name)} = ${displayValue(input.value).split(' · ')[0]}`) : ['일반 레지스터 입력 없음']), ...((active?.id === 'commit' || active?.id === 'all') && flow.writes.length ? [`${registerLabel(flow.writes[0])} ← ${displayValue(flow.writeValue).split(' · ')[0]}`] : [])])}
    {block('alu', 310, 185, 200, 'ALU · 연산 장치', flow.system ? '일반 ALU 연산 없음' : flow.load || flow.store ? '기준 주소 + 바이트 오프셋' : flow.branch ? '레지스터 값 비교' : flow.jump ? '이동 주소와 링크 값 구분' : '명령어에 지정된 연산', flow.system ? ['ALU 경로를 사용하지 않음'] : flow.jump ? [`다음 PC ${flow.nextPc ?? '미제공'}`, `링크 값 ${flow.writeValue ?? '미제공'}`] : [`A ${displayValue(flow.input1)}`, flow.amount != null ? `B 이동 크기 ${flow.amount} bit` : `B ${displayValue(flow.input2)}`, `결과 ${displayValue(flow.result)}`])}
    {block('memory', 590, 185, 200, '메모리', flow.load ? `${flow.width / 8}바이트 데이터 읽기` : flow.store ? `${flow.width / 8}바이트 데이터 저장` : '명령어 읽기 · 데이터 접근 없음', flow.load || flow.store ? [flow.address ?? '주소 미제공', flow.memoryValue ?? '데이터 미제공'] : ['데이터 Load/Store 없음'])}
    <g role="button" tabIndex={0} aria-label="PC 설명 보기" onClick={() => onUnit('pc')} onKeyDown={event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); onUnit('pc');}}}>
      <rect x="310" y="375" width="200" height="60" rx="8" fill="var(--ar-panel-bg)" stroke={active?.units.includes('pc') ? 'var(--ar-accent)' : 'var(--ar-border)'}/>
      <text x="325" y="397" fontSize="12" fontWeight="650" fill="var(--ar-text-primary)">다음 PC</text>
      <text x="325" y="417" fontSize="12" fontFamily="Consolas, monospace" fill="var(--ar-text-muted)">{flow.nextPc ?? '실행 시점에서 확인'}</text>
    </g>
  </svg>;
}
