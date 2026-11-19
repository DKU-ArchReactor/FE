import type { BuildCompileResponse } from "@/type/build";
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

type SimulationTarget = "c" | "asm";

type TargetSessionState = {
  resultWorkspace: string;
  simulationCache: {
    single: SimulationResult | null;
    pipeline: SimulationResult | null;
  };
  simulationEngineMode: "single" | "pipeline";
  activeBuildId: string | null;
  activeSimulationToken: string | null;
};

const initialTargetState: TargetSessionState = {
  resultWorkspace: "",
  simulationCache: { single: null, pipeline: null },
  simulationEngineMode: "single",
  activeBuildId: null,
  activeSimulationToken: null,
};

type UseSimulationSessionParams = {
  workspaceKey: string;
  editorTarget?: SimulationTarget;
  cWorkspaceKey?: string;
  asmWorkspaceKey?: string;
  savedFileId?: string | null;
  translationSource: string;
  translationAssembly: string;
  translationBusy: boolean;
  setTranslationBusy: (busy: boolean) => void;
  setTranslationError: (err: string) => void;
  setTranslationAssembly: (asm: string) => void;
};

type SimulationCallbacks = {
  onSimulationComplete: (result: SimulationResult) => void;
  onCompilationComplete?: () => void;
  triggerPlaybackFeedback: (type: PlaybackFeedbackType) => void;
  isPlaying: boolean;
  currentCycle: number;
};

