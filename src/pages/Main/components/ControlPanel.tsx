import React from 'react';

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
  onJumpToCycle: (cycle: number) => void;
  onChangeSpeed: (speed: number) => void;
  isReady?: boolean; // 시뮬레이션 데이터 준비 여부
  mode?: "single" | "pipeline"; // Single-Cycle(Serial) 또는 5-Stage Pipeline(Parallel) 모드
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
  onJumpToCycle,
  onChangeSpeed,
  isReady = true,
  mode = "pipeline",
  editorTarget = "c",
  onChangeEditorTarget,
  onChangeSimulationMode,
}) => {
  const isSingle = mode === "single";
  // Single 모드에서는 Step 0(대기) ~ Step totalCycles까지 슬라이더가 0~totalCycles 이동
  const maxCycle = isSingle ? totalCycles : Math.max(0, totalCycles - 1);

  return (
    <div className="flex-1 h-full bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] px-3.5 flex items-center justify-between gap-3 transition-colors duration-150 select-none font-mono">
      {/* 1. 모드 알약 버튼군 & 사이클/스텝 정보 및 슬라이더 */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {/* [모드 1]: C - ASM 알약 버튼 (좌측 라벨 명시) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-[var(--ar-text-muted)] font-semibold tracking-tight">
            작성 모드:
          </span>
          <div className="inline-flex p-0.5 rounded-full bg-[var(--ar-header-bg)] border border-[var(--ar-border)] shrink-0">
            <button
              type="button"
              onClick={() => onChangeEditorTarget?.("c")}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all duration-150 cursor-pointer ${
                editorTarget === "c"
                  ? isSingle
                    ? "bg-[#005FB8] hover:bg-[#004C99] dark:bg-[#007ACC] dark:hover:bg-[#0062A3] text-white border-[#005FB8] dark:border-[#007ACC] shadow-xs"
                    : "bg-[#7C3AED] hover:bg-[#6D28D9] dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED] text-white border-[#7C3AED] dark:border-[#8B5CF6] shadow-xs"
                  : "border-transparent text-[var(--ar-text-muted)] hover:text-[var(--ar-text-primary)]"
              }`}
            >
              C
            </button>
            <button
              type="button"
              onClick={() => onChangeEditorTarget?.("asm")}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all duration-150 cursor-pointer ${
                editorTarget === "asm"
                  ? isSingle
                    ? "bg-[#005FB8] hover:bg-[#004C99] dark:bg-[#007ACC] dark:hover:bg-[#0062A3] text-white border-[#005FB8] dark:border-[#007ACC] shadow-xs"
                    : "bg-[#7C3AED] hover:bg-[#6D28D9] dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED] text-white border-[#7C3AED] dark:border-[#8B5CF6] shadow-xs"
                  : "border-transparent text-[var(--ar-text-muted)] hover:text-[var(--ar-text-primary)]"
              }`}
            >
              ASM
            </button>
          </div>
        </div>

        {/* [모드 2]: Single - Pipeline 알약 버튼 (좌측 라벨 명시) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-[var(--ar-text-muted)] font-semibold tracking-tight">
            시뮬레이션 모드:
          </span>
          <div className="inline-flex p-0.5 rounded-full bg-[var(--ar-header-bg)] border border-[var(--ar-border)] shrink-0">
            <button
              type="button"
              onClick={() => onChangeSimulationMode?.("single")}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all duration-150 cursor-pointer ${
                isSingle
                  ? "bg-[var(--ar-mode-single)] hover:bg-[var(--ar-mode-single-hover)] text-white border-[var(--ar-mode-single)] shadow-xs"
                  : "border-transparent text-[var(--ar-text-muted)] hover:text-[var(--ar-text-primary)]"
              }`}
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => onChangeSimulationMode?.("pipeline")}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all duration-150 cursor-pointer ${
                !isSingle
                  ? "bg-[var(--ar-mode-pipeline)] hover:bg-[var(--ar-mode-pipeline-hover)] text-white border-[var(--ar-mode-pipeline)] shadow-xs"
                  : "border-transparent text-[var(--ar-text-muted)] hover:text-[var(--ar-text-primary)]"
              }`}
            >
              Pipeline
            </button>
          </div>
        </div>

        {/* [사이클 정보] */}
        <div className="flex items-baseline gap-1 shrink-0 text-[#24292F] dark:text-[#CCCCCC] ml-0.5">
          <span className="text-[10px] text-[#57606A] dark:text-[#858585] uppercase tracking-wider">
            Cycle:
          </span>
          <span className={`text-base font-bold transition-colors ${
            isSingle
              ? "text-[#005FB8] dark:text-[#DCDCAA]"
              : "text-[#7C3AED] dark:text-[#C084FC]"
          }`}>
            {currentCycle}
          </span>
          <span className="text-[10px] text-[#8C959F] dark:text-[#6E7681]">/{maxCycle}</span>
        </div>
        
        <div className="flex-1 min-w-0 flex items-center gap-2 relative">
          <input
            type="range"
            min={0}
            max={maxCycle}
            disabled={!isReady || totalCycles <= 1}
            value={currentCycle}
            onChange={(e) => onJumpToCycle(Number(e.target.value))}
            className={`w-full h-1 bg-[#E1E4E8] dark:bg-[#333333] rounded appearance-none cursor-pointer focus:outline-none transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none ${
              isSingle
                ? "accent-[#005FB8] dark:accent-[#007ACC]"
                : "accent-[#7C3AED] dark:accent-[#A855F7]"
            }`}
          />

          {!isReady && (
            <div className="hidden sm:flex items-center gap-1 shrink-0 px-2 py-0.5 rounded bg-[#F6F8FA] dark:bg-[#1E1E1E] border border-[#D0D7DE] dark:border-[#3E3E42] text-[#57606A] dark:text-[#858585] text-[10px]">
              <span>💡</span>
              <span>C 코드 작성 후 <strong>[컴파일]</strong>을 누르면 시뮬레이터가 동작합니다</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. VS Code 디버그 액션 툴바 (Control Buttons) */}
      <div className="flex items-center gap-0.5 shrink-0 bg-[#F3F4F6] dark:bg-[#333333] p-0.5 rounded border border-[#D0D7DE] dark:border-[#3E3E42]">
        {/* 1) 초기화 버튼 (정사각형 정지/리셋 아이콘) */}
        <button
          onClick={onReset}
          disabled={!isReady || currentCycle === 0}
          title="처음으로 초기화 (Reset / Stop)"
          className="p-1 rounded text-[#57606A] dark:text-[#CCCCCC] hover:text-[#24292F] dark:hover:text-white hover:bg-[#E5E7EB] dark:hover:bg-[#454545] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <rect x="5" y="5" width="14" height="14" rx="2" />
          </svg>
        </button>

        {/* 2) 처음부터 다시시작 버튼 (회전 리로드 아이콘) */}
        <button
          type="button"
          onClick={onResetAndPlay}
          disabled={!isReady || totalCycles <= 1}
          title="처음부터 다시시작 (Restart / Reset & Play)"
          className="p-1 rounded text-[#57606A] dark:text-[#CCCCCC] hover:text-[#24292F] dark:hover:text-white hover:bg-[#E5E7EB] dark:hover:bg-[#454545] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
          </svg>
        </button>

        {/* 3) 이전 스텝 버튼 */}
        <button
          onClick={onStepBack}
          disabled={!isReady || currentCycle <= 0}
          title="이전 단계 (Step Back)"
          className="p-1 rounded text-[#57606A] dark:text-[#CCCCCC] hover:text-[#24292F] dark:hover:text-white hover:bg-[#E5E7EB] dark:hover:bg-[#454545] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 4) 재생 / 일시정지 (PLAY / PAUSE) 버튼 */}
        <button
          onClick={onTogglePlay}
          disabled={!isReady || totalCycles <= 1}
          title={isPlaying ? "일시정지 (Pause)" : "재생 (Play)"}
          className={`w-[76px] shrink-0 justify-center py-0.5 rounded text-[11px] font-bold text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none ${
            isPlaying 
              ? 'bg-[#D97706] hover:bg-[#B45309] dark:bg-[#E5B567] dark:hover:bg-[#D4A355] text-white dark:text-black font-extrabold' 
              : isSingle
              ? 'bg-[#005FB8] hover:bg-[#004C99] dark:bg-[#007ACC] dark:hover:bg-[#0062A3]'
              : 'bg-[#7C3AED] hover:bg-[#6D28D9] dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED]'
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
          <span className="w-10 text-center tracking-wide">{isPlaying ? "PAUSE" : "PLAY"}</span>
        </button>

        {/* 5) 다음 스텝 버튼 */}
        <button
          onClick={onStepForward}
          disabled={!isReady || currentCycle >= maxCycle}
          title="한 단계 실행 (Step Over / Forward)"
          className="p-1 rounded text-[#57606A] dark:text-[#CCCCCC] hover:text-[#24292F] dark:hover:text-white hover:bg-[#E5E7EB] dark:hover:bg-[#454545] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 3. 속도 조절 */}
      <div className="flex items-center gap-1 shrink-0 border-l border-[#D0D7DE] dark:border-[#3E3E42] pl-2 text-[10px]">
        {[
          { label: "0.5x", speed: 2000 },
          { label: "1.0x", speed: 1000 },
          { label: "1.5x", speed: 667 },
          { label: "2.0x", speed: 500 },
        ].map(({ label, speed }) => {
          const isSelected = Math.abs(playSpeed - speed) < 50;
          return (
            <button
              key={label}
              type="button"
              disabled={!isReady}
              onClick={() => onChangeSpeed(speed)}
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none ${
                isSelected
                  ? isSingle
                    ? "bg-[#005FB8] dark:bg-[#007ACC] text-white font-bold"
                    : "bg-[#7C3AED] dark:bg-[#8B5CF6] text-white font-bold"
                  : "text-[#57606A] dark:text-[#858585] hover:text-[#24292F] dark:hover:text-[#CCCCCC] hover:bg-[#EAEAEA] dark:hover:bg-[#333333]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ControlPanel;
