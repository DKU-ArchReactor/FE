import React, { useMemo, useEffect, useRef } from 'react';
import type { SimulationResult } from "@/type/simulation";
import { timelineSync } from '../utils/timelineSync';

interface ControlPanelProps {
  currentCycle: number;
  totalCycles: number;
  isPlaying: boolean;
  playSpeed: number; // ms
  onStepBack: () => void;
  onStepForward: () => void;
  onTogglePlay: () => void;
  onReset: () => void;
  onResetAndPlay?: () => void;
  onPlayCurrentCycle?: () => void;
  isCyclePlaying?: boolean;
  onJumpToCycle: (cycle: number) => void;
  onChangeSpeed: (speed: number) => void;
  isReady?: boolean; // 시뮬레이션 데이터 준비 여부
  isCompiling?: boolean; // 컴파일 진행 중 여부
  mode?: "single" | "pipeline"; // Single-Cycle(Serial) 또는 5-Stage Pipeline(Parallel) 모드
  simulationData?: SimulationResult | null; // 전체 히스토리 및 이벤트 정보 (스톨/플러시 등)
  // C ↔ ASM 모드 제어
  editorTarget?: "c" | "asm";
  onChangeEditorTarget?: (target: "c" | "asm") => void;
  // Serial ↔ Parallel 모드 제어
  onChangeSimulationMode?: (mode: "single" | "pipeline") => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  currentCycle,
  totalCycles,
  isPlaying,
  playSpeed,
  onStepBack,
  onStepForward,
  onTogglePlay,
  onReset,
  onResetAndPlay,
  onPlayCurrentCycle,
  isCyclePlaying = false,
  onJumpToCycle,
  onChangeSpeed,
  isReady = true,
  isCompiling = false,
  mode = "pipeline",
  editorTarget = "c",
  onChangeEditorTarget,
  onChangeSimulationMode,
}) => {
  const isSingle = mode === "single";
  // Single 모드 및 Pipeline 모드 모두 Cycle 0(초기 Reset 대기) ~ Cycle totalCycles까지 0~totalCycles 이동
  const maxCycle = totalCycles;

  // 전체 사이클(0 ~ maxCycle)의 모든 사이클 위치에 작은 회색 세로바 배치
  const cycleTicks = useMemo(() => {
    if (!isReady || maxCycle <= 0) return [];
    const ticks: number[] = [];
    for (let c = 0; c <= maxCycle; c++) {
      ticks.push(c);
    }
    return ticks;
  }, [isReady, maxCycle]);

  // rAF를 이용한 부드러운 고정 속도 연속 슬라이딩 (DOM 직접 조작으로 React 리렌더링 병목 및 끊김 완전 제거)
  const trackRef = useRef<HTMLDivElement>(null);
  const fillBarRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  // 현재 연속 진행 위치(0 ~ maxCycle)를 유지하는 ref (PAUSE 시 제자리 정지, PLAY 시 제자리 재개)
  const continuousPosRef = useRef<number>(currentCycle > 0 ? currentCycle : 0);
  const prevCycleRef = useRef<number>(currentCycle);

  // timelineSync를 통한 내부/외부 시뮬레이션 타임라인 실시간 동기화
  useEffect(() => {
    const unsubscribe = timelineSync.subscribe((prog, cycle) => {
      if (maxCycle <= 0) return;
      const base = cycle <= 0 ? 0 : Math.max(0, cycle - 1);
      const continuousPos = base + prog;
      continuousPosRef.current = continuousPos;
      const pct = Math.min(100, Math.max(0, (continuousPos / maxCycle) * 100));
      if (fillBarRef.current) fillBarRef.current.style.width = `${pct}%`;
      if (indicatorRef.current) indicatorRef.current.style.left = `${pct}%`;
    });
    return unsubscribe;
  }, [maxCycle]);

  // 사용자가 수동으로 스텝 이동/점프/리셋했을 때만 위치 동기화 (재생/일시정지 토글 시에는 제자리 유지하여 스냅 점프 방지)
  useEffect(() => {
    if (prevCycleRef.current !== currentCycle) {
      prevCycleRef.current = currentCycle;
      if (!isPlaying) {
        const base = currentCycle <= 0 ? 0 : currentCycle;
        continuousPosRef.current = base;
        const pct = maxCycle > 0 ? Math.min(100, Math.max(0, (base / maxCycle) * 100)) : 0;
        if (fillBarRef.current) fillBarRef.current.style.width = `${pct}%`;
        if (indicatorRef.current) indicatorRef.current.style.left = `${pct}%`;
      }
    }
  }, [currentCycle, maxCycle, isPlaying]);

  // Single-Cycle 모드 전용 연속 이동 (Pipeline 모드는 PipelineVisualizer의 60fps timelineSync가 직접 주도)
  useEffect(() => {
    if (!isPlaying || !isSingle || maxCycle <= 0) return;

    let animId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;

      continuousPosRef.current += delta / playSpeed;
      if (continuousPosRef.current > maxCycle) continuousPosRef.current = maxCycle;

      const pct = (continuousPosRef.current / maxCycle) * 100;
      if (fillBarRef.current) fillBarRef.current.style.width = `${pct}%`;
      if (indicatorRef.current) indicatorRef.current.style.left = `${pct}%`;

      if (continuousPosRef.current < maxCycle) {
        animId = requestAnimationFrame(tick);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, isSingle, playSpeed, maxCycle]);

  const initialPct = maxCycle > 0 ? Math.min(100, Math.max(0, (continuousPosRef.current / maxCycle) * 100)) : 0;

  return (
    <div className="flex-1 h-full bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] px-3 md:px-3.5 flex items-center justify-between gap-3 transition-colors duration-150 select-none font-mono">
      {/* 1. 모드 알약 버튼군 & 사이클/스텝 정보 및 슬라이더 */}
      <div className="flex items-center justify-between md:justify-start gap-2 md:gap-2.5 flex-1 min-w-0">
        {/* [모드 1]: C - ASM 알약 버튼 (좌측 라벨 명시) */}
        <div data-tutorial-id="mode-target" className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-[var(--ar-text-muted)] font-semibold tracking-tight whitespace-nowrap">
            작성 모드:
          </span>
          <div className="inline-flex p-0.5 rounded-full bg-[var(--ar-header-bg)] border border-[var(--ar-border)] shrink-0">
            <button
              type="button"
              disabled={isCompiling || isCyclePlaying}
              onClick={() => onChangeEditorTarget?.("c")}
              title={isCompiling ? "컴파일 중에는 작성 모드를 변경할 수 없습니다" : isCyclePlaying ? "1회 재생 중에는 변경할 수 없습니다" : "C 소스 코드 작성 모드"}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all duration-150 ${
                isCompiling || isCyclePlaying ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              } ${
                editorTarget === "c"
                  ? isSingle
                    ? "bg-[#005FB8] hover:bg-[#004C99] text-white border-[#005FB8] shadow-xs"
                    : "bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-[#7C3AED] shadow-xs"
                  : "border-transparent text-[var(--ar-text-muted)] hover:text-[var(--ar-text-primary)]"
              }`}
            >
              C
            </button>
            <button
              type="button"
              disabled={isCompiling || isCyclePlaying}
              onClick={() => onChangeEditorTarget?.("asm")}
              title={isCompiling ? "컴파일 중에는 작성 모드를 변경할 수 없습니다" : isCyclePlaying ? "1회 재생 중에는 변경할 수 없습니다" : "어셈블리(ASM) 직접 작성 모드"}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all duration-150 ${
                isCompiling || isCyclePlaying ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              } ${
                editorTarget === "asm"
                  ? isSingle
                    ? "bg-[#005FB8] hover:bg-[#004C99] text-white border-[#005FB8] shadow-xs"
                    : "bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-[#7C3AED] shadow-xs"
                  : "border-transparent text-[var(--ar-text-muted)] hover:text-[var(--ar-text-primary)]"
              }`}
            >
              ASM
            </button>
          </div>
        </div>

        {/* [모드 2]: Single - Pipeline 알약 버튼 (좌측 라벨 명시) */}
        <div data-tutorial-id="mode-engine" className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-[var(--ar-text-muted)] font-semibold tracking-tight whitespace-nowrap">
            시뮬레이션 모드:
          </span>
          <div className="inline-flex p-0.5 rounded-full bg-[var(--ar-header-bg)] border border-[var(--ar-border)] shrink-0">
            <button
              type="button"
              disabled={isCyclePlaying}
              onClick={() => onChangeSimulationMode?.("single")}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all duration-150 ${
                isCyclePlaying ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              } ${
                isSingle
                  ? "bg-[var(--ar-mode-single)] hover:bg-[var(--ar-mode-single-hover)] text-white border-[var(--ar-mode-single)] shadow-xs"
                  : "border-transparent text-[var(--ar-text-muted)] hover:text-[var(--ar-text-primary)]"
              }`}
            >
              Single
            </button>
            <button
              type="button"
              disabled={isCyclePlaying}
              onClick={() => onChangeSimulationMode?.("pipeline")}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all duration-150 ${
                isCyclePlaying ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              } ${
                !isSingle
                  ? "bg-[var(--ar-mode-pipeline)] hover:bg-[var(--ar-mode-pipeline-hover)] text-white border-[var(--ar-mode-pipeline)] shadow-xs"
                  : "border-transparent text-[var(--ar-text-muted)] hover:text-[var(--ar-text-primary)]"
              }`}
            >
              Pipeline
            </button>
          </div>
        </div>

        {/* [스텝 / 사이클 정보] */}
        <div className="hidden md:flex items-baseline gap-1.5 shrink-0 text-[#24292F] ml-0.5 w-[84px]">
          <span className="text-[10px] text-[#57606A] uppercase tracking-wider font-medium shrink-0 w-10 text-right">
            {isSingle ? "Step:" : "Cycle:"}
          </span>
          <div className="flex items-baseline gap-0.5 font-mono tabular-nums">
            <span
              className={`text-base font-bold transition-colors ${
                isSingle
                  ? "text-[#005FB8]"
                  : "text-[#7C3AED]"
              }`}
            >
              {currentCycle}
            </span>
            <span className="text-[10px] text-[#8C959F]">
              /{maxCycle}
            </span>
          </div>
        </div>
        
        <div className="hidden md:flex flex-1 min-w-0 items-center gap-2 relative h-full">
          {/* 타임라인 트랙 컨테이너: 가로 바 자체가 세로 정중앙(items-center)에 위치 */}
          <div className="relative w-full h-3 flex items-center">
            {/* 상단 사이클 위치를 나타내는 작은 점들 (트랙 바 위쪽으로 absolute 띄움) */}
            <div className="absolute -top-2 inset-x-0 h-1 pointer-events-none">
              {isReady && maxCycle > 0 && cycleTicks.map((tick) => {
                const tickPos = (tick / maxCycle) * 100;
                return (
                  <div
                    key={`tick-${tick}`}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[2.5px] h-[2.5px] bg-[#94A3B8] rounded-full"
                    style={{ left: `${tickPos}%` }}
                  />
                );
              })}
            </div>

            {/* 배경 트랙 */}
            <div ref={trackRef} className="absolute inset-x-0 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
              {/* 채워진 진행 바 (DOM 직접 조작으로 리렌더링 없이 부드럽게 연속 슬라이딩) */}
              <div
                ref={fillBarRef}
                className={`h-full rounded-full ${
                  isSingle
                    ? "bg-[#005FB8]"
                    : "bg-[#7C3AED]"
                }`}
                style={{
                  width: `${initialPct}%`,
                }}
              />
            </div>

            {/* 현재 재생 위치를 나타내는 슬라이딩 원 (Circle Indicator) */}
            {isReady && totalCycles > 0 && (
              <div
                ref={indicatorRef}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center justify-center will-change-[left]"
                style={{
                  left: `${initialPct}%`,
                }}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full shadow-md border-2 border-white ${
                    isSingle
                      ? "bg-[#005FB8]"
                      : "bg-[#7C3AED]"
                  }`}
                />
              </div>
            )}

            {/* 투명 상호작용 Range Slider (마우스 클릭 & 드래그 탐색 지원) */}
            <input
              type="range"
              min={0}
              max={maxCycle}
              disabled={!isReady || totalCycles <= 1 || isCyclePlaying}
              value={currentCycle}
              onChange={(e) => onJumpToCycle(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-none z-30"
              title={isCyclePlaying ? "1회 재생 진행 중..." : `현재 위치: ${currentCycle}/${maxCycle}`}
            />
          </div>

          {!isReady && (
            <div className="hidden sm:flex items-center gap-1 shrink-0 px-2 py-0.5 rounded bg-[#F6F8FA] border border-[#D0D7DE] text-[#57606A] text-[10px]">
              <span>💡</span>
              <span>C 코드 작성 후 <strong>[컴파일]</strong>을 누르면 시뮬레이터가 동작합니다</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. VS Code 디버그 액션 툴바 (Control Buttons - 모바일 숨김) */}
      <div data-tutorial-id="playback-controls" className="hidden md:flex items-center gap-2 shrink-0">
      <div className="flex items-center gap-0.5 shrink-0 bg-[#F3F4F6] p-0.5 rounded border border-[#D0D7DE]">
        {/* 1) 초기화 버튼 (정사각형 정지/리셋 아이콘) */}
        <button
          onClick={onReset}
          disabled={!isReady || currentCycle === 0 || isCyclePlaying}
          title={isCyclePlaying ? "1회 재생 진행 중..." : "처음으로 초기화 (Reset / Stop)"}
          className="p-1 rounded text-[#57606A] hover:text-[#24292F] hover:bg-[#E5E7EB] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <rect x="5" y="5" width="14" height="14" rx="2" />
          </svg>
        </button>

        {/* 2) 현재 사이클 1회 재생 버튼 (1-Cycle Play) */}
        <button
          type="button"
          onClick={onPlayCurrentCycle ?? onResetAndPlay}
          disabled={!isReady || totalCycles <= 0 || isCyclePlaying}
          title={
            isCyclePlaying
              ? "현재 사이클 1회 재생 중..."
              : "현재 사이클 1회 재생 (Play Current Cycle)"
          }
          className={`p-1 rounded transition-colors cursor-pointer disabled:cursor-not-allowed ${
            isCyclePlaying
              ? "text-[#10B981] bg-[#ECFDF5] font-bold ring-1 ring-[#10B981]/50"
              : "text-[#57606A] hover:text-[#24292F] hover:bg-[#E5E7EB] disabled:opacity-30 disabled:pointer-events-none"
          }`}
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
          </svg>
        </button>

        {/* 3) 이전 스텝/사이클 버튼 */}
        <button
          onClick={onStepBack}
          disabled={!isReady || currentCycle <= 0 || isCyclePlaying}
          title={isCyclePlaying ? "1회 재생 진행 중..." : isSingle ? "이전 스텝 (Step Back)" : "이전 사이클 (Cycle Back)"}
          className="p-1 rounded text-[#57606A] hover:text-[#24292F] hover:bg-[#E5E7EB] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 4) 재생 / 일시정지 (PLAY / PAUSE) 버튼 */}
        <button
          onClick={onTogglePlay}
          disabled={!isReady || totalCycles <= 1 || isCyclePlaying}
          title={isCyclePlaying ? "1회 재생 진행 중..." : isPlaying ? "일시정지 (Pause)" : "재생 (Play)"}
          className={`w-[76px] shrink-0 justify-center py-0.5 rounded text-[11px] font-bold text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none ${
            isPlaying && !isCyclePlaying 
              ? 'bg-[#D97706] hover:bg-[#B45309] text-white font-extrabold' 
              : isSingle
              ? 'bg-[#005FB8] hover:bg-[#004C99]'
              : 'bg-[#7C3AED] hover:bg-[#6D28D9]'
          }`}
        >
          <span className="w-2.5 h-2.5 flex items-center justify-center shrink-0">
            {isPlaying && !isCyclePlaying ? (
              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                <rect x="5" y="4" width="4" height="16" rx="1" />
                <rect x="15" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                <path d="M5 3.868v16.264a1 1 0 001.555.832l13.012-8.132a1 1 0 000-1.664L6.555 3.036A1 1 0 005 3.868z" />
              </svg>
            )}
          </span>
          <span className="w-10 text-center tracking-wide">{isPlaying && !isCyclePlaying ? "PAUSE" : "PLAY"}</span>
        </button>

        {/* 5) 다음 스텝/사이클 버튼 */}
        <button
          onClick={onStepForward}
          disabled={!isReady || currentCycle >= maxCycle || isCyclePlaying}
          title={isCyclePlaying ? "1회 재생 진행 중..." : isSingle ? "다음 스텝 실행 (Step Forward)" : "다음 사이클 진행 (Cycle Forward)"}
          className="p-1 rounded text-[#57606A] hover:text-[#24292F] hover:bg-[#E5E7EB] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 3. 속도 조절 (모바일 숨김) */}
      <div className="hidden md:flex items-center gap-1 shrink-0 border-l border-[#D0D7DE] pl-2 text-[10px]">
        {[
          { label: "0.5x", speed: 6000 },
          { label: "1.0x", speed: 3000 },
          { label: "1.5x", speed: 2000 },
          { label: "2.0x", speed: 1500 },
          { label: "3.0x", speed: 1000 },
        ].map(({ label, speed }) => {
          const isSelected = Math.abs(playSpeed - speed) < 50;
          return (
            <button
              key={label}
              type="button"
              disabled={!isReady || isCyclePlaying}
              onClick={() => onChangeSpeed(speed)}
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none ${
                isSelected
                  ? isSingle
                    ? "bg-[#005FB8] text-white font-bold"
                    : "bg-[#7C3AED] text-white font-bold"
                  : "text-[#57606A] hover:text-[#24292F] hover:bg-[#EAEAEA]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      </div>
    </div>
  );
};

export default ControlPanel;
