import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync(new URL('../src/pages/Main/components/performanceStats.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}});
const exports = {};
vm.runInNewContext(compiled.outputText, {exports, require: createRequire(import.meta.url)});
const stats = exports.performanceStats;
const frame = (instructions, forwards = 0, stalls = 0) => ({buffers: {WB: {pc: '0x100', assembly: 'addi a0, a0, 1', status: 'normal'}}, global_result: {metrics: {accumulated_instructions: instructions, accumulated_forwards: forwards, accumulated_stalls: stalls}}, cycle_events: {forwarding: {has_forwarded: true}}});
test('repeated PCs and WB appearances do not replace server retirement counters', () => {
  const run = {simulator: {mode: 'pipeline'}, history: [frame(0), frame(1, 2), frame(2, 4, 1)]};
  const value = stats(run, 2);
  assert.equal(value.completedInstructions, 2);
  assert.equal(value.cpi, '1.50');
  assert.equal(value.forwards, 4); // two paths can occur in one cycle
  assert.equal(value.stalls, 1);
  assert.equal(stats(run, 1).completedInstructions, 1); // no future totals
});
test('zero retirement is undefined CPI, not an invented 1.00', () => {
  const value = stats({history: [frame(0)]}, 0);
  assert.equal(value.cpi, '—');
  assert.equal(value.ipc, '0.00');
});
test('single step zero is before execution and step one selects history zero', () => {
  const run = {simulator: {mode: 'single'}, history: [frame(1), frame(2)]};
  assert.equal(stats(run, 0).totalCycles, 0);
  assert.equal(stats(run, 0).cpi, '—');
  assert.equal(stats(run, 1).completedInstructions, 1);
  assert.equal(stats(run, 1).cpi, '1.00');
  assert.equal(stats(run, 99).totalCycles, 2);
});
test('missing counters stay unknown; absent runs do not report activity', () => {
  assert.equal(stats({history: [{buffers: {}}]}, 0).completedInstructions, null);
  assert.equal(stats({history: [{buffers: {}}]}, 0).cpi, '—');
  assert.equal(stats(null, 0).totalCycles, 0);
});
