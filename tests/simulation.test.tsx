import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SimulationMode, SimulationResult, CycleHistoryItem } from '@/type/simulation';
import { findAssemblyRow, getActivity, getCodeMap, getCycleData, getPerformanceStats } from '@/pages/Main/simulationView';
import { useSimulationSession } from '@/pages/Main/hooks/useSimulationSession';
import { runSimulation } from '@/api/simulation';
import ControlPanel from '@/pages/Main/components/ControlPanel';
import MultiCycleDiagram from '@/pages/Main/components/MultiCycleDiagram';
import MemorySegmentVisualizer from '@/pages/Main/components/MemorySegmentVisualizer';

vi.mock('@/api/simulation', () => ({ runSimulation: vi.fn() }));

const initial = {
  current_pc: '0x00020000', registers: { x0: '0x00000000', x10: '0x00000000' },
  memory_snapshot: { '0x00030000': '0x00000000' }, console_output: '',
  metrics: { accumulated_instructions: 0, accumulated_stalls: 0, accumulated_forwards: 0 },
};
const instruction = { pc: '0x00020000', assembly: 'addi a0, a0, 1', raw_instruction: '0x00150513', status: 'normal' };
const empty = { IF: null, ID: null, EX: null, MEM: null, WB: null };
const events = {
  stall: { has_stall: false }, forwarding: { has_forwarded: false },
  control_hazard: { has_flush: false }, runtime_error: { has_error: false },
} as CycleHistoryItem['cycle_events'];

function result(mode: SimulationMode = 'single'): SimulationResult {
  return {
    schema_version: '1.0', simulator: { mode, max_cycles: 2000, pipeline_model: mode === 'single' ? 'single-cycle' : '5-stage-in-order' },
    initial_state: initial, status: 'halted', console_output: '',
    program: { entry_point: '0x00020000', instruction_words: 1, data_words: 1, instructions: [instruction], memory_regions: [
      { name: '.data', kind: 'data', start: '0x00030000', end_exclusive: '0x00030004' },
    ] },
    summary: { total_cycles: 2, instructions_executed: 2, data_hazards: 0, control_hazards: 0, stalls: 0, forwards: 0, executed_cycles: 2 },
    history: [1, 2].map((clock) => ({ clock, buffers: empty, stage_activity: { IF: instruction, ID: instruction, EX: instruction, MEM: instruction, WB: instruction },
      cycle_events: events, global_result: { ...initial, registers: { ...initial.registers, x10: `0x0000000${clock}` },
        metrics: { ...initial.metrics, accumulated_instructions: clock } } })),
  };
}

