import { expect, it, vi } from 'vitest';
import apiConfig from '@/api/config';
import { compileTranslation } from '@/pages/Main/components/translationCompile';
import { runSimulation } from '@/api/simulation';
import { getCycleData, getPerformanceStats } from '@/pages/Main/simulationView';
import { compileCode } from '@/api/build';

apiConfig.defaults.baseURL = 'https://d1j3nkcez6kncs.cloudfront.net';
vi.stubGlobal('localStorage', { getItem: () => null });

it('allows local browser requests to the API and compiled assembly', async () => {
  const origin = 'http://localhost:5173';
  const preflight = await fetch(`${apiConfig.defaults.baseURL}/api/v1/simulation/run`, {
    method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
  });
  expect(preflight.ok).toBe(true);
  expect(preflight.headers.get('access-control-allow-origin')).toBe(origin);
  const compiled = await compileCode({ content: 'int main(void) { return 0; }', lang: 'c', compile_profile: 'rv32im', compiler_opt: '-O0 -g' });
  expect(compiled.assembly_url).toBeTruthy();
  const assembly = await fetch(compiled.assembly_url!, { headers: { Origin: origin } });
  expect(assembly.ok).toBe(true);
  expect([origin, '*']).toContain(assembly.headers.get('access-control-allow-origin'));
}, 60000);

it.each([
  ['return value', 'int main(void) { return 42; }', 42],
  ['loop and memory', 'volatile int values[4] = {1, 2, 3, 4}; int main(void) { int sum = 0; for (int i = 0; i < 4; i++) sum += values[i]; return sum; }', 10],
])('shows correct API values for %s in both modes', async (_name, source, expected) => {
  const { artifact, assembly } = await compileTranslation(source);
  expect(assembly.length).toBeGreaterThan(0);
  const results = [];
  for (const mode of ['single', 'pipeline'] as const) {
    const result = await runSimulation({ ...artifact, mode, max_cycles: 2000 });
    expect(result.status).toBe('halted');
    expect(getCycleData(result, 0)?.clock).toBe(0);
    const last = getCycleData(result, result.history.length)!;
    expect(Number(last.global_result.registers.x10)).toBe(expected);
    expect(getPerformanceStats(result, result.history.length)).toMatchObject({
      completedInstructions: result.summary.instructions_executed,
      totalCycles: result.summary.total_cycles,
      stalls: result.summary.stalls, forwards: result.summary.forwards,
    });
    if (mode === 'single') expect(result.summary.total_cycles).toBe(result.summary.instructions_executed);
    results.push(last.global_result);
  }
  expect(results[0].registers).toEqual(results[1].registers);
  expect(results[0].memory_snapshot).toEqual(results[1].memory_snapshot);
}, 60000);

it.each([
  ['memory fault', '.globl _start\n_start:\nli t0, 1\nlw a0, 0(t0)\n', 'error'],
  ['console output', '.globl _start\n_start:\nli a0, 42\nli a7, 1\necall\nli a7, 10\necall\n', 'halted'],
])('preserves %s in both modes', async (name, content, status) => {
  const compiled = await compileCode({ content, lang: 'asm', compile_profile: 'rv32im', compiler_opt: '' });
  expect(compiled.status).toBe('success');
  expect(compiled.simulation_token).toBeTruthy();
  for (const mode of ['single', 'pipeline'] as const) {
    const result = await runSimulation({ simulation_token: compiled.simulation_token!, mode });
    expect(result.status).toBe(status);
    const final = getCycleData(result, result.history.length)!;
    if (name === 'console output') expect(final.global_result.console_output).toBe('42');
    else expect(final.cycle_events.runtime_error.has_error).toBe(true);
  }
}, 60000);

it('preserves cycle-limit status and diagnostics at the final clock', async () => {
  const { artifact } = await compileTranslation('int main(void) { for (;;) {} }');
  for (const mode of ['single', 'pipeline'] as const) {
    const result = await runSimulation({ ...artifact, mode, max_cycles: 20 });
    expect(result.status).toBe('error');
    expect(result.history).toHaveLength(20);
    expect(getCycleData(result, 20)?.global_result.console_output).toContain('clock limit');
  }
}, 60000);
