import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import TutorSingleMode from '../../src/pages/Main/components/TutorSingleMode';
import {seedTutor,type TutorBundle} from '../../src/pages/Main/utils/tutorAnalysis';
import type {SimulationResult} from '../../src/type/simulation';
import single from './fixtures/single.json';
import '../../src/index.css';

const rows=[
  {pc:'0x10000',text:'auipc ra, 0',sourceLine:null},
  {pc:'0x10004',text:'jalr ra, ra, 20',sourceLine:null},
  {pc:'0x10008',text:'addi a0, zero, 5',sourceLine:2},
];
const bundle:TutorBundle={schema_version:'1.0',asm_instructions:rows.map((row,i)=>({
  pc:row.pc,text:row.text,source_line:row.sourceLine,
  source_file:i===0?'start.S':undefined,
  source_context:i===0?'startup_source':i===2?'user_source':'unknown',
  explanation:{kind:'asm',category:'instruction',title:'명령어',
    summary:i===0?'현재 명령어가 놓인 주소를 ra 레지스터에 복사합니다.':i===1?'ra에 담긴 주소에 20바이트를 더한 위치로 점프합니다.':'숫자 5를 a0에 저장합니다.',detail:'레지스터의 값을 사용합니다.'},
}))};
seedTutor(bundle);
const simulation={...single,tutor:bundle} as unknown as SimulationResult;
export function App(){
  const [index,setIndex]=useState(2);
  const [view,setView]=useState<'c'|'asm'>('c');
  return <>
    {rows.map((row,i)=><button key={i} onClick={()=>{setIndex(i);setView('asm');}}>select ASM {i+1}</button>)}
    <button onClick={()=>{setIndex(2);setView('c');}}>select C</button>
    <button onClick={()=>{setIndex(0);setView('asm');}}>play startup</button>
    <div style={{height:400,width:900}}>
      <TutorSingleMode rows={rows} source={['int main(void) {','int a = 5;']} line={2}
        selectedIndex={index} requestedView={view} selectionKey={index+(view==='c'?10:0)}
        simulation={simulation} onSelect={setIndex} hasC isUserSelected/>
    </div>
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);
