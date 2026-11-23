import React, { memo } from "react";

interface MobileWorkspaceControlsProps {
  currentCycle: number;
  maxCycle: number;
  totalCycles: number;
  playSpeed: number;
  isPlaying: boolean;
  isSimulationReady: boolean;
  isSingleEngine: boolean;
  isMobileCodeView: boolean;
  isMobileAssistantViewport: boolean;
  rightViewportIndex: number;
  onJumpToCycle: (cycle: number) => void;
  onChangeSpeed: (speed: number) => void;
  onReset: () => void;
  onResetAndPlay: () => void;
  onStepBack: () => void;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onSelectCode: () => void;
  onSelectViewport: (index: number) => void;
  onSelectAssistant: () => void;
}

export const MobileWorkspaceControls: React.FC<MobileWorkspaceControlsProps> = memo(
  ({
    currentCycle,
    maxCycle,
    totalCycles,
    playSpeed,
    isPlaying,
    isSimulationReady,
    isSingleEngine,
    isMobileCodeView,
    isMobileAssistantViewport,
    rightViewportIndex,
    onJumpToCycle,
    onChangeSpeed,
    onReset,
    onResetAndPlay,
    onStepBack,
    onTogglePlay,
    onStepForward,
    onSelectCode,
    onSelectViewport,
    onSelectAssistant,
  }) => {
    return (
      <div className="md:hidden shrink-0 w-full flex flex-col bg-[var(--ar-panel-bg)] border-t border-[var(--ar-border)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] z-30 select-none font-mono">
        {/* 3-1. 하단 시뮬레이션 재생 콘솔 */}
        <div className="flex flex-col gap-1.5 px-3 py-2">
          {/* 1줄: Cycle 표시 + 슬라이더 + 배속 */}
          <div className="flex items-center gap-2.5 w-full min-w-0">
            <div className="flex items-baseline gap-1 shrink-0 text-[#24292F] dark:text-[#CCCCCC]">
              <span className="text-[10px] text-[#57606A] dark:text-[#858585] uppercase tracking-wider">
                Cycle:
              </span>
              <span
                className={`text-sm font-bold transition-colors ${
                  isSingleEngine
                    ? "text-[#005FB8] dark:text-[#DCDCAA]"
                    : "text-[#7C3AED] dark:text-[#C084FC]"
                }`}
              >
                {currentCycle}
              </span>
              <span className="text-[10px] text-[#8C959F] dark:text-[#6E7681]">/{maxCycle}</span>
            </div>

            <input
              type="range"
              min={0}
              max={maxCycle}
              disabled={!isSimulationReady || totalCycles <= 1}
              value={currentCycle}
              onChange={(e) => onJumpToCycle(Number(e.target.value))}
              className={`flex-1 min-w-0 h-1 bg-[#E1E4E8] dark:bg-[#333333] rounded appearance-none cursor-pointer focus:outline-none transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none ${
                isSingleEngine
                  ? "accent-[#005FB8] dark:accent-[#007ACC]"
                  : "accent-[#7C3AED] dark:accent-[#A855F7]"
              }`}
            />

            <div className="flex items-center gap-0.5 shrink-0 text-[9.5px]">
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
                    disabled={!isSimulationReady}
                    onClick={() => onChangeSpeed(speed)}
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none ${
                      isSelected
                        ? isSingleEngine
                          ? "bg-[#005FB8] dark:bg-[#007ACC] text-white font-bold"
                          : "bg-[#7C3AED] dark:bg-[#8B5CF6] text-white font-bold"
                        : "text-[#57606A] dark:text-[#858585] hover:text-[#24292F] dark:hover:text-[#CCCCCC]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2줄: 디버그 재생 컨트롤 버튼 5종 */}
          <div className="flex items-center justify-center gap-2 bg-[#F3F4F6] dark:bg-[#252526] p-1 rounded-md border border-[#D0D7DE] dark:border-[#3E3E42]">
            <button
              type="button"
              onClick={onReset}
              disabled={!isSimulationReady || currentCycle === 0}
              title="처음으로 초기화 (Reset / Stop)"
              className="p-1.5 rounded text-[#57606A] dark:text-[#CCCCCC] hover:text-[#24292F] dark:hover:text-white hover:bg-[#E5E7EB] dark:hover:bg-[#3A3A3A] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onResetAndPlay}
              disabled={!isSimulationReady || totalCycles <= 1}
              title="처음부터 다시시작 (Restart / Reset & Play)"
              className="p-1.5 rounded text-[#57606A] dark:text-[#CCCCCC] hover:text-[#24292F] dark:hover:text-white hover:bg-[#E5E7EB] dark:hover:bg-[#3A3A3A] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onStepBack}
              disabled={!isSimulationReady || currentCycle <= 0}
              title="이전 단계 (Step Back)"
              className="p-1.5 rounded text-[#57606A] dark:text-[#CCCCCC] hover:text-[#24292F] dark:hover:text-white hover:bg-[#E5E7EB] dark:hover:bg-[#3A3A3A] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              disabled={!isSimulationReady || totalCycles <= 1}
              title={isPlaying ? "일시정지 (Pause)" : "재생 (Play)"}
              className={`px-4 py-1 rounded text-[11px] font-bold text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none ${
                isPlaying
                  ? "bg-[#D97706] hover:bg-[#B45309] dark:bg-[#E5B567] dark:hover:bg-[#D4A355] text-white dark:text-black font-extrabold"
                  : isSingleEngine
                    ? "bg-[#005FB8] hover:bg-[#004C99] dark:bg-[#007ACC] dark:hover:bg-[#0062A3]"
                    : "bg-[#7C3AED] hover:bg-[#6D28D9] dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED]"
              }`}
            >
              <span className="w-2.5 h-2.5 flex items-center justify-center shrink-0">
                {isPlaying ? (
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
              <span className="tracking-wide">{isPlaying ? "PAUSE" : "PLAY"}</span>
            </button>

            <button
              type="button"
              onClick={onStepForward}
              disabled={!isSimulationReady || currentCycle >= maxCycle}
              title="한 단계 실행 (Step Over / Forward)"
              className="p-1.5 rounded text-[#57606A] dark:text-[#CCCCCC] hover:text-[#24292F] dark:hover:text-white hover:bg-[#E5E7EB] dark:hover:bg-[#3A3A3A] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* 3-2. 바닥 밀착 5버튼 바텀바 (코드 + 뷰포트 3종 + 어시스턴트) */}
        <nav className="grid grid-cols-5 h-12 border-t border-[var(--ar-border)] bg-[var(--ar-header-bg)] font-sans">
          <button
            type="button"
            onClick={onSelectCode}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors cursor-pointer ${
              isMobileCodeView
                ? isSingleEngine
                  ? "text-[#005FB8] dark:text-[#38BDF8] bg-[#005FB8]/8 dark:bg-[#007ACC]/15 font-bold"
                  : "text-[#7C3AED] dark:text-[#C084FC] bg-[#7C3AED]/8 dark:bg-[#8B5CF6]/15 font-bold"
                : "text-[#57606A] dark:text-[#858585]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span className="truncate">코드</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectViewport(0)}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors cursor-pointer ${
              !isMobileCodeView && !isMobileAssistantViewport && rightViewportIndex === 0
                ? isSingleEngine
                  ? "text-[#005FB8] dark:text-[#38BDF8] bg-[#005FB8]/8 dark:bg-[#007ACC]/15 font-bold"
                  : "text-[#7C3AED] dark:text-[#C084FC] bg-[#7C3AED]/8 dark:bg-[#8B5CF6]/15 font-bold"
                : "text-[#57606A] dark:text-[#858585]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="truncate">레지스터·메모리</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectViewport(1)}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors cursor-pointer ${
              !isMobileCodeView && !isMobileAssistantViewport && rightViewportIndex === 1
                ? isSingleEngine
                  ? "text-[#005FB8] dark:text-[#38BDF8] bg-[#005FB8]/8 dark:bg-[#007ACC]/15 font-bold"
                  : "text-[#7C3AED] dark:text-[#C084FC] bg-[#7C3AED]/8 dark:bg-[#8B5CF6]/15 font-bold"
                : "text-[#57606A] dark:text-[#858585]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span className="truncate">분석·지표</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectViewport(2)}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors cursor-pointer ${
              !isMobileCodeView && !isMobileAssistantViewport && rightViewportIndex === 2
                ? isSingleEngine
                  ? "text-[#005FB8] dark:text-[#38BDF8] bg-[#005FB8]/8 dark:bg-[#007ACC]/15 font-bold"
                  : "text-[#7C3AED] dark:text-[#C084FC] bg-[#7C3AED]/8 dark:bg-[#8B5CF6]/15 font-bold"
                : "text-[#57606A] dark:text-[#858585]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="truncate">데이터패스</span>
          </button>

          <button
            type="button"
            onClick={onSelectAssistant}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors cursor-pointer ${
              !isMobileCodeView && isMobileAssistantViewport
                ? isSingleEngine
                  ? "text-[#005FB8] dark:text-[#38BDF8] bg-[#005FB8]/8 dark:bg-[#007ACC]/15 font-bold"
                  : "text-[#7C3AED] dark:text-[#C084FC] bg-[#7C3AED]/8 dark:bg-[#8B5CF6]/15 font-bold"
                : "text-[#57606A] dark:text-[#858585]"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
            <span className="truncate">어시스턴트</span>
          </button>
        </nav>
      </div>
    );
  }
);
