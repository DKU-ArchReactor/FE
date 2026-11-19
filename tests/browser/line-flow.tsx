import {StrictMode, useState, useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {SingleCycleDatapath} from '../../src/pages/Main/components/SingleCycleDatapath';
import TutorArea from '../../src/pages/Main/components/TutorArea';
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
  sw: {text:'sw a5,-4(s0)',reads:['x15','x8'],writes:[]},
  bne: {text:'bne a4,a5,8',reads:['x14','x15'],writes:[]},
  jal: {text:'jal ra,8',reads:[],writes:['x1']},
  ecall: {text:'ecall',reads:[],writes:[]},
};
if (geometry && cases[geometry]) {
  const item=run.tutor!.asm_instructions![2], frame=run.history[2], dp=frame.datapath!;
  const variant=cases[geometry];
  item.text=variant.text;
  item.explanation={...item.explanation,opcode:geometry,reads:variant.reads,writes:variant.writes};
  delete item.instruction_format;
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
}
const rows = run.tutor!.asm_instructions!.map(item => ({pc: item.pc!, text: item.text, sourceLine: item.source_line ?? null}));
export function LineFlowHarness() {
  const [position, setPosition] = useState(2);
  const [selected, setSelected] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
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
      <button onClick={() => setExpanded(value => !value)}>show tutor</button>
      <button onClick={() => document.documentElement.classList.toggle('dark')}>theme</button>
      <output>{paused ? 'playback paused' : 'playback running'}</output>
    </div>
    {expanded ? <TutorArea simulationData={run} currentCycleData={frame} mappedRows={rows} translationSource={props.context.source}
      selectedTranslationLine={5} selectedAsmIndex={selected ?? position} isUserSelected onSelectAsm={props.context.onSelectAsm}/>
      : <SingleCycleDatapath {...props} lessonContext={props.context}/>}
  </main>;
}
function PlaybackTimingHarness() {
  const clear = useCallback(() => {}, []);
  const single = new URLSearchParams(location.search).get('mode') !== 'pipeline';
  const playback = useSimulationPlayback({simulationData: run, mappedAssemblyRows: rows, isSingleEngine: single,
    editorTarget: 'c', translationSelectedLine: null, onClearSelection: clear});
  return <main style={{height:'96vh',display:'flex',flexDirection:'column'}}>
    <div><button onClick={playback.handleTogglePlay}>play</button><button onClick={() => playback.setPlaySpeed(500)}>2x</button><button onClick={playback.handleReset}>reset</button><button onClick={playback.handleStepForward}>step</button><output data-testid="timing-clock">{playback.currentCycle}</output><output data-testid="global-playing">{String(playback.isPlaying)}</output></div>
    {single&&<SingleCycleDatapath currentData={playback.currentData} prevData={playback.prevData} simulationData={run}
      lessonContext={{rows,isPlaying:playback.isPlaying,flowDurationMs:singleFlowDuration(playback.playSpeed),onPausePlayback:()=>playback.setIsPlaying(false)}}/>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode>{new URLSearchParams(location.search).has('timing') ? <PlaybackTimingHarness/> : <LineFlowHarness/>}</StrictMode>);
