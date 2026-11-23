import { seedTutor } from "@/api/tutorCache";
import apiConfig from "@/api/config";
import type { SimulationRunRequest, SimulationResult, CycleHistoryItem } from "@/type/simulation";

const normalizeSimulationResult = (raw: SimulationResult): SimulationResult => {
  if (!raw || !Array.isArray(raw.history)) {
    return raw;
  }

  const isSingleCycle = raw.simulator?.mode === "single" || raw.simulator?.pipeline_model === "single-cycle";

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

    return {
      ...item,
      buffers: buffers ?? { IF: null, ID: null, EX: null, MEM: null, WB: null },
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

