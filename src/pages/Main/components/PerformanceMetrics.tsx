import React from 'react';
import { getPerformanceStats } from '../simulationView';
import type { SimulationResult, CycleHistoryItem } from '@/type/simulation';

interface PerformanceMetricsProps {
  simulationData: SimulationResult | null;
  currentCycleData?: CycleHistoryItem | null;
  currentCycle: number;
  loadingMessage?: string | null;
}

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  simulationData,
  currentCycle,
  loadingMessage,
}) => {
  const stats = getPerformanceStats(simulationData, currentCycle);

  if (loadingMessage) {
    return (
      <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-xs border border-[var(--ar-border)] flex flex-col min-h-0 overflow-hidden select-none transition-colors duration-150">
        <div className="shrink-0 flex items-center justify-between px-3.5 py-1.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 border-l-2 border-l-emerald-500">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs">📊</span>
            <h3 className="text-xs font-semibold text-[var(--ar-text-primary)] whitespace-nowrap">
              Pipeline Performance & CPI
            </h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
            Ideal CPI: 1.00
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-2">
          <div className="w-6 h-6 border-2.5 border-[#005FB8] dark:border-[#007ACC] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-[#005FB8] dark:text-[#79C0FF]">{loadingMessage}</span>
          <span className="text-[11px] text-[var(--ar-text-muted)]">
            CPI 및 파이프라인 성능 지표를 계산하고 있습니다.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-xs border border-[var(--ar-border)] flex flex-col min-h-0 overflow-hidden select-none transition-colors duration-150">
      {/* 1. 상단 타이틀 바 (지표 전용 에메랄드 액센트 바) */}
      <div className="shrink-0 flex items-center justify-between px-3.5 py-1.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 border-l-2 border-l-emerald-500">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs">📊</span>
          <h3 className="text-xs font-semibold text-[var(--ar-text-primary)] whitespace-nowrap">
            Pipeline Performance & CPI
          </h3>
        </div>
        <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
          Ideal CPI: 1.00
        </span>
      </div>

      {/* 2. 지표 카드 본문 */}
      <div className="flex-1 p-3 flex flex-col justify-between min-h-0 gap-2 overflow-y-auto">
        {/* 상단 2단 KPI 요약 카드 */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          {/* CPI 카드 */}
          <div className="p-2.5 rounded-lg bg-[var(--ar-header-bg)] border border-[var(--ar-border)] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[var(--ar-text-muted)] uppercase tracking-wider">
                CPI (Cycles / Inst)
              </span>
              <span className="text-[10px]">⚡</span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black font-mono text-[var(--ar-accent)]">
                {simulationData ? stats.cpi : '—'}
              </span>
              <span className="text-[10px] text-[var(--ar-text-muted)] font-mono">cycles</span>
            </div>
            <span className="text-[9px] text-[var(--ar-text-muted)] mt-0.5">
              {stats.cpi === '—' ? '완료된 명령어가 없습니다.' : Number(stats.cpi) <= 1.2
                ? '최적의 파이프라인 처리량'
                : '파이프라인 채움·비움 또는 실행 지연 포함'}
            </span>
          </div>

          {/* IPC 카드 */}
          <div className="p-2.5 rounded-lg bg-[#F6F8FA] dark:bg-[#252526] border border-[#D0D7DE] dark:border-[#3E3E42] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#57606A] dark:text-[#858585] uppercase tracking-wider">
                IPC (Inst / Cycle)
              </span>
              <span className="text-[10px]">🎯</span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black font-mono text-emerald-700 dark:text-[#7EE787]">
                {simulationData ? stats.ipc : '—'}
              </span>
              <span className="text-[10px] text-[#8C959F] dark:text-[#6E7681] font-mono">inst/clk</span>
            </div>
            <span className="text-[9px] text-[#57606A] dark:text-[#858585] mt-0.5">
              1클럭당 평균 완수율
            </span>
          </div>
        </div>

        {/* 세부 수치 그리드 */}
        <div className="grid grid-cols-3 gap-1.5 shrink-0 text-center">
          <div className="p-1.5 rounded-lg bg-[#F6F8FA] dark:bg-[#252526] border border-[#D0D7DE] dark:border-[#3E3E42]">
            <span className="text-[9px] text-[#57606A] dark:text-[#858585] block font-semibold">완수 명령어</span>
            <span className="text-xs font-mono font-bold text-[#1F2328] dark:text-[#CCCCCC]">
              {stats.completedInstructions}
            </span>
          </div>
          <div className="p-1.5 rounded-lg bg-[#F6F8FA] dark:bg-[#252526] border border-[#D0D7DE] dark:border-[#3E3E42]">
            <span className="text-[9px] text-[#57606A] dark:text-[#858585] block font-semibold">스톨(Stall)</span>
            <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
              {stats.stalls} 회
            </span>
          </div>
          <div className="p-1.5 rounded-lg bg-[#F6F8FA] dark:bg-[#252526] border border-[#D0D7DE] dark:border-[#3E3E42]">
            <span className="text-[9px] text-[#57606A] dark:text-[#858585] block font-semibold">포워딩</span>
            <span className="text-xs font-mono font-bold text-[#005FB8] dark:text-[#79C0FF]">
              {stats.forwards} 회
            </span>
          </div>
        </div>

        {/* 버블 비율 프로그레스 바 */}
        <div className="p-2 rounded-lg bg-[#F6F8FA] dark:bg-[#252526] border border-[#D0D7DE] dark:border-[#3E3E42] flex flex-col gap-1 shrink-0">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-semibold text-[#57606A] dark:text-[#858585]">파이프라인 버블 비율</span>
            <span className="font-mono font-bold text-[#1F2328] dark:text-[#CCCCCC]">{stats.bubbleRatio}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#E1E4E8] dark:bg-[#333333] rounded-full overflow-hidden flex">
            <div
              className="h-full bg-[#005FB8] dark:bg-[#007ACC] transition-all duration-300"
              style={{ width: `${100 - stats.bubbleRatio}%` }}
              title="유효 연산 비율"
            />
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${stats.bubbleRatio}%` }}
              title="버블(대기) 비율"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMetrics;
