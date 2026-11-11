import React, { useMemo, useRef, useEffect } from 'react';
import type { SimulationResult } from '@/type/simulation';
import {
  STAGE_STYLES,
  buildMultiCycleTraceRows,
  type TraceRow,
} from '../utils/multiCycleTrace';
import type { MappedAssemblyRow } from '../utils/translationCompile';

// 명령어(Opcode)와 피연산자(Operands) 분리 및 정렬 헬퍼 (TranslationMapping 에디터와 동일)
function splitInstruction(text: string): { opcode: string; operands: string } {
  const trimmed = text.trim();
  const firstSpace = trimmed.search(/\s/);
  if (firstSpace === -1) {
    return { opcode: trimmed, operands: "" };
  }
  const rawOperands = trimmed.slice(firstSpace).trim();
  const formattedOperands = rawOperands.replace(/,([^\s])/g, ", $1");
  return {
    opcode: trimmed.slice(0, firstSpace).trim(),
    operands: formattedOperands,
  };
}

interface MultiCycleDiagramProps {
  simulationData: SimulationResult | null;
  currentCycle: number;
  onJumpToCycle?: (cycle: number) => void;
  mappedRows?: MappedAssemblyRow[];
  mode?: 'single' | 'pipeline';
}

const COL_WIDTH = 40;
const ROW_HEIGHT = 28;
const LEFT_COL_WIDTH = 300;

