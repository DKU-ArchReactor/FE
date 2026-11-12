import type { ExecutionContext } from "@/type/assistant";
import type { SimulationResult, CycleHistoryItem } from "@/type/simulation";

export function contextAvailability(
  result: SimulationResult | null,
  current: CycleHistoryItem | null,
  mode: "single" | "pipeline",
  beforeExecution: boolean,
  now = Date.now(),
): string | null {
  const descriptor = result?.assistant_context;
  if (!descriptor) return "실행 정보가 없습니다. 로그인 상태에서 컴파일(또는 어셈블) → 한 단계 실행 → 선택 실행 첨부 순서로 진행해 주세요.";
  if (!descriptor.available)
    return "이번 실행 정보는 첨부할 수 없습니다. 일반 질문은 가능합니다.";
  if (
    !Number.isFinite(Date.parse(descriptor.expires_at)) ||
    Date.parse(descriptor.expires_at) <= now
  )
    return "실행 정보가 만료되었습니다. 다시 실행해 주세요.";
  if (descriptor.mode !== mode)
    return "실행 모드가 다릅니다. 다시 실행해 주세요.";
  if (beforeExecution)
    return "실행 전 상태입니다. 한 단계 이상 실행한 뒤 첨부해 주세요.";
  if (
    !current ||
    !Number.isInteger(current.clock) ||
    current.clock < descriptor.cycle_min ||
    current.clock > descriptor.cycle_max
  )
    return "첨부 가능한 사이클을 선택해 주세요.";
  return null;
}

export function availableMemory(current: CycleHistoryItem | null): number[] {
  return [
    ...new Set(
      Object.keys(current?.global_result?.memory_snapshot ?? {})
        .filter((key) => /^(?:0x[\da-f]+|\d+)$/i.test(key))
        .map(Number)
        .filter(
          (value) =>
            Number.isInteger(value) &&
            value >= 0 &&
            value <= 0xffffffff &&
            value % 4 === 0,
        ),
    ),
  ].sort((a, b) => a - b);
}

export function freezeExecutionContext(
  result: SimulationResult | null,
  current: CycleHistoryItem | null,
  mode: "single" | "pipeline",
  beforeExecution: boolean,
  addresses: number[],
  now = Date.now(),
): ExecutionContext {
  const reason = contextAvailability(
    result,
    current,
    mode,
    beforeExecution,
    now,
  );
  if (reason) throw new Error(reason);
  const descriptor = result!.assistant_context!;
  if (!descriptor.available || !current)
    throw new Error("실행 정보를 확인해 주세요.");
  const available = new Set(availableMemory(current));
  if (
    addresses.length > 16 ||
    new Set(addresses).size !== addresses.length ||
    addresses.some((address) => !available.has(address))
  )
    throw new Error(
      "현재 사이클에 있는 메모리 주소를 중복 없이 최대 16개 선택해 주세요.",
    );
  return {
    execution_id: descriptor.execution_id,
    result_version: descriptor.result_version,
    artifact_sha256: descriptor.artifact_sha256,
    mode: descriptor.mode,
    cycle: current.clock,
    memory_addresses: [...addresses],
  };
}

// Every edit/run/selection invalidates pending results, including responses that ignore abort.
export class RequestGeneration {
  private generation = 0;
  private controller: AbortController | null = null;
  invalidate() {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
  }
  begin() {
    this.invalidate();
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    return {
      signal: controller.signal,
      isCurrent: () =>
        generation === this.generation && !controller.signal.aborted,
    };
  }
}
