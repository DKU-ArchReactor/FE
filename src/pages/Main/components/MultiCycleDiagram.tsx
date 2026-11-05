import React, { useMemo, useRef, useEffect } from 'react';
import type { SimulationResult, CycleHistoryItem, StageBuffer } from '@/type/simulation';
import { getActivity } from '../simulationView';

interface MultiCycleDiagramProps {
  simulationData: SimulationResult | null;
  currentCycleData: CycleHistoryItem | null;
  currentCycle: number;
  translationAssembly?: string;
  onJumpToCycle?: (cycle: number) => void;
}

type CellType = 'IF' | 'ID' | 'EX' | 'MEM' | 'WB' | 'STALL_IF' | 'STALL_ID' | 'BUBBLE';

interface CellInfo {
  type: CellType;
  stage: 'IF' | 'ID' | 'EX' | 'MEM' | 'WB';
  label: string;
  isStall?: boolean;
  isBubble?: boolean;
  isForwarded?: boolean;
}

interface TraceRow {
  id: number;
  pc: string;
  assembly: string;
  firstCycle: number;
  cells: Record<number, CellInfo>;
}

const STAGE_STYLES: Record<
  CellType,
  { bg: string; text: string; border: string; activeRing: string }
> = {
  IF: {
    bg: 'bg-indigo-500',
    text: 'text-white',
    border: 'border-indigo-600',
    activeRing: 'ring-indigo-300',
  },
  ID: {
    bg: 'bg-sky-500',
    text: 'text-white',
    border: 'border-sky-600',
    activeRing: 'ring-sky-300',
  },
  EX: {
    bg: 'bg-amber-500',
    text: 'text-white',
    border: 'border-amber-600',
    activeRing: 'ring-amber-300',
  },
  MEM: {
    bg: 'bg-emerald-500',
    text: 'text-white',
    border: 'border-emerald-600',
    activeRing: 'ring-emerald-300',
  },
  WB: {
    bg: 'bg-rose-500',
    text: 'text-white',
    border: 'border-rose-600',
    activeRing: 'ring-rose-300',
  },
  STALL_IF: {
    bg: 'bg-red-100',
    text: 'text-red-700 font-extrabold',
    border: 'border-red-400 border-dashed',
    activeRing: 'ring-red-300',
  },
  STALL_ID: {
    bg: 'bg-red-100',
    text: 'text-red-700 font-extrabold',
    border: 'border-red-400 border-dashed',
    activeRing: 'ring-red-300',
  },
  BUBBLE: {
    bg: 'bg-purple-100',
    text: 'text-purple-700 font-extrabold',
    border: 'border-purple-400 border-dashed',
    activeRing: 'ring-purple-300',
  },
};

const isValidStageInst = (buf?: StageBuffer | null): buf is StageBuffer => {
  if (!buf || !buf.assembly) return false;
  const norm = buf.assembly.trim().toLowerCase();
  if (!norm || norm === 'bubble' || norm === 'empty' || norm === 'nop (bubble)') return false;
  if (buf.status === 'bubble' || buf.status === 'empty') return false;
  return true;
};

const isSameInstruction = (
  row: TraceRow,
  buf: StageBuffer
): boolean => {
  const bufPc = (buf.pc || '').toLowerCase();
  const bufAsm = buf.assembly.replace(/\s+/g, ' ').trim().toLowerCase();
  const rowAsm = row.assembly.replace(/\s+/g, ' ').trim().toLowerCase();
  if (row.pc && bufPc) {
    return row.pc.toLowerCase() === bufPc && rowAsm === bufAsm;
  }
  return rowAsm === bufAsm;
};

const COL_WIDTH = 40;
const ROW_HEIGHT = 28;
const LEFT_COL_WIDTH = 176;

