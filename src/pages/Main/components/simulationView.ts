import type { CycleHistoryItem, SimulationResult } from "../../../type/simulation";

export type SimulationMode = "single" | "pipeline";
export type SimulationResults = Partial<Record<SimulationMode, SimulationResult>>;
export interface SimulationBundle {
  results: SimulationResults;
  errors: Partial<Record<SimulationMode, string>>;
}

export function assertSimulationResult(value: unknown, mode: SimulationMode): asserts value is SimulationResult {
  const result = value as SimulationResult | null;
  if (!result || !Array.isArray(result.history) || result.simulator?.mode !== mode || !result.summary) {
    throw new Error("시뮬레이션 응답의 형식 또는 실행 모드가 올바르지 않습니다.");
  }
  if (result.summary.total_cycles !== result.history.length || result.summary.executed_cycles !== result.history.length) {
    throw new Error("실행 클록 수와 이력 개수가 일치하지 않습니다.");
  }
  if (![result.summary.instructions_executed, result.summary.stalls, result.summary.forwards].every(value => Number.isInteger(value) && value >= 0) ||
    result.summary.instructions_executed > result.history.length) {
    throw new Error("실행 통계의 값이 올바르지 않습니다.");
  }
  for (const [index, cycle] of result.history.entries()) {
    if (cycle.clock !== index || !cycle.global_result?.registers || !cycle.stage_activity || !cycle.cycle_events ||
      ["IF", "ID", "EX", "MEM", "WB"].some(stage => !cycle.stage_activity?.[stage as keyof typeof cycle.stage_activity])) {
      throw new Error("실행 이력의 클록 또는 상태 정보가 올바르지 않습니다.");
    }
  }
  const metrics = result.history.at(-1)?.global_result.metrics;
  if (metrics && (metrics.accumulated_instructions !== result.summary.instructions_executed ||
    metrics.accumulated_stalls !== result.summary.stalls || metrics.accumulated_forwards !== result.summary.forwards)) {
    throw new Error("마지막 클록의 누적 통계와 전체 결과가 일치하지 않습니다.");
  }
  if (mode === "single" && (result.simulator.pipeline_model !== "single-cycle" ||
    result.summary.stalls !== 0 || result.summary.forwards !== 0 ||
    result.history.some(cycle => Object.values(cycle.buffers ?? {}).some(Boolean)) ||
    (result.status === "halted" && result.summary.instructions_executed !== result.history.length))) {
    throw new Error("서버의 싱글 엔진이 이전 방식입니다. 새 싱글 사이클 CORE 반영이 필요합니다.");
  }
}

export function getPlaybackFrame(result: SimulationResult | null, completed: number): CycleHistoryItem | null {
  if (!result) return null;
  if (completed > 0) return result.history[completed - 1] ?? null;
  if (!result.initial_state) return null;
  const empty = { assembly: "bubble", status: "empty" };
  return {
    clock: -1,
    buffers: { IF: null, ID: null, EX: null, MEM: null, WB: null },
    stage_activity: { IF: empty, ID: empty, EX: empty, MEM: empty, WB: empty },
    cycle_events: {
      stall: { has_stall: false, stage: null, assembly: null, stall_reason: null, stall_desc: null },
      forwarding: { has_forwarded: false, stage: null, assembly: null, forwarded_operand_count: 0,
        forwarding_info: { has_forwarded: false, forwarded_from: [], forwarded_to: [], target_register: [], forwarded_value: [] }, forwarding_desc: null },
      control_hazard: { has_control_instruction: false, has_flush: false, stage: null, assembly: null, taken: null, target_pc: null, fallthrough_pc: null, flushed_stages: [], flush_reason: null, redirect_pc: null },
      runtime_error: { has_error: false, code: null, stage: null, assembly: null, message: null, reason: null },
    },
    global_result: result.initial_state,
  };
}

export function getCodeMap(result: SimulationResult | null) {
  const entries = result?.program.instructions ?? result?.history.flatMap(cycle =>
    [cycle.stage_activity?.IF, ...Object.values(cycle.buffers ?? {})]) ?? [];
  const map: Record<string, { raw: string; asm: string }> = {};
  for (const entry of entries) {
    if (entry?.pc && entry.raw_instruction && !("status" in entry && ["empty", "flushed", "stalled"].includes(entry.status))) {
      map[entry.pc.toLowerCase()] = { raw: entry.raw_instruction, asm: entry.assembly };
    }
  }
  return map;
}

export function getMemoryRegion(address: string, result: SimulationResult | null): string {
  const value = Number.parseInt(address, 16);
  const region = result?.program.memory_regions?.find(item =>
    value >= Number.parseInt(item.start, 16) && value < Number.parseInt(item.end_exclusive, 16));
  return region?.name ?? "영역 미확인";
}

export function getDisassemblyPc(line: string): string | undefined {
  const match = line.match(/^\s*(?:0x)?([0-9a-fA-F]+):\s/);
  return match ? `0x${match[1].toLowerCase().padStart(8, '0')}` : undefined;
}
