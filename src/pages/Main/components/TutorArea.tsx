import React, { useMemo, useEffect, useRef, useState } from 'react';
import type { CycleHistoryItem, SimulationResult } from '@/type/simulation';
import { mapAssembly, type MappedAssemblyRow } from '../utils/translationCompile';
import { analyzeCLine, analyzeAsmInstruction, analyzeCrtInstruction, fetchTutor, instructionAt } from '../utils/tutorAnalysis';
import { TutorCycleEvidence, TutorInstructionEvidence, TutorText } from './TutorEvidence';
import './TutorTypography.css';
import { tutorExecutionFocus } from '../utils/tutorFocus';
import TutorPerformanceSummary from './TutorPerformanceSummary';
import InstructionLessonDialog from './InstructionLessonDialog';
import type {InstructionLessonContext} from './InstructionLesson';

export interface TutorAreaProps {
  onSelectAsm?: InstructionLessonContext['onSelectAsm'];
  onJumpToCycle?: InstructionLessonContext['onJumpToCycle'];
  simulationData: SimulationResult | null;
  currentCycleData: CycleHistoryItem | null;
  loadingMessage?: string | null;

  // C ↔ 어셈블리 튜터 모드 Props
  translationSource?: string;
  translationAssembly?: string;
  mappedRows?: MappedAssemblyRow[];
  selectedTranslationLine?: number | null;
  selectedAsmIndex?: number | null;
  currentActiveAsmIndex?: number | null;
  isUserSelected?: boolean;
  activeTarget?: "c" | "asm";
  onClose?: () => void;
}

