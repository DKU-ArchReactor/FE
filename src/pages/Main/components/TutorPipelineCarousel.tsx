import {useId, useState} from 'react';
import {createPortal} from 'react-dom';
import type {TutorInstruction} from '../utils/tutorAnalysis';
import {analyzeAsmInstruction, analyzeCLine} from '../utils/tutorAnalysis';
import {tutorDecimalText} from '../utils/tutorReadable';
import {TutorText} from './TutorEvidence';
import './TutorSingleMode.css';
import './TutorCycleCards.css';

export type PipelineSituation = {
  id: number;
  stage: 'IF' | 'ID' | 'EX' | 'MEM' | 'WB';
  badge: string;
  status: string;
  asm?: string | null;
  asmLine?: number;
  meaning?: string | null;
  line?: number | null;
  c?: string;
  observation?: {summary: string};
  cause?: string | null;
  action?: string | null;
  bubble: boolean;
  instruction?: TutorInstruction;
};

const tabs = [{id:'desc', label:'이번 사이클'}, {id:'logic', label:'동작 원리'}] as const;
type Tab = typeof tabs[number]['id'];

function stageWorkTitle(card:PipelineSituation) {
  const opcode = card.asm?.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const memoryRead = /^(lb|lbu|lh|lhu|lw)$/.test(opcode);
  const memoryWrite = /^(sb|sh|sw)$/.test(opcode);
  const branch = /^(beq|bne|blt|bge|bltu|bgeu)$/.test(opcode);
  if (card.stage === 'IF') return '실행할 명령어를 가져오는 중';
  if (card.stage === 'ID') return '명령어와 입력 레지스터를 확인하는 중';
  if (card.stage === 'MEM') return memoryRead ? '메모리에서 값을 읽는 중' : memoryWrite ? '메모리에 값을 저장하는 중' : '메모리 접근 없이 다음 단계로 진행 중';
  if (card.stage === 'WB') {
    if (/^(ecall|ebreak)$/.test(opcode)) return '실행 환경에 요청을 전달하는 중';
    const writes = card.instruction?.explanation.writes;
    const discardsResult = /^(?:\S+)\s+(?:zero|x0)\s*,/i.test(card.asm ?? '');
    return memoryWrite || branch || writes?.length === 0 || discardsResult
      ? '레지스터 기록 없이 명령어를 마무리하는 중'
      : '결과를 레지스터에 기록하는 중';
  }
  if (memoryRead || memoryWrite) return '메모리에 접근할 주소를 계산하는 중';
  if (branch) return '두 값을 비교해 분기 여부를 판단하는 중';
  if (/^(jal|jalr)$/.test(opcode)) return '점프할 명령어 주소를 계산하는 중';
  if (opcode === 'auipc') return '현재 명령어 주소를 기준으로 주소를 계산하는 중';
  if (/^(add|addi)$/.test(opcode)) return '두 입력을 더하는 중';
  if (opcode === 'sub') return '두 입력을 빼는 중';
  if (/^(sll|slli|srl|srli|sra|srai)$/.test(opcode)) return '입력값의 비트를 이동하는 중';
  if (/^(and|andi|or|ori|xor|xori)$/.test(opcode)) return '각 비트에 논리 연산을 수행하는 중';
  if (/^(slt|slti|sltu|sltiu)$/.test(opcode)) return '두 값의 크기를 비교하는 중';
  return '명령어의 연산을 수행하는 중';
}

function StageBadge({badge}:{badge:string}) {
  return <span className="tutor-pipeline-stage-badge" data-kind={badge}>
    {badge === 'STL' ? <svg aria-label="STL" width="38" height="26" viewBox="0 0 100 68"><path d="M8 16 C5 16 4 19 4 22 L4 46 C4 49 5 52 8 52 L58 52 L58 60 C58 64 63 65 66 62 L96 36 C98 34 98 34 96 32 L66 6 C63 3 58 4 58 8 L58 16 Z" fill="#fde68a" stroke="#f59e0b" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/><text x="45" y="35" dominantBaseline="middle" textAnchor="middle" fill="#b45309" fontSize="23" fontWeight="800">STL</text></svg>
      : badge === 'BBL' ? <svg aria-label="BBL" width="38" height="26" viewBox="0 0 100 68"><path d="M18 48 C5 48 5 32 14 26 C8 15 20 6 30 14 C36 3 50 2 58 10 C66 2 80 5 84 16 C96 16 98 30 91 38 C98 48 88 60 76 56 C70 66 56 66 48 58 C40 66 26 66 22 56 C14 58 10 52 18 48 Z" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="3.2" strokeLinejoin="round"/><text x="51" y="36" dominantBaseline="middle" textAnchor="middle" fill="#0284c7" fontSize="23" fontWeight="800">BBL</text></svg>
      : badge}
  </span>;
}

