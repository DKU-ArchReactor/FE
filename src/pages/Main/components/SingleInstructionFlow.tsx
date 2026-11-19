import { useCallback, useEffect, useMemo, useState } from "react";
import {
  instructionTransfers,
  instructionPaths,
  transferTimeline,
  singleFlowDuration,
  type TransferUnit,
  type buildInstructionFlow,
} from "../utils/instructionFlow";
import InstructionFlowDiagram from "./InstructionFlowDiagram";
import "./SingleInstructionFlow.css";

export default function SingleInstructionFlow({
  flow,
  duration = singleFlowDuration(1000),
  onPause,
  isPlaying,
}: {
  flow: ReturnType<typeof buildInstructionFlow>;
  duration?: number;
  onPause?: () => void;
  isPlaying?: boolean;
}) {
  const transfers = useMemo(() => instructionTransfers(flow), [flow]);
  const [scale, setScale] = useState(1);
  const paths = useMemo(() => instructionPaths(flow, scale), [flow, scale]);
  const timeline = useMemo(
    () => transferTimeline(transfers, paths, duration),
    [transfers, paths, duration],
  );
  const totalDuration = timeline.length * timeline[0].duration;
  const [clock, setClock] = useState({
    elapsed: 0,
    running: flow.actual && (isPlaying ?? true),
    globalPlaying: isPlaying,
  });
  // Global Pause also applies to a new frame mounted at the same playback boundary.
  if (isPlaying != null && clock.globalPlaying !== isPlaying)
    setClock({
      ...clock,
      globalPlaying: isPlaying,
      running: isPlaying === true,
      elapsed: isPlaying && clock.elapsed >= totalDuration ? 0 : clock.elapsed,
    });
  useEffect(() => {
    if (!clock.running) return;
    let frame = 0,
      previous = performance.now();
    const tick = (now: number) => {
      // RAF's frame timestamp can precede an effect created later in that same frame.
      const delta = Math.max(0, now - previous);
      previous = now;
      setClock((value) => {
        if (!value.running) return value;
        const elapsed = Math.min(totalDuration, value.elapsed + delta);
        return { ...value, elapsed, running: elapsed < totalDuration };
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clock.running, totalDuration]);
  const activeIndex = timeline.findIndex(
    (entry) => clock.elapsed < entry.start + entry.duration,
  );
  const index = activeIndex < 0 ? timeline.length - 1 : activeIndex;
  const entry = timeline[index];
  const progress = entry.travel
    ? Math.max(
        0,
        Math.min(1, (clock.elapsed - entry.start - entry.lead) / entry.travel),
      )
    : Math.min(1, (clock.elapsed - entry.start) / entry.duration);
  const arrived = useMemo(
    () => transfers.slice(0, index).map((value) => value.id),
    [transfers, index],
  );
  const seek = useCallback(
    (target: number) => {
      onPause?.();
      setClock({
        elapsed:
          timeline[Math.max(0, Math.min(transfers.length - 1, target))].start,
        running: false,
        globalPlaying: false,
      });
    },
    [onPause, timeline, transfers.length],
  );
  const chooseUnit = useCallback(
    (unit: TransferUnit) => {
      if (unit === "memory" && (flow.load || flow.store)) {
        seek(transfers.findIndex((value) => value.id === "memory-address"));
        return;
      }
      const target = transfers.findIndex(
        (value) => value.target === unit || value.source === unit,
      );
      seek(target < 0 ? 0 : target);
    },
    [flow.load, flow.store, seek, transfers],
  );
  const toggle = () => {
    onPause?.();
    setClock((value) => ({
      ...value,
      globalPlaying: false,
      running: !value.running,
      elapsed: value.elapsed >= totalDuration ? 0 : value.elapsed,
    }));
  };
  const replay = () => {
    onPause?.();
    setClock({ elapsed: 0, running: true, globalPlaying: false });
  };
  const button =
    "rounded-md border border-[var(--ar-border)] px-2.5 py-1.5 text-xs disabled:opacity-35 hover:bg-[var(--ar-header-bg)]";
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      data-flow-playing={clock.running}
      data-flow-elapsed={clock.elapsed}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2">
        <span className="text-[11px] text-[var(--ar-text-muted)]">
          {clock.running ? "흐름 재생 중" : "흐름 일시정지"} · 전체{" "}
          {Number((totalDuration / 1000).toFixed(1))}초
        </span>
        <div
          className="flex items-center gap-1.5"
          role="group"
          aria-label="데이터 흐름 재생 조작"
        >
          <button
            type="button"
            className={button}
            disabled={index === 0}
            onClick={() => seek(index - 1)}
            aria-label="이전 흐름"
          >
            이전
          </button>
          <button
            type="button"
            className={button}
            onClick={toggle}
            aria-label={clock.running ? "흐름 일시정지" : "흐름 재생"}
          >
            {clock.running ? "일시정지" : "재생"}
          </button>
          <button
            type="button"
            className={button}
            disabled={index >= transfers.length - 1}
            onClick={() => seek(index + 1)}
            aria-label="다음 흐름"
          >
            다음
          </button>
          <button
            type="button"
            className={button}
            onClick={replay}
            aria-label="흐름 다시 보기"
          >
            다시 보기
          </button>
        </div>
      </div>
      {flow.error && (
        <p role="alert" className="shrink-0 px-3 text-xs text-red-600">
          실행 오류: {flow.error.message ?? flow.error.code}. 확인되지 않은
          데이터 전송은 표시하지 않습니다.
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-hidden px-1 pb-1">
        <InstructionFlowDiagram
          flow={flow}
          transfer={transfers[index]}
          progress={progress}
          index={index}
          count={transfers.length}
          arrived={arrived}
          onScale={setScale}
          onUnit={chooseUnit}
        />
      </div>
      <p className="sr-only">
        시스템 버스는 CPU와 메모리 사이의 주소·데이터·제어 역할을 설명한
        개념도입니다. 실제 공유 버스 회로나 하드웨어 지연을 재현한 것은
        아닙니다.
      </p>
    </div>
  );
}
