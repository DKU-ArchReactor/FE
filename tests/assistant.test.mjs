import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/api/assistant.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } });
const { consumeChatStream, boundedHistory, executionReference } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputText).toString('base64'));
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

test('reserves message and character budget for server execution context', () => {
  const result = boundedHistory(Array.from({length:20}, () => ({role:'user',content:'x'.repeat(1200)})), true);
  assert.ok(result.length <= 19);
  assert.ok(result.reduce((n,m) => n + m.content.length,0) <= 16000);
});

test('execution request includes exact snapshot version and zero-based cycle', async () => {
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
    const execution = {execution_id:'00000000-0000-0000-0000-000000000001',result_version:'a'.repeat(64),artifact_sha256:'b'.repeat(64),mode:'single',cycle:0,memory_addresses:[]};
    await streamChat([{role:'user',content:'explain'}], controller.signal, () => {}, execution);
    assert.deepEqual(JSON.parse(sent.body).context, execution);
    assert.equal(sent.signal, controller.signal);
    await streamChat([{role:'user',content:'general'}], controller.signal, () => {});
    assert.equal('context' in JSON.parse(sent.body), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});

 test('snapshot references reject mismatched mode, expiry and unavailable cycles', () => {
  const descriptor = {available:true, execution_id:'run-a',result_version:'a'.repeat(64),artifact_sha256:'b'.repeat(64),mode:'single',cycle_min:0,cycle_max:2,expires_at:new Date(Date.now()+60000).toISOString()};
  assert.equal(executionReference(descriptor, 'single', 0).cycle, 0);
  assert.equal(executionReference(descriptor, 'pipeline', 0), undefined);
  assert.equal(executionReference(descriptor, 'single', 3), undefined);
  assert.equal(executionReference(descriptor, 'single', -1), undefined);
  assert.equal(executionReference({...descriptor,expires_at:'invalid'}, 'single', 0), undefined);
  assert.equal(executionReference({...descriptor,expires_at:'2000-01-01'}, 'single', 0), undefined);
  assert.equal(executionReference({...descriptor,available:false}, 'single', 0), undefined);
});
