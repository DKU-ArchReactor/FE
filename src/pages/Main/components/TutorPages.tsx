import {useState} from 'react';
import type {ReactNode} from 'react';
import type {CycleHistoryItem, SimulationResult} from '@/type/simulation';
import type {MappedAssemblyRow} from '../utils/translationCompile';
import {analyzeAsmInstruction, analyzeCLine, analyzeCrtInstruction, instructionAt} from '../utils/tutorAnalysis';
import {TutorText, TutorInstructionEvidence, TutorCycleEvidence} from './TutorEvidence';
import TutorPerformanceSummary from './TutorPerformanceSummary';

export default function TutorPages({row, index, rows, source, simulation, historyIndex, current, onSelect}: {
  row: MappedAssemblyRow; index: number; rows: MappedAssemblyRow[]; source?: string;
  simulation: SimulationResult; historyIndex?: number; current: CycleHistoryItem | null;
  onSelect?: (line: number | null, index: number) => void;
}) {
  const [page, setPage] = useState(0);
  const item = instructionAt(simulation.tutor, row.pc);
  const detail = analyzeAsmInstruction(row.text, item?.explanation);
  const siblings = rows.map((value, position) => ({...value, position})).filter(value => row.sourceLine != null ? value.sourceLine === row.sourceLine : value.position === index);
  const place = Math.max(0, siblings.findIndex(value => value.position === index));
  const format = item?.instruction_format;
  const teaching = item?.teaching;
  const box = 'rounded-lg border border-[var(--ar-border)] bg-[var(--ar-header-bg)] p-3';
  const pages: {title: string; content: ReactNode}[] = [{title: '핵심 설명', content: <div className="space-y-3">
    <h4 className="text-base font-semibold">{detail.action}</h4><p><TutorText text={detail.explanation}/></p>
    {detail.operation && <p className={`${box} font-mono`}><TutorText text={detail.operation}/></p>}
    <p className="text-xs text-[var(--ar-text-muted)]">읽는 레지스터: {item?.explanation.reads == null ? '미제공' : item.explanation.reads.join(', ') || '없음'}<br/>기록할 레지스터: {item?.explanation.writes == null ? '미제공' : item.explanation.writes.join(', ') || '없음'}</p>
    {source && row.sourceLine != null && <p className="text-xs text-[var(--ar-text-muted)]">이 C 줄에 연결된 {siblings.length}개 명령어 중 {place + 1}번째입니다. 이전·다음 명령어로 나머지 설명을 확인하세요.</p>}
  </div>}];
  if (source && row.sourceLine != null) {
    const fallback = analyzeCLine(source.split(/\r?\n/)[row.sourceLine - 1] ?? '', row.sourceLine);
    const c = simulation.tutor?.c_lines?.find(value => value.line === row.sourceLine)?.explanation ?? {title: fallback.type, summary: fallback.summary, detail: fallback.detail};
    const mapping = simulation.tutor?.line_explanations?.find(value => value.source_line === row.sourceLine);
    pages.push({title: 'C 줄과의 연결', content: <div className="space-y-3">{c && <><h4 className="font-semibold">{c.title}</h4><p><TutorText text={c.summary}/></p><p><TutorText text={c.detail}/></p></>}{mapping && <><p className={box}>{mapping.summary}</p><p>{mapping.detail}</p></>}<p className="text-xs text-[var(--ar-text-muted)]">줄 매핑은 컴파일 결과의 근거입니다. 모든 명령어가 그 C 줄에서 독립적으로 실행되거나, 매번 실행된다는 뜻은 아닙니다.</p></div>});
  }
  if (row.sourceLine == null || row.isRuntime) {
    const context = analyzeCrtInstruction(row.text, row.pc);
    pages.push({title: '소스 위치와 실행 문맥', content: <div className="space-y-3"><p className="font-semibold">{context.role}</p><p>{context.summary}</p><p>{context.detail}</p><p className="font-mono text-xs">PC {row.pc}</p></div>});
  }
  if (teaching?.walkthrough?.length) pages.push({title: '처리 순서', content: <ol className="space-y-3">{teaching.walkthrough.map((step, i) => <li key={i} className={box}><strong className="block text-sm">{i + 1}. {step.title}</strong><p className="mt-1"><TutorText text={step.text}/></p></li>)}</ol>});
  if (teaching?.operand_roles.length) pages.push({title: '항목별 역할', content: <div className="space-y-3">{teaching.operand_roles.map((role, i) => <p key={i} className={box}><code className="font-semibold">{role.operand}</code><span className="mt-1 block">{role.role}</span></p>)}<p><TutorText text={teaching.principle}/></p></div>});
  if (format) {
    pages.push({title: `${format.name}형 포맷`, content: <div className="space-y-3"><p>{format.description}</p><p className="font-mono">32 bit · {format.word}</p><div className="overflow-x-auto"><div className="flex min-w-[500px] rounded border border-[var(--ar-border)]">{format.fields.map(field => <div key={field.name} style={{flex: field.width, minWidth: 62}} className="border-r border-[var(--ar-border)] p-2 text-center"><span className="block text-[10px]">{field.high}:{field.low}</span><strong className="block font-mono text-xs">{field.name}</strong><span className="block break-all font-mono text-[10px]">{field.binary}</span></div>)}</div></div>{format.immediate != null && <p className={box}>즉치 필드를 해석한 값: <code>{format.immediate}</code>{format.name === 'B' || format.name === 'J' ? ' 바이트 (현재 PC 기준 거리)' : format.name === 'U' ? ' (하위 12비트가 0인 값)' : ''}</p>}<p className="text-xs text-[var(--ar-text-muted)]">{format.note}</p></div>});
    for (let i = 0; i < format.fields.length; i += 3) pages.push({title: `포맷 필드 ${Math.floor(i / 3) + 1}`, content: <dl className="space-y-3">{format.fields.slice(i, i + 3).map(field => <div key={field.name} className={box}><dt className="font-mono font-semibold">{field.name} · bit {field.high}:{field.low} · 값 {field.value}</dt><dd className="mt-2">{field.role}</dd></div>)}</dl>});
  }
  for (const concept of teaching?.concepts ?? []) pages.push({title: concept.title, content: <div className="space-y-3"><p className="font-medium"><TutorText text={concept.plain ?? concept.explanation}/></p><div className={box}><strong className="text-xs">예제 · 현재 실행값과 별개</strong><p><TutorText text={concept.example}/></p></div><p><TutorText text={concept.answer}/></p><details><summary className="cursor-pointer text-xs">원리와 참고 자료</summary><p className="mt-2"><TutorText text={concept.explanation}/></p>{concept.sources.filter(value => value.url.startsWith('https://')).map(value => <a className="mt-2 block text-xs text-[var(--ar-accent)] underline" key={value.url} href={value.url} target="_blank" rel="noopener noreferrer">{value.title}</a>)}</details></div>});
  if (detail.hardwareDetail) pages.push({title: '원리와 주의사항', content: <p><TutorText text={detail.hardwareDetail}/></p>});
  if (teaching?.register_connections.length) pages.push({title: '앞선 명령어와의 연결', content: <div className="space-y-3"><p>같은 C 줄에서 앞선 기록 명령어를 정적으로 연결한 정보입니다. 실제 실행 여부와 값은 실행 근거에서 확인하세요.</p>{teaching.register_connections.map(value => <p key={value.register} className={box}><code>{value.register} ← {value.text}</code><span className="block text-xs">PC {value.pc}</span></p>)}</div>});
  pages.push({title: '실행 근거', content: <TutorInstructionEvidence item={item} bundle={simulation.tutor} historyIndex={historyIndex} focused runtimeOnly/>});
  pages.push({title: '현재 클록', content: <><p className="mb-3 text-xs text-[var(--ar-text-muted)]">선택한 명령어와 별개로 현재 CORE clock {current?.clock ?? '미확인'}의 전체 상태를 표시합니다.</p><TutorCycleEvidence bundle={simulation.tutor} historyIndex={historyIndex}/><TutorPerformanceSummary bundle={simulation.tutor} historyIndex={historyIndex}/></>});
  const selected = pages[Math.min(page, pages.length - 1)];
  const button = 'rounded-md border border-[var(--ar-border)] px-2.5 py-1.5 text-xs disabled:opacity-35 hover:bg-[var(--ar-header-bg)]';
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-asm-index={index}>
    <div className="shrink-0 space-y-2 border-b border-[var(--ar-border)] px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-xs"><strong>{source && row.sourceLine != null ? `C L${row.sourceLine}` : 'ASM · 소스 위치 미확인'}</strong><span className="text-[var(--ar-text-muted)]">한 번에 한 명령어씩 설명합니다</span></div>
      {source && row.sourceLine != null && <pre className="max-h-12 overflow-auto whitespace-pre-wrap font-mono text-xs">{source.split(/\r?\n/)[row.sourceLine - 1]}</pre>}
      <div className="flex items-center justify-between gap-2"><button className={button} disabled={!onSelect || place === 0} onClick={() => onSelect?.(siblings[place - 1].sourceLine, siblings[place - 1].position)}>이전 명령어</button><span className="text-xs font-mono">ASM {place + 1} / {siblings.length}</span><button className={button} disabled={!onSelect || place === siblings.length - 1} onClick={() => onSelect?.(siblings[place + 1].sourceLine, siblings[place + 1].position)}>다음 명령어</button></div>
      <h3 className="break-all font-mono text-sm font-semibold">L{index + 1} · {row.text}</h3>
      <label className="flex items-center gap-2 text-xs"><span className="shrink-0">설명 목차</span><select className="min-w-0 flex-1 rounded border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] p-1.5" aria-label="설명 페이지 선택" value={Math.min(page, pages.length - 1)} onChange={event => setPage(Number(event.target.value))}>{pages.map((value, i) => <option key={i} value={i}>{i + 1}. {value.title}</option>)}</select></label>
    </div>
    <div key={page} role="region" aria-label="현재 설명 페이지" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 text-[13px] leading-6 select-text" tabIndex={0}><h4 className="mb-3 text-sm font-semibold text-[var(--ar-accent)]">{selected.title}</h4>{selected.content}</div>
    <nav aria-label="설명 페이지 이동" className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-3 py-2"><button className={button} disabled={page === 0} onClick={() => setPage(value => value - 1)}>이전 설명</button><span className="text-xs" aria-live="polite">{page + 1} / {pages.length}</span><button className={button} disabled={page >= pages.length - 1} onClick={() => setPage(value => value + 1)}>다음 설명</button></nav>
  </div>;
}
