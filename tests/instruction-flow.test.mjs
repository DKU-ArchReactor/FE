import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync(new URL('../src/pages/Main/utils/instructionFlow.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {exports});
const {buildInstructionFlow} = exports;
const item = (op, reads, writes) => ({pc: '0x10000', text: `${op} a0,a1,a2`, explanation: {opcode: op, reads, writes}});
const frame = (op = 'add') => ({clock: 0, buffers: {}, cycle_events: {runtime_error: {has_error: false}},
  global_result: {registers: {x10: '0x0000000C'}, metrics: {accumulated_instructions: 1}},
  datapath: {pc: '0x00010000', next_pc: '0x10004', alu: {input_1: '0x00000005', input_2: '0x00000007', result: '0x0000000C'},
    registers: {rs1: {name: 'a1', num: 11, value: '0x00000005'}, rs2: {name: 'a2', num: 12, value: '0x00000007'}, rd: {num: 10, write_data: '0x0000000C'}},
    instruction: {op}, control_signals: {reg_write: true}, data_memory: {}}});
const simulation = current => ({simulator: {mode: 'single'}, initial_state: {registers: {}, metrics: {accumulated_instructions: 0}}, history: [current]});

test('CORE clock zero is a real observed frame and num/write_data fields are read', () => {
  const current = frame();
  const flow = buildInstructionFlow(item('add', ['x11', 'x12'], ['x10']), current, null, simulation(current));
  assert.equal(flow.actual, true);
  assert.equal(flow.completed, true);
  assert.equal(flow.registerInputs[0].value, '0x00000005');
  assert.equal(flow.writeValue, '0x0000000C');
  assert.equal(flow.nextPc, '0x10004');
});

test('manual selection, reset snapshot and pipeline never borrow this frame values', () => {
  const current = frame();
  const other = {...item('add', ['x11'], ['x10']), pc: '0x10004'};
  for (const [selected, snapshot, run] of [[other, current, simulation(current)],
    [item('add', ['x11'], ['x10']), {...current}, simulation(current)],
    [item('add', ['x11'], ['x10']), current, {...simulation(current), simulator: {mode: 'pipeline'}}]]) {
    const flow = buildInstructionFlow(selected, snapshot, null, run);
    assert.equal(flow.actual, false);
    assert.equal(flow.input1, undefined);
    assert.equal(flow.writeValue, undefined);
    assert.equal(flow.registerInputs[0].value, undefined);
  }
});

test('byte store shows only written low bits and has no register writeback', () => {
  const current = frame('sb');
  current.datapath.data_memory = {address: '0x2000', write_data: '0xFFFFFFFE'};
  const flow = buildInstructionFlow(item('sb', ['x11', 'x12'], []), current, null, simulation(current));
  assert.equal(flow.width, 8);
  assert.equal(flow.memoryValue, '0xfe');
  assert.equal(flow.writeValue, undefined);
  assert.ok(flow.steps.find(step => step.id === 'memory').routes.includes('store'));
  assert.ok(!flow.steps.at(-1).routes.includes('writeback'));
});

test('load to x0 still accesses memory and never records its read value in x0', () => {
  const current = frame('lw');
  current.datapath.data_memory = {address: '0x2000', read_data: '0xFFFFFFFE'};
  const flow = buildInstructionFlow(item('lw', ['x11'], []), current, null, simulation(current));
  assert.equal(flow.memoryValue, '0xFFFFFFFE');
  assert.equal(flow.writeValue, undefined);
  assert.ok(!flow.steps.at(-1).routes.includes('load'));
});

test('faults cannot turn decoded reg_write into a committed register value', () => {
  const current = frame('lw');
  current.cycle_events.runtime_error = {has_error: true, message: 'unaligned'};
  current.datapath.data_memory = {address: '0x2001', read_data: '0x00000000'};
  const flow = buildInstructionFlow(item('lw', ['x11'], ['x10']), current, null, simulation(current));
  assert.equal(flow.completed, false);
  assert.equal(flow.writeValue, undefined);
  assert.equal(flow.memoryValue, undefined);
  assert.ok(!flow.steps.at(-1).routes.includes('load'));
});

test('SRAI masks the encoded input, ECALL skips ALU and JAL separates link data', () => {
  const current = frame('srai');
  current.datapath.alu.input_2 = '0x00000402';
  const flow = buildInstructionFlow(item('srai', ['x11'], ['x10']), current, null, simulation(current));
  assert.equal(flow.amount, 2);
  const system = buildInstructionFlow(item('ecall', [], []), current, null, simulation(current));
  assert.ok(system.steps.every(step => step.id !== 'execute'));
  const jump = buildInstructionFlow(item('jal', [], ['x1']), current, null, simulation(current));
  assert.ok(jump.steps.at(-1).routes.includes('link'));
  assert.ok(!jump.steps.at(-1).routes.includes('writeback'));
});

test('branch keeps comparison inputs separate from its PC offset and has no register result', () => {
  const current = frame('bne');
  current.datapath.immediate = {dec: -8, value: '0xFFFFFFF8'};
  current.cycle_events.control_hazard = {taken: true};
  const flow = buildInstructionFlow(item('bne', ['x11', 'x12'], []), current, null, simulation(current));
  assert.equal(flow.immediate, -8);
  assert.equal(flow.taken, true);
  assert.equal(flow.branch, true);
  assert.equal(flow.usesImmediate, false); // ALU compares registers; offset is a separate PC input.
  assert.equal(flow.writeValue, undefined);
  assert.ok(!flow.steps.at(-1).routes.includes('writeback'));
});
