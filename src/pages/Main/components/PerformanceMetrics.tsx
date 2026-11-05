import React from 'react';
import { getPerformanceStats } from '../simulationView';
import type { SimulationResult, CycleHistoryItem } from '@/type/simulation';

interface PerformanceMetricsProps {
  simulationData: SimulationResult | null;
  currentCycleData?: CycleHistoryItem | null;
  currentCycle: number;
}

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  simulationData,
  currentCycle,
}) => {
  const stats = getPerformanceStats(simulationData, currentCycle);

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-xs border border-slate-200 flex flex-col min-h-0 overflow-hidden select-none">
      {/* 1. 상단 타이틀 바 */}
      <div className="shrink-0 flex items-center justify-between px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-200/80 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs">📊</span>
          <h3 className="text-xs font-bold text-slate-800 whitespace-nowrap">
            Pipeline Performance & CPI
          </h3>
        </div>
        <span className="text-[10px] font-mono text-emerald-600 font-semibold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
          Ideal CPI: 1.00
        </span>
      </div>

      {/* 2. 지표 카드 본문 */}
      <div className="flex-1 p-3 flex flex-col justify-between min-h-0 gap-2 overflow-y-auto">
        {/* 상단 2단 KPI 요약 카드 */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          {/* CPI 카드 */}
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border border-blue-100 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                CPI (Cycles / Inst)
              </span>
              <span className="text-[10px]">⚡</span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black font-mono text-blue-700">
                {simulationData ? stats.cpi : '—'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">cycles</span>
            </div>
            <span className="text-[9px] text-slate-500 mt-0.5">
              {stats.cpi === '—' ? '완료된 명령어가 없습니다.' : Number(stats.cpi) <= 1.2
                ? '최적의 파이프라인 처리량'
                : '파이프라인 채움·비움 또는 실행 지연 포함'}
            </span>
          </div>

          {/* IPC 카드 */}
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border border-emerald-100 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                IPC (Inst / Cycle)
              </span>
              <span className="text-[10px]">🎯</span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black font-mono text-emerald-700">
                {simulationData ? stats.ipc : '—'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">inst/clk</span>
            </div>
            <span className="text-[9px] text-slate-500 mt-0.5">
              1클럭당 평균 완수율
            </span>
          </div>
        </div>

        {/* 세부 수치 그리드 */}
        <div className="grid grid-cols-3 gap-1.5 shrink-0 text-center">
          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/70">
            <span className="text-[9px] text-slate-400 block font-semibold">완수 명령어</span>
            <span className="text-xs font-mono font-bold text-slate-800">
              {stats.completedInstructions}
            </span>
          </div>
          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/70">
            <span className="text-[9px] text-slate-400 block font-semibold">스톨(Stall)</span>
            <span className="text-xs font-mono font-bold text-amber-600">
              {stats.stalls} 회
            </span>
          </div>
          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/70">
            <span className="text-[9px] text-slate-400 block font-semibold">포워딩</span>
            <span className="text-xs font-mono font-bold text-indigo-600">
              {stats.forwards} 회
            </span>
          </div>
        </div>

        {/* 버블 비율 프로그레스 바 */}
        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col gap-1 shrink-0">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-semibold text-slate-600">파이프라인 버블 비율</span>
            <span className="font-mono font-bold text-slate-700">{stats.bubbleRatio}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${100 - stats.bubbleRatio}%` }}
              title="유효 연산 비율"
            />
            <div
              className="h-full bg-amber-400 transition-all duration-300"
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
