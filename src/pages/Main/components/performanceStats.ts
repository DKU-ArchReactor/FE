import type { SimulationResult } from '@/type/simulation';

// Use the same selected-frame counters as the assistant context projection.
// WB buffer contents are not retirement events, and repeated PCs must count again.
export function performanceStats(simulationData: SimulationResult | null, currentCycle: number) {
  const history = simulationData?.history ?? [];
  const single = simulationData?.simulator?.mode === 'single' ||
    simulationData?.simulator?.pipeline_model === 'single-cycle';
  const index = Math.min(Math.max(0, Math.floor(currentCycle) - (single ? 1 : 0)), history.length - 1);
  const beforeExecution = !history.length || (single && currentCycle === 0);
  const frame = beforeExecution ? undefined : history[index];
  const cycles = beforeExecution ? 0 : index + 1;
  const metrics = frame?.global_result?.metrics;
  const counter = (value: number | undefined) =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
  const completed = beforeExecution ? 0 : counter(metrics?.accumulated_instructions);
  const stalls = beforeExecution ? 0 : counter(metrics?.accumulated_stalls);
  const forwards = beforeExecution ? 0 : counter(metrics?.accumulated_forwards);
  let bubbles = 0;
  if (!single && !beforeExecution) {
    for (const item of history.slice(0, index + 1)) {
      for (const stage of ['IF', 'ID', 'EX', 'MEM', 'WB'] as const) {
        const buffer = item.buffers[stage];
        if (!buffer || buffer.status === 'bubble' || buffer.assembly === 'bubble') bubbles++;
      }
    }
  }
  return {
    completedInstructions: completed,
    totalCycles: cycles,
    cpi: completed !== null && completed > 0 ? (cycles / completed).toFixed(2) : '—',
    ipc: completed !== null && cycles > 0 ? (completed / cycles).toFixed(2) : '—',
    stalls, forwards,
    bubbleRatio: cycles && !single ? Math.round(bubbles / (cycles * 5) * 100) : 0,
  };
}