// Static ASM requests and the selected C line have independent cancellation/retry lifetimes.
function useTutorExplanations(items: Parameters<typeof fetchTutor>[0], retryVersion: number) {
  const [, setExplanationVersion] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchTutor(items, controller.signal).then(changed => {
        if (controller.signal.aborted) return;
        setError(false);
        if (changed) setExplanationVersion(version => version + 1);
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [items, retryVersion]);
  return error;
}

const TutorArea: React.FC<TutorAreaProps> = ({
  onSelectAsm,
  onJumpToCycle,
  simulationData,
  currentCycleData,
  loadingMessage,
  translationSource,
  translationAssembly,
  mappedRows: propMappedRows,
  selectedTranslationLine: providedTranslationLine,
  selectedAsmIndex: manualAsmIndex,
  currentActiveAsmIndex: providedActiveAsmIndex,
  isUserSelected = false,
  activeTarget = "c",
  onClose,
}) => {
  const [lessonOpen, setLessonOpen] = useState(false);
  const isCompiled = Boolean(simulationData);

  // 1. C 소스 코드 라인별 배열
  const cLines = useMemo(() => {
    return (translationSource || "").split(/\r?\n/);
  }, [translationSource]);

  // 2. 어셈블리 파싱 및 C 라인 매핑 결과 (컴파일/어셈블 완료 시에만 활성화)
  const effectiveRows: MappedAssemblyRow[] = useMemo(() => {
    if (!isCompiled) return [];
    if (propMappedRows && propMappedRows.length > 0) return propMappedRows;
    if (!translationAssembly) return [];
    return mapAssembly(translationAssembly, cLines.length);
  }, [isCompiled, propMappedRows, translationAssembly, cLines.length]);

  const historyPositions = useMemo(() => {
    const positions = new Map<CycleHistoryItem, number>();
    simulationData?.history.forEach((step, index) => {
      if (!positions.has(step)) positions.set(step, index);
    });
    return positions;
  }, [simulationData?.history]);
  const historyIndex = currentCycleData ? historyPositions.get(currentCycleData) ?? -1 : undefined;
  const executionFocus = historyIndex != null && historyIndex >= 0
    ? tutorExecutionFocus(currentCycleData, effectiveRows, simulationData?.simulator.mode === 'single') : null;
  const currentActiveAsmIndex = executionFocus?.index ?? providedActiveAsmIndex;
  const followsExecution = !isUserSelected && manualAsmIndex == null;
  const selectedAsmIndex = followsExecution ? currentActiveAsmIndex : manualAsmIndex;
  const selectedTranslationLine = followsExecution && selectedAsmIndex != null
    ? effectiveRows[selectedAsmIndex]?.sourceLine ?? null : providedTranslationLine;

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

  const explainedAsmRows = activeTarget === 'asm'
    ? selectedRow ? [{...selectedRow, asmIndex: (selectedAsmIndex ?? 0) + 1}] : []
    : mappedAsmForSelectedLine;

  // 4. 선택된 C / ASM 라인 텍스트 및 분석
  const asmLines = useMemo(() => {
    return (translationAssembly || "").split(/\r?\n/);
  }, [translationAssembly]);

  const selectedAsmLineText = useMemo(() => {
    if (activeTarget !== "asm" || !selectedTranslationLine || selectedTranslationLine <= 0) return null;
    return asmLines[selectedTranslationLine - 1] ?? "";
  }, [activeTarget, asmLines, selectedTranslationLine]);

  const selectedCLineText = useMemo(() => {
    if (!selectedTranslationLine || selectedTranslationLine <= 0) return null;
    return cLines[selectedTranslationLine - 1] ?? "";
  }, [cLines, selectedTranslationLine]);

  const [retryVersion, setRetryVersion] = useState(0);
  const asmExplanationItems = useMemo<Parameters<typeof fetchTutor>[0]>(() => effectiveRows.flatMap(row => [
    {kind: 'asm' as const, text: row.text},
    ...(row.sourceLine === null || row.isRuntime ? [{kind: 'crt' as const, text: row.text, pc: row.pc}] : []),
  ]), [effectiveRows]);
  const cExplanationItems = useMemo<Parameters<typeof fetchTutor>[0]>(() =>
    isCompiled && selectedCLineText !== null && selectedTranslationLine
      ? [{kind: 'c', text: selectedCLineText, line: selectedTranslationLine}] : [],
  [isCompiled, selectedCLineText, selectedTranslationLine]);
  const asmExplanationError = useTutorExplanations(asmExplanationItems, retryVersion);
  const cExplanationError = useTutorExplanations(cExplanationItems, retryVersion);
  const explanationError = asmExplanationError || cExplanationError;

  const cLineAnalysis = isCompiled && selectedTranslationLine && selectedCLineText !== null
    ? analyzeCLine(selectedCLineText, selectedTranslationLine) : null;
  const lineExplanation = simulationData?.tutor?.line_explanations?.find(
    item => item.source_line === selectedTranslationLine,
  );
  const tutorBodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const body = tutorBodyRef.current;
    if (!body || (!followsExecution && !isUserSelected && activeTarget !== 'asm')) return;
    if (selectedAsmIndex == null) {
      body.scrollTo({top: 0});
      return;
    }
    const selectedCard = body.querySelector<HTMLElement>(`[data-asm-index="${selectedAsmIndex}"]`);
    if (selectedCard) {
      const offset = selectedCard.getBoundingClientRect().top - body.getBoundingClientRect().top;
      body.scrollTo({top: Math.max(0, body.scrollTop + offset - 12)});
    } else if (followsExecution) {
      body.scrollTo({top: 0});
    }
  }, [selectedAsmIndex, selectedTranslationLine, isUserSelected, activeTarget, loadingMessage, followsExecution]);

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
      className="ar-tutor @container flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] shadow-sm select-none transition-colors duration-150"
      aria-label="튜터 해설 패널"
    >
      {/* 튜터 상단 헤더 */}
      <header className="h-8 shrink-0 flex items-center justify-between border-b border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-3.5 min-w-0 border-l-2 border-l-emerald-500">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="font-sans text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wide whitespace-nowrap">
            ARCHREACTOR TUTOR
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[var(--ar-text-muted)] font-mono truncate">
            {followsExecution && executionFocus ? `${executionFocus.stage} · 실행 따라가기` : activeTarget === "asm" ? "ASM INSTRUCTION" : "INSTRUCTION"}
          </span>
          {simulationData?.tutor && <button type="button" onClick={() => setLessonOpen(true)} className="rounded border border-[var(--ar-border)] px-2 py-1 text-[11px] text-[var(--ar-text-primary)] hover:bg-[var(--ar-panel-bg)]">C·ASM 통합 보기</button>}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="튜터 모달 닫기"
              className="w-5 h-5 rounded flex items-center justify-center bg-black/5 dark:bg-white/10 text-[var(--ar-text-muted)] hover:text-[var(--ar-text-primary)] transition-colors cursor-pointer text-xs font-bold leading-none shrink-0"
            >
              ✕
            </button>
          )}
        </div>
      </header>
      {lessonOpen && <InstructionLessonDialog currentData={currentCycleData}
        prevData={historyIndex != null && historyIndex > 0 ? simulationData?.history[historyIndex - 1] : undefined}
        simulationData={simulationData} onClose={() => setLessonOpen(false)}
        context={{source: activeTarget === 'c' ? translationSource : undefined, rows: effectiveRows, selectedAsmIndex,
          selectedCLine: activeTarget === 'c' ? selectedTranslationLine : undefined, onSelectAsm, onJumpToCycle}}/>}
      {/* 튜터 메인 본문 영역 */}
      <div ref={tutorBodyRef} className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4 select-text [scrollbar-gutter:stable]">
        {explanationError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--ar-border)] p-3 text-xs leading-6 text-[var(--ar-text-primary)]">
          <span>해설을 불러오지 못했습니다.</span>
          <button className="rounded border border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-3 py-1 font-medium focus-visible:outline-2 focus-visible:outline-[var(--ar-accent)]" onClick={() => setRetryVersion(x => x + 1)}>다시 시도</button>
        </div>}
        {simulationData && !simulationData.tutor && <p role="status" className="rounded-md border border-[var(--ar-border)] bg-[var(--ar-header-bg)] p-3 text-xs leading-6 text-[var(--ar-text-muted)]">
          상세 실행 해설이 제공되지 않았습니다. 현재는 기본 명령어 설명을 표시합니다.
        </p>}
        {/* ========================================================= */}
        {/* 모드 0: CRT (C Runtime 부트스트랩) 코드가 선택되었을 때 */}
        {/* ========================================================= */}
        {isCompiled && activeTarget !== "asm" && isCrtSelected && selectedRow ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-slate-300 dark:border-[#3E3E42] bg-slate-50/70 dark:bg-[#252526]/60 p-3.5 flex flex-col gap-3 shadow-2xs">
              {/* 상단 뱃지 및 제목 */}
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200/80 dark:border-[#333333] pb-2.5">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-[#F0F0F0] dark:bg-[#252526] text-[#8C959F] dark:text-[#858585] whitespace-nowrap shrink-0">
                      소스 위치 미확인
                    </span>
                    <strong className="text-xs font-bold text-slate-800 dark:text-[#CCCCCC]">
                      {analyzeCrtInstruction(selectedRow.text, selectedRow.pc).title}
                    </strong>
                  </div>
                </div>
                {selectedRow.pc && (
                  <span className="text-[10px] font-mono text-slate-500 dark:text-[#858585] bg-white dark:bg-[#1E1E1E] px-2 py-0.5 rounded border border-slate-200 dark:border-[#333333] whitespace-nowrap shrink-0">
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

              <p className="text-[11px] text-[var(--ar-text-muted)]">전체 ASM {effectiveRows.length}개 중 소스 위치가 확인되지 않은 선택 명령어 1개를 설명합니다.</p>
              <p className="text-[13px] leading-6 text-[var(--ar-text-primary)]">
                <TutorText text={analyzeAsmInstruction(selectedRow.text, instructionAt(simulationData?.tutor, selectedRow.pc)?.explanation).explanation} />
              </p>
              <TutorInstructionEvidence item={instructionAt(simulationData?.tutor, selectedRow.pc)} bundle={simulationData?.tutor} historyIndex={historyIndex} focused />
              {/* CRT 역할 및 설명 */}
              {(() => {
                const crtInfo = analyzeCrtInstruction(selectedRow.text, selectedRow.pc);
                return (
                  <details className="border-t border-[var(--ar-border)] pt-2">
                    <summary className="cursor-pointer py-1 text-xs font-semibold text-[var(--ar-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--ar-accent)]">소스 위치와 실행 문맥</summary>
                    <div className="space-y-2.5 pt-2">
                    <div className="flex items-start gap-1.5 text-xs text-slate-800 dark:text-[#CCCCCC]">
                      <div>
                        <strong className="text-slate-900 dark:text-white font-bold">{crtInfo.role}</strong>
                        <p className="text-[11px] text-slate-600 dark:text-[#858585] mt-0.5 leading-relaxed">
                          {crtInfo.summary}
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#333333] text-[13px] text-[var(--ar-text-muted)] leading-7">
                      <p>{crtInfo.detail}</p>
                    </div>

                    {/* 하드웨어 아키텍처 동작 */}
                    <div className="p-2 rounded bg-slate-100/70 dark:bg-[#1E1E1E]/80 border border-slate-200/80 dark:border-[#333333] text-[10px] text-slate-500 dark:text-[#858585] flex items-start gap-1.5">
                      <span className="font-bold text-slate-700 dark:text-[#CCCCCC] shrink-0">하드웨어 동작:</span>
                      <span>{crtInfo.instructionDetail.hardwareDetail}</span>
                    </div>
                    </div>
                  </details>
                );
              })()}
            </div>
          </div>
        ) : isCompiled && ((activeTarget === "asm" && (selectedRow || (selectedTranslationLine && selectedAsmLineText !== null))) || (activeTarget !== "asm" && selectedTranslationLine && cLineAnalysis)) ? (
          <div className="flex flex-col gap-3">
            {/* 1-A. ASM 직접 작성 모드에서 비명령어 줄(라벨/지시어/주석/빈 줄)을 선택했을 때의 상단 카드 */}
            {activeTarget === "asm" && !selectedRow && selectedTranslationLine && selectedAsmLineText !== null && (() => {
              const trimmed = selectedAsmLineText.trim();
              const noComment = trimmed.replace(/#.*/, "").trim();
              const isCommentOnly = trimmed.startsWith("#");
              const isDirective = noComment.startsWith(".");
              const isLabel = /^[.$\w]+:$/.test(noComment);
              const badgeText = !trimmed
                ? "빈 줄"
                : isCommentOnly
                ? "주석"
                : isDirective
                ? "어셈블러 지시어"
                : isLabel
                ? "심볼 라벨"
                : "어셈블리 구문";
              const descText = !trimmed
                ? "실행 명령어가 없는 공백 줄입니다."
                : isCommentOnly
                ? "코드 설명을 위한 주석이며 CPU가 실행하는 기계어로 변환되지 않습니다."
                : isDirective
                ? "어셈블러에게 섹션 배치나 심볼 공개 범위(.globl 등)를 지시하는 메타 명령어입니다."
                : isLabel
                ? "분기(branch)나 점프(jal/call) 명령어가 이동할 목표 코드 주소를 가리키는 이름표입니다."
                : "선택한 어셈블리 줄입니다.";

              return (
                <div className="rounded-md border border-[var(--ar-border)] border-l-2 border-l-[var(--ar-accent)] bg-[var(--ar-panel-bg)] p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-[var(--ar-accent)]">
                      ASM: L{selectedTranslationLine}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium shrink-0 bg-slate-100 dark:bg-[#252526] text-slate-700 dark:text-[#CCCCCC] border border-slate-200 dark:border-[#333333]">
                      {badgeText}
                    </span>
                  </div>
                  <div className="font-mono text-[13px] leading-6 px-3 py-2 rounded-md bg-[var(--ar-header-bg)] border border-[var(--ar-border)] text-[var(--ar-text-primary)] whitespace-pre-wrap break-all">
                    {trimmed || <span className="text-slate-400 dark:text-[#858585] italic">빈 줄</span>}
                  </div>
                  <p className="text-[13px] text-[var(--ar-text-muted)] leading-7">
                    {descText}
                  </p>
                </div>
              );
            })()}

            {/* 1. 선택한 C 언어 라인 및 구문 역할 해설 (상단 헤더형 카드) */}
            {activeTarget !== 'asm' && cLineAnalysis && <div className="rounded-md border border-[var(--ar-border)] border-l-2 border-l-[var(--ar-accent)] bg-[var(--ar-panel-bg)] p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-mono font-semibold text-[var(--ar-accent)]">
                    C: L{selectedTranslationLine}
                  </span>
                  <div className="text-sm leading-6 font-semibold text-[var(--ar-text-primary)] flex items-center gap-2">
                    <span>{cLineAnalysis.summary}</span>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium shrink-0 ${cLineAnalysis.badgeColor}`}>
                  {cLineAnalysis.type}
                </span>
              </div>

              {/* C 코드 블록 */}
              <div
                className="font-mono text-[13px] leading-6 px-3 py-2 rounded-md bg-[var(--ar-header-bg)] border border-[var(--ar-border)] text-[var(--ar-text-primary)] whitespace-pre-wrap break-all"
              >
                {selectedCLineText?.trim() || <span className="text-slate-400 dark:text-[#858585] italic">빈 줄</span>}
              </div>

              {/* C 구문 자연어 해설 */}
              <p className="text-[13px] text-[var(--ar-text-muted)] leading-7">
                {cLineAnalysis.detail}
              </p>
            </div>}

            {activeTarget !== 'asm' && lineExplanation && <div className="border-l-2 border-[var(--ar-border)] pl-3 text-[13px] leading-7 space-y-1">
              <p className="font-semibold text-[var(--ar-text-primary)]">{lineExplanation.summary}</p>
              <p className="text-[var(--ar-text-muted)]">{lineExplanation.detail}</p>
            </div>}

            {/* 2. 연관된 RISC-V 어셈블리 명령어 블록 & 세부 하드웨어 동작 해설 (하단 전폭 카드) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-[#333333] pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-800 dark:text-[#CCCCCC]">
                    {activeTarget === 'asm' ? '선택한 ASM:' : '매핑된 ASM:'}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-[#CCCCCC] bg-white dark:bg-[#1E1E1E] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#333333]">
                    {explainedAsmRows.length > 0
                      ? explainedAsmRows.map((r) => `L${r.asmIndex}`).join(", ")
                      : "없음"}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-[#858585] font-mono">
                    ({explainedAsmRows.length}개 명령어)
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-[#858585] font-mono">
                  RV32IM / 컴파일 결과 기준
                </div>
              </div>

              <p className="text-[11px] text-[var(--ar-text-muted)]">
                전체 ASM {effectiveRows.length}개 중 {activeTarget === 'asm'
                  ? `선택한 명령어 ${explainedAsmRows.length}개를 설명합니다.`
                  : `C ${selectedTranslationLine}줄에 연결된 ${explainedAsmRows.length}개를 모두 설명합니다.`}
                {selectedAsmIndex != null && explainedAsmRows.some(row => row.asmIndex === selectedAsmIndex + 1)
                  && ` 선택한 명령어는 이 그룹의 ${explainedAsmRows.findIndex(row => row.asmIndex === selectedAsmIndex + 1) + 1}번째입니다.`}
              </p>

              {explainedAsmRows.length === 0 ? (
                <div className="p-3 rounded-lg bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#333333] text-center text-xs text-slate-400 dark:text-[#858585]">
                  이 줄에 연결된 명령어가 없습니다. 주석·공백·컴파일러 줄 정보의 배치 또는 누락 때문일 수 있습니다.
                </div>
              ) : (
                <div className="flex flex-col gap-6 rounded-lg bg-[var(--ar-canvas-bg)] p-2">
                  {explainedAsmRows.map((asmRow, idx) => {
                    const instDetail = analyzeAsmInstruction(asmRow.text, instructionAt(simulationData?.tutor, asmRow.pc)?.explanation);
                    const rowZeroIndex = asmRow.asmIndex - 1;

                    // 현재 실제 CPU 실행 중인 행인가?
                    const isRowExecuting = currentActiveAsmIndex === rowZeroIndex;
                    // 사용자가 수동으로 콕 집어 선택한 행인가? (사용자가 선택한 모드일 때만 적용)
                    const isRowSelectedFocus =
                      (isUserSelected || activeTarget === 'asm' || followsExecution) &&
                      (selectedAsmIndex !== null && selectedAsmIndex !== undefined
                        ? selectedAsmIndex === rowZeroIndex
                        : idx === 0);

                    return (
                      <article
                        key={`${asmRow.asmIndex}-${idx}`}
                        data-asm-index={rowZeroIndex}
                        aria-label={`ASM L${asmRow.asmIndex} ${asmRow.text}`}
                        className={`rounded-lg bg-[var(--ar-panel-bg)] overflow-clip transition-colors flex flex-col gap-2 border border-l-4 shadow-sm ${
                          isRowSelectedFocus
                            ? "border-[var(--ar-accent)]"
                            : isRowExecuting
                            ? "border-emerald-500"
                            : "border-slate-300 dark:border-[#454858]"
                        }`}
                      >
                        {/* 명령어 뱃지 & 라인 번호 & 포커스 상태 뱃지 */}
                        <header className="sticky -top-4 z-10 border-b border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-4 py-2">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span
                              className={`shrink-0 rounded px-2 py-1 font-mono text-xs font-semibold ${
                                isRowSelectedFocus
                                  ? "bg-[var(--ar-accent)] text-white"
                                  : isRowExecuting
                                  ? "bg-emerald-600 dark:bg-[#23D18B] text-white"
                                  : "bg-slate-100 dark:bg-[#2D2D2D] text-slate-600 dark:text-[#858585]"
                              }`}
                            >
                              ASM L{asmRow.asmIndex}
                            </span>
                            <h4
                              className="font-mono text-sm leading-6 font-medium text-[var(--ar-text-primary)] break-all"
                            >
                              {asmRow.text}
                            </h4>
                            <span className="text-[11px] text-[var(--ar-text-muted)]">{instDetail.action}</span>
                            {/* 선택한 라인의 상태 표시 */}
                            {isRowSelectedFocus && (
                              <span className="text-[10px] font-bold text-[var(--ar-accent)] px-1.5 py-0.5 rounded border border-current">
                                {followsExecution ? '현재 설명' : '선택됨'}
                              </span>
                            )}
                            {/* 현재 실행 중인 라인의 상태 표시 */}
                            {isRowExecuting && (
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-[#7EE787] bg-emerald-100/90 dark:bg-[#23D18B]/30 px-1.5 py-0.2 rounded border border-emerald-300 dark:border-[#23D18B]/50 animate-pulse">
                                실행 중
                              </span>
                            )}
                          </div>
                        </header>

                        <div className="space-y-3 px-4 pb-3">

                        {/* 상세 해설 */}
                        <p className="text-[13px] text-[var(--ar-text-primary)] leading-6">
                          <TutorText text={instDetail.explanation} />
                        </p>
                        {instDetail.operation && instDetail.operation !== instDetail.explanation && <p className="rounded-md border border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-3 py-2 font-mono text-xs leading-6 break-all text-[var(--ar-text-primary)]">
                          {instDetail.operation}
                        </p>}
                        <TutorInstructionEvidence item={instructionAt(simulationData?.tutor, asmRow.pc)} bundle={simulationData?.tutor} historyIndex={historyIndex} focused={isRowSelectedFocus} />

                        {/* 하드웨어 아키텍처 관점 (스택, 레지스터, 파이프라인 단계) */}
                        {instDetail.hardwareDetail && <details className="border-t border-[var(--ar-border)] pt-2 text-[13px] leading-7 text-[var(--ar-text-muted)]">
                          <summary className="cursor-pointer py-1 text-xs font-semibold text-[var(--ar-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--ar-accent)]">명령어 원리와 주의사항</summary>
                          <ul className="list-disc space-y-2 pl-5 pt-2 marker:text-[var(--ar-text-muted)]">
                            {instDetail.hardwareDetail.split(/(?<=[.!?])\s+/).map((sentence, sentenceIndex) => <li key={sentenceIndex} className="pl-1"><TutorText text={sentence} /></li>)}
                          </ul>
                        </details>}
                        </div>
                      </article>
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
                <div className="flex flex-col gap-0.5">
                  <strong className="text-xs text-[#1F2328] dark:text-[#CCCCCC] font-bold">
                    RISC-V 어셈블리 실행 분석
                  </strong>
                  <p className="text-[13px] text-[var(--ar-text-muted)] leading-7">
                    명령어 줄을 선택하면 연산과 레지스터 역할을 설명합니다. 실행하면 선택한 single 또는 pipeline 모드의 클록별 상태 변화를 확인할 수 있습니다.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-blue-100 dark:border-[#007ACC]/30 bg-blue-50/50 dark:bg-[#007ACC]/10 p-3.5 flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <strong className="text-xs text-blue-950 dark:text-[#E6EDF3] font-bold">
                    라인별 실시간 컴파일 해설 지원
                  </strong>
                  <p className="text-[13px] text-[var(--ar-text-muted)] leading-7">
                    상단의 <span className="font-semibold text-[var(--ar-accent)]">C 소스 코드</span>나{" "}
                    <span className="font-semibold text-[var(--ar-accent)]">어셈블리 명령어</span> 줄을 클릭하면,
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
                  const ifBuf = currentCycleData.stage_activity?.IF || currentCycleData.buffers?.IF || currentCycleData.if_stage;
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
                        <p className="text-[13px] text-[var(--ar-text-muted)] leading-7">
                          아직 실행된 명령어가 없습니다. 상단의 [PLAY] 또는 [다음 스텝] 버튼을 누르면 첫 번째 명령어부터 실행됩니다.
                        </p>
                      </div>
                    );
                  }

                  const context = instructionAt(simulationData?.tutor, ifBuf?.pc);
                  const isCrtCycle = context?.mapping_status === 'unmapped';
                  const crtAnalysis = isCrtCycle ? analyzeCrtInstruction(ifInst, ifBuf?.pc) : null;
                  const ifAnalysis = analyzeAsmInstruction(ifInst, context?.explanation);
                  return (
                    <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-[#252526] border border-slate-100 dark:border-[#333333]">
                      <div className="flex items-center justify-between flex-wrap gap-1.5 text-[11px]">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="font-bold text-indigo-700 dark:text-[#79C0FF] font-sans">
                            [IF 인출 단계] {ifInst}
                          </span>
                          {isCrtCycle && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium bg-[#F0F0F0] dark:bg-[#252526] text-[#8C959F] dark:text-[#858585] whitespace-nowrap shrink-0">
                              소스 위치 미확인
                            </span>
                          )}
                        </div>
                        {ifBuf?.pc && (
                          <span className="font-mono text-[10px] text-slate-400 dark:text-[#858585] whitespace-nowrap shrink-0">
                            PC: {ifBuf.pc}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[var(--ar-text-muted)] leading-7">
                        {crtAnalysis ? `${crtAnalysis.role}: ${crtAnalysis.summary}` : ifAnalysis.explanation}
                      </p>
                    </div>
                  );
                })()}

              </div>
            ) : activeTarget === "asm" ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-[#F8F8F8] dark:bg-[#1E1E1E] rounded-md border border-dashed border-[#D0D7DE] dark:border-[#3E3E42]">
                <span className="text-xs font-semibold text-[#1F2328] dark:text-[#CCCCCC]">
                  어셈블리 코드를 작성하고 [시뮬레이션]을 실행하세요
                </span>
                <span className="text-[11px] text-[#57606A] dark:text-[#858585] mt-1 max-w-xs">
                  작성한 명령어의 의미와 실행 모드에 따른 클록별 하드웨어 상태 변화를 확인할 수 있습니다.
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-[#F8F8F8] dark:bg-[#1E1E1E] rounded-md border border-dashed border-[#D0D7DE] dark:border-[#3E3E42]">
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
        <TutorCycleEvidence bundle={simulationData?.tutor} historyIndex={historyIndex} />
        <TutorPerformanceSummary bundle={simulationData?.tutor} historyIndex={historyIndex} />
      </div>
    </section>
  );
};

export default TutorArea;
