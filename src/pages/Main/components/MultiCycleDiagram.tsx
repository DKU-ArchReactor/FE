import React, { useMemo, useRef, useEffect } from 'react';
import type { SimulationResult, CycleHistoryItem } from '@/type/simulation';

interface MultiCycleDiagramProps {
  simulationData: SimulationResult | null;
  currentCycleData: CycleHistoryItem | null;
  currentCycle: number;
  translationAssembly?: string;
  onJumpToCycle?: (cycle: number) => void;
}

const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  IF: { bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-600' },
  ID: { bg: 'bg-sky-500', text: 'text-white', border: 'border-sky-600' },
  EX: { bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-600' },
  MEM: { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' },
  WB: { bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-600' },
  stall: { bg: 'bg-red-100', text: 'text-red-700 font-bold', border: 'border-red-300' },
  flush: { bg: 'bg-purple-100', text: 'text-purple-700 font-bold', border: 'border-purple-300' },
};

export const MultiCycleDiagram: React.FC<MultiCycleDiagramProps> = ({
  simulationData,
  currentCycle,
  onJumpToCycle,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const history = simulationData?.history ?? [];
  const totalCycles = history.length;

  // 1. 전체 파이프라인 히스토리에서 등장한 고유 실행 명령어(PC 기준) 추출
  const instructions = useMemo(() => {
    if (!history.length) return [];
    const instMap = new Map<string, { pc: string; assembly: string }>();

    history.forEach((item) => {
      // IF, ID, EX, MEM, WB 순으로 명령어 수집
      ['IF', 'ID', 'EX', 'MEM', 'WB'].forEach((stageKey) => {
        const buf = item.buffers[stageKey as keyof typeof item.buffers];
        if (buf && buf.pc && buf.assembly && buf.assembly !== 'bubble' && buf.assembly !== 'empty') {
          const cleanPc = buf.pc.toLowerCase();
          if (!instMap.has(cleanPc)) {
            instMap.set(cleanPc, {
              pc: buf.pc,
              assembly: buf.assembly,
            });
          }
        }
      });
    });

    return Array.from(instMap.values());
  }, [history]);

  // 2. 각 명령어(행) x 각 사이클(열)에 어떤 stage("IF"|"ID"|"EX"|"MEM"|"WB"|"stall")에 있었는지 행렬 계산
  const gridData = useMemo(() => {
    if (!history.length || !instructions.length) return [];

    return instructions.map((inst) => {
      const targetPc = inst.pc.toLowerCase();

      const stagesByCycle = history.map((item) => {
        const buffers = item.buffers;
        let foundStage: { stage: string; hasStall?: boolean } | null = null;

        // WB부터 역순 검사
        if (buffers.WB?.pc?.toLowerCase() === targetPc && buffers.WB?.status !== 'bubble') {
          foundStage = { stage: 'WB' };
        } else if (buffers.MEM?.pc?.toLowerCase() === targetPc && buffers.MEM?.status !== 'bubble') {
          foundStage = { stage: 'MEM' };
        } else if (buffers.EX?.pc?.toLowerCase() === targetPc && buffers.EX?.status !== 'bubble') {
          foundStage = { stage: 'EX' };
        } else if (buffers.ID?.pc?.toLowerCase() === targetPc && buffers.ID?.status !== 'bubble') {
          foundStage = {
            stage: 'ID',
            hasStall: item.cycle_events.stall?.has_stall,
          };
        } else if (buffers.IF?.pc?.toLowerCase() === targetPc && buffers.IF?.status !== 'bubble') {
          foundStage = { stage: 'IF' };
        }

        return foundStage;
      });

      return {
        inst,
        stagesByCycle,
      };
    });
  }, [history, instructions]);

  // 현재 재생 중인 사이클이 화면 가운데 보이도록 자동 스크롤
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const colWidth = 36;
    const targetScrollLeft = Math.max(0, currentCycle * colWidth - 120);
    scrollContainerRef.current.scrollTo({
      left: targetScrollLeft,
      behavior: 'smooth',
    });
  }, [currentCycle]);

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-xs border border-slate-200 flex flex-col min-h-0 overflow-hidden select-none">
      {/* 1. 상단 타이틀 바 */}
      <div className="shrink-0 flex items-center justify-between px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-200/80 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs">📈</span>
          <h3 className="text-xs font-bold text-slate-800 whitespace-nowrap">
            Multi-Cycle Pipeline Diagram
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* 스테이지 컬러 레전드 미니 뱃지 */}
          <div className="hidden sm:flex items-center gap-1 text-[9px] font-mono font-bold">
            <span className="px-1 py-0.2 rounded bg-indigo-500 text-white">IF</span>
            <span className="px-1 py-0.2 rounded bg-sky-500 text-white">ID</span>
            <span className="px-1 py-0.2 rounded bg-amber-500 text-white">EX</span>
            <span className="px-1 py-0.2 rounded bg-emerald-500 text-white">MEM</span>
            <span className="px-1 py-0.2 rounded bg-rose-500 text-white">WB</span>
            <span className="px-1 py-0.2 rounded bg-red-100 text-red-700 border border-red-200">Stall</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 font-semibold px-2 py-0.5 rounded-full bg-slate-200/60">
            {totalCycles > 0 ? `${totalCycles} Cycles` : 'Ready'}
          </span>
        </div>
      </div>

      {/* 2. 매트릭스 그리드 테이블 */}
      {!simulationData || gridData.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-slate-400 gap-1.5">
          <span className="text-xl">📊</span>
          <span className="text-xs font-semibold text-slate-500">
            시뮬레이션을 실행하면 멀티사이클 파이프라인 다이어그램이 생성됩니다
          </span>
          <span className="text-[11px] text-slate-400">
            명령어별 시간 흐름(CC)과 스톨/버블 발생 위치를 교과서 표 형태로 추적합니다.
          </span>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* 왼쪽 고정 열: 명령어 목록 (Assembly) */}
          <div className="w-36 shrink-0 border-r border-slate-200 bg-slate-50/50 flex flex-col min-h-0 z-10 shadow-xs">
            {/* 고정 헤더 셀 */}
            <div className="h-7 shrink-0 px-2 flex items-center justify-between border-b border-slate-200 text-[10px] font-bold text-slate-500">
              <span>Instruction</span>
              <span>PC</span>
            </div>
            {/* 명령어 리스트 */}
            <div className="flex-1 overflow-y-hidden min-h-0">
              {gridData.map(({ inst }, idx) => (
                <div
                  key={idx}
                  className="h-7 px-2 flex items-center justify-between border-b border-slate-100/80 text-[10px] font-mono truncate hover:bg-slate-100/70"
                  title={`${inst.pc}: ${inst.assembly}`}
                >
                  <span className="font-semibold text-slate-700 truncate max-w-[85px]">
                    {inst.assembly}
                  </span>
                  <span className="text-[9px] text-slate-400 shrink-0">
                    {inst.pc.slice(-4)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 오른쪽 스크롤 영역: 사이클 열 (Cycle 1, 2, 3...) x 스테이지 뱃지 */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-x-auto overflow-y-auto min-h-0 relative select-none scrollbar-thin"
          >
            {/* 사이클 헤더 행 */}
            <div className="h-7 shrink-0 flex items-stretch border-b border-slate-200 sticky top-0 bg-slate-50 z-10">
              {history.map((_, cIdx) => {
                const isCurrent = cIdx === currentCycle;
                return (
                  <button
                    key={cIdx}
                    type="button"
                    onClick={() => onJumpToCycle?.(cIdx)}
                    className={`w-9 shrink-0 flex items-center justify-center font-mono text-[10px] font-bold border-r border-slate-200/70 cursor-pointer transition-colors ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-inner font-extrabold'
                        : 'text-slate-500 hover:bg-sky-50 hover:text-sky-600'
                    }`}
                    title={`Cycle ${cIdx}로 이동`}
                  >
                    {cIdx}
                  </button>
                );
              })}
            </div>

            {/* 그리드 바디 */}
            <div className="relative">
              {/* 현재 사이클 수직 하이라이트 배경 바 */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-0 border-x-2 border-blue-500 bg-blue-500/10 transition-all duration-200"
                style={{
                  left: `${currentCycle * 36}px`,
                  width: '36px',
                }}
              />

              {gridData.map(({ stagesByCycle }, rIdx) => (
                <div
                  key={rIdx}
                  className="h-7 flex items-stretch border-b border-slate-100/80 relative"
                >
                  {stagesByCycle.map((stageInfo, cIdx) => {
                    if (!stageInfo) {
                      return (
                        <div
                          key={cIdx}
                          className="w-9 shrink-0 border-r border-slate-100/50"
                        />
                      );
                    }

                    const isStall = stageInfo.hasStall;
                    const stageKey = isStall ? 'stall' : stageInfo.stage;
                    const style = STAGE_COLORS[stageKey] || {
                      bg: 'bg-slate-400',
                      text: 'text-white',
                      border: 'border-slate-500',
                    };

                    return (
                      <div
                        key={cIdx}
                        onClick={() => onJumpToCycle?.(cIdx)}
                        className="w-9 shrink-0 flex items-center justify-center p-0.5 border-r border-slate-100/50 cursor-pointer"
                        title={`Cycle ${cIdx}: ${stageInfo.stage}${isStall ? ' (Stall)' : ''}`}
                      >
                        <span
                          className={`w-full h-full rounded-md text-[9px] font-mono font-bold flex items-center justify-center shadow-2xs border ${style.bg} ${style.text} ${style.border} transition-transform hover:scale-105`}
                        >
                          {isStall ? 'stl' : stageInfo.stage}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiCycleDiagram;
