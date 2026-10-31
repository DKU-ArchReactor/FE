export type AssemblyRow = {
  assemblyLine: number;
  text: string;
  kind: 'instruction' | 'label';
  sourceLine: number | null;
};

// The compile API writes uploaded C content to source.c. Never infer mapping
// from instruction text, register names, or the filename chosen in the browser.
export function parseAssembly(assembly: string, sourceLineCount: number): AssemblyRow[] {
  const files = new Map<number, string>();
  const lines = assembly.split(/\r?\n/);
  for (const line of lines) {
    const file = line.match(/^\s*\.file\s+(\d+)\s+(.+)$/);
    if (!file) continue;
    const names = [...file[2].matchAll(/"((?:\\.|[^"\\])*)"/g)];
    const name = names.at(-1)?.[1];
    if (name) files.set(Number(file[1]), name.replace(/\\\\/g, '/').split('/').at(-1)!);
  }

  const rows: AssemblyRow[] = [];
  let executable = false;
  let previousExecutable = false;
  const sectionStack: boolean[] = [];
  let sourceLine: number | null = null;
  lines.forEach((raw, index) => {
    const text = raw.replace(/#.*/, '').trim();
    const section = text.match(/^\.(section|pushsection)\s+([^,\s]+)(?:\s*,\s*"([^"]*)")?/);
    if (section) {
      if (section[1] === 'pushsection') sectionStack.push(executable);
      previousExecutable = executable;
      executable = section[3]?.includes('x') ?? /^\.text(?:\.|$)/.test(section[2]);
      sourceLine = null;
      return;
    }
    if (/^\.(text|data|bss|rodata)(?:\s|$)/.test(text)) {
      previousExecutable = executable;
      executable = /^\.text(?:\s|$)/.test(text);
      sourceLine = null;
      return;
    }
    if (text === '.popsection' || text === '.previous') {
      const next = text === '.popsection' ? (sectionStack.pop() ?? false) : previousExecutable;
      previousExecutable = executable;
      executable = next;
      sourceLine = null;
      return;
    }
    const location = text.match(/^\.loc\s+(\d+)\s+(\d+)(?:\s|$)/);
    if (location) {
      const lineNumber = Number(location[2]);
      sourceLine = files.get(Number(location[1])) === 'source.c' && lineNumber > 0 && lineNumber <= sourceLineCount
        ? lineNumber : null;
      return;
    }
    if (/^\.(?:cfi_endproc|size)\b/.test(text)) { sourceLine = null; return; }
    if (!executable || !text) return;
    if (/^[.$\w]+:$/.test(text)) {
      // Keep branch targets and public function labels, hide debug-only labels.
      if (!/^\.L(?:FB|FE|VL|BB|BE|text|etext|debug)/.test(text)) {
        rows.push({ assemblyLine: index + 1, text, kind: 'label', sourceLine: null });
      }
    } else if (/^[a-zA-Z][\w.]*\s*[^=]*$/.test(text) && !text.startsWith('.')) {
      rows.push({ assemblyLine: index + 1, text, kind: 'instruction', sourceLine });
    }
  });
  return rows;
}

export type SourceSelection = { start: number; end: number };

export function isMappedToSelection(row: AssemblyRow, selection: SourceSelection | null): boolean {
  return row.sourceLine !== null && selection !== null && row.sourceLine >= selection.start && row.sourceLine <= selection.end;
}

export function instructionExplanation(text: string): string {
  const op = text.split(/\s/)[0];
  if (/^(lb|lbu|lh|lhu|lw)$/.test(op)) return '메모리 읽기: 주소의 값을 레지스터로 가져옵니다.';
  if (/^(sb|sh|sw)$/.test(op)) return '메모리 쓰기: 레지스터의 값을 주소에 저장합니다.';
  if (/^(beq|bne|blt|bge|bltu|bgeu|beqz|bnez|ble|bgt|bleu|bgtu|blez|bgez|bltz|bgtz)$/.test(op)) return '조건 분기: 비교 결과에 따라 실행할 위치를 선택합니다.';
  if (/^(j|jr|jal|jalr|ret|call|tail)$/.test(op)) return '제어 이동: 레이블·레지스터가 가리키는 위치로 이동합니다. 호출이나 복귀에도 사용됩니다.';
  if (/^(li|la|lla|mv)$/.test(op)) return '값·주소 전달: 어셈블러가 실제 명령어로 확장하는 의사 명령어입니다.';
  if (/^(add|addi|sub|mul|mulh|mulhu|mulhsu|div|divu|rem|remu)$/.test(op)) return '산술 연산: 정수 계산에 사용됩니다. add/addi는 주소·스택 위치 계산에도 사용됩니다.';
  if (/^(sll|slli|srl|srli|sra|srai)$/.test(op)) return '비트 이동: 비트를 좌우로 옮깁니다. 원소 크기에 따른 인덱스 계산에도 쓰일 수 있습니다.';
  if (/^(and|andi|or|ori|xor|xori|slt|slti|sltu|sltiu)$/.test(op)) return '논리·비교 연산: 비트를 조합하거나 비교 결과를 레지스터에 저장합니다.';
  return '이 명령어가 속한 C 위치는 컴파일러의 줄 정보를 기준으로 표시합니다.';
}