function StageWork({card}:{card:PipelineSituation}) {
  const text = card.observation?.summary ?? ({
    IF:'PC가 가리키는 주소에서 명령어를 가져옵니다.',
    ID:'명령어를 해독하고 필요한 레지스터 입력을 확인합니다.',
    EX:'연산·주소 계산·조건 판단을 수행합니다.',
    MEM:/^(lb|lbu|lh|lhu|lw)\b/i.test(card.asm ?? '') ? '계산한 주소의 메모리 값을 읽습니다.' : /^(sb|sh|sw)\b/i.test(card.asm ?? '') ? '계산한 주소에 레지스터 값을 저장합니다.' : '이 명령어는 데이터 메모리를 읽거나 쓰지 않고 다음 단계로 진행합니다.',
    WB:/^(sb|sh|sw|beq|bne|blt|bge|bltu|bgeu)\b/i.test(card.asm ?? '') ? '이 명령어는 일반 레지스터에 결과를 기록하지 않습니다.' : '기록 대상이 있는 명령어는 결과를 레지스터에 반영합니다.',
  })[card.stage];
  return <div className="tutor-single-observed">
    <div className="tutor-single-observed-title"><span>{stageWorkTitle(card)}</span></div>
    <p className="tutor-single-observed-content"><TutorText text={text}/></p>
  </div>;
}

function HazardExplanation({card}:{card:PipelineSituation}) {
  return <div className="tutor-pipeline-hazard">
    {card.cause && <section className="tutor-pipeline-cause"><strong>발생 원인</strong><p><TutorText text={card.cause}/></p></section>}
    {card.action && <section className="tutor-pipeline-solution"><strong>해결 방법</strong><p><TutorText text={card.action}/></p></section>}
  </div>;
}

function PipelineContext({cards,index,historyIndex,unmatched,onSelect}:{cards:PipelineSituation[];index:number;historyIndex?:number;unmatched:boolean;onSelect:(index:number)=>void}) {
  return <div className="tutor-pipeline-context" role="group" aria-label="같은 사이클에서 함께 진행 중인 상황">
    <span className="tutor-pipeline-context-label" title={unmatched ? '선택한 코드는 이 사이클에서 실행 중이지 않습니다.' : '현재 표시 중인 실행 사이클'}>사이클 {historyIndex != null ? historyIndex + 1 : '—'}</span>
    {cards.map((card,position)=><button type="button" className="tutor-pipeline-context-button" key={`${card.id}-${card.stage}`} data-stage={card.stage} data-kind={card.badge} aria-pressed={position === index} aria-label={`${card.stage} · ${card.status} 상황 보기`} title={`${card.stage} · ${card.status}${card.asm ? ` · ${tutorDecimalText(card.asm)}` : ''}`} onClick={()=>onSelect(position)}>{card.badge}</button>)}
  </div>;
}

