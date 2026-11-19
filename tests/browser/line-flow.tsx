import {StrictMode, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SingleCycleDatapath} from '../../src/pages/Main/components/SingleCycleDatapath';
import TutorArea from '../../src/pages/Main/components/TutorArea';
import type {SimulationResult} from '../../src/type/simulation';
import fixture from './fixtures/line-flow.json';
import '../../src/index.css';

const run = fixture as unknown as SimulationResult;
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
createRoot(document.getElementById('root')!).render(<StrictMode><LineFlowHarness/></StrictMode>);
