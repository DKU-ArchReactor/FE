import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/pages/Main/utils/assistantCode.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { extractCodePrograms, requestsCodeApplication, requestedCodeLanguage, codeGenerationQuestion } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('extracts closed C fences in order, preserving source, indentation and Unicode', () => {
  assert.deepEqual(extractCodePrograms('설명\r\n```c\r\nint main() {\r\n  return 5; // 합\r\n}\r\n```\r\n~~~C\nint x;\n~~~'), [{language:'c',source:'int main() {\n  return 5; // 합\n}\n'}, {language:'c',source:'int x;\n'}]);
});
test('does not apply inline, unlabelled, foreign, unfinished, nested or oversized code', () => {
  for (const text of ['`int x;`', '```\nint x;\n```', '```cpp\nint x;\n```', '```c\nint x;', '```c\n \n```', '```c\nint\0 x;\n```', '````text\n```c\nint x;\n```\n````', '```c\n' + '가'.repeat(22000) + '\n```']) {
    assert.deepEqual(extractCodePrograms(text), [], text.slice(0, 100));
  }
  assert.deepEqual(extractCodePrograms('````c\nint x;\n```'), []);
});
test('only explicit application requests select auto apply by default', () => {
  for (const text of ['반복문 예제를 만들어서 C 코드 영역에 넣어줘', 'ASM 코드 영역에 넣어줘', '어셈블리 편집기에 적용해줘', '편집기에 적용해줘', '에디터에 작성해줘', 'Write C code into the editor']) assert.equal(requestsCodeApplication(text), true, text);
  for (const text of ['예제를 만들어줘', '편집기에 적용하지 말아줘', '편집기에 넣어주는 방법을 설명해줘', '편집기에 넣어줄 수 있어?', 'do not write to the editor', '편집기에 넣어주지 마', '편집기에 넣어줘라는 문장의 의미를 설명해줘']) assert.equal(requestsCodeApplication(text), false, text);
});
test('generation requests ask for a complete program while explanations stay unchanged', () => {
  assert.match(codeGenerationQuestion('반복문 예제를 만들어줘', false), /main.*```c/);
  assert.match(codeGenerationQuestion('이렇게 바꿔줘', true), /전체 소스/);
  assert.equal(codeGenerationQuestion('CPI란?', false), 'CPI란?');
  assert.match(codeGenerationQuestion('ASM 코드를 만들어줘', false), /RV32IM RISC-V.*```asm/);
  assert.match(codeGenerationQuestion('반복문 예제를 만들어줘', false, 'asm'), /RV32IM RISC-V.*```asm/);
  assert.match(codeGenerationQuestion('C 예제를 만들어줘', false, 'asm'), /main.*```c/);
  const long = 'C 예제를 만들어줘' + ' '.repeat(7988);
  assert.equal(codeGenerationQuestion(long, true), long);
});

test('extracts ASM aliases and mixed language candidates without losing source', () => {
  for (const tag of ['asm', 'ASM', 'assembly', 'riscv', 'risc-v']) {
    assert.deepEqual(extractCodePrograms('```' + tag + '\nmain:\n  li a0, 42\n  ret\n```'), [{language:'asm',source:'main:\n  li a0, 42\n  ret\n'}]);
  }
  assert.deepEqual(extractCodePrograms('```c\nint x;\n```\n```asm\nret\n```').map(p => p.language), ['c','asm']);
});
test('explicit destinations determine the target language with editor mode as fallback', () => {
  for (const [text, fallback, expected] of [
    ['예제를 만들어줘', 'asm', 'asm'],
    ['ASM 코드를 만들어줘', 'c', 'asm'],
    ['C 코드로 만들어줘', 'asm', 'c'],
    ['C 코드를 변환해서 ASM 코드 영역에 넣어줘', 'c', 'asm'],
    ['ASM을 C 편집기에 넣어줘', 'asm', 'c'],
    ['C 코드를 어셈블리 편집기에 넣어줘', 'c', 'asm'],
  ]) assert.equal(requestedCodeLanguage(text, fallback), expected, text);
});

test('example requests choose one complete program without a candidate-selection turn', () => {
  for (const language of ['c', 'asm']) {
    for (const request of ['예제를 만들어줘', '반복문 예제 추천해줘', '예시 보여줘', '만들어줘 반복문 예제', 'Show me a sample program', 'Give me an example']) {
      const question = codeGenerationQuestion(request, false, language);
      assert.ok(question.startsWith(request), request);
      assert.match(question, /후보나 주제를 나열하거나.*선택 또는 추가 확인을 요구하지 마/);
      assert.match(question, /대표 예제 하나를 직접 정해 바로 작성/);
      assert.match(question, /완성된 프로그램 정확히 하나와 코드 블록 정확히 하나/);
      assert.ok(question.includes('```' + language));
    }
  }
  assert.equal(codeGenerationQuestion('이 예제의 동작을 설명해줘', false), '이 예제의 동작을 설명해줘');
});
