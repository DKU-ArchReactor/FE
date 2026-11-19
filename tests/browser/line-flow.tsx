import {StrictMode, useState, useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {SingleCycleDatapath} from '../../src/pages/Main/components/SingleCycleDatapath';
import {useSimulationPlayback} from '../../src/pages/Main/hooks/useSimulationPlayback';
import {singleFlowDuration} from '../../src/pages/Main/utils/instructionFlow';
import type {SimulationResult} from '../../src/type/simulation';
import fixture from './fixtures/line-flow.json';
import '../../src/index.css';

const run = structuredClone(fixture) as unknown as SimulationResult;
// Synthetic display stress cases, separate from the recorded execution regression.
const geometry = new URLSearchParams(location.search).get('geometry');
const cases: Record<string, {text: string; reads: string[]; writes: string[]}> = {
  add: {text:'add a5,a4,a5',reads:['x14','x15'],writes:['x15']},
  lw: {text:'lw a5,-4(s0)',reads:['x8'],writes:['x15']},
  sw: {text:'sw t1,4(s0)',reads:['x6','x8'],writes:[]},
  bne: {text:'bne a4,a5,8',reads:['x14','x15'],writes:[]},
  jal: {text:'jal ra,8',reads:[],writes:['x1']},
  ecall: {text:'ecall',reads:[],writes:[]},
  sra: {text:'sra a5,a4,a5',reads:['x14','x15'],writes:['x15']},
  srai: {text:'srai a5,a4,2',reads:['x14'],writes:['x15']},
  jalr: {text:'jalr ra,8(a5)',reads:['x15'],writes:['x1']},
};
if (geometry && cases[geometry]) {
  const item=run.tutor!.asm_instructions![2], frame=run.history[2], dp=frame.datapath!;
  const variant=cases[geometry];
  item.text=variant.text;
  item.explanation={...item.explanation,opcode:geometry,reads:variant.reads,writes:variant.writes};
  const encodings: Record<string,string> = {add:'0x00F707B3',lw:'0xFFC42783',sw:'0x00642223',bne:'0x00F71463',jal:'0x008000EF',ecall:'0x00000073',sra:'0x40F757B3',srai:'0x40275793',jalr:'0x008780E7'};
  dp.instruction.raw=encodings[geometry];
  dp.control_signals={...dp.control_signals,reg_write:variant.writes.length>0,mem_read:geometry==='lw',mem_write:geometry==='sw'};
  dp.alu.input_1='0x80000000';dp.alu.input_2='0x7FFFFFFF';dp.alu.result='0xFFFFFFFF';
  if(dp.registers.rs1) dp.registers.rs1.value='0x80000000';
  if(dp.registers.rs2) dp.registers.rs2.value='0x7FFFFFFF';
  if(dp.registers.rd) dp.registers.rd.write_data=geometry==='jal'?'0x00010040':'0xFFFFFFFF';
  dp.data_memory={address:'0x7FFFFFFC',read_data:'0xFFFFFFFF',write_data:'0xFFFFFFFF'};
  dp.immediate={dec:geometry==='bne'||geometry==='jal'?8:-4};
  dp.next_pc=geometry==='bne'||geometry==='jal'?'0x00010044':'0x00010040';
  if(geometry==='lw'||geometry==='sw') {
    dp.alu.input_2='0xFFFFFFFC';dp.alu.result='0x7FFFFFFC';
    dp.registers.rs1={name:'s0',num:8,value:'0x80000000'};
    dp.registers.rs2=geometry==='sw'?{name:'a5',num:15,value:'0xFFFFFFFF'}:null;
  }
  if(geometry==='sw') {
    dp.alu={...dp.alu,input_1:'0x00002000',input_2:'0x00000004',result:'0x00002004'};
    dp.registers.rs1={name:'s0',num:8,value:'0x00002000'};
    dp.registers.rs2={name:'t1',num:6,value:'0x12345678'};
    dp.immediate={dec:4};dp.data_memory={address:'0x00002004',write_data:'0x12345678'};
  }
  if(geometry==='sra'||geometry==='srai') {
    dp.alu.input_2='0x00000402';dp.alu.result='0xE0000000';
    if(dp.registers.rs2)dp.registers.rs2.value='0x00000402';
    if(dp.registers.rd)dp.registers.rd.write_data='0xE0000000';
    dp.immediate={dec:2};
  }
  if(geometry==='jalr') {
    dp.alu={...dp.alu,input_1:'0x00000000',input_2:'0x00000000',result:'0x00000000'};
    dp.registers.rs1={num:15,value:'0x0001003C'};dp.immediate={dec:8};dp.next_pc='0x00010044';
    if(dp.registers.rd)dp.registers.rd.write_data='0x00010040';
  }
}
const rows = run.tutor!.asm_instructions!.map(item => ({pc: item.pc!, text: item.text, sourceLine: item.source_line ?? null}));
export function LineFlowHarness() {
  const [position, setPosition] = useState(2);
  const [selected, setSelected] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const frame = run.history[position];
  const props = {currentData: frame, prevData: position > 0 ? run.history[position - 1] : null, simulationData: run,
    context: {onPausePlayback: () => setPaused(true), source: '/* Observe load -> add -> store. */\nint main(void) {\n int a = 11;\n int b = 7;\n int sum = a + b;\n return sum;\n}', rows,
      selectedAsmIndex: selected, selectedCLine: 5,
      onSelectAsm: (_line: number | null, index: number) => setSelected(index), onJumpToCycle: (cycle: number) => setPosition(cycle - 1)}};
  return <main style={{height: '96vh', maxWidth: 1180, margin: 'auto', display: 'flex', flexDirection: 'column'}}>
    <div style={{display: 'flex', gap: 16, padding: 8}}>
      <button onClick={() => {setPosition(Math.max(0, position - 1)); setSelected(null);}}>previous clock</button>
      <button onClick={() => {setPosition(Math.min(run.history.length - 1, position + 1)); setSelected(null);}}>next clock</button>
      <button onClick={() => document.documentElement.classList.toggle('dark')}>theme</button>
      <output>{paused ? 'playback paused' : 'playback running'}</output>
    </div>
    <SingleCycleDatapath {...props} lessonContext={props.context}/>
  </main>;
}
function PlaybackTimingHarness() {
  const clear = useCallback(() => {}, []);
  const single = new URLSearchParams(location.search).get('mode') !== 'pipeline';
  const playback = useSimulationPlayback({simulationData: run, mappedAssemblyRows: rows, isSingleEngine: single,
    editorTarget: 'c', translationSelectedLine: null, onClearSelection: clear});
  return <main style={{height:'96vh',display:'flex',flexDirection:'column'}}>
    <div><button onClick={playback.handleTogglePlay}>play</button><button onClick={() => playback.setPlaySpeed(500)}>2x</button><button onClick={playback.handleReset}>reset</button><button onClick={playback.handleStepForward}>step</button><output data-testid="timing-delay">{playback.singlePlaybackDelay}</output><output data-testid="timing-clock">{playback.currentCycle}</output><output data-testid="global-playing">{String(playback.isPlaying)}</output></div>
    {single&&<SingleCycleDatapath currentData={playback.currentData} prevData={playback.prevData} simulationData={run}
      lessonContext={{rows,isPlaying:playback.isPlaying,flowDurationMs:singleFlowDuration(playback.playSpeed),onPausePlayback:playback.pauseForFlow}}/>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode>{new URLSearchParams(location.search).has('timing') ? <PlaybackTimingHarness/> : <LineFlowHarness/>}</StrictMode>);
