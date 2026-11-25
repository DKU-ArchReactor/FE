import type { CycleEvents, CycleHistoryItem, SimulationResult } from "@/type/simulation";
import type { MappedAssemblyRow } from "./translationCompile";
import { seedTutor, type TutorBundle } from "./tutorAnalysis";

const TUTORIAL_HIDE_DATE_KEY = "ar_tutorial_hide_date";

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
    text: "addi a5, zero, 3",
    sourceLine: 3,
    pc: "0x00010014",
    rawInstruction: "0x00300793",
  },
  {
    text: "sw a5, -24(s0)",
    sourceLine: 3,
    pc: "0x00010018",
    rawInstruction: "0xfef42423",
  },
  {
    text: "add a0, a4, a5",
    sourceLine: 4,
    pc: "0x0001001c",
    rawInstruction: "0x00f70533",
  },
];

export const TUTORIAL_DEMO_MAPPED_ROWS: MappedAssemblyRow[] = DEMO_ROWS.map(
  ({ text, sourceLine, pc }) => ({ text, sourceLine, pc })
);

export const TUTORIAL_DEMO_ASSEMBLY = TUTORIAL_DEMO_MAPPED_ROWS.map(
  (r) => r.text
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
      forwarded_value: ["0x7fffffe0"],
    },
    forwarding_desc: "WB 단계의 sp(x2 = 0x7fffffe0) 결과를 EX 단계의 피연산자로 포워딩했습니다.",
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

const BASE_REGISTERS: Record<string, string> = {
  x0: "0x00000000",
  x1: "0x00010000",
  x2: "0x7ffffff0",
  x8: "0x00000000",
  x10: "0x00000000",
  x14: "0x00000005",
  x15: "0x00000003",
};

const BASE_MEMORY: Record<string, string> = {
  "0x00010000": "0xfe010113",
  "0x00010004": "0x00812e23",
  "0x00010008": "0x02010413",
  "0x0001000c": "0x00500793",
  "0x7fffffdc": "0x00000000",
  "0x7fffffe8": "0x00000003",
  "0x7fffffec": "0x00000005",
};

