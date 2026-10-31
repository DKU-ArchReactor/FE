import { useEffect, useMemo, useRef, useState } from 'react';
import type { Compilation } from './compile';
import { compileError } from './compile';
import { executeCompilation, loadDebugInfo } from './execution';
import type { ExecutionTrace } from './execution';
import type { DebugInfo } from './debug';
import { hex, inspectMemory, snapshotForCycle } from './runtime';
import type { MemoryValue } from './runtime';
import StructureGraph from './StructureGraph';

type Props = { compilation: Compilation; onSelectLine: (line: number) => void };
function ValueTree({ value, previous }: { value: MemoryValue; previous?: MemoryValue }) {
  const changed = previous !== undefined && value.value !== previous.value;
  return <li className={changed ? 'compile-memory-changed' : ''}>
    <div className="compile-memory-value"><strong>{value.name}</strong><code>{value.type}</code><span>{value.address !== undefined ? hex(value.address) : '주소 미확인'}</span><b title={value.unavailable}>{value.unavailable || value.value}</b>{changed && <small>변경됨</small>}</div>
    {value.children.length > 0 && <ul>{value.children.map((child, i) => <ValueTree key={`${child.name}-${i}`} value={child} previous={previous?.children.find(old => old.name === child.name)} />)}</ul>}
  </li>;
}
export default function RuntimeInspector({ compilation, onSelectLine }: Props) {
  const [trace, setTrace] = useState<ExecutionTrace | null>(null);
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [maxCycles, setMaxCycles] = useState(2000);
  const [playing, setPlaying] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  useEffect(() => {
    if (!playing || !trace?.history.length) return;
    const timer = setInterval(() => setStep(current => { if (current >= trace.history.length - 1) { setPlaying(false); return current; } return current + 1; }), 200);
    return () => clearInterval(timer);
  }, [playing, trace]);
  const cycle = trace?.history[step];
  const previousCycle = step > 0 ? trace?.history[step - 1] : undefined;
  const snapshot = useMemo(() => cycle ? snapshotForCycle(cycle) : undefined, [cycle]);
  const previousSnapshot = useMemo(() => previousCycle ? snapshotForCycle(previousCycle) : undefined, [previousCycle]);
  const view = useMemo(() => debug && snapshot ? inspectMemory(debug, snapshot) : null, [debug, snapshot]);
  const previous = useMemo(() => debug && previousSnapshot ? inspectMemory(debug, previousSnapshot) : null, [debug, previousSnapshot]);
  async function run() {
    if (request.current || !compilation.binaryUrl) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setPlaying(false); setTrace(null); setDebug(null); setStep(0);
    try {
      const metadata = await loadDebugInfo(compilation.binaryUrl, controller.signal);
      const execution = await executeCompilation(compilation, maxCycles, controller.signal);
      if (!controller.signal.aborted) { setDebug(metadata); setTrace(execution); }
    } catch (failure) { if (!controller.signal.aborted) setError(compileError(failure)); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  const nodes = view?.nodes.map(value => ({ id: hex(value.address!), title: value.name, subtitle: `${value.type} @ ${hex(value.address!)}`, line: value.line, fields: value.children.map(child => ({ name: child.name, value: child.unavailable || child.value })) })) || [];
  const targets = new Map(view?.nodes.map(node => [hex(node.address!), node.typeId]));
  const edges = view?.nodes.flatMap(value => value.children.flatMap(child => child.pointer && child.targetType !== undefined && targets.get(hex(child.pointer)) === child.targetType ? [{ from: hex(value.address!), to: hex(child.pointer), label: child.name }] : [])) || [];
  const status = trace?.executionStatus === 'COMPLETED' ? '실행 종료' : trace?.executionStatus === 'CYCLE_LIMIT' ? '최대 사이클 도달 · 종료 여부 미확인' : trace?.executionStatus || '';
  return <section id="compile-runtime" className="compile-runtime" aria-label="실행 중 자료구조">
    <div className="compile-runtime-heading"><div><h2>실행 중 자료구조와 메모리</h2><p>CORE의 실제 사이클 기록과 ELF 디버그 정보로 변수·포인터 값을 표시합니다.</p></div><div className="compile-runtime-actions"><label>최대 사이클 <select disabled={busy} value={maxCycles} onChange={event => setMaxCycles(Number(event.target.value))}><option value={500}>500</option><option value={2000}>2000</option></select></label><button disabled={busy || !compilation.binaryUrl || !(compilation.simulationToken || compilation.buildId)} onClick={run}>{busy ? '실행 기록 가져오는 중…' : '실행 기록 불러오기'}</button>{busy && <button onClick={() => { request.current?.abort(); request.current = null; setBusy(false); }}>취소</button>}</div></div>
    {!(compilation.binaryUrl && (compilation.simulationToken || compilation.buildId)) && <p>이 빌드에 실행용 ELF 또는 실행 권한이 없습니다. 다시 컴파일해 주세요.</p>}
    {error && <p className="compile-error" role="alert">{error}</p>}
    {trace && <><p role="status">{status} · {trace.history.length}개 기록 · single 모드</p>
      {trace.executionStatus === 'COMPLETED' && trace.history.length > 0 && <p>마지막 a0 레지스터: {Number(trace.history.at(-1)!.global_result.registers.x10) | 0}</p>}
      {trace.executionStatus === 'SIMULATION_ERROR' && <p className="compile-error">{trace.history.at(-1)?.cycle_events?.runtime_error?.message || 'CORE 실행 중 오류가 발생했습니다.'}</p>}
      {trace.history.length === 0 ? <p>실행 기록이 없습니다.</p> : <div className="compile-runtime-controls"><button disabled={step === 0} onClick={() => { setPlaying(false); setStep(step - 1); }}>이전</button><button onClick={() => setPlaying(!playing)}>{playing ? '일시정지' : '재생'}</button><button disabled={step >= trace.history.length - 1} onClick={() => { setPlaying(false); setStep(step + 1); }}>다음</button><input aria-label="실행 사이클 선택" type="range" min={0} max={trace.history.length - 1} value={step} onChange={event => { setPlaying(false); setStep(Number(event.target.value)); }} /><span>사이클 {trace.history[step]?.clock} · PC {snapshot?.current_pc}</span>{view?.line && <button onClick={() => onSelectLine(view.line!)}>C {view.line}행 보기</button>}</div>}
      {view && <>{view.warnings.map(message => <p className="compile-warning" key={message}>{message}</p>)}<StructureGraph nodes={nodes} edges={edges} onSelectLine={onSelectLine} />
        {view.variables.length === 0 && <p>현재 PC 범위에서 위치를 확인할 수 있는 변수가 없습니다. 함수가 실행 중인 사이클로 이동해 보세요.</p>}
        <details className="compile-runtime-values" open><summary>현재 범위의 변수 {view.variables.length}개</summary><ul>{view.variables.map((value, index) => <ValueTree key={`${value.name}-${index}`} value={value} previous={previous?.variables.find(old => old.name === value.name && old.address === value.address)} />)}</ul></details>
        <p className="compile-footnote">표시 값은 해당 사이클의 메모리 기록입니다. 초기화 완료·할당 해제 여부를 보장하지 않습니다. 기록이 없는 주소, 지원하지 않는 위치 표현, 범위가 불명확한 변수는 추측하지 않습니다. 구조체 필드는 최대 32개, 배열은 앞 32개, 그래프는 최대 40개 노드를 표시합니다.</p></>}
      {trace.console_output && <pre className="compile-console">{trace.console_output}</pre>}
    </>}
  </section>;
}
