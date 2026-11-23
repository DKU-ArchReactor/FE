import {useMemo} from 'react';
import type {TutorBundle} from '../utils/tutorAnalysis';
import TutorDetailPages, {type TutorDetailPage} from './TutorDetailPages';

export default function TutorPerformanceSummary({bundle,historyIndex}:{bundle?:TutorBundle;historyIndex?:number}){
  const analysis=bundle?.performance_analysis;
  const snapshots=useMemo(()=>new Map((analysis?.snapshots??[]).map(snapshot=>[snapshot.history_index,snapshot])),[analysis]);
  const snapshot=historyIndex==null?undefined:snapshots.get(historyIndex);
  if(!analysis||!snapshot||historyIndex==null)return null;
  const pages=()=>{
  const groups=new Map<string,{pc:string|null;assembly:string|null;stalls:number;flushes:number;forwards:number;detail:string;priority:number}>();
  const priority={stall:3,flush:2,forwarding:1};
  for(const record of analysis.records){
    if(record.history_index>historyIndex)continue;
    const key=record.instruction.pc??`unknown-${record.instruction.assembly??''}`;
    const group=groups.get(key)??{pc:record.instruction.pc,assembly:record.instruction.assembly,stalls:0,flushes:0,forwards:0,detail:'',priority:0};
    if(record.kind==='stall')group.stalls++;else if(record.kind==='flush')group.flushes++;else group.forwards++;
    if(priority[record.kind]>=group.priority){group.detail=record.detail;group.priority=priority[record.kind];}
    groups.set(key,group);
  }
  const hotspots=[...groups.values()].sort((a,b)=>b.stalls-a.stalls||b.flushes-a.flushes||b.forwards-a.forwards).slice(0,3);
  const pages:TutorDetailPage[]=[
    {title:'CPI와 해저드 분석',blocks:[
      {text:`선택한 시점까지 ${snapshot.cycles}클록을 실행했습니다. ${snapshot.completed!=null?'완료 명령어는 '+snapshot.completed+'개입니다.':'완료 명령어 수는 제공되지 않았습니다.'}${snapshot.cpi!=null?' CPI는 '+snapshot.cycles+' ÷ '+snapshot.completed+' = '+snapshot.cpi.toFixed(2)+'클록/명령어입니다.':''}`},
      {label:'대기·전달·취소',text:`스톨 관찰 ${snapshot.stall_cycles}클록\n플러시 관찰 ${snapshot.flush_cycles}클록\n포워딩 관찰 ${snapshot.forwarding_cycles}클록\n같은 클록에서 겹침 ${snapshot.overlap_cycles}클록\n중복 제외 관찰 ${snapshot.hazard_cycles}클록`},
      {label:'명령어 완료가 없는 클록',text:`완료 없음 ${snapshot.idle_cycles}클록\n스톨·플러시와 함께 관찰 ${snapshot.hazard_idle_cycles}클록\n해당 표시 없이 관찰 ${snapshot.other_idle_cycles}클록`},
      ...(snapshot.extra_cycles!=null?[{text:`매 클록 1개 완료를 기준으로 총 클록과 완료 명령어 수의 차이는 ${snapshot.extra_cycles}클록입니다. 파이프라인 초기 채우기·종료 비우기와 대기 등의 영향을 함께 확인해야 합니다.`}]:[]),
      ...(snapshot.unknown_completion_cycles>0?[{text:`완료 카운터를 확인할 수 없는 ${snapshot.unknown_completion_cycles}클록은 완료 없음 집계에서 제외했습니다.`}]:[]),
    ]},
    ...(hotspots.length?[{title:'대기·플러시가 많은 명령어',blocks:hotspots.flatMap(item=>[
      {label:(item.pc??'PC 미제공')+' · '+(item.assembly??'명령어 미제공'),text:`스톨 ${item.stalls} · 플러시 ${item.flushes} · 포워딩 ${item.forwards}클록`},
      {text:item.detail},
    ])}]:[]),
    ...analysis.records.filter(record=>record.history_index<=historyIndex).map(record=>({title:record.title,blocks:[
      {label:'Step '+(record.history_index+1),text:record.detail},
      {text:(record.instruction.pc??'PC 미제공')+' · '+(record.instruction.assembly??'명령어 미제공')},
    ]})),
    {title:'집계 기준',blocks:analysis.notes.map(text=>({text}))},
  ];
  return pages;
  };
  return <TutorDetailPages title="CPI와 해저드 분석" context={`Step ${historyIndex+1} · 실행 분석`} pages={pages}/>;
}
