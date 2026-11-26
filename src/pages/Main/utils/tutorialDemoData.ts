import type {
  CycleEvents,
  CycleHistoryItem,
  SimulationResult,
} from "@/type/simulation";
import type { MappedAssemblyRow } from "./translationCompile";
import { type TutorBundle } from "./tutorAnalysis";

const TUTORIAL_HIDE_DATE_KEY = "ar_tutorial_hide_date";

export const TUTORIAL_DEMO_SOURCE =
  "int main(void) {\n    int a = 5;\n    int b = 3;\n    int sum = a + b;\n    return sum;\n}\n";

export function getTodayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function shouldAutoOpenTutorial(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("tutorial") === "1") return true;
  if (params.get("tutorial") === "0") return false;
  if (typeof navigator !== "undefined" && navigator.webdriver) return false;
  try {
    const hiddenDate = localStorage.getItem(TUTORIAL_HIDE_DATE_KEY);
    return hiddenDate !== getTodayDateString();
  } catch {
    return true;
  }
}

export function hideTutorialForToday(): void {
  try {
    localStorage.setItem(TUTORIAL_HIDE_DATE_KEY, getTodayDateString());
  } catch {
    // localStorage 접근 불가 환경 무시
  }
}

interface DemoRow extends MappedAssemblyRow {
  rawInstruction: string;
}

const DEMO_ROWS: DemoRow[] = [
  {
    text: "addi sp, sp, -32",
    sourceLine: 1,
    pc: "0x00010000",
    rawInstruction: "0xfe010113",
  },
  {
    text: "sw s0, 28(sp)",
    sourceLine: 1,
    pc: "0x00010004",
    rawInstruction: "0x00812e23",
  },
  {
    text: "addi s0, sp, 32",
    sourceLine: 1,
    pc: "0x00010008",
    rawInstruction: "0x02010413",
  },
  {
    text: "addi a5, zero, 5",
    sourceLine: 2,
    pc: "0x0001000c",
    rawInstruction: "0x00500793",
  },
  {
    text: "sw a5, -20(s0)",
    sourceLine: 2,
    pc: "0x00010010",
    rawInstruction: "0xfef42623",
  },
  {
    text: "lw a4, -20(s0)",
    sourceLine: 4,
    pc: "0x00010014",
    rawInstruction: "0xfec42703",
  },
  {
    text: "addi a5, zero, 3",
    sourceLine: 3,
    pc: "0x00010018",
    rawInstruction: "0x00300793",
  },
  {
    text: "sw a5, -24(s0)",
    sourceLine: 3,
    pc: "0x0001001c",
    rawInstruction: "0xfef42423",
  },
  {
    text: "add a0, a4, a5",
    sourceLine: 4,
    pc: "0x00010020",
    rawInstruction: "0x00f70533",
  },
];

export const TUTORIAL_DEMO_MAPPED_ROWS: MappedAssemblyRow[] = DEMO_ROWS.map(
  ({ text, sourceLine, pc }) => ({ text, sourceLine, pc }),
);

export const TUTORIAL_DEMO_ASSEMBLY = TUTORIAL_DEMO_MAPPED_ROWS.map(
  (r) => r.text,
).join("\n");

const NO_EVENTS: CycleEvents = {
  stall: {
    has_stall: false,
    stage: null,
    assembly: null,
    stall_reason: null,
    stall_desc: null,
  },
  forwarding: {
    has_forwarded: false,
    stage: null,
    assembly: null,
    forwarded_operand_count: 0,
    forwarding_info: {
      has_forwarded: false,
      forwarded_from: [],
      forwarded_to: [],
      target_register: [],
      forwarded_value: [],
    },
    forwarding_desc: null,
  },
  control_hazard: {
    has_control_instruction: false,
    has_flush: false,
    stage: null,
    assembly: null,
    taken: null,
    target_pc: null,
    fallthrough_pc: null,
    flushed_stages: [],
    flush_reason: null,
    redirect_pc: null,
  },
  runtime_error: {
    has_error: false,
    code: null,
    stage: null,
    assembly: null,
    message: null,
    reason: null,
  },
};

const FORWARD_EVENT_CYCLE_5: CycleEvents = {
  ...NO_EVENTS,
  forwarding: {
    has_forwarded: true,
    stage: "EX",
    assembly: "addi s0, sp, 32",
    forwarded_operand_count: 1,
    forwarding_info: {
      has_forwarded: true,
      forwarded_from: ["MEM/WB"],
      forwarded_to: ["EX"],
      target_register: ["sp"],
      forwarded_value: ["0x7fffffd0"],
    },
    forwarding_desc:
      "WB 단계의 sp(x2 = 0x7fffffd0) 결과를 EX 단계의 피연산자로 포워딩했습니다.",
  },
};

