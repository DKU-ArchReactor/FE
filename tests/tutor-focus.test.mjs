import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/pages/Main/utils/tutorFocus.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}});
const exports = {};
vm.runInNewContext(compiled.outputText, {exports, require: createRequire(import.meta.url)});
const rows = [{pc: '0x10000', text: 'add a0,a0,a1'}, {pc: '0x10004', text: 'add a0,a0,a1'}];
const slot = (pc, status = 'normal') => ({pc, status, assembly: 'add a0,a0,a1'});

test('single follows the executed IF PC even when instruction text repeats', () => {
  assert.equal(exports.tutorExecutionFocus({buffers: {IF: slot('0x00010004')}}, rows, true).index, 1);
});
test('pipeline follows EX before a different retiring instruction in WB', () => {
  const focus = exports.tutorExecutionFocus({buffers: {EX: slot('0x10004'), WB: slot('0x10000')}}, rows, false);
  assert.equal(focus.index, 1);
  assert.equal(focus.stage, 'EX');
});
test('pipeline skips bubbles and flushed stages, and follows remaining MEM work', () => {
  const focus = exports.tutorExecutionFocus({buffers: {EX: slot('0x10004', 'bubble'), MEM: slot('0x10000')}}, rows, false);
  assert.equal(focus.stage, 'MEM');
  assert.equal(exports.tutorExecutionFocus({buffers: {EX: {...slot('0x10004'), flush_info: {is_flushed: true}}}}, rows, false), null);
});
test('an absent or unknown PC does not guess using matching instruction text', () => {
  assert.equal(exports.tutorExecutionFocus({buffers: {EX: slot('0x99999')}}, rows, false), null);
  assert.equal(exports.tutorExecutionFocus(null, rows, true), null);
});
