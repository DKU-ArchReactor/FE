import React, { useMemo } from 'react';
import type { SimulationResult } from '@/type/simulation';
import { performanceStats } from './performanceStats';
import TutorPerformanceSummary from './TutorPerformanceSummary';

interface PerformanceMetricsProps {
  simulationData: SimulationResult | null;
  currentCycle: number;
  mode?: "single" | "pipeline";
}

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ simulationData, currentCycle, mode }) => {
  const stats = useMemo(() => performanceStats(simulationData, currentCycle), [simulationData, currentCycle]);
  const isSingle = mode === "single" || stats.isSingle;

  return (
    <div className="w-full max-h-full min-h-0 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] flex flex-col overflow-hidden select-none transition-colors duration-150">
      {/* 1. 상단 타이틀 바 (지표 전용 퍼플 액센트 바) */}
      <div className="h-8 shrink-0 flex items-center justify-between px-3.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 border-l-2 border-l-purple-500">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] text-purple-500 font-bold">◆</span>
          <h3 className="font-sans text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wide whitespace-nowrap">
            PERFORMANCE & CPI
          </h3>
        </div>
        <span className="text-[10px] font-mono text-purple-700 font-semibold px-2 py-0.5 rounded bg-purple-50 border border-purple-200">
          Ideal CPI: 1.00
        </span>
      </div>

      {/* 2. 지표 카드 본문 (펼쳤을 때 최대 높이 초과 시 스크롤바 생성) */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 [scrollbar-gutter:stable]">
        {/* 상단 2단 KPI 요약 카드 */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          {/* CPI 카드 */}
          <div className="p-2.5 rounded-lg bg-[var(--ar-header-bg)] border border-[var(--ar-border)] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[var(--ar-text-muted)] uppercase tracking-wider">
                {isSingle ? "CPI (Steps / Inst)" : "CPI (Cycles / Inst)"}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black font-mono text-[var(--ar-accent)]">
                {simulationData ? stats.cpi : '—'}
              </span>
              <span className="text-[10px] text-[var(--ar-text-muted)] font-mono">{isSingle ? "step/inst" : "clk/inst"}</span>
            </div>
            <span className="text-[9px] text-[var(--ar-text-muted)] mt-0.5">
              {stats.cpi === '—' ? '완료 명령어가 없거나 지표가 제공되지 않았습니다' : isSingle ? '선택 시점까지의 스텝 / 완료 명령어' : '선택 시점까지의 사이클 / 완료 명령어'}
            </span>
          </div>

          {/* IPC 카드 */}
          <div className="p-2.5 rounded-lg bg-[#F6F8FA] border border-[#D0D7DE] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#57606A] uppercase tracking-wider">
                {isSingle ? "IPC (Inst / Step)" : "IPC (Inst / Cycle)"}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black font-mono text-emerald-700">
                {simulationData ? stats.ipc : '—'}
              </span>
              <span className="text-[10px] text-[#8C959F] font-mono">{isSingle ? "inst/step" : "inst/clk"}</span>
            </div>
            <span className="text-[9px] text-[#57606A] mt-0.5">
              {isSingle ? "1스텝당 평균 완수율" : "1클록당 평균 완수율"}
            </span>
          </div>
        </div>

        {/* 세부 수치 그리드 */}
        <div className="grid grid-cols-3 gap-1.5 shrink-0 text-center">
          <div className="p-1.5 rounded-lg bg-[#F6F8FA] border border-[#D0D7DE]">
            <span className="text-[9px] text-[#57606A] block font-semibold">완수 명령어</span>
            <span className="text-xs font-mono font-bold text-[#1F2328]">
              {stats.completedInstructions ?? '—'}
            </span>
          </div>
          <div className="p-1.5 rounded-lg bg-[#F6F8FA] border border-[#D0D7DE]">
            <span className="text-[9px] text-[#57606A] block font-semibold">스톨(Stall)</span>
            <span className="text-xs font-mono font-bold text-amber-600">
              {stats.stalls ?? '—'} 클록
            </span>
          </div>
          <div className="p-1.5 rounded-lg bg-[#F6F8FA] border border-[#D0D7DE]">
            <span className="text-[9px] text-[#57606A] block font-semibold">포워딩 입력</span>
            <span className="text-xs font-mono font-bold text-[#005FB8]">
              {stats.forwards ?? '—'} 회
            </span>
          </div>
        </div>

        {/* 버블 비율 프로그레스 바 */}
        {!stats.isSingle && <div className="p-2 rounded-lg bg-[#F6F8FA] border border-[#D0D7DE] flex flex-col gap-1 shrink-0">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-semibold text-[#57606A]">비어 있거나 취소된 단계 비율</span>
            <span className="font-mono font-bold text-[#1F2328]">{stats.bubbleRatio}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#E1E4E8] rounded-full overflow-hidden flex">
            <div
              className="h-full bg-[#005FB8] transition-all duration-300"
              style={{ width: `${100 - stats.bubbleRatio}%` }}
              title="명령어가 있는 단계 비율"
            />
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${stats.bubbleRatio}%` }}
              title="빈 단계·취소된 단계 비율"
            />
          </div>
        </div>}
        <TutorPerformanceSummary bundle={simulationData?.tutor} historyIndex={stats.totalCycles - 1} />
      </div>
    </div>
  );
};

export default React.memo(PerformanceMetrics);
