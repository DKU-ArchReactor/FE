import {useId} from 'react';
import {displayValue, registerLabel, type FlowUnit, type buildInstructionFlow} from '../utils/instructionFlow';
type Flow = ReturnType<typeof buildInstructionFlow>;
const BUS_MARKS: Record<string, {x: number; y: number; bits: number}> = {
  'pc-fetch': {x: 340, y: 89, bits: 32}, fetch: {x: 530, y: 205, bits: 32},
  operands: {x: 252, y: 372, bits: 32}, 'operand-b': {x: 280, y: 350, bits: 32},
  immediate: {x: 420, y: 355, bits: 32}, 'pc-input': {x: 80, y: 160, bits: 32},
  address: {x: 340, y: 519, bits: 32}, store: {x: 130, y: 450, bits: 32},
  load: {x: 340, y: 632, bits: 32}, writeback: {x: 195, y: 580, bits: 32},
  link: {x: 715, y: 515, bits: 32}, record: {x: 38, y: 690, bits: 32},
  'jump-target': {x: 550, y: 420, bits: 32},
};
const textWidth = (text: string, size: number) => [...text].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? size : size * .62), 0);

export default function InstructionFlowDiagram({flow, step, onUnit, duration = 3600, replay = 0, fit = 'width'}: {
  flow: Flow; step: number; onUnit: (unit: FlowUnit) => void; duration?: number; replay?: number; fit?: 'width' | 'all';
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
    const bus = !control ? BUS_MARKS[id] : undefined;
    const labelWidth = textWidth(label, 11) + 10;
    return <g key={`${id}-${replay}`} data-flow-route={id} data-active={enabled} data-connection={control ? 'control' : 'bus'}>
      <title>{label}{bus ? ` · ${bus.bits}비트 논리 경로` : ''}{value ? ` · 값 ${value}` : ''}</title>
      <path d={d} fill="none" stroke={control ? 'var(--ar-border)' : '#9bbbd0'} strokeWidth={control ? 1.6 : 12} strokeLinejoin="round" strokeDasharray={control ? '4 4' : undefined}/>
      {!control && <path d={d} fill="none" stroke="var(--ar-panel-bg)" strokeWidth="8" strokeLinejoin="round" markerEnd={`url(#${marker}-idle)`}/>}
      {enabled && <>
        <path className="flow-travel" d={d} pathLength={control ? undefined : 1} fill="none" stroke={color} strokeWidth={control ? 2.5 : 8} strokeLinejoin="round" strokeDasharray={control ? '4 4' : '1'} strokeDashoffset={control ? 0 : 1} opacity={control ? 0 : 1} markerEnd={`url(#${marker}-active)`}>
          <animate attributeName={control ? 'opacity' : 'stroke-dashoffset'} from={control ? '0' : '1'} to={control ? '1' : '0'} begin={`${begin}ms`} dur={`${time * .45}ms`} fill="freeze"/>
        </path>
        <g className="flow-packet" opacity="0" aria-hidden="true">
          <animateMotion path={d} begin={`${begin}ms`} dur={`${time * .45}ms`} fill="freeze"/>
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.02;0.92;1" begin={`${begin}ms`} dur={`${time * .45}ms`} fill="freeze"/>
          <circle r="6" fill={color} stroke="var(--ar-panel-bg)" strokeWidth="2"/>
        </g>
      </>}
      {bus && <g className="bus-width" aria-label={`${bus.bits}비트`}><path d={`M${bus.x - 6} ${bus.y + 6}l12 -12`} stroke={enabled ? color : '#648ba4'} strokeWidth="1.8"/><text x={id === 'record' ? bus.x + 15 : bus.x - 12} y={bus.y + (['pc-fetch', 'immediate', 'address'].includes(id) ? 9 : 19)} textAnchor={id === 'record' ? 'start' : 'end'} fontSize="10" fill="var(--ar-text-muted)">{bus.bits}</text></g>}
      <g className="bus-label"><rect x={x - labelWidth / 2} y={y - 12} width={labelWidth} height="17" rx="3" fill="var(--ar-panel-bg)"/><text x={x} y={y} textAnchor="middle" fontSize="11" fill={enabled ? color : 'var(--ar-text-muted)'}>{label}</text></g>
    </g>;
  };
  const node = (id: FlowUnit, x: number, y: number, w: number, h: number, title: string, lines: string[], shape?: string, focus: FlowUnit = id) => {
    const titles = textWidth(title, 14) > w - 24 ? title.split(' · ') : [title];
    const fitted = (line: string, size: number, width: number) => textWidth(line, size) > width ? {textLength: width, lengthAdjust: 'spacingAndGlyphs' as const} : {};
    return <g role="button" tabIndex={0} data-flow-node={id} data-x={x} data-y={y} data-width={w} data-height={h} aria-label={`${title} 설명 보기`} onClick={() => onUnit(focus)} onKeyDown={event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); onUnit(focus);}}} className="cursor-pointer outline-none focus-visible:drop-shadow-md">
    {shape ? <path d={shape} fill="var(--ar-panel-bg)" stroke={tint[id]} strokeWidth="2"/> : <rect x={x} y={y} width={w} height={h} rx="9" fill="var(--ar-panel-bg)" stroke={tint[id]} strokeWidth="2"/>}
    {titles.map((part, i) => <text key={i} x={x + w / 2} y={y + (shape && h > 50 ? 32 : 21) + i * 16} textAnchor="middle" fontSize={i ? 11 : 14} fontWeight={i ? 400 : 650} fill="var(--ar-text-primary)" {...fitted(part, i ? 11 : 14, w - 24)}>{part}</text>)}
    {lines.filter(Boolean).map((line, i) => <text key={i} x={x + w / 2} y={y + (shape && h > 50 ? 50 : titles.length > 1 ? 55 : 43) + i * (shape && h > 50 ? 14 : 16)} textAnchor="middle" fontSize="11" fontFamily="Consolas, monospace" fill="var(--ar-text-primary)" {...fitted(line, 11, w - (shape ? 70 : 24))}>{line}</text>)}
  </g>;
  };
  const immediate = flow.amount ?? flow.immediate;
  const hasImmediate = flow.usesImmediate || flow.branch;
  const operation = flow.load || flow.store || ['add', 'addi', 'auipc'].includes(flow.op) ? '+' : flow.op === 'sub' ? '−' : flow.op;
  return <svg key={`${flow.historyIndex}-${replay}-${step}`} viewBox="18 4 724 782" preserveAspectRatio="xMidYMin meet" className={fit === 'all' ? 'block h-full min-h-[400px] w-full' : 'block h-auto w-full'} role="group" aria-label="데이터가 이동하는 싱글 사이클 경로">
    <defs>{['active', 'idle'].map(state => <marker key={state} id={`${marker}-${state}`} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L11 6L0 12z" fill={state === 'active' ? '#007cc2' : '#648ba4'}/></marker>)}</defs>
    {edge('pc-fetch', 'M340 72 V108', '명령어 주소', 405, 96, flow.pc ?? 'PC', false, 'fetch')}
    {edge('fetch', 'M340 174 V205 H635 V230', '명령어 해석', 485, 197, flow.op.toUpperCase())}
    {flow.registerInputs.length > 0 && edge('register-select', 'M300 174 V200 H195 V244', 'rs1 / rs2 번호', 200, 223, flow.registerInputs.map(value => value.name).join(', '), false, 'control')}
    {hasImmediate && edge('immediate-decode', 'M390 174 V205 H450 V244', '즉치 필드', 450, 225, String(immediate ?? '미제공'), false, 'fetch')}
    {(flow.registerInputs.length || flow.writes.length) > 0 && edge('control', 'M575 262 H555 V223 H280 V244', '레지스터 제어', 310, 216, '', true)}
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
    {flow.branch && edge('decision', 'M455 470 H550 V290 H575', '비교 결과 → PC 선택', 555, 457, flow.taken == null ? '미제공' : flow.taken ? '참' : '거짓', true, 'nextpc')}
    {flow.branch && edge('branch-offset', 'M535 285 H575', '변위', 555, 278, String(immediate ?? '미제공'), false, 'alu-control')}
    {flow.jump && edge('jump-target', 'M455 470 H550 V290 H575', '이동 주소 → PC 선택', 555, 457, flow.nextPc ?? '미제공', false, 'nextpc')}
    {edge('nextpc', 'M665 230 V45 H430', '다음 명령어 주소 선택', 565, 35, flow.nextPc ?? '미제공', true)}
    {node('pc', 250, 14, 180, 58, 'PC · 명령어 주소', [flow.pc ?? '실행 시점에서 확인'])}
    {node('memory', 200, 108, 280, 66, 'Instruction Memory · 명령어 메모리', [flow.op.toUpperCase()], undefined, 'cu')}
    {node('cu', 575, 230, 140, 80, 'CU · 제어 장치', [flow.op.toUpperCase(), flow.controlSignals ? `RegWrite ${Number(flow.controlSignals.reg_write)}` : '실행 신호 미제공'])}
    {node('registers', 95, 244, 220, 81, 'Registers · 레지스터', flow.registerInputs.length ? flow.registerInputs.slice(0,2).map(value => `${registerLabel(value.name)} = ${short(value.value)}`) : ['입력 레지스터 없음'])}
    {node('cu', 365, 244, 170, 81, 'Imm Gen · 즉치값 생성', [hasImmediate ? `${immediate ?? '미제공'}` : '이 명령어는 사용 안 함', hasImmediate ? flow.branch ? '분기할 PC 기준 거리' : '명령어 속 상수를 준비' : ''])}
    <path d="M370 370H440L425 408H385Z" fill="var(--ar-panel-bg)" stroke="#009dd8" strokeWidth="1.5"/><text x="405" y="394" textAnchor="middle" fontSize="12" fill="var(--ar-text-primary)">MUX</text>
    {node('alu', 225, 429, 230, 71, 'ALU · 연산 / 주소 계산', [flow.system ? '일반 ALU 연산 없음' : flow.jump ? `이동 주소 ${flow.nextPc ?? '미제공'}` : `${short(flow.input1)} ${operation} ${flow.amount ?? short(flow.input2)}`, flow.system ? '' : `결과 ${short(flow.result)}`], 'M225 429H320L340 445L360 429H455L420 500H260Z')}
    {node('memory', 225, 540, 265, 68, 'Data Memory · 데이터 메모리', [flow.load || flow.store ? `${flow.address ?? '미제공'} · ${flow.width / 8} byte ${flow.load ? '읽기' : '쓰기'}` : '이 명령어는 데이터 접근 없음', flow.load || flow.store ? `값 ${short(flow.memoryValue)}` : ''])}
    {node('registers', 270, 665, 140, 43, '기록값 MUX', [], 'M270 665H410L385 708H295Z')}
    <text x="420" y="720" fontSize="11" fill="var(--ar-text-muted)">{flow.writes.length ? `${flow.writes.map(registerLabel).join(', ')} ← ${short(flow.writeValue)}` : '일반 레지스터 기록 없음'}</text>
    <g aria-label="범례: 굵은 묶음선은 논리 버스, 보라 점선은 제어 신호. 실제 공유 단일 버스 회로를 뜻하지 않습니다.">
      <path d="M310 770H340" stroke="#9bbbd0" strokeWidth="12"/><path d="M310 770H340" stroke="var(--ar-panel-bg)" strokeWidth="8"/><text x="350" y="774" fontSize="11" fill="var(--ar-text-muted)">논리 버스 · /32 = 32비트</text>
      <path d="M540 770H570" stroke="#a45de4" strokeWidth="2" strokeDasharray="4 4"/><text x="578" y="774" fontSize="11" fill="var(--ar-text-muted)">제어 신호</text>
    </g>
  </svg>;
}
