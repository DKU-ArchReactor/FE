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
  onJumpToCycle: (cycle: number) => void;
  onChangeSpeed: (speed: number) => void;
  isReady?: boolean; // 시뮬레이션 데이터 준비 여부
  mode?: "single" | "pipeline"; // Single-Cycle 또는 5-Stage Pipeline 모드
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
  onJumpToCycle,
  onChangeSpeed,
  isReady = true,
  mode = "pipeline",
}) => {
  const isSingle = mode === "single";
  // Both modes include the initial state at 0 and every recorded clock.
  const maxCycle = totalCycles;

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-xs border border-slate-200/90 px-4 py-2 flex items-center justify-between gap-4 transition-all">
      {/* 1. 모드 뱃지 & 사이클/스텝 정보 및 슬라이더 */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* 모드 뱃지 */}
        <div className="shrink-0 select-none">
          {isSingle ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>⚡ Single-Cycle</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span>🔄 5-Stage Pipeline</span>
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-1.5 shrink-0 select-none">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {isSingle ? "Step" : "Cycle"}
          </span>
          <span className={`text-lg font-bold font-mono transition-colors ${isReady ? (isSingle ? "text-emerald-600" : "text-blue-600") : "text-slate-400"}`}>
            {currentCycle}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">/ {maxCycle}</span>
        </div>
        
        <div className="flex-1 min-w-0 flex items-center gap-2 relative">
          <input
            type="range"
            min={0}
            max={maxCycle}
            disabled={!isReady || totalCycles === 0}
            value={currentCycle}
            onChange={(e) => onJumpToCycle(Number(e.target.value))}
            className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
              isSingle ? "bg-emerald-100 accent-emerald-600" : "bg-slate-200 accent-blue-600"
            }`}
          />

          {!isReady && (
            <div className="hidden sm:flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-medium select-none">
              <span>💡</span>
              <span>C 코드 작성 후 <strong>[⚡ 컴파일]</strong>을 누르면 시뮬레이션이 활성화됩니다</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. 조작 버튼 그룹 */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onReset}
          disabled={!isReady || currentCycle === 0}
          title="처음으로 리셋"
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <button
          onClick={onStepBack}
          disabled={!isReady || currentCycle <= 0}
          title="이전 사이클 (Step Back)"
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={onTogglePlay}
          disabled={!isReady || totalCycles <= 1}
          title={isPlaying ? "일시정지" : "재생 (Play)"}
          className={`w-[84px] justify-center px-2.5 py-1.5 rounded-xl font-semibold text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-transparent outline-none focus:outline-none focus:ring-0 disabled:opacity-40 disabled:cursor-not-allowed ${
            isPlaying 
              ? 'bg-amber-500 hover:bg-amber-600' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
            {isPlaying ? (
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M5 3.868v16.264a1 1 0 001.555.832l13.012-8.132a1 1 0 000-1.664L6.555 3.036A1 1 0 005 3.868z" />
              </svg>
            )}
          </span>
          <span className="text-xs font-semibold">{isPlaying ? "Pause" : "Play"}</span>
        </button>

        <button
          onClick={onStepForward}
          disabled={!isReady || currentCycle >= maxCycle}
          title="다음 사이클 (Step Forward)"
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 3. 속도 조절: 속도(0.5, 1.0, 1.5, 2.0) 버튼 그룹 */}
      <div className="flex items-center gap-1 shrink-0 border-l border-slate-200 pl-2.5">
        <span className="text-[10.5px] font-medium text-slate-400 select-none">속도:</span>
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
          {[
            { label: "0.5", speed: 2000 },
            { label: "1.0", speed: 1000 },
            { label: "1.5", speed: 666 },
            { label: "2.0", speed: 500 },
          ].map(({ label, speed }) => {
            const isSelected = Math.abs(playSpeed - speed) < 50;
            return (
              <button
                key={label}
                type="button"
                disabled={!isReady}
                onClick={() => onChangeSpeed(speed)}
                className={`px-1.5 py-0.5 text-[10px] font-bold font-mono rounded-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected
                    ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
                title={`초당 ${label}스텝 실행`}
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
