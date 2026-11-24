import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import TutorArea from '../../src/pages/Main/components/TutorArea';
import {seedTutor, type TutorBundle} from '../../src/pages/Main/utils/tutorAnalysis';
import type {SimulationResult} from '../../src/type/simulation';
import single from './fixtures/single.json';
import '../../src/index.css';

const bundle: TutorBundle = {
  schema_version: '1.0',
  performance_analysis: {schema_version: '1.0', snapshots: [
    {history_index: 0, cycles: 1, completed: 1, cpi: 1, stall_cycles: 0, flush_cycles: 0, forwarding_cycles: 0, overlap_cycles: 0,
      hazard_cycles: 0, idle_cycles: 0, hazard_idle_cycles: 0, other_idle_cycles: 0, unknown_completion_cycles: 0, extra_cycles: 0},
    {history_index: 1, cycles: 2, completed: 1, cpi: 2, stall_cycles: 1, flush_cycles: 1, forwarding_cycles: 0, overlap_cycles: 1,
      hazard_cycles: 1, idle_cycles: 1, hazard_idle_cycles: 1, other_idle_cycles: 0, unknown_completion_cycles: 0, extra_cycles: 1}],
    records: [{history_index: 1, cycle: 1, kind: 'stall', reason: 'load_use', instruction: {pc: '0x10004', assembly: 'addi a1,a0,1', source_line: 1},
      dependencies: [], title: 'Load-Use 데이터 의존성', detail: '실행 이력에서 확인한 대기 원인'}], notes: ['동일 클록의 중복을 제외합니다.']},
  c_lines: [{line: 1, text: 'int x = 3;', explanation: {kind: 'c', category: 'initialization', title: '변수 초기화', summary: 'x 초기화', detail: '초기값 3'}}],
  asm_instructions: [{pc: '0x10000', text: 'addi a0, zero, 3', source_line: 1,
    explanation: {kind: 'asm', category: 'arithmetic', title: '덧셈', summary: 'a0 = zero + 3', detail: '32비트 결과', reads: ['x0'], writes: ['x10']}},
    {pc: '0x10004', text: 'addi a1, a0, 1', source_line: 1,
      explanation: {kind: 'asm', category: 'arithmetic', title: '덧셈', summary: 'a1 = a0 + 1', detail: '32비트 덧셈', reads: ['x10'], writes: ['x11']},
      teaching: {operand_roles: [{operand: 'a0', role: '첫 번째 입력값을 가진 레지스터'}], principle: '입력값에 1을 더합니다.', register_connections: [{register: 'x10', pc: '0x10000', text: 'addi a0, zero, 3'}],
        walkthrough: [{title: '입력 읽기', text: 'a0에 든 값과 명령어에 적힌 숫자 1을 사용합니다.'}, {title: '연산', text: '덧셈 연산을 수행합니다.'}, {title: '결과 담기', text: '결과를 a1에 담습니다.'}],
        concepts: [{id: 'immediate', title: '즉치값은 명령어 안의 상수', explanation: 'I형 산술 즉치값은 부호 있는 12비트 값입니다.',
          plain: '즉치값은 명령어에 직접 적어 넣은 숫자입니다.',
          example: 'andi a0, a1, -1의 마스크는 0xFFFFFFFF입니다.', question: '5000을 단일 I형 즉치값으로 표현할 수 있을까요?',
          answer: '5000은 -2048~2047 범위를 벗어납니다.', sources: [{title: 'RISC-V 공식 RV32I 명세', url: 'https://docs.riscv.org/reference/isa/v20260120/unpriv/rv32.html'}]}]}},
    {pc: '0x10008', text: 'nop', source_line: 2, explanation: {kind: 'asm', category: 'pseudo', title: '의사 명령어', summary: '상태를 유지합니다.', detail: ''}}],
  execution_steps: [{history_index: 0, cycle: 0, display_clock: 1, retired_pc: '0x10000', register_changes: [{key: 'x10', before: '0x0', after: '0x3'}], memory_changes: [], memory_transfer: null}],
  line_explanations: [{source_line: 1, summary: '값 준비 → 초기값 기록', detail: '이 C 줄에 연결된 명령어입니다.', steps: []}],
  cycle_explanations: [{history_index: 0, cycle: 0, events: [{type: 'branch', title: '제어 흐름 판단', summary: '분기', detail: 'CORE가 보고한 분기 목적지 0x10008'}]}],
};
seedTutor(bundle);
const forcePipeline=new URLSearchParams(location.search).get('mode')==='pipeline';
const simulation = {...single,simulator:{...single.simulator,mode:forcePipeline?'pipeline':'single'}, tutor: bundle} as SimulationResult;
const mappedRows = [{pc: '0x10000', text: 'addi a0, zero, 3', sourceLine: 1},
  {pc: '0x10004', text: 'addi a1, a0, 1', sourceLine: 1}, {pc: '0x10008', text: 'nop', sourceLine: null},
  {pc:'0x1000C',text:'addi a2, a1, 1',sourceLine:2}];
