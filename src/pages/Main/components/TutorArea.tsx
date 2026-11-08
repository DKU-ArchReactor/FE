import React, { useMemo } from 'react';
import type { CycleHistoryItem, SimulationResult } from '@/type/simulation';
import type { CodeLineSelectInfo } from './Source/SourceViewer';
import { mapAssembly, type MappedAssemblyRow } from './translationCompile';
import { analyzeCLine, analyzeAsmInstruction, analyzeCrtInstruction } from './tutorAnalysis';

export interface TutorAreaProps {
  simulationData: SimulationResult | null;
  currentCycleData: CycleHistoryItem | null;
  loadingMessage?: string | null;
  selectedCodeLine?: CodeLineSelectInfo | null;
  onClearSelectedCodeLine?: () => void;

  // C ↔ 어셈블리 튜터 모드 Props
  translationSource?: string;
  translationAssembly?: string;
  mappedRows?: MappedAssemblyRow[];
  selectedTranslationLine?: number | null;
  selectedAsmIndex?: number | null;
  currentActiveAsmIndex?: number | null;
  executionLine?: number | null;
  isUserSelected?: boolean;
  onSelectTranslationLine?: (line: number | null) => void;
  activeTarget?: "c" | "asm";
}

const TutorArea: React.FC<TutorAreaProps> = ({
  simulationData,
  currentCycleData,
  loadingMessage,
  selectedCodeLine: _selectedCodeLine,
  onClearSelectedCodeLine: _onClearSelectedCodeLine,
  translationSource,
  translationAssembly,
  mappedRows: propMappedRows,
  selectedTranslationLine,
  selectedAsmIndex,
  currentActiveAsmIndex,
  executionLine: _executionLine,
  isUserSelected = false,
  onSelectTranslationLine: _onSelectTranslationLine,
  activeTarget = "c",
}) => {
  // 1. C 소스 코드 라인별 배열
  const cLines = useMemo(() => {
    return (translationSource || "").split(/\r?\n/);
  }, [translationSource]);

  // 2. 어셈블리 파싱 및 C 라인 매핑 결과 (시뮬레이션에서 주입된 mappedRows 우선 사용)
  const effectiveRows: MappedAssemblyRow[] = useMemo(() => {
    if (propMappedRows && propMappedRows.length > 0) return propMappedRows;
    if (!translationAssembly) return [];
    return mapAssembly(translationAssembly, cLines.length);
  }, [propMappedRows, translationAssembly, cLines.length]);

  // 선택된 어셈블리 행 정보 (CRT 부트스트랩 판별용)
  const selectedRow = useMemo(() => {
    if (selectedAsmIndex !== null && selectedAsmIndex !== undefined && selectedAsmIndex >= 0) {
      return effectiveRows[selectedAsmIndex] || null;
    }
    return null;
  }, [selectedAsmIndex, effectiveRows]);

  const isCrtSelected = Boolean(
    selectedRow && (selectedRow.sourceLine === null || selectedRow.isRuntime)
  );

  // 3. 선택된 C 라인에 매핑된 어셈블리 명령어 리스트 추출
  const mappedAsmForSelectedLine = useMemo(() => {
    if (!selectedTranslationLine || selectedTranslationLine <= 0) return [];
    return effectiveRows
      .map((row, originalIndex) => ({ ...row, asmIndex: originalIndex + 1 }))
      .filter((row) => row.sourceLine === selectedTranslationLine);
  }, [effectiveRows, selectedTranslationLine]);

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
      <div className="flex-1 bg-white dark:bg-[#1E1E1E] rounded-md shadow-2xs border border-[#E5E5E5] dark:border-[#333333] p-4 flex flex-col items-center justify-center text-center gap-2.5">
        <div className="w-7 h-7 border-2 border-[#005FB8] dark:border-[#007ACC] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-[#005FB8] dark:text-[#007ACC]">{loadingMessage}</span>
      </div>
    );
  }

  return (
    <section
      className="@container flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] shadow-sm select-none transition-colors duration-150"
      aria-label="AI 튜터 해설 패널"
    >
      {/* 튜터 상단 헤더 */}
      <header className="shrink-0 flex items-center justify-between border-b border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-3.5 py-1.5 min-w-0 border-l-2 border-l-purple-500">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] text-purple-500 font-bold">◆</span>
          <h3 className="text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wider whitespace-nowrap">
            ARCHREACTOR TUTOR
          </h3>
        </div>
        <span className="text-[10px] text-[var(--ar-text-muted)] font-mono truncate">
          {activeTarget === "asm" ? "ASM PIPELINE" : "INSTRUCTION"}
        </span>
      </header>

      {/* 튜터 메인 본문 영역 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5 space-y-3.5 select-text [scrollbar-gutter:stable]">
        {/* ========================================================= */}
        {/* 모드 0: CRT (C Runtime 부트스트랩) 코드가 선택되었을 때 */}
        {/* ========================================================= */}
        {activeTarget !== "asm" && isCrtSelected && selectedRow ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-slate-300 dark:border-[#3E3E42] bg-slate-50/70 dark:bg-[#252526]/60 p-3.5 flex flex-col gap-3 shadow-2xs">
              {/* 상단 뱃지 및 제목 */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-[#333333] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">🚀</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-[#F0F0F0] dark:bg-[#252526] text-[#8C959F] dark:text-[#858585]">
                      CRT
                    </span>
                    <strong className="text-xs font-bold text-slate-800 dark:text-[#CCCCCC]">
                      C Runtime 부트스트랩 (진입 초기화)
                    </strong>
                  </div>
                </div>
                {selectedRow.pc && (
                  <span className="text-[10px] font-mono text-slate-500 dark:text-[#858585] bg-white dark:bg-[#1E1E1E] px-2 py-0.5 rounded border border-slate-200 dark:border-[#333333]">
                    PC: {selectedRow.pc}
                  </span>
                )}
              </div>

              {/* 명령어 블록 */}
              <div className="font-mono text-xs px-3 py-2 rounded-lg bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#333333] text-slate-900 dark:text-[#D4D4D4] font-semibold flex items-center justify-between shadow-2xs">
                <span>{selectedRow.text}</span>
                <span className="text-[10px] text-slate-400 dark:text-[#858585] font-normal">
                  ASM L{(selectedAsmIndex ?? 0) + 1}
                </span>
              </div>

              {/* CRT 역할 및 설명 */}
              {(() => {
                const crtInfo = analyzeCrtInstruction(selectedRow.text, selectedRow.pc);
                return (
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-1.5 text-xs text-slate-800 dark:text-[#CCCCCC]">
                      <span className="text-amber-500 shrink-0">💡</span>
                      <div>
                        <strong className="text-slate-900 dark:text-white font-bold">{crtInfo.role}</strong>
                        <p className="text-[11px] text-slate-600 dark:text-[#858585] mt-0.5 leading-relaxed">
                          {crtInfo.summary}
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#333333] text-[11px] text-slate-600 dark:text-[#858585] leading-relaxed">
                      <p>{crtInfo.detail}</p>
                    </div>

                    {/* 하드웨어 아키텍처 동작 */}
                    <div className="p-2 rounded bg-slate-100/70 dark:bg-[#1E1E1E]/80 border border-slate-200/80 dark:border-[#333333] text-[10px] text-slate-500 dark:text-[#858585] flex items-start gap-1.5">
                      <span className="font-bold text-slate-700 dark:text-[#CCCCCC] shrink-0">하드웨어 동작:</span>
                      <span>{crtInfo.instructionDetail.hardwareDetail}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : activeTarget !== "asm" && selectedTranslationLine && cLineAnalysis ? (
          <div className="@[720px]:grid @[720px]:grid-cols-2 @[720px]:gap-3 flex flex-col gap-2.5">
            {/* 1. 선택한 C 언어 라인 및 구문 역할 해설 */}
            <div className="rounded-xl border border-blue-200 dark:border-[#007ACC]/40 bg-blue-50/40 dark:bg-[#007ACC]/10 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">📄</span>
                  <span className="text-[11px] font-mono font-bold text-blue-700 dark:text-[#388BFD] bg-blue-100/80 dark:bg-[#007ACC]/25 px-2 py-0.5 rounded border border-blue-200 dark:border-[#007ACC]/40 shadow-2xs">
                    C: L{selectedTranslationLine}
                  </span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${cLineAnalysis.badgeColor}`}>
                  {cLineAnalysis.type}
                </span>
              </div>

              {/* C 코드 블록 */}
              <div
                className="font-mono text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1E1E1E] border border-blue-200/80 dark:border-[#007ACC]/30 text-blue-950 dark:text-[#E6EDF3] font-semibold shadow-2xs whitespace-pre-wrap break-all"
                style={{ fontFamily: "'D2Coding', Consolas, 'Fira Code', monospace" }}
              >
                {selectedCLineText?.trim() || <span className="text-slate-400 dark:text-[#858585] italic">빈 줄</span>}
              </div>

              {/* C 구문 자연어 해설 */}
              <div className="space-y-1 mt-0.5">
                <div className="text-xs font-bold text-slate-800 dark:text-[#CCCCCC] flex items-center gap-1">
                  <span>💡</span>
                  <span>{cLineAnalysis.summary}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-[#858585] leading-relaxed pl-4">
                  {cLineAnalysis.detail}
                </p>
              </div>
            </div>

            {/* 2. 연관된 RISC-V 어셈블리 명령어 블록 & 세부 하드웨어 동작 해설 */}
            <div className="rounded-xl border border-slate-200 dark:border-[#333333] bg-slate-50/50 dark:bg-[#252526]/50 p-3 flex flex-col gap-2.5">
              <div className="flex flex-col gap-1 border-b border-slate-200/60 dark:border-[#333333] pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs">⚡</span>
                    <span className="text-[11px] font-bold text-slate-800 dark:text-[#CCCCCC]">
                      매핑된 ASM:
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-[#CCCCCC] bg-white dark:bg-[#1E1E1E] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#333333]">
                      {mappedAsmForSelectedLine.length > 0
                        ? mappedAsmForSelectedLine.map((r) => `L${r.asmIndex}`).join(", ")
                        : "없음"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-[#858585] font-mono">
                    ({mappedAsmForSelectedLine.length}개)
                  </span>
                </div>
                {/* RV32IM, GCC 아랫줄 배치 */}
                <div className="text-[10px] text-slate-400 dark:text-[#858585] font-mono pl-4">
                  RV32IM / GCC -O0
                </div>
              </div>

              {mappedAsmForSelectedLine.length === 0 ? (
                <div className="p-3 rounded-lg bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#333333] text-center text-xs text-slate-400 dark:text-[#858585]">
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
                        className={`rounded-lg bg-white dark:bg-[#1E1E1E] p-2.5 shadow-2xs transition-all flex flex-col gap-1.5 border ${
                          isRowSelectedFocus
                            ? "border-blue-500 dark:border-[#007ACC] ring-2 ring-blue-100/80 dark:ring-[#007ACC]/30 bg-blue-50/20 dark:bg-[#007ACC]/10"
                            : isRowExecuting
                            ? "border-emerald-500 dark:border-[#23D18B] ring-2 ring-emerald-100/80 dark:ring-[#23D18B]/30 bg-emerald-50/20 dark:bg-[#23D18B]/10"
                            : "border-slate-200/90 dark:border-[#333333] hover:border-slate-300 dark:hover:border-[#3E3E42]"
                        }`}
                      >
                        {/* 명령어 뱃지 & 라인 번호 & 포커스 상태 뱃지 */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`w-4 h-4 rounded-full font-mono text-[10px] font-bold flex items-center justify-center ${
                                isRowSelectedFocus
                                  ? "bg-blue-600 dark:bg-[#007ACC] text-white"
                                  : isRowExecuting
                                  ? "bg-emerald-600 dark:bg-[#23D18B] text-white"
                                  : "bg-slate-100 dark:bg-[#2D2D2D] text-slate-600 dark:text-[#858585]"
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span
                              className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                                isRowSelectedFocus
                                  ? "text-blue-800 dark:text-[#388BFD] bg-blue-50 dark:bg-[#007ACC]/20 border-blue-300 dark:border-[#007ACC]/40"
                                  : isRowExecuting
                                  ? "text-emerald-800 dark:text-[#7EE787] bg-emerald-50 dark:bg-[#23D18B]/20 border-emerald-300 dark:border-[#23D18B]/40"
                                  : "text-slate-800 dark:text-[#CCCCCC] bg-slate-50 dark:bg-[#252526] border-slate-200 dark:border-[#333333]"
                              }`}
                              style={{ fontFamily: "'D2Coding', Consolas, 'Fira Code', monospace" }}
                            >
                              {asmRow.text}
                            </span>
                            {/* 포커스 표시 뱃지: 선택된 라인이면 ● 선택됨 표시 */}
                            {isRowSelectedFocus && (
                              <span className="text-[10px] font-bold text-blue-700 dark:text-[#388BFD] bg-blue-100/90 dark:bg-[#007ACC]/30 px-1.5 py-0.2 rounded border border-blue-300 dark:border-[#007ACC]/50">
                                ● 선택됨
                              </span>
                            )}
                            {/* 동시에 또는 단독으로 실행 중이면 ▶ 실행 중 뱃지 함께 표시 */}
                            {isRowExecuting && (
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-[#7EE787] bg-emerald-100/90 dark:bg-[#23D18B]/30 px-1.5 py-0.2 rounded border border-emerald-300 dark:border-[#23D18B]/50 animate-pulse">
                                ▶ 실행 중
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-mono font-bold ${
                              isRowSelectedFocus
                                ? "text-blue-700 dark:text-[#388BFD]"
                                : isRowExecuting
                                ? "text-emerald-700 dark:text-[#7EE787]"
                                : "text-slate-400 dark:text-[#858585]"
                            }`}
                          >
                            ASM L{asmRow.asmIndex}
                          </span>
                        </div>

                        {/* 동작 요약 */}
                        <div className="text-[11px] font-bold text-slate-800 dark:text-[#CCCCCC] pl-5 flex items-center gap-1">
                          <span className="text-blue-600 dark:text-[#388BFD]">➔</span>
                          <span>{instDetail.action}</span>
                        </div>

                        {/* 상세 해설 */}
                        <p className="text-[11px] text-slate-600 dark:text-[#858585] leading-relaxed pl-5">
                          {instDetail.explanation}
                        </p>

                        {/* 하드웨어 아키텍처 관점 (스택, 레지스터, 파이프라인 단계) */}
                        <div className="ml-5 mt-0.5 p-1.5 rounded bg-slate-50 dark:bg-[#252526] border border-slate-100 dark:border-[#333333] text-[10px] text-slate-500 dark:text-[#858585] leading-normal flex items-start gap-1">
                          <span className="font-semibold text-slate-700 dark:text-[#CCCCCC] shrink-0">하드웨어 동작:</span>
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
            {activeTarget === "asm" ? (
              <div className="rounded-xl border border-slate-200 dark:border-[#333333] bg-slate-50/50 dark:bg-[#252526]/40 p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#3E3E42] flex items-center justify-center text-lg shadow-2xs shrink-0">
                  ⚙️
                </div>
                <div className="flex flex-col gap-0.5">
                  <strong className="text-xs text-[#1F2328] dark:text-[#CCCCCC] font-bold">
                    RISC-V 어셈블리 파이프라인 분석
                  </strong>
                  <p className="text-[11px] text-slate-600 dark:text-[#858585] leading-relaxed">
                    어셈블리 직접 작성 모드에서는 C 소스 코드 해설이 비활성화되며, 시뮬레이션 실행 시 사이클별 하드웨어 파이프라인 동작을 분석합니다.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-blue-100 dark:border-[#007ACC]/30 bg-blue-50/50 dark:bg-[#007ACC]/10 p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#1E1E1E] border border-blue-200 dark:border-[#007ACC]/30 flex items-center justify-center text-lg shadow-2xs shrink-0">
                  👆
                </div>
                <div className="flex flex-col gap-0.5">
                  <strong className="text-xs text-blue-950 dark:text-[#E6EDF3] font-bold">
                    라인별 실시간 컴파일 해설 지원
                  </strong>
                  <p className="text-[11px] text-slate-600 dark:text-[#858585] leading-relaxed">
                    상단의 <span className="font-semibold text-blue-700 dark:text-[#388BFD]">C 소스 코드</span>나{" "}
                    <span className="font-semibold text-blue-700 dark:text-[#388BFD]">어셈블리 명령어</span> 줄을 클릭하면,
                    해당 라인의 C 문법 역할과 대응되는 RISC-V 하드웨어 동작이 이곳에 단계별로 풀이됩니다.
                  </p>
                </div>
              </div>
            )}

            {/* 현재 시뮬레이션 클록 해설 (시뮬레이션 실행 중일 때) */}
            {currentCycleData ? (
              <div className="rounded-xl border border-slate-200 dark:border-[#333333] bg-white dark:bg-[#1E1E1E] p-3 flex flex-col gap-2.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#333333] pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-800 dark:text-[#CCCCCC]">
                      현재 사이클({currentCycleData.clock} Clock) 실행 분석
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-[#858585]">
                    Cycle {currentCycleData.clock} / {simulationData?.summary?.total_cycles || 0}
                  </span>
                </div>

                {/* 현재 파이프라인 인출(IF) 명령어 */}
                {(() => {
                  const ifBuf = currentCycleData.buffers?.IF || currentCycleData.if_stage;
                  const ifInst = ifBuf?.assembly || "bubble";
                  const isIdleStep0 = ifInst === "empty" && currentCycleData.clock === 0;

                  if (isIdleStep0) {
                    return (
                      <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-[#252526] border border-slate-100 dark:border-[#333333]">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-[#005FB8] dark:text-[#79C0FF] font-sans">
                            [Step 0] 시뮬레이션 준비 완료
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 dark:text-[#858585]">
                            Entry: {ifBuf?.pc || "0x00010000"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-[#858585] leading-relaxed">
                          아직 실행된 명령어가 없습니다. 상단의 [PLAY] 또는 [다음 스텝] 버튼을 누르면 첫 번째 명령어부터 실행됩니다.
                        </p>
                      </div>
                    );
                  }

                  const isCrtCycle = ifBuf?.source_line === null || (ifBuf && ifBuf.source_line === undefined && (ifInst.startsWith("auipc") || ifInst.startsWith("jalr")));
                  const crtAnalysis = isCrtCycle ? analyzeCrtInstruction(ifInst, ifBuf?.pc) : null;
                  const ifAnalysis = analyzeAsmInstruction(ifInst);
                  return (
                    <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-[#252526] border border-slate-100 dark:border-[#333333]">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-indigo-700 dark:text-[#79C0FF] font-sans">
                            [IF 인출 단계] {ifInst}
                          </span>
                          {isCrtCycle && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium bg-[#F0F0F0] dark:bg-[#252526] text-[#8C959F] dark:text-[#858585]">
                              CRT
                            </span>
                          )}
                        </div>
                        {ifBuf?.pc && (
                          <span className="font-mono text-[10px] text-slate-400 dark:text-[#858585]">
                            PC: {ifBuf.pc}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-[#858585] leading-relaxed">
                        {crtAnalysis ? `${crtAnalysis.role}: ${crtAnalysis.summary}` : ifAnalysis.explanation}
                      </p>
                    </div>
                  );
                })()}

                {/* 해저드 및 스톨 여부 카드 */}
                {(() => {
                  if (currentCycleData.clock === 0 && (currentCycleData.buffers?.IF?.assembly === 'empty' || currentCycleData.buffers?.IF?.status === 'empty')) {
                    return (
                      <div className="p-2.5 rounded-lg border text-[11px] leading-relaxed bg-slate-50 dark:bg-[#252526] border-slate-200 dark:border-[#333333] text-slate-700 dark:text-[#CCCCCC]">
                        대기 상태: 하드웨어 파이프라인 및 레지스터가 초기화되었습니다.
                      </div>
                    );
                  }

                  const { cycle_events } = currentCycleData;
                  const isStall = cycle_events.stall?.has_stall;
                  const isForward = cycle_events.forwarding?.has_forwarded;
                  const isFlush = cycle_events.control_hazard?.has_flush;

                  return (
                    <div
                      className={`p-2.5 rounded-lg border text-[11px] leading-relaxed ${
                        isStall
                          ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200"
                          : isFlush
                          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200"
                          : isForward
                          ? "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-900/60 text-cyan-900 dark:text-cyan-200"
                          : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200"
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
            ) : activeTarget === "asm" ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-[#F8F8F8] dark:bg-[#1E1E1E] rounded-md border border-dashed border-[#D0D7DE] dark:border-[#3E3E42]">
                <span className="text-2xl mb-2 opacity-60">⚙️</span>
                <span className="text-xs font-semibold text-[#1F2328] dark:text-[#CCCCCC]">
                  어셈블리 코드를 작성하고 [⚡ 시뮬레이션]을 실행하세요
                </span>
                <span className="text-[11px] text-[#57606A] dark:text-[#858585] mt-1 max-w-xs">
                  작성된 어셈블리 명령어의 파이프라인 스테이지 전진, 클록별 하드웨어 상태 변화를 확인할 수 있습니다.
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-[#F8F8F8] dark:bg-[#1E1E1E] rounded-md border border-dashed border-[#D0D7DE] dark:border-[#3E3E42]">
                <span className="text-2xl mb-2">💡</span>
                <span className="text-xs font-semibold text-[#1F2328] dark:text-[#CCCCCC]">
                  컴파일 후 코드 라인을 클릭해 보세요!
                </span>
                <span className="text-[11px] text-[#57606A] dark:text-[#858585] mt-1 max-w-xs">
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
