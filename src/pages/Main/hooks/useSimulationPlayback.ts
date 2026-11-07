import { useState, useEffect, useRef } from "react";
import type { SimulationResult, CycleHistoryItem } from "@/type/simulation";
import type { MappedAssemblyRow } from "../components/translationCompile";

interface UseSimulationPlaybackProps {
  simulationData: SimulationResult | null;
  mappedAssemblyRows: MappedAssemblyRow[];
  isSingleEngine: boolean;
  editorTarget: "c" | "asm";
  translationSelectedLine: number | null;
  onClearSelection: () => void;
}

export function useSimulationPlayback({
  simulationData,
  mappedAssemblyRows,
  isSingleEngine,
  editorTarget,
  translationSelectedLine,
  onClearSelection,
}: UseSimulationPlaybackProps) {
  const historyList = simulationData?.history ?? [];
  const totalCycles = historyList.length;
  const isSimulationReady = historyList.length > 0;

  const [currentCycle, setCurrentCycle] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1000);

  const [playbackFeedback, setPlaybackFeedback] = useState<{
    type: "play" | "pause" | "reset";
    id: number;
  } | null>(null);

  const timerRef = useRef<number | null>(null);

  const triggerPlaybackFeedback = (type: "play" | "pause" | "reset") => {
    setPlaybackFeedback({ type, id: Date.now() });
  };

  const activeCycleIndex = Math.min(currentCycle, Math.max(0, historyList.length - 1));
  const prevCycleIndex = activeCycleIndex > 0 ? activeCycleIndex - 1 : null;

  const currentData: CycleHistoryItem | null = historyList[activeCycleIndex] ?? null;
  const prevData: CycleHistoryItem | null =
    prevCycleIndex !== null && prevCycleIndex !== activeCycleIndex
      ? historyList[prevCycleIndex] ?? null
      : null;

  // Single 모드 또는 Pipeline 모드에서 현재 활성 실행 중인 어셈블리 행 계산
  const currentActiveRow = (() => {
    if (!currentData || !mappedAssemblyRows.length) return null;

    if (isSingleEngine) {
      // Step 0: 실행 전 초기 대기 상태이므로 실행 포커스 없음
      if (currentCycle === 0) return null;

      // Step 1일 때 historyList[0], Step 2일 때 historyList[1], ...
      const stepIdx = Math.min(currentCycle - 1, historyList.length - 1);
      const stepData = historyList[stepIdx];
      if (!stepData) return null;

      // 1순위: PC 기반 직접 매칭 (가장 정확)
      const currentPc = (
        stepData.buffers?.IF?.pc ||
        stepData.if_stage?.pc ||
        stepData.stage_activity?.IF?.pc ||
        stepData.global_result?.current_pc ||
        ""
      ).trim().toLowerCase();

      if (currentPc) {
        const pcMatch = mappedAssemblyRows.find((r) => (r.pc || "").trim().toLowerCase() === currentPc);
        if (pcMatch) return pcMatch;
      }

      // 2순위: 활성 명령어 텍스트 매칭
      const activeAsm = (
        stepData.buffers?.IF?.assembly ||
        stepData.if_stage?.assembly ||
        stepData.stage_activity?.IF?.assembly ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (!activeAsm || activeAsm === "bubble" || activeAsm === "empty") return null;

      const matched = mappedAssemblyRows.find((r) => {
        const rowNorm = r.text.replace(/\s+/g, " ").trim().toLowerCase();
        return rowNorm === activeAsm;
      });
      return matched ?? null;
    } else {
      // Pipeline 모드: 실행 중인 주요 스테이지(EX 또는 IF)의 명령어 매칭
      const activeBuf = currentData.buffers?.EX || currentData.buffers?.ID || currentData.buffers?.IF;
      if (!activeBuf) return null;

      const bufPc = (activeBuf.pc || "").trim().toLowerCase();
      if (bufPc) {
        const pcMatch = mappedAssemblyRows.find((r) => (r.pc || "").trim().toLowerCase() === bufPc);
        if (pcMatch) return pcMatch;
      }

      const activeAsm = (activeBuf.assembly || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!activeAsm || activeAsm === "bubble" || activeAsm === "empty") return null;

      const matched = mappedAssemblyRows.find((r) => {
        const rowNorm = r.text.replace(/\s+/g, " ").trim().toLowerCase();
        return rowNorm === activeAsm;
      });
      return matched ?? null;
    }
  })();

  const activeExecutionCLine = currentActiveRow?.sourceLine ?? null;
  const effectiveSelectedLine =
    editorTarget === "asm" ? null : (translationSelectedLine ?? activeExecutionCLine);

  const handleSimulationComplete = (_data: SimulationResult) => {
    setIsPlaying(false);
    setCurrentCycle(0);
    setPlaySpeed(1000);
  };

  // 자동 재생 타이머
  useEffect(() => {
    if (isPlaying) {
      onClearSelection();

      timerRef.current = window.setInterval(() => {
        setCurrentCycle((prev) => {
          const maxLimit = isSingleEngine ? totalCycles : Math.max(0, totalCycles - 1);
          if (prev >= maxLimit) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, playSpeed);
    } else {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, playSpeed, totalCycles, isSingleEngine, onClearSelection]);

  const handleStepBack = () => {
    setIsPlaying(false);
    triggerPlaybackFeedback("pause");
    onClearSelection();
    setCurrentCycle((prev) => Math.max(0, prev - 1));
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    triggerPlaybackFeedback("pause");
    onClearSelection();
    const maxLimit = isSingleEngine ? totalCycles : Math.max(0, totalCycles - 1);
    setCurrentCycle((prev) => Math.min(maxLimit, prev + 1));
  };

  const handleTogglePlay = () => {
    const currentPos = currentCycle;
    const maxPos = isSingleEngine ? totalCycles : Math.max(0, totalCycles - 1);

    onClearSelection();

    if (currentPos >= maxPos) {
      setCurrentCycle(0);
      setIsPlaying(true);
      triggerPlaybackFeedback("play");
    } else {
      setIsPlaying((prev) => {
        const nextState = !prev;
        triggerPlaybackFeedback(nextState ? "play" : "pause");
        return nextState;
      });
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    onClearSelection();
    setCurrentCycle(0);
    triggerPlaybackFeedback("reset");
  };

  const handleResetAndPlay = () => {
    onClearSelection();
    setCurrentCycle(0);
    setIsPlaying(true);
    triggerPlaybackFeedback("play");
  };

  const handleJumpToCycle = (val: number) => {
    setIsPlaying((prev) => {
      if (prev) {
        triggerPlaybackFeedback("pause");
      }
      return false;
    });
    onClearSelection();
    setCurrentCycle(val);
  };

  return {
    currentCycle,
    setCurrentCycle,
    isPlaying,
    setIsPlaying,
    playSpeed,
    setPlaySpeed,
    totalCycles,
    isSimulationReady,
    playbackFeedback,
    activeCycleIndex,
    currentData,
    prevData,
    currentActiveRow,
    activeExecutionCLine,
    effectiveSelectedLine,
    handleSimulationComplete,
    handleStepBack,
    handleStepForward,
    handleTogglePlay,
    handleReset,
    handleResetAndPlay,
    handleJumpToCycle,
    triggerPlaybackFeedback,
  };
}
