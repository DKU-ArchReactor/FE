import { useEffect, useMemo, useRef, useState } from 'react';
import type { Compilation } from './compile';
import { compileError } from './compile';
import { executeCompilation, loadDebugInfo } from './execution';
import type { ExecutionTrace } from './execution';
import type { DebugInfo } from './debug';
import { hex, inspectMemory, snapshotForCycle } from './runtime';
import type { MemoryValue } from './runtime';
import { memoryTimeline } from './memoryTimeline';
import type { MemoryStep } from './memoryTimeline';
import MemoryDiagram from './MemoryDiagram';
import { instructionExplanation } from './mapping';
import { operandExplanation } from './blocks';

const MAX_EXECUTION_CYCLES = 2000;
type Props = { compilation: Compilation; source?: string; onSelectLine: (line: number) => void };
function ValueTree({ value, previous }: { value: MemoryValue; previous?: MemoryValue }) {
  const changed = previous !== undefined && value.value !== previous.value;
  return <li className={changed ? 'compile-memory-changed' : ''}>
    <div className="compile-memory-value"><strong>{value.name}</strong><code>{value.type}</code><span>{value.address !== undefined ? hex(value.address) : '주소 미확인'}</span><b title={value.unavailable}>{value.unavailable || value.value}</b>{changed && <small>변경됨</small>}</div>
    {value.children.length > 0 && <ul>{value.children.map((child, i) => <ValueTree key={`${child.name}-${i}`} value={child} previous={previous?.children.find(old => old.name === child.name)} />)}</ul>}
  </li>;
}
export default function RuntimeInspector({ compilation, source = '', onSelectLine }: Props) {
  const [trace, setTrace] = useState<ExecutionTrace | null>(null);
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [scenes, setScenes] = useState<MemoryStep[]>([]);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const request = useRef<AbortController | null>(null);
  const section = useRef<HTMLElement | null>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  useEffect(() => { if (trace) section.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); }, [trace]);
  useEffect(() => {
    if (!playing || !scenes.length) return;
    const timer = setInterval(() => setStep(current => {
      if (current >= scenes.length - 1) { setPlaying(false); return current; }
      if (current === scenes.length - 2) setPlaying(false);
      return current + 1;
    }), 1500);
    return () => clearInterval(timer);
  }, [playing, scenes]);
  const scene = scenes[step];
  const cycle = scene ? trace?.history[scene.index] : undefined;
  const previousScene = step > 0 ? scenes[step - 1] : undefined;
  const previousCycle = previousScene ? trace?.history[previousScene.index] : undefined;
  const snapshot = useMemo(() => cycle ? snapshotForCycle(cycle) : undefined, [cycle]);
  const previousSnapshot = useMemo(() => previousCycle ? snapshotForCycle(previousCycle) : undefined, [previousCycle]);
  const view = useMemo(() => debug && snapshot ? inspectMemory(debug, snapshot) : null, [debug, snapshot]);
  const previous = useMemo(() => debug && previousSnapshot ? inspectMemory(debug, previousSnapshot) : null, [debug, previousSnapshot]);
  async function run() {
    if (request.current || !compilation.binaryUrl) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setPlaying(false); setTrace(null); setDebug(null); setScenes([]); setStep(0);
    try {
      const metadata = await loadDebugInfo(compilation.binaryUrl, controller.signal);
      const execution = await executeCompilation(compilation, MAX_EXECUTION_CYCLES, controller.signal);
      if (!controller.signal.aborted) {
        const timeline = memoryTimeline(metadata, execution.history);
        setDebug(metadata); setTrace(execution); setScenes(timeline); setStep(0); setPlaying(timeline.length > 1);
      }
    } catch (failure) { if (!controller.signal.aborted) setError(compileError(failure)); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  const canRun = !!(compilation.binaryUrl && (compilation.simulationToken || compilation.buildId));
  const status = trace?.executionStatus === 'COMPLETED' ? '실행 완료' : trace?.executionStatus === 'CYCLE_LIMIT' ? '실행 한도 도달 · 이후 변화는 기록되지 않았을 수 있습니다' : trace?.executionStatus === 'SIMULATION_ERROR' ? '실행 중 오류' : trace?.executionStatus || '';
  const instruction = Object.values(cycle?.buffers || {}).find(buffer => buffer && buffer.pc === snapshot?.current_pc && !['empty', 'bubble', 'flushed'].includes(buffer.status))?.assembly;
  const sourceLine = view?.line;
  const sourceText = sourceLine ? source.split('\n')[sourceLine - 1]?.trim() : undefined;
  const pointerName = (value: string, typeId?: number) => {
    if (!value.startsWith('0x')) return value;
    return [...(view?.nodes || []), ...(previous?.nodes || [])].find(node => node.address === Number(value) && node.typeId === typeId)?.name || '대상 미확인';
  };
  return <section ref={section} id="compile-runtime" className="compile-runtime" aria-label="실행 중 자료구조">
    <div className="compile-runtime-heading">
      <div><p className="compile-runtime-eyebrow">컴파일 다음 단계</p><h2>메모리 변화 시각화</h2><p>배열은 칸으로, 포인터는 화살표로 표시합니다. 값이 바뀌는 단계를 따라가 보세요.</p></div>
      <div className="compile-runtime-actions"><button className="compile-run-button" disabled={busy || !canRun} onClick={run}>{busy ? '실행하고 그림을 만드는 중…' : trace ? '다시 실행' : '코드 실행하고 변화 보기'}</button>{busy && <button onClick={() => { request.current?.abort(); request.current = null; setBusy(false); }}>취소</button>}
      </div>
    </div>
    {!canRun && <p>이 빌드에 실행용 ELF 또는 실행 권한이 없습니다. 다시 컴파일해 주세요.</p>}
    {error && <p className="compile-error" role="alert">{error}</p>}
    {!trace && <div className="compile-runtime-empty"><div><strong>1</strong><span>작성한 C 코드 실행</span></div><span aria-hidden="true">→</span><div><strong>2</strong><span>변수·배열의 값 기록</span></div><span aria-hidden="true">→</span><div><strong>3</strong><span>값과 포인터 연결을 그림으로 보기</span></div><p>실제 실행 기록으로 그립니다. 버튼을 누르면 현재 컴파일한 코드가 실행됩니다.</p></div>}
    {trace && <>
      <div className="compile-execution-summary"><span role="status">{status}</span>{trace.executionStatus === 'COMPLETED' && trace.history.length > 0 && <strong title="종료 시 a0 레지스터에 남은 main 반환값입니다.">최종 반환값: {Number(trace.history.at(-1)!.global_result.registers.x10) | 0}</strong>}</div>
      {trace.executionStatus === 'SIMULATION_ERROR' && <p className="compile-error">{trace.history.at(-1)?.cycle_events?.runtime_error?.message || 'CORE 실행 중 오류가 발생했습니다.'}</p>}
      {!scenes.length ? <p>실행 기록이 없습니다.</p> : <>
        <div className={`compile-runtime-controls${playing ? ' is-playing' : ''}`}>
          <button disabled={step === 0} onClick={() => { setPlaying(false); setStep(step - 1); }}>이전 변화</button>
          <button disabled={scenes.length < 2} onClick={() => { if (step === scenes.length - 1) setStep(0); setPlaying(!playing); }}>{playing ? '일시정지' : '자동 재생'}</button>
          <button disabled={step >= scenes.length - 1} onClick={() => { setPlaying(false); setStep(step + 1); }}>다음 변화</button>
          <input aria-label="메모리 변화 단계 선택" type="range" min={0} max={scenes.length - 1} value={step} onChange={event => { setPlaying(false); setStep(Number(event.target.value)); }} />
          <span>단계 {step + 1} / {scenes.length}</span>
        </div>
        <p className="compile-step-guide">초기 상태와 메모리 변화가 기록된 시점을 모았습니다. 현재 CPU 사이클 {cycle?.clock}의 모습입니다.</p>
        <div className="compile-memory-flow">
          <article><span>연결된 C 소스</span>{sourceLine ? <button onClick={() => onSelectLine(sourceLine)}><b>C {sourceLine}행 ↗</b><code>{sourceText || '소스 위치 보기'}</code></button> : <p>C 코드 진입 전 또는 함수 복귀 후</p>}</article>
          <span className="compile-flow-arrow" aria-hidden="true">→</span>
          <article><span>현재 RISC-V 어셈블리</span><code>{instruction || (trace.executionStatus === 'COMPLETED' ? '실행 중인 명령어 없음' : '다음 명령 대기')}</code>{instruction && <p>{operandExplanation(instruction) || instructionExplanation(instruction)}</p>}</article>
          <span className="compile-flow-arrow" aria-hidden="true">→</span>
          <article className="compile-flow-change"><span>메모리에 남은 변화</span>{scene.changes.length ? <><ul>{scene.changes.slice(0, 6).map(change => <li key={`${change.name}-${change.address}`}><b>{change.name}</b><span>{change.pointer ? pointerName(change.before, change.targetType) : change.before} → <strong>{change.pointer ? pointerName(change.after, change.targetType) : change.after}</strong></span></li>)}</ul>{scene.changes.length > 6 && <p>그 밖의 변화 {scene.changes.length - 6}개</p>}</> : <p>{step === 0 ? '아직 기록된 변수 변화가 없습니다.' : '이 시점에는 새 메모리 변화가 없습니다.'}</p>}</article>
        </div>
      </>}
      {view && <>{view.warnings.map(message => <p className="compile-warning" key={message}>{message}</p>)}
        <MemoryDiagram key={scene.index} view={view} changes={scene.changes} finished={step === scenes.length - 1} playing={playing} onSelectLine={onSelectLine} />
        <details className="compile-runtime-values"><summary>주소·타입과 변수 값 자세히 보기</summary><p>CPU 사이클 {cycle?.clock} · 명령 위치 {snapshot?.current_pc} · 단일 명령 실행 모드</p><ul>{view.variables.map((value, index) => <ValueTree key={`${value.name}-${index}`} value={value} previous={previous?.variables.find(old => old.name === value.name && old.address === value.address)} />)}</ul></details>
        <p className="compile-footnote">현재 위치에서 주소나 레지스터를 확인할 수 있는 변수만 표시합니다. 그림에는 독립 변수 최대 24개, 배열 최대 8개(각 앞 32개 원소), 포인터 그래프 최대 40개 노드를 표시합니다. 회색은 값 또는 위치를 확인하지 못했다는 뜻입니다. 초기화 완료·할당 해제 여부는 보장하지 않습니다.</p>
      </>}
      {trace.console_output && <pre className="compile-console">{trace.console_output}</pre>}
    </>}
  </section>;
}
