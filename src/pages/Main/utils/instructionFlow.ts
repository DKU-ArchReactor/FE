import type {CycleHistoryItem, SimulationResult, StageBuffer} from '@/type/simulation';
import type {TutorInstruction} from './tutorAnalysis';

export type FlowUnit = 'cu' | 'registers' | 'alu' | 'memory' | 'pc';
// Presentation pace; total single-clock display time is step count times singleTransferDuration.
export const singleFlowDuration = (playSpeed: number) => Math.max(4500, playSpeed * 9);
export const singleTransferDuration = (pace: number) => pace * 1600 / 9000;
export interface FlowStep {id: string; title: string; description: string; units: FlowUnit[]; routes: string[]}
const ABI_NAMES = ['zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2', 's0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'];
export function registerLabel(name: string) {
  const number = /^x(?:[0-9]|[12][0-9]|3[01])$/.test(name) ? Number(name.slice(1)) : -1;
  return number >= 0 ? `${ABI_NAMES[number]} (${name})` : name;
}
export const numericPc = (value?: string | null) => value && /^0x[\da-f]+$/i.test(value) ? Number.parseInt(value, 16) : NaN;
export function instructionPc(frame: CycleHistoryItem | null) {
  return frame?.datapath?.pc ?? frame?.stage_activity?.IF?.pc ?? frame?.buffers?.IF?.pc ?? frame?.if_stage?.pc;
}
export function displayValue(value?: string | null): string {
  if (value == null) return '미제공';
  if (!/^0x[\da-f]{1,8}$/i.test(value)) return value;
  const number = Number.parseInt(value, 16);
  return `${number | 0} · ${value}`;
}

