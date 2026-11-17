import type { TutorBundle } from "@/pages/Main/utils/tutorAnalysis";
export interface StageBuffer {
  pc?: string;
  raw_instruction?: string;
  assembly: string;
  status: string; // "normal" | "empty" | "bubble" | "stall" | "flush"
  stage?: string;
  source_line?: number | null;
  flush_info?: {
    is_flushed: boolean;
    reason: string | null;
  };
}

export interface CycleEvents {
  stall: {
    has_stall: boolean;
    stage: string | null;
    assembly: string | null;
    stall_reason: string | null;
    stall_desc: string | null;
  };
  forwarding: {
    has_forwarded: boolean;
    stage: string | null;
    assembly: string | null;
    forwarded_operand_count: number;
    forwarding_info: {
      has_forwarded: boolean;
      forwarded_from: string[];
      forwarded_to: string[];
      target_register: string[];
      forwarded_value: string[];
    };
    forwarding_desc: string | null;
  };
  control_hazard: {
    has_control_instruction: boolean;
    has_flush: boolean;
    stage: string | null;
    assembly: string | null;
    taken: boolean | null;
    target_pc: string | null;
    fallthrough_pc: string | null;
    flushed_stages: string[];
    flush_reason: string | null;
    redirect_pc: string | null;
  };
  runtime_error: {
    has_error: boolean;
    code: string | null;
    stage: string | null;
    assembly: string | null;
    message: string | null;
    reason: string | null;
  };
}

export interface GlobalResult {
  current_pc: string;
  registers: Record<string, string>;
  memory_snapshot: Record<string, string>;
  console_output: string;
  active_stack_pointer?: string;
  metrics: {
    accumulated_instructions: number;
    accumulated_stalls: number;
    accumulated_forwards: number;
  };
}

export interface SingleCycleControlSignals {
  reg_write: boolean;
  alu_src: "reg" | "imm";
  alu_op: string;
  mem_read: boolean;
  mem_write: boolean;
  mem_to_reg: "mem" | "alu" | "pc+4";
  branch: boolean;
  jump: boolean;
  pc_src: "pc+4" | "branch/jump";
}

export interface SingleCycleRegisterSignal {
  index: number;
  name: string;
  value: string;
}

export interface SingleCycleDatapath {
  pc: string;
  next_pc: string;
  pc_plus_4: string;
  instruction: {
    raw: string;
    assembly: string;
    opcode: string;
    funct3: string | null;
    funct7: string | null;
  };
  control_signals: SingleCycleControlSignals;
  registers: {
    rs1: SingleCycleRegisterSignal | null;
    rs2: SingleCycleRegisterSignal | null;
    rd: SingleCycleRegisterSignal | null;
  };
  immediate: {
    raw: number;
    hex: string;
    decimal: number;
  } | null;
  alu: {
    input_1: string;
    input_2: string;
    result: string;
    zero: boolean;
  };
  data_memory: {
    read_address: string | null;
    read_data: string | null;
    write_address: string | null;
    write_data: string | null;
  };
}

export interface RuntimeStartupLayout {
  name: string;
  start: string;
  end: string;
  end_exclusive: string;
  instruction_count: number;
}

export interface UserProgramLayout {
  name: string;
  start: string;
  end: string;
  end_exclusive: string;
  instruction_count: number;
  entry_point: string;
}

export interface CodeSegmentLayout {
  name: string;
  start: string;
  end_exclusive: string;
  size_bytes: number;
  runtime_startup: RuntimeStartupLayout;
  user_program: UserProgramLayout;
}

export interface ProgramMemoryLayout {
  stack: {
    name: string;
    base: string;
    limit: string;
    growth: "down";
  };
  heap: {
    name: string;
    base: string;
    limit: string;
    growth: "up";
  };
  bss: {
    name: string;
    start: string;
    end_exclusive: string;
    size_bytes: number;
  };
  data: {
    name: string;
    start: string;
    end_exclusive: string;
    size_bytes: number;
  };
  code: CodeSegmentLayout;
  reserved: {
    name: string;
    start: string;
    end_exclusive: string;
    size_bytes: number;
    desc?: string;
  };
  boundary_dividers: string[];
}

export interface CycleHistoryItem {
  clock: number;
  buffers: {
    IF: StageBuffer | null;
    ID: StageBuffer | null;
    EX: StageBuffer | null;
    MEM: StageBuffer | null;
    WB: StageBuffer | null;
  };
  if_stage?: StageBuffer;
  id_stage?: StageBuffer;
  ex_stage?: StageBuffer;
  mem_stage?: StageBuffer;
  wb_stage?: StageBuffer;
  stage_activity?: {
    IF: StageBuffer;
    ID: StageBuffer;
    EX: StageBuffer;
    MEM: StageBuffer;
    WB: StageBuffer;
  };
  datapath?: SingleCycleDatapath;
  cycle_events: CycleEvents;
  global_result: GlobalResult;
}

export interface SimulationRunRequest {
  build_id?: string;
  simulation_token?: string;
  mode?: string;
  max_cycles?: number;
}

export interface SimulationResult {
  tutor?: TutorBundle;
  schema_version: string;
  simulator: {
    mode: string;
    max_cycles: number;
    pipeline_model: string;
  };
  program: {
    entry_point: string;
    instruction_words: number;
    data_words: number;
    code_mapping?: Record<
      string,
      {
        assembly: string;
        raw_instruction?: string;
        source_line?: number | null;
      }
    >;
    initial_stack_pointer?: string;
    memory_regions?: Array<{
      name: string;
      start: string;
      end_exclusive: string;
      kind: string;
    }>;
    memory_layout?: ProgramMemoryLayout;
  };
  status: string;
  summary: {
    total_cycles: number;
    instructions_executed: number;
    data_hazards: number;
    control_hazards: number;
    stalls: number;
    forwards: number;
    executed_cycles: number;
  };
  history: CycleHistoryItem[];
}
