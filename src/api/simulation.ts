import apiConfig from "@/api/config";
import type { SimulationRunRequest, SimulationResult } from "@/type/simulation";
import { assertSimulationResult } from "@/pages/Main/components/simulationView";
import type { SimulationBundle, SimulationMode } from "@/pages/Main/components/simulationView";

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
    if (!res.ok) throw new Error(`실행 결과를 불러오지 못했습니다. (HTTP ${res.status})`);
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

  assertSimulationResult(resultData, (data.mode ?? "pipeline") as SimulationMode);
  return resultData;
};

export async function runSimulationModes(target: Pick<SimulationRunRequest, "build_id" | "simulation_token">): Promise<SimulationBundle> {
  const modes = ["single", "pipeline"] as const;
  const settled = await Promise.allSettled(modes.map(mode => runSimulation({ ...target, mode, max_cycles: 2000 })));
  const bundle: SimulationBundle = { results: {}, errors: {} };
  settled.forEach((item, index) => {
    const mode = modes[index];
    if (item.status === "fulfilled") bundle.results[mode] = item.value;
    else bundle.errors[mode] = item.reason instanceof Error ? item.reason.message : "시뮬레이션에 실패했습니다.";
  });
  return bundle;
}

