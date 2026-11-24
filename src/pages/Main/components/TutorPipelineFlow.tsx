import type {CycleHistoryItem} from '@/type/simulation';
import type {MappedAssemblyRow} from '../utils/translationCompile';
import './TutorPipelineFlow.css';

const stages=[['IF','인출'],['ID','해독'],['EX','연산'],['MEM','메모리'],['WB','기록']] as const;
export default function TutorPipelineFlow({cycle,rows,onSelect,selectedIndex,onFollow,onStage,selectedStage}:{cycle:CycleHistoryItem|null;rows:MappedAssemblyRow[];onSelect:(index:number)=>void;selectedIndex?:number|null;onFollow:()=>void;onStage?:(stage:string,index:number)=>void;selectedStage?:string|null}){
  return <div className="dev-tutor-flow" aria-label="현재 클록의 파이프라인 흐름">
    <button className="pipeline-overview-button" onClick={onFollow}>클록 전체</button>
    <div className="dev-tutor-flow-stages">{stages.map(([stage,label])=>{
      const value=cycle?.stage_activity&&Object.hasOwn(cycle.stage_activity,stage)?cycle.stage_activity[stage]:cycle?.buffers?.[stage];
      const empty=!value||value.status==='empty';
      const bubble=value?.status==='bubble'||value?.assembly==='bubble';
      const cancelled=value?.flush_info?.is_flushed||/flush/i.test(value?.status??'');
      const index=value?.pc?rows.findIndex(row=>row.pc&&Number(row.pc)===Number(value.pc)):-1;
      return <button key={stage} data-stage={stage} aria-pressed={selectedStage?selectedStage===stage:index>=0&&index===selectedIndex} onClick={()=>onStage?onStage(stage,index):index>=0&&onSelect(index)} title={`${stage} · ${label} · ${value?.assembly??'비어 있음'}`}>
        <span>{stage}<small>{label}</small></span><code>{empty?'비어 있음':cancelled?'취소됨':bubble?'버블':value?.assembly}</code>
      </button>;
    })}</div>
  </div>;
}
