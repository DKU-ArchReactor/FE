import apiConfig from "@/api/config";
import type { SimulationRunRequest, SimulationResult, CycleHistoryItem } from "@/type/simulation";

const normalizeSimulationResult = (raw: SimulationResult): SimulationResult => {
  if (!raw || !Array.isArray(raw.history)) {
    return raw;
  }

  const normalizedHistory: CycleHistoryItem[] = raw.history.map((item) => {
    const buffers = item.buffers ?? {
      IF: item.if_stage ?? item.stage_activity?.IF ?? null,
      ID: item.id_stage ?? item.stage_activity?.ID ?? null,
      EX: item.ex_stage ?? item.stage_activity?.EX ?? null,
      MEM: item.mem_stage ?? item.stage_activity?.MEM ?? null,
      WB: item.wb_stage ?? item.stage_activity?.WB ?? null,
    };
    return {
      ...item,
      buffers,
    };
  });

  return {
    ...raw,
    history: normalizedHistory,
  };
};

export const runSimulation = async (
  data: SimulationRunRequest
): Promise<SimulationResult> => {
  const payload: SimulationRunRequest = {
    mode: data.mode ?? "pipeline",
    max_cycles: data.max_cycles ?? 2000,
    ...(data.build_id
      ? { build_id: data.build_id }
      : { simulation_token: data.simulation_token }),
  };

  const response = await apiConfig.post("/api/v1/simulation/run", payload);

  console.log("Raw Simulation API Response:", response.data);
  let resultData = response.data;

  const fetchJsonFromUrl = async (rawUrl: string) => {
    let fetchUrl = rawUrl;
    if (import.meta.env.DEV && import.meta.env.VITE_S3_BUCKET_URL) {
      fetchUrl = fetchUrl.replace(import.meta.env.VITE_S3_BUCKET_URL, "/s3-proxy");
    }
    let res = await fetch(fetchUrl);
    if (!res.ok && fetchUrl !== rawUrl) {
      res = await fetch(rawUrl);
    }
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

  return normalizeSimulationResult(resultData as SimulationResult);
};

