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

it('parses typedef aliases, multi-declarators, multidimensional arrays and designated links', () => {
  const result = analyzeCStructures('typedef struct Node { int x,y; struct Node *left,*right; } Node;\nNode tail={0};\nNode head={.right=&tail,.x=1};\nNode nodes[3];\nint grid[2][4];');
  expect(result.structs[0].fields.map(field => [field.name, field.pointer])).toEqual([['x',false],['y',false],['left',true],['right',true]]);
  expect(result.links).toEqual([{from:'head',field:'right',to:'tail',line:3}]);
  expect(result.arrays.map(array => [array.name,array.dimensions])).toEqual([['nodes',['3']],['grid',['2','4']]]);
});
it('uses syntax nodes for declarations that share a line and preserves source functions', () => {
  const result = analyzeCStructures('int f(){ int a[3]; int b[4]; return a[0]; }\nint g(){return 2;}');
  expect(result.arrays.map(array => array.name)).toEqual(['a','b']);
  expect(result.functions.map(fn => fn.name)).toEqual(['f','g']);
});
