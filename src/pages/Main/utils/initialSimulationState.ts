import type { GlobalResult, SimulationResult } from '@/type/simulation';

/** Builds the pre-execution snapshot from the compiler/core response. */
export function initialSimulationState(simulation: SimulationResult): GlobalResult {
  const initial = simulation.initial_state;
  const registers: Record<string, string> = Object.fromEntries(
    Array.from({ length: 32 }, (_, index) => [`x${index}`, '0x00000000'])
  );

  registers.x2 =
    initial?.registers?.x2 ??
    initial?.active_stack_pointer ??
    simulation.program.initial_stack_pointer ??
    '0x7fffeffc';
  Object.assign(registers, initial?.registers);
  registers.x0 = '0x00000000';

  return {
    current_pc: initial?.current_pc ?? simulation.program.entry_point ?? '0x00010000',
    registers,
    memory_snapshot: { ...initial?.memory_snapshot },
    console_output: initial?.console_output ?? '',
    active_stack_pointer: registers.x2,
    metrics: {
      accumulated_instructions: initial?.metrics?.accumulated_instructions ?? 0,
      accumulated_stalls: initial?.metrics?.accumulated_stalls ?? 0,
      accumulated_forwards: initial?.metrics?.accumulated_forwards ?? 0,
    },
  };
}
