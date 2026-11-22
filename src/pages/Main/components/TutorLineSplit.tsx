import {useMemo,useState} from 'react';
import type {SimulationResult} from '@/type/simulation';
import {analyzeAsmInstruction,analyzeCLine,analyzeCrtInstruction,instructionAt} from '../utils/tutorAnalysis';
import type {MappedAssemblyRow} from '../utils/translationCompile';
import TutorDetailPages,{TutorDetailHost,type TutorDetailPage} from './TutorDetailPages';
import {TutorCycleEvidence,TutorText} from './TutorEvidence';
import TutorPerformanceSummary from './TutorPerformanceSummary';
import './TutorLineSplit.css';
import {tutorInstructionDetails} from '../utils/tutorInstructionDetails';

export default function TutorLineSplit({rows,source,line,selectedIndex,simulation,historyIndex,onSelect,hasC=true,singleScreen=false,requestedView='asm',selectionKey=0}:{
  rows:MappedAssemblyRow[];source:string[];line?:number|null;selectedIndex?:number|null;
  simulation:SimulationResult;historyIndex?:number;onSelect:(index:number)=>void;hasC?:boolean;
  singleScreen?:boolean;requestedView?:'c'|'asm';selectionKey?:number;
}){
  const [screen,setScreen]=useState({key:selectionKey,kind:requestedView});
  const view=screen.key===selectionKey?screen.kind:requestedView;
  const group=useMemo(()=>rows.map((row,index)=>({...row,index})).filter(row=>hasC?(line!=null?row.sourceLine===line:row.sourceLine==null||row.isRuntime):true),[rows,hasC,line]);
  const position=Math.max(0,group.findIndex(row=>row.index===selectedIndex));
  const row=group[position];
  const cRows=useMemo(()=>[...new Set(rows.flatMap(value=>value.sourceLine!=null&&value.sourceLine>0?[value.sourceLine]:[]))].sort((a,b)=>a-b),[rows]);
  const before=cRows.filter(value=>value<(line??0)).at(-1);
  const after=cRows.find(value=>value>(line??0));
  const jumpC=(next?:number)=>{if(next==null)return;const index=rows.findIndex(value=>value.sourceLine===next);if(index>=0)onSelect(index);};
  const cText=line!=null?source[line-1]??'':'';
  const cAnalysis=line!=null?analyzeCLine(cText,line):null;
  const lineExplanation=simulation.tutor?.line_explanations?.find(value=>value.source_line===line);
  const item=instructionAt(simulation.tutor,row?.pc);
  const instruction=row?analyzeAsmInstruction(row.text,item?.explanation):null;
  const details=item?tutorInstructionDetails(item,simulation.tutor,historyIndex):null;
  const observations=details?[...details.observations].sort((a,b)=>a[1].history_index-b[1].history_index):[];
  const latest=observations.at(-1);
  const pages:TutorDetailPage[]=row&&instruction?[
    {title:'명령어 해설',blocks:[{label:'이 명령어의 의미',text:instruction.explanation},...(instruction.operation?[{label:'동작 식',text:instruction.operation}]:[])]},
    ...(observations.length?[{title:'실제 실행',blocks:observations.map(([stage,value])=>({label:`Step ${value.step} · ${stage}`,text:value.summary}))}]:[{title:'실제 실행',blocks:[{text:details?.valueNotice??'실행값 기록이 제공되지 않았습니다.'}]}]),
    ...(details?.pages??[]),
    ...(instruction.hardwareDetail?[{title:'명령어 원리와 주의사항',blocks:[{text:instruction.hardwareDetail}]}]:[]),
    ...(row.sourceLine==null?[{title:'소스 위치와 실행 문맥',blocks:[{text:analyzeCrtInstruction(row.text,row.pc).summary},{text:analyzeCrtInstruction(row.text,row.pc).detail}]}]:[]),
  ]:[];
  return <div className="dev-tutor-line-split" data-has-c={hasC} data-single-screen={singleScreen}>
    {hasC&&(!singleScreen||view==='c')&&<TutorDetailHost key={`c-${line}`} inline label="C 줄 자세히 보기" onOpen={()=>{if(row)onSelect(row.index);}}><aside className="dev-tutor-c-panel" aria-label="선택한 C 줄 설명">
      <header><strong>{line!=null?`C L${line}`:'C 위치 미확인'}</strong></header>
      <div className="dev-tutor-c-reading"><div className="dev-tutor-c-explanation"><code title={cText}>{cText.trim()||'선택 명령어의 C 위치 정보가 없습니다.'}</code>
        <p><TutorText text={cAnalysis?.summary??'시작 코드·어셈블리 직접 작성·디버그 정보 누락 등으로 C 줄이 확인되지 않을 수 있습니다.'}/></p>
        </div>{lineExplanation&&<small className="dev-tutor-c-mapping"><span>연결된 ASM의 동작</span>{lineExplanation.summary}</small>}
      </div>
      <footer>
        {cAnalysis&&<TutorDetailPages title="C 설명 자세히" context={`C ${line} · ${cText}`} pages={[
          {title:cAnalysis.type,blocks:[{label:'선택한 코드',text:cText},{label:'이 코드의 의미',text:cAnalysis.summary},{label:'컴파일 결과를 읽는 방법',text:cAnalysis.detail}]},
          ...(lineExplanation?[{title:'C와 어셈블리 연결',blocks:[{text:lineExplanation.summary},{text:lineExplanation.detail}]}]:[]),
        ]}/>}
        <TutorCycleEvidence bundle={simulation.tutor} historyIndex={historyIndex} compact/>
        <TutorPerformanceSummary bundle={simulation.tutor} historyIndex={historyIndex}/>
      </footer>
      {singleScreen?<nav className="dev-tutor-c-navigation"><button className="dev-tutor-switch" aria-label="연결된 ASM 설명 보기" onClick={()=>setScreen({key:selectionKey,kind:'asm'})}>↓ ASM 설명</button></nav>:<nav className="dev-tutor-c-navigation" aria-label="C 줄 이동">
        <button aria-label="이전 C 줄" title="이전 C 줄" disabled={before==null} onClick={()=>jumpC(before)}>↑</button>
        <span>{line!=null&&cRows.includes(line)?`${cRows.indexOf(line)+1} / ${cRows.length}`:'—'}</span>
        <button aria-label="다음 C 줄" title="다음 C 줄" disabled={after==null} onClick={()=>jumpC(after)}>↓</button>
      </nav>}
    </aside></TutorDetailHost>}
    {(!singleScreen||view==='asm'||!hasC)&&<TutorDetailHost key={`${hasC?line:'asm'}-${row?.index}`} inline onOpen={()=>{if(row)onSelect(row.index);}}>
      <section className="dev-tutor-asm-panel" data-asm-index={row?.index} aria-label="선택한 어셈블리 설명">
        <header><strong>{hasC&&line!=null?`C L${line} · 연결된 ASM`:'어셈블리 명령어'}</strong>
          {singleScreen&&hasC&&(line!=null?<button className="dev-tutor-inline-switch" aria-label="연결된 C 설명 보기" onClick={()=>{if(row)onSelect(row.index);setScreen({key:selectionKey,kind:'c'});}}>↑ C L{line} 설명</button>:<span title="컴파일 결과에 이 명령어의 C 소스 위치가 없습니다. 시작·종료 코드 등은 C 줄과 연결되지 않을 수 있습니다.">C 연결 없음 · 시작·종료 코드 또는 위치 정보 없음</span>)}
          <span>{group.length?`${position+1} / ${group.length}`:'0 / 0'}</span></header>
        {row&&instruction?<>
          <div className="dev-tutor-asm-reading">
            <code className="dev-tutor-asm-code">{row.text}</code>
            <div className="dev-tutor-asm-meta"><span>ASM L{row.index+1}</span><span>{instruction.action}</span></div>
            <p className="dev-tutor-asm-meaning" title={instruction.explanation}><TutorText text={instruction.explanation}/></p>
            {instruction.operation&&instruction.operation!==instruction.explanation&&<code className="dev-tutor-asm-operation">{instruction.operation}</code>}
            <div className="dev-tutor-asm-result" data-observed={Boolean(latest)}><strong>{latest?`실제 실행 · ${latest[0]}`:'실제 실행'}</strong><p title={latest?.[1].summary??details?.valueNotice}><TutorText text={latest?.[1].summary??details?.valueNotice??'구체적인 실행값 기록이 제공되지 않았습니다.'}/></p></div>
          </div>
          <footer><TutorDetailPages title="자세히 보기" context={row.text} pages={pages}/>
            {!hasC&&<><TutorCycleEvidence bundle={simulation.tutor} historyIndex={historyIndex} compact/><TutorPerformanceSummary bundle={simulation.tutor} historyIndex={historyIndex}/></>}
          </footer>
        </>:<p className="dev-tutor-no-asm">이 C 줄에 연결된 어셈블리 명령어가 없습니다.</p>}
        <nav className="dev-tutor-asm-arrows" aria-label={hasC?'같은 C 줄의 ASM 이동':'ASM 명령어 이동'}>
          <button aria-label="이전 ASM" title={hasC?'같은 C 줄의 이전 ASM':'이전 ASM'} disabled={!group.length||position===0} onClick={()=>onSelect(group[position-1].index)}>‹</button>
          <button aria-label="다음 ASM" title={hasC?'같은 C 줄의 다음 ASM':'다음 ASM'} disabled={!group.length||position>=group.length-1} onClick={()=>onSelect(group[position+1].index)}>›</button>
        </nav>
      </section>
    </TutorDetailHost>}
  </div>;
}
