import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseDebugInfo, nameOf } from '../src/pages/CToAsm/debug';
import { inspectMemory, snapshotForCycle } from '../src/pages/CToAsm/runtime';
import type { SimulationResult } from '../src/type/simulation';
const bytes = readFileSync('tests/fixtures/structures.elf');
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const trace = JSON.parse(readFileSync('tests/fixtures/structures-trace.json', 'utf8').replace(/^\uFEFF/, '')) as SimulationResult;
describe('real ELF debug metadata and CORE memory snapshots', () => {
  it('reads GCC variable types, source addresses, and frame rules', () => {
    const info = parseDebugInfo(buffer);
    expect([...info.dies.values()].some(die => nameOf(die) === 'head')).toBe(true);
    expect(info.cfa.some(row => row.reg === 8 && row.offset === 0)).toBe(true);
    expect(info.lines.some(row => row.line === 15)).toBe(true);
    expect(info.warnings).toEqual([]);
  });
  it('locates actual local arrays using CFA and reads captured values', () => {
    const info = parseDebugInfo(buffer);
    const views = trace.history.map(cycle => inspectMemory(info, snapshotForCycle(cycle)));
    const initialized = views.find(view => view.variables.find(value => value.name === 'values')?.children.map(value => value.value).join(',') === '3,5,7,9');
    expect(initialized).toBeDefined();
    expect(initialized!.variables.find(value => value.name === 'values')!.address).toBe(0x7fffefcc);
  });
  it('rejects invalid ELF input rather than guessing addresses', () => {
    expect(() => parseDebugInfo(new ArrayBuffer(20))).toThrow();
  });
});

describe('long source actual pointer mutation', () => {
  const bytes = readFileSync('tests/fixtures/long.elf');
  const info = parseDebugInfo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const trace = JSON.parse(readFileSync('tests/fixtures/long-trace.json', 'utf8')) as SimulationResult;
  it('resolves source lines and captures the real list rewiring', () => {
    const views = trace.history.map(cycle => inspectMemory(info, snapshotForCycle(cycle)));
    const targets = views.flatMap(view => {
      const root = view.nodes.find(node => node.name === 'list[0]');
      return root?.children.find(field => field.name === 'next')?.pointer || [];
    });
    expect(new Set(targets).size).toBeGreaterThanOrEqual(2);
    expect(views.some(view => view.nodes.some(node => node.type === 'TreeNode'))).toBe(true);
    expect(info.warnings).toEqual([]);
    expect(Number(trace.history.at(-1)!.global_result.registers.x10)).toBe(65);
  });
});


it('uses the actual in-flight instruction rather than a speculative next fetch at a function boundary', () => {
  const trace=JSON.parse(readFileSync('tests/fixtures/long-trace.json','utf8')) as SimulationResult;
  const boundary=trace.history.find(cycle=>cycle.clock===1320)!;
  expect(boundary.global_result.current_pc).toBe('0x00010168');
  expect(snapshotForCycle(boundary).current_pc).toBe('0x00010164');
});

it('does not guess a frame when more than one instruction PC is active', () => {
  const bytes=readFileSync('tests/fixtures/long.elf');
  const info=parseDebugInfo(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const trace=JSON.parse(readFileSync('tests/fixtures/long-trace.json','utf8')) as SimulationResult;
  const cycle=trace.history[0];
  const ambiguous={...cycle,buffers:{...cycle.buffers,IF:{pc:'0x00010020',assembly:'addi',status:'normal'},WB:{pc:'0x00010500',assembly:'addi',status:'normal'}}};
  const view=inspectMemory(info,snapshotForCycle(ambiguous));
  expect(view.variables).toEqual([]);
  expect(view.warnings.join(' ')).toContain('동시에 진행');
});
