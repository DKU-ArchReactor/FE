import { seedTutor } from "@/pages/Main/utils/tutorAnalysis";
import apiConfig from "@/api/config";
import type { SimulationRunRequest, SimulationResult, CycleHistoryItem } from "@/type/simulation";

const isSameDict = (a?: Record<string, string>, b?: Record<string, string>): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    const k = aKeys[i];
    if (a[k] !== b[k]) return false;
  }
  return true;
};

const normalizeSimulationResult = (raw: SimulationResult): SimulationResult => {
  if (!raw || !Array.isArray(raw.history)) {
    return raw;
  }

  const isSingleCycle = raw.simulator?.mode === "single" || raw.simulator?.pipeline_model === "single-cycle";

  let lastMemSnapshot: Record<string, string> | undefined = undefined;
  let lastRegisters: Record<string, string> | undefined = undefined;

  const normalizedHistory: CycleHistoryItem[] = raw.history.map((item) => {
    // 5-Stage Pipeline 모드 및 Single 모드 모두 실제 해당 사이클에 동작한 stage_activity를 기준으로 정규화
    // (item.buffers는 다음 사이클을 위해 래치된 미래 상태이므로, 현재 사이클의 활성 명령어를 나타내는 stage_activity를 우선 매핑)
    let buffers = item.buffers;
    if (item.stage_activity) {
      buffers = {
        IF: item.stage_activity.IF ?? null,
        ID: item.stage_activity.ID ?? null,
        EX: item.stage_activity.EX ?? null,
        MEM: item.stage_activity.MEM ?? null,
        WB: item.stage_activity.WB ?? null,
      };
    } else if (isSingleCycle || !buffers || (buffers.IF === null && buffers.ID === null && buffers.EX === null && buffers.MEM === null && buffers.WB === null)) {
      if (item.if_stage || item.id_stage || item.ex_stage || item.mem_stage || item.wb_stage) {
        buffers = {
          IF: item.if_stage ?? null,
          ID: item.id_stage ?? null,
          EX: item.ex_stage ?? null,
          MEM: item.mem_stage ?? null,
          WB: item.wb_stage ?? null,
        };
      }
    }

    // 메모리 및 레지스터 스냅샷 구조 공유(Structural Sharing): 동일한 값일 경우 이전 참조를 재사용하여 V8 힙 객체 폭증 방지
    let global_result = item.global_result;
    if (global_result) {
      if (lastMemSnapshot && isSameDict(lastMemSnapshot, global_result.memory_snapshot)) {
        global_result = { ...global_result, memory_snapshot: lastMemSnapshot };
      } else {
        lastMemSnapshot = global_result.memory_snapshot;
      }
      if (lastRegisters && isSameDict(lastRegisters, global_result.registers)) {
        global_result = { ...global_result, registers: lastRegisters };
      } else {
        lastRegisters = global_result.registers;
      }
    }

    return {
      ...item,
      buffers: buffers ?? { IF: null, ID: null, EX: null, MEM: null, WB: null },
      global_result: global_result ?? item.global_result,
    };
  });

  return {
    ...raw,
    history: normalizedHistory,
  };
};

export const runSimulation = async (
  data: SimulationRunRequest,
  signal?: AbortSignal
): Promise<SimulationResult> => {
  const payload: SimulationRunRequest = {
    mode: data.mode ?? "pipeline",
    ...(data.capture_assistant_context ? { capture_assistant_context: true } : {}),
    max_cycles: data.max_cycles ?? 2000,
    ...(data.build_id
      ? { build_id: data.build_id }
      : { simulation_token: data.simulation_token }),
  };

  const response = await apiConfig.post("/api/v1/simulation/run", payload, { signal });

  const tutor = response.data?.tutor;
  const assistant_context = response.data?.assistant_context;
  const serverStatus = response.data?.execution_status;
  const execution_status = serverStatus === "COMPLETED" || serverStatus === "CYCLE_LIMIT" || serverStatus === "SIMULATION_ERROR" ? serverStatus : undefined;
  seedTutor(tutor);
  let resultData = response.data;

  const fetchJsonFromUrl = async (rawUrl: string) => {
    let fetchUrl = rawUrl;
    if (import.meta.env.DEV && import.meta.env.VITE_S3_BUCKET_URL) {
      fetchUrl = fetchUrl.replace(import.meta.env.VITE_S3_BUCKET_URL, "/s3-proxy");
    }
    let res = await fetch(fetchUrl, { signal });
    if (!res.ok && fetchUrl !== rawUrl) {
      res = await fetch(rawUrl, { signal });
    }
    if (!res.ok) throw new Error("실행 결과를 불러오지 못했습니다.");
    return res.json();
  };

  if (typeof resultData === "string") {
    const trimmed = resultData.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      resultData = await fetchJsonFromUrl(trimmed);
    } else {
      resultData = JSON.parse(trimmed);
    }
  } else if (resultData && typeof resultData === "object" && !Array.isArray(resultData.history)) {
    const urlField =
      resultData.result_url ||
      resultData.simulation_url ||
      resultData.log_url ||
      resultData.trace_url ||
      resultData.url;

    if (typeof urlField === "string") {
      resultData = await fetchJsonFromUrl(urlField);
    } else if (typeof resultData.log === "string" && resultData.log.trim().startsWith("{")) {
      resultData = JSON.parse(resultData.log.trim());
    } else if (resultData.log && typeof resultData.log === "object" && Array.isArray(resultData.log.history)) {
      resultData = resultData.log;
    } else if (resultData.result && typeof resultData.result === "object") {
      resultData = resultData.result;
    } else if (resultData.data && typeof resultData.data === "object") {
      resultData = resultData.data;
    }
  }

  const normalized = normalizeSimulationResult(resultData as SimulationResult);
  return { ...normalized, ...(execution_status ? {execution_status} : {}), tutor, assistant_context };
};