describe('execution values', () => {
  it('shows the initial state at 0, every dynamic execution, and the last state', () => {
    const data = result();
    expect(getCycleData(data, 0)?.global_result).toEqual(initial);
    expect(getCycleData(data, 0)?.buffers).toEqual(empty);
    expect(getCycleData(data, 1)?.global_result.registers.x10).toBe('0x00000001');
    expect(getCycleData(data, 2)?.global_result.registers.x10).toBe('0x00000002');
    expect(getPerformanceStats(data, 2)).toMatchObject({ completedInstructions: 2, totalCycles: 2, cpi: '1.00', ipc: '1.00' });
    expect(getPerformanceStats(data, 0).cpi).toBe('—');
  });

  it('uses engine retirement and forwarding totals, including repeated PCs and multiple operands', () => {
    const data = result('pipeline');
    data.history[1].global_result.metrics = { accumulated_instructions: 2, accumulated_stalls: 1, accumulated_forwards: 3 };
    expect(getPerformanceStats(data, 2)).toMatchObject({ completedInstructions: 2, stalls: 1, forwards: 3 });
    expect(getActivity(data.history[0]).WB).toEqual(instruction);
  });

  it('keeps cycle-limit diagnostics that occur after the final recorded clock', () => {
    const data = result();
    data.status = 'error';
    data.console_output = 'Execution clock limit exceeded';
    expect(getCycleData(data, 1)?.global_result.console_output).toBe('');
    expect(getCycleData(data, 2)?.global_result.console_output).toBe(data.console_output);
  });

  it('uses actual loaded instructions instead of invented main addresses or zero machine words', () => {
    const data = result();
    expect(getCodeMap(data)).toEqual({ '0x00020000': { raw: '0x00150513', asm: instruction.assembly } });
    const html = renderToStaticMarkup(<MemorySegmentVisualizer currentData={getCycleData(data, 0)} prevData={null} simulationData={data} />);
    expect(html).toContain('131,072');
    expect(html).not.toContain('65,560');
    expect(html).not.toContain('접근 금지');
    expect(html).toContain('Data'); // Zero in an ELF data section is still data, not BSS.
  });

  it('does not assign ambiguous or unmatched source rows to a running instruction', () => {
    expect(findAssemblyRow([{ text: instruction.assembly }], instruction)).toBe(0);
    expect(findAssemblyRow([{ text: instruction.assembly }, { text: instruction.assembly }], instruction)).toBeNull();
    expect(findAssemblyRow([{ text: 'ret' }], instruction)).toBeNull();
    expect(findAssemblyRow([{ text: instruction.assembly }], instruction, [instruction, { ...instruction, pc: '0x00020004' }])).toBeNull();
  });

  it('represents single-cycle repetitions as separate executions instead of a fake pipeline', () => {
    const data = result();
    const html = renderToStaticMarkup(<MultiCycleDiagram simulationData={data} currentCycleData={data.history[1]} currentCycle={1} />);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('[title^="0x00020000:"]')).toHaveLength(2);
    expect(html).toContain('1CLK');
  });

  it('allows pipeline playback to reach the actual final clock', () => {
    const noop = () => {};
    const html = renderToStaticMarkup(<ControlPanel currentCycle={2} totalCycles={2} isPlaying={false} playSpeed={1000}
      onStepBack={noop} onStepForward={noop} onTogglePlay={noop} onReset={noop} onJumpToCycle={noop} onChangeSpeed={noop} mode="pipeline" />);
    expect(html).toContain('max="2"');
    expect(html).toContain('/ 2');
  });
});

const containers: { root: ReturnType<typeof createRoot>; element: HTMLDivElement }[] = [];
afterEach(async () => {
  for (const { root, element } of containers.splice(0)) { await act(async () => root.unmount()); element.remove(); }
  vi.clearAllMocks();
});

it('requests the selected engine and ignores stale results after mode changes or source edits', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const requests: ((data: SimulationResult) => void)[] = [];
  vi.mocked(runSimulation).mockImplementation(() => new Promise((resolve) => requests.push(resolve)));
  let session!: ReturnType<typeof useSimulationSession>;
  function Harness({ mode, source }: { mode: SimulationMode; source: string }) {
    const value = useSimulationSession(mode, source);
    React.useEffect(() => { session = value; }, [value]);
    return null;
  }
  const element = document.createElement('div'); document.body.append(element);
  const root = createRoot(element); containers.push({ root, element });
  const render = async (node: ReactNode) => { await act(async () => root.render(node)); };
  await render(<Harness mode="single" source="original" />);
  await act(async () => session.load({ simulation_token: 'test-token' }));
  expect(runSimulation).toHaveBeenLastCalledWith({ simulation_token: 'test-token', mode: 'single', max_cycles: 2000 }, expect.any(AbortSignal));
  await render(<Harness mode="pipeline" source="original" />);
  expect(runSimulation).toHaveBeenLastCalledWith({ simulation_token: 'test-token', mode: 'pipeline', max_cycles: 2000 }, expect.any(AbortSignal));
  expect(vi.mocked(runSimulation).mock.calls[0][1]?.aborted).toBe(true);
  await act(async () => requests[0](result('single')));
  expect(session.data).toBeNull();
  await act(async () => requests[1](result('pipeline')));
  expect(session.data?.simulator.mode).toBe('pipeline');
  await render(<Harness mode="single" source="original" />);
  await render(<Harness mode="single" source="edited" />);
  await act(async () => requests[2](result('single')));
  expect(session.data).toBeNull();
  expect(session.busy).toBe(false);
});
