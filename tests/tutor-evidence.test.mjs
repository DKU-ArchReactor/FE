import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const source = readFileSync(new URL('../src/pages/Main/components/TutorEvidence.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}});
const exports = {};
vm.runInNewContext(compiled.outputText, {exports, require: createRequire(import.meta.url)});
const bundle = {execution_steps: [{history_index: 0, cycle: 0, display_clock: 1,
  retired_pc: '0x10000', register_changes: [{key: 'x10', before: '0x0', after: '0x5'}],
  memory_changes: [], memory_transfer: null}]};

test('initial snapshot does not show evidence belonging to the first executed clock', () => {
  assert.equal(renderToStaticMarkup(createElement(exports.TutorCycleEvidence, {bundle, historyIndex: -1})), '');
  const html = renderToStaticMarkup(createElement(exports.TutorCycleEvidence, {bundle, historyIndex: 0}));
  assert.match(html, /Clock 1/);
  assert.match(html, /x10: 0x0 → 0x5/);
});
