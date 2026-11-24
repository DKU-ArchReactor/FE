import type { buildInstructionFlow } from "./instructionFlow";
type Flow = ReturnType<typeof buildInstructionFlow>;

export const wordValue = (value?: string | null) =>
  value && /^0x[\da-f]{1,8}$/i.test(value)
    ? Number.parseInt(value, 16) >>> 0
    : undefined;
export const binaryWord = (value?: string | null) => {
  const word = wordValue(value);
  return word == null
    ? undefined
    : word.toString(2).padStart(32, "0").match(/.{8}/g)!.join(" ");
};
export function adderBits(
  a?: string | null,
  b?: string | null,
  subtract = false,
) {
  const left = wordValue(a),
    right = wordValue(b);
  if (left == null || right == null) return undefined;
  let carry = subtract ? 1 : 0;
  return Array.from({ length: 32 }, (_, index) => {
    const a = (left >>> index) & 1,
      originalB = (right >>> index) & 1,
      b = subtract ? originalB ^ 1 : originalB;
    const carryIn = carry,
      sum = a ^ b ^ carryIn;
    carry = (a & b) | (carryIn & (a ^ b));
    return { index, a, originalB, b, carryIn, sum, carryOut: carry };
  });
}

export function aluLesson(flow: Flow) {
  const op = flow.op;
  if (flow.system)
    return {
      category: "environment",
      unit: "실행 환경",
      operator: "요청",
      formula: "ECALL → 실행 환경 서비스",
      steps: [
        "ECALL은 덧셈이나 메모리 읽기로 설명하지 않습니다. 실행 환경이 요청을 처리합니다.",
      ],
    };
  if (op === "lui")
    return {
      category: "pass",
      unit: "상위 즉치값 전달",
      operator: "전달",
      formula: "imm[31:12] 뒤에 0을 12개 연결",
      steps: [
        "명령어의 상위 즉치값 필드를 결과의 상위 20비트에 놓습니다.",
        "하위 12비트는 0입니다. 일반적인 두 입력 덧셈이 아닙니다.",
      ],
    };
  if (op === "jal" || op === "jalr")
    return {
      category: "pc-target",
      unit: "PC 주소 연산",
      operator: "주소",
      formula: op === "jal" ? "목적지 = PC + imm" : "목적지 = (rs1 + imm) & ~1",
      steps: [
        "목적지 주소 계산과 PC+4 복귀 주소 기록은 서로 다른 동작입니다.",
        "이 화면에서는 주소 계산과 PC 선택을 PC 가산·선택 블록에 묶어 표시합니다.",
        "CORE의 일반 ALU 필드를 점프 목적지로 해석하지 않고, 관찰된 다음 PC를 확인합니다.",
      ],
    };
  if (/^(and|andi|or|ori|xor|xori)$/.test(op)) {
    const operator = op.startsWith("and")
      ? "AND"
      : op.startsWith("xor")
        ? "XOR"
        : "OR";
    return {
      category: "logic",
      unit: "비트 논리 회로",
      operator,
      formula: `A ${operator} B`,
      steps: [
        `32개 비트 자리마다 ${operator} 논리 연산을 수행합니다.`,
        operator === "AND"
          ? "두 비트가 모두 1일 때만 결과가 1입니다."
          : operator === "OR"
            ? "두 비트 중 하나 이상이 1이면 결과가 1입니다."
            : "두 비트가 서로 다를 때 결과가 1입니다.",
        "CU의 연산 선택 신호가 해당 논리 회로의 결과를 선택합니다.",
      ],
    };
  }
  if (/^(sll|slli|srl|srli|sra|srai)$/.test(op)) {
    const arithmetic = op.startsWith("sra"),
      left = op.startsWith("sll");
    return {
      category: "shift",
      unit: "시프터",
      operator: left ? "<<" : arithmetic ? ">>" : ">>>",
      formula: `A ${left ? "<<" : arithmetic ? ">>" : ">>>"} (이동 크기 & 31)`,
      steps: [
        `이동 크기는 ${flow.usesImmediate ? "명령어의 shamt" : "rs2의 하위 5비트"}로 정합니다.`,
        left
          ? "왼쪽으로 밀고 오른쪽 빈자리는 0으로 채웁니다."
          : arithmetic
            ? "오른쪽으로 밀고 왼쪽 빈자리는 원래 최상위 비트로 채워 부호를 유지합니다."
            : "오른쪽으로 밀고 왼쪽 빈자리는 0으로 채웁니다.",
        "배럴 시프터 예에서는 1·2·4·8·16비트 이동을 선택하는 MUX들을 조합합니다.",
      ],
    };
  }
  if (flow.branch || /^(slt|slti|sltu|sltiu)$/.test(op)) {
    const unsigned = op.endsWith("u"),
      symbol =
        op === "beq"
          ? "="
          : op === "bne"
            ? "≠"
            : op.startsWith("bge")
              ? "≥"
              : "<";
    return {
      category: "compare",
      unit: "비교 회로",
      operator: symbol,
      formula: `A ${symbol} B · ${op === "beq" || op === "bne" ? "비트 패턴" : unsigned ? "부호 없는 정수" : "부호 있는 정수"}`,
      steps: [
        op === "beq" || op === "bne"
          ? "같은 비트 패턴인지 비교합니다. 부호 해석은 동등 비교에 영향을 주지 않습니다."
          : `같은 32비트라도 ${unsigned ? "0~4294967295의 부호 없는 값" : "-2147483648~2147483647의 부호 있는 값"}으로 해석해 비교합니다.`,
        flow.branch
          ? "비교 결과는 분기 제어로 전달됩니다. 레지스터에 계산 결과를 기록하지 않습니다."
          : "조건이 참이면 1, 거짓이면 0을 목적 레지스터에 기록합니다.",
      ],
    };
  }
  if (/^(mul|mulh|mulhsu|mulhu|div|divu|rem|remu)$/.test(op))
    return {
      category: "multiply-divide",
      unit: "곱셈·나눗셈",
      operator: op.toUpperCase(),
      formula: op.toUpperCase(),
      steps: [
        "M 확장의 연산입니다. 곱의 상위/하위 비트, 몫 또는 나머지 선택은 명령어에 따라 다릅니다.",
        "구현에 따라 별도 연산기를 사용할 수 있습니다. 여기서는 CORE가 보고한 입력과 결과를 보여주며 내부 게이트 동작을 추정하지 않습니다.",
      ],
    };
  if (
    op === "sub" ||
    flow.load ||
    flow.store ||
    /^(add|addi|auipc|jal|jalr)$/.test(op)
  ) {
    const subtract = op === "sub";
    return {
      category: "adder",
      unit: subtract ? "뺄셈 가산기" : "덧셈 가산기",
      operator: subtract ? "−" : "+",
      formula: subtract ? "A − B = A + (~B) + 1" : "A + B → 하위 32비트",
      steps: [
        flow.load || flow.store
          ? "레지스터의 기준 주소와 즉치값을 더해 메모리 접근 주소를 계산합니다."
          : subtract
            ? "B의 각 비트를 뒤집고 첫 자리의 올림 입력을 1로 두어 같은 가산기로 뺄셈을 수행할 수 있습니다."
            : "CU가 가산 경로를 선택하고 두 입력을 더합니다.",
        "전가산기 한 개는 A 한 비트, B 한 비트, 아래 자리에서 온 올림을 받아 합과 다음 올림을 만듭니다.",
        "학습용 리플 캐리 예에서는 올림이 낮은 자리에서 높은 자리로 전달됩니다.",
        "32비트 결과에는 하위 32비트만 남깁니다. 최상위 자리 밖의 올림과 부호 있는 오버플로는 서로 다른 개념입니다.",
      ],
    };
  }
  return {
    category: "other",
    unit: "명령어별 연산 제어",
    operator: op.toUpperCase(),
    formula: op.toUpperCase(),
    steps: [
      "이 명령어를 일반 덧셈으로 단정하지 않습니다. 제공된 실행값과 명령어 해설을 확인하세요.",
    ],
  };
}
