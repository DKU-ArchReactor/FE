import {useState} from 'react';
import type {CycleHistoryItem,SimulationResult} from '@/type/simulation';
import type {MappedAssemblyRow} from '../utils/translationCompile';
import {analyzeAsmInstruction,instructionAt} from '../utils/tutorAnalysis';
import {tutorInstructionDetails} from '../utils/tutorInstructionDetails';
import './TutorPipelineFlow.css';
import TutorDetailReader,{type ReadingSection} from './TutorDetailReader';
import TutorLineSplit from './TutorLineSplit';

export default function TutorPipelineLesson({cycle,simulation,rows,source,historyIndex,selectedIndex,sourceLine,selectionKind='asm',selectionRevision=0}:{cycle:CycleHistoryItem|null;simulation:SimulationResult;rows:MappedAssemblyRow[];source:string[];historyIndex?:number;selectedIndex?:number|null;sourceLine?:number|null;selectionKind?:'c'|'asm';selectionRevision?:number}){
  const [selection,setSelection]=useState<{cycle:CycleHistoryItem|null;index:number}|null>(null);
  const [reading,setReading]=useState(false);
  const [revision,setRevision]=useState(selectionRevision);
  if(revision!==selectionRevision){setRevision(selectionRevision);setSelection(null);setReading(true);}
  const index=selection?.cycle===cycle?selection.index:selectedIndex??rows.findIndex(row=>row.sourceLine===sourceLine);
  const row=index!=null?rows[index]:undefined;
  const events=cycle?.cycle_events;
  const pages:ReadingSection[]=[];
  if(events?.stall?.has_stall)pages.push({title:'필요한 값이 준비될 때까지 기다립니다',blocks:[{label:`스톨 · ${events.stall.stage??'단계 미제공'}`,text:events.stall.stall_desc??'의존하는 값이나 자원이 준비되지 않아 진행을 기다립니다.'},...(events.stall.assembly?[{label:'기다리는 명령어',text:events.stall.assembly}]:[])]});
  if(events?.forwarding?.has_forwarded)pages.push({title:'포워딩 · 앞선 명령어의 결과를 바로 사용해요',blocks:[{label:events.forwarding.assembly??'값을 사용하는 명령어',text:'앞선 명령어의 결과를 레지스터 파일에 저장한 뒤 다시 읽는 대신, 필요한 연산 입력으로 직접 전달합니다.'},{label:'실제 전달 경로',text:`출발: ${events.forwarding.forwarding_info?.forwarded_from?.join(', ')||'기록 미제공'}\n대상 레지스터: ${events.forwarding.forwarding_info?.target_register?.join(', ')||'기록 미제공'}`}]});
  if(events?.control_hazard?.has_flush)pages.push({title:'변경된 실행 경로에 맞춰 명령어를 취소합니다',blocks:[{label:'플러시',text:`취소된 단계: ${events.control_hazard.flushed_stages?.join(', ')||'기록 미제공'}\n다음 실행 주소: ${events.control_hazard.redirect_pc??'기록 미제공'}`},{text:'취소된 명령어는 결과를 반영하지 않습니다. 이 기록만으로 분기 예측 실패라고 단정하지 않습니다.'}]});
  const current=simulation.tutor?.execution_steps?.find(step=>step.history_index===historyIndex);
  if(!pages.length)pages.push({title:'이 클록에서 진행되는 작업',blocks:[{text:'아래는 이 클록에 보고된 실제 작업입니다. ASM 줄을 클릭하면 해당 명령어의 의미와 실행 기록을 확인할 수 있습니다.'},...(current?.instruction_observations??[]).map(value=>({label:`${value.stage} · ${value.pc}`,text:value.summary}))]});
  if(row&&reading){
    const item=instructionAt(simulation.tutor,row.pc);
    const info=analyzeAsmInstruction(row.text,item?.explanation);
    const detail=item?tutorInstructionDetails(item,simulation.tutor,historyIndex):null;
    const stage=Object.entries(cycle?.stage_activity??cycle?.buffers??{}).find(([,value])=>value?.pc&&Number(value.pc)===Number(row.pc))?.[0];
    const observed=stage?detail?.observations.get(stage):undefined;
    pages.unshift({title:`${stage??'선택한 명령어'} · ${info.action}`,blocks:[{label:row.text,text:info.explanation},{label:'현재 시점의 실제 작업',text:observed?observed.summary:'현재 단계의 구체적인 값 기록은 제공되지 않았습니다. 명령어의 의미와 실제 관찰값을 구분해서 확인하세요.'}]});
  }
  return <div className="pipeline-lesson">
    <div className="pipeline-lesson-toolbar"><strong>{reading?'선택한 코드 설명':'현재 클록 해설'}</strong>{reading?<button onClick={()=>{setReading(false);setSelection(null);}}>← 현재 클록 보기</button>:<span className="pipeline-lesson-hint">ASM 줄을 클릭하면 명령어 해설을 볼 수 있어요</span>}</div>
    {reading&&(row||sourceLine!=null)?<TutorLineSplit rows={rows} source={source} line={selectionKind==='c'?sourceLine:row?.sourceLine} selectedIndex={index} requestedView={selectionKind} selectionKey={selectionRevision} simulation={simulation} historyIndex={historyIndex} singleScreen hasC={source.some(line=>line.trim())} onSelect={value=>setSelection({cycle,index:value})}/>:<div className="dev-tutor-detail-window pipeline-lesson-reader"><TutorDetailReader sections={pages} documentKey={`${historyIndex}-${index}`}/></div>}
  </div>;
}



