import React, { useMemo, useRef, useEffect } from "react";
import type { MappedAssemblyRow } from "../utils/translationCompile";
import type { StageBuffer, CycleEvents, SimulationResult } from "@/type/simulation";
import { buildMultiCycleTraceRows, type TraceRow } from "../utils/multiCycleTrace";
import { splitInstruction } from "@/utils/instructionFormat";
import { STAGES_CONFIG } from "../utils/riscvMonacoTheme";

interface MappingRowListProps {
  rows: MappedAssemblyRow[];
  selectedLine?: number | null;
  selectedAsmIndex?: number | null;
  executionLine?: number | null;
  onSelectLine?: (line: number | null, asmIndex?: number | null, openTutorModal?: boolean) => void;
  stageBuffers?: {
    IF?: StageBuffer | null;
    ID?: StageBuffer | null;
    EX?: StageBuffer | null;
    MEM?: StageBuffer | null;
    WB?: StageBuffer | null;
  };
  cycleEvents?: CycleEvents | null;
  simulationData?: SimulationResult | null;
  playbackCycle?: number;
  mode: "single" | "pipeline";
  currentActiveStep?: number | null;
}

export const MappingRowList: React.FC<MappingRowListProps> = ({
  rows,
  selectedLine,
  selectedAsmIndex,
  executionLine,
  onSelectLine,
  stageBuffers,
  cycleEvents,
  simulationData,
  playbackCycle,
  mode,
  currentActiveStep,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rowElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const traceRows = useMemo<TraceRow[]>(() => {
    if (!simulationData?.history?.length || mode === "single") return [];
    return buildMultiCycleTraceRows(simulationData.history, false);
  }, [simulationData, mode]);

  const activeStagesByRow = useMemo(() => {
    const map: Record<number, { stage: string; isStall: boolean; isBubble: boolean }[]> = {};
    if (mode === "single") return map;

    if (traceRows.length > 0 && playbackCycle && playbackCycle >= 1) {
      const cIdx = playbackCycle - 1;
      traceRows.forEach((tRow) => {
        const cell = tRow.cells[cIdx];
        if (!cell) return;

        const targetPc = tRow.pc ? parseInt(tRow.pc, 16) : null;
        let matchedRowIdx = -1;

        if (targetPc !== null && !isNaN(targetPc)) {
          matchedRowIdx = rows.findIndex(
            (r) => r.pc && parseInt(r.pc, 16) === targetPc
          );
          if (matchedRowIdx === -1) {
            const estimatedIdx = Math.floor(targetPc / 4);
            if (estimatedIdx >= 0 && estimatedIdx < rows.length) {
              matchedRowIdx = estimatedIdx;
            }
          }
        }

        if (matchedRowIdx === -1 && tRow.assembly) {
          const normAsm = tRow.assembly.replace(/\s+/g, " ").trim().toLowerCase();
          matchedRowIdx = rows.findIndex(
            (r, idx) => !map[idx] && r.text.replace(/\s+/g, " ").trim().toLowerCase() === normAsm
          );
        }

        if (matchedRowIdx !== -1) {
          if (!map[matchedRowIdx]) map[matchedRowIdx] = [];
          if (!map[matchedRowIdx].some((s) => s.stage === cell.stage)) {
            map[matchedRowIdx].push({
              stage: cell.stage,
              isStall: Boolean(cell.isStall),
              isBubble: Boolean(cell.isBubble),
            });
          }
        }
      });

      return map;
    }

    if (stageBuffers) {
      const hasGlobalStall = Boolean(cycleEvents?.stall?.has_stall);
      const stallStage = cycleEvents?.stall?.stage;
      const hasGlobalFlush = Boolean(cycleEvents?.control_hazard?.has_flush);
      const flushedStages = cycleEvents?.control_hazard?.flushed_stages || ["IF", "ID"];

      STAGES_CONFIG.forEach(({ key, name }) => {
        const buf = stageBuffers[key];
        if (buf && buf.assembly && buf.assembly !== "bubble" && buf.assembly !== "empty") {
          const isStalled =
            buf.status === "stalled" ||
            buf.status === "stall" ||
            (hasGlobalStall && (stallStage ? stallStage === name : name === "ID"));

          const isBubble =
            buf.status === "flushed" ||
            buf.flush_info?.is_flushed === true ||
            (hasGlobalFlush && flushedStages.includes(name));

          const norm = buf.assembly.replace(/\s+/g, " ").trim().toLowerCase();
          const targetPc = buf.pc ? parseInt(buf.pc, 16) : null;

          let matchedRowIdx = -1;
          if (targetPc !== null && !isNaN(targetPc)) {
            matchedRowIdx = rows.findIndex((r) => r.pc && parseInt(r.pc, 16) === targetPc);
            if (matchedRowIdx === -1) {
              const estimatedIdx = Math.floor(targetPc / 4);
              if (estimatedIdx >= 0 && estimatedIdx < rows.length) matchedRowIdx = estimatedIdx;
            }
          }
          if (matchedRowIdx === -1) {
            matchedRowIdx = rows.findIndex((r, idx) => !map[idx] && r.text.replace(/\s+/g, " ").trim().toLowerCase() === norm);
          }

          if (matchedRowIdx !== -1) {
            if (!map[matchedRowIdx]) map[matchedRowIdx] = [];
            if (!map[matchedRowIdx].some((s) => s.stage === name)) {
              map[matchedRowIdx].push({ stage: name, isStall: isStalled, isBubble });
            }
          }
        }
      });
    }

    return map;
  }, [traceRows, playbackCycle, rows, mode, stageBuffers, cycleEvents]);

  const scrollGroupIntoView = (lastEl: HTMLElement, firstEl?: HTMLElement) => {
    const container = containerRef.current;
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    const lastRect = lastEl.getBoundingClientRect();

    if (lastRect.bottom > cRect.bottom - 28) {
      const scrollDiff = lastRect.bottom - (cRect.bottom - 28);
      container.scrollTo({
        top: container.scrollTop + scrollDiff,
        behavior: "smooth",
      });
      return;
    }

    if (firstEl) {
      const firstRect = firstEl.getBoundingClientRect();
      if (firstRect.top < cRect.top + 12) {
        const scrollDiff = cRect.top + 12 - firstRect.top;
        container.scrollTo({
          top: Math.max(0, container.scrollTop - scrollDiff),
          behavior: "smooth",
        });
      }
    }
  };

  useEffect(() => {
    if (mode !== "single" || currentActiveStep === null || currentActiveStep === undefined) return;
    if (!containerRef.current) return;

    const activeRow = rows[currentActiveStep];
    if (!activeRow) return;

    let lastSiblingIndex = currentActiveStep;
    for (let i = currentActiveStep; i < rows.length; i++) {
      if (rows[i].sourceLine === activeRow.sourceLine) {
        lastSiblingIndex = i;
      } else {
        break;
      }
    }

    const lastEl = rowElementsRef.current.get(lastSiblingIndex);
    const activeEl = rowElementsRef.current.get(currentActiveStep);

    if (lastEl) {
      scrollGroupIntoView(lastEl, activeEl);
    }
  }, [mode, currentActiveStep, rows]);

  const matchingIndices = useMemo(() => {
    if (!selectedLine) return new Set<number>();
    const indices = new Set<number>();
    rows.forEach((row, idx) => {
      if (row.sourceLine === selectedLine) {
        indices.add(idx);
      }
    });
    return indices;
  }, [rows, selectedLine]);

  useEffect(() => {
    if (!selectedLine || !containerRef.current) return;

    let firstIdx = -1;
    let lastIdx = -1;
    rows.forEach((row, idx) => {
      if (row.sourceLine === selectedLine) {
        if (firstIdx === -1) firstIdx = idx;
        lastIdx = idx;
      }
    });

    if (lastIdx !== -1) {
      const lastEl = rowElementsRef.current.get(lastIdx);
      const firstEl = rowElementsRef.current.get(firstIdx);

      if (lastEl) {
        scrollGroupIntoView(lastEl, firstEl);
      }
    }
  }, [selectedLine, rows]);

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto text-[13px] leading-snug [scrollbar-gutter:stable] bg-white dark:bg-[#1E1E1E] text-[#24292F] dark:text-[#CCCCCC] select-text py-1"
      style={{ fontFamily: "'D2Coding', Consolas, 'Fira Code', monospace" }}
      role="region"
      aria-label="어셈블리 명령어 목록"
    >
      {rows.map((row, index) => {
        const isMatched = matchingIndices.has(index);
        const isFirstOfMatch = isMatched && !matchingIndices.has(index - 1);
        const { opcode, operands } = splitInstruction(row.text);

        const activeStages = activeStagesByRow[index] || [];
        const isCurrentSingleActive = mode === "single" && currentActiveStep === index;

        const isSingleExecutionSibling =
          mode === "single" &&
          executionLine !== null &&
          executionLine !== undefined &&
          row.sourceLine === executionLine &&
          !isCurrentSingleActive;

        type BracketType = "start" | "middle" | "end" | "single" | null;
        let bracketType: BracketType = null;

        if (row.sourceLine !== null && row.sourceLine !== undefined) {
          const prevSame = index > 0 && rows[index - 1]?.sourceLine === row.sourceLine;
          const nextSame = index < rows.length - 1 && rows[index + 1]?.sourceLine === row.sourceLine;

          if (!prevSame && nextSame) {
            bracketType = "start";
          } else if (prevSame && nextSame) {
            bracketType = "middle";
          } else if (prevSame && !nextSame) {
            bracketType = "end";
          } else {
            bracketType = "single";
          }
        }

        const isSelectedPrimary =
          selectedAsmIndex !== null && selectedAsmIndex !== undefined
            ? selectedAsmIndex === index
            : isFirstOfMatch;
        const isSelectedSibling = isMatched && !isSelectedPrimary;

        const isExecutingAndSelected = isCurrentSingleActive && isSelectedPrimary;
        const isCrt = row.sourceLine === null;

        let rowColorClass = "border-transparent hover:bg-slate-100/70 dark:hover:bg-[#2A2D2E] text-[#24292F] dark:text-[#CCCCCC]";

        const hasEffectiveExecution = activeStages.some((s) => !s.isBubble);
        const isPipelineExecuting = mode === "pipeline" && hasEffectiveExecution;
        const isPipelineBubble = mode === "pipeline" && !hasEffectiveExecution && activeStages.some((s) => s.isBubble);
        const isLineExecuting = isCurrentSingleActive || isPipelineExecuting;

        if (isSelectedPrimary) {
          rowColorClass = mode === "pipeline"
            ? "bg-purple-100/90 dark:bg-[#2E1065] border-purple-600 dark:border-[#8B5CF6] text-purple-950 dark:text-[#E9D5FF] font-bold shadow-2xs"
            : "bg-blue-100/90 dark:bg-[#04395E] border-blue-600 dark:border-[#007ACC] text-blue-950 dark:text-[#9CDCFE] font-bold shadow-2xs";
        } else if (isSelectedSibling) {
          rowColorClass = mode === "pipeline"
            ? "bg-purple-50/50 dark:bg-[#2E1065]/40 border-purple-300/60 dark:border-[#8B5CF6]/50 text-purple-900/80 dark:text-[#E9D5FF]/80 font-normal"
            : "bg-blue-50/50 dark:bg-[#04395E]/40 border-blue-300/60 dark:border-[#007ACC]/50 text-blue-900/80 dark:text-[#9CDCFE]/80 font-normal";
        } else if (isLineExecuting) {
          rowColorClass = "bg-emerald-100/90 dark:bg-[#133A27] border-emerald-500 dark:border-[#23D18B] text-emerald-950 dark:text-[#7EE787] font-bold shadow-2xs";
        } else if (isPipelineBubble || isSingleExecutionSibling) {
          rowColorClass = "bg-emerald-50/50 dark:bg-[#133A27]/40 border-emerald-300/60 dark:border-[#23D18B]/50 text-emerald-900/80 dark:text-[#7EE787]/80 font-normal";
        }

        return (
          <div
            key={`${row.pc || index}-${row.sourceLine}-${index}`}
            ref={(el) => {
              if (el) rowElementsRef.current.set(index, el);
              else rowElementsRef.current.delete(index);
            }}
            onClick={() => {
              if (selectedLine === row.sourceLine && selectedAsmIndex === index) {
                onSelectLine?.(null, null);
              } else {
                onSelectLine?.(row.sourceLine, index);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`ASM L${index + 1} ${row.text}`}
            aria-pressed={isSelectedPrimary}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.currentTarget.click();
              }
            }}
            className={`flex items-stretch transition-colors duration-100 cursor-pointer group min-h-[24px] border-l-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ar-accent)] ${rowColorClass}`}
          >
            <div className="w-5 shrink-0 flex items-center justify-center select-none pl-0.5">
              {isExecutingAndSelected ? (
                <div className="flex items-center gap-0.5">
                  <span className="text-emerald-600 dark:text-[#23D18B] text-xs font-bold leading-none animate-pulse">▶</span>
                  <span className="text-[#005FB8] dark:text-[#007ACC] text-[9px] leading-none">●</span>
                </div>
              ) : isLineExecuting ? (
                <span className="text-emerald-600 dark:text-[#23D18B] text-xs font-bold leading-none animate-pulse">▶</span>
              ) : isSelectedPrimary ? (
                <span className={`${mode === "pipeline" ? "text-purple-600 dark:text-[#A78BFA]" : "text-[#005FB8] dark:text-[#007ACC]"} text-[10px] leading-none`}>●</span>
              ) : null}
            </div>

            <div className="w-3.5 self-stretch shrink-0 relative select-none">
              {bracketType && (
                <div
                  className={`absolute inset-0 pointer-events-none ${isSelectedPrimary || isSelectedSibling
                    ? mode === "pipeline"
                      ? "text-purple-600 dark:text-[#A78BFA]"
                      : "text-[#005FB8] dark:text-[#007ACC]"
                    : "text-slate-300 dark:text-[#3E4245] group-hover:text-slate-400 dark:group-hover:text-[#585C60]"
                    }`}
                >
                  {bracketType === "start" && (
                    <>
                      <span className="absolute left-1/2 top-1/2 bottom-0 w-[1.5px] -translate-x-1/2 bg-current" />
                      <span className="absolute left-1/2 top-1/2 right-0.5 h-[1.5px] -translate-y-1/2 bg-current" />
                    </>
                  )}
                  {bracketType === "middle" && (
                    <span className="absolute left-1/2 top-0 bottom-0 w-[1.5px] -translate-x-1/2 bg-current" />
                  )}
                  {bracketType === "end" && (
                    <>
                      <span className="absolute left-1/2 top-0 bottom-1/2 w-[1.5px] -translate-x-1/2 bg-current" />
                      <span className="absolute left-1/2 top-1/2 right-0.5 h-[1.5px] -translate-y-1/2 bg-current" />
                    </>
                  )}
                  {bracketType === "single" && (
                    <span className="absolute left-1.5 right-0.5 top-1/2 h-[1.5px] -translate-y-1/2 bg-current" />
                  )}
                </div>
              )}
            </div>

            <div
              className={`w-8 shrink-0 text-right pr-3 select-none text-[13px] flex items-center justify-end ${isSelectedPrimary
                ? mode === "pipeline"
                  ? "text-purple-700 dark:text-[#C4B5FD] font-bold"
                  : "text-[#005FB8] dark:text-[#79C0FF] font-bold"
                : isSelectedSibling
                  ? mode === "pipeline"
                    ? "text-purple-500 dark:text-[#C4B5FD]/70 font-medium"
                    : "text-blue-500 dark:text-[#79C0FF]/70 font-medium"
                  : isLineExecuting
                    ? "text-emerald-700 dark:text-[#7EE787] font-bold"
                    : isPipelineBubble || isSingleExecutionSibling
                      ? "text-emerald-600 dark:text-[#7EE787]/70"
                      : "text-[#8C959F] dark:text-[#858585]"
                }`}
            >
              {index + 1}
            </div>

            <div className="w-[52px] shrink-0 font-bold select-text flex items-center">
              <span
                className={
                  isSelectedPrimary
                    ? mode === "pipeline"
                      ? "text-purple-900 dark:text-[#E9D5FF] font-bold"
                      : "text-blue-800 dark:text-[#79C0FF] font-bold"
                    : isSelectedSibling
                      ? mode === "pipeline"
                        ? "text-purple-700 dark:text-[#E9D5FF]/80 font-semibold"
                        : "text-blue-600 dark:text-[#79C0FF]/80 font-semibold"
                      : isLineExecuting
                        ? "text-emerald-800 dark:text-[#7EE787] font-bold"
                        : isPipelineBubble || isSingleExecutionSibling
                          ? "text-emerald-700 dark:text-[#7EE787]/80 font-semibold"
                          : isCrt
                            ? "text-[#6E7681] dark:text-[#858585] font-semibold"
                            : mode === "pipeline"
                              ? "text-purple-700 dark:text-[#A78BFA] font-semibold"
                              : "text-[#005FB8] dark:text-[#569CD6] font-semibold"
                }
              >
                {opcode}
              </span>
            </div>

            <div className="flex-1 pr-2 whitespace-pre-wrap break-words select-text flex items-center gap-2">
              <span
                className={
                  isSelectedPrimary
                    ? "text-slate-950 dark:text-white font-bold"
                    : isSelectedSibling
                      ? "text-slate-800 dark:text-[#D4D4D4] font-normal"
                      : isLineExecuting
                        ? "text-slate-950 dark:text-white font-bold"
                        : isPipelineBubble || isSingleExecutionSibling
                          ? "text-slate-800 dark:text-[#D4D4D4] font-normal"
                          : isCrt
                            ? "text-[#6E7681]/90 dark:text-[#858585]"
                            : "text-[#24292F] dark:text-[#CCCCCC]"
                }
              >
                {operands}
              </span>

              {activeStages.length > 0 && (
                <div className="flex items-center gap-1 shrink-0 select-none">
                  {activeStages.map(({ stage: stg, isStall, isBubble }) => {
                    const cfg = STAGES_CONFIG.find((s) => s.name === stg);
                    return (
                      <div key={stg} className="flex items-center gap-1">
                        {isStall && (
                          <span
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-[#451A03] text-amber-600 dark:text-amber-300 border border-amber-400 dark:border-amber-500 text-[8.5px] font-black shadow-2xs animate-in zoom-in-95 duration-100"
                            title="스톨(Stall): 데이터 대기(Hazard)로 인해 1클록 지연되어 이 스테이지에 정지 상태로 유지됨"
                          >
                            <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                              <path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-7.85-1.42 1.42L16.86 11H5v2z" />
                            </svg>
                            <span className="inline-block -translate-y-[0.5px]">STL</span>
                          </span>
                        )}

                        {isBubble && !isStall ? (
                          <span
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-[#182C3D] text-sky-500 dark:text-sky-300 border border-sky-400 dark:border-sky-400 text-[8.5px] font-black shadow-2xs animate-in zoom-in-95 duration-100"
                            title={`플러시(Bubble): 분기/점프로 인해 무효화되어 ${stg} 단계에서 버블(NOP)로 변환됨`}
                          >
                            <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                            </svg>
                            <span className="inline-block -translate-y-[0.5px]">BBL</span>
                          </span>
                        ) : (
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-sans font-bold shadow-2xs animate-in zoom-in-95 duration-100 ${isStall
                              ? `${cfg?.badgeBg || "bg-slate-700 text-white"} ring-1 ring-amber-400 ring-offset-0.5`
                              : cfg?.badgeBg || "bg-slate-700 text-white"
                              }`}
                            title={
                              isStall
                                ? `스톨로 인해 지연되어 유지 중인 ${stg} 단계`
                                : `${stg} 단계 실행 중`
                            }
                          >
                            {stg}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="shrink-0 pr-4 flex items-center select-none">
              {row.sourceLine !== null ? (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium transition-colors ${isSelectedPrimary
                    ? mode === "pipeline"
                      ? "bg-purple-600 text-white font-bold shadow-2xs"
                      : "bg-[#005FB8] dark:bg-[#007ACC] text-white font-bold shadow-2xs"
                    : isLineExecuting
                      ? "bg-emerald-600 text-white font-bold shadow-2xs"
                      : isSelectedSibling
                        ? mode === "pipeline"
                          ? "bg-purple-100 dark:bg-[#2E1065] text-purple-800 dark:text-[#E9D5FF] font-semibold"
                          : "bg-blue-100 dark:bg-[#04395E] text-blue-800 dark:text-[#9CDCFE] font-semibold"
                        : isPipelineBubble || isSingleExecutionSibling
                          ? "bg-emerald-100 dark:bg-[#133A27] text-emerald-800 dark:text-[#7EE787] font-semibold"
                          : "bg-[#F0F0F0] dark:bg-[#252526] text-[#57606A] dark:text-[#858585] group-hover:text-[#24292F] dark:group-hover:text-[#CCCCCC]"
                    }`}
                >
                  C: L{row.sourceLine}
                </span>
              ) : (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium transition-colors ${isSelectedPrimary
                    ? mode === "pipeline"
                      ? "bg-purple-600 text-white font-bold shadow-2xs"
                      : "bg-[#005FB8] dark:bg-[#007ACC] text-white font-bold shadow-2xs"
                    : isLineExecuting
                      ? "bg-emerald-600 text-white font-bold shadow-2xs"
                      : isSelectedSibling
                        ? mode === "pipeline"
                          ? "bg-purple-100 dark:bg-[#2E1065] text-purple-800 dark:text-[#E9D5FF] font-semibold"
                          : "bg-blue-100 dark:bg-[#04395E] text-blue-800 dark:text-[#9CDCFE] font-semibold"
                        : isPipelineBubble || isSingleExecutionSibling
                          ? "bg-emerald-100 dark:bg-[#133A27] text-emerald-800 dark:text-[#7EE787] font-semibold"
                          : "bg-[#F0F0F0] dark:bg-[#252526] text-[#8C959F] dark:text-[#858585] group-hover:text-[#57606A] dark:group-hover:text-[#CCCCCC]"
                    }`}
                  title="대응하는 C 소스 위치가 확인되지 않았습니다. CRT 여부는 줄 정보만으로 확정할 수 없습니다."
                >
                  미매핑
                </span>
              )}
            </div>
          </div>
        );
      })}

      {rows.length === 0 && (
        <p className="p-4 text-xs text-[#8C959F] dark:text-[#858585] font-sans">
          줄 정보가 포함된 어셈블리 명령어를 추출하지 못했습니다.
        </p>
      )}
    </div>
  );
};
