import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseDebugInfo } from '../src/pages/CToAsm/debug';
import { memoryTimeline } from '../src/pages/CToAsm/memoryTimeline';
import type { SimulationResult } from '../src/type/simulation';
const bytes=readFileSync('tests/fixtures/long.elf');
const debug=parseDebugInfo(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const trace=JSON.parse(readFileSync('tests/fixtures/long-trace.json','utf8')) as SimulationResult;
describe('memory change navigation',()=>{
  it('retains the real array writes and pointer rewiring while reducing idle steps',()=>{
    const timeline=memoryTimeline(debug,trace.history);
    expect(timeline.length).toBeLessThan(trace.history.length);
    expect(timeline[0].index).toBe(0);
    expect(timeline.at(-1)!.index).toBeLessThan(trace.history.length-1);
    expect(timeline.at(-1)!.changes.length).toBeGreaterThan(0);
    expect(timeline.some(step=>step.changes.some(change=>change.name==='values[0]' && change.after==='1'))).toBe(true);
    const pointerChanges=timeline.flatMap(step=>step.changes).filter(change=>change.name==='list[0].next' && change.pointer);
    expect(new Set(pointerChanges.map(change=>change.after)).size).toBeGreaterThanOrEqual(2);
    expect(timeline.every(step=>step.changes.every(change=>change.before!==change.after))).toBe(true);
  });
});