const followHistory = [0, 1].map(index => ({...simulation.history[0], stage_activity: undefined,
  buffers: {...simulation.history[0].buffers, EX: null, MEM: null, WB: null, ID: null,
    IF: {pc: index ? '0x10004' : '0x10000', assembly: index ? 'addi a1,a0,1' : 'addi a0,zero,3', status: 'normal'}}}));

export function TutorHarness() {
  const [sourceLine, setSourceLine] = useState(1);
  const [target, setTarget] = useState<'c' | 'asm'>('c');
  const [selected, setSelected] = useState(true);
  const [asmIndex, setAsmIndex] = useState(0);
  const [followStep, setFollowStep] = useState<number | null>(null);
  const [pipeline, setPipeline] = useState(false);
  const [playing,setPlaying]=useState(false);
  const [intent,setIntent]=useState({kind:'asm' as 'c'|'asm',revision:0});
  const followed = followStep == null ? simulation : {...simulation, history: followHistory,
    simulator: {...simulation.simulator, mode: pipeline||forcePipeline ? 'pipeline' : 'single'}};
  const current = followStep == null ? simulation.history[0] : followHistory[followStep];
  const displayed = pipeline && followStep != null ? {...current, buffers: {...current.buffers, EX: current.buffers.IF, IF: null}} : current;
  const data = pipeline && followStep != null ? {...followed, history: followed.history.map((step, index) => index === followStep ? displayed : step)} : followed;
  return <div style={{height: 650, display: 'flex', flexDirection: 'column'}}><button onClick={() => setTarget(target === 'c' ? 'asm' : 'c')}>switch target</button>
    <button onClick={() => setSelected(!selected)}>toggle selection</button>
    <button onClick={() => setAsmIndex(1)}>select second ASM</button>
    <button onClick={() => setAsmIndex(2)}>select unmapped ASM</button>
    <button onClick={() => setSourceLine(2)}>select second C line</button>
    <button onClick={() => {setSelected(false); setFollowStep(0);}}>follow first step</button>
    <button onClick={() => {setSelected(false); setFollowStep(1);}}>follow next step</button>
    <button onClick={() => setPipeline(!pipeline)}>toggle pipeline focus</button>
    <button onClick={()=>setPlaying(true)}>global play</button><output data-testid="playback-state">{playing?'playing':'paused'}</output>
    <button onClick={()=>setIntent(value=>({kind:'c',revision:value.revision+1}))}>click C source</button>
    <button onClick={()=>setIntent(value=>({kind:'asm',revision:value.revision+1}))}>click ASM source</button>
    <TutorArea simulationData={data as SimulationResult} currentCycleData={displayed} translationSource={'int x = 3;\nreturn x;'}
      isPlaying={playing}
      selectionKind={intent.kind} selectionRevision={intent.revision}
      mappedRows={mappedRows}
      isUserSelected={selected}
      selectedTranslationLine={selected ? sourceLine : null} selectedAsmIndex={selected ? asmIndex : null} activeTarget={target} />
  </div>;
}
createRoot(document.getElementById('root')!).render(<TutorHarness />);
