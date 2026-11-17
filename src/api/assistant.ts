export type ExecutionReference = { build_id: string; mode: 'single' | 'pipeline'; max_cycles: number; history_index: number };
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ChatEvent =
  | { type: 'context'; kind: string; build_id: string; execution_id: string; core_version: string; mode: string; history_index: number }
  | { type: 'delta'; text: string }
  | { type: 'done'; stop_reason: string; usage?: Record<string, number> }
  | { type: 'error'; code: string; message: string };

export function boundedHistory(messages: ChatMessage[], withExecution = false): ChatMessage[] {
  const result: ChatMessage[] = [];
  let size = 0;
  for (const message of [...messages].reverse()) {
    if (result.length === (withExecution ? 19 : 20) || size + message.content.length > (withExecution ? 16000 : 24000)) break;
    result.unshift(message);
    size += message.content.length;
  }
  while (result[0]?.role === 'assistant') result.shift();
  return result;
}

export async function consumeChatStream(
  body: ReadableStream<Uint8Array>, onEvent: (event: ChatEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  try {
    while (!completed) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame.split('\n').filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart()).join('\n');
        if (!data) continue;
        const event = JSON.parse(data) as ChatEvent;
        if (event.type === 'error') throw new Error(event.message);
        if (event.type === 'delta' || event.type === 'done' || event.type === 'context') onEvent(event);
        if (event.type === 'done') { completed = true; break; }
      }
      if (done) break;
    }
    if (!completed) throw new Error('답변 연결이 완료 전에 끊겼습니다. 다시 시도해 주세요.');
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function streamChat(
  messages: ChatMessage[], signal: AbortSignal, onEvent: (event: ChatEvent) => void,
  execution?: ExecutionReference,
): Promise<void> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('AI 어시스턴트는 로그인 후 이용할 수 있습니다.');
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const response = await fetch(`${base}/api/v1/assistant/chat`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: boundedHistory(messages, !!execution), ...(execution ? { execution } : {}) }),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('로그인이 만료되었거나 권한이 없습니다. 다시 로그인해 주세요.');
    }
    const payload = await response.json().catch(() => null);
    const detail = typeof payload?.detail === 'string' ? payload.detail : payload?.detail?.message;
    const explanation: Record<number, string> = { 413: '선택한 실행 정보가 너무 큽니다. 더 짧은 실행으로 다시 시도해 주세요.', 422: '선택한 사이클이나 대화 길이를 확인해 주세요.', 429: '요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.', 503: 'AI 연결이 아직 준비되지 않았습니다.' };
    throw new Error(explanation[response.status] || detail || 'AI 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new Error('AI 응답 형식을 확인할 수 없습니다.');
  }
  await consumeChatStream(response.body, onEvent);
}
