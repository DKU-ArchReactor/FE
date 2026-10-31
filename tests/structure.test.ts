import { describe, expect, it } from 'vitest';
import { analyzeCStructures } from '../src/pages/CToAsm/structure';

describe('source-backed C structure inspection', () => {
  it('reads arrays and structure fields from the current source', () => {
    const result = analyzeCStructures('struct Node { int value; struct Node *next; };\nstruct Node head;\nint items[4];\n');
    expect(result.structs.map(type => [type.name, type.fields.map(field => field.name), type.instances])).toEqual([['Node', ['value', 'next'], ['head']]]);
    expect(result.arrays.map(array => [array.name, array.dimensions])).toEqual([['items', ['4']]]);
    expect(result.links).toEqual([]);
  });

  it('shows only pointer targets explicitly written in aggregate initializers', () => {
    const result = analyzeCStructures('struct Node { int value; struct Node *next; };\nstruct Node tail = { 2, 0 };\nstruct Node head = { 1, &tail };\n');
    expect(result.links).toEqual([{ from: 'head', field: 'next', to: 'tail', line: 3 }]);
  });

  it('ignores declarations inside comments and string literals', () => {
    const result = analyzeCStructures('// int fake[8];\nchar *text = "struct Nope { int x; };";\nint real[2];\n');
    expect(result.structs).toEqual([]);
    expect(result.arrays.map(array => array.name)).toEqual(['real']);
  });

  it('does not invent array sizes or pointer relationships', () => {
    const result = analyzeCStructures('void run(int n) {\n int values[n];\n struct Link *head;\n}\n');
    expect(result.arrays.map(array => array.dimensions)).toEqual([['n']]);
    expect(result.links).toEqual([]);
  });
});
