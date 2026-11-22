import type {TutorBundle,TutorInstruction} from './tutorAnalysis';
import type {TutorDetailPage} from '../components/TutorDetailPages';

type Observation = {history_index: number; step: number; cycle?: number; summary: string; kind?: string};
type HazardRecord = NonNullable<TutorBundle['performance_analysis']>['records'][number];
type InstructionHistory = {stages: Map<string, Observation[]>; completions: {history_index: number}[]; hazards: HazardRecord[]};
// Run payloads are immutable; replacing a run creates a separate, GC-managed index.
const evidenceIndexes = new WeakMap<TutorBundle, {instructions: Map<number, InstructionHistory>; firstCompletion?: number}>();

function evidenceIndex(bundle: TutorBundle) {
  const cached = evidenceIndexes.get(bundle);
  if (cached) return cached;
  const instructions = new Map<number, InstructionHistory>();
  let firstCompletion: number | undefined;
  const entry = (pc: string | null | undefined) => {
    const address = Number.parseInt(pc ?? '', 16);
    if (!Number.isFinite(address)) return undefined;
    let value = instructions.get(address);
    if (!value) {
      value = {stages: new Map(), completions: [], hazards: []};
      instructions.set(address, value);
    }
    return value;
  };
  for (const step of bundle.execution_steps ?? []) {
    if (step.retired_pc !== undefined) {
      firstCompletion = Math.min(firstCompletion ?? Infinity, step.history_index);
      entry(step.retired_pc)?.completions.push({history_index: step.history_index});
    }
    for (const observation of step.instruction_observations ?? []) {
      const instruction = entry(observation.pc);
      if (!instruction) continue;
      const values = instruction.stages.get(observation.stage) ?? [];
      values.push({history_index: step.history_index, step: step.display_clock, cycle: step.cycle,
        summary: observation.summary, kind: observation.kind});
      instruction.stages.set(observation.stage, values);
    }
  }
  for (const record of bundle.performance_analysis?.records ?? []) entry(record.instruction.pc)?.hazards.push(record);
  for (const instruction of instructions.values()) {
    for (const values of [...instruction.stages.values(), instruction.completions, instruction.hazards]) {
      values.sort((a, b) => a.history_index - b.history_index);
    }
  }
  const index = {instructions, firstCompletion};
  evidenceIndexes.set(bundle, index);
  return index;
}

function prefixLength(values: {history_index: number}[], historyIndex: number) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (values[middle].history_index <= historyIndex) low = middle + 1;
    else high = middle;
  }
  return low;
}

const MAPPING_LABELS: Record<string, string> = {
  elf_dwarf: 'ELF 디버그 정보 (DWARF)',
  provided_code_mapping: 'CORE 코드 매핑',
  instruction_table_without_source_lines: '정적 명령어 테이블',
  none: '소스 매핑 근거 없음',
};

export function tutorInstructionDetails(item:TutorInstruction,bundle?:TutorBundle,historyIndex?:number) {
  const observations = new Map<string, Observation>();
  const index = bundle ? evidenceIndex(bundle) : undefined;
  const evidence = index?.instructions.get(Number.parseInt(item.pc ?? '', 16));
  const selectedIndex = historyIndex ?? -1;
  const confirmedCompletions = prefixLength(evidence?.completions ?? [], selectedIndex);
  const hasCompletionEvidence = index?.firstCompletion != null && index.firstCompletion <= selectedIndex;
  for (const [stage, values] of evidence?.stages ?? []) {
    const count = prefixLength(values, selectedIndex);
    if (count > 0) observations.set(stage, values[count - 1]);
  }
  let valueNotice = '선택한 시점까지 이 명령어의 값 처리 기록이 없습니다.';
  const records = evidence?.hazards ?? [];
  const hazardRecords = records.slice(0, prefixLength(records, selectedIndex));
  if (historyIndex === undefined || historyIndex < 0) {
    valueNotice = '실행 전 상태입니다. 스텝을 진행하면서 이 명령어의 실제 값 처리 이력을 확인할 수 있습니다.';
  } else if (confirmedCompletions > 0) {
    valueNotice = '명령어 완료는 확인됐으며, 이 명령어의 별도 연산값·메모리 접근값은 제공되지 않았습니다.';
  } else if (item.retire_count === 0) {
    valueNotice = '전체 실행에서 이 명령어의 완료 기록이 없습니다. 실행 경로·취소 여부·실행 종료 상태를 함께 확인하세요.';
  }
  const teaching=item.teaching;
  const detailPages:TutorDetailPage[]=[
    {title:'처리 순서와 항목별 역할',blocks:[
      ...(teaching?.walkthrough??[]).map(step=>({label:step.title,text:step.text})),
      ...(teaching?.operand_roles??[]).map(role=>({label:role.operand,text:role.role})),
      ...(teaching?.principle?[{label:'동작 원리',text:teaching.principle}]:[]),
      ...(teaching?.register_connections??[]).map(connection=>({label:'같은 C 줄의 정적 연결 · '+connection.register,text:connection.text+' · PC '+connection.pc})),
    ]},
    ...(teaching?.concepts??[]).map(concept=>({title:concept.title,blocks:[
      {text:concept.plain??concept.explanation},
      {label:'학습 예제 · 현재 실행값과 별개',text:concept.example},
      {label:'헷갈리기 쉬운 점',text:concept.question+'\n'+concept.answer},
      ...(concept.plain?[{label:'원리와 주의사항',text:concept.explanation}]:[]),
      ...concept.sources.filter(source=>source.url.startsWith('https://')).map(source=>({label:'참고 자료',text:source.title,href:source.url})),
    ]})),
    {title:'매핑·레지스터 정보',blocks:[
      {text:'PC '+item.pc+'\n'+(item.function??'함수 미확인')+' · '+(item.source_file??'파일 미확인')+(item.source_line!=null?':'+item.source_line+':'+(item.source_column??'?'):'')},
      {text:'매핑 근거 '+(MAPPING_LABELS[item.mapping_basis??'']??'미제공')+'\n원본 기계어 '+(item.raw_instruction??'미제공')},
      {text:'읽기: '+(item.explanation.reads?(item.explanation.reads.join(', ')||'없음'):'미제공')+' · 쓰기: '+(item.explanation.writes?(item.explanation.writes.join(', ')||'없음'):'미제공')},
      ...(item.retire_count!=null?[{text:`전체 실행 완료 ${item.retire_count}회 · ${item.observed_in_history?'실행 이력에 관찰됨':'실행 이력에 관찰되지 않음'}`}]:[]),
      ...(hasCompletionEvidence?[{text:'선택한 클록까지 확인된 완료 '+confirmedCompletions+'회'}]:[]),
      ...[...observations].filter(([stage,observation])=>stage==='WB'||observation.kind==='address').map(([stage,observation])=>({label:'Step '+observation.step+' · '+stage,text:observation.summary})),
    ]},
    ...hazardRecords.map(record=>({title:record.title,blocks:[{label:'Step '+(record.history_index+1),text:record.detail}]})),
  ];
  return {pages:detailPages,observations,valueNotice};
}

