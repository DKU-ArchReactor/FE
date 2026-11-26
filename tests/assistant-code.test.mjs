import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/pages/Main/utils/assistantCode.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { extractCPrograms, requestsCodeApplication, codeGenerationQuestion } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('extracts closed C fences in order, preserving source, indentation and Unicode', () => {
  assert.deepEqual(extractCPrograms('설명\r\n```c\r\nint main() {\r\n  return 5; // 합\r\n}\r\n```\r\n~~~C\nint x;\n~~~'), ['int main() {\n  return 5; // 합\n}\n', 'int x;\n']);
});
test('does not apply inline, unlabelled, foreign, unfinished, nested or oversized code', () => {
  for (const text of ['`int x;`', '```\nint x;\n```', '```cpp\nint x;\n```', '```c\nint x;', '```c\n \n```', '```c\nint\0 x;\n```', '````text\n```c\nint x;\n```\n````', '```c\n' + '가'.repeat(22000) + '\n```']) {
    assert.deepEqual(extractCPrograms(text), [], text.slice(0, 100));
  }
  assert.deepEqual(extractCPrograms('````c\nint x;\n```'), []);
});
test('only explicit application requests select auto apply by default', () => {
  for (const text of ['반복문 예제를 만들어서 C 코드 영역에 넣어줘', '편집기에 적용해줘', '에디터에 작성해줘', 'Write C code into the editor']) assert.equal(requestsCodeApplication(text), true, text);
  for (const text of ['예제를 만들어줘', '편집기에 적용하지 말아줘', '편집기에 넣어주는 방법을 설명해줘', '편집기에 넣어줄 수 있어?', 'do not write to the editor', '편집기에 넣어주지 마', '편집기에 넣어줘라는 문장의 의미를 설명해줘']) assert.equal(requestsCodeApplication(text), false, text);
});
test('generation requests ask for a complete program while explanations stay unchanged', () => {
  assert.match(codeGenerationQuestion('반복문 예제를 만들어줘', false), /main.*```c/);
  assert.match(codeGenerationQuestion('이렇게 바꿔줘', true), /전체 소스/);
  assert.equal(codeGenerationQuestion('CPI란?', false), 'CPI란?');
  assert.equal(codeGenerationQuestion('ASM 코드를 만들어줘', false), 'ASM 코드를 만들어줘');
  assert.equal(codeGenerationQuestion('반복문 예제를 만들어줘', false, 'asm'), '반복문 예제를 만들어줘');
  const long = 'C 예제를 만들어줘' + ' '.repeat(7988);
  assert.equal(codeGenerationQuestion(long, true), long);
});