// View-only: values always belong to this exact PC and observed frame, never a future occurrence.
export function buildInstructionFlow(item: TutorInstruction | undefined, frame: CycleHistoryItem | null,
  previous: CycleHistoryItem | null | undefined, simulation: SimulationResult | null | undefined) {
  const historyIndex = frame ? simulation?.history.indexOf(frame) ?? -1 : -1;
  const actual = simulation?.simulator.mode === 'single' && historyIndex >= 0
    && Number.isFinite(numericPc(item?.pc)) && numericPc(item?.pc) === numericPc(instructionPc(frame));
  const dp = actual ? frame?.datapath : undefined;
  const stages = actual ? frame?.stage_activity ?? frame?.buffers : undefined;
  const ex = stages?.EX as StageBuffer & {
    operand_1?: string; operand_2?: string; alu_result?: string;
  } | undefined;
  const mem = stages?.MEM as {target_address?: string; read_data?: string; write_data?: string} | undefined;
  const wb = stages?.WB as {final_write_data?: string; will_write_reg?: boolean; destination_register?: string} | undefined;
  const op = item?.explanation.opcode ?? item?.text.trim().split(/\s/)[0] ?? '';
  const load = /^(lb|lbu|lh|lhu|lw)$/.test(op);
  const store = /^(sb|sh|sw)$/.test(op);
  const branch = /^(beq|bne|blt|bltu|bge|bgeu)$/.test(op);
  const jump = op === 'jal' || op === 'jalr';
  const system = op === 'ecall';
  const pcRelative = op === 'auipc' || op === 'jal';
  const usesImmediate = /^(addi|andi|ori|xori|slli|srli|srai|slti|sltiu|lb|lbu|lh|lhu|lw|sb|sh|sw|lui|auipc|jalr|jal)$/.test(op);
  const width = /^(lb|lbu|sb)$/.test(op) ? 8 : /^(lh|lhu|sh)$/.test(op) ? 16 : 32;
  const writes = item?.explanation.writes ?? [];
  const reads = item?.explanation.reads ?? [];
  const before = actual ? previous?.global_result.registers ?? (historyIndex === 0 ? simulation?.initial_state?.registers : undefined) : undefined;
  const input1 = dp?.alu.input_1 ?? ex?.operand_1;
  const input2 = dp?.alu.input_2 ?? ex?.operand_2;
  const result = dp?.alu.result ?? ex?.alu_result;
  const address = dp?.data_memory.address ?? (load ? dp?.data_memory.read_address : dp?.data_memory.write_address) ?? mem?.target_address;
  let memoryValue = load ? dp?.data_memory.read_data ?? mem?.read_data : dp?.data_memory.write_data ?? mem?.write_data;
  if (store && memoryValue && /^0x[\da-f]+$/i.test(memoryValue)) {
    const mask = width === 32 ? 0xFFFFFFFF : (1 << width) - 1;
    memoryValue = `0x${((Number.parseInt(memoryValue, 16) & mask) >>> 0).toString(16).padStart(width / 4, '0')}`;
  }
  const error = actual ? frame?.cycle_events.runtime_error : undefined;
  if (error?.has_error) memoryValue = undefined;
  const beforeCount = actual ? previous?.global_result.metrics.accumulated_instructions
    ?? (historyIndex === 0 ? simulation?.initial_state?.metrics?.accumulated_instructions : undefined) : undefined;
  const afterCount = actual ? frame?.global_result.metrics.accumulated_instructions : undefined;
  const completed = actual && beforeCount != null && afterCount != null && afterCount - beforeCount === 1 && !error?.has_error;
  const writeValue = completed && writes.length > 0
    ? dp?.registers.rd?.write_data ?? wb?.final_write_data ?? frame?.global_result.registers[writes[0]] : undefined;
  const registerInputs = reads.map(name => {
    const signal = [dp?.registers.rs1, dp?.registers.rs2].find(value => value && (value.index ?? value.num) === Number(name.slice(1)));
    return {name, value: actual ? signal?.value ?? before?.[name] : undefined};
  });
  const shift = /^(sll|slli|srl|srli|sra|srai)$/.test(op);
  const amount = shift && input2 && /^0x[\da-f]+$/i.test(input2) ? Number.parseInt(input2, 16) & 31 : undefined;
  const control = actual ? frame?.cycle_events.control_hazard : undefined;
  const nextPc = dp?.next_pc ?? (actual ? frame?.global_result.current_pc : undefined);
  const immediate = dp?.immediate?.dec ?? dp?.immediate?.decimal;
  const steps: FlowStep[] = [
    {id: 'decode', title: '명령어 해석', units: ['cu', 'memory'], routes: ['fetch'],
      description: `PC ${item?.pc ?? '미확인'}의 ${op || '선택한 명령어'}를 해석합니다. 명령어의 입력·목적지와 필요한 동작을 구분합니다.`},
    {id: 'read', title: system ? '실행 환경 요청' : '입력 준비', units: ['cu', ...(reads.length ? ['registers' as const] : [])], routes: reads.length ? ['control'] : [],
      description: system ? 'ECALL은 실행 환경에 서비스를 요청합니다. 일반 ALU 결과를 레지스터에 쓰는 명령어로 설명하지 않습니다.'
        : `${item?.explanation.reads == null ? '레지스터 입력 정보가 제공되지 않았습니다.' : reads.length ? `${reads.join(', ')}의 값을 읽습니다.` : '일반 입력 레지스터를 읽지 않습니다.'} ${item?.explanation.operands ?? ''}`},
  ];
  if (!system) steps.push({id: 'execute', title: load || store ? '접근 주소 계산' : branch ? '조건 비교' : jump ? '이동 위치 결정' : 'ALU 연산',
    units: ['cu', 'alu', ...(reads.length ? ['registers' as const] : []), ...(jump ? ['pc' as const] : [])], routes: ['alu-control', ...(reads.length ? ['operands'] : []), ...(usesImmediate ? ['immediate'] : []), ...(pcRelative ? ['pc-input'] : [])],
    description: jump ? `${item?.explanation.operation ?? '점프 목적지와 복귀 주소를 구분합니다.'} ALU의 일반 결과와 PC + 4 링크 값을 혼동하지 않습니다.`
      : `${item?.explanation.operation ?? item?.explanation.summary ?? ''}${amount != null ? ` 실제 시프트 크기는 ${amount}비트입니다.` : ''}${actual && result != null && !jump ? ` 관찰된 결과: ${displayValue(result)}.` : ''}`});
  if (load || store) steps.push({id: 'memory', title: load ? '데이터 읽기' : '데이터 저장', units: ['cu', 'memory', 'alu', ...(store ? ['registers' as const] : [])],
    routes: store ? ['memory-control', 'address', 'store'] : ['memory-control', 'address'],
    description: `${width / 8}바이트를 ${load ? '읽습니다' : '저장합니다'}.${actual ? ` 주소 ${address ?? '미제공'}, 값 ${displayValue(memoryValue)}.` : ' 실제 주소와 값은 이 명령어가 실행된 클록에서 확인합니다.'}${store ? ' 레지스터에 결과를 쓰지 않습니다.' : ''}`});
  steps.push({id: 'commit', title: writes.length > 0 ? '결과 기록 · 다음 PC' : '다음 PC', units: !actual || completed ? ['cu', 'pc', ...(writes.length > 0 ? ['registers' as const, ...(load ? ['memory' as const] : jump ? [] : ['alu' as const])] : [])] : [],
    routes: [...(!system && writes.length > 0 && (!actual || completed) ? ['control', jump ? 'link' : load ? 'load' : 'writeback'] : []), ...(!actual || completed ? ['nextpc'] : [])],
    description: `${writes.length > 0 ? `${writes.join(', ')}에 ${actual ? completed ? displayValue(writeValue) : '완료가 확인되지 않아 기록값을 표시하지 않습니다' : '결과를 기록합니다'}. ` : '일반 레지스터 결과 기록은 없습니다. '}${actual ? `다음 PC ${nextPc ?? '미제공'}.` : '실제 다음 PC는 실행한 클록에서 확인합니다.'}${branch && control?.taken != null ? ` 분기 ${control.taken ? '성립' : '불성립'}.` : ''}`});
  return {actual, historyIndex, completed, op, load, store, branch, jump, system, usesImmediate, width, registerInputs, writes,
    input1, input2, result, address, memoryValue, writeValue, controlSignals: dp?.control_signals,
    nextPc, amount, immediate, pcRelative, pc: item?.pc, raw: actual ? dp?.instruction.raw : item?.raw_instruction,
    taken: control?.taken, error: error?.has_error ? error : undefined, steps};
}

