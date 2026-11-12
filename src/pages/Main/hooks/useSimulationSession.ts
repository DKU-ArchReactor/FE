import { getAuthSession } from '@/api/authSession';
import { RequestGeneration } from '../utils/assistantContext';
import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
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
  workspaceKey: string;
  translationSource: string;
  translationAssembly: string;
  translationBusy: boolean;
  setTranslationBusy: (busy: boolean) => void;
  setTranslationError: (err: string) => void;
  setTranslationAssembly: (asm: string) => void;
};

type SimulationCallbacks = {
  onSimulationComplete: (result: SimulationResult) => void;
  triggerPlaybackFeedback: (type: PlaybackFeedbackType) => void;
  isPlaying: boolean;
  currentCycle: number;
};

export function useSimulationSession({
  workspaceKey,
  translationSource,
  translationAssembly,
  translationBusy,
  setTranslationBusy,
  setTranslationError,
  setTranslationAssembly,
}: UseSimulationSessionParams) {
  const requests = useRef(new RequestGeneration());
  const [resultWorkspace, setResultWorkspace] = useState(workspaceKey);
  const [simulationCache, setSimulationCache] = useState<{
    single: SimulationResult | null;
    pipeline: SimulationResult | null;
  }>({ single: null, pipeline: null });

  const [simulationEngineMode, setSimulationEngineMode] = useState<"single" | "pipeline">("single");
  const simulationData = resultWorkspace === workspaceKey ? simulationCache[simulationEngineMode] : null;
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
    requests.current.invalidate();
    setTranslationBusy(false);
    setActiveBuildId(null);
    setActiveSimulationToken(null);
    setSimulationCache({ single: null, pipeline: null });
  };

  useLayoutEffect(() => {
    clearSimulationCache();
    const gate = requests.current;
    return () => gate.invalidate();
    // Workspace identity includes input, editor type and auth generation (never generated ASM).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceKey]);

  const beginRequest = () => {
    const request = requests.current.begin();
    const auth = getAuthSession();
    return { ...request, capture: auth.authenticated,
      isCurrent: () => request.isCurrent() && auth.epoch === getAuthSession().epoch };
  };

  const handleTranslationCompile = async (callbacks: Pick<SimulationCallbacks, "onSimulationComplete" | "triggerPlaybackFeedback">) => {
    if (!translationSource.trim() || translationBusy) return;
    const request = beginRequest();
    setSimulationCache({ single: null, pipeline: null });
    setActiveBuildId(null);
    setActiveSimulationToken(null);
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
      } = await compileTranslation(translationSource, simulationEngineMode, request);
      if (!request.isCurrent()) return;
      setResultWorkspace(workspaceKey);

      setTranslationAssembly(assembly);
      setActiveBuildId(buildId ?? null);
      setActiveSimulationToken(simulationToken ?? null);

      setSimulationCache({
        single: singleSimulationResult ?? null,
        pipeline: pipelineSimulationResult ?? null,
      });

      if (!simulationResult) setTranslationError("선택한 모드의 실행 결과를 받지 못했습니다. 다시 실행해 주세요.");
      if (simulationResult) {
        callbacks.onSimulationComplete(simulationResult);
        callbacks.triggerPlaybackFeedback("check");
      }
    } catch (error) {
      if (!request.isCurrent()) return;
      setTranslationError(error instanceof Error ? error.message : "컴파일에 실패했습니다.");
    } finally {
      if (request.isCurrent()) setTranslationBusy(false);
    }
  };

  const handleAssemblySimulation = async (
    customAssembly: string,
    callbacks: Pick<SimulationCallbacks, "onSimulationComplete" | "triggerPlaybackFeedback">
  ) => {
    const codeToSimulate = customAssembly;
    if (!codeToSimulate.trim() || translationBusy) return;

    const request = beginRequest();
    setSimulationCache({ single: null, pipeline: null });
    setActiveBuildId(null);
    setActiveSimulationToken(null);
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
      } = await compileAssemblyDirectly(codeToSimulate, simulationEngineMode, request);
      if (!request.isCurrent()) return;
      setResultWorkspace(workspaceKey);

      setTranslationAssembly(assembly);
      setActiveBuildId(buildId ?? null);
      setActiveSimulationToken(simulationToken ?? null);

      setSimulationCache({
        single: singleSimulationResult ?? null,
        pipeline: pipelineSimulationResult ?? null,
      });

      if (!simulationResult) setTranslationError("선택한 모드의 실행 결과를 받지 못했습니다. 다시 실행해 주세요.");
      if (simulationResult) {
        callbacks.onSimulationComplete(simulationResult);
        callbacks.triggerPlaybackFeedback("check");
      }
    } catch (err) {
      if (!request.isCurrent()) return;
      setTranslationError(err instanceof Error ? err.message : "어셈블리 시뮬레이션 요청에 실패했습니다.");
    } finally {
      if (request.isCurrent()) setTranslationBusy(false);
    }
  };

  const handleSimulationModeChange = async (
    m: "single" | "pipeline",
    callbacks: SimulationCallbacks
  ) => {
    const request = beginRequest();
    setTranslationBusy(false);
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
          capture_assistant_context: request.capture,
        }, request.signal);
        if (!request.isCurrent()) return;
        setResultWorkspace(workspaceKey);
        if (simResult) {
          setSimulationCache((prev) => ({ ...prev, [m]: simResult }));
          callbacks.onSimulationComplete(simResult);
        }
      } catch {
        if (request.isCurrent()) setTranslationError("시뮬레이션 모드 전환에 실패했습니다. 다시 실행해 주세요.");
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