export const MultiCycleDiagram: React.FC<MultiCycleDiagramProps> = ({
  simulationData,
  currentCycle,
  onJumpToCycle,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const history = useMemo(() => simulationData?.history.map((item) => ({ ...item, buffers: getActivity(item) })) ?? [], [simulationData]);
  const totalCycles = history.length;

  // 파이프라인 히스토리를 시간순으로 추적하여 계단식(Stair-step) 다이어그램 행 생성
  const traceRows = useMemo<TraceRow[]>(() => {
    if (!history.length) return [];

    const rows: TraceRow[] = [];
    if (simulationData?.simulator.mode === 'single') {
      return history.flatMap((item, index) => {
        const instruction = item.buffers.IF;
        if (!instruction?.pc) return [];
        return [{
          id: index, pc: instruction.pc, assembly: instruction.assembly, firstCycle: index,
          cells: { [index]: { type: 'WB' as const, stage: 'WB' as const, label: item.cycle_events.runtime_error.has_error ? 'ERR' : '1CLK' } },
        }];
      });
    }
    let prevStageRow: Partial<Record<'IF' | 'ID' | 'EX' | 'MEM' | 'WB', number>> = {};

    const createRow = (buf: StageBuffer, cIdx: number): number => {
      const id = rows.length;
      rows.push({
        id,
        pc: buf.pc || '',
        assembly: buf.assembly.trim(),
        firstCycle: cIdx,
        cells: {},
      });
      return id;
    };

    history.forEach((item, cIdx) => {
      const nextStageRow: Partial<Record<'IF' | 'ID' | 'EX' | 'MEM' | 'WB', number>> = {};
      const usedPrevStages = new Set<'IF' | 'ID' | 'EX' | 'MEM' | 'WB'>();

      const hasStallEvent = Boolean(item.cycle_events?.stall?.has_stall);
      const hasForwardEvent = Boolean(item.cycle_events?.forwarding?.has_forwarded);

      // 1. WB 단계 매칭 (이전 사이클 MEM -> 현재 WB)
      const wbBuf = item.buffers?.WB;
      if (isValidStageInst(wbBuf)) {
        let rowId: number | undefined;
        if (
          prevStageRow.MEM !== undefined &&
          isSameInstruction(rows[prevStageRow.MEM], wbBuf)
        ) {
          rowId = prevStageRow.MEM;
          usedPrevStages.add('MEM');
        } else if (
          prevStageRow.WB !== undefined &&
          isSameInstruction(rows[prevStageRow.WB], wbBuf)
        ) {
          rowId = prevStageRow.WB;
          usedPrevStages.add('WB');
        } else {
          rowId = createRow(wbBuf, cIdx);
        }
        rows[rowId].cells[cIdx] = {
          type: 'WB',
          stage: 'WB',
          label: 'WB',
        };
        nextStageRow.WB = rowId;
      }

      // 2. MEM 단계 매칭 (이전 사이클 EX -> 현재 MEM)
      const memBuf = item.buffers?.MEM;
      if (isValidStageInst(memBuf)) {
        let rowId: number | undefined;
        if (
          prevStageRow.EX !== undefined &&
          isSameInstruction(rows[prevStageRow.EX], memBuf)
        ) {
          rowId = prevStageRow.EX;
          usedPrevStages.add('EX');
        } else if (
          prevStageRow.MEM !== undefined &&
          !usedPrevStages.has('MEM') &&
          isSameInstruction(rows[prevStageRow.MEM], memBuf)
        ) {
          rowId = prevStageRow.MEM;
          usedPrevStages.add('MEM');
        } else {
          rowId = createRow(memBuf, cIdx);
        }
        rows[rowId].cells[cIdx] = {
          type: 'MEM',
          stage: 'MEM',
          label: 'MEM',
        };
        nextStageRow.MEM = rowId;
      }

      // 3. EX 단계 매칭 (이전 사이클 ID -> 현재 EX)
      const exBuf = item.buffers?.EX;
      if (isValidStageInst(exBuf)) {
        let rowId: number | undefined;
        if (
          prevStageRow.ID !== undefined &&
          isSameInstruction(rows[prevStageRow.ID], exBuf)
        ) {
          rowId = prevStageRow.ID;
          usedPrevStages.add('ID');
        } else if (
          prevStageRow.EX !== undefined &&
          !usedPrevStages.has('EX') &&
          isSameInstruction(rows[prevStageRow.EX], exBuf)
        ) {
          rowId = prevStageRow.EX;
          usedPrevStages.add('EX');
        } else {
          rowId = createRow(exBuf, cIdx);
        }
        rows[rowId].cells[cIdx] = {
          type: 'EX',
          stage: 'EX',
          label: 'EX',
          isForwarded: hasForwardEvent,
        };
        nextStageRow.EX = rowId;
      }

      // 4. ID 단계 매칭 (스톨로 인해 이전 ID 유지 or 이전 IF -> 현재 ID)
      const idBuf = item.buffers?.ID;
      if (isValidStageInst(idBuf)) {
        let rowId: number | undefined;
        let isStalledInId = false;

        if (
          prevStageRow.ID !== undefined &&
          !usedPrevStages.has('ID') &&
          isSameInstruction(rows[prevStageRow.ID], idBuf)
        ) {
          // 이전 사이클 ID에 있던 명령어가 EX로 가지 못하고 ID에 그대로 머문 경우 (Stall / Bubble 발생!)
          rowId = prevStageRow.ID;
          usedPrevStages.add('ID');
          isStalledInId = true;
        } else if (
          prevStageRow.IF !== undefined &&
          isSameInstruction(rows[prevStageRow.IF], idBuf)
        ) {
          rowId = prevStageRow.IF;
          usedPrevStages.add('IF');
        } else {
          rowId = createRow(idBuf, cIdx);
        }

        const markStall = isStalledInId || (hasStallEvent && !isValidStageInst(exBuf));
        rows[rowId].cells[cIdx] = {
          type: markStall ? 'STALL_ID' : 'ID',
          stage: 'ID',
          label: markStall ? 'STL' : 'ID',
          isStall: markStall,
        };
        nextStageRow.ID = rowId;
      }

      // 5. IF 단계 매칭 (스톨로 인해 이전 IF 유지 or 새로운 명령어 인출)
      const ifBuf = item.buffers?.IF;
      if (isValidStageInst(ifBuf)) {
        let rowId: number | undefined;
        let isStalledInIf = false;

        if (
          prevStageRow.IF !== undefined &&
          !usedPrevStages.has('IF') &&
          isSameInstruction(rows[prevStageRow.IF], ifBuf)
        ) {
          // 이전 사이클 IF에 있던 명령어가 ID로 가지 못하고 IF에 그대로 머문 경우 (Stall)
          rowId = prevStageRow.IF;
          usedPrevStages.add('IF');
          isStalledInIf = true;
        } else {
          rowId = createRow(ifBuf, cIdx);
        }

        rows[rowId].cells[cIdx] = {
          type: isStalledInIf ? 'STALL_IF' : 'IF',
          stage: 'IF',
          label: isStalledInIf ? 'STL' : 'IF',
          isStall: isStalledInIf,
        };
        nextStageRow.IF = rowId;
      }

      // 6. 분기/점프 플러시(Flush) 또는 버블(Bubble)로 인해 파이프라인에서 도중 취소된 명령어 표시
      // 이전 사이클에 IF나 ID에 있었는데 다음 단계로 진전하지 못하고 사라진 경우 -> 해당 자리에 BBL(버블/플러시) 표시
      if (prevStageRow.ID !== undefined && !usedPrevStages.has('ID')) {
        const flushedRow = rows[prevStageRow.ID];
        if (flushedRow && !flushedRow.cells[cIdx]) {
          flushedRow.cells[cIdx] = {
            type: 'BUBBLE',
            stage: 'EX',
            label: 'BBL',
            isBubble: true,
          };
        }
      }
      if (prevStageRow.IF !== undefined && !usedPrevStages.has('IF')) {
        const flushedRow = rows[prevStageRow.IF];
        if (flushedRow && !flushedRow.cells[cIdx]) {
          flushedRow.cells[cIdx] = {
            type: 'BUBBLE',
            stage: 'ID',
            label: 'BBL',
            isBubble: true,
          };
        }
      }

      prevStageRow = nextStageRow;
    });

    return rows;
  }, [history, simulationData]);

  // 현재 사이클이 바뀔 때 해당 사이클 열과 현재 실행 중인 명령어 행이 화면 중앙에 오도록 가로·세로 자동 스크롤
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !traceRows.length) return;

    const targetLeft = Math.max(
      0,
      currentCycle * COL_WIDTH - (container.clientWidth - LEFT_COL_WIDTH) / 2 + COL_WIDTH / 2
    );

    // 현재 사이클에 활성화된 첫 번째/중간 행 찾기
    const activeRowIndices: number[] = [];
    traceRows.forEach((row, idx) => {
      if (row.cells[currentCycle]) {
        activeRowIndices.push(idx);
      }
    });

    if (activeRowIndices.length > 0) {
      const midRowIdx = activeRowIndices[Math.floor(activeRowIndices.length / 2)];
      const targetTop = Math.max(
        0,
        midRowIdx * ROW_HEIGHT - (container.clientHeight - 30) / 2 + ROW_HEIGHT / 2
      );
      container.scrollTo({
        left: targetLeft,
        top: targetTop,
        behavior: 'smooth',
      });
    } else {
      container.scrollTo({
        left: targetLeft,
        behavior: 'smooth',
      });
    }
  }, [currentCycle, traceRows]);

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-xs border border-slate-200 flex flex-col min-h-0 overflow-hidden select-none">
      {/* 1. 상단 타이틀 바 & 범례 */}
      <div className="shrink-0 flex items-center justify-between px-3.5 py-2 bg-slate-50/80 border-b border-slate-200/80 min-w-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs">📈</span>
          <h3 className="text-xs font-bold text-slate-800 whitespace-nowrap">
            Pipeline Timing Diagram
          </h3>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* 스테이지 컬러 레전드 미니 뱃지 */}
          <div className="hidden sm:flex items-center gap-1 text-[9px] font-mono font-bold">
            <span className="px-1.5 py-0.5 rounded bg-indigo-500 text-white">IF</span>
            <span className="px-1.5 py-0.5 rounded bg-sky-500 text-white">ID</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white">EX</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-white">MEM</span>
            <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white">WB</span>
            <span
              className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-300 border-dashed"
              title="데이터 해저드로 인한 파이프라인 대기 (Stall)"
            >
              STL(지연)
            </span>
            <span
              className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-300 border-dashed"
              title="분기/점프 플러시로 인해 버블(Bubble)로 변환됨"
            >
              BBL(버블)
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 font-semibold px-2 py-0.5 rounded-full bg-slate-200/60">
            {totalCycles > 0 ? `${totalCycles} Cycles` : 'Ready'}
          </span>
        </div>
      </div>

      {/* 2. 계단식 타이밍 매트릭스 테이블 (가로·세로 통합 스크롤) */}
      {!simulationData || traceRows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-slate-400 gap-1.5">
          <span className="text-xl">📊</span>
          <span className="text-xs font-semibold text-slate-500">
            시뮬레이션을 실행하면 계단식 파이프라인 타이밍 다이어그램이 생성됩니다
          </span>
          <span className="text-[11px] text-slate-400">
            사이클별 각 명령어의 진행 단계(IF·ID·EX·MEM·WB)와 버블(BBL)/스톨(STL) 발생 위치를 한눈에 추적합니다.
          </span>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto min-h-0 relative select-none scrollbar-thin"
        >
          <div
            className="relative min-w-max"
            style={{
              width: `${LEFT_COL_WIDTH + history.length * COL_WIDTH}px`,
            }}
          >
            {/* 상단 고정 헤더 행 (Sticky Top) */}
            <div className="h-7 flex items-stretch border-b border-slate-200 sticky top-0 bg-slate-50 z-20 shadow-2xs">
              {/* 좌상단 고정 코너 셀 (Sticky Top & Left) */}
              <div
                className="shrink-0 px-2.5 flex items-center justify-between border-r border-slate-200 bg-slate-100/95 sticky left-0 z-30 text-[10px] font-bold text-slate-600"
                style={{ width: `${LEFT_COL_WIDTH}px` }}
              >
                <span>Instruction</span>
                <span className="text-[9px] text-slate-400 font-mono">Now</span>
              </div>

              {/* 각 사이클 번호 헤더 (클릭 시 해당 사이클로 이동) */}
              {history.map((item, cIdx) => {
                const isCurrent = cIdx === currentCycle;
                const hasStall = item.cycle_events?.stall?.has_stall;
                const hasFlush = item.cycle_events?.control_hazard?.has_flush;

                return (
                  <button
                    key={cIdx}
                    type="button"
                    onClick={() => onJumpToCycle?.(cIdx)}
                    className={`shrink-0 flex flex-col items-center justify-center font-mono text-[10px] font-bold border-r border-slate-200/70 cursor-pointer transition-colors relative ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-inner font-extrabold'
                        : hasStall
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : hasFlush
                        ? 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                        : 'text-slate-500 hover:bg-sky-50 hover:text-sky-600'
                    }`}
                    style={{ width: `${COL_WIDTH}px` }}
                    title={`Clock ${item.clock ?? cIdx}${
                      hasStall ? ' (Stall/Bubble 발생)' : hasFlush ? ' (Branch Flush/Bubble 발생)' : ''
                    }`}
                  >
                    <span>C{item.clock ?? cIdx}</span>
                    {(hasStall || hasFlush) && !isCurrent && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full absolute top-0.5 right-0.5 ${
                          hasStall ? 'bg-red-500' : 'bg-purple-500'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* 본문 행 영역 */}
            <div className="relative">
              {/* 현재 선택된 사이클 수직 하이라이트 기둥 */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-0 border-x-2 border-blue-500/80 bg-blue-500/10 transition-all duration-150"
                style={{
                  left: `${LEFT_COL_WIDTH + currentCycle * COL_WIDTH}px`,
                  width: `${COL_WIDTH}px`,
                }}
              />

              {traceRows.map((row, rIdx) => {
                const activeCellNow = row.cells[currentCycle];
                const isRowActiveNow = Boolean(activeCellNow);
                const activeStyle = activeCellNow ? STAGE_STYLES[activeCellNow.type] : null;

                return (
                  <div
                    key={row.id}
                    className={`flex items-stretch border-b border-slate-100/90 relative transition-colors ${
                      isRowActiveNow ? 'bg-sky-50/60' : rIdx % 2 === 1 ? 'bg-slate-50/25' : ''
                    }`}
                    style={{ height: `${ROW_HEIGHT}px` }}
                  >
                    {/* 좌측 고정 명령어 열 (Sticky Left) */}
                    <div
                      onClick={() => onJumpToCycle?.(row.firstCycle)}
                      className={`shrink-0 px-2 flex items-center justify-between gap-1.5 border-r border-slate-200 sticky left-0 z-10 text-[10px] font-mono cursor-pointer transition-colors ${
                        isRowActiveNow
                          ? 'bg-sky-50 border-l-3 border-l-blue-600 font-bold text-slate-900 shadow-2xs'
                          : 'bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                      style={{ width: `${LEFT_COL_WIDTH}px` }}
                      title={`${row.pc ? `${row.pc}: ` : ''}${row.assembly} (클릭 시 인출 사이클로 이동)`}
                    >
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <span className="text-[9px] text-slate-400 shrink-0 w-4 text-right">
                          {rIdx + 1}.
                        </span>
                        <span className="truncate">{row.assembly}</span>
                      </div>

                      {/* 현재 선택된 사이클에서 이 명령어가 어느 단계에 있는지 즉시 표시 */}
                      {activeCellNow && activeStyle ? (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[8.5px] font-mono font-extrabold shrink-0 border ${activeStyle.bg} ${activeStyle.text} ${activeStyle.border}`}
                        >
                          {activeCellNow.label}
                        </span>
                      ) : row.pc ? (
                        <span className="text-[8.5px] text-slate-400 shrink-0">
                          {row.pc.slice(-4)}
                        </span>
                      ) : null}
                    </div>

                    {/* 우측 각 사이클 셀 */}
                    {history.map((_, cIdx) => {
                      const cell = row.cells[cIdx];
                      const isCurrentCol = cIdx === currentCycle;

                      if (!cell) {
                        return (
                          <div
                            key={cIdx}
                            onClick={() => onJumpToCycle?.(cIdx)}
                            className="shrink-0 border-r border-slate-100/60 cursor-pointer hover:bg-slate-100/40"
                            style={{ width: `${COL_WIDTH}px` }}
                          />
                        );
                      }

                      const style = STAGE_STYLES[cell.type];

                      return (
                        <div
                          key={cIdx}
                          onClick={() => onJumpToCycle?.(cIdx)}
                          className="shrink-0 flex items-center justify-center p-0.5 border-r border-slate-100/60 cursor-pointer relative z-1"
                          style={{ width: `${COL_WIDTH}px` }}
                          title={`Clock ${history[cIdx]?.clock ?? cIdx} | ${row.assembly} ➔ ${
                            cell.isStall
                              ? `${cell.stage} 단계 지연 (Stall / EX에 Bubble 삽입)`
                              : cell.isBubble
                              ? '분기 플러시로 인해 버블(Bubble) 처리됨'
                              : `${cell.stage} 단계 실행 중`
                          }`}
                        >
                          <span
                            className={`w-full h-full rounded-md text-[9.5px] font-mono font-bold flex items-center justify-center shadow-2xs border transition-transform ${
                              style.bg
                            } ${style.text} ${style.border} ${
                              isCurrentCol
                                ? `scale-105 ring-2 ${style.activeRing} shadow-sm font-extrabold`
                                : 'hover:scale-105'
                            }`}
                          >
                            {cell.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiCycleDiagram;
