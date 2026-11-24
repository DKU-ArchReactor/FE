import {useEffect,useMemo,useState} from 'react';
import type {CycleHistoryItem,SimulationResult} from '@/type/simulation';
import type {MappedAssemblyRow} from '../utils/translationCompile';
import {analyzeAsmInstruction,fetchTutor,instructionAt} from '../utils/tutorAnalysis';
import TutorPipelineCarousel from './TutorPipelineCarousel';
import './TutorCycleCards.css';
import {buildMultiCycleTraceRows} from '../utils/multiCycleTrace';
import {explainForwarding,explainStall,explainBubble} from '../utils/tutorReadable';

const stages=['IF','ID','EX','MEM','WB'] as const;
const names={IF:'명령어 인출',ID:'명령어 해독',EX:'연산·조건 판단',MEM:'메모리 접근',WB:'완료·필요 시 레지스터 기록'};
type Props={cycle:CycleHistoryItem|null;simulation:SimulationResult;rows:MappedAssemblyRow[];source:string[];historyIndex?:number;selectedIndex?:number|null;sourceLine?:number|null;selectionKind?:'c'|'asm';selectionRevision?:number;isUserSelected?:boolean;headerTarget?:HTMLElement|null};

export default function TutorPipelineLesson({cycle,simulation,rows,source,historyIndex,selectedIndex,sourceLine,selectionKind,selectionRevision,isUserSelected=false,headerTarget}:Props){
  const rowsByPc=useMemo(()=>new Map(rows.filter(row=>row.pc).map(row=>[Number(row.pc),row])),[rows]);
  const [,refresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    const lines=new Set(stages.flatMap(stage=>{
      const value=cycle?.stage_activity?.[stage]??cycle?.buffers[stage];
      const line=value?.pc?rowsByPc.get(Number(value.pc))?.sourceLine:null;
      return line!=null?[line]:[];
    }));
    const items=[...lines].flatMap(line=>source[line-1]?.trim()?[{kind:'c' as const,text:source[line-1].trim(),line}]:[]);
    void fetchTutor(items,controller.signal).then(changed=>{if(changed&&!controller.signal.aborted)refresh(value=>value+1);}).catch(()=>{});
    return ()=>controller.abort();
  },[cycle,rowsByPc,source]);
  const events=cycle?.cycle_events;
  const trace=useMemo(()=>buildMultiCycleTraceRows(simulation.history,false),[simulation.history]);
  const entries=trace.flatMap(row=>{const cell=row.cells[historyIndex??-1];return cell?[{traceRow:row,cell}]:[];});
  const step=historyIndex!=null?simulation.tutor?.execution_steps?.find(step=>step.history_index===historyIndex):undefined;
  const cards=entries.flatMap(({traceRow,cell})=>{
    const stage=cell.stage;
    const value={pc:traceRow.pc,assembly:traceRow.assembly,status:cell.isStall?'stall':cell.isBubble?'bubble':'normal',source_line:null,flush_info:undefined};
    const bubble=Boolean(cell.isBubble||cell.type==='BUBBLE');
    const stalled=Boolean(cell.isStall||cell.type==='STALL_IF'||cell.type==='STALL_ID');
    const flushed=Boolean(bubble&&events?.control_hazard?.has_flush&&events.control_hazard.flushed_stages?.includes(stage));
    const empty=!value||/^(empty|bubble)$/i.test(value.status)||value.assembly==='bubble';
    if(empty&&!stalled&&!flushed&&!bubble)return [];
    const row=rowsByPc.get(Number(value.pc));
    const asm=value?.assembly&& !/^bubble$/i.test(value.assembly)?value.assembly:row?.text??(stalled?events?.stall?.assembly:null);
    const instruction=row?instructionAt(simulation.tutor,row.pc):undefined;
    const meaning=asm?analyzeAsmInstruction(asm,instruction?.explanation).explanation:null;
    const line=row?.sourceLine??value?.source_line;
    const c=line!=null?source[line-1]?.trim():undefined;
    const observation=step?.instruction_observations?.find(item=>item.stage===stage&&value?.pc&&Number(item.pc)===Number(value.pc));
    const forward=Boolean(!bubble&&!stalled&&events?.forwarding?.has_forwarded&&events.forwarding.assembly?.replace(/\s/g,'')===asm?.replace(/\s/g,''));
    const error=events?.runtime_error?.has_error&&events.runtime_error.stage===stage?events.runtime_error:null;
    const stallExplanation=explainStall(cycle,stage);
    const bubbleStart=Object.entries(traceRow.cells).find(([,value])=>value.isBubble||value.type==='BUBBLE')?.[0];
    const origin=bubbleStart!=null?simulation.history[Number(bubbleStart)]?.cycle_events:null;
    const bubbleExplanation=explainBubble(origin);
    const cause=error?.message??(stalled?stallExplanation.cause:bubble?bubbleExplanation.cause:forward?'현재 명령어에 필요한 새 값이 아직 레지스터 파일에 기록되기 전입니다. 이전 값을 읽지 않도록 앞선 명령어의 결과를 직접 사용합니다.':null);
    const action=error?'오류가 발생한 명령어와 입력값·접근 주소를 확인하고 코드를 수정합니다.':stalled?stallExplanation.solution:bubble?bubbleExplanation.solution:forward?explainForwarding(events?.forwarding?.forwarding_info??null):null;
    return [{id:traceRow.id,instruction,asmLine:row?rows.indexOf(row)+1:undefined,stage,badge:stalled?'STL':bubble||flushed?'BBL':stage,status:error?'실행 오류':stalled?'스톨 발생':bubble||flushed?'버블':forward?'포워딩 발생':names[stage],row,asm,meaning,line,c,observation,cause,action,bubble}];
  });
  const [selection,setSelection]=useState({cycle,index:0,revision:selectionRevision});
  const manual=selection.revision!==selectionRevision;
  const matched=manual?cards.findIndex(card=>selectionKind==='c'?card.line===sourceLine:card.row===rows[selectedIndex??-1]):-1;
  const index=manual?Math.max(0,matched):selection.cycle===cycle?Math.min(selection.index,Math.max(0,cards.length-1)):0;
  return <TutorPipelineCarousel headerTarget={headerTarget} cards={cards} index={index} historyIndex={historyIndex} isUserSelected={isUserSelected} unmatched={manual&&matched<0} onSelect={next=>setSelection({cycle,revision:selectionRevision,index:next})}/>;
}
