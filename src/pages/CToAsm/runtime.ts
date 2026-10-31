import { Reader, nameOf, num, rangeOf } from './debug';
import type { DebugInfo, Die } from './debug';
import type { CycleHistoryItem, GlobalResult } from '@/type/simulation';
export type MemoryValue = { name: string; type: string; typeId?: number; byteSize?: number; address?: number; value: string; line: number; children: MemoryValue[]; pointer?: number; targetType?: number; unavailable?: string };
export type MemoryView = { variables: MemoryValue[]; nodes: MemoryValue[]; line?: number; warnings: string[] };
export const hex = (value: number) => `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
export function snapshotForCycle(cycle: CycleHistoryItem): GlobalResult {
  // In single mode the sole in-flight instruction has not written its registers
  // yet. global_result.current_pc is already the next fetch address. CFI must use
  // the in-flight PC until the pipeline drains; then use the next fetch PC.
  const active = Object.values(cycle.buffers || {}).filter(buffer => buffer?.pc && !['empty', 'bubble', 'flushed'].includes(buffer.status) && buffer.raw_instruction !== '0x00000000');
  const pcs = [...new Set(active.map(buffer => buffer!.pc!))];
  return { ...cycle.global_result, current_pc: pcs.length === 1 ? pcs[0] : pcs.length === 0 ? cycle.global_result.current_pc : '위치 미확인' };
}
function concrete(info: DebugInfo, die?: Die): Die | undefined {
  const visited = new Set<number>();
  while (die && [0x16, 0x26, 0x35, 0x37].includes(die.tag)) { if (visited.has(die.offset)) return undefined; visited.add(die.offset); die = info.dies.get(num(die, 0x49) ?? -1); }
  return die;
}
function typeName(info: DebugInfo, die?: Die, depth = 0): string {
  if (!die || depth > 8) return '?';
  if (nameOf(die)) return nameOf(die);
  if (die.tag === 0x0f) return `${typeName(info, info.dies.get(num(die, 0x49) ?? -1), depth + 1)} *`;
  if (die.tag === 1) return `${typeName(info, info.dies.get(num(die, 0x49) ?? -1), depth + 1)}[]`;
  return typeName(info, concrete(info, die), depth + 1);
}
function byteSize(info: DebugInfo, die?: Die, depth = 0): number | undefined {
  die = concrete(info, die); if (!die || depth > 8) return;
  if (num(die, 0x0b) !== undefined) return num(die, 0x0b);
  if (die.tag === 1) { const element = byteSize(info, info.dies.get(num(die, 0x49) ?? -1), depth + 1); const counts = die.children.filter(child => child.tag === 0x21).map(child => num(child, 0x37) ?? (num(child, 0x2f) !== undefined ? num(child, 0x2f)! - (num(child, 0x22) ?? 0) + 1 : undefined)); if (element !== undefined && counts.length && counts.every(count => count !== undefined)) return counts.reduce<number>((size, count) => size * count!, element); }
}
export function memoryAt(snapshot: GlobalResult, address: number, size: number): number | undefined {
  if (size < 1 || size > 4) return;
  let value = 0;
  for (let i = 0; i < size; i++) { const at = (address + i) >>> 0, key = hex(at & ~3), word = snapshot.memory_snapshot[key] ?? snapshot.memory_snapshot[key.replace(/[a-f]/g, char => char.toUpperCase())]; if (word === undefined) return; value += ((Number(word) >>> ((at & 3) * 8)) & 255) * 2 ** (i * 8); }
  return value;
}
export function inspectMemory(info: DebugInfo, snapshot: GlobalResult): MemoryView {
  const pc = Number(snapshot.current_pc), variables: MemoryValue[] = [], nodes: MemoryValue[] = [], warnings = new Set(info.warnings);
  if (!Number.isFinite(pc)) return { variables, nodes, warnings: [...warnings, '여러 명령어가 동시에 진행 중이어서 변수 범위를 해석하지 않습니다.'] };
  const active = (die: Die): boolean => { for (let scope: Die | undefined = die.parent; scope; scope = scope.parent) { if (scope.attrs.has(0x55)) { warnings.add('범위 목록으로 표현된 변수 범위는 아직 해석하지 않습니다.'); return false; } const range = rangeOf(scope); if (range && (pc < range.low || pc >= range.high)) return false; } return true; };
  const cfa = info.cfa.find(rule => pc >= rule.start && pc < rule.end);
  const register = (id: number) => snapshot.registers[`x${id}`] === undefined ? undefined : Number(snapshot.registers[`x${id}`]);
  const frame = cfa && register(cfa.reg) !== undefined ? (register(cfa.reg)! + cfa.offset) >>> 0 : undefined;
  const location = (die: Die): { address?: number; reg?: number } => {
    const expr = die.attrs.get(2); if (!(expr instanceof Uint8Array)) return {};
    const r = new Reader(expr), op = r.uint(1);
    if (op === 3 && expr.length === 5) return { address: r.uint() };
    if (op >= 0x50 && op <= 0x6f && expr.length === 1) return { reg: op - 0x50 };
    if (op === 0x91) {
      let fn = die.parent; while (fn && fn.tag !== 0x2e) fn = fn.parent;
      const base = fn?.attrs.get(0x40);
      if (frame !== undefined && base instanceof Uint8Array && base.length === 1 && base[0] === 0x9c) { const offset = r.leb(true); if (r.p === expr.length) return { address: (frame + offset) >>> 0 }; }
    }
    return {};
  };
  const read = (name: string, typeId: number, address: number | undefined, line: number, depth = 0, reg?: number): MemoryValue => {
    const original = info.dies.get(typeId), type = concrete(info, original);
    const result: MemoryValue = { name, type: typeName(info, original), typeId: type?.offset, byteSize: byteSize(info, type), address, value: '확인할 수 없음', line, children: [] };
    if (!type) { result.unavailable = '타입 정보 없음'; return result; }
    if (address === undefined && reg === undefined) { result.unavailable = '현재 위치의 변수 주소를 해석할 수 없음'; return result; }
    if (type.tag === 0x13 && address !== undefined && depth < 5) {
      result.value = 'struct';
      result.children = type.children.filter(member => member.tag === 0x0d).slice(0, 32).map(member => {
        const offset = num(member, 0x38);
        if (offset === undefined || member.attrs.has(0x0d) || member.attrs.has(0x6b)) return { name: nameOf(member), type: '?', value: '비트필드/복합 위치 미지원', line, children: [] };
        return read(nameOf(member), num(member, 0x49) ?? -1, (address + offset) >>> 0, line, depth + 1);
      });
    } else if (type.tag === 1 && address !== undefined && depth < 5) {
      const elementId = num(type, 0x49) ?? -1, elementSize = byteSize(info, info.dies.get(elementId));
      const total = byteSize(info, type);
      if (!elementSize || total === undefined) { result.unavailable = '가변 길이/다차원 배열 크기를 확인할 수 없음'; return result; }
      const dimensions = type.children.filter(child => child.tag === 0x21);
      if (dimensions.length !== 1) { result.unavailable = '다차원 배열 런타임 표시 미지원'; return result; }
      const count = total / elementSize;
      if (!Number.isSafeInteger(count) || count < 0) { result.unavailable = '배열 원소 수를 확인할 수 없음'; return result; }
      result.value = `${count}개 원소${count > 32 ? ' · 앞 32개 표시' : ''}`;
      result.children = Array.from({ length: Math.min(32, count) }, (_, i) => read(`${name}[${i}]`, elementId, (address + i * elementSize) >>> 0, line, depth + 1));
    } else {
      const size = byteSize(info, type);
      if (!size || size > 4 || ![0x24, 0x0f, 0x04].includes(type.tag)) { result.unavailable = '이 타입의 값 표시는 지원하지 않음'; return result; }
      const value = reg === undefined ? memoryAt(snapshot, address!, size) : register(reg);
      if (value === undefined) { result.unavailable = '메모리 기록 없음'; result.value = '아직 기록되지 않음'; return result; }
      if (type.tag === 0x0f) { result.pointer = value >>> 0; result.targetType = concrete(info, info.dies.get(num(type, 0x49) ?? -1))?.offset; result.value = value === 0 ? 'NULL' : hex(value); }
      else if ([4, 9].includes(num(type, 0x3e) ?? -1)) { result.unavailable = '부동소수점 값 해석 미지원'; }
      else { const signed = [5, 6].includes(num(type, 0x3e) ?? -1); result.value = String(signed && value >= 2 ** (size * 8 - 1) ? value - 2 ** (size * 8) : value); }
    }
    return result;
  };
  for (const die of info.dies.values()) {
    if (![0x34, 0x05].includes(die.tag) || !nameOf(die) || !active(die)) continue;
    const loc = location(die);
    variables.push(read(nameOf(die), num(die, 0x49) ?? -1, loc.address, num(die, 0x3b) ?? 1, 0, loc.reg));
    if (variables.length >= 128) { warnings.add('현재 범위의 변수는 앞 128개까지 표시합니다.'); break; }
  }
  const seen = new Set<string>();
  const collect = (value: MemoryValue) => {
    if (value.value === 'struct' && value.address !== undefined) {
      const id = String(value.address); if (!seen.has(id)) { seen.add(id); nodes.push(value); }
    }
    for (const child of value.children) collect(child);
  };
  variables.forEach(collect);
  // Follow only typed pointers whose object bytes actually exist in the snapshot.
  const queue = variables.slice();
  for (let i = 0; i < queue.length && i < 512 && nodes.length < 40; i++) {
    const value = queue[i]; queue.push(...value.children);
    if (!value.pointer || value.targetType === undefined) continue;
    const type = concrete(info, info.dies.get(value.targetType));
    const size = byteSize(info, type);
    if (type?.tag !== 0x13 || !size || size > 4096 || seen.has(String(value.pointer))) continue;
    const known = Array.from({ length: size }, (_, index) => memoryAt(snapshot, value.pointer! + index, 1)).every(byte => byte !== undefined);
    if (!known) continue;
    const object = read(`*${value.name}`, value.targetType, value.pointer, value.line); collect(object); queue.push(object);
  }
  return { variables, nodes, line: info.lines.find(row => pc >= row.start && pc < row.end)?.line, warnings: [...warnings] };
}
