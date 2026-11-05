import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertSimulationResult, getPlaybackFrame, getCodeMap, getMemoryRegion, getDisassemblyPc } from '../src/pages/Main/components/simulationView.ts';

function sample() {
  const initial = { current_pc: '0x00000000', registers: { x0: '0x00000000', x5: '0x00000000' }, memory_snapshot: {}, console_output: '', metrics: { accumulated_instructions: 0, accumulated_stalls: 0, accumulated_forwards: 0 } };
  const stage = { pc: '0x00000000', raw_instruction: '0x00128293', assembly: 'addi t0, t0, 1', status: 'normal' };
  const buffers = { IF: null, ID: null, EX: null, MEM: null, WB: null };
  const history = [0, 1, 2].map(index => ({ clock: index, buffers,
    stage_activity: { IF: stage, ID: stage, EX: stage, MEM: stage, WB: stage },
    cycle_events: {}, global_result: { ...initial, registers: { ...initial.registers, x5: `0x0000000${index + 1}` }, metrics: { ...initial.metrics, accumulated_instructions: index + 1 } } }));
  return { schema_version: '1.0', simulator: { mode: 'single', pipeline_model: 'single-cycle', max_cycles: 2000 },
    program: { instruction_words: 1, instructions: [stage], memory_regions: [{ name: '.data', kind: 'data', start: '0x100', end_exclusive: '0x108' }, { name: '.bss', kind: 'bss', start: '0x108', end_exclusive: '0x110' }] },
    initial_state: initial, status: 'halted', summary: { total_cycles: 3, executed_cycles: 3, instructions_executed: 3, stalls: 0, forwards: 0 }, history };
}

test('one static instruction executed three times has three distinct completed states', () => {
  const result = sample();
  assertSimulationResult(result, 'single');
  assert.equal(getPlaybackFrame(result, 0).global_result.registers.x5, '0x00000000');
  for (let step = 1; step <= 3; step++) assert.equal(getPlaybackFrame(result, step).global_result.registers.x5, `0x0000000${step}`);
  assert.equal(getPlaybackFrame(result, 4), null);
});

test('missing initial metadata never substitutes the first completed instruction', () => {
  const result = sample();
  delete result.initial_state;
  assert.equal(getPlaybackFrame(result, 0), null);
});

test('pipeline buffers do not determine current-clock retirement', () => {
  const result = sample();
  result.simulator = { mode: 'pipeline', pipeline_model: '5-stage-in-order' };
  result.history[0].buffers = { WB: { assembly: 'next instruction', status: 'normal' } };
  assertSimulationResult(result, 'pipeline');
  assert.equal(getPlaybackFrame(result, 1).stage_activity.WB.assembly, 'addi t0, t0, 1');
});

test('legacy single mode is rejected rather than compressed into fake single clocks', () => {
  const result = sample();
  result.simulator.pipeline_model = '5-stage-in-order';
  assert.throws(() => assertSimulationResult(result, 'single'), /이전 방식/);
});

test('wrong mode and invalid cycle counts are rejected', () => {
  assert.throws(() => assertSimulationResult(sample(), 'pipeline'), /모드/);
  const result = sample();
  result.summary.total_cycles = 99;
  assert.throws(() => assertSimulationResult(result, 'single'), /클록 수/);
});

test('code addresses and raw machine words come from CORE, not compiler source line counts', () => {
  const result = sample();
  const map = getCodeMap(result);
  assert.deepEqual(Object.keys(map), ['0x00000000']);
  assert.equal(map['0x00000000'].raw, '0x00128293');
});

test('region membership is address-based and half-open, never value-based', () => {
  const result = sample();
  assert.equal(getMemoryRegion('0x100', result), '.data');
  assert.equal(getMemoryRegion('0x107', result), '.data');
  assert.equal(getMemoryRegion('0x108', result), '.bss');
  assert.equal(getMemoryRegion('0x110', result), '영역 미확인');
  assert.equal(getMemoryRegion('0x0', result), '영역 미확인');
});

test('runtime faults may consume a single clock without retiring an instruction', () => {
  const result = sample();
  result.status = 'error';
  result.summary.instructions_executed = 2;
  result.history.at(-1).global_result.metrics.accumulated_instructions = 2;
  assertSimulationResult(result, 'single');
});

test('summary counters cannot contradict the final architectural snapshot', () => {
  const result = sample();
  result.summary.instructions_executed = 2;
  assert.throws(() => assertSimulationResult(result, 'single'), /누적 통계/);
});

test('an immediate address in compiler assembly is not an instruction PC', () => {
  assert.equal(getDisassemblyPc('addi t0, zero, 0x10000'), undefined);
  assert.equal(getDisassemblyPc(' 10000: 00100293 addi t0,zero,1'), '0x00010000');
  assert.equal(getDisassemblyPc('0x00010004: addi t1,t0,1'), '0x00010004');
});

for (const mode of ['single', 'pipeline']) {
  test(`actual CORE ${mode} output satisfies the frontend contract`, { skip: !process.env.CORE_FIXTURE_DIR }, () => {
    const result = JSON.parse(fs.readFileSync(path.join(process.env.CORE_FIXTURE_DIR, mode, 'simulation_result.json'), 'utf8'));
    assertSimulationResult(result, mode);
    assert.equal(getPlaybackFrame(result, 0).global_result.metrics.accumulated_instructions, 0);
    assert.deepEqual(getPlaybackFrame(result, result.history.length).global_result, result.history.at(-1).global_result);
    assert.equal(Object.keys(getCodeMap(result)).length, result.program.instruction_words);
  });
}
