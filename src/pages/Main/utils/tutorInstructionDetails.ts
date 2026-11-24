import type {TutorBundle,TutorInstruction} from './tutorAnalysis';
import type {TutorDetailPage} from '../components/TutorDetailPages';
import {tutorRegisterName,tutorDecimalText} from './tutorReadable';

type Observation = {history_index: number; step: number; cycle?: number; summary: string; kind?: string};
type HazardRecord = NonNullable<TutorBundle['performance_analysis']>['records'][number];
type InstructionHistory = {stages: Map<string, Observation[]>; hazards: HazardRecord[]};
// Run payloads are immutable; replacing a run creates a separate, GC-managed index.
const evidenceIndexes = new WeakMap<TutorBundle, {instructions: Map<number, InstructionHistory>}>();

function evidenceIndex(bundle: TutorBundle) {
  const cached = evidenceIndexes.get(bundle);
  if (cached) return cached;
  const instructions = new Map<number, InstructionHistory>();
  const entry = (pc: string | null | undefined) => {
    const address = Number.parseInt(pc ?? '', 16);
    if (!Number.isFinite(address)) return undefined;
    let value = instructions.get(address);
    if (!value) {
      value = {stages: new Map(), hazards: []};
      instructions.set(address, value);
    }
    return value;
  };
  for (const step of bundle.execution_steps ?? []) {
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
    for (const values of [...instruction.stages.values(), instruction.hazards]) {
      values.sort((a, b) => a.history_index - b.history_index);
    }
  }
  const index = {instructions};
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
  elf_dwarf: '컴파일할 때 함께 저장된 C 코드의 줄 위치를 사용했습니다.',
  provided_code_mapping: '실행할 명령어와 C 코드의 줄을 연결한 정보를 사용했습니다.',
  instruction_table_without_source_lines: '실행할 명령어 목록은 있지만 연결된 C 줄은 없습니다.',
  none: '이 명령어와 연결된 C 줄을 찾지 못했습니다.',
};

export function tutorInstructionDetails(item:TutorInstruction,bundle?:TutorBundle,historyIndex?:number) {
  const observations = new Map<string, Observation>();
  const index = bundle ? evidenceIndex(bundle) : undefined;
  const evidence = index?.instructions.get(Number.parseInt(item.pc ?? '', 16));
  const selectedIndex = historyIndex ?? -1;
  for (const [stage, values] of evidence?.stages ?? []) {
    const count = prefixLength(values, selectedIndex);
    if (count > 0) observations.set(stage, values[count - 1]);
  }
  const records = evidence?.hazards ?? [];
  const hazardRecords = records.slice(0, prefixLength(records, selectedIndex));
  const teaching=item.teaching;
  const detailPages:TutorDetailPage[]=[
    {title:'이 명령어는 어떻게 동작할까요?',blocks:[
      ...(teaching?.walkthrough??[]).map(step=>({label:step.title,text:step.text})),
      ...(teaching?.operand_roles??[]).map((role,position)=>({label:(['첫 번째','두 번째','세 번째'][position]??`${position+1}번째`)+' 항목 · '+role.operand,text:role.role})),
      ...(teaching?.principle?[{label:'동작 원리',text:teaching.principle}]:[]),
      ...(teaching?.register_connections??[]).map(connection=>{
        const producerIndex=bundle?.asm_instructions?.findIndex(value=>Number(value.pc)===Number(connection.pc))??-1;
        const producer=producerIndex>=0?bundle?.asm_instructions?.[producerIndex]:undefined;
        const register=tutorRegisterName(connection.register);
        return {label:register+'에 값을 넣는 앞쪽 명령어',text:
          (producerIndex>=0?`ASM: L${producerIndex+1} · `:'')+connection.text+'\n이 명령어가 저장된 주소: '+connection.pc+
          (producer?.explanation?.summary?'\n'+producer.explanation.summary:'')+
          '\n이렇게 준비한 '+register+'의 값을 현재 명령어가 입력으로 사용할 수 있습니다. 이것은 코드의 배치로 찾은 연결입니다. 분기나 반복이 있으면 실제 실행 순서는 달라질 수 있습니다.'};
      }),
    ]},
    ...(teaching?.concepts??[]).map(concept=>({title:concept.title,blocks:[
      {text:concept.plain??concept.explanation},
      {label:'학습 예제 · 현재 실행값과 별개',text:concept.example},
      {label:'질문',text:concept.question,kind:'question' as const},
      {label:'답변',text:concept.answer,kind:'answer' as const},
      ...(concept.plain?[{label:'원리와 주의사항',text:concept.explanation}]:[]),
      ...concept.sources.filter(source=>source.url.startsWith('https://')).map(source=>({label:'참고 자료',text:source.title,href:source.url})),
    ]})),
    {title:'코드 위치와 사용하는 레지스터',blocks:[
      {label:'명령어가 저장된 메모리 위치',text:'이 명령어의 주소는 '+item.pc+'입니다. PC는 실행할 명령어의 주소를 담는 곳입니다.'},
      ...(item.function?[{label:'이 명령어가 속한 곳',text:'이 명령어가 포함된 함수 또는 코드 구역의 이름은 '+item.function+'입니다.'}]:[]),
      ...(item.source_file?[{label:'원본 코드의 파일과 줄 위치',text:'원본 코드를 저장한 파일 이름은 '+item.source_file+'입니다.'+(item.source_line!=null?' 이 파일의 '+item.source_line+'번째 줄(C: L'+item.source_line+')과 연결되어 있습니다.':'')}]:item.source_line!=null?[{label:'연결된 C 코드의 위치',text:'C 코드의 '+item.source_line+'번째 줄(C: L'+item.source_line+')과 연결되어 있습니다.'}]:[]),
      {label:'C 줄과 연결한 방법',text:MAPPING_LABELS[item.mapping_basis??'']??'이 명령어와 연결된 C 줄을 찾지 못했습니다.'},
      ...(item.raw_instruction?[{label:'CPU가 읽는 명령어 · 기계어 · 10진수',text:tutorDecimalText(item.raw_instruction)+'\n이 숫자는 계산 결과가 아닙니다. 어떤 동작을 할지, 어느 레지스터를 쓸지 등을 CPU가 읽을 수 있도록 32개의 비트로 묶은 명령어를 10진수로 표시한 것입니다.'}]:[]),
      {text:'입력값을 읽는 레지스터: '+(item.explanation.reads?(item.explanation.reads.map(tutorRegisterName).join(', ')||'없음'):'미제공')+'\n결과를 넣는 레지스터: '+(item.explanation.writes?(item.explanation.writes.map(tutorRegisterName).join(', ')||'없음'):'미제공')},
      ...[...observations].filter(([stage,observation])=>stage==='WB'||observation.kind==='address').map(([stage,observation])=>({label:'Step '+observation.step+' · '+stage,text:observation.summary})),
    ]},
    ...hazardRecords.map(record=>({title:record.title,blocks:[{label:'Step '+(record.history_index+1),text:record.detail}]})),
  ];
  return {pages:detailPages,observations};
}

