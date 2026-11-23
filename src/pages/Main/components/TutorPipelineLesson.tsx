import {useEffect,useMemo,useState} from 'react';
import type {CycleHistoryItem,SimulationResult} from '@/type/simulation';
import type {MappedAssemblyRow} from '../utils/translationCompile';
import {analyzeAsmInstruction,analyzeCLine,fetchTutor,instructionAt} from '../utils/tutorAnalysis';
import {TutorText} from './TutorEvidence';
import './TutorCycleCards.css';
import {buildMultiCycleTraceRows} from '../utils/multiCycleTrace';
import {explainForwarding,explainHazardReason} from '../utils/tutorReadable';

const stages=['IF','ID','EX','MEM','WB'] as const;
const names={IF:'명령어 인출',ID:'명령어 해독',EX:'연산·조건 판단',MEM:'메모리 접근',WB:'완료·필요 시 레지스터 기록'};
type Props={cycle:CycleHistoryItem|null;simulation:SimulationResult;rows:MappedAssemblyRow[];source:string[];historyIndex?:number;selectedIndex?:number|null;sourceLine?:number|null;selectionKind?:'c'|'asm';selectionRevision?:number};

export default function TutorPipelineLesson({cycle,simulation,rows,source,historyIndex,selectedIndex,sourceLine,selectionKind,selectionRevision}:Props){
  const [,refresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    const lines=new Set(stages.flatMap(stage=>{
      const value=cycle?.stage_activity?.[stage]??cycle?.buffers[stage];
      const line=rows.find(row=>row.pc&&value?.pc&&Number(row.pc)===Number(value.pc))?.sourceLine;
      return line!=null?[line]:[];
    }));
    const items=[...lines].flatMap(line=>source[line-1]?.trim()?[{kind:'c' as const,text:source[line-1].trim(),line}]:[]);
    void fetchTutor(items,controller.signal).then(changed=>{if(changed&&!controller.signal.aborted)refresh(value=>value+1);}).catch(()=>{});
    return ()=>controller.abort();
  },[cycle,rows,source]);
  const events=cycle?.cycle_events;
  const trace=useMemo(()=>buildMultiCycleTraceRows(simulation.history,false),[simulation.history]);
  const entries=trace.flatMap(row=>{const cell=row.cells[historyIndex??-1];return cell?[{traceRow:row,cell}]:[];});
  const cards=entries.flatMap(({traceRow,cell})=>{
    const stage=cell.stage;
    const value={pc:traceRow.pc,assembly:traceRow.assembly,status:cell.isStall?'stall':cell.isBubble?'bubble':'normal',source_line:null,flush_info:undefined};
    const bubble=Boolean(cell.isBubble||cell.type==='BUBBLE');
    const stalled=Boolean(cell.isStall||cell.type==='STALL_IF'||cell.type==='STALL_ID');
    const flushed=Boolean(bubble&&events?.control_hazard?.has_flush&&events.control_hazard.flushed_stages?.includes(stage));
    const empty=!value||/^(empty|bubble)$/i.test(value.status)||value.assembly==='bubble';
    if(empty&&!stalled&&!flushed&&!bubble)return [];
    const row=rows.find(row=>row.pc&&value?.pc&&Number(row.pc)===Number(value.pc));
    const asm=value?.assembly&& !/^bubble$/i.test(value.assembly)?value.assembly:row?.text??(stalled?events?.stall?.assembly:null);
    const instruction=row?instructionAt(simulation.tutor,row.pc):undefined;
    const meaning=asm?analyzeAsmInstruction(asm,instruction?.explanation).explanation:null;
    const line=row?.sourceLine??value?.source_line;
    const c=line!=null?source[line-1]?.trim():undefined;
    const observation=simulation.tutor?.execution_steps?.find(step=>step.history_index===historyIndex)?.instruction_observations?.find(item=>item.stage===stage&&value?.pc&&Number(item.pc)===Number(value.pc));
    const forward=Boolean(cell.isForwarded||events?.forwarding?.has_forwarded&&events.forwarding.stage===stage);
    const error=events?.runtime_error?.has_error&&events.runtime_error.stage===stage?events.runtime_error:null;
    const bubbleStart=Object.entries(traceRow.cells).find(([,value])=>value.isBubble||value.type==='BUBBLE')?.[0];
    const origin=bubbleStart!=null?simulation.history[Number(bubbleStart)]?.cycle_events:null;
    const bubbleCause=origin?.control_hazard?.has_flush?'분기·점프로 실행 경로가 바뀌면서, 기존 경로에서 가져온 이 명령어가 취소되었습니다. 취소된 명령어가 실행표에서 버블로 이어져 표시됩니다.':origin?.stall?.has_stall?'필요한 값을 기다리기 위해 파이프라인 진행을 멈추는 과정에서 빈 작업이 삽입되었습니다.':'버블은 실행할 유효한 명령어가 없는 상태입니다. 초기 파이프라인 채우기, 스톨 때 삽입된 빈 작업, 경로 변경에 따른 취소 등으로 생길 수 있습니다.';
    const cause=error?.message??(stalled?explainHazardReason(events?.stall?.stall_desc??events?.stall?.stall_reason,'진행에 필요한 값이나 자원이 준비될 때까지 명령어를 대기시킵니다.'):flushed?explainHazardReason(events?.control_hazard?.flush_reason,'실행 경로가 변경되어 기존 경로의 명령어가 취소되었습니다.'):bubble?bubbleCause:forward?'필요한 결과가 아직 레지스터 파일에 기록되기 전이므로 우회 경로로 값을 전달합니다.':null);
    const action=error?'실행 오류가 보고되었습니다. 오류 원인과 실행 상태를 확인하세요.':stalled?'이 단계의 명령어 진행을 잠시 보류합니다. 필요한 값이나 자원이 준비되면 다음 단계로 진행합니다.':flushed?`기존 명령어의 결과를 반영하지 않고 변경된 경로에서 실행합니다.${events?.control_hazard?.redirect_pc?` 다음 주소: ${events.control_hazard.redirect_pc}`:''}`:forward?explainForwarding(events?.forwarding?.forwarding_info??null):null;
    return [{stage,badge:stalled?'STL':bubble||flushed?'BBL':stage,status:error?'실행 오류':stalled?'스톨 발생':bubble||flushed?'버블':forward?'포워딩 발생':names[stage],row,asm,meaning,line,c,observation,cause,action,bubble}];
  });
  const [selection,setSelection]=useState({cycle,index:0,revision:selectionRevision});
  const manual=selection.revision!==selectionRevision;
  const matched=manual?cards.findIndex(card=>selectionKind==='c'?card.line===sourceLine:card.row===rows[selectedIndex??-1]):-1;
  const index=manual?Math.max(0,matched):selection.cycle===cycle?Math.min(selection.index,Math.max(0,cards.length-1)):0;
  const card=cards[index];
  const move=(delta:number)=>setSelection({cycle,revision:selectionRevision,index:Math.max(0,Math.min(cards.length-1,index+delta))});
  return <section className="tutor-cycle-cards" aria-label="사이클 상황 카드" tabIndex={0} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}}}>
    <header><strong>현재 사이클 {historyIndex!=null?historyIndex+1:'—'}</strong><span>{cards.length}개 상황{manual&&matched<0?' · 선택한 코드는 이 사이클에서 실행 중이지 않습니다.':''}</span></header>
    {card?<article key={`${historyIndex}-${card.stage}`} className="tutor-cycle-card" data-stage={card.stage}>
      <div className="tutor-cycle-card-title"><span data-kind={card.badge}>{card.badge==='STL'?<svg aria-label="STL" width="44" height="27" viewBox="0 0 100 68"><path d="M8 16 C5 16 4 19 4 22 L4 46 C4 49 5 52 8 52 L58 52 L58 60 C58 64 63 65 66 62 L96 36 C98 34 98 34 96 32 L66 6 C63 3 58 4 58 8 L58 16 Z" fill="#fde68a" stroke="#f59e0b" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/><text x="45" y="35" dominantBaseline="middle" textAnchor="middle" fill="#b45309" fontSize="23" fontWeight="800">STL</text></svg>:card.badge==='BBL'?<svg aria-label="BBL" width="44" height="29" viewBox="0 0 100 68"><path d="M18 48 C5 48 5 32 14 26 C8 15 20 6 30 14 C36 3 50 2 58 10 C66 2 80 5 84 16 C96 16 98 30 91 38 C98 48 88 60 76 56 C70 66 56 66 48 58 C40 66 26 66 22 56 C14 58 10 52 18 48 Z" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="3.2" strokeLinejoin="round"/><text x="51" y="36" dominantBaseline="middle" textAnchor="middle" fill="#0284c7" fontSize="23" fontWeight="800">BBL</text></svg>:card.badge}</span><h3>{card.status}</h3><small>{card.stage} · {names[card.stage]}</small></div>
      <div className="tutor-cycle-card-body">
        <section className="tutor-cycle-code"><strong>ASM</strong><code>{card.asm??'실행 명령어 정보 없음'}</code>{card.meaning&&<p><TutorText text={card.meaning}/></p>}</section>
        {card.c&&<section className="tutor-cycle-code tutor-cycle-c"><strong>C L{card.line}</strong><code>{card.c}</code><p>{analyzeCLine(card.c,card.line!).summary}</p></section>}
        {!card.cause&&<section className="tutor-cycle-observation"><strong>{card.observation?'이 사이클의 실제 동작':'이 단계에서 하는 일'}</strong><p>{card.observation?.summary??(card.cause?'아래 발생 원인과 해결 방법을 확인하세요.':({IF:'PC가 가리키는 주소에서 명령어를 가져옵니다.',ID:'명령어를 해독하고 필요한 레지스터 입력을 확인합니다.',EX:'연산·주소 계산·조건 판단을 수행합니다.',MEM:/^(lb|lbu|lh|lhu|lw)\b/i.test(card.asm??'')?'계산한 주소의 메모리 값을 읽습니다.':/^(sb|sh|sw)\b/i.test(card.asm??'')?'계산한 주소에 레지스터 값을 저장합니다.':'이 명령어는 데이터 메모리를 읽거나 쓰지 않고 다음 단계로 진행합니다.',WB:/^(sb|sh|sw|beq|bne|blt|bge|bltu|bgeu)\b/i.test(card.asm??'')?'이 명령어는 일반 레지스터에 결과를 기록하지 않습니다.':'기록 대상이 있는 명령어는 결과를 레지스터에 반영합니다.'})[card.stage])}</p></section>}
        {card.cause&&<section className="tutor-cycle-cause"><strong>발생 원인</strong><p>{card.cause}</p></section>}
        {(card.action||card.bubble)&&<section className="tutor-cycle-action"><strong>해결 방법</strong><p>{card.action??'버블은 연산이나 결과 기록을 수행하지 않습니다. 유효한 명령어가 진행할 수 있도록 빈 작업을 통과시킵니다.'}</p></section>}
      </div>
    </article>:<div className="tutor-cycle-empty">이 사이클에는 실행 중인 명령어나 보고된 대기·취소 상황이 없습니다.</div>}
    <nav aria-label="사이클 상황 이동"><button aria-label="이전 상황" disabled={index===0||!card} onClick={()=>move(-1)}><span aria-hidden="true">←</span> 이전</button><span>{card?index+1:0} / {cards.length}<small>이 사이클의 상황</small></span><button aria-label="다음 상황" disabled={!card||index>=cards.length-1} onClick={()=>move(1)}>다음 <span aria-hidden="true">→</span></button></nav>
  </section>;
}




