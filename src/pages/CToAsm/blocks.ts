import type { AssemblyRow } from './mapping';

export type CodeBlock = { sourceLine: number | null; functionName: string | null; rows: AssemblyRow[] };

// Only adjacent output rows are grouped. Sorting by C line would change control flow.
export function groupAssembly(rows: AssemblyRow[]): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  for (const row of rows) {
    const previous = blocks.at(-1);
    if (previous && previous.sourceLine === row.sourceLine && previous.functionName === row.functionName) previous.rows.push(row);
    else blocks.push({ sourceLine: row.sourceLine, functionName: row.functionName, rows: [row] });
  }
  return blocks;
}

export function operandExplanation(text: string): string | null {
  const [op, ...rest] = text.trim().split(/\s+/);
  const operands = rest.join(' ').split(',').map(value => value.trim());
  const [dest, left, right] = operands;
  const address = left?.match(/^(-?\d+)\((\w+)\)$/);
  const addressText = address ? `${address[2]} ${Number(address[1]) < 0 ? '−' : '+'} ${Math.abs(Number(address[1]))}` : left;
  if (/^(lb|lbu|lh|lhu|lw)$/.test(op) && operands.length === 2) return `${dest} ← 메모리[${addressText}] · ${op === 'lw' ? 4 : op.startsWith('lh') ? 2 : 1}바이트 읽기`;
  if (/^(sb|sh|sw)$/.test(op) && operands.length === 2) return `메모리[${addressText}] ← ${dest} · ${op === 'sw' ? 4 : op === 'sh' ? 2 : 1}바이트 저장`;
  if (op === 'li' && operands.length === 2) return `${dest} ← 상수 ${left}`;
  if (op === 'mv' && operands.length === 2) return `${dest} ← ${left} · 레지스터 값 복사`;
  const operator: Record<string, string> = { add: '+', addi: '+', sub: '−', mul: '×' };
  if (operator[op] && operands.length === 3) return `${dest} ← ${left} ${operator[op]} ${right}`;
  if (op === 'ret') return '복귀 주소 ra로 이동';
  if (op === 'jr' && operands.length === 1) return `${dest}가 가리키는 위치로 이동`;
  if (op === 'j' && operands.length === 1) return `${dest} 레이블로 이동`;
  if (op === 'lui' && operands.length === 2) return `${dest} ← ${left}의 상위 즉시값 · 하위 12비트는 0`;
  if (op === 'auipc' && operands.length === 2) return `${dest} ← 현재 명령어 주소 + 상위 즉시값 ${left}`;
  if (/^(sll|slli|srl|srli|sra|srai)$/.test(op) && operands.length === 3) return `${dest} ← ${left}를 ${right}비트 ${op.startsWith('sll') ? '왼쪽' : '오른쪽'} 이동${op.startsWith('sra') ? ' · 부호 유지' : ''}`;
  const comparisons: Record<string, string> = { beq: '=', bne: '≠', blt: '<', bge: '≥', bltu: '< (부호 없음)', bgeu: '≥ (부호 없음)' };
  if (comparisons[op] && operands.length === 3) return `${dest} ${comparisons[op]} ${left}이면 ${right}로 분기`;
  if (/^(call|tail)$/.test(op) && operands.length === 1) return `${dest} 함수로 ${op === 'tail' ? '꼬리 호출' : '호출'}`;
  return null;
}
