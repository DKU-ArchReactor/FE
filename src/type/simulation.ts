export interface StageBuffer {
  pc?: string;
  raw_instruction?: string;
  assembly: string;
  status: string; // "normal" | "empty" | "bubble" | "stall" | "flush"
  stage?: string;
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
  metrics: {
    accumulated_instructions: number;
    accumulated_stalls: number;
    accumulated_forwards: number;
  };
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
  cycle_events: CycleEvents;
  global_result: GlobalResult;
}

export interface SimulationResult {
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
