import type { CycleHistoryItem } from '@/type/simulation';
import type { DebugInfo } from './debug';
import { hex, inspectMemory, memoryAt, snapshotForCycle } from './runtime';
import type { MemoryValue } from './runtime';
export type MemoryChange = { name: string; address: number; before: string; after: string; pointer: boolean; targetType?: number };
export type MemoryStep = { index: number; changes: MemoryChange[] };
export function leaves(values: MemoryValue[], prefix = ''): MemoryValue[] {
  return values.flatMap(value => {
    const name = prefix && !value.name.startsWith(`${prefix}[`) ? `${prefix}.${value.name}` : value.name;
    return value.children.length ? leaves(value.children, name) : [{ ...value, name }];
  });
}
export function memoryTimeline(info: DebugInfo, history: CycleHistoryItem[]): MemoryStep[] {
  if (!history.length) return [];
  const result: MemoryStep[] = [{ index: 0, changes: [] }];
  for (let index = 1; index < history.length; index++) {
    const current = history[index].global_result.memory_snapshot, previous = history[index - 1].global_result.memory_snapshot;
    const oldWords = new Map(Object.entries(previous).map(([key, value]) => [Number(key), Number(value)]));
    const changed = new Set(Object.entries(current).filter(([key, value]) => oldWords.get(Number(key)) !== Number(value)).map(([key]) => Number(key)));
    if (!changed.size) continue;
    const view = inspectMemory(info, snapshotForCycle(history[index]));
    const oldView = inspectMemory(info, snapshotForCycle(history[index - 1]));
    const values = leaves([...view.variables, ...view.nodes]);
    const oldValues = new Map(leaves([...oldView.variables, ...oldView.nodes]).map(value => [`${value.address}:${value.typeId}`, value]));
    const byAddress = new Map<number, MemoryChange>();
    for (const value of values) {
      if (value.address === undefined || value.unavailable || !value.byteSize || value.byteSize > 4) continue;
      if (memoryAt(history[index].global_result, value.address, value.byteSize) === memoryAt(history[index - 1].global_result, value.address, value.byteSize)) continue;
      const old = oldValues.get(`${value.address}:${value.typeId}`);
      if (old && old.value === value.value) continue;
      const oldRaw = memoryAt(history[index - 1].global_result, value.address, value.byteSize);
      const before = old && !old.unavailable ? old.value : value.pointer !== undefined && oldRaw !== undefined ? oldRaw === 0 ? 'NULL' : hex(oldRaw) : old?.unavailable ? '미기록' : '미확인';
      byAddress.set(value.address, { name: value.name, address: value.address, before, after: value.value, pointer: value.pointer !== undefined, targetType: value.targetType });
    }
    if (byAddress.size) result.push({ index, changes: [...byAddress.values()] });
  }
  if (result.at(-1)!.index !== history.length - 1) result.push({ index: history.length - 1, changes: [] });
  return result;
}
