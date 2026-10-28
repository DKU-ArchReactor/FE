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
}) => {
  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-2.5 flex items-center justify-between gap-3">
      {/* 1. 사이클 정보 및 슬라이더 */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cycle</span>
          <span className="text-lg font-bold font-mono text-blue-600">{currentCycle}</span>
          <span className="text-[11px] text-slate-400">/ {Math.max(0, totalCycles - 1)}</span>
        </div>
        
        <input
          type="range"
          min={0}
          max={Math.max(0, totalCycles - 1)}
          value={currentCycle}
          onChange={(e) => onJumpToCycle(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
        />
      </div>

      {/* 2. 조작 버튼 그룹 */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onReset}
          title="처음으로 리셋"
          className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <button
          onClick={onStepBack}
          disabled={currentCycle <= 0}
          title="이전 사이클"
          className={`p-1.5 rounded-xl transition-colors ${
            currentCycle <= 0 
              ? 'text-slate-300 cursor-not-allowed' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={onTogglePlay}
          title={isPlaying ? "일시정지" : "재생"}
          className={`px-3 py-1.5 rounded-xl font-semibold text-white shadow-sm transition-all flex items-center gap-1.5 ${
            isPlaying 
              ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' 
              : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
          }`}
        >
          {isPlaying ? (
            <>
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              <span className="text-xs">Pause</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M5 3.868v16.264a1 1 0 001.555.832l13.012-8.132a1 1 0 000-1.664L6.555 3.036A1 1 0 005 3.868z" />
              </svg>
              <span className="text-xs">Play</span>
            </>
          )}
        </button>

        <button
          onClick={onStepForward}
          disabled={currentCycle >= totalCycles - 1}
          title="다음 사이클"
          className={`p-1.5 rounded-xl transition-colors ${
            currentCycle >= totalCycles - 1 
              ? 'text-slate-300 cursor-not-allowed' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 3. 속도 조절 */}
      <div className="flex items-center gap-1 shrink-0 border-l border-slate-100 pl-3">
        <span className="text-[11px] font-medium text-slate-400">속도:</span>
        <select
          value={playSpeed}
          onChange={(e) => onChangeSpeed(Number(e.target.value))}
          className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value={1500}>0.5x</option>
          <option value={800}>1.0x</option>
          <option value={400}>2.0x</option>
          <option value={150}>4.0x</option>
        </select>
      </div>
    </div>
  );
};

export default ControlPanel;