export const MultiCycleDiagram: React.FC<MultiCycleDiagramProps> = ({
  simulationData,
  currentCycle,
  onJumpToCycle,
  mappedRows = [],
  mode,
}) => {
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);

  const handleLeftScroll = () => {
    if (isSyncingLeft.current) {
      isSyncingLeft.current = false;
      return;
    }
    if (rightScrollRef.current && leftScrollRef.current) {
      isSyncingRight.current = true;
      rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
    }
  };

  const handleRightScroll = () => {
    if (isSyncingRight.current) {
      isSyncingRight.current = false;
      return;
    }
    if (leftScrollRef.current && rightScrollRef.current) {
      isSyncingLeft.current = true;
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
    }
  };

  const history = simulationData?.history ?? [];
  const totalCycles = history.length;

  // 파이프라인/싱글사이클 히스토리를 추적하여 다이어그램 행 생성 (컴파일 전이라도 현재 선택된 mode 우선 반영)
  const isSingleMode =
    mode === 'single' ||
    simulationData?.simulator?.mode === 'single' ||
    simulationData?.simulator?.pipeline_model === 'single-cycle';

  // PC 기준 code_mapping 룩업 맵 (ASM 라인 번호 및 CRT 여부 판별)
  const codeMapping = simulationData?.program?.code_mapping;

  const traceRows = useMemo<TraceRow[]>(
    () => buildMultiCycleTraceRows(history, isSingleMode),
    [history, isSingleMode]
  );

  // 각 PC 및 줄별 등장 횟수(회차) 집계 계산
  const rowOccurrenceMap = useMemo(() => {
    const counts: Record<string, number> = {};
    return traceRows.map((row) => {
      const key = (row.pc || row.assembly).trim().toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
      return counts[key];
    });
  }, [traceRows]);

  // 모드별 가로/세로 하이라이트 틴트 색상 정의 (Single: Blue #005FB8 계열, Pipeline: Purple 보라색)
  const highlightTint = isSingleMode
    ? {
      col: 'bg-blue-600/12 dark:bg-blue-500/20',
      row: 'bg-blue-50/70 dark:bg-blue-950/35',
      leftBorder: 'border-l-[#005FB8] dark:border-l-[#007ACC]',
      activeHeader: 'bg-[#005FB8] dark:bg-[#007ACC] text-white',
    }
    : {
      col: 'bg-purple-500/12 dark:bg-purple-500/20',
      row: 'bg-purple-50/70 dark:bg-purple-950/30',
      leftBorder: 'border-l-purple-500 dark:border-l-purple-400',
      activeHeader: 'bg-purple-600 text-white',
    };

  // 가로 스크롤바 유무에 따라 좌측 명령어 목록 하단 패딩 동기화 (우측 가로 스크롤바로 인한 라인 어긋남 완벽 방지)
  const [hScrollbarHeight, setHScrollbarHeight] = React.useState<number>(0);

  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;

    const updateScrollbarHeight = () => {
      // clientHeight와 scrollWidth/clientWidth 비교로 가로 스크롤바 높이 계산
      const hasHorizontalScroll = el.scrollWidth > el.clientWidth;
      const scrollHeightDiff = el.offsetHeight - el.clientHeight;
      setHScrollbarHeight(hasHorizontalScroll && scrollHeightDiff > 0 ? scrollHeightDiff : 0);
    };

    updateScrollbarHeight();
    const ro = new ResizeObserver(updateScrollbarHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [history.length, traceRows.length]);

  // Single-Cycle 모드에서는 Step 0이 초기 대기 상태(activeCycleCol = -1)이며, Step 1~N이 각 C0~CN-1 열에 매핑
  const activeCycleCol = isSingleMode
    ? (currentCycle > 0 ? currentCycle - 1 : -1)
    : currentCycle;

  // 현재 사이클이 바뀔 때 해당 사이클 열(C0~CN)과 현재 실행 중인 명령어 행이 화면에 오도록 자동 스크롤
  useEffect(() => {
    const rightContainer = rightScrollRef.current;
    if (!rightContainer || !traceRows.length) return;

    if (activeCycleCol < 0) {
      rightContainer.scrollTo({
        left: 0,
        top: 0,
        behavior: 'smooth',
      });
      return;
    }

    // 수평 스크롤 (우측 35% 지점에 현재 사이클 열 배치 -> 다음 진행될 사이클들 시야 확보)
    const targetLeft = Math.max(
      0,
      activeCycleCol * COL_WIDTH - rightContainer.clientWidth * 0.35 + COL_WIDTH / 2
    );

    // 수직 스크롤 (상단 35% 지점에 현재 실행 중인 명령어 행 배치 -> 다음 실행될 명령어들 시야 확보)
    const activeRowIndices: number[] = [];
    traceRows.forEach((row, idx) => {
      if (row.cells[activeCycleCol]) {
        activeRowIndices.push(idx);
      }
    });

    const midRowIdx =
      activeRowIndices.length > 0
        ? activeRowIndices[Math.floor(activeRowIndices.length / 2)]
        : activeCycleCol;

    const targetTop = Math.max(
      0,
      midRowIdx * ROW_HEIGHT - (rightContainer.clientHeight - 30) * 0.35 + ROW_HEIGHT / 2
    );

    // rightContainer를 부드럽게 스크롤하면 handleRightScroll이 좌측 컨테이너의 scrollTop을 프레임 단위로 완벽 동기화
    rightContainer.scrollTo({
      left: targetLeft,
      top: targetTop,
      behavior: 'smooth',
    });
  }, [activeCycleCol, traceRows]);

  return (
    <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] flex flex-col min-h-0 overflow-hidden select-none transition-colors duration-150">
      {/* 1. 상단 타이틀 바 & 범례 */}
      <div className={`h-8 shrink-0 flex items-center justify-between px-3.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 gap-2 border-l-2 ${isSingleMode ? 'border-l-[#005FB8] dark:border-l-[#007ACC]' : 'border-l-purple-500'
        }`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[11px] font-bold ${isSingleMode ? 'text-[#005FB8] dark:text-[#007ACC]' : 'text-purple-500'
            }`}>◆</span>
          <h3 className="font-sans text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wide whitespace-nowrap">
            {isSingleMode ? 'SINGLE-CYCLE EXECUTION' : 'PIPELINING EXECUTION'}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* 스테이지 컬러 레전드 미니 뱃지 */}
          {isSingleMode ? (
            <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold">
              <span className="px-1.5 py-0.5 rounded-[4px] bg-[#22C55E] dark:bg-[#15803D] text-white font-bold shadow-2xs">
                <span className="inline-block translate-y-[1px]">DONE</span>
              </span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1 text-[9px] font-mono font-bold">
              <span className="px-1.5 py-0.5 rounded-[4px] bg-[#EF4444] text-white">
                <span className="inline-block translate-y-[1px]">IF</span>
              </span>
              <span className="px-1.5 py-0.5 rounded-[4px] bg-[#F97316] text-white">
                <span className="inline-block translate-y-[1px]">ID</span>
              </span>
              <span className="px-1.5 py-0.5 rounded-[4px] bg-[#22C55E] dark:bg-[#15803D] text-white">
                <span className="inline-block translate-y-[1px]">EX</span>
              </span>
              <span className="px-1.5 py-0.5 rounded-[4px] bg-[#0EA5E9] text-white">
                <span className="inline-block translate-y-[1px]">MEM</span>
              </span>
              <span className="px-1.5 py-0.5 rounded-[4px] bg-[#8B5CF6] text-white">
                <span className="inline-block translate-y-[1px]">WB</span>
              </span>
              <span
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-[#451A03] text-amber-600 dark:text-amber-300 border border-amber-400 dark:border-amber-500 text-[8.5px] font-black"
                title="데이터 해저드로 인한 파이프라인 대기 (Stall)"
              >
                <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                  <path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-7.85-1.42 1.42L16.86 11H5v2z" />
                </svg>
                <span className="inline-block -translate-y-[0.5px]">STL</span>
              </span>
              <span
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-[#182C3D] text-sky-500 dark:text-sky-300 border border-sky-400 dark:border-sky-400 text-[8.5px] font-black"
                title="분기/점프 플러시로 인해 버블(Bubble)로 변환됨"
              >
                <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                </svg>
                <span className="inline-block -translate-y-[0.5px]">BBL</span>
              </span>
            </div>
          )}
          <span className="text-[10px] font-mono text-[#57606A] dark:text-[#858585] font-semibold px-2 py-0.5 rounded bg-[#EAEAEA] dark:bg-[#333333]">
            {totalCycles > 0 ? `${totalCycles} Cycles` : 'Ready'}
          </span>
        </div>
      </div>

      {/* 2. 계단식 타이밍 매트릭스 테이블 */}
      {!simulationData || traceRows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-[#57606A] dark:text-[#858585] gap-1.5 bg-[#F8F8F8] dark:bg-[#1E1E1E]">
          <span className="text-xl">📊</span>
          <span className="text-xs font-semibold text-[#1F2328] dark:text-[#CCCCCC]">
            {isSingleMode
              ? '시뮬레이션을 실행하면 싱글사이클 직렬 실행 타이밍 다이어그램이 생성됩니다'
              : '시뮬레이션을 실행하면 계단식 파이프라인 타이밍 다이어그램이 생성됩니다'}
          </span>
          <span className="text-[11px] text-[#57606A] dark:text-[#858585]">
            {isSingleMode
              ? '사이클별 각 명령어의 직렬 완료 단계(DONE)를 한눈에 추적합니다.'
              : '사이클별 각 명령어의 진행 단계(IF·ID·EX·MEM·WB)와 버블(BBL)/스톨(STL) 발생 위치를 한눈에 추적합니다.'}
          </span>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex relative select-none bg-white dark:bg-[#1E1E1E]">
          {/* 좌측 고정 명령어 열 (가로 휠 스크롤 대상에서 완전히 제외된 독립 컨테이너) */}
          <div
            ref={leftScrollRef}
            onScroll={handleLeftScroll}
            className="shrink-0 flex flex-col bg-white dark:bg-[#1E1E1E] overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ width: `${LEFT_COL_WIDTH}px` }}
          >
            {/* 좌상단 고정 코너 셀 (Sticky Top - 사이클 헤더와 일치하는 bg-[#F3F3F3] dark:bg-[#252526]) */}
            <div className="h-7 shrink-0 px-2 flex items-center border-b border-[#E5E5E5] dark:border-[#333333] bg-[#F3F3F3] dark:bg-[#252526] sticky top-0 z-10 text-[10px] font-bold text-[#57606A] dark:text-[#858585] border-l-3 border-l-transparent">
              <span className="shrink-0 w-6 mr-4" />
              <span>Instruction</span>
            </div>

            {/* 좌측 명령어 행 목록 */}
            <div
              className="flex flex-col"
              style={{
                paddingBottom: hScrollbarHeight > 0 ? `${hScrollbarHeight}px` : undefined,
              }}
            >
              {traceRows.map((row, rIdx) => {
                const activeCellNow = activeCycleCol >= 0 ? row.cells[activeCycleCol] : null;
                const isRowActiveNow = Boolean(activeCellNow);

                // 코드 매핑 및 라인 정보 분석
                const cleanPc = (row.pc || "").trim().toLowerCase();
                const mapInfo = codeMapping && cleanPc ? codeMapping[cleanPc] : undefined;
                const cSourceLine = mapInfo?.source_line;

                // 왼쪽 어셈블리 뷰(TranslationMapping)의 실제 행 번호(1-indexed) 찾기
                const asmIndex0 = mappedRows.findIndex((r) => {
                  const rPc = (r.pc || "").trim().toLowerCase();
                  if (cleanPc && rPc) return rPc === cleanPc;
                  return r.text.replace(/\s+/g, " ").trim().toLowerCase() === row.assembly.replace(/\s+/g, " ").trim().toLowerCase();
                });
                const asmLineNumber = asmIndex0 >= 0 ? asmIndex0 + 1 : null;
                const isCrt = cleanPc && !cSourceLine && (asmIndex0 < 0 || mappedRows[asmIndex0]?.isRuntime);
                const occurrence = rowOccurrenceMap[rIdx] || 1;
                const { opcode, operands } = splitInstruction(row.assembly);

                return (
                  <div
                    key={row.id}
                    onClick={() => onJumpToCycle?.(isSingleMode ? row.firstCycle + 1 : row.firstCycle)}
                    className={`h-[28px] shrink-0 px-2 flex items-center justify-between gap-2 border-b border-[#E5E5E5] dark:border-[#333333] border-l-3 text-[13px] font-mono cursor-pointer transition-colors ${isRowActiveNow
                        ? `${highlightTint.row} ${highlightTint.leftBorder} text-[#1F2328] dark:text-[#CCCCCC]`
                        : 'bg-white dark:bg-[#1E1E1E] border-l-transparent hover:bg-[#F6F8FA] dark:hover:bg-[#252526] text-[#24292F] dark:text-[#CCCCCC]'
                      }`}
                    title={`${row.pc ? `${row.pc}: ` : ''}${row.assembly} (클릭 시 인출 사이클로 이동)`}
                  >
                    {/* 좌측: 행 순번 + Opcode(고정폭) + Operands (에디터 컬럼 정렬과 100% 일치) */}
                    <div className="flex items-center min-w-0 flex-1">
                      <span className="text-[13px] text-[#8C959F] dark:text-[#6E7681] shrink-0 w-6 text-right font-mono select-none translate-y-[2px] pr-4">
                        {rIdx + 1}
                      </span>
                      <span className={`w-[52px] shrink-0 font-bold select-text leading-none ${isRowActiveNow
                          ? isSingleMode
                            ? "text-[#005FB8] dark:text-[#79C0FF]"
                            : "text-purple-700 dark:text-[#C4B5FD]"
                          : isCrt
                            ? "text-[#6E7681] dark:text-[#858585]"
                            : isSingleMode
                              ? "text-[#005FB8] dark:text-[#569CD6]"
                              : "text-purple-700 dark:text-[#A78BFA]"
                        }`}>
                        {opcode}
                      </span>
                      <span className="truncate leading-none flex-1 font-normal select-text">
                        {operands}
                      </span>
                    </div>

                    {/* 우측 정렬 정보 컬럼: [회차 뱃지] + [ASM 매핑 라인 뱃지] */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* 1. 반복 실행 회차 뱃지: 항상 파스텔톤 노란색 디자인 (라인 번호 뱃지와 동일한 규격) */}
                      {occurrence > 1 ? (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium select-none bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200"
                          title={`루프/분기로 인해 ${occurrence}번째 다시 실행된 인스턴스`}
                        >
                          {occurrence}회차
                        </span>
                      ) : null}

                      {/* 2. 가장 우측: ASM 에디터와 100% 동일한 라인 뱃지 디자인 (싱글모드는 블루, 파이프라인은 연보라) */}
                      {isCrt ? (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium transition-colors select-none ${isRowActiveNow
                              ? isSingleMode
                                ? "bg-blue-100 dark:bg-[#04395E] text-blue-800 dark:text-[#9CDCFE] font-semibold"
                                : "bg-purple-100 dark:bg-[#3B1D54] text-purple-800 dark:text-[#D8B4FE] font-semibold"
                              : "bg-[#F0F0F0] dark:bg-[#252526] text-[#8C959F] dark:text-[#858585] group-hover:text-[#57606A] dark:group-hover:text-[#CCCCCC]"
                            }`}
                          title="C 런타임(CRT) 진입 및 초기화 부트스트랩 코드"
                        >
                          CRT
                        </span>
                      ) : asmLineNumber ? (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium transition-colors select-none ${isRowActiveNow
                              ? isSingleMode
                                ? "bg-blue-100 dark:bg-[#04395E] text-blue-800 dark:text-[#9CDCFE] font-semibold"
                                : "bg-purple-100 dark:bg-[#3B1D54] text-purple-800 dark:text-[#D8B4FE] font-semibold"
                              : "bg-[#F0F0F0] dark:bg-[#252526] text-[#57606A] dark:text-[#858585] group-hover:text-[#24292F] dark:group-hover:text-[#CCCCCC]"
                            }`}
                          title={cSourceLine ? `어셈블리 L${asmLineNumber} (C: L${cSourceLine})` : `어셈블리 L${asmLineNumber}`}
                        >
                          ASM: L{asmLineNumber}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 좌측 명령어 열과 우측 그리드 사이를 분리하는 절대 사라지지 않는 독립된 1px 물리 세로 디바이더선 */}
          <div className="w-[1px] shrink-0 bg-[#E5E5E5] dark:bg-[#333333] z-20" />

          {/* 우측 사이클 그리드 영역 (C0 ~ CN 가로·세로 스크롤 전용 컨테이너, overflow-overlay 지원) */}
          <div
            ref={rightScrollRef}
            onScroll={handleRightScroll}
            className="flex-1 min-w-0 overflow-auto select-none scrollbar-thin bg-white dark:bg-[#1E1E1E] [overflow:overlay]"
          >
            <div
              className="relative min-w-max flex flex-col"
              style={{
                width: `${history.length * COL_WIDTH}px`,
              }}
            >
              {/* 상단 사이클 번호 헤더 행 (Sticky Top) */}
              <div className="h-7 shrink-0 flex items-stretch border-b border-[#E5E5E5] dark:border-[#333333] sticky top-0 bg-[#F3F3F3] dark:bg-[#252526] z-10">
                {history.map((item, cIdx) => {
                  const isCurrent = cIdx === activeCycleCol;
                  const hasStall = item.cycle_events?.stall?.has_stall;
                  const hasFlush = item.cycle_events?.control_hazard?.has_flush;

                  return (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => onJumpToCycle?.(isSingleMode ? cIdx + 1 : cIdx)}
                      className={`shrink-0 flex flex-col items-center justify-center font-mono text-[10px] font-bold border-r border-[#E5E5E5] dark:border-[#333333] cursor-pointer transition-colors relative ${isCurrent
                          ? `${highlightTint.activeHeader} shadow-inner font-extrabold`
                          : hasStall
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                            : hasFlush
                              ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                              : 'text-[#57606A] dark:text-[#858585] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      style={{ width: `${COL_WIDTH}px` }}
                      title={`Clock ${item.clock ?? cIdx}${hasStall ? ' (Stall/Bubble 발생)' : hasFlush ? ' (Branch Flush/Bubble 발생)' : ''
                        }`}
                    >
                      <span>C{item.clock ?? cIdx}</span>
                      {(hasStall || hasFlush) && !isCurrent && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full absolute top-0.5 right-0.5 ${hasStall ? 'bg-amber-500' : 'bg-purple-500'
                            }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 본문 행 영역 */}
              <div className="relative">
                {traceRows.map((row) => {
                  const activeCellNow = activeCycleCol >= 0 ? row.cells[activeCycleCol] : null;
                  const isRowActiveNow = Boolean(activeCellNow);

                  return (
                    <div
                      key={row.id}
                      className="h-[28px] shrink-0 flex items-stretch border-b border-[#E5E5E5] dark:border-[#333333] relative transition-colors"
                    >
                      {history.map((_, cIdx) => {
                        const cell = row.cells[cIdx];
                        const isCurrentCol = cIdx === activeCycleCol;
                        const isCrosshair = isCurrentCol || isRowActiveNow;
                        const cellBgClass = isCrosshair ? highlightTint.row : 'bg-white dark:bg-[#1E1E1E]';

                        if (!cell) {
                          return (
                            <div
                              key={cIdx}
                              className={`shrink-0 border-r border-[#E5E5E5] dark:border-[#333333] cursor-default pointer-events-none select-none transition-colors ${cellBgClass}`}
                              style={{ width: `${COL_WIDTH}px` }}
                            />
                          );
                        }

                        if (cell.isBubble || cell.type === 'BUBBLE') {
                          return (
                            <div
                              key={cIdx}
                              onClick={() => onJumpToCycle?.(isSingleMode ? cIdx + 1 : cIdx)}
                              className={`shrink-0 flex items-center justify-center p-[0.5px] border-r border-[#E5E5E5] dark:border-[#333333] cursor-pointer relative transition-colors group ${cellBgClass}`}
                              style={{ width: `${COL_WIDTH}px` }}
                              title={`Clock ${history[cIdx]?.clock ?? cIdx} | ${row.assembly} ➔ 분기 플러시(Flush)로 인해 작업이 구름처럼 취소(Bubble)됨`}
                            >
                              <div className="relative w-full h-[96%] flex items-center justify-center">
                                {/* 몽글몽글 원호(Arc)가 깊고 뚜렷한 포실포실 뭉게구름 SVG (포커스 or 호버 시 짙은 하늘색) */}
                                <svg
                                  className={`w-full h-full fill-current transition-colors ${isCurrentCol
                                      ? 'text-sky-200 dark:text-[#0C4A6E] stroke-sky-600 dark:stroke-sky-300'
                                      : 'text-sky-100 group-hover:text-sky-200 dark:text-[#182C3D] dark:group-hover:text-[#0C4A6E] stroke-sky-400 group-hover:stroke-sky-600 dark:stroke-sky-400 dark:group-hover:stroke-sky-300'
                                    }`}
                                  viewBox="0 0 100 68"
                                  preserveAspectRatio="none"
                                  strokeWidth={isCurrentCol ? "3.8" : "3.2"}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  {/* 올록볼록 굴곡이 확실하게 살아있는 9-아크 몽글몽글 구름 */}
                                  <path d="M 18 48 
                                           C 5 48, 5 32, 14 26 
                                           C 8 15, 20 6, 30 14 
                                           C 36 3, 50 2, 58 10 
                                           C 66 2, 80 5, 84 16 
                                           C 96 16, 98 30, 91 38 
                                           C 98 48, 88 60, 76 56 
                                           C 70 66, 56 66, 48 58 
                                           C 40 66, 26 66, 22 56 
                                           C 14 58, 10 52, 18 48 Z" />
                                </svg>
                                {/* 구름 배 정중앙 광학적 중심 보정 배치 (텍스트 우하단 1px 미세 이동) */}
                                <span className={`absolute inset-0 flex items-center justify-center text-[9.5px] font-mono font-black tracking-tight select-none pt-[1px] pl-[1px] translate-x-[1px] translate-y-[1px] transition-colors ${isCurrentCol
                                    ? 'text-sky-600 dark:text-sky-300'
                                    : 'text-sky-500 group-hover:text-sky-600 dark:text-sky-400 dark:group-hover:text-sky-300'
                                  }`}>
                                  BBL
                                </span>
                              </div>
                            </div>
                          );
                        }

                        // 스톨(Stall): 버블과 동일한 디자인 언어(배경 틴트 + 테두리 + 테두리색 텍스트)의 표지판 형태 화살표 뱃지 (노란색/Amber 계열)
                        if (cell.isStall || cell.type === 'STALL_IF' || cell.type === 'STALL_ID') {
                          return (
                            <div
                              key={cIdx}
                              onClick={() => onJumpToCycle?.(isSingleMode ? cIdx + 1 : cIdx)}
                              className={`shrink-0 flex items-center justify-center p-[0.5px] border-r border-[#E5E5E5] dark:border-[#333333] cursor-pointer relative transition-colors group ${cellBgClass}`}
                              style={{ width: `${COL_WIDTH}px` }}
                              title={`Clock ${history[cIdx]?.clock ?? cIdx} | ${row.assembly} ➔ 데이터 대기(Hazard)로 인해 1클럭 지연(Stall)되어 다음 사이클로 연기됨`}
                            >
                              <div className="relative w-[92%] h-[96%] flex items-center justify-center">
                                {/* 표지판 형태의 오른쪽 화살표 SVG - 웜 옐로우/앰버 톤 스타일 */}
                                <svg
                                  className={`w-full h-full fill-current transition-colors ${isCurrentCol
                                      ? 'text-amber-200 dark:text-[#78350F] stroke-amber-500 dark:stroke-amber-300'
                                      : 'text-amber-100 group-hover:text-amber-200 dark:text-[#451A03] dark:group-hover:text-[#78350F] stroke-amber-400 group-hover:stroke-amber-500 dark:stroke-amber-400 dark:group-hover:stroke-amber-300'
                                    }`}
                                  viewBox="0 0 100 68"
                                  preserveAspectRatio="none"
                                  strokeWidth={isCurrentCol ? "3.8" : "3.2"}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  {/* 정밀 비율로 균형 잡힌 표지판 화살표 패스 (몸통 너비 넉넉하게 확장) */}
                                  <path d="M 8 16 
                                           C 5 16, 4 19, 4 22 
                                           L 4 46 
                                           C 4 49, 5 52, 8 52 
                                           L 58 52 
                                           L 58 60 
                                           C 58 64, 63 65, 66 62 
                                           L 96 36 
                                           C 98 34, 98 34, 96 32 
                                           L 66 6 
                                           C 63 3, 58 4, 58 8 
                                           L 58 16 
                                           Z" />
                                </svg>
                                {/* 화살표 몸통 및 전체 기준 중앙 배치 (텍스트 Y는 1px 내려서 0px 복원, X는 1px 우측 유지) */}
                                <span className={`absolute inset-0 flex items-center justify-center pt-[2px] pr-[3px] text-[9.5px] font-mono font-black tracking-tight select-none translate-x-[1px] transition-colors ${isCurrentCol
                                    ? 'text-amber-700 dark:text-amber-200'
                                    : 'text-amber-600 group-hover:text-amber-700 dark:text-amber-300 dark:group-hover:text-amber-100'
                                  }`}>
                                  STL
                                </span>
                              </div>
                            </div>
                          );
                        }

                        const style = STAGE_STYLES[cell.type];

                        return (
                          <div
                            key={cIdx}
                            onClick={() => onJumpToCycle?.(isSingleMode ? cIdx + 1 : cIdx)}
                            className={`shrink-0 flex items-center justify-center p-0.5 border-r border-[#E5E5E5] dark:border-[#333333] cursor-pointer relative transition-colors ${cellBgClass}`}
                            style={{ width: `${COL_WIDTH}px` }}
                            title={`Clock ${history[cIdx]?.clock ?? cIdx} | ${row.assembly} ➔ ${cell.isStall
                                ? `${cell.stage} 단계 지연 (Stall / EX에 Bubble 삽입)`
                                : `${cell.stage} 단계 실행 중`
                              }`}
                          >
                            <span
                              className={`w-full h-full rounded-[4px] text-[9.5px] font-mono tracking-tight flex items-center justify-center select-none text-white transition-colors ${isCurrentCol
                                  ? `${style.activeBg} font-extrabold shadow-xs`
                                  : `${style.bg} ${style.hoverBg} font-bold`
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
        </div>
      )}
    </div>
  );
};

export default MultiCycleDiagram;
