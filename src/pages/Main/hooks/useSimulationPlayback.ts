import { useState, useEffect, useRef } from "react";
import type { SimulationResult, CycleHistoryItem } from "@/type/simulation";
import type { MappedAssemblyRow } from "../components/translationCompile";
import { findAssemblyRow, getActivity, getCycleData } from "../simulationView";

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
  const isSimulationReady = totalCycles > 0;

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

  const currentData: CycleHistoryItem | null = getCycleData(simulationData, currentCycle);
  const prevData: CycleHistoryItem | null =
    currentCycle > 0 ? getCycleData(simulationData, currentCycle - 1) : null;
  const activeCycleIndex = currentCycle - 1;
  const stageActivity = currentData ? getActivity(currentData) : undefined;

  const currentActiveAsmIndex = isSingleEngine
    ? findAssemblyRow(mappedAssemblyRows, stageActivity?.IF, simulationData?.program.instructions)
    : null;
  const currentActiveRow =
    currentActiveAsmIndex === null ? null : mappedAssemblyRows[currentActiveAsmIndex];

  const activeExecutionCLine = currentActiveRow
    ? currentActiveRow.sourceLine
    : isSingleEngine && currentCycle === 0 && mappedAssemblyRows.length > 0
    ? mappedAssemblyRows[0].sourceLine
    : null;

  const isActuallyExecuting = isSingleEngine ? currentCycle > 0 : true;
  const effectiveSelectedLine =
    editorTarget === "asm" ? null : (translationSelectedLine ?? activeExecutionCLine);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentCycle(0);
  }, [simulationData]);

  // 자동 재생 타이머
  useEffect(() => {
    if (isPlaying) {
      onClearSelection();

      timerRef.current = window.setInterval(() => {
        setCurrentCycle((prev) => {
          if (prev >= totalCycles) {
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
    setCurrentCycle((prev) => Math.min(totalCycles, prev + 1));
  };

  const handleTogglePlay = () => {
    const currentPos = currentCycle;
    const maxPos = totalCycles;

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
    setCurrentCycle(Math.max(0, Math.min(totalCycles, val)));
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
    stageActivity,
    currentActiveAsmIndex,
    currentActiveRow,
    activeExecutionCLine,
    isActuallyExecuting,
    effectiveSelectedLine,
    handleStepBack,
    handleStepForward,
    handleTogglePlay,
    handleReset,
    handleJumpToCycle,
    triggerPlaybackFeedback,
  };
}
