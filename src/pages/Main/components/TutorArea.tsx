import React, { useMemo } from 'react';
import type { CycleHistoryItem, SimulationResult } from '@/type/simulation';
import type { CodeLineSelectInfo } from './Source/SourceViewer';
import { mapAssembly, type MappedAssemblyRow } from './translationCompile';
import { analyzeCLine, analyzeAsmInstruction } from './tutorAnalysis';

export interface TutorAreaProps {
  simulationData: SimulationResult | null;
  currentCycleData: CycleHistoryItem | null;
  loadingMessage?: string | null;
  selectedCodeLine?: CodeLineSelectInfo | null;
  onClearSelectedCodeLine?: () => void;

  // C ↔ 어셈블리 튜터 모드 Props
  translationSource?: string;
  translationAssembly?: string;
  selectedTranslationLine?: number | null;
  selectedAsmIndex?: number | null;
  currentActiveAsmIndex?: number | null;
  executionLine?: number | null;
  isUserSelected?: boolean;
  onSelectTranslationLine?: (line: number | null) => void;
}

const TutorArea: React.FC<TutorAreaProps> = ({
  simulationData,
  currentCycleData,
  loadingMessage,
  selectedCodeLine: _selectedCodeLine,
  onClearSelectedCodeLine: _onClearSelectedCodeLine,
  translationSource,
  translationAssembly,
  selectedTranslationLine,
  selectedAsmIndex,
  currentActiveAsmIndex,
  executionLine: _executionLine,
  isUserSelected = false,
  onSelectTranslationLine: _onSelectTranslationLine,
}) => {
  // 1. C 소스 코드 라인별 배열
  const cLines = useMemo(() => {
    return (translationSource || "").split(/\r?\n/);
  }, [translationSource]);

  // 2. 어셈블리 파싱 및 C 라인 매핑 결과
  const mappedRows: MappedAssemblyRow[] = useMemo(() => {
    if (!translationAssembly) return [];
    return mapAssembly(translationAssembly, cLines.length);
  }, [translationAssembly, cLines.length]);

  // 3. 선택된 C 라인에 매핑된 어셈블리 명령어 리스트 추출
  const mappedAsmForSelectedLine = useMemo(() => {
    if (!selectedTranslationLine || selectedTranslationLine <= 0) return [];
    return mappedRows
      .map((row, originalIndex) => ({ ...row, asmIndex: originalIndex + 1 }))
      .filter((row) => row.sourceLine === selectedTranslationLine);
  }, [mappedRows, selectedTranslationLine]);

  // 4. 선택된 C 라인 텍스트 및 분석
  const selectedCLineText = useMemo(() => {
    if (!selectedTranslationLine || selectedTranslationLine <= 0) return null;
    return cLines[selectedTranslationLine - 1] ?? "";
  }, [cLines, selectedTranslationLine]);

  const cLineAnalysis = useMemo(() => {
    if (!selectedTranslationLine || selectedCLineText === null) return null;
    return analyzeCLine(selectedCLineText, selectedTranslationLine);
  }, [selectedTranslationLine, selectedCLineText]);

  // ----------------------------------------------------
  // 로딩 상태 화면
  // ----------------------------------------------------
  if (loadingMessage) {
    return (
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col items-center justify-center text-center gap-2.5">
        <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-blue-700">{loadingMessage}</span>
      </div>
    );
  }

  return (
    <section
      className="@container flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs select-none"
      aria-label="AI 튜터 해설 패널"
    >
      {/* 튜터 상단 헤더 */}
      <header className="shrink-0 flex items-center justify-between border-b border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5 min-w-0">
        <div className="flex items-center gap-2 min-w-0 shrink">
          <span className="text-sm shrink-0">🎓</span>
          <h3 className="text-xs font-bold text-slate-800 whitespace-nowrap shrink-0">ArchReactor Tutor</h3>
          {selectedTranslationLine ? (
            isUserSelected ? (
              <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200 font-mono whitespace-nowrap flex items-center gap-1">
                <span>🔍</span>
                <span className="hidden @[460px]:inline">선택 라인</span>
                <span>(L{selectedTranslationLine})</span>
              </span>
            ) : (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-200 font-mono whitespace-nowrap flex items-center gap-1">
                <span>⚡</span>
                <span className="hidden @[460px]:inline">실행 중</span>
                <span>(L{selectedTranslationLine})</span>
              </span>
            )
          ) : (
            <span className="text-[10px] text-slate-400 truncate">명령어 & 컴파일 해설</span>
          )}
        </div>

        {/* 우측 액션: 닫기 버튼 삭제 */}
      </header>

      {/* 튜터 메인 본문 영역 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5 space-y-3.5 select-text [scrollbar-gutter:stable]">
        {/* ========================================================= */}
        {/* 모드 1: C/어셈블리 특정 라인이 선택되었을 때 (교육용 튜터) */}
        {/* ========================================================= */}
        {selectedTranslationLine && cLineAnalysis ? (
          <div className="flex flex-col gap-3">
            {/* 1. 선택한 C 언어 라인 및 구문 역할 해설 */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">📄</span>
                  <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded border border-blue-200 shadow-2xs">
                    C: L{selectedTranslationLine}
                  </span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${cLineAnalysis.badgeColor}`}>
                  {cLineAnalysis.type}
                </span>
              </div>

              {/* C 코드 블록 */}
              <div
                className="font-mono text-xs px-2.5 py-1.5 rounded-lg bg-white border border-blue-200/80 text-blue-950 font-semibold shadow-2xs whitespace-pre-wrap break-all"
                style={{ fontFamily: "'D2Coding', Consolas, 'Fira Code', monospace" }}
              >
                {selectedCLineText?.trim() || <span className="text-slate-400 italic">빈 줄</span>}
              </div>

              {/* C 구문 자연어 해설 */}
              <div className="space-y-1 mt-0.5">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <span>💡</span>
                  <span>{cLineAnalysis.summary}</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed pl-4">
                  {cLineAnalysis.detail}
                </p>
              </div>
            </div>

            {/* 2. 연관된 RISC-V 어셈블리 명령어 블록 & 세부 하드웨어 동작 해설 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 flex flex-col gap-2.5">
              <div className="flex flex-col gap-1 border-b border-slate-200/60 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs">⚡</span>
                    <span className="text-[11px] font-bold text-slate-800">
                      매핑된 ASM:
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {mappedAsmForSelectedLine.length > 0
                        ? mappedAsmForSelectedLine.map((r) => `L${r.asmIndex}`).join(", ")
                        : "없음"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({mappedAsmForSelectedLine.length}개)
                  </span>
                </div>
                {/* RV32IM, GCC 아랫줄 배치 */}
                <div className="text-[10px] text-slate-400 font-mono pl-4">
                  RV32IM / GCC -O0
                </div>
              </div>

              {mappedAsmForSelectedLine.length === 0 ? (
                <div className="p-3 rounded-lg bg-white border border-slate-200 text-center text-xs text-slate-400">
                  이 라인은 주석, 공백 또는 디렉티브로서 독립된 실행 어셈블리 명령어가 생성되지 않았습니다.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {mappedAsmForSelectedLine.map((asmRow, idx) => {
                    const instDetail = analyzeAsmInstruction(asmRow.text);
                    const rowZeroIndex = asmRow.asmIndex - 1;

                    // 현재 실제 CPU 실행 중인 행인가?
                    const isRowExecuting = currentActiveAsmIndex === rowZeroIndex;
                    // 사용자가 수동으로 콕 집어 선택한 행인가? (사용자가 선택한 모드일 때만 적용)
                    const isRowSelectedFocus =
                      isUserSelected &&
                      (selectedAsmIndex !== null && selectedAsmIndex !== undefined
                        ? selectedAsmIndex === rowZeroIndex
                        : idx === 0);

                    return (
                      <div
                        key={`${asmRow.asmIndex}-${idx}`}
                        className={`rounded-lg bg-white p-2.5 shadow-2xs transition-all flex flex-col gap-1.5 ${
                          isRowSelectedFocus
                            ? "border-2 border-blue-500 ring-2 ring-blue-100/80 bg-blue-50/20"
                            : isRowExecuting
                            ? "border-2 border-emerald-500 ring-2 ring-emerald-100/80 bg-emerald-50/20"
                            : "border border-slate-200/90 hover:border-slate-300"
                        }`}
                      >
                        {/* 명령어 뱃지 & 라인 번호 & 포커스 상태 뱃지 */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`w-4 h-4 rounded-full font-mono text-[10px] font-bold flex items-center justify-center ${
                                isRowSelectedFocus
                                  ? "bg-blue-600 text-white"
                                  : isRowExecuting
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span
                              className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                                isRowSelectedFocus
                                  ? "text-blue-800 bg-blue-50 border-blue-300"
                                  : isRowExecuting
                                  ? "text-emerald-800 bg-emerald-50 border-emerald-300"
                                  : "text-slate-800 bg-slate-50 border-slate-200"
                              }`}
                              style={{ fontFamily: "'D2Coding', Consolas, 'Fira Code', monospace" }}
                            >
                              {asmRow.text}
                            </span>
                            {/* 포커스 표시 뱃지: 선택된 라인이면 ● 선택됨 표시 */}
                            {isRowSelectedFocus && (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-100/90 px-1.5 py-0.2 rounded border border-blue-300">
                                ● 선택됨
                              </span>
                            )}
                            {/* 동시에 또는 단독으로 실행 중이면 ▶ 실행 중 뱃지 함께 표시 */}
                            {isRowExecuting && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.2 rounded border border-emerald-300 animate-pulse">
                                ▶ 실행 중
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-mono font-bold ${
                              isRowSelectedFocus
                                ? "text-blue-700"
                                : isRowExecuting
                                ? "text-emerald-700"
                                : "text-slate-400"
                            }`}
                          >
                            ASM L{asmRow.asmIndex}
                          </span>
                        </div>

                        {/* 동작 요약 */}
                        <div className="text-[11px] font-bold text-slate-800 pl-5 flex items-center gap-1">
                          <span className="text-blue-600">➔</span>
                          <span>{instDetail.action}</span>
                        </div>

                        {/* 상세 해설 */}
                        <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                          {instDetail.explanation}
                        </p>

                        {/* 하드웨어 아키텍처 관점 (스택, 레지스터, 파이프라인 단계) */}
                        <div className="ml-5 mt-0.5 p-1.5 rounded bg-slate-50 border border-slate-100 text-[10px] text-slate-500 leading-normal flex items-start gap-1">
                          <span className="font-semibold text-slate-700 shrink-0">하드웨어 동작:</span>
                          <span>{instDetail.hardwareDetail}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* 모드 2: 특정 라인이 선택되지 않았을 때 (기본 안내 & 클록 사이클 뷰) */
          /* ========================================================= */
          <div className="flex flex-col gap-3">
            {/* 상단 인터랙션 안내 카드 */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-blue-200 flex items-center justify-center text-lg shadow-2xs shrink-0">
                👆
              </div>
              <div className="flex flex-col gap-0.5">
                <strong className="text-xs text-blue-950 font-bold">
                  라인별 실시간 컴파일 해설 지원
                </strong>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  상단의 <span className="font-semibold text-blue-700">C 소스 코드</span>나{" "}
                  <span className="font-semibold text-blue-700">어셈블리 명령어</span> 줄을 클릭하면,
                  해당 라인의 C 문법 역할과 대응되는 RISC-V 하드웨어 동작이 이곳에 단계별로 풀이됩니다.
                </p>
              </div>
            </div>

            {/* 현재 시뮬레이션 클록 해설 (시뮬레이션 실행 중일 때) */}
            {currentCycleData ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col gap-2.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-800">
                      현재 사이클({currentCycleData.clock} Clock) 실행 분석
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Cycle {currentCycleData.clock} / {simulationData?.summary?.total_cycles || 0}
                  </span>
                </div>

                {/* 현재 파이프라인 인출(IF) 명령어 */}
                {(() => {
                  const ifBuf = currentCycleData.buffers?.IF || currentCycleData.if_stage;
                  const ifInst = ifBuf?.assembly || "bubble";
                  const ifAnalysis = analyzeAsmInstruction(ifInst);
                  return (
                    <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-indigo-700 font-sans">
                          [IF 인출 단계] {ifInst}
                        </span>
                        {ifBuf?.pc && (
                          <span className="font-mono text-[10px] text-slate-400">
                            PC: {ifBuf.pc}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {ifAnalysis.explanation}
                      </p>
                    </div>
                  );
                })()}

                {/* 해저드 및 스톨 여부 카드 */}
                {(() => {
                  const { cycle_events } = currentCycleData;
                  const isStall = cycle_events.stall?.has_stall;
                  const isForward = cycle_events.forwarding?.has_forwarded;
                  const isFlush = cycle_events.control_hazard?.has_flush;

                  return (
                    <div
                      className={`p-2.5 rounded-lg border text-[11px] leading-relaxed ${
                        isStall
                          ? "bg-rose-50 border-rose-200 text-rose-900"
                          : isFlush
                          ? "bg-amber-50 border-amber-200 text-amber-900"
                          : isForward
                          ? "bg-cyan-50 border-cyan-200 text-cyan-900"
                          : "bg-emerald-50 border-emerald-200 text-emerald-900"
                      }`}
                    >
                      <strong className="font-bold block mb-0.5">
                        {isStall
                          ? "⚠️ 데이터 해저드 (Data Stall)"
                          : isFlush
                          ? "🔄 제어 해저드 (Branch Flush)"
                          : isForward
                          ? "⚡ 데이터 포워딩 (Forwarding 활성화)"
                          : "✅ 정상 파이프라인 전진"}
                      </strong>
                      <span className="opacity-90">
                        {isStall
                          ? cycle_events.stall?.stall_desc || "필요한 피연산자가 준비되지 않아 파이프라인이 1사이클 정지되었습니다."
                          : isFlush
                          ? cycle_events.control_hazard?.flush_reason || "분기 예측 실패로 인해 파이프라인 버블이 플러시되었습니다."
                          : isForward
                          ? cycle_events.forwarding?.forwarding_desc || "ALU 결과를 후속 명령어에 직접 포워딩하여 지연 없이 실행합니다."
                          : "현재 사이클에 해저드 없이 5개 스테이지가 순차적으로 실행되고 있습니다."}
                      </span>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <span className="text-2xl mb-2">💡</span>
                <span className="text-xs font-semibold text-slate-600">
                  컴파일 후 코드 라인을 클릭해 보세요!
                </span>
                <span className="text-[11px] text-slate-400 mt-1 max-w-xs">
                  C 언어 코드 한 줄이 컴퓨터 CPU에서 구체적으로 어떻게 어셈블리로 번역되고 실행되는지 쉽게 풀어서 설명해 드립니다.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default TutorArea;
