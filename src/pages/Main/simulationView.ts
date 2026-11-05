import type { CycleHistoryItem, SimulationResult, StageBuffer } from '@/type/simulation';

export const getActivity = (item: CycleHistoryItem) => item.stage_activity ?? item.buffers;

// The playback position is the number of completed clocks, including an initial position 0.
export function getCycleData(result: SimulationResult | null, position: number): CycleHistoryItem | null {
  if (!result) return null;
  if (position > 0) {
    const completedClocks = Math.min(position, result.history.length);
    const item = result.history[completedClocks - 1];
    if (!item) return null;
    // CORE clocks are zero-based; playback reserves 0 for the pre-execution state.
    return {
      ...item, clock: completedClocks,
      global_result: position >= result.history.length
        ? { ...item.global_result, console_output: result.console_output }
        : item.global_result,
    };
  }
  const events = result.history[0]?.cycle_events;
  if (!events) return null;
  return {
    clock: 0,
    buffers: { IF: null, ID: null, EX: null, MEM: null, WB: null },
    cycle_events: {
      stall: { ...events.stall, has_stall: false },
      forwarding: { ...events.forwarding, has_forwarded: false },
      control_hazard: { ...events.control_hazard, has_control_instruction: false, has_flush: false },
      runtime_error: { ...events.runtime_error, has_error: false },
    },
    global_result: result.initial_state,
  };
}

export function getCodeMap(result: SimulationResult | null) {
  return Object.fromEntries((result?.program.instructions ?? []).map((inst) => [
    inst.pc.toLowerCase(), { raw: inst.raw_instruction, asm: inst.assembly },
  ]));
}

export function getPerformanceStats(result: SimulationResult | null, position: number) {
  const count = Math.max(0, Math.min(position, result?.history.length ?? 0));
  const metrics = getCycleData(result, count)?.global_result.metrics;
  const completed = metrics?.accumulated_instructions ?? 0;
  let emptySlots = 0;
  for (const item of result?.history.slice(0, count) ?? []) {
    emptySlots += Object.values(getActivity(item)).filter((stage) => !isActiveStage(stage)).length;
  }
  return {
    completedInstructions: completed, totalCycles: count,
    cpi: completed > 0 ? (count / completed).toFixed(2) : '—',
    ipc: count > 0 ? (completed / count).toFixed(2) : '—',
    stalls: metrics?.accumulated_stalls ?? 0,
    forwards: metrics?.accumulated_forwards ?? 0,
    bubbleRatio: count > 0 ? Math.round(emptySlots / (count * 5) * 100) : 0,
  };
}

export function isActiveStage(stage: StageBuffer | null | undefined): stage is StageBuffer {
  return Boolean(stage?.pc && stage.status !== 'empty' && stage.status !== 'bubble' && stage.status !== 'flushed' && !stage.flush_info?.is_flushed);
}

// GCC source assembly is not a PC map. Never choose an arbitrary duplicate or an ordinal row.
export function findAssemblyRow(rows: { text: string }[], instruction: StageBuffer | null | undefined, program?: SimulationResult['program']['instructions']): number | null {
  if (!isActiveStage(instruction)) return null;
  const normalize = (text: string) => text.replace(/\s+/g, '').toLowerCase();
  if (program) {
    const candidates = program.filter((item) => normalize(item.assembly) === normalize(instruction.assembly));
    if (candidates.length !== 1 || candidates[0].pc.toLowerCase() !== instruction.pc?.toLowerCase()) return null;
  }
  const matches = rows.flatMap((row, index) => normalize(row.text) === normalize(instruction.assembly) ? [index] : []);
  return matches.length === 1 ? matches[0] : null;
}
