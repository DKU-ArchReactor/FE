import {useEffect,useMemo,useState} from 'react';
import type {CycleHistoryItem,SimulationResult} from '@/type/simulation';
import type {MappedAssemblyRow} from '../utils/translationCompile';
import {analyzeAsmInstruction,analyzeCLine,fetchTutor,instructionAt} from '../utils/tutorAnalysis';
import {TutorText} from './TutorEvidence';
import './TutorCycleCards.css';
import {buildMultiCycleTraceRows} from '../utils/multiCycleTrace';
import {explainForwarding,explainStall,explainBubble,tutorDecimalText,tutorReadingText} from '../utils/tutorReadable';

const stages=['IF','ID','EX','MEM','WB'] as const;
const names={IF:'명령어 인출',ID:'명령어 해독',EX:'연산·조건 판단',MEM:'메모리 접근',WB:'완료·필요 시 레지스터 기록'};
type Props={cycle:CycleHistoryItem|null;simulation:SimulationResult;rows:MappedAssemblyRow[];source:string[];historyIndex?:number;selectedIndex?:number|null;sourceLine?:number|null;selectionKind?:'c'|'asm';selectionRevision?:number};

export default function TutorPipelineLesson({cycle,simulation,rows,source,historyIndex,selectedIndex,sourceLine,selectionKind,selectionRevision}:Props){
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
      <div className="tutor-cycle-card-body" data-has-c={Boolean(card.c)}>
        <section className="tutor-cycle-code"><strong>{card.row?`ASM: L${rows.indexOf(card.row)+1}`:'ASM'}{card.bubble?' · 원래 명령어의 의미':''}</strong><code>{tutorDecimalText(card.asm??'실행 명령어 정보 없음')}</code>{card.meaning&&<p><TutorText text={card.meaning}/></p>}</section>
        {card.c&&<section className="tutor-cycle-code tutor-cycle-c"><strong>C: L{card.line}</strong><code>{tutorDecimalText(card.c)}</code><p>{tutorReadingText(analyzeCLine(card.c,card.line!).summary)}</p></section>}
        {!card.cause&&<section className="tutor-cycle-observation"><strong>{card.observation?'이 사이클의 실제 동작':'이 단계에서 하는 일'}</strong><p>{tutorReadingText(card.observation?.summary??(card.cause?'아래 발생 원인과 해결 방법을 확인하세요.':({IF:'PC가 가리키는 주소에서 명령어를 가져옵니다.',ID:'명령어를 해독하고 필요한 레지스터 입력을 확인합니다.',EX:'연산·주소 계산·조건 판단을 수행합니다.',MEM:/^(lb|lbu|lh|lhu|lw)\b/i.test(card.asm??'')?'계산한 주소의 메모리 값을 읽습니다.':/^(sb|sh|sw)\b/i.test(card.asm??'')?'계산한 주소에 레지스터 값을 저장합니다.':'이 명령어는 데이터 메모리를 읽거나 쓰지 않고 다음 단계로 진행합니다.',WB:/^(sb|sh|sw|beq|bne|blt|bge|bltu|bgeu)\b/i.test(card.asm??'')?'이 명령어는 일반 레지스터에 결과를 기록하지 않습니다.':'기록 대상이 있는 명령어는 결과를 레지스터에 반영합니다.'})[card.stage]))}</p></section>}
        {(card.cause||card.action)&&<div className="tutor-cycle-response">
          {card.cause&&<section className="tutor-cycle-cause"><strong>발생 원인</strong><p>{tutorReadingText(card.cause)}</p></section>}
          {card.action&&<section className="tutor-cycle-action"><strong>해결 방법</strong><p>{tutorReadingText(card.action)}</p></section>}
        </div>}
      </div>
    </article>:<div className="tutor-cycle-empty">이 사이클에는 실행 중인 명령어나 보고된 대기·취소 상황이 없습니다.</div>}
    <nav aria-label="사이클 상황 이동"><button aria-label="이전 상황" disabled={index===0||!card} onClick={()=>move(-1)}><span aria-hidden="true">←</span> 이전</button><span>{card?index+1:0} / {cards.length}<small>이 사이클의 상황</small></span><button aria-label="다음 상황" disabled={!card||index>=cards.length-1} onClick={()=>move(1)}>다음 <span aria-hidden="true">→</span></button></nav>
  </section>;
}






