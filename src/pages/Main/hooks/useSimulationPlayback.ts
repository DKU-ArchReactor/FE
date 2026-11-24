import { useState, useEffect, useRef, useMemo } from "react";
import type { SimulationResult, CycleHistoryItem } from "@/type/simulation";
import type { MappedAssemblyRow } from "../utils/translationCompile";
import { timelineSync } from "../utils/timelineSync";


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

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playMode, setPlayMode] = useState<"continuous" | "singleCycle">("continuous");
  const [isStandby, setIsStandby] = useState<boolean>(true);
  const [playSpeed, setPlaySpeed] = useState<number>(3000);
  const [finishedSingleFrame, setFinishedSingleFrame] = useState<CycleHistoryItem | null>(null);
  const [playbackRevision, setPlaybackRevision] = useState(0);
  const [targetCycles, setTargetCycles] = useState<Record<"c" | "asm", number>>({ c: 0, asm: 0 });
  const [prevTarget, setPrevTarget] = useState<"c" | "asm">(editorTarget);
  const currentCycle = targetCycles[editorTarget];
  const setCurrentCycle: React.Dispatch<React.SetStateAction<number>> = (action) => {
    setTargetCycles((prev) => {
      const nextVal = typeof action === "function" ? action(prev[editorTarget]) : action;
      return { ...prev, [editorTarget]: nextVal };
    });
  };

  useEffect(() => {
    setIsStandby(true);
  }, [simulationData]);

  if (prevTarget !== editorTarget) {
    setPrevTarget(editorTarget);
    setIsPlaying(false);
    const validCycle = historyList.length > 0 ? Math.min(targetCycles[editorTarget], historyList.length) : 0;
    if (validCycle !== targetCycles[editorTarget]) {
      setTargetCycles((prev) => ({ ...prev, [editorTarget]: validCycle }));
    }
  }

  const [playbackFeedback, setPlaybackFeedback] = useState<{
    type: "play" | "pause" | "reset" | "trash" | "check";
    id: number;
  } | null>(null);

  const timerRef = useRef<number | null>(null);
  const playbackClock = useRef<{
    cycle: number;
    frame: CycleHistoryItem | null;
    duration: number;
    remaining: number;
    started: number | null;
  } | null>(null);

  const triggerPlaybackFeedback = (type: "play" | "pause" | "reset" | "trash" | "check") => {
    setPlaybackFeedback({ type, id: Date.now() });
  };

  // Single-Cycle 및 Pipeline 모드 공통: Step 0 / Cycle 0 (실행 시작 전 대기 상태) 초기 스냅샷
  const initialResetData: CycleHistoryItem | null = useMemo(() => {
    if (!simulationData || !historyList.length) return null;
    const entryPc = simulationData.program?.entry_point || "0x00010000";
    const initialRegs: Record<string, string> = {
      x0: "0x00000000",
      x1: "0x00000000",
      x2: "0x7fffeffc", // sp
    };
    for (let i = 0; i < 32; i++) {
      const k = `x${i}`;
      if (!initialRegs[k]) initialRegs[k] = "0x00000000";
    }

    return {
      clock: 0,
      buffers: {
        IF: null,
        ID: null,
        EX: null,
        MEM: null,
        WB: null,
      },
      stage_activity: {
        IF: { assembly: "empty", status: "empty" },
        ID: { assembly: "empty", status: "empty" },
        EX: { assembly: "empty", status: "empty" },
        MEM: { assembly: "empty", status: "empty" },
        WB: { assembly: "empty", status: "empty" },
      },
      cycle_events: {
        stall: {
          has_stall: false,
          stage: null,
          assembly: null,
          stall_reason: null,
          stall_desc: null,
        },
        forwarding: {
          has_forwarded: false,
          stage: null,
          assembly: null,
          forwarded_operand_count: 0,
          forwarding_info: {
            has_forwarded: false,
            forwarded_from: [],
            forwarded_to: [],
            target_register: [],
            forwarded_value: [],
          },
          forwarding_desc: null,
        },
        control_hazard: {
          has_control_instruction: false,
          has_flush: false,
          stage: null,
          assembly: null,
          taken: null,
          target_pc: null,
          fallthrough_pc: null,
          flushed_stages: [],
          flush_reason: null,
          redirect_pc: null,
        },
        runtime_error: {
          has_error: false,
          code: null,
          stage: null,
          assembly: null,
          message: null,
          reason: null,
        },
      },
      global_result: {
        current_pc: entryPc,
        registers: initialRegs,
        memory_snapshot: {},
        console_output: "",
        metrics: {
          accumulated_instructions: 0,
          accumulated_stalls: 0,
          accumulated_forwards: 0,
        },
      },
    };
  }, [simulationData, historyList.length]);

  const activeCycleIndex = Math.max(0, currentCycle - 1);

  const currentData: CycleHistoryItem | null =
    historyList.length === 0
      ? null
      : (isStandby || currentCycle === 0)
        ? initialResetData
        : (historyList[activeCycleIndex] ?? null);

  const prevData: CycleHistoryItem | null =
    (isStandby || currentCycle <= 1)
      ? initialResetData
      : (historyList[Math.min(Math.max(0, currentCycle - 2), historyList.length - 1)] ?? null);

  // Single 모드 또는 Pipeline 모드에서 현재 활성 실행 중인 어셈블리 행 계산
  const currentActiveRow = (() => {
    if (isStandby || currentCycle === 0 || !currentData || !mappedAssemblyRows.length) return null;

    if (isSingleEngine) {
      // Step 0일 때 Standby(대기), Step 1일 때 historyList[0], ...
      const stepIdx = Math.min(Math.max(0, currentCycle - 1), historyList.length - 1);
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

      // 2순위: 활성 명령어 텍스트 매칭 (source_line 일치 우선)
      const stepIfBuf =
        stepData.buffers?.IF ||
        stepData.if_stage ||
        stepData.stage_activity?.IF;
      const activeAsm = (stepIfBuf?.assembly || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (!activeAsm || activeAsm === "bubble" || activeAsm === "empty") return null;

      const stepSourceLine = stepIfBuf?.source_line;
      if (stepSourceLine !== undefined && stepSourceLine !== null) {
        const lineAndTextMatch = mappedAssemblyRows.find((r) => {
          const rowNorm = r.text.replace(/\s+/g, " ").trim().toLowerCase();
          return r.sourceLine === stepSourceLine && rowNorm === activeAsm;
        });
        if (lineAndTextMatch) return lineAndTextMatch;
      }

      const matched = mappedAssemblyRows.find((r) => {
        const rowNorm = r.text.replace(/\s+/g, " ").trim().toLowerCase();
        return rowNorm === activeAsm;
      });
      return matched ?? null;
    } else {
      // Pipeline 모드: IF(현재 인출 중인 명령어)를 1순위로 보고, 비어있을 경우 ID -> EX -> MEM -> WB 순으로 탐색
      const stages = ["IF", "ID", "EX", "MEM", "WB"] as const;
      let activeBuf: { pc?: string; assembly?: string; source_line?: number | null; status?: string; flush_info?: { is_flushed?: boolean } } | null = null;

      for (const st of stages) {
        const candidate = currentData.stage_activity?.[st] ?? currentData.buffers?.[st];
        if (!candidate) continue;
        const status = (candidate.status || "").toLowerCase();
        if (status === "empty" || status === "bubble" || status === "flush" || status === "flushed") continue;
        if (candidate.flush_info?.is_flushed) continue;
        const asm = (candidate.assembly || "").trim().toLowerCase();
        if (!asm || asm === "bubble" || asm === "empty" || asm === "—") continue;
        activeBuf = candidate;
        break;
      }

      if (!activeBuf) return null;

      const bufPc = (activeBuf.pc || "").trim().toLowerCase();
      if (bufPc) {
        const pcMatch = mappedAssemblyRows.find((r) => (r.pc || "").trim().toLowerCase() === bufPc);
        if (pcMatch) return pcMatch;
      }

      const activeAsm = (activeBuf.assembly || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!activeAsm || activeAsm === "bubble" || activeAsm === "empty") return null;

      if (activeBuf.source_line !== undefined && activeBuf.source_line !== null) {
        const lineAndTextMatch = mappedAssemblyRows.find((r) => {
          const rowNorm = r.text.replace(/\s+/g, " ").trim().toLowerCase();
          return r.sourceLine === activeBuf.source_line && rowNorm === activeAsm;
        });
        if (lineAndTextMatch) return lineAndTextMatch;
      }

      const matched = mappedAssemblyRows.find((r) => {
        const rowNorm = r.text.replace(/\s+/g, " ").trim().toLowerCase();
        return rowNorm === activeAsm;
      });
      return matched ?? null;
    }
  })();

  const activeExecutionCLine = isStandby ? null : (currentActiveRow?.sourceLine ?? null);
  const effectiveSelectedLine =
    editorTarget === "asm" ? null : (translationSelectedLine ?? activeExecutionCLine);

  const handleSimulationComplete = () => {
    setFinishedSingleFrame(null);
    setIsPlaying(false);
    setIsStandby(true);
    setCurrentCycle(0);
    setPlaySpeed(3000);
  };

  const singlePlaybackDelay = playSpeed;
  const singlePlaybackFrame = isSingleEngine ? currentCycle : 0;
  const singleFrame = isSingleEngine ? currentData : null;

  // 공통 시뮬레이션 타이머: SingleEngine 및 Pipeline 모드 모두 정지된 잔여 시간(remaining)을 추적하여
  // PAUSE 시 제자리 정지, PLAY 시 제자리 재개 동작을 보장합니다.
  useEffect(() => {
    const advance = () => setCurrentCycle(previous => {
      if (previous >= totalCycles) { setIsPlaying(false); return previous; }
      return previous + 1;
    });

    if (!isSimulationReady) return;

    if (!playbackClock.current || playbackClock.current.cycle !== currentCycle || playbackClock.current.frame !== currentData) {
      playbackClock.current = {
        cycle: currentCycle,
        frame: currentData,
        duration: playSpeed,
        remaining: playSpeed,
        started: null,
      };
    }

    const clock = playbackClock.current;
    if (clock.duration !== playSpeed) {
      clock.remaining = (clock.remaining * playSpeed) / clock.duration;
      clock.duration = playSpeed;
    }

    if (!isPlaying) return;

    if (currentCycle >= totalCycles && clock.remaining <= 0) {
      if (isSingleEngine) setFinishedSingleFrame(currentData);
      setIsPlaying(false);
      return;
    }

    clock.started = performance.now();
    timerRef.current = window.setTimeout(() => {
      clock.remaining = 0;
      clock.started = null;
      if (isSingleEngine && currentCycle >= totalCycles) {
        setFinishedSingleFrame(currentData);
      }

      if (playMode === "singleCycle") {
        // 1회 재생 완료 시 해당 사이클 완료 상태로 일시정지
        setIsPlaying(false);
        setPlayMode("continuous");
        timelineSync.setProgress(currentCycle, 1);
      } else {
        // 연속 재생 시 다음 사이클로 전진
        if (currentCycle >= totalCycles) {
          setIsPlaying(false);
        } else {
          advance();
        }
      }
    }, clock.remaining);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (clock.started !== null) {
        clock.remaining = Math.max(0, clock.remaining - (performance.now() - clock.started));
        clock.started = null;
      }
    };
  }, [isPlaying, playSpeed, totalCycles, isSimulationReady, isSingleEngine, currentCycle, playMode, currentData]);

  const pauseForFlow = () => {
    playbackClock.current = null;
    setFinishedSingleFrame(null);
    setIsPlaying(false);
  };

  const handleStepBack = () => {
    setFinishedSingleFrame(null);
    playbackClock.current = null;
    setPlayMode("continuous");
    setIsPlaying((prev) => {
      if (prev) {
        triggerPlaybackFeedback("pause");
      }
      return false;
    });
    onClearSelection();
    setPlaybackRevision((v) => v + 1);
    setCurrentCycle((prev) => {
      const next = Math.max(0, prev - 1);
      if (next === 0) {
        setIsStandby(true);
      }
      return next;
    });
  };

  const handleStepForward = () => {
    setFinishedSingleFrame(null);
    playbackClock.current = null;
    setPlayMode("continuous");
    setIsPlaying((prev) => {
      if (prev) {
        triggerPlaybackFeedback("pause");
      }
      return false;
    });
    onClearSelection();
    setPlaybackRevision((v) => v + 1);
    setIsStandby(false);
    const maxLimit = totalCycles;
    setCurrentCycle((prev) => Math.min(maxLimit, prev + 1));
  };

  // 1회 재생 버튼 핸들러: 현재 사이클(k-1 -> k]을 1회만 재생하고 k에서 멈춤
  const handlePlayCurrentCycle = () => {
    if (!isSimulationReady || totalCycles <= 0) return;
    onClearSelection();
    setFinishedSingleFrame(null);

    // Standby 상태이거나 Cycle 0이면 Cycle 1로 세팅 후 재생
    if (isStandby || currentCycle === 0) {
      setCurrentCycle(1);
      setIsStandby(false);
      setPlayMode("singleCycle");
      if (playbackClock.current) {
        playbackClock.current.remaining = playSpeed;
      }
      setIsPlaying(true);
      setPlaybackRevision((v) => v + 1);
      triggerPlaybackFeedback("play");
      return;
    }

    // 이미 1회 재생 중인 상태에서 다시 1회 버튼을 누르면: 처음부터 다시 1회 반복 재생
    if (isPlaying && playMode === "singleCycle") {
      timelineSync.setProgress(currentCycle, 0);
      if (playbackClock.current) {
        playbackClock.current.remaining = playSpeed;
        playbackClock.current.started = performance.now();
      }
      setPlaybackRevision((v) => v + 1);
      triggerPlaybackFeedback("play");
      return;
    }

    // 일시정지 중이거나 대기 중인 상태에서 1회 재생 시작
    setPlayMode("singleCycle");
    // 해당 사이클이 이미 끝까지 도달(remaining <= 0)한 상태라면 처음(0)부터 다시 재생
    if (playbackClock.current && playbackClock.current.remaining <= 0) {
      playbackClock.current.remaining = playSpeed;
      timelineSync.setProgress(currentCycle, 0);
    }
    setIsStandby(false);
    setIsPlaying(true);
    setPlaybackRevision((v) => v + 1);
    triggerPlaybackFeedback("play");
  };

  // 일반 PLAY / PAUSE 토글 버튼 핸들러 (연속 재생 모드)
  const handleTogglePlay = () => {
    const currentPos = currentCycle;
    const maxPos = totalCycles;

    onClearSelection();
    setFinishedSingleFrame(null);
    setPlayMode("continuous");

    if (currentPos >= maxPos && (!isPlaying && playbackClock.current?.remaining === 0)) {
      setCurrentCycle(1);
      setIsStandby(false);
      setIsPlaying(true);
      setPlaybackRevision((v) => v + 1);
      triggerPlaybackFeedback("play");
    } else {
      const nextState = !isPlaying;
      setIsPlaying(nextState);
      if (nextState) {
        setIsStandby(false);
        if (currentPos === 0) {
          setCurrentCycle(1);
        }
        if (playbackClock.current && playbackClock.current.remaining <= 0) {
          playbackClock.current.remaining = playSpeed;
        }
        setPlaybackRevision((v) => v + 1);
      }
      triggerPlaybackFeedback(nextState ? "play" : "pause");
    }
  };

  const handleReset = () => {
    setFinishedSingleFrame(null);
    setIsPlaying(false);
    setPlayMode("continuous");
    setIsStandby(true);
    onClearSelection();
    setCurrentCycle(0);
    if (playbackClock.current) {
      playbackClock.current.cycle = 0;
      playbackClock.current.frame = null;
      playbackClock.current.remaining = playSpeed;
      playbackClock.current.started = null;
    }
    timelineSync.setProgress(0, 0);
    setPlaybackRevision((v) => v + 1);
    triggerPlaybackFeedback("reset");
  };

  const handleResetAndPlay = () => {
    setFinishedSingleFrame(null);
    onClearSelection();
    setPlayMode("continuous");
    setCurrentCycle(1);
    setIsStandby(false);
    if (playbackClock.current) {
      playbackClock.current.cycle = 1;
      playbackClock.current.remaining = playSpeed;
      playbackClock.current.started = null;
    }
    setIsPlaying(true);
    setPlaybackRevision((v) => v + 1);
    triggerPlaybackFeedback("play");
  };

  const handleJumpToCycle = (val: number) => {
    playbackClock.current = null;
    setPlayMode("continuous");
    setPlaybackRevision(value => value + 1);
    setFinishedSingleFrame(null);
    setIsPlaying((prev) => {
      if (prev) {
        triggerPlaybackFeedback("pause");
      }
      return false;
    });
    onClearSelection();
    if (val === 0) {
      setIsStandby(true);
    } else {
      setIsStandby(false);
    }
    setCurrentCycle(val);
    timelineSync.setProgress(val, 0);
  };

  return {
    currentCycle,
    setCurrentCycle,
    isPlaying,
    setIsPlaying,
    isStandby,
    playSpeed,
    setPlaySpeed,
    totalCycles,
    isSimulationReady,
    playbackFeedback,
    activeCycleIndex,
    currentData,
    singlePlaybackDelay,
    singlePlaybackFrame,
    singleFrame,
    playbackRevision,
    singlePlaybackFinished: isSingleEngine && currentCycle > 0 && finishedSingleFrame === currentData,
    pauseForFlow,
    prevData,
    currentActiveRow,
    activeExecutionCLine,
    effectiveSelectedLine,
    playMode,
    isCyclePlaying: isPlaying && playMode === "singleCycle",
    handlePlayCurrentCycle,
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
