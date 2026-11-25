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
  onResetAndPlay?: () => void;
  onPlayCurrentCycle?: () => void;
  isCyclePlaying?: boolean;
  onStepBack: () => void;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onSelectCode: () => void;
  onSelectViewport: (index: number) => void;
  onSelectAssistant: () => void;
  onOpenTutorial?: () => void;
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
    onPlayCurrentCycle,
    isCyclePlaying = false,
    onStepBack,
    onTogglePlay,
    onStepForward,
    onSelectCode,
    onSelectViewport,
    onSelectAssistant,
    onOpenTutorial,
  }) => {
    return (
      <div className="md:hidden shrink-0 w-full flex flex-col bg-[var(--ar-panel-bg)] border-t border-[var(--ar-border)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] z-30 select-none font-mono">
        {/* 3-1. 하단 시뮬레이션 재생 콘솔 */}
        <div data-tutorial-id="mobile-playback" className="flex flex-col gap-1.5 px-3 py-2">
          {/* 1줄: Cycle 표시 + 슬라이더 + 배속 */}
          <div className="flex items-center gap-2.5 w-full min-w-0">
            <div className="flex items-baseline gap-1 shrink-0 text-[#24292F]">
              <span className="text-[10px] text-[#57606A] uppercase tracking-wider">
                Cycle:
              </span>
              <span
                className={`text-sm font-bold transition-colors ${
                  isSingleEngine
                    ? "text-[#005FB8]"
                    : "text-[#7C3AED]"
                }`}
              >
                {currentCycle}
              </span>
              <span className="text-[10px] text-[#8C959F]">/{maxCycle}</span>
            </div>

            <input
              type="range"
              min={0}
              max={maxCycle}
              disabled={!isSimulationReady || totalCycles <= 1 || isCyclePlaying}
              value={currentCycle}
              onChange={(e) => onJumpToCycle(Number(e.target.value))}
              className={`flex-1 min-w-0 h-1 bg-[#E1E4E8] rounded appearance-none cursor-pointer focus:outline-none transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none ${
                isSingleEngine
                  ? "accent-[#005FB8]"
                  : "accent-[#7C3AED]"
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
                    disabled={!isSimulationReady || isCyclePlaying}
                    onClick={() => onChangeSpeed(speed)}
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none ${
                      isSelected
                        ? isSingleEngine
                          ? "bg-[#005FB8] text-white font-bold"
                          : "bg-[#7C3AED] text-white font-bold"
                        : "text-[#57606A] hover:text-[#24292F]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2줄: 디버그 재생 컨트롤 버튼 5종 + 우측 끝 컴팩트 튜토리얼(?) 버튼 */}
          <div className="relative flex items-center justify-center gap-2 bg-[#F3F4F6] p-1 rounded-md border border-[#D0D7DE]">
            <button
              type="button"
              onClick={onReset}
              disabled={!isSimulationReady || currentCycle === 0 || isCyclePlaying}
              title={isCyclePlaying ? "1회 재생 진행 중..." : "처음으로 초기화 (Reset / Stop)"}
              className="p-1.5 rounded text-[#57606A] hover:text-[#24292F] hover:bg-[#E5E7EB] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onPlayCurrentCycle ?? onResetAndPlay}
              disabled={!isSimulationReady || totalCycles <= 0 || isCyclePlaying}
              title={
                isCyclePlaying
                  ? "현재 사이클 1회 재생 중..."
                  : "현재 사이클 1회 재생 (1-Cycle Play)"
              }
              className={`p-1.5 rounded transition-colors cursor-pointer disabled:cursor-not-allowed ${
                isCyclePlaying
                  ? "text-[#10B981] bg-[#ECFDF5] font-bold ring-1 ring-[#10B981]/50"
                  : "text-[#57606A] hover:text-[#24292F] hover:bg-[#E5E7EB] disabled:opacity-30 disabled:pointer-events-none"
              }`}
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onStepBack}
              disabled={!isSimulationReady || currentCycle <= 0 || isCyclePlaying}
              title={isCyclePlaying ? "1회 재생 진행 중..." : "이전 단계 (Step Back)"}
              className="p-1.5 rounded text-[#57606A] hover:text-[#24292F] hover:bg-[#E5E7EB] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              disabled={!isSimulationReady || totalCycles <= 1 || isCyclePlaying}
              title={isCyclePlaying ? "1회 재생 진행 중..." : isPlaying ? "일시정지 (Pause)" : "재생 (Play)"}
              className={`px-4 py-1 rounded text-[11px] font-bold text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none ${
                isPlaying && !isCyclePlaying
                  ? "bg-[#D97706] hover:bg-[#B45309] text-white font-extrabold"
                  : isSingleEngine
                    ? "bg-[#005FB8] hover:bg-[#004C99]"
                    : "bg-[#7C3AED] hover:bg-[#6D28D9]"
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
              <span className="tracking-wide">{isPlaying && !isCyclePlaying ? "PAUSE" : "PLAY"}</span>
            </button>

            <button
              type="button"
              onClick={onStepForward}
              disabled={!isSimulationReady || currentCycle >= maxCycle || isCyclePlaying}
              title={isCyclePlaying ? "1회 재생 진행 중..." : "한 단계 실행 (Step Over / Forward)"}
              className="p-1.5 rounded text-[#57606A] hover:text-[#24292F] hover:bg-[#E5E7EB] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {onOpenTutorial && (
              <button
                type="button"
                onClick={onOpenTutorial}
                title="화면 사용법 튜토리얼 보기"
                aria-label="모바일 튜토리얼 열기"
                className="absolute right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-[#57606A] hover:text-[var(--ar-accent)] bg-white hover:bg-[#E5E7EB] border border-[#D0D7DE] shadow-2xs transition-colors cursor-pointer"
              >
                ?
              </button>
            )}
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
                  ? "text-[#005FB8] bg-[#005FB8]/8 font-bold"
                  : "text-[#7C3AED] bg-[#7C3AED]/8 font-bold"
                : "text-[#57606A]"
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
                  ? "text-[#005FB8] bg-[#005FB8]/8 font-bold"
                  : "text-[#7C3AED] bg-[#7C3AED]/8 font-bold"
                : "text-[#57606A]"
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
                  ? "text-[#005FB8] bg-[#005FB8]/8 font-bold"
                  : "text-[#7C3AED] bg-[#7C3AED]/8 font-bold"
                : "text-[#57606A]"
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
                  ? "text-[#005FB8] bg-[#005FB8]/8 font-bold"
                  : "text-[#7C3AED] bg-[#7C3AED]/8 font-bold"
                : "text-[#57606A]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="truncate">데이터패스</span>
          </button>

          <button
            type="button"
            data-tutorial-id="mobile-assistant"
            onClick={onSelectAssistant}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors cursor-pointer ${
              !isMobileCodeView && isMobileAssistantViewport
                ? isSingleEngine
                  ? "text-[#005FB8] bg-[#005FB8]/8 font-bold"
                  : "text-[#7C3AED] bg-[#7C3AED]/8 font-bold"
                : "text-[#57606A]"
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
