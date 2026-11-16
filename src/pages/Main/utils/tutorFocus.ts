import type {CycleHistoryItem} from '@/type/simulation';
import type {MappedAssemblyRow} from './translationCompile';

const pcNumber = (pc?: string) => pc && /^0x[\da-f]+$/i.test(pc.trim()) ? Number.parseInt(pc, 16) : NaN;

// A pipeline has several active instructions. Prefer EX for the teaching focus;
// when it is empty, follow a remaining valid stage without treating a bubble as work.
export function tutorExecutionFocus(cycle: CycleHistoryItem | null, rows: MappedAssemblyRow[], single: boolean) {
  if (!cycle) return null;
  const stages = single ? ['IF'] as const : ['EX', 'MEM', 'WB', 'ID', 'IF'] as const;
  for (const stage of stages) {
    const buffer = cycle.stage_activity?.[stage] ?? cycle.buffers?.[stage];
    if (!buffer || /^(empty|bubble|flush|flushed)$/i.test(buffer.status) || buffer.flush_info?.is_flushed) continue;
    const index = rows.findIndex(row => pcNumber(row.pc) === pcNumber(buffer.pc));
    if (index >= 0) return {index, stage};
  }
  return null;
}
