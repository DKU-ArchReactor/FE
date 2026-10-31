// DWARF 4/5, ELF32 little endian. Unsupported encodings fail closed.
// Reference: https://dwarfstd.org/doc/DWARF5.pdf (forms, expressions, line/CFI tables).
export class Reader {
  p = 0;
  bytes: Uint8Array;
  constructor(bytes: Uint8Array) { this.bytes = bytes; }
  uint(n = 4): number { if (n < 0 || n > 4 || this.p < 0 || !Number.isInteger(this.p) || this.p + n > this.bytes.length) throw new Error('디버그 데이터 범위를 벗어났습니다.'); let value = 0; for (let i = 0; i < n; i++) value += this.bytes[this.p++] * 2 ** (8 * i); return value; }
  leb(signed = false): number { let value = 0, shift = 0, b = 0; do { if (shift > 49) throw new Error('지원하지 않는 LEB128 값입니다.'); b = this.uint(1); value += (b & 127) * 2 ** shift; shift += 7; } while (b & 128); return signed && (b & 64) ? value - 2 ** shift : value; }
  string(): string { const start = this.p; while (this.uint(1)) { /* NUL */ } return new TextDecoder().decode(this.bytes.subarray(start, this.p - 1)); }
  block(n: number): Uint8Array { if (n > this.bytes.length - this.p || n < 0) throw new Error('잘못된 디버그 블록입니다.'); const value = this.bytes.slice(this.p, this.p + n); this.p += n; return value; }
}
type Value = number | string | Uint8Array;
export type Die = { offset: number; tag: number; attrs: Map<number, Value>; forms: Map<number, number>; parent?: Die; children: Die[] };
export type Cfa = { start: number; end: number; reg: number; offset: number };
export type SourceAddress = { start: number; end: number; line: number };
export type DebugInfo = { dies: Map<number, Die>; cfa: Cfa[]; lines: SourceAddress[]; warnings: string[] };
export const num = (die: Die, key: number) => typeof die.attrs.get(key) === 'number' ? die.attrs.get(key) as number : undefined;
export const nameOf = (die: Die) => typeof die.attrs.get(3) === 'string' ? die.attrs.get(3) as string : '';
function strAt(bytes: Uint8Array | undefined, offset: number): string { if (!bytes || offset >= bytes.length) throw new Error('문자열 디버그 섹션이 없습니다.'); const reader = new Reader(bytes); reader.p = offset; return reader.string(); }
function formValue(r: Reader, form: number, sections: Map<string, Uint8Array>, cu = 0, implicit = 0): Value {
  switch (form) {
    case 0x01: return r.uint();
    case 0x03: return r.block(r.uint(2));
    case 0x04: return r.block(r.uint());
    case 0x05: return r.uint(2);
    case 0x06: case 0x17: return r.uint();
    case 0x07: { const lo = r.uint(), hi = r.uint(); if (hi > 0x1fffff) throw new Error('64비트 값 범위 초과'); return lo + hi * 2 ** 32; }
    case 0x08: return r.string();
    case 0x09: case 0x18: return r.block(r.leb());
    case 0x0a: return r.block(r.uint(1));
    case 0x0b: case 0x0c: return r.uint(1);
    case 0x0d: return r.leb(true);
    case 0x0e: return strAt(sections.get('.debug_str'), r.uint());
    case 0x0f: return r.leb();
    case 0x10: return r.uint();
    case 0x11: return cu + r.uint(1);
    case 0x12: return cu + r.uint(2);
    case 0x13: return cu + r.uint();
    case 0x15: return cu + r.leb();
    case 0x16: return formValue(r, r.leb(), sections, cu);
    case 0x19: return 1;
    case 0x1f: return strAt(sections.get('.debug_line_str'), r.uint());
    case 0x21: return implicit;
    default: throw new Error(`지원하지 않는 DWARF form 0x${form.toString(16)}`);
  }
}
function readDies(sections: Map<string, Uint8Array>): Map<number, Die> {
  const r = new Reader(sections.get('.debug_info') || new Uint8Array());
  const dies = new Map<number, Die>();
  while (r.p < r.bytes.length) {
    const cu = r.p, length = r.uint(), end = r.p + length;
    if (length === 0xffffffff || end > r.bytes.length) throw new Error('DWARF64 또는 잘못된 CU입니다.');
    const version = r.uint(2); let abbrevOffset: number, addressSize: number;
    if (version === 5) { const unit = r.uint(1); addressSize = r.uint(1); abbrevOffset = r.uint(); if (unit !== 1) { r.p = end; continue; } }
    else if (version === 4) { abbrevOffset = r.uint(); addressSize = r.uint(1); }
    else throw new Error(`DWARF ${version}은 지원하지 않습니다.`);
    if (addressSize !== 4) throw new Error('32비트 주소만 지원합니다.');
    const a = new Reader(sections.get('.debug_abbrev') || new Uint8Array()); a.p = abbrevOffset;
    const abbreviations = new Map<number, { tag: number; children: boolean; attrs: { key: number; form: number; implicit: number }[] }>();
    while (a.p < a.bytes.length) {
      const code = a.leb(); if (!code) break;
      const tag = a.leb(), hasChildren = !!a.uint(1), attrs = [];
      for (;;) { const key = a.leb(), form = a.leb(); if (!key && !form) break; attrs.push({ key, form, implicit: form === 0x21 ? a.leb(true) : 0 }); }
      abbreviations.set(code, { tag, children: hasChildren, attrs });
    }
    const parents: Die[] = [];
    while (r.p < end) {
      const offset = r.p, code = r.leb(); if (!code) { parents.pop(); continue; }
      const spec = abbreviations.get(code); if (!spec) throw new Error('알 수 없는 DWARF abbreviation');
      const die: Die = { offset, tag: spec.tag, attrs: new Map(), forms: new Map(), parent: parents.at(-1), children: [] };
      for (const attr of spec.attrs) { die.attrs.set(attr.key, formValue(r, attr.form, sections, cu, attr.implicit)); die.forms.set(attr.key, attr.form); }
      die.parent?.children.push(die); dies.set(offset, die); if (spec.children) parents.push(die);
    }
    if (r.p !== end) throw new Error('디버그 CU 크기가 맞지 않습니다.');
  }
  return dies;
}
function readFrames(bytes: Uint8Array): Cfa[] {
  const r = new Reader(bytes), result: Cfa[] = [];
  const cies = new Map<number, { code: number; data: number; reg: number; offset: number }>();
  while (r.p < bytes.length) {
    const start = r.p, length = r.uint(); if (!length) break;
    const end = r.p + length, id = r.uint(); if (end > bytes.length) throw new Error('잘못된 CFI');
    let pc = 0, limit = 0, code = 1, data = -4, reg = 2, offset = 0;
    if (id === 0xffffffff) { const version = r.uint(1); if (r.string()) throw new Error('CFI augmentation 미지원'); if (version === 4) { if (r.uint(1) !== 4 || r.uint(1) !== 0) throw new Error('CFI 주소 형식 미지원'); } else if (version !== 1 && version !== 3) throw new Error('CFI 버전 미지원'); code = r.leb(); data = r.leb(true); if (!code) throw new Error('잘못된 CFI 정렬'); if (version === 1) r.uint(1); else r.leb(); }
    else { const cie = cies.get(id); if (!cie) throw new Error('CFI CIE가 없습니다.'); ({ code, data, reg, offset } = cie); pc = r.uint(); limit = pc + r.uint(); }
    let rowStart = pc; const stack: { reg: number; offset: number }[] = [];
    const advance = (next: number) => { if (id !== 0xffffffff && next > rowStart) result.push({ start: rowStart, end: Math.min(next, limit), reg, offset }); pc = next; rowStart = next; };
    while (r.p < end) {
      const op = r.uint(1), primary = op & 0xc0;
      if (primary === 0x40) advance(pc + (op & 63) * code);
      else if (primary === 0x80) r.leb();
      else if (primary === 0xc0 || op === 0) { /* register restoration does not alter CFA */ }
      else if (op === 1) advance(r.uint());
      else if (op >= 2 && op <= 4) advance(pc + r.uint(2 ** (op - 2)) * code);
      else if (op === 5 || op === 9 || op === 0x14) { r.leb(); r.leb(); }
      else if (op === 6 || op === 7 || op === 8) r.leb();
      else if (op === 10) stack.push({ reg, offset });
      else if (op === 11) { const saved = stack.pop(); if (!saved) throw new Error('CFI 상태 복원 실패'); ({ reg, offset } = saved); }
      else if (op === 12) { reg = r.leb(); offset = r.leb(); }
      else if (op === 13) reg = r.leb();
      else if (op === 14) offset = r.leb();
      else if (op === 0x11 || op === 0x15) { r.leb(); r.leb(true); }
      else if (op === 0x12) { reg = r.leb(); offset = r.leb(true) * data; }
      else if (op === 0x13) offset = r.leb(true) * data;
      else throw new Error(`CFI opcode ${op} 미지원`);
    }
    if (id === 0xffffffff) cies.set(start, { code, data, reg, offset }); else advance(limit);
  }
  return result.filter(row => row.end > row.start);
}
function readLines(sections: Map<string, Uint8Array>): SourceAddress[] {
  const r = new Reader(sections.get('.debug_line') || new Uint8Array()), rows: SourceAddress[] = [];
  while (r.p < r.bytes.length) {
    const length = r.uint(), end = r.p + length, version = r.uint(2);
    if (length === 0xffffffff || end > r.bytes.length) throw new Error('잘못된 line table');
    if (version === 5 && (r.uint(1) !== 4 || r.uint(1) !== 0)) throw new Error('line 주소 형식 미지원');
    if (version !== 4 && version !== 5) throw new Error('line 버전 미지원');
    const headerEnd = r.uint() + r.p;
    const minInstruction = r.uint(1), maxOps = r.uint(1); if (maxOps !== 1) throw new Error('VLIW 미지원');
    r.uint(1); const rawBase = r.uint(1), lineBase = rawBase > 127 ? rawBase - 256 : rawBase;
    const lineRange = r.uint(1), opcodeBase = r.uint(1), lengths = [0];
    if (!lineRange || !opcodeBase) throw new Error('잘못된 line 연산자');
    for (let i = 1; i < opcodeBase; i++) lengths.push(r.uint(1));
    let files: string[] = [];
    if (version === 5) {
      for (let table = 0; table < 2; table++) {
        const formats: { content: number; form: number }[] = [];
        const count = r.uint(1); for (let i = 0; i < count; i++) formats.push({ content: r.leb(), form: r.leb() });
        const entries = r.leb();
        for (let i = 0; i < entries; i++) { let path = ''; for (const format of formats) { const value = formValue(r, format.form, sections); if (format.content === 1 && typeof value === 'string') path = value; } if (table === 1) files.push(path); }
      }
    } else {
      while (r.string()) { /* directory names */ }
      files = ['']; for (;;) { const path = r.string(); if (!path) break; files.push(path); r.leb(); r.leb(); r.leb(); }
    }
    if (headerEnd < r.p || headerEnd > end) throw new Error('잘못된 line header 크기');
    r.p = headerEnd;
    let pc = 0, line = 1, file = 1, previous: { pc: number; line: number; file: number } | undefined;
    const emit = (finish = false) => {
      if (previous && pc > previous.pc && files[previous.file]?.replace(/\\/g, '/').split('/').at(-1) === 'source.c' && previous.line > 0) rows.push({ start: previous.pc, end: pc, line: previous.line });
      previous = finish ? undefined : { pc, line, file };
      if (finish) { pc = 0; line = 1; file = 1; }
    };
    while (r.p < end) {
      const op = r.uint(1);
      if (op === 0) { const size = r.leb(), next = r.p + size; if (size < 1 || next > end) throw new Error('잘못된 확장 line 연산자'); const ext = r.uint(1); if (ext === 1) emit(true); else if (ext === 2) pc = r.uint(); r.p = next; }
      else if (op >= opcodeBase) { const adjusted = op - opcodeBase; pc += Math.floor(adjusted / lineRange) * minInstruction; line += lineBase + adjusted % lineRange; emit(); }
      else if (op === 1) emit();
      else if (op === 2) pc += r.leb() * minInstruction;
      else if (op === 3) line += r.leb(true);
      else if (op === 4) file = r.leb();
      else if (op === 8) pc += Math.floor((255 - opcodeBase) / lineRange) * minInstruction;
      else if (op === 9) pc += r.uint(2);
      else for (let i = 0; i < lengths[op]; i++) r.leb();
    }
  }
  return rows;
}
export function parseDebugInfo(buffer: ArrayBuffer): DebugInfo {
  const bytes = new Uint8Array(buffer), r = new Reader(bytes);
  if (r.uint() !== 0x464c457f || r.uint(1) !== 1 || r.uint(1) !== 1) throw new Error('ELF32 little-endian 파일이 필요합니다.');
  r.p = 18; if (r.uint(2) !== 243) throw new Error('RISC-V ELF 파일이 아닙니다.');
  r.p = 32; const sectionOffset = r.uint(); r.p = 46; const size = r.uint(2), count = r.uint(2), stringsIndex = r.uint(2);
  if (size < 40 || count > 4096) throw new Error('잘못된 ELF 섹션 헤더');
  const header = (i: number) => { r.p = sectionOffset + i * size; const name = r.uint(); r.p += 12; return { name, offset: r.uint(), size: r.uint() }; };
  const stringHeader = header(stringsIndex), strings = bytes.subarray(stringHeader.offset, stringHeader.offset + stringHeader.size);
  const sections = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) { const section = header(i); if (section.offset + section.size > bytes.length) continue; sections.set(strAt(strings, section.name), bytes.subarray(section.offset, section.offset + section.size)); }
  if (!sections.has('.debug_info')) throw new Error('ELF에 변수 디버그 정보가 없습니다. -g로 다시 컴파일해 주세요.');
  const dies = readDies(sections), warnings: string[] = []; let cfa: Cfa[] = [], lines: SourceAddress[] = [];
  try { cfa = readFrames(sections.get('.debug_frame') || new Uint8Array()); } catch (error) { warnings.push(String(error)); }
  try { lines = readLines(sections); } catch (error) { warnings.push(String(error)); }
  return { dies, cfa, lines, warnings };
}
export function rangeOf(die: Die): { low: number; high: number } | undefined {
  const low = num(die, 0x11), high = num(die, 0x12);
  if (low === undefined || high === undefined) return undefined;
  return { low, high: die.forms.get(0x12) === 1 ? high : low + high };
}
