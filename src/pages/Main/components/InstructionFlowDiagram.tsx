import {useId} from 'react';
import {displayValue, registerLabel, type FlowUnit, type buildInstructionFlow} from '../utils/instructionFlow';
type Flow = ReturnType<typeof buildInstructionFlow>;

export default function InstructionFlowDiagram({flow, step, onUnit, duration = 3600, replay = 0}: {
  flow: Flow; step: number; onUnit: (unit: FlowUnit) => void; duration?: number; replay?: number;
}) {
  const marker = useId().replace(/:/g, '');
  const chosen = step < 0 ? flow.steps : [flow.steps[step]];
  const routes = [...new Set(chosen.flatMap(value => value?.routes ?? []))];
  const time = Math.max(200, duration) / Math.max(1, chosen.length);
  const tint = {cu: '#a45de4', registers: '#00a981', alu: '#ed9300', memory: '#009dd8', pc: '#ec5478'};
  const short = (value?: string | null) => displayValue(value).split(' · ')[0];
  const edge = (id: string, d: string, label: string, x: number, y: number, value = '', control = false, alias = id) => {
    const enabled = routes.includes(alias);
    const secondHalf = ['fetch', 'immediate-decode', 'mux-alu', 'record'].includes(id);
    const begin = (Math.max(0, chosen.findIndex(value => value?.routes.includes(alias))) + (secondHalf ? .5 : 0)) * time;
    const color = control ? tint.cu : '#007cc2';
    return <g key={`${id}-${replay}`} data-flow-route={id} data-active={enabled}>
      <path d={d} fill="none" stroke="var(--ar-border)" strokeWidth="1.6" strokeDasharray={control ? '4 4' : undefined} markerEnd={`url(#${marker}-idle)`}/>
      {enabled && <>
        <path className="flow-travel" d={d} pathLength={control ? undefined : 1} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={control ? '4 4' : '1'} strokeDashoffset={control ? 0 : 1} opacity={control ? 0 : 1} markerEnd={`url(#${marker}-active)`}>
          <animate attributeName={control ? 'opacity' : 'stroke-dashoffset'} from={control ? '0' : '1'} to={control ? '1' : '0'} begin={`${begin}ms`} dur={`${time * .45}ms`} fill="freeze"/>
        </path>
        <g className="flow-packet" opacity="0" aria-hidden="true">
          <animateMotion path={d} begin={`${begin}ms`} dur={`${time * .45}ms`} fill="freeze"/>
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.02;0.92;1" begin={`${begin}ms`} dur={`${time * .45}ms`} fill="freeze"/>
          <circle r="6" fill={color} stroke="var(--ar-panel-bg)" strokeWidth="2"/>
          {!control && <text y="-11" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ar-text-primary)" stroke="var(--ar-panel-bg)" strokeWidth="4" paintOrder="stroke">{value}</text>}
        </g>
      </>}
      <text x={x} y={y} textAnchor="middle" fontSize="10" fill={enabled ? color : 'var(--ar-text-muted)'}>{label}</text>
    </g>;
  };
  const node = (id: FlowUnit, x: number, y: number, w: number, h: number, title: string, lines: string[], shape?: string) => <g role="button" tabIndex={0} aria-label={`${title} 설명 보기`} onClick={() => onUnit(id)} onKeyDown={event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); onUnit(id);}}} className="cursor-pointer outline-none focus-visible:drop-shadow-md">
    {shape ? <path d={shape} fill="var(--ar-panel-bg)" stroke={tint[id]} strokeWidth="2"/> : <rect x={x} y={y} width={w} height={h} rx="9" fill="var(--ar-panel-bg)" stroke={tint[id]} strokeWidth="2"/>}
    <text x={x + w / 2} y={y + 23} textAnchor="middle" fontSize="14" fontWeight="650" fill="var(--ar-text-primary)">{title}</text>
    {lines.map((line, i) => <text key={i} x={x + w / 2} y={y + 44 + i * 16} textAnchor="middle" fontSize="11" fontFamily="Consolas, monospace" fill="var(--ar-text-primary)"><title>{line}</title>{line.length > 32 ? `${line.slice(0,31)}…` : line}</text>)}
  </g>;
  const immediate = flow.amount ?? flow.immediate;
  const hasImmediate = flow.usesImmediate || flow.branch;
  return <svg key={`${flow.historyIndex}-${replay}-${step}`} viewBox="0 0 760 790" className="block h-full min-h-[400px] w-full" role="group" aria-label="데이터가 이동하는 싱글 사이클 경로">
    <defs>{['active', 'idle'].map(state => <marker key={state} id={`${marker}-${state}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill={state === 'active' ? '#007cc2' : 'var(--ar-text-muted)'}/></marker>)}</defs>
    {edge('pc-fetch', 'M340 72 V108', '명령어 주소', 405, 96, flow.pc ?? 'PC', false, 'fetch')}
    {edge('fetch', 'M340 174 V205 H635 V230', '명령어 해석', 485, 197, flow.op.toUpperCase())}
    {flow.registerInputs.length > 0 && edge('register-select', 'M300 174 V200 H195 V244', 'rs1 / rs2 번호', 200, 223, flow.registerInputs.map(value => value.name).join(', '), false, 'control')}
    {hasImmediate && edge('immediate-decode', 'M390 174 V205 H450 V244', '즉치 필드', 450, 225, String(immediate ?? '미제공'), false, 'fetch')}
    {(flow.registerInputs.length || flow.writes.length) > 0 && edge('control', 'M575 262 H530 V235 H245 V244', '레지스터 제어', 403, 237, '', true)}
    {!flow.system && edge('alu-control', 'M635 310 V390 H453 V429', '연산 선택', 545, 383, '', true)}
    {flow.registerInputs.length > 0 && edge('operands', 'M170 325 V372 H285 V429', '입력 A', 213, 365, short(flow.input1))}
    {flow.registerInputs.length > 1 && !flow.usesImmediate && edge('operand-b', 'M225 325 V350 H405 V370', '입력 B', 315, 342, short(flow.input2), false, 'operands')}
    {flow.usesImmediate && edge('immediate', 'M450 325 V345 H420 V370', '즉치값 준비', 495, 350, String(immediate ?? '미제공'))}
    {!flow.system && edge('mux-alu', 'M405 408 V429', '선택한 B', 481, 422, flow.amount != null ? `${flow.amount} bit` : short(flow.input2), false, flow.usesImmediate ? 'immediate' : 'operands')}
    {flow.pcRelative && edge('pc-input', 'M250 45 H80 V405 H267 V429', '현재 PC 입력', 112, 393, flow.pc ?? 'PC', false, 'pc-input')}
    {(flow.load || flow.store) && edge('memory-control', 'M635 310 V567 H490', '메모리 제어', 585, 557, '', true)}
    {(flow.load || flow.store) && edge('address', 'M340 500 V540', '계산한 주소', 410, 526, flow.address ?? '미제공')}
    {flow.store && edge('store', 'M130 325 V577 H225', '저장할 데이터 (rs2)', 139, 520, short(flow.memoryValue))}
    {flow.load && flow.writes.length > 0 && edge('load', 'M340 608 V665', '읽어 온 데이터', 413, 638, short(flow.memoryValue))}
    {!flow.load && !flow.store && !flow.jump && !flow.system && flow.writes.length > 0 && edge('writeback', 'M280 500 V520 H195 V645 H310 V665', 'ALU 결과 우회', 185, 626, short(flow.result))}
    {flow.jump && flow.writes.length > 0 && edge('link', 'M430 45 H715 V690 H410', '복귀 주소 PC + 4', 630, 681, short(flow.writeValue))}
    {flow.writes.length > 0 && edge('record', 'M340 708 V743 H38 V285 H95', '선택한 값 → rd', 171, 737, short(flow.writeValue), false, flow.jump ? 'link' : flow.load ? 'load' : 'writeback')}
    {flow.branch && edge('decision', 'M455 470 H550 V290 H575', '비교 결과 → PC 선택', 555, 457, flow.taken == null ? '미제공' : flow.taken ? '참' : '거짓', false, 'nextpc')}
    {flow.branch && edge('branch-offset', 'M535 285 H575', 'PC 기준 변위', 551, 275, String(immediate ?? '미제공'), false, 'alu-control')}
    {flow.jump && edge('jump-target', 'M455 470 H550 V290 H575', '이동 주소 → PC 선택', 555, 457, flow.nextPc ?? '미제공', false, 'nextpc')}
    {edge('nextpc', 'M665 230 V45 H430', '다음 명령어 주소 선택', 565, 35, flow.nextPc ?? '미제공', true)}
    {node('pc', 250, 14, 180, 58, 'PC · 명령어 주소', [flow.pc ?? '실행 시점에서 확인'])}
    {node('memory', 200, 108, 280, 66, 'Instruction Memory · 명령어 메모리', [flow.op.toUpperCase()])}
    {node('cu', 575, 230, 140, 80, 'CU · 제어 장치', [flow.op.toUpperCase(), flow.controlSignals ? `RegWrite ${Number(flow.controlSignals.reg_write)}` : '실행 신호 미제공'])}
    {node('registers', 95, 244, 220, 81, 'Registers · 레지스터', flow.registerInputs.length ? flow.registerInputs.slice(0,2).map(value => `${registerLabel(value.name)} = ${short(value.value)}`) : ['입력 레지스터 없음'])}
    {node('cu', 365, 244, 170, 81, 'Imm Gen · 즉치값 생성', [hasImmediate ? `${immediate ?? '미제공'}` : '이 명령어는 사용 안 함', hasImmediate ? flow.branch ? '분기할 PC 기준 거리' : '명령어 속 상수를 준비' : ''])}
    <path d="M370 370H440L425 408H385Z" fill="var(--ar-panel-bg)" stroke="#009dd8" strokeWidth="1.5"/><text x="405" y="394" textAnchor="middle" fontSize="12" fill="var(--ar-text-primary)">MUX</text>
    {node('alu', 225, 429, 230, 71, 'ALU · 연산 / 주소 계산', [flow.system ? '일반 ALU 연산 없음' : flow.jump ? `이동 주소 ${flow.nextPc ?? '미제공'}` : `${short(flow.input1)} ${flow.op} ${flow.amount ?? short(flow.input2)}`, flow.system ? '' : `결과 ${short(flow.result)}`], 'M225 429H320L340 445L360 429H455L420 500H260Z')}
    {node('memory', 225, 540, 265, 68, 'Data Memory · 데이터 메모리', [flow.load || flow.store ? `${flow.address ?? '미제공'} · ${flow.width / 8} byte ${flow.load ? '읽기' : '쓰기'}` : '이 명령어는 데이터 접근 없음', flow.load || flow.store ? `값 ${short(flow.memoryValue)}` : ''])}
    {node('registers', 270, 665, 140, 43, '기록값 MUX', [], 'M270 665H410L385 708H295Z')}
    <text x="420" y="720" fontSize="11" fill="var(--ar-text-muted)">{flow.writes.length ? `${flow.writes.map(registerLabel).join(', ')} ← ${short(flow.writeValue)}` : '일반 레지스터 기록 없음'}</text>
  </svg>;
}
