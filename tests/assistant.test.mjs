import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/api/assistant.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } });
const { consumeChatStream, boundedHistory } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputText).toString('base64'));
function stream(text, split = 1) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += split) controller.enqueue(bytes.slice(i, i + split));
    controller.close();
  }});
}

test('parses fragmented UTF-8 and CRLF, comments, and completion', async () => {
  const received = [];
  await consumeChatStream(stream(': keepalive\r\n\r\ndata: {"type":"delta","text":"한글\\n답변"}\r\n\r\ndata: {"type":"done","stop_reason":"end_turn"}\r\n\r\n'), event => received.push(event));
  assert.equal(received[0].text, '한글\n답변');
  assert.equal(received[1].type, 'done');
});

test('reports provider error instead of success', async () => {
  await assert.rejects(consumeChatStream(stream('data: {"type":"error","message":"권한 없음"}\n\n'), () => {}), /권한 없음/);
});

test('detects interrupted streams', async () => {
  await assert.rejects(consumeChatStream(stream('data: {"type":"delta","text":"partial"}\n\n'), () => {}), /완료 전에/);
});

test('request history remains bounded and starts with user', () => {
  const messages = Array.from({length: 30}, (_, i) => ({role: i % 2 ? 'user' : 'assistant', content: 'x'.repeat(8000)}));
  const result = boundedHistory(messages);
  assert.equal(result[0].role, 'user');
  assert.equal(result.at(-1).role, 'user');
  assert.ok(result.length <= 20);
  assert.ok(result.reduce((n, message) => n + message.content.length, 0) <= 24000);
});

test('forwards rerun context and SOLID stop completion', async () => {
  const received = [];
  await consumeChatStream(stream('data: {"type":"context","kind":"server_rerun_not_original_execution","history_index":3}\n\ndata: {"type":"delta","text":"해설"}\n\ndata: {"type":"done","stop_reason":"stop"}\n\n'), e => received.push(e));
  assert.equal(received[0].type, 'context');
  assert.equal(received[0].history_index, 3);
  assert.equal(received[2].stop_reason, 'stop');
});

test('reserves message and character budget for server execution context', () => {
  const result = boundedHistory(Array.from({length:20}, () => ({role:'user',content:'x'.repeat(1200)})), true);
  assert.ok(result.length <= 19);
  assert.ok(result.reduce((n,m) => n + m.content.length,0) <= 16000);
});

test('execution request includes exact build and zero-based history index', async () => {
  const isolatedSource = source.replace("import.meta.env.VITE_API_URL", "'http://local.test'");
  const { outputText } = ts.transpileModule(isolatedSource, {compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}});
  const { streamChat } = await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  let sent;
  globalThis.localStorage = { getItem: () => 'synthetic-local-test' };
  globalThis.fetch = async (url, options) => {
    sent = {url, ...options};
    return new Response('data: {"type":"done","stop_reason":"stop"}\n\n', {headers:{'content-type':'text/event-stream'}});
  };
  try {
    const controller = new AbortController();
    const execution = {build_id:'test-build',mode:'single',max_cycles:2000,history_index:0};
    await streamChat([{role:'user',content:'explain'}], controller.signal, () => {}, execution);
    assert.deepEqual(JSON.parse(sent.body).execution, execution);
    assert.equal(sent.signal, controller.signal);
    await streamChat([{role:'user',content:'general'}], controller.signal, () => {});
    assert.equal('execution' in JSON.parse(sent.body), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
