import React, { useMemo } from 'react';
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
  const history = simulationData?.history ?? [];

  // 메트릭스 계산 (전체 시뮬레이션 기준 & 현재 사이클까지의 기준)
  const stats = useMemo(() => {
    if (!history.length) {
      return {
        completedInstructions: 0,
        totalCycles: 0,
        cpi: '1.00',
        ipc: '1.00',
        stalls: 0,
        forwards: 0,
        bubbleRatio: 0,
      };
    }

    // 현재 사이클까지 WB를 완료한 고유 명령어 개수 추적
    const wbInstructions = new Set<string>();
    let totalStalls = 0;
    let totalForwards = 0;
    let totalBubbles = 0;

    for (let i = 0; i <= Math.min(currentCycle, history.length - 1); i++) {
      const item = history[i];
      if (item.buffers.WB?.assembly && item.buffers.WB?.status !== 'bubble') {
        const key = `${item.buffers.WB.pc}_${item.buffers.WB.assembly}`;
        wbInstructions.add(key);
      }
      if (item.cycle_events.stall?.has_stall) totalStalls++;
      if (item.cycle_events.forwarding?.has_forwarded) totalForwards++;

      // 5개 스테이지 중 버블 개수
      Object.values(item.buffers).forEach((b) => {
        if (!b || b.status === 'bubble' || b.assembly === 'bubble') {
          totalBubbles++;
        }
      });
    }

    const completed = Math.max(1, wbInstructions.size);
    const activeCycles = Math.max(1, currentCycle + 1);
    const cpiVal = (activeCycles / completed).toFixed(2);
    const ipcVal = (completed / activeCycles).toFixed(2);
    const totalSlotCount = activeCycles * 5;
    const bubbleRatio = Math.round((totalBubbles / totalSlotCount) * 100);

    return {
      completedInstructions: wbInstructions.size,
      totalCycles: activeCycles,
      cpi: cpiVal,
      ipc: ipcVal,
      stalls: totalStalls,
      forwards: totalForwards,
      bubbleRatio: Math.min(100, bubbleRatio),
    };
  }, [history, currentCycle]);

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
              {Number(stats.cpi) <= 1.2
                ? '최적의 파이프라인 처리량'
                : '스톨 발생으로 지연 증가'}
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
