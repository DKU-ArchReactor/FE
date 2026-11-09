import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/pages/Main/utils/tutorAnalysis.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
function load(post) {
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports,
    require: name => {
      assert.equal(name, '@/api/config');
      return { default: { post } };
    },
  });
  return exports;
}
const explanation = (kind, text) => ({ kind, category: 'test', title: text, summary: text, detail: text });

test('compile and simulation explanations are displayed without another request', async () => {
  const tutor = load(() => assert.fail('seeded explanations must not request the API'));
  tutor.seedTutor({ schema_version: '1.0',
    c_lines: [{ line: 3, text: 'int x = 2;', explanation: explanation('c', '변수 초기화') }],
    asm_instructions: [{ text: 'auipc ra, 0', pc: '0x10000', explanation: explanation('asm', '주소 계산'),
      runtime_explanation: explanation('crt', '런타임 코드') }],
  });
  await tutor.fetchTutor([
    { kind: 'c', text: 'int x = 2;', line: 3 },
    { kind: 'asm', text: 'auipc ra, 0' },
    { kind: 'crt', text: 'auipc ra, 0', pc: '0x10000' },
  ], new AbortController().signal);
  assert.equal(tutor.analyzeCLine('int x = 2;', 3).summary, '변수 초기화');
  assert.equal(tutor.analyzeAsmInstruction('auipc ra, 0').explanation, '주소 계산');
  assert.equal(tutor.analyzeCrtInstruction('auipc ra, 0', '0x10000').summary, '런타임 코드');
});

test('uncached lines are deduplicated and requested in API-sized batches', async () => {
  const sizes = [];
  const tutor = load(async (url, { items }) => {
    assert.equal(url, '/api/v1/tutor/explain');
    sizes.push(items.length);
    return { data: { items: items.map(x => explanation(x.kind, x.text)) } };
  });
  const items = Array.from({ length: 130 }, (_, i) => ({ kind: 'c', text: `int x${i};`, line: i + 1 }));
  await tutor.fetchTutor([...items, ...items], new AbortController().signal);
  assert.deepEqual(sizes, [128, 2]);
  assert.equal(tutor.analyzeCLine('int x129;', 130).summary, 'int x129;');
  await tutor.fetchTutor(items, new AbortController().signal);
  assert.deepEqual(sizes, [128, 2]);
});

test('failed requests remain retryable instead of caching missing explanations', async () => {
  let attempts = 0;
  const tutor = load(async (_url, { items }) => {
    if (++attempts === 1) throw new Error('network failure');
    return { data: { items: items.map(x => explanation(x.kind, '재시도 성공')) } };
  });
  const items = [{ kind: 'c', text: 'return 0;', line: 1 }];
  await assert.rejects(tutor.fetchTutor(items, new AbortController().signal), /network failure/);
  await tutor.fetchTutor(items, new AbortController().signal);
  assert.equal(tutor.analyzeCLine('return 0;', 1).summary, '재시도 성공');
});

test('a cancelled response does not populate the cache', async () => {
  const controller = new AbortController();
  const tutor = load(async (_url, { items }, { signal }) => {
    assert.equal(signal, controller.signal);
    controller.abort();
    return { data: { items: items.map(x => explanation(x.kind, '취소된 해설')) } };
  });
  await tutor.fetchTutor([{ kind: 'asm', text: 'add a0, a1, a2' }], controller.signal);
  assert.equal(tutor.analyzeAsmInstruction('add a0, a1, a2').action, '해설 대기');
});
