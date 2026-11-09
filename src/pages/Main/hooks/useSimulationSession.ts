import { useState, useEffect, useMemo } from "react";
import type { SimulationResult } from "@/type/simulation";
import {
  compileTranslation,
  compileAssemblyDirectly,
  mapAssembly,
  extractAssemblyFromSimulation,
} from "../utils/translationCompile";
import { runSimulation } from "@/api/simulation";
import type { PlaybackFeedbackType } from "../components/PlaybackFeedbackOverlay";

type UseSimulationSessionParams = {
  translationSource: string;
  translationAssembly: string;
  translationBusy: boolean;
  setTranslationBusy: (busy: boolean) => void;
  setTranslationError: (err: string) => void;
  setTranslationAssembly: (asm: string) => void;
  setCFileName: (name: string) => void;
};

type SimulationCallbacks = {
  onSimulationComplete: (result: SimulationResult) => void;
  triggerPlaybackFeedback: (type: PlaybackFeedbackType) => void;
  isPlaying: boolean;
  currentCycle: number;
};

export function useSimulationSession({
  translationSource,
  translationAssembly,
  translationBusy,
  setTranslationBusy,
  setTranslationError,
  setTranslationAssembly,
  setCFileName,
}: UseSimulationSessionParams) {
  const [simulationCache, setSimulationCache] = useState<{
    single: SimulationResult | null;
    pipeline: SimulationResult | null;
  }>({ single: null, pipeline: null });

  const [simulationEngineMode, setSimulationEngineMode] = useState<"single" | "pipeline">("single");
  const simulationData = simulationCache[simulationEngineMode];
  const loadingMessage = null;
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [activeSimulationToken, setActiveSimulationToken] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("mode-single", "mode-pipeline");
    root.classList.add(`mode-${simulationEngineMode}`);
  }, [simulationEngineMode]);

  const isSingleEngine = simulationEngineMode === "single";

  // 어셈블리 행 파싱: 백엔드가 시뮬레이션 로그에 직접 주입한 source_line 매핑을 단일 진실 원천으로 사용
  const mappedAssemblyRows = useMemo(() => {
    const fromSim = extractAssemblyFromSimulation(simulationData);
    if (fromSim.length > 0) return fromSim;
    if (!translationAssembly) return [];
    return mapAssembly(translationAssembly, 1000);
  }, [simulationData, translationAssembly]);

  const clearSimulationCache = () => {
    setSimulationCache({ single: null, pipeline: null });
  };

  const handleTranslationCompile = async (callbacks: Pick<SimulationCallbacks, "onSimulationComplete" | "triggerPlaybackFeedback">) => {
    if (!translationSource.trim() || translationBusy) return;
    setTranslationBusy(true);
    setTranslationError("");
    try {
      const {
        assembly,
        simulationResult,
        singleSimulationResult,
        pipelineSimulationResult,
        buildId,
        simulationToken,
      } = await compileTranslation(translationSource, simulationEngineMode);

      setTranslationAssembly(assembly);
      setCFileName("main.c");
      setActiveBuildId(buildId ?? null);
      setActiveSimulationToken(simulationToken ?? null);

      setSimulationCache({
        single: singleSimulationResult ?? (simulationEngineMode === "single" ? simulationResult : null),
        pipeline: pipelineSimulationResult ?? (simulationEngineMode === "pipeline" ? simulationResult : null),
      });

      if (simulationResult) {
        callbacks.onSimulationComplete(simulationResult);
        callbacks.triggerPlaybackFeedback("check");
      }
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : "컴파일에 실패했습니다.");
    } finally {
      setTranslationBusy(false);
    }
  };

  const handleAssemblySimulation = async (
    customAssembly: string,
    callbacks: Pick<SimulationCallbacks, "onSimulationComplete" | "triggerPlaybackFeedback">
  ) => {
    const codeToSimulate = customAssembly;
    if (!codeToSimulate.trim() || translationBusy) return;

    setTranslationBusy(true);
    setTranslationError("");
    setTranslationAssembly(codeToSimulate);

    try {
      const {
        assembly,
        simulationResult,
        singleSimulationResult,
        pipelineSimulationResult,
        buildId,
        simulationToken,
      } = await compileAssemblyDirectly(codeToSimulate, simulationEngineMode);

      setTranslationAssembly(assembly);
      setActiveBuildId(buildId ?? null);
      setActiveSimulationToken(simulationToken ?? null);

      setSimulationCache({
        single: singleSimulationResult ?? (simulationEngineMode === "single" ? simulationResult : null),
        pipeline: pipelineSimulationResult ?? (simulationEngineMode === "pipeline" ? simulationResult : null),
      });

      if (simulationResult) {
        callbacks.onSimulationComplete(simulationResult);
        callbacks.triggerPlaybackFeedback("check");
      }
    } catch (err: any) {
      console.error("Assembly simulation error:", err);
      setTranslationError(err?.message || "어셈블리 시뮬레이션 요청에 실패했습니다.");
    } finally {
      setTranslationBusy(false);
    }
  };

  const handleSimulationModeChange = async (
    m: "single" | "pipeline",
    callbacks: SimulationCallbacks
  ) => {
    if (callbacks.isPlaying || callbacks.currentCycle > 0) {
      callbacks.triggerPlaybackFeedback("reset");
    }
    setSimulationEngineMode(m);
    const cachedResult = simulationCache[m];
    if (cachedResult) {
      callbacks.onSimulationComplete(cachedResult);
      return;
    }

    // 캐시가 아직 비어있을 때만 네트워크 호출
    if (activeBuildId || activeSimulationToken) {
      try {
        const targetToken = activeBuildId
          ? { build_id: activeBuildId }
          : { simulation_token: activeSimulationToken! };
        const simResult = await runSimulation({
          ...targetToken,
          mode: m,
          max_cycles: 2000,
        });
        if (simResult) {
          setSimulationCache((prev) => ({ ...prev, [m]: simResult }));
          callbacks.onSimulationComplete(simResult);
        }
      } catch (simErr) {
        console.warn("시뮬레이션 모드 전환 재실행 오류:", simErr);
      }
    }
  };

  return {
    simulationEngineMode,
    simulationData,
    loadingMessage,
    isSingleEngine,
    mappedAssemblyRows,
    clearSimulationCache,
    handleTranslationCompile,
    handleAssemblySimulation,
    handleSimulationModeChange,
  };
}