export type TransferUnit = FlowUnit | 'immediate' | 'mux' | 'operand-mux';
export interface InstructionTransfer {
  id: string; source: TransferUnit; target: TransferUnit; title: string;
  kind: 'address' | 'data' | 'control'; systemBus?: boolean; value?: string | null; detail: string;
}
export type TransferRoute = { points: {x:number;y:number}[]; lengths:number[]; total:number };
export function compileTransferRoute(path:string):TransferRoute {
  const points:{x:number;y:number}[]=[];
  for(const match of path.matchAll(/([MHV])([^MHV]+)/g)) {
    const numbers=match[2].trim().split(/[ ,]+/).map(Number),previous=points.at(-1)??{x:0,y:0};
    points.push(match[1]==='M'?{x:numbers[0],y:numbers[1]}:match[1]==='H'?{x:numbers[0],y:previous.y}:{x:previous.x,y:numbers[0]});
  }
  const lengths=points.slice(1).map((point,index)=>Math.abs(point.x-points[index].x)+Math.abs(point.y-points[index].y));
  return {points,lengths,total:lengths.reduce((sum,length)=>sum+length,0)};
}
export function pointOnTransfer(route:TransferRoute, progress:number, startPadding=0, endPadding=0) {
  const {points,lengths,total}=route;
  const start=Math.min(startPadding,total/2),end=Math.min(endPadding,total/2);
  let remaining=start+Math.max(0,total-start-end)*Math.max(0,Math.min(1,progress));
  for(let i=0;i<lengths.length;i++) {
    if(remaining<=lengths[i]) {const part=lengths[i]?remaining/lengths[i]:0;return{x:points[i].x+(points[i+1].x-points[i].x)*part,y:points[i].y+(points[i+1].y-points[i].y)*part};}
    remaining-=lengths[i];
  }
  return points.at(-1);
}
export function transferPoint(path:string, progress:number, startPadding=0, endPadding=0) {
  return pointOnTransfer(compileTransferRoute(path),progress,startPadding,endPadding);
}
export function instructionPaths(flow:ReturnType<typeof buildInstructionFlow>,scale=1):Record<string,string> {
  const paths:Record<string,string>={
    'fetch-address':'M360 192V245',
    'fetch-instruction':'M515 273H670V395',
    'decode-immediate':'M515 290H610V340H480V400',
    'read-control':'M650 395V365H280V400',
    'input-a':flow.pcRelative?'M460 167H700V375H90V550H290V690':'M230 510V550H290V690',
    'input-b':flow.usesImmediate?'M440 470V534H610V608H440':'M330 510V534H610V608H440',
    'mux-to-alu':'M440 608V690',
    'memory-address':'M360 800V850',
    'memory-control':'M670 503V836H660V895H500',
    'store-data':'M225 510V534H130V895H220',
    'load-data':'M360 936V954H560V1014H370',
    'result-to-mux':flow.jump?'M460 167H700V375H90V820H130V954H560V1014H370':'M300 800V820H130V954H560V1014H370',
    writeback:'M370 1014H90V455H180',
    'next-pc':'M700 395V167H460',
  };
  return Object.fromEntries(Object.entries(paths).map(([key,path])=>[key,path.replace(/([MHV])([^MHV]+)/g,(_,command:string,coordinates:string)=>{
    const values=coordinates.trim().split(/[ ,]+/).map(Number);
    return command+(command==='V'?values[0]:command==='H'?values[0]*scale:`${values[0]*scale} ${values[1]}`);
  })]));
}
export function transferMotion(transfer:InstructionTransfer,path?:string) {
  const value=transfer.kind==='control'?(transfer.id==='read-control'?`Read ${[...(transfer.value??'').matchAll(/\bx\d+\b/g)].map(match=>match[0]).join(', ')||transfer.value||'\uC81C\uC5B4'}`:transfer.value??'\uC81C\uC5B4 \uC2E0\uD638'):transfer.kind==='address'||(transfer.id==='fetch-instruction'||transfer.id==='decode-immediate')?(transfer.value??'\uBBF8\uC81C\uACF5'):displayValue(transfer.value).split(' \u00b7 ')[0];
  const width=Math.max(56,[...value].reduce((sum,char)=>sum+(char.charCodeAt(0)>255?18:11),28));
  const route=path?compileTransferRoute(path):undefined;
  // The packet stays centered on the actual wire. Reserve its footprint at ports,
  // but join consecutive MUX transfers at the device center without a position jump.
  const commands=path?.match(/[MHV]/g)??[];
  const portPadding=(horizontal:boolean)=>horizontal?width/2+6:18;
  const startPadding=route?(transfer.source==='mux'||transfer.source==='operand-mux'?0:portPadding(commands[1]==='H')):0;
  const endPadding=route?(transfer.target==='mux'||transfer.target==='operand-mux'?0:portPadding(commands.at(-1)==='H')):0;
  const distance=route?Math.max(0,route.total-Math.min(startPadding,route.total/2)-Math.min(endPadding,route.total/2)):0;
  return {value,width,route,startPadding,endPadding,distance};
}
// Keep short connections readable, but cap long returns instead of making one
// instruction take tens of seconds. The CPU playback uses this same schedule.
export function transferTimeline(transfers:InstructionTransfer[],paths:Record<string,string>,pace:number) {
  const base=singleTransferDuration(pace)*.81;
  let start=0;
  return transfers.map(transfer=>{
    const motion=transferMotion(transfer,paths[transfer.id]);
    const minimum=base*(transfer.id==='decode-immediate'?1.1:1);
    const lead=motion.route?minimum*.05:0;
    const travel=motion.route?Math.max(minimum*.875,Math.min(base*(transfer.kind==='control'?.95:1.5),base*.875*motion.distance/195)):0;
    const duration=motion.route?lead+travel+minimum*.075:base*(transfer.kind==='control'?.9:.8);
    const entry={start,duration,lead,travel,motion};
    start+=duration;
    return entry;
  });
}
export function instructionFlowDuration(flow:ReturnType<typeof buildInstructionFlow>,pace:number) {
  return transferTimeline(instructionTransfers(flow),instructionPaths(flow),pace).reduce((sum,entry)=>sum+entry.duration,0);
}
export function instructionTransfers(flow: ReturnType<typeof buildInstructionFlow>): InstructionTransfer[] {
  const result: InstructionTransfer[] = [
    {id:'fetch-address',source:'pc',target:'memory',title:'PC → 메모리',kind:'address',systemBus:true,value:flow.pc,detail:'읽을 명령어의 주소'},
    {id:'fetch-instruction',source:'memory',target:'cu',title:'메모리 → CU',kind:'data',systemBus:true,value:flow.raw,detail:`명령어 ${flow.op.toUpperCase()}`},
  ];
  if (flow.system) result.push({id:'environment',source:'cu',target:'cu',title:'CU · 실행 환경 요청',kind:'control',value:'ECALL',detail:'일반 메모리 전송이 아닌 실행 환경 서비스 요청'});
  else {
    if(flow.usesImmediate||flow.branch) result.push({id:'decode-immediate',source:'memory',target:'immediate',title:'\uBA85\uB839\uC5B4 \u2192 Imm Gen',kind:'data',value:flow.raw,detail:'\uBA85\uB839\uC5B4 \uBE44\uD2B8\uC5D0\uC11C \uC989\uCE58\uAC12\uC744 \uCD94\uCD9C\uD558\uACE0 32\uBE44\uD2B8\uB85C \uD655\uC7A5'});
    if(flow.registerInputs.length) result.push({id:'read-control',source:'cu',target:'registers',title:'CU → 레지스터 · 읽기 선택',kind:'control',value:flow.registerInputs.map(value=>registerLabel(value.name)).join(', '),detail:'읽을 레지스터 번호를 지정하는 제어 신호 · 연산 데이터가 아닙니다'});
    if(flow.pcRelative || flow.registerInputs.length) result.push({id:'input-a',source:flow.pcRelative?'pc':'registers',target:'alu',title:`${flow.pcRelative?'PC':'레지스터'} → ALU`,kind:'data',value:flow.input1,detail:'ALU 입력 A'});
    if(flow.usesImmediate || flow.registerInputs.length>1) result.push({id:'input-b',source:flow.usesImmediate?'immediate':'registers',target:'operand-mux',title:`${flow.usesImmediate?'\uC989\uCE58\uAC12 \uC0DD\uC131\uAE30':'\uB808\uC9C0\uC2A4\uD130'} \u2192 \uC785\uB825 MUX`,kind:'data',value:flow.amount!=null?String(flow.amount):flow.input2,detail:flow.amount!=null?'실제 비트 이동 크기': 'ALU 입력 B'});
    if(flow.usesImmediate || flow.registerInputs.length>1) result.push({id:'mux-to-alu',source:'operand-mux',target:'alu',title:'\uC785\uB825 MUX \u2192 ALU',kind:'data',value:flow.amount!=null?String(flow.amount):flow.input2,detail:'\uC120\uD0DD\uB41C \uAC12\uC744 ALU \uC785\uB825 B\uB85C \uC804\uB2EC'});
    result.push({id:'calculate',source:'alu',target:'alu',title:flow.load||flow.store?'ALU · 메모리 주소 계산':flow.branch?'ALU · 분기 조건 비교':flow.jump?'이동할 주소 선택':`ALU · ${flow.op.toUpperCase()} 연산`,kind:'data',value:flow.branch?(flow.taken==null?undefined:flow.taken?'조건 성립':'조건 불성립'):flow.jump?flow.nextPc:flow.result,detail:flow.load||flow.store?'기준 주소 + 바이트 오프셋':flow.branch?'부호 해석과 분기 조건은 명령어에 따라 다릅니다':'관찰된 연산 결과'});
    if(flow.load||flow.store) {
      result.push({id:'memory-address',source:'alu',target:'memory',title:'ALU → 메모리',kind:'address',systemBus:true,value:flow.address,detail:'데이터를 읽거나 쓸 주소'});
      const signal=flow.load?flow.controlSignals?.mem_read:flow.controlSignals?.mem_write;
      result.push({id:'memory-control',source:'cu',target:'memory',title:'CU → 메모리',kind:'control',systemBus:true,value:signal==null?undefined:`${flow.load?'읽기':'쓰기'} 요청 = ${Number(signal)}`,detail:`${flow.width/8}바이트 ${flow.load?'읽기':'쓰기'} 제어`});
      if(!flow.error) {
        if(flow.store) result.push({id:'store-data',source:'registers',target:'memory',title:'레지스터 → 메모리',kind:'data',systemBus:true,value:flow.memoryValue,detail:`실제로 저장할 하위 ${flow.width}비트`});
        else if(flow.writes.length && (!flow.actual||flow.completed)) result.push({id:'load-data',source:'memory',target:'mux',title:'\uBA54\uBAA8\uB9AC \u2192 \uAE30\uB85D\uAC12 MUX',kind:'data',systemBus:true,value:flow.writeValue,detail:'\uC77D\uC740 \uAC12\uC744 \uAE30\uB85D\uAC12 \uC120\uD0DD\uAE30\uB85C \uC804\uB2EC'});
        else result.push({id:'discard-load',source:'memory',target:'memory',title:'메모리 읽기 결과 확인',kind:'data',value:flow.memoryValue,detail:flow.writes.length?'완료가 확인되지 않아 레지스터 기록을 표시하지 않습니다':'x0 기록은 버리지만 메모리 읽기는 수행합니다'});
      }
    } else if(flow.writes.length && (!flow.actual||flow.completed)) result.push({id:'result-to-mux',source:flow.jump?'pc':'alu',target:'mux',title:`${flow.jump?'\uBCF5\uADC0 \uC8FC\uC18C':'ALU \uACB0\uACFC'} \u2192 \uAE30\uB85D\uAC12 MUX`,kind:'data',value:flow.writeValue,detail:flow.jump?'PC + 4\uB97C \uAE30\uB85D\uAC12 \uC120\uD0DD\uAE30\uB85C \uC804\uB2EC':'\uC5F0\uC0B0 \uACB0\uACFC\uB97C \uAE30\uB85D\uAC12 \uC120\uD0DD\uAE30\uB85C \uC804\uB2EC'});
  }
  if(!flow.store && flow.writes.length && !flow.error && (!flow.actual||flow.completed)) result.push({id:'writeback',source:'mux',target:'registers',title:`MUX \u2192 ${flow.writes.map(registerLabel).join(', ')}`,kind:'data',value:flow.writeValue,detail:'\uC120\uD0DD\uB41C \uAC12\uC744 \uBAA9\uC801\uC9C0 \uB808\uC9C0\uC2A4\uD130\uC5D0 \uAE30\uB85D'});
  if(!flow.actual||flow.completed) result.push({id:'next-pc',source:'cu',target:'pc',title:'PC 주소 갱신',kind:'address',value:flow.nextPc,detail:'다음에 실행할 명령어의 주소'});
  return result;
}
