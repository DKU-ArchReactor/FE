import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

function component(file, name) {
  const source = readFileSync(new URL(`../src/pages/Main/components/${file}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}});
  const exports = {};
  vm.runInNewContext(compiled.outputText, {exports, require: createRequire(import.meta.url)});
  return exports[name];
}
const Summary = component('TutorPerformanceSummary.tsx', 'default');
const Details = component('TutorPerformanceSummary.tsx', 'TutorPerformanceDetails');
const Hazards = component('HazardDiagnostics.tsx', 'HazardDiagnostics');
const snapshot = {history_index: 0, cycles: 2, completed: 1, cpi: 2, stall_cycles: 1, flush_cycles: 1, forwarding_cycles: 0,
  overlap_cycles: 1, hazard_cycles: 1, idle_cycles: 1, hazard_idle_cycles: 1, other_idle_cycles: 0, unknown_completion_cycles: 0, extra_cycles: 1};
const record = {history_index: 0, cycle: 0, kind: 'stall', instruction: {pc: '0x10000', assembly: 'add a0,a1,a2', source_line: 4}, detail: 'known load dependency'};

test('performance summary uses the selected prefix and never reveals a future hotspot', () => {
  const bundle = {performance_analysis: {snapshots: [snapshot], records: [record, {...record, history_index: 2, instruction: {pc: '0x10008', assembly: 'future-only-instruction'}, detail: 'future-only-reason'}], notes: []}};
  const html = renderToStaticMarkup(createElement(Details, {analysis: bundle.performance_analysis, snapshot, historyIndex: 0}));
  assert.match(html, /2 ÷ 1 = 2.00/);
  assert.match(html, /known load dependency/);
  assert.doesNotMatch(html, /future-only/);
  assert.equal(renderToStaticMarkup(createElement(Summary, {bundle, historyIndex: -1})), '');
});

test('a collapsed performance summary does not read hazard records or render detail content', () => {
  const analysis = {snapshots: [snapshot], get records() {assert.fail('closed summaries must not aggregate hazards');}, notes: []};
  const html = renderToStaticMarkup(createElement(Summary, {bundle: {performance_analysis: analysis}, historyIndex: 0}));
  assert.match(html, /CPI와 해저드 분석/);
  assert.doesNotMatch(html, /완료 명령어|스톨 관찰/);
});

test('older tutor payloads remain usable without performance analysis', () => {
  assert.equal(renderToStaticMarkup(createElement(Summary, {bundle: {}, historyIndex: 0})), '');
});

test('generic stalls and flushes do not claim load-use, one-cycle bubbles, or prediction failure', () => {
  const current = {buffers: {}, cycle_events: {stall: {has_stall: true, stall_reason: 'structural'}, forwarding: {}, control_hazard: {has_flush: true}}};
  const data = {simulator: {mode: 'pipeline'}, history: [current]};
  const html = renderToStaticMarkup(createElement(Hazards, {simulationData: data, currentCycleData: current, currentCycle: 0}));
  assert.match(html, /명령어 진행 대기/);
  assert.doesNotMatch(html, /Load-Use|1사이클|예측이 실패/);
});

test('current hazard diagnostics consume TUTOR instruction evidence for this history frame', () => {
  const current = {buffers: {}, cycle_events: {stall: {has_stall: true}, forwarding: {}, control_hazard: {}}};
  const data = {simulator: {mode: 'pipeline'}, history: [current], tutor: {cycle_explanations: [
    {history_index: 0, events: [{type: 'stall', title: '확인된 스톨', detail: 'PC 0x10000 producer x5 → consumer'}]},
    {history_index: 1, events: [{type: 'stall', title: 'future-only-title', detail: 'future-only-reason'}]},
  ]}};
  const html = renderToStaticMarkup(createElement(Hazards, {simulationData: data, currentCycleData: current, currentCycle: 0}));
  assert.match(html, /producer x5/);
  assert.doesNotMatch(html, /future-only/);
});
