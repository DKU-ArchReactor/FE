import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

async function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source.replaceAll('import.meta.env.VITE_API_URL', '""'), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return import('data:text/javascript;base64,' + Buffer.from(compiled.outputText).toString('base64'));
}
const { captureEditorSource } = await load('../src/pages/Main/utils/assistantSource.ts');
const { streamChat } = await load('../src/api/assistant.ts');

test('C/ASM capture uses current text without altering it and freezes a per-question copy', () => {
  const c = 'int main(void) { return 8; }\n';
  const first = captureEditorSource(true, 'c', c, true);
  const second = captureEditorSource(true, 'asm', 'addi a0, zero, 9', true);
  assert.deepEqual(first, { language: 'c', content: c });
  assert.equal(second.language, 'asm');
  assert.equal(captureEditorSource(false, 'c', c, false), undefined);
  assert.equal(captureEditorSource(true, 'c', '  ', false), undefined);
});

test('unsupported backend and oversized code fail explicitly, without truncation', () => {
  assert.throws(() => captureEditorSource(true, 'c', 'int x;', false), /백엔드/);
  assert.throws(() => captureEditorSource(true, 'c', 'x'.repeat(12001), true), /12,000/);
  assert.equal([...captureEditorSource(true, 'c', '😀'.repeat(12000), true).content].length, 12000);
});

test('chat sends editor source separately from history and retains SSE completion', async () => {
  const oldFetch = globalThis.fetch;
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let payload;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'synthetic-test-token' } });
  globalThis.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return new Response('data: {"type":"delta","text":"코드 설명"}\n\ndata: {"type":"done","stop_reason":"end_turn","usage":{}}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  };
  try {
    const messages = [{ role: 'user', content: '이 코드 설명해' }];
    const source = captureEditorSource(true, 'c', 'int main(void){return 8;}', true);
    const events = [];
    await streamChat(messages, new AbortController().signal, event => events.push(event), undefined, source);
    assert.deepEqual(payload, { messages, editor_source: source });
    assert.deepEqual(events.map(event => event.type), ['delta', 'done']);
    await streamChat(messages, new AbortController().signal, () => {});
    assert.deepEqual(payload, { messages });
  } finally {
    globalThis.fetch = oldFetch;
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage);
    else delete globalThis.localStorage;
  }
});
