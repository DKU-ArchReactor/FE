import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isMappedToSelection, parseAssembly } from '../src/pages/CToAsm/mapping';

describe('compiler-authored source mapping', () => {
  it('maps a real RV32IM addition to its two loads, add and store', () => {
    const assembly = readFileSync('tests/fixtures/arithmetic.s', 'utf8');
    const rows = parseAssembly(assembly, 7);
    expect(rows.filter(row => row.sourceLine === 4).map(row => row.text)).toEqual([
      'lw\ta4,-20(s0)', 'lw\ta5,-24(s0)', 'add\ta5,a4,a5', 'sw\ta5,-28(s0)',
    ]);
    expect(rows.filter(row => row.sourceLine === 2).map(row => row.text)).toEqual(['li\ta5,5', 'sw\ta5,-20(s0)']);
    expect(rows.every(row => !row.text.includes('.debug'))).toBe(true);
  });

  it('does not borrow a location from another source file or a missing file entry', () => {
    const rows = parseAssembly('.file 1 "source.c"\n.file 2 "header.h"\n.text\n.loc 1 2 0\nli a0,1\n.loc 2 2 0\nli a0,2\n.loc 3 2 0\nli a0,3', 5);
    expect(rows.map(row => row.sourceLine)).toEqual([2, null, null]);
  });

  it('handles DWARF5 file zero and CRLF but rejects invalid source lines', () => {
    const rows = parseAssembly('.file 0 "/tmp" "source.c"\r\n.text\r\n.loc 0 3 9\r\nlw a0,0(a1)\r\n.loc 0 0 0\r\nret\r\n.loc 0 99 1\r\nnop', 6);
    expect(rows.map(row => row.sourceLine)).toEqual([3, null, null]);
  });

  it('keeps branch labels, excludes data/debug sections and resets function locations', () => {
    const rows = parseAssembly('.file 1 "source.c"\n.text\n.loc 1 2 0\n.L2:\naddi a0,a0,1\n.cfi_endproc\nother:\nret\n.section .rodata\n.ascii "add a0,a1,a2"\n.section .text.next,"ax"\nret', 4);
    expect(rows.map(row => [row.text, row.sourceLine])).toEqual([['.L2:', null], ['addi a0,a0,1', 2], ['other:', null], ['ret', null], ['ret', null]]);
  });

  it('does not fabricate a mapping when debug information is absent', () => {
    expect(parseAssembly('.text\nmain:\nli a0,42\nret', 5).every(row => row.sourceLine === null)).toBe(true);
  });

  it('selects all instruction groups in a C range, including noncontiguous groups', () => {
    const rows = parseAssembly('.file 1 "source.c"\n.text\n.loc 1 3 0\nli a0,1\n.loc 1 5 0\nret\n.loc 1 3 0\nli a0,2\n.loc 1 4 0\nadd a0,a0,a1', 8);
    expect(rows.filter(row => isMappedToSelection(row, { start: 3, end: 4 })).map(row => row.text)).toEqual(['li a0,1', 'li a0,2', 'add a0,a0,a1']);
  });
});