export function useSimulationSession({
  workspaceKey,
  editorTarget = "c",
  cWorkspaceKey,
  asmWorkspaceKey,
  savedFileId,
  translationSource,
  translationAssembly,
  translationBusy,
  setTranslationBusy,
  setTranslationError,
  setTranslationAssembly,
}: UseSimulationSessionParams) {
  const [buildResult, setBuildResult] = useState<BuildCompileResponse | null>(null);
  const requests = useRef(new RequestGeneration());

  // C 모드와 ASM 모드의 시뮬레이션 상태를 각각 독립적으로 캐싱
  const [sessions, setSessions] = useState<Record<SimulationTarget, TargetSessionState>>({
    c: { ...initialTargetState },
    asm: { ...initialTargetState },
  });

  const activeTarget = editorTarget;
  const currentSession = sessions[activeTarget];
  const activeWorkspaceKey =
    activeTarget === "c"
      ? (cWorkspaceKey ?? workspaceKey)
      : (asmWorkspaceKey ?? workspaceKey);

  const simulationEngineMode = currentSession.simulationEngineMode;
  const isSingleEngine = simulationEngineMode === "single";

  const isCurrentWorkspaceReady = currentSession.resultWorkspace === activeWorkspaceKey;
  const simulationData =
    !translationBusy && isCurrentWorkspaceReady
      ? currentSession.simulationCache[simulationEngineMode]
      : null;

  const loadingMessage = translationBusy ? "컴파일 및 시뮬레이션 데이터를 불러오는 중입니다..." : null;
  const activeBuildId = currentSession.activeBuildId;
  const activeSimulationToken = currentSession.activeSimulationToken;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("mode-single", "mode-pipeline");
    root.classList.add(`mode-${simulationEngineMode}`);
  }, [simulationEngineMode]);

  // 어셈블리 행 파싱: 백엔드가 시뮬레이션 로그에 직접 주입한 source_line 매핑을 단일 진실 원천으로 사용
  const mappedAssemblyRows = useMemo(() => {
    if (translationBusy) return [];
    const fromSim = extractAssemblyFromSimulation(simulationData);
    if (fromSim.length > 0) return fromSim;
    if (isCurrentWorkspaceReady && buildResult?.analysis?.instructions.length) {
      return buildResult.analysis.instructions.map(item => ({ pc: item.pc, text: item.assembly, sourceLine: item.source_line, isRuntime: false }));
    }
    if (!translationAssembly) return [];
    return mapAssembly(translationAssembly, 1000);
  }, [translationBusy, simulationData, translationAssembly, buildResult, isCurrentWorkspaceReady]);

  const clearSimulationCache = (target?: SimulationTarget) => {
    requests.current.invalidate();
    setTranslationBusy(false);
    setBuildResult(null);
    if (target) {
      setSessions((prev) => ({
        ...prev,
        [target]: {
          ...prev[target],
          resultWorkspace: "",
          activeBuildId: null,
          activeSimulationToken: null,
          simulationCache: { single: null, pipeline: null },
        },
      }));
    } else {
      setSessions((prev) => ({
        ...prev,
        [activeTarget]: {
          ...prev[activeTarget],
          resultWorkspace: "",
          activeBuildId: null,
          activeSimulationToken: null,
          simulationCache: { single: null, pipeline: null },
        },
      }));
    }
  };

  // C 소스 변경 시에만 C 캐시 무효화
  useLayoutEffect(() => {
    if (!cWorkspaceKey) return;
    setSessions((prev) => {
      if (prev.c.resultWorkspace && prev.c.resultWorkspace !== cWorkspaceKey) {
        return {
          ...prev,
          c: {
            ...prev.c,
            resultWorkspace: "",
            activeBuildId: null,
            activeSimulationToken: null,
            simulationCache: { single: null, pipeline: null },
          },
        };
      }
      return prev;
    });
  }, [cWorkspaceKey]);

  // ASM 소스 변경 시에만 ASM 캐시 무효화
  useLayoutEffect(() => {
    if (!asmWorkspaceKey) return;
    setSessions((prev) => {
      if (prev.asm.resultWorkspace && prev.asm.resultWorkspace !== asmWorkspaceKey) {
        return {
          ...prev,
          asm: {
            ...prev.asm,
            resultWorkspace: "",
            activeBuildId: null,
            activeSimulationToken: null,
            simulationCache: { single: null, pipeline: null },
          },
        };
      }
      return prev;
    });
  }, [asmWorkspaceKey]);

  // 하위 호환성 (단일 workspaceKey만 전달된 경우, 예: test harness)
  useLayoutEffect(() => {
    if (cWorkspaceKey || asmWorkspaceKey) return;
    clearSimulationCache();
    const gate = requests.current;
    return () => gate.invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceKey]);

  const beginRequest = () => {
    const request = requests.current.begin();
    const auth = getAuthSession();
    return {
      ...request,
      capture: auth.authenticated,
      isCurrent: () => request.isCurrent() && auth.epoch === getAuthSession().epoch,
    };
  };

  const handleTranslationCompile = async (
    callbacks: Pick<
      SimulationCallbacks,
      "onSimulationComplete" | "triggerPlaybackFeedback" | "onCompilationComplete"
    >
  ) => {
    if (!translationSource.trim() || translationBusy) return;
    const request = beginRequest();
    let compiledResult: BuildCompileResponse | null = null;
    setBuildResult(null);
    setTranslationAssembly("");
    setSessions((prev) => ({
      ...prev,
      c: {
        ...prev.c,
        resultWorkspace: "",
        activeBuildId: null,
        activeSimulationToken: null,
        simulationCache: { single: null, pipeline: null },
      },
    }));
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
      } = await compileTranslation(translationSource, sessions.c.simulationEngineMode, {
        ...request,
        fileId: request.capture ? savedFileId : null,
        onCompiled: (result) => {
          if (request.isCurrent()) compiledResult = result;
        },
      });
      if (!request.isCurrent()) return;

      const targetKey = cWorkspaceKey ?? workspaceKey;
      if (compiledResult) setBuildResult(compiledResult);
      setSessions((prev) => ({
        ...prev,
        c: {
          ...prev.c,
          resultWorkspace: targetKey,
          activeBuildId: buildId ?? null,
          activeSimulationToken: simulationToken ?? null,
          simulationCache: {
            single: singleSimulationResult ?? null,
            pipeline: pipelineSimulationResult ?? null,
          },
        },
      }));

      setTranslationAssembly(assembly);
      callbacks.onCompilationComplete?.();

      if (!simulationResult)
        setTranslationError("선택한 모드의 실행 결과를 받지 못했습니다. 다시 실행해 주세요.");
      if (simulationResult) {
        callbacks.onSimulationComplete(simulationResult);
        callbacks.triggerPlaybackFeedback("check");
      }
    } catch (error) {
      if (!request.isCurrent()) return;
      if (compiledResult) {
        const targetKey = cWorkspaceKey ?? workspaceKey;
        setBuildResult(compiledResult);
        setSessions((prev) => ({
          ...prev,
          c: {
            ...prev.c,
            resultWorkspace: targetKey,
          },
        }));
      }
      setTranslationError(error instanceof Error ? error.message : "컴파일에 실패했습니다.");
    } finally {
      if (request.isCurrent()) setTranslationBusy(false);
    }
  };

  const handleAssemblySimulation = async (
    customAssembly: string,
    callbacks: Pick<
      SimulationCallbacks,
      "onSimulationComplete" | "triggerPlaybackFeedback" | "onCompilationComplete"
    >
  ) => {
    const codeToSimulate = customAssembly;
    if (!codeToSimulate.trim() || translationBusy) return;

    const request = beginRequest();
    let compiledResult: BuildCompileResponse | null = null;
    setBuildResult(null);
    setTranslationAssembly("");
    setSessions((prev) => ({
      ...prev,
      asm: {
        ...prev.asm,
        resultWorkspace: "",
        activeBuildId: null,
        activeSimulationToken: null,
        simulationCache: { single: null, pipeline: null },
      },
    }));
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
        } = await compileAssemblyDirectly(codeToSimulate, sessions.asm.simulationEngineMode, {
        ...request,
        onCompiled: (result) => {
          if (request.isCurrent()) compiledResult = result;
        },
      });
      if (!request.isCurrent()) return;

      const targetKey = asmWorkspaceKey ?? workspaceKey;
      if (compiledResult) setBuildResult(compiledResult);
      setSessions((prev) => ({
        ...prev,
        asm: {
          ...prev.asm,
          resultWorkspace: targetKey,
          activeBuildId: buildId ?? null,
          activeSimulationToken: simulationToken ?? null,
          simulationCache: {
            single: singleSimulationResult ?? null,
            pipeline: pipelineSimulationResult ?? null,
          },
        },
      }));

      setTranslationAssembly(assembly);
      callbacks.onCompilationComplete?.();

      if (!simulationResult)
        setTranslationError("선택한 모드의 실행 결과를 받지 못했습니다. 다시 실행해 주세요.");
      if (simulationResult) {
        callbacks.onSimulationComplete(simulationResult);
        callbacks.triggerPlaybackFeedback("check");
      }
    } catch (err) {
      if (!request.isCurrent()) return;
      if (compiledResult) {
        const targetKey = asmWorkspaceKey ?? workspaceKey;
        setBuildResult(compiledResult);
        setSessions((prev) => ({
          ...prev,
          asm: {
            ...prev.asm,
            resultWorkspace: targetKey,
          },
        }));
      }
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

    setSessions((prev) => ({
      ...prev,
      [activeTarget]: {
        ...prev[activeTarget],
        simulationEngineMode: m,
      },
    }));

    const cachedResult = currentSession.simulationCache[m];
    if (cachedResult) {
      callbacks.onSimulationComplete(cachedResult);
      return;
    }

    // 캐시가 아직 비어있을 때만 네트워크 호출
    if (activeBuildId || activeSimulationToken) {
      setTranslationBusy(true);
      try {
        const targetToken = activeBuildId
          ? { build_id: activeBuildId }
          : { simulation_token: activeSimulationToken! };
        const simResult = await runSimulation(
          {
            ...targetToken,
            mode: m,
            max_cycles: 2000,
            capture_assistant_context: request.capture,
          },
          request.signal
        );
        if (!request.isCurrent()) return;

        setSessions((prev) => ({
          ...prev,
          [activeTarget]: {
            ...prev[activeTarget],
            resultWorkspace: activeWorkspaceKey,
            simulationCache: {
              ...prev[activeTarget].simulationCache,
              [m]: simResult,
            },
          },
        }));

        if (simResult) {
          callbacks.onSimulationComplete(simResult);
        }
      } catch {
        if (request.isCurrent()) setTranslationError("시뮬레이션 모드 전환에 실패했습니다. 다시 실행해 주세요.");
      } finally {
        if (request.isCurrent()) setTranslationBusy(false);
      }
    }
  };

  return {
    buildResult: currentSession.resultWorkspace === activeWorkspaceKey ? buildResult : null,
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