function makeStage(rowIdx: number, stage: string) {
  const row = DEMO_ROWS[rowIdx];
  if (!row) return null;
  return {
    pc: row.pc,
    raw_instruction: row.rawInstruction,
    assembly: row.text,
    status: "normal",
    stage,
    source_line: row.sourceLine,
  };
}

const BASE_REGISTERS: Record<string, string> = Object.fromEntries(
  Array.from({ length: 32 }, (_, i) => [
    `x${i}`,
    i === 2 ? "0x7ffffff0" : "0x00000000",
  ]),
);
const BASE_MEMORY: Record<string, string> = Object.fromEntries(
  DEMO_ROWS.map((row) => [row.pc!, row.rawInstruction]),
);
const hex = (value: number) =>
  `0x${(value >>> 0).toString(16).padStart(8, "0")}`;

// Snapshots describe the end of each clock: writes happen only at MEM/WB.
const DEMO_HISTORY: CycleHistoryItem[] = [];
let registers = { ...BASE_REGISTERS };
let memory = { ...BASE_MEMORY };
let forwards = 0;
for (let clock = 1; clock <= DEMO_ROWS.length + 4; clock++) {
  registers = { ...registers };
  memory = { ...memory };
  const wb = clock - 5;
  const registerWrites: Record<number, [string, number]> = {
    0: ["x2", 0x7fffffd0],
    2: ["x8", 0x7ffffff0],
    3: ["x15", 5],
    5: ["x14", 5],
    6: ["x15", 3],
    8: ["x10", 8],
  };
  if (registerWrites[wb]) {
    const [key, value] = registerWrites[wb];
    registers[key] = hex(value);
  }
  const mem = clock - 4;
  if (mem === 1) memory[hex(0x7fffffec)] = hex(0);
  if (mem === 4) memory[hex(0x7fffffdc)] = hex(5);
  if (mem === 7) memory[hex(0x7fffffd8)] = hex(3);
  const forward =
    clock === 5
      ? FORWARD_EVENT_CYCLE_5
      : clock === 7 || clock === 10 || clock === 11
        ? {
            ...NO_EVENTS,
            forwarding: {
              ...FORWARD_EVENT_CYCLE_5.forwarding,
              assembly: DEMO_ROWS[clock - 3].text,
              forwarded_operand_count: clock === 7 ? 2 : 1,
              forwarding_info: {
                has_forwarded: true,
                forwarded_from:
                  clock === 7
                    ? ["MEM/WB", "EX/MEM"]
                    : [clock === 11 ? "MEM/WB" : "EX/MEM"],
                forwarded_to: clock === 7 ? ["EX", "EX"] : ["EX"],
                target_register: clock === 7 ? ["s0", "a5"] : ["a5"],
                forwarded_value:
                  clock === 7 ? [hex(0x7ffffff0), hex(5)] : [hex(3)],
              },
              forwarding_desc: null,
            },
          }
        : NO_EVENTS;
  if (forward.forwarding.has_forwarded) forwards++;
  DEMO_HISTORY.push({
    clock,
    buffers: {
      IF: makeStage(clock - 1, "IF"),
      ID: makeStage(clock - 2, "ID"),
      EX: makeStage(clock - 3, "EX"),
      MEM: makeStage(clock - 4, "MEM"),
      WB: makeStage(clock - 5, "WB"),
    },
    cycle_events: forward,
    global_result: {
      current_pc: hex(0x10000 + Math.min(clock, DEMO_ROWS.length) * 4),
      registers,
      memory_snapshot: memory,
      console_output: "",
      active_stack_pointer: registers.x2,
      metrics: {
        accumulated_instructions: Math.max(
          0,
          Math.min(DEMO_ROWS.length, clock - 4),
        ),
        accumulated_stalls: 0,
        accumulated_forwards: forwards,
      },
    },
  });
}