const DEMO_HISTORY: CycleHistoryItem[] = [
  {
    clock: 1,
    buffers: { IF: makeStage(0, "IF"), ID: null, EX: null, MEM: null, WB: null },
    cycle_events: NO_EVENTS,
    global_result: {
      current_pc: "0x00010000",
      registers: { ...BASE_REGISTERS },
      memory_snapshot: { ...BASE_MEMORY },
      console_output: "",
      active_stack_pointer: "0x7ffffff0",
      metrics: { accumulated_instructions: 0, accumulated_stalls: 0, accumulated_forwards: 0 },
    },
  },
  {
    clock: 2,
    buffers: { IF: makeStage(1, "IF"), ID: makeStage(0, "ID"), EX: null, MEM: null, WB: null },
    cycle_events: NO_EVENTS,
    global_result: {
      current_pc: "0x00010004",
      registers: { ...BASE_REGISTERS },
      memory_snapshot: { ...BASE_MEMORY },
      console_output: "",
      active_stack_pointer: "0x7ffffff0",
      metrics: { accumulated_instructions: 0, accumulated_stalls: 0, accumulated_forwards: 0 },
    },
  },
  {
    clock: 3,
    buffers: {
      IF: makeStage(2, "IF"),
      ID: makeStage(1, "ID"),
      EX: makeStage(0, "EX"),
      MEM: null,
      WB: null,
    },
    cycle_events: NO_EVENTS,
    global_result: {
      current_pc: "0x00010008",
      registers: { ...BASE_REGISTERS },
      memory_snapshot: { ...BASE_MEMORY },
      console_output: "",
      active_stack_pointer: "0x7ffffff0",
      metrics: { accumulated_instructions: 0, accumulated_stalls: 0, accumulated_forwards: 0 },
    },
  },
  {
    clock: 4,
    buffers: {
      IF: makeStage(3, "IF"),
      ID: makeStage(2, "ID"),
      EX: makeStage(1, "EX"),
      MEM: makeStage(0, "MEM"),
      WB: null,
    },
    cycle_events: NO_EVENTS,
    global_result: {
      current_pc: "0x0001000c",
      registers: { ...BASE_REGISTERS },
      memory_snapshot: { ...BASE_MEMORY },
      console_output: "",
      active_stack_pointer: "0x7ffffff0",
      metrics: { accumulated_instructions: 0, accumulated_stalls: 0, accumulated_forwards: 1 },
    },
  },
  {
    clock: 5,
    buffers: {
      IF: makeStage(4, "IF"),
      ID: makeStage(3, "ID"),
      EX: makeStage(2, "EX"),
      MEM: makeStage(1, "MEM"),
      WB: makeStage(0, "WB"),
    },
    cycle_events: FORWARD_EVENT_CYCLE_5,
    global_result: {
      current_pc: "0x00010010",
      registers: {
        ...BASE_REGISTERS,
        x2: "0x7fffffe0",
        x8: "0x7ffffff0",
        x10: "0x00000008",
        x15: "0x00000005",
      },
      memory_snapshot: {
        ...BASE_MEMORY,
        "0x7fffffdc": "0x00000000",
      },
      console_output: "",
      active_stack_pointer: "0x7fffffe0",
      metrics: { accumulated_instructions: 3, accumulated_stalls: 0, accumulated_forwards: 2 },
    },
  },
  {
    clock: 6,
    buffers: {
      IF: makeStage(5, "IF"),
      ID: makeStage(4, "ID"),
      EX: makeStage(3, "EX"),
      MEM: makeStage(2, "MEM"),
      WB: makeStage(1, "WB"),
    },
    cycle_events: NO_EVENTS,
    global_result: {
      current_pc: "0x00010014",
      registers: {
        ...BASE_REGISTERS,
        x2: "0x7fffffe0",
        x8: "0x7ffffff0",
        x10: "0x00000008",
        x15: "0x00000005",
      },
      memory_snapshot: { ...BASE_MEMORY },
      console_output: "",
      active_stack_pointer: "0x7fffffe0",
      metrics: { accumulated_instructions: 4, accumulated_stalls: 0, accumulated_forwards: 2 },
    },
  },
  {
    clock: 7,
    buffers: {
      IF: makeStage(6, "IF"),
      ID: makeStage(5, "ID"),
      EX: makeStage(4, "EX"),
      MEM: makeStage(3, "MEM"),
      WB: makeStage(2, "WB"),
    },
    cycle_events: NO_EVENTS,
    global_result: {
      current_pc: "0x00010018",
      registers: {
        ...BASE_REGISTERS,
        x2: "0x7fffffe0",
        x8: "0x7ffffff0",
        x10: "0x00000008",
        x15: "0x00000005",
      },
      memory_snapshot: { ...BASE_MEMORY },
      console_output: "",
      active_stack_pointer: "0x7fffffe0",
      metrics: { accumulated_instructions: 5, accumulated_stalls: 0, accumulated_forwards: 2 },
    },
  },
  {
    clock: 8,
    buffers: {
      IF: makeStage(7, "IF"),
      ID: makeStage(6, "ID"),
      EX: makeStage(5, "EX"),
      MEM: makeStage(4, "MEM"),
      WB: makeStage(3, "WB"),
    },
    cycle_events: NO_EVENTS,
    global_result: {
      current_pc: "0x0001001c",
      registers: {
        ...BASE_REGISTERS,
        x2: "0x7fffffe0",
        x8: "0x7ffffff0",
        x10: "0x00000008",
        x15: "0x00000003",
      },
      memory_snapshot: { ...BASE_MEMORY },
      console_output: "",
      active_stack_pointer: "0x7fffffe0",
      metrics: { accumulated_instructions: 6, accumulated_stalls: 0, accumulated_forwards: 2 },
    },
  },
];

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
        summary: "스택 포인터(sp)를 32바이트 할당하고 프레임 포인터(s0)를 설정합니다.",
        detail: "addi sp, sp, -32 · sw s0, 28(sp) · addi s0, sp, 32 명령어로 매핑됩니다.",
      },
    },
    {
      line: 2,
      text: "    int a = 5;",
      explanation: {
        kind: "c",
        category: "assignment",
        title: "지역 변수 a 초기화",
        summary: "레지스터 a5에 상수 5를 적재하고 스택 프레임 -20(s0)에 저장합니다.",
        detail: "addi a5, zero, 5 실행 후 sw a5, -20(s0)으로 스택 메모리에 기록합니다.",
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
      detail: "현재 클록에서 레지스터와 데이터패스 신호 흐름을 확인할 수 있습니다.",
      opcode: row.text.split(" ")[0],
      operands: row.text.split(" ").slice(1).join(" "),
      evidence_level: "observed",
    },
  })),
  execution_steps: [
    {
      history_index: 4,
      cycle: 5,
      display_clock: 5,
      retired_pc: "0x00010000",
      register_changes: [
        { key: "x2", before: "0x7ffffff0", after: "0x7fffffe0" },
        { key: "x8", before: "0x00000000", after: "0x7ffffff0" },
        { key: "x15", before: "0x00000003", after: "0x00000005" },
      ],
      memory_changes: [],
      memory_transfer: null,
      instruction_observations: [
        {
          pc: "0x00010008",
          stage: "EX",
          summary: "WB 단계의 sp 값을 포워딩받아 프레임 포인터(s0 = sp + 32)를 계산합니다.",
          kind: "value",
        },
      ],
    },
  ],
  cycle_explanations: [
    {
      history_index: 4,
      cycle: 5,
      events: [
        {
          type: "forwarding",
          title: "MEM/WB → EX 데이터 포워딩 활성",
          summary: "sp 레지스터 결과가 EX 단계로 즉시 전달되었습니다.",
          detail: "addi sp, sp, -32의 결과(0x7fffffe0)를 스톨 없이 EX 단계의 addi s0, sp, 32에서 사용합니다.",
        },
      ],
    },
  ],
};

seedTutor(DEMO_TUTOR_BUNDLE);

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
    instruction_words: 8,
    data_words: 0,
    initial_stack_pointer: "0x7ffffff0",
  },
  status: "COMPLETED",
  summary: {
    total_cycles: 8,
    instructions_executed: 6,
    data_hazards: 1,
    control_hazards: 0,
    stalls: 0,
    forwards: 2,
    executed_cycles: 8,
  },
  history: DEMO_HISTORY,
};
