import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {loadTutor} from './load-tutor-component.mjs';
const exports=loadTutor('TutorEvidence.tsx');
const bundle = {execution_steps: [{history_index: 0, cycle: 0, display_clock: 1,
  retired_pc: '0x10000', register_changes: [{key: 'x10', before: '0x0', after: '0x5'}],
  memory_changes: [], memory_transfer: null}]};

test('rewinding repeated PCs restores earlier values and hazards; new runs stay separate', () => {
  const item = {pc: '0x10000', text: 'add a0,a1,a2', explanation: {}};
  const bundle = {execution_steps: [
    {history_index: 0, display_clock: 1, retired_pc: null,
      instruction_observations: [{pc: '0x00010000', stage: 'EX', summary: 'early value'}]},
    {history_index: 1, display_clock: 2, retired_pc: '0x10000'},
    {history_index: 2, display_clock: 3, retired_pc: '0x10000',
      instruction_observations: [{pc: '0x10000', stage: 'EX', summary: 'later value'}]},
  ], performance_analysis: {records: [
    {history_index: 2, kind: 'stall', instruction: {pc: '0x10000'}, detail: 'later hazard'},
  ]}};
  const render = (bundle, historyIndex) => renderToStaticMarkup(createElement(exports.TutorInstructionEvidence, {item, bundle, historyIndex}));
  assert.match(render(bundle, 2), /later value/);
  assert.doesNotMatch(render(bundle, 2), /확인된 완료/);
  assert.match(render(bundle, 2), /later hazard/);
  const rewound = render(bundle, 0);
  assert.match(rewound, /early value/);
  assert.doesNotMatch(rewound, /확인된 완료/);
  assert.doesNotMatch(rewound, /later value|later hazard/);
  const newRun = {execution_steps: [{history_index: 0, display_clock: 1,
    instruction_observations: [{pc: '0x10000', stage: 'EX', summary: 'new run value'}]}]};
  assert.match(render(newRun, 0), /new run value/);
  assert.doesNotMatch(render(newRun, 0), /early value|later value|확인된 완료/);
});

test('initial snapshot does not show evidence belonging to the first executed clock', () => {
  assert.equal(renderToStaticMarkup(createElement(exports.TutorCycleEvidence, {bundle, historyIndex: -1})), '');
  const html = renderToStaticMarkup(createElement(exports.TutorCycleEvidence, {bundle, historyIndex: 0}));
  assert.match(html, /Step 1 · 실행 클록 0/);
  assert.match(html, /x10: 0 → 5/);
  assert.match(html, /완료 PC 65536/);
  assert.equal(bundle.execution_steps[0].retired_pc, '0x10000');
  assert.equal(bundle.execution_steps[0].register_changes[0].after, '0x5');
});

test('missing operand metadata is shown as unavailable rather than no register access', () => {
  const item = {pc: '0x10000', text: 'nop', explanation: {
    kind: 'asm', category: 'test', title: 'test', summary: 'test', detail: 'test',
  }};
  const html = renderToStaticMarkup(createElement(exports.TutorInstructionEvidence, {item}));
  assert.match(html, /입력값을 읽는 레지스터: 미제공/);
  assert.match(html, /결과를 넣는 레지스터: 미제공/);
});

test('cycle events follow history index even when original clocks repeat', () => {
  const withEvents = {...bundle, cycle_explanations: [
    {history_index: 0, cycle: 0, events: [{type: 'branch', title: '현재 분기', detail: '이 클록에서 분기했습니다.'}]},
    {history_index: 1, cycle: 0, events: [{type: 'stall', title: '다른 클록', detail: '다음 클록의 스톨'}]},
  ]};
  const html = renderToStaticMarkup(createElement(exports.TutorCycleEvidence, {bundle: withEvents, historyIndex: 0}));
  assert.match(html, /현재 분기/);
  assert.doesNotMatch(html, /다른 클록/);
});

test('instruction values belong to that PC and stop at the selected history index', () => {
  const item = {pc: '0x10000', text: 'add a0,a1,a2', explanation: {}};
  const bundle = {execution_steps: [
    {history_index: 0, display_clock: 1, instruction_observations: [{pc: '0x00010000', stage: 'EX', summary: '3 + 5 = 8'}]},
    {history_index: 1, display_clock: 2, instruction_observations: [{pc: '0x10004', stage: 'EX', summary: 'different PC'}]},
    {history_index: 2, display_clock: 3, instruction_observations: [{pc: '0x10000', stage: 'EX', summary: 'future iteration'}]},
  ]};
  const html = renderToStaticMarkup(createElement(exports.TutorInstructionEvidence, {item, bundle, historyIndex: 1}));
  assert.match(html.replace(/<[^>]*>/g, ''), /3 \+ 5 = 8/);
  assert.doesNotMatch(html, /future iteration|different PC/);
  const initial = renderToStaticMarkup(createElement(exports.TutorInstructionEvidence, {item, bundle, historyIndex: -1}));
  assert.doesNotMatch(initial, /3 \+ 5 = 8/);
});

test('encoding remains available without completion audit notices', () => {
  const item = {pc: '0x10000', text: 'nop', raw_instruction: '0x00000013', mapping_basis: 'elf_dwarf',
    retire_count: 2, explanation: {}};
  const bundle = {execution_steps: [
    {history_index: 0, retired_pc: '0x00010000'},
    {history_index: 1, retired_pc: '0x10004'},
    {history_index: 2, retired_pc: '0x10000'},
  ]};
  const html = renderToStaticMarkup(createElement(exports.TutorInstructionEvidence, {item, bundle, historyIndex: 1}));
  assert.doesNotMatch(html, /전체 실행 완료|확인된 완료|실행 이력에 관찰/);
  assert.match(html, /기계어 · 10진수/);
  assert.match(html, /19/);
  assert.doesNotMatch(html, /0x00000013/);
  assert.match(html, /컴파일할 때 함께 저장된 C 코드의 줄 위치/);
  assert.doesNotMatch(html, /CORE|DWARF|ELF 디버그/);
});

test('inline code highlighting escapes source content and preserves unknown register text', () => {
  const html = renderToStaticMarkup(createElement(exports.TutorText, {text: 'a5, 0x10000, x32 <script>alert(1)</script>'}));
  assert.match(html, /<code[^>]*>a5<\/code>/);
  assert.match(html, /<code[^>]*>65536<\/code>/);
  assert.doesNotMatch(html, /0x10000/);
  assert.doesNotMatch(html, /<code[^>]*>x32<\/code>|<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('completed instructions without value fields do not prompt endless stepping', () => {
  const item = {pc: '0x10000', text: 'ecall', retire_count: 1, explanation: {}};
  const bundle = {execution_steps: [{history_index: 0, cycle: 0, display_clock: 1, retired_pc: '0x10000'}]};
  const html = renderToStaticMarkup(createElement(exports.TutorInstructionEvidence, {item, bundle, historyIndex: 0, focused: true}));
  assert.doesNotMatch(html, /명령어 완료는 확인|기록이 없습니다|제공되지 않았습니다/);
  assert.doesNotMatch(html, /다음 스텝|스텝을 진행/);
});
