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
    type: "play" | "pause";
    id: number;
  } | null>(null);

  const timerRef = useRef<number | null>(null);

  const triggerPlaybackFeedback = (type: "play" | "pause") => {
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
      const activeAsm = (
        currentData.buffers?.IF?.assembly ||
        currentData.if_stage?.assembly ||
        currentData.stage_activity?.IF?.assembly ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (!activeAsm || activeAsm === "bubble" || activeAsm === "empty") return null;

      // 1순위: 활성 명령어 텍스트와 정확히 일치하는 행 매칭
      const matched = mappedAssemblyRows.find((r) => {
        const rowNorm = r.text.replace(/\s+/g, " ").trim().toLowerCase();
        return rowNorm === activeAsm;
      });
      return matched ?? null;
    }
    return null;
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
          if (prev >= totalCycles - 1) {
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
  }, [isPlaying, playSpeed, totalCycles, onClearSelection]);

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
    setCurrentCycle((prev) => Math.min(totalCycles - 1, prev + 1));
  };

  const handleTogglePlay = () => {
    const currentPos = currentCycle;
    const maxPos = totalCycles - 1;

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
    handleJumpToCycle,
    triggerPlaybackFeedback,
  };
}
