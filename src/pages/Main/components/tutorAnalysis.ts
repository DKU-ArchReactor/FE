// ========================================================
// C 언어 구문 및 RISC-V 어셈블리 교육용 시맨틱 분석 엔진
// ========================================================

export interface CLineExplanation {
  type: string;
  badgeColor: string;
  summary: string;
  detail: string;
}

export interface AsmInstructionExplanation {
  opcode: string;
  operands: string;
  action: string;
  explanation: string;
  hardwareDetail: string;
}

// --------------------------------------------------------
// 1. C 소스 코드 라인 구문 분석 함수
// --------------------------------------------------------
export function analyzeCLine(rawLine: string, lineNumber: number): CLineExplanation {
  const line = rawLine.trim();

  // 1) 빈 줄
  if (!line) {
    return {
      type: "빈 줄 (Empty)",
      badgeColor: "bg-slate-100 text-slate-500",
      summary: "내용이 없는 공백 라인입니다.",
      detail: "컴파일러가 기계어 코드를 생성하지 않고 건너뜁니다.",
    };
  }

  // 2) 주석
  if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) {
    return {
      type: "주석 (Comment)",
      badgeColor: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      summary: "개발자를 위한 설명용 주석입니다.",
      detail: "어셈블리 코드로 번역되지 않으며 하드웨어 실행에 영향을 미치지 않습니다.",
    };
  }

  // 3) 전처리기 지시문 (#include, #define 등)
  if (line.startsWith("#")) {
    return {
      type: "전처리기 (Preprocessor)",
      badgeColor: "bg-purple-50 text-purple-700 border border-purple-200",
      summary: "컴파일 전 소스 코드를 가공하는 지시문입니다.",
      detail: line.includes("include")
        ? "헤더 파일의 함수 선언 및 매크로 정의를 현재 소스에 삽입합니다."
        : "매크로 상수나 컴파일 조건을 정의합니다.",
    };
  }

  // 4) 함수 정의 시작 (예: int main(), void test(int x))
  if (/\b(int|void|char|float|double|long|short)\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*\{?/.test(line)) {
    const fnMatch = line.match(/\b(?:int|void|char|float|double|long|short)\s+([a-zA-Z_]\w*)/);
    const fnName = fnMatch ? fnMatch[1] : "함수";
    return {
      type: "함수 정의 (Function Prologue)",
      badgeColor: "bg-indigo-50 text-indigo-700 border border-indigo-200",
      summary: `'${fnName}' 함수의 시작 지점입니다.`,
      detail: "스택 포인터(sp)를 내려 현재 함수의 전용 스택 프레임을 확보하고, 이전 프레임 포인터(s0) 및 반환 주소(ra)를 안전하게 백업합니다.",
    };
  }

  // 5) 함수 반환문 (return ...)
  if (line.startsWith("return")) {
    const returnVal = line.replace(/return\s*;?/, "").replace(/;/, "").trim();
    return {
      type: "반환문 (Function Epilogue)",
      badgeColor: "bg-rose-50 text-rose-700 border border-rose-200",
      summary: returnVal ? `값(${returnVal})을 호출자에게 반환하고 함수를 종료합니다.` : "함수 실행을 종료하고 호출자로 복귀합니다.",
      detail: "반환값을 표준 반환 레지스터(a0)에 저장한 후, 백업했던 레지스터들을 복원하고 스택을 원상태로 돌린 뒤 ret(jr ra) 명령어로 복귀합니다.",
    };
  }

  // 6) 조건 분기문 (if, else if, else, switch)
  if (/^if\s*\(/.test(line)) {
    const cond = line.match(/\((.*)\)/)?.[1] || "조건식";
    return {
      type: "조건문 (Branch / If)",
      badgeColor: "bg-amber-50 text-amber-800 border border-amber-200",
      summary: `조건 '${cond}'의 참/거짓 여부를 평가합니다.`,
      detail: "비교 대상 변수들을 레지스터로 로드한 뒤 비교 연산을 거쳐, 조건이 불만족스러울 경우 해당 블록을 건너뛰는 조건 점프 어셈블리로 번역됩니다.",
    };
  }
  if (/^else\s+if\s*\(/.test(line)) {
    return {
      type: "다중 조건문 (Else If)",
      badgeColor: "bg-amber-50 text-amber-800 border border-amber-200",
      summary: "이전 조건이 거짓일 때 새로운 조건을 추가 평가합니다.",
      detail: "이전 분기가 실행되지 않았을 때만 진입하여 비교 연산을 수행합니다.",
    };
  }
  if (/^else\b/.test(line)) {
    return {
      type: "대체 분기 (Else)",
      badgeColor: "bg-amber-50 text-amber-800 border border-amber-200",
      summary: "앞선 모든 조건이 거짓일 때 실행되는 기본 분기입니다.",
      detail: "앞선 if 조건이 만족되어 실행된 경우에는 이 블록을 건너뛰도록 무조건 점프(j)가 수행됩니다.",
    };
  }

  // 7) 반복문 (for, while, do while)
  if (/^for\s*\(/.test(line)) {
    return {
      type: "반복문 (For Loop)",
      badgeColor: "bg-sky-50 text-sky-800 border border-sky-200",
      summary: "초기화, 조건 검사, 증감식을 포함하는 반복 실행 블록입니다.",
      detail: "루프 시작 전 초기값을 스택에 저장하고, 매 반복마다 조건을 평가하여 만족하지 않으면 루프 종료 레이블로 분기(bne/bge 등)합니다.",
    };
  }
  if (/^while\s*\(/.test(line)) {
    return {
      type: "반복문 (While Loop)",
      badgeColor: "bg-sky-50 text-sky-800 border border-sky-200",
      summary: "조건이 참인 동안 내부 코드를 계속 반복 실행합니다.",
      detail: "조건식을 레지스터에 로드하여 평가한 뒤, 조건이 충족되지 않으면 반복문 끝으로 점프합니다.",
    };
  }

  // 8) 변수 선언 및 초기화 (예: int a = 10;, float pi = 3.14;)
  if (/\b(int|char|short|long|float|double|unsigned)\s+[a-zA-Z_]\w*\s*=\s*[^;]+;/.test(line)) {
    const varMatch = line.match(/\b(?:int|char|short|long|float|double|unsigned)\s+([a-zA-Z_]\w*)\s*=\s*([^;]+);/);
    const varName = varMatch ? varMatch[1] : "변수";
    const initVal = varMatch ? varMatch[2].trim() : "";
    return {
      type: "변수 초기화 (Var Declaration & Init)",
      badgeColor: "bg-blue-50 text-blue-700 border border-blue-200",
      summary: `지역 변수 '${varName}'에 초기값 '${initVal}'을 할당합니다.`,
      detail: "상수 값을 레지스터(li)에 올리거나 연산한 뒤, 해당 변수에 할당된 스택 메모리 오프셋 위치(sw/sb/sh)에 값을 기록합니다.",
    };
  }

  // 9) 순수 변수 선언 (예: int a;, int sum;)
  if (/\b(int|char|short|long|float|double|unsigned)\s+[a-zA-Z_]\w*\s*;/.test(line)) {
    return {
      type: "변수 선언 (Var Declaration)",
      badgeColor: "bg-blue-50 text-blue-700 border border-blue-200",
      summary: "지역 변수를 위한 스택 메모리 공간을 예약합니다.",
      detail: "초기화하지 않았으므로 별도의 store 명령어 없이 스택 오프셋 주소만 컴파일러 심볼 테이블에 등록됩니다.",
    };
  }

  // 10) 대입 및 산술/논리 연산식 (예: sum = a + b;, count++;)
  if (/^[a-zA-Z_]\w*\s*(\+=|-=|\*=|\/=|%=|=)/.test(line) || /^[a-zA-Z_]\w*(\+\+|--);/.test(line)) {
    return {
      type: "산술/대입 연산 (Assignment & Arithmetic)",
      badgeColor: "bg-teal-50 text-teal-800 border border-teal-200",
      summary: "변수들의 값을 계산하여 목적지 변수에 저장합니다.",
      detail: "메모리(스택)에서 피연산자 변수들을 레지스터로 로드(lw)한 뒤, ALU 연산(add/sub 등)을 거쳐 최종 결과를 다시 메모리(sw)에 갱신합니다.",
    };
  }

  // 11) 함수 호출 (예: printf(...), calculate(a, b);)
  if (/[a-zA-Z_]\w*\s*\(.*\)\s*;/.test(line)) {
    const fnName = line.match(/([a-zA-Z_]\w*)\s*\(/)?.[1] || "함수";
    return {
      type: "함수 호출 (Function Call)",
      badgeColor: "bg-violet-50 text-violet-700 border border-violet-200",
      summary: `'${fnName}' 함수를 호출하고 실행 흐름을 해당 함수로 이동합니다.`,
      detail: "전달할 인자값들을 인자 전달 레지스터(a0~a7)에 배치한 후, call(jal ra, func) 명령어로 복귀 주소를 ra에 기록하며 점프합니다.",
    };
  }

  // 12) 블록 괄호 단독 라인
  if (line === "{" || line === "}") {
    return {
      type: "코드 블록 경계 (Scope Bracket)",
      badgeColor: "bg-slate-50 text-slate-600 border border-slate-200",
      summary: line === "{" ? "새로운 로컬 스코프(블록)의 시작입니다." : "로컬 스코프(블록)의 종료입니다.",
      detail: line === "}" ? "함수의 닫는 괄호인 경우 스택 프레임을 정리하고 호출자로 복귀하는 에필로그 코드가 배치됩니다." : "새로운 영역이 열립니다.",
    };
  }

  // 기타 일반 구문
  return {
    type: "C 실행 구문 (Statement)",
    badgeColor: "bg-slate-100 text-slate-700 border border-slate-200",
    summary: `${lineNumber}번째 라인의 C 소스 코드입니다.`,
    detail: "C 컴파일러가 해당 구문의 동작을 RISC-V 어셈블리 명령어들의 조합으로 변환하여 실행합니다.",
  };
}

// --------------------------------------------------------
// 2. RISC-V 어셈블리 명령어 분석 함수
// --------------------------------------------------------
export function analyzeAsmInstruction(text: string): AsmInstructionExplanation {
  const trimmed = text.trim();
  const firstSpace = trimmed.search(/\s/);
  const opcode = firstSpace === -1 ? trimmed.toLowerCase() : trimmed.slice(0, firstSpace).toLowerCase();
  const rawOperands = firstSpace === -1 ? "" : trimmed.slice(firstSpace).trim();
  const operands = rawOperands.replace(/,([^\s])/g, ", $1");

  // 레이블
  if (trimmed.endsWith(":")) {
    return {
      opcode: trimmed,
      operands: "",
      action: "분기/함수 레이블",
      explanation: `코드의 특정 주소를 나타내는 이름표(${trimmed})입니다.`,
      hardwareDetail: "기계어 명령어가 아니며 점프 명령어의 목적지 주소를 식별하기 위한 기호입니다.",
    };
  }

  // 디렉티브 (.text, .globl 등)
  if (trimmed.startsWith(".")) {
    return {
      opcode: trimmed,
      operands: "",
      action: "어셈블러 지시어",
      explanation: "컴파일러/링커에게 섹션 배치나 전역 심볼 공개 등을 지시합니다.",
      hardwareDetail: "CPU가 직접 실행하지 않고 링커가 바이너리를 생성할 때 참조합니다.",
    };
  }

  const parts = operands.split(/[\s,]+/).filter(Boolean);

  switch (opcode) {
    case "lw": {
      // lw rd, offset(rs1)
      const rd = parts[0] || "rd";
      const mem = parts[1] || "offset(rs1)";
      return {
        opcode,
        operands,
        action: `메모리 로드: ${mem} ➔ ${rd}`,
        explanation: `스택 메모리 주소(${mem})에 저장된 32비트 워드(변수) 값을 레지스터 ${rd}로 읽어옵니다.`,
        hardwareDetail: "MEM 단계에서 데이터 메모리를 읽어 WB 단계에서 레지스터 파일에 기록합니다.",
      };
    }
    case "sw": {
      // sw rs2, offset(rs1)
      const rs2 = parts[0] || "rs2";
      const mem = parts[1] || "offset(rs1)";
      return {
        opcode,
        operands,
        action: `메모리 저장: ${rs2} ➔ ${mem}`,
        explanation: `레지스터 ${rs2}에 계산된 결과값을 스택 메모리 위치(${mem})의 변수 저장 공간에 기록합니다.`,
        hardwareDetail: "EX 단계에서 계산된 유효 주소에 맞춰 MEM 단계에서 데이터 메모리에 값을 씁니다.",
      };
    }
    case "add": {
      const [rd, rs1, rs2] = parts;
      return {
        opcode,
        operands,
        action: `덧셈 연산: ${rd} = ${rs1} + ${rs2}`,
        explanation: `두 레지스터 ${rs1}과 ${rs2}의 정수 값을 더하여 ${rd}에 저장합니다.`,
        hardwareDetail: "EX 단계의 산술논리연산장치(ALU)가 두 값을 더합니다.",
      };
    }
    case "addi": {
      const [rd, rs1, imm] = parts;
      if (rd === "sp" && rs1 === "sp") {
        const num = parseInt(imm, 10);
        if (num < 0) {
          return {
            opcode,
            operands,
            action: `스택 프레임 생성: sp ${imm} bytes`,
            explanation: `스택 포인터(sp)를 ${Math.abs(num)}바이트 내려 현재 함수의 로컬 스택 공간을 확보합니다.`,
            hardwareDetail: "함수 시작(Prologue) 시 지역 변수와 레지스터 백업을 위한 공간을 마련합니다.",
          };
        } else {
          return {
            opcode,
            operands,
            action: `스택 프레임 해제: sp +${imm} bytes`,
            explanation: `함수 종료 전 스택 포인터(sp)를 ${num}바이트 올려 스택 공간을 호출 전 상태로 복원합니다.`,
            hardwareDetail: "함수 반환(Epilogue) 직전에 수행되는 스택 정리 작업입니다.",
          };
        }
      }
      if (rs1 === "s0" || rs1 === "sp") {
        return {
          opcode,
          operands,
          action: `주소/포인터 계산: ${rd} = ${rs1} + ${imm}`,
          explanation: `기준 포인터(${rs1})에 오프셋(${imm})을 더해 유효 주소를 계산합니다.`,
          hardwareDetail: "프레임 포인터 설정이나 지역 변수 시작 주소 계산에 사용됩니다.",
        };
      }
      return {
        opcode,
        operands,
        action: `즉치 덧셈: ${rd} = ${rs1} + ${imm}`,
        explanation: `레지스터 ${rs1}의 값에 상수 ${imm}을 더하여 ${rd}에 저장합니다.`,
        hardwareDetail: "ALU에서 레지스터 값과 명령어에 포함된 상수(Immediate)를 즉시 연산합니다.",
      };
    }
    case "sub": {
      const [rd, rs1, rs2] = parts;
      return {
        opcode,
        operands,
        action: `뺄셈 연산: ${rd} = ${rs1} - ${rs2}`,
        explanation: `${rs1}에서 ${rs2}를 뺀 결과를 ${rd}에 저장합니다.`,
        hardwareDetail: "EX 단계에서 ALU가 두 레지스터 값의 차를 계산합니다.",
      };
    }
    case "li": {
      const [rd, imm] = parts;
      return {
        opcode,
        operands,
        action: `상수 로드: ${rd} = ${imm}`,
        explanation: `상수값 ${imm}을 레지스터 ${rd}에 즉시 적재(Load Immediate)합니다.`,
        hardwareDetail: "변수 초기화나 리턴값(0 등)을 설정할 때 사용하는 의사 명령어(Pseudo-instruction)입니다.",
      };
    }
    case "mv": {
      const [rd, rs] = parts;
      return {
        opcode,
        operands,
        action: `레지스터 복사: ${rd} = ${rs}`,
        explanation: `레지스터 ${rs}의 값을 레지스터 ${rd}로 복사합니다.`,
        hardwareDetail: "실제 하드웨어에서는 addi rd, rs, 0 형태로 실행되는 의사 명령어입니다.",
      };
    }
    case "mul": {
      const [rd, rs1, rs2] = parts;
      return {
        opcode,
        operands,
        action: `곱셈 연산: ${rd} = ${rs1} * ${rs2}`,
        explanation: `${rs1}과 ${rs2}를 곱한 하위 32비트 결과를 ${rd}에 저장합니다.`,
        hardwareDetail: "RV32M 하드웨어 곱셈기 유닛을 사용하여 계산합니다.",
      };
    }
    case "div": {
      const [rd, rs1, rs2] = parts;
      return {
        opcode,
        operands,
        action: `나눗셈 연산: ${rd} = ${rs1} / ${rs2}`,
        explanation: `${rs1}을 ${rs2}로 나눈 몫을 ${rd}에 저장합니다.`,
        hardwareDetail: "RV32M 하드웨어 나눗셈기 유닛을 사용하여 계산합니다.",
      };
    }
    case "rem": {
      const [rd, rs1, rs2] = parts;
      return {
        opcode,
        operands,
        action: `나머지 연산: ${rd} = ${rs1} % ${rs2}`,
        explanation: `${rs1}을 ${rs2}로 나눈 나머지를 ${rd}에 저장합니다.`,
        hardwareDetail: "RV32M 나눗셈기에서 나머지 레지스터 출력을 취합니다.",
      };
    }
    case "beq":
    case "bne":
    case "blt":
    case "bge":
    case "bltu":
    case "bgeu": {
      const [rs1, rs2, label] = parts;
      const opNames: Record<string, string> = {
        beq: "같으면 (==)",
        bne: "다르면 (!=)",
        blt: "작으면 (<)",
        bge: "크거나 같으면 (>=)",
        bltu: "작으면 (unsigned <)",
        bgeu: "크거나 같으면 (unsigned >=)",
      };
      return {
        opcode,
        operands,
        action: `조건 분기: ${rs1}과 ${rs2}가 ${opNames[opcode] || "비교조건"} ➔ ${label} 점프`,
        explanation: `${rs1}과 ${rs2}를 비교하여 조건이 참이면 '${label}' 레이블 위치로 프로그램 카운터(PC)를 변경합니다.`,
        hardwareDetail: "조건이 만족되면 파이프라인의 다음 명령어들을 플러시하고 분기 목적지 주소로 인출(IF)을 시작합니다.",
      };
    }
    case "j":
    case "jal": {
      const target = parts[parts.length - 1] || "target";
      const isCall = opcode === "jal" && (parts[0] === "ra" || parts.length === 1);
      return {
        opcode,
        operands,
        action: isCall ? `함수 호출: ${target}() 점프 (복귀주소 ra 저장)` : `무조건 점프 ➔ ${target}`,
        explanation: isCall
          ? `다음 명령어 주소를 ra 레지스터에 저장하고 '${target}' 함수 주소로 점프합니다.`
          : `'${target}' 레이블 주소로 무조건 실행 흐름을 이동합니다.`,
        hardwareDetail: "PC를 목적지 주소로 즉시 갱신합니다.",
      };
    }
    case "jr":
    case "ret": {
      return {
        opcode,
        operands: operands || "ra",
        action: "함수 복귀: return to caller",
        explanation: "반환 주소 레지스터(ra)에 저장되어 있던 호출자의 위치로 복귀(Return)합니다.",
        hardwareDetail: "jalr x0, 0(ra) 형태로 실행되어 이전 호출자의 다음 실행 주소로 PC를 복원합니다.",
      };
    }
    default:
      return {
        opcode,
        operands,
        action: `RISC-V 명령어 (${opcode})`,
        explanation: `${opcode} ${operands} 명령어를 실행합니다.`,
        hardwareDetail: "프로세서의 해당 명령어 포맷(R/I/S/B/U/J-Type)에 맞추어 디코딩 및 실행됩니다.",
      };
  }
}