function SituationCard({card, active}:{card:PipelineSituation;active:boolean}) {
  const [tab, setTab] = useState<Tab>('desc');
  const id = useId();
  const teaching = card.instruction?.teaching;
  const principle = teaching?.principle || (card.asm ? analyzeAsmInstruction(card.asm, card.instruction?.explanation).hardwareDetail : '');
  const hasHazard = Boolean(card.cause || card.action);
  const shortMeaning = card.meaning?.split(/(?<=[.!?])\s+/)[0];
  return <article className="tutor-single-card tutor-pipeline-card" data-stage={card.stage} data-situation={card.badge}>
    <div className="tutor-single-card-header">
      <div className="tutor-header-left">
        <span className="tutor-single-tag" title={card.bubble ? '취소되기 전 명령어' : undefined}>{card.asmLine ? `ASM: L${card.asmLine}` : 'ASM'}</span>
        <StageBadge badge={card.badge}/>
        <span className="tutor-single-badge">{card.status}</span>
      </div>
      <div className="tutor-header-tabs" role={active ? 'tablist' : undefined} aria-label={active ? '상황 설명 종류' : undefined}>
        {active ? tabs.map((value) => <button type="button" key={value.id} role="tab" id={`${id}-${value.id}`} aria-selected={tab === value.id} aria-controls={`${id}-panel`} tabIndex={tab === value.id ? 0 : -1} className={`tutor-folder-tab${tab === value.id ? ' active' : ''}`}
          onClick={()=>setTab(value.id)}>{value.label}</button>) : <span className="tutor-folder-tab active">이번 사이클</span>}
      </div>
    </div>
    <div className="tutor-single-card-body" id={active ? `${id}-panel` : undefined} role={active ? 'tabpanel' : undefined} aria-labelledby={active ? `${id}-${tab}` : undefined} key={tab} tabIndex={active ? 0 : -1}>
      {(!active || tab === 'desc') ? <>
        <div className="tutor-single-code-box tutor-pipeline-instruction"><code>{tutorDecimalText(card.asm ?? '실행 명령어 정보 없음')}</code>{active && card.c && <div className="tutor-pipeline-code-meta"><button className="tutor-pipeline-source-link" type="button" onClick={()=>setTab('logic')}>C: L{card.line} 연결</button></div>}</div>
        {shortMeaning && <div className="tutor-single-meaning"><span className="tutor-single-meaning-arrow" aria-hidden="true">→</span><p className="tutor-single-meaning-text"><TutorText text={shortMeaning}/></p></div>}
        {active && (hasHazard ? <HazardExplanation card={card}/> : <StageWork card={card}/>)}
      </> : <>
        {card.meaning && <section className="tutor-pipeline-reading-step"><strong>명령어 전체의 의미</strong><p><TutorText text={card.meaning}/></p></section>}
        {card.c && <div className="tutor-pipeline-c-source"><strong>C: L{card.line}</strong><code>{tutorDecimalText(card.c)}</code><p><TutorText text={analyzeCLine(card.c, card.line ?? 1).summary}/></p></div>}
        {principle && <section className="tutor-pipeline-principle"><strong>{card.bubble ? '취소되기 전 명령어의 동작 원리' : '명령어의 동작 원리'}</strong><p><TutorText text={principle}/></p></section>}
        {teaching?.walkthrough?.map((step, index)=><section className="tutor-pipeline-reading-step" key={index}><strong>{index + 1}. {step.title}</strong><p><TutorText text={step.text}/></p></section>)}
        {teaching?.operand_roles?.map((operand, index)=><section className="tutor-pipeline-reading-step" key={`operand-${index}`}><strong>{(['첫 번째','두 번째','세 번째'][index] ?? `${index + 1}번째`) + ' 항목 · ' + tutorDecimalText(operand.operand)}</strong><p><TutorText text={operand.role}/></p></section>)}
        {teaching?.concepts?.map(concept=><section className="tutor-pipeline-reading-step" key={concept.id}><strong>{concept.title}</strong><p><TutorText text={concept.plain || concept.explanation}/></p></section>)}
      </>}
    </div>
  </article>;
}

export default function TutorPipelineCarousel({cards,index,historyIndex,isUserSelected,unmatched,onSelect,headerTarget}:{cards:PipelineSituation[];index:number;historyIndex?:number;isUserSelected:boolean;unmatched:boolean;onSelect:(index:number)=>void;headerTarget?:HTMLElement|null}) {
  const controls = cards.length > 0 ? <PipelineContext cards={cards} index={index} historyIndex={historyIndex} unmatched={unmatched} onSelect={onSelect}/> : null;
  return <section className="tutor-single-container tutor-cycle-cards" data-mode={isUserSelected ? 'selected' : 'executing'} data-stage={cards[index]?.stage} data-situation={cards[index]?.badge} aria-label="사이클 상황 카드">
    {headerTarget ? createPortal(controls,headerTarget) : headerTarget === undefined && controls ? <div className="tutor-pipeline-context-slot">{controls}</div> : null}
    {cards.length ? <div className="tutor-pipeline-viewport"><div className="tutor-pipeline-track" data-multi={cards.length > 1} style={{transform:cards.length > 1 ? `translateX(calc(var(--pipeline-peek) - ${index} * (100% - 2 * var(--pipeline-peek) + var(--pipeline-gap))))` : 'none'}}>
      {cards.map((card, position)=>{
        const active = position === index;
        return <div key={`${historyIndex}-${card.id}-${card.stage}`} className="tutor-pipeline-slide" data-active={active} role={active ? undefined : 'button'} tabIndex={active ? undefined : 0} aria-label={active ? undefined : `${card.stage} · ${card.status} 카드 보기`} onClick={active ? undefined : ()=>onSelect(position)}>
          <div className="tutor-pipeline-slide-content" inert={!active} aria-hidden={!active}><SituationCard card={card} active={active}/></div>
        </div>;
      })}
    </div></div> : <div className="tutor-cycle-empty">사이클 {historyIndex != null ? historyIndex + 1 : '—'}에는 실행 중인 명령어나 보고된 대기·취소 상황이 없습니다.</div>}
  </section>;
}
