import { useEffect, useRef, useState } from "react";
import type { buildInstructionFlow } from "../utils/instructionFlow";
import { timelineSync, TIMELINE_END_THRESHOLD } from "../utils/timelineSync";
import InstructionFlowDiagram from "./InstructionFlowDiagram";
import "./SingleInstructionFlow.css";
import type { SimulationResult } from "@/type/simulation";

export default function SingleInstructionFlow({
  flow,
  instructionText,
  duration = 5000,
  isPlaying,
  isCompiled = false,
  playMode = "continuous",
  currentCycle,
  playbackRevision,
  executionStatus,
  playbackFinished,
}: {
  flow: ReturnType<typeof buildInstructionFlow>;
  instructionText?: string;
  duration?: number;
  onPause?: () => void;
  isPlaying?: boolean;
  isCompiled?: boolean;
  playMode?: "continuous" | "singleCycle";
  currentCycle?: number;
  playbackRevision?: number;
  executionStatus?: SimulationResult["execution_status"];
  playbackFinished?: boolean;
}) {
  const flowDuration = duration || 5000;
  const [animProgress, setAnimProgress] = useState<number>(() =>
    flow.actual && !playbackFinished ? (isPlaying ? 0 : 1) : 0,
  );
  const [isSubstepPlaying, setIsSubstepPlaying] = useState<boolean>(
    Boolean(flow.actual && !playbackFinished && (isPlaying ?? false)),
  );

  const progressRef = useRef<number>(animProgress);
  const startTimeRef = useRef<number>(performance.now());
  const pausedProgressRef = useRef<number>(animProgress);
  const prevFlowRef = useRef(flow);
  const prevCycleRef = useRef(currentCycle);
  const prevDurationRef = useRef(flowDuration);
  const prevPlayStateRef = useRef({
    isPlaying: Boolean(isPlaying),
    playbackRevision,
  });

  // 1. 명령어/사이클 변경 시 진행률 리셋 (재생 중이면 0, 정지 상태면 1, 대기 상태면 0)
  useEffect(() => {
    if (prevFlowRef.current !== flow || prevCycleRef.current !== currentCycle) {
      prevFlowRef.current = flow;
      prevCycleRef.current = currentCycle;
      startTimeRef.current = performance.now();
      const initialProg = !flow.actual
        ? 0
        : playbackFinished
          ? 1
          : isPlaying
            ? 0
            : 1;
      progressRef.current = initialProg;
      pausedProgressRef.current = initialProg;
      setAnimProgress(initialProg);
      setIsSubstepPlaying(Boolean(flow.actual && !playbackFinished && isPlaying));
      if (flow.actual || (currentCycle ?? 0) === 0) {
        timelineSync.setProgress(currentCycle ?? 0, flow.actual ? initialProg : 0);
      }
    }
  }, [flow, currentCycle, isPlaying, playbackFinished]);

  // 2. 배속 변경 시 현재 상대 진행률 유지
  useEffect(() => {
    if (prevDurationRef.current !== flowDuration) {
      startTimeRef.current =
        performance.now() - progressRef.current * flowDuration;
      prevDurationRef.current = flowDuration;
    }
  }, [flowDuration]);

  // 3. Play / Pause / singleCycle 제어 (완료 직후 0으로 되돌아가지 않도록 재생 상태 전환 시에만 시작)
  useEffect(() => {
    const prevPlay = prevPlayStateRef.current;
    prevPlayStateRef.current = { isPlaying: Boolean(isPlaying), playbackRevision };

    if (!flow.actual || playbackFinished) {
      const doneProg = flow.actual ? 1 : 0;
      progressRef.current = doneProg;
      pausedProgressRef.current = doneProg;
      setAnimProgress(doneProg);
      setIsSubstepPlaying(false);
      return;
    }

    if (isPlaying) {
      const triggerChanged =
        !prevPlay.isPlaying || prevPlay.playbackRevision !== playbackRevision;
      if (triggerChanged) {
        if (playMode === "singleCycle") {
          startTimeRef.current = performance.now();
          progressRef.current = 0;
          pausedProgressRef.current = 0;
          setAnimProgress(0);
          timelineSync.setProgress(currentCycle ?? 0, 0);
        } else if (
          pausedProgressRef.current > 0 &&
          pausedProgressRef.current < TIMELINE_END_THRESHOLD
        ) {
          startTimeRef.current =
            performance.now() - pausedProgressRef.current * flowDuration;
          progressRef.current = pausedProgressRef.current;
          setAnimProgress(pausedProgressRef.current);
        } else {
          startTimeRef.current = performance.now();
          progressRef.current = 0;
          pausedProgressRef.current = 0;
          setAnimProgress(0);
          timelineSync.setProgress(currentCycle ?? 0, 0);
        }
      }
      setIsSubstepPlaying(true);
    } else {
      const sync = timelineSync.getProgress();
      const snappedToEnd =
        sync.cycle === (currentCycle ?? 0) &&
        sync.progress >= TIMELINE_END_THRESHOLD;
      if (snappedToEnd) {
        progressRef.current = 1;
        pausedProgressRef.current = 1;
        setAnimProgress(1);
      } else {
        const cur = progressRef.current;
        pausedProgressRef.current = cur >= TIMELINE_END_THRESHOLD ? 1.0 : cur;
      }
      setIsSubstepPlaying(false);
    }
  }, [
    flow.actual,
    playbackFinished,
    isPlaying,
    playbackRevision,
    playMode,
    flowDuration,
    currentCycle,
  ]);

  // 4. 60 FPS requestAnimationFrame 루프
  useEffect(() => {
    if (!isPlaying || !isSubstepPlaying) {
      return;
    }

    const startEpoch = timelineSync.getEpoch();
    let frameId: number;
    let lastTick = 0;
    const minFrameInterval = 16;

    const loop = (now: number) => {
      // 스텝 이동/점프 등 수동 스냅 이후 cleanup 전 잔여 프레임이 덮어쓰지 않도록 즉시 중단
      if (timelineSync.getEpoch() !== startEpoch) {
        return;
      }
      frameId = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (now - lastTick < minFrameInterval) return;
      lastTick = now;

      const cycle = currentCycle ?? 0;
      const elapsed = Math.max(0, now - startTimeRef.current);
      const prog = Math.min(1, elapsed / flowDuration);
      progressRef.current = prog;
      setAnimProgress(prog);
      timelineSync.setProgress(cycle, prog);

      if (prog >= 1) {
        pausedProgressRef.current = 1;
      }
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, isSubstepPlaying, playbackRevision, flowDuration, currentCycle]);

  const finished = Boolean(!flow.actual || playbackFinished || animProgress >= 1);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      data-flow-playing={isSubstepPlaying}
      data-flow-elapsed={Math.round(animProgress * flowDuration)}
      data-flow-step-duration={flowDuration}
      data-flow-finished={finished}
    >
      {flow.error && (
        <p role="alert" className="shrink-0 px-3 text-xs text-red-600">
          실행 오류: {flow.error.message ?? flow.error.code}. 확인되지 않은
          데이터 전송은 표시하지 않습니다.
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-hidden px-1 pb-1">
        <InstructionFlowDiagram
          flow={flow}
          instructionText={instructionText}
          animProgress={animProgress}
          isActiveCycle={Boolean(flow.actual)}
          isCompiled={isCompiled}
          executionStatus={executionStatus}
        />
      </div>
    </div>
  );
}
