// Isolated manual/browser-test fixture. No requests reach an external API.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AiAssistantPopup from '../../src/components/AiAssistantPopup';
import type { ExecutionContext } from '../../src/type/assistant';
import type { SimulationResult } from '../../src/type/simulation';
import trace from './fixtures/pipeline.json';
import '../../src/index.css';

const sample = { ...trace, assistant_context: {
  available: true, execution_id: '11111111-1111-4111-8111-111111111111',
  result_version: 'a'.repeat(64), artifact_sha256: 'b'.repeat(64), mode: 'pipeline',
  cycle_min: 0, cycle_max: trace.history.at(-1)!.clock, expires_at: '2099-01-01T00:00:00Z',
}} as unknown as SimulationResult;
const fallback = '이 질문에 대한 실행 근거를 확인하지 못했습니다. 확인할 명령어나 사이클을 구체적으로 알려 주세요.';
const answer = '선택한 사이클의 자료에서 확인한 내용입니다.\n\n- **CPI = 2**입니다.\n- 포워딩 미발생은 기능이 꺼졌다는 뜻이 아닙니다.';
const encoder = new TextEncoder();
let current: { controller: ReadableStreamDefaultController<Uint8Array>; context?: ExecutionContext; cleanup: () => void } | undefined;
const requests: { messages: { role: string; content: string }[]; context?: ExecutionContext }[] = [];
let cancelled = 0;
const notify = () => window.dispatchEvent(new Event('fixture-update'));
function write(text: string) { current?.controller.enqueue(encoder.encode(text)); }
function event(value: object) { write(`data: ${JSON.stringify(value)}\n\n`); }
function finish() {
  const context = current?.context;
  const reference = context ? Object.fromEntries(Object.entries(context).filter(([key]) => key !== 'memory_addresses')) : undefined;
  event({ type: 'done', stop_reason: 'end_turn', usage: { totalTokens: 21 }, ...(reference ? { context: reference } : {}) });
  close();
}
function close() {
  const pending = current;
  current = undefined;
  pending?.cleanup();
  pending?.controller.close();
  notify();
}
localStorage.setItem('access_token', 'local-validated-response-fixture');
window.fetch = async (input, options) => {
  const url = String(input);
  if (url.endsWith('/assistant/status')) return Response.json({ enabled: true, code: 'LOCAL_FIXTURE', editor_source_supported: true });
  if (!url.endsWith('/assistant/chat')) throw new Error('External requests are blocked in this fixture');
  const body = JSON.parse(String(options?.body));
  requests.push(body);
  const signal = options?.signal;
  const abort = () => {
    if (!current) return;
    const pending = current;
    current = undefined;
    pending.cleanup();
    pending.controller.error(new DOMException('Stopped', 'AbortError'));
    cancelled++;
    notify();
  };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      current = { controller, context: body.context, cleanup: () => signal?.removeEventListener('abort', abort) };
      signal?.addEventListener('abort', abort, { once: true });
      write(': connected\n\n: keepalive\n\n');
      notify();
    },
    cancel() {
      if (current) { current.cleanup(); current = undefined; cancelled++; notify(); }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
};
export function Harness() {
  const [open, setOpen] = useState(true);
  const [snapshot, setSnapshot] = useState({ count: 0, cancelled: 0, last: '' });
  useEffect(() => {
    const update = () => setSnapshot({ count: requests.length, cancelled, last: JSON.stringify(requests.at(-1)?.messages || []) });
    window.addEventListener('fixture-update', update);
    return () => window.removeEventListener('fixture-update', update);
  }, []);
  return <main className="p-6 space-y-4 max-w-xl">
    <h1 className="text-xl font-bold">어시스턴트 응답 검증 · 모의 응답</h1>
    <p>질문 전송 후 아래 버튼으로 응답 시점을 조절하세요. 운영 API와 SOLID는 호출하지 않습니다.</p>
    <div className="flex flex-wrap gap-3">
      <button onClick={() => write(': keepalive\n\n')}>연결 유지</button>
      <button onClick={() => event({ type: 'delta', text: answer })}>답변 전송</button>
      <button onClick={finish}>완료</button>
      <button onClick={() => { event({ type: 'delta', text: answer }); finish(); }}>한 번에 완료</button>
      <button onClick={() => { event({ type: 'delta', text: fallback }); finish(); }}>근거 확인 불가</button>
      <button onClick={() => { event({ type: 'error', code: 'MODEL_TIMEOUT', message: '응답 시간이 초과되었습니다. 다시 시도해 주세요.' }); close(); }}>일시 오류</button>
      <button onClick={close}>연결 종료</button>
      <button onClick={() => setOpen(true)}>대화 열기</button>
    </div>
    <p data-testid="request-count">전송 {snapshot.count}회</p>
    <p data-testid="cancel-count">중단 {snapshot.cancelled}회</p>
    <pre data-testid="last-history" className="whitespace-pre-wrap break-all">{snapshot.last}</pre>
    <AiAssistantPopup isOpen={open} onClose={() => setOpen(false)} authenticated simulation={sample} currentData={sample.history[0]} mode="pipeline" beforeExecution={false} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