const DEMO_TUTOR_BUNDLE: TutorBundle = {
  schema_version: "1.0",
  c_lines: [
    {
      line: 1,
      text: "int main(void) {",
      explanation: {
        kind: "c",
        category: "function",
        title: "함수 프롤로그 (스택 프레임 생성)",
        summary:
          "스택 포인터(sp)를 32바이트 할당하고 프레임 포인터(s0)를 설정합니다.",
        detail:
          "addi sp, sp, -32 · sw s0, 28(sp) · addi s0, sp, 32 명령어로 매핑됩니다.",
      },
    },
    {
      line: 2,
      text: "    int a = 5;",
      explanation: {
        kind: "c",
        category: "assignment",
        title: "지역 변수 a 초기화",
        summary:
          "레지스터 a5에 상수 5를 적재하고 스택 프레임 -20(s0)에 저장합니다.",
        detail:
          "addi a5, zero, 5 실행 후 sw a5, -20(s0)으로 스택 메모리에 기록합니다.",
      },
    },
  ],
  asm_instructions: DEMO_ROWS.map((row) => ({
    text: row.text,
    pc: row.pc,
    source_line: row.sourceLine,
    raw_instruction: row.rawInstruction,
    mapping_status: "mapped",
    observed_in_history: true,
    retire_count: 1,
    explanation: {
      kind: "asm",
      category: "instruction",
      title: "RISC-V 파이프라인 실행 명령어",
      summary: `${row.text} 명령어가 파이프라인 스테이지를 따라 실행 중입니다.`,
      detail:
        "현재 클록에서 레지스터와 데이터패스 신호 흐름을 확인할 수 있습니다.",
      opcode: row.text.split(" ")[0],
      operands: row.text.split(" ").slice(1).join(" "),
      evidence_level: "observed",
    },
  })),
  execution_steps: DEMO_HISTORY.map((frame, index) => {
    const before =
      index === 0
        ? { registers: BASE_REGISTERS, memory_snapshot: BASE_MEMORY }
        : DEMO_HISTORY[index - 1].global_result;
    return {
      history_index: index,
      cycle: frame.clock,
      display_clock: frame.clock,
      retired_pc: frame.buffers.WB?.pc ?? null,
      register_changes: Object.entries(frame.global_result.registers)
        .filter(([key, value]) => before.registers[key] !== value)
        .map(([key, after]) => ({ key, before: before.registers[key], after })),
      memory_changes: Object.entries(frame.global_result.memory_snapshot)
        .filter(([key, value]) => before.memory_snapshot[key] !== value)
        .map(([key, after]) => ({
          key,
          before: before.memory_snapshot[key] ?? null,
          after,
        })),
      memory_transfer: null,
    };
  }),
  cycle_explanations: [
    {
      history_index: 4,
      cycle: 5,
      events: [
        {
          type: "forwarding",
          title: "MEM/WB → EX 데이터 포워딩 활성",
          summary: "sp 레지스터 결과가 EX 단계로 즉시 전달되었습니다.",
          detail:
            "addi sp, sp, -32의 결과(0x7fffffd0)를 스톨 없이 EX 단계의 addi s0, sp, 32에서 사용합니다.",
        },
      ],
    },
  ],
};

export const TUTORIAL_DEMO_CYCLE = 5;
export const TUTORIAL_DEMO_CURRENT_DATA = DEMO_HISTORY[4];
export const TUTORIAL_DEMO_PREV_DATA = DEMO_HISTORY[3];
export const TUTORIAL_DEMO_ACTIVE_ROW = TUTORIAL_DEMO_MAPPED_ROWS[2];

export const TUTORIAL_DEMO_SIMULATION: SimulationResult = {
  execution_status: "COMPLETED",
  schema_version: "1.0",
  tutor: DEMO_TUTOR_BUNDLE,
  simulator: {
    mode: "pipeline",
    max_cycles: 200,
    pipeline_model: "5-stage",
  },
  program: {
    entry_point: "0x00010000",
    instruction_words: DEMO_ROWS.length,
    code_mapping: Object.fromEntries(
      DEMO_ROWS.map((row) => [
        row.pc!,
        {
          assembly: row.text,
          raw_instruction: row.rawInstruction,
          source_line: row.sourceLine,
        },
      ]),
    ),
    data_words: 0,
    initial_stack_pointer: "0x7ffffff0",
  },
  status: "COMPLETED",
  summary: {
    total_cycles: DEMO_HISTORY.length,
    instructions_executed: DEMO_ROWS.length,
    data_hazards: forwards,
    control_hazards: 0,
    stalls: 0,
    forwards,
    executed_cycles: DEMO_HISTORY.length,
  },
  initial_state: { registers: BASE_REGISTERS },
  history: DEMO_HISTORY,
};
