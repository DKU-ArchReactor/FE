import React, { useMemo, useEffect, useRef, useState } from 'react';
import type { CycleHistoryItem, SimulationResult } from '@/type/simulation';
import { mapAssembly, type MappedAssemblyRow } from '../utils/translationCompile';
import { analyzeCLine, fetchTutor } from '../utils/tutorAnalysis';
import { TutorCycleEvidence } from './TutorEvidence';
import './TutorTypography.css';
import './TutorSingleMode.css';
import { tutorExecutionFocus } from '../utils/tutorFocus';
import { TutorDetailHost } from './TutorDetailPages';
import TutorPipelineLesson from './TutorPipelineLesson';
import TutorLineSplit from './TutorLineSplit';
import TutorSingleMode from './TutorSingleMode';
import TutorPerformanceSummary from './TutorPerformanceSummary';
import {
  TutorCrtCard,
  TutorCycleOverviewSection,
  TutorSelectedLineSection,
} from './TutorSections';

export interface TutorAreaProps {
  selectionKind?: 'c' | 'asm';
  selectionRevision?: number;
  isPlaying?: boolean;
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
  mode?: "single" | "pipeline";
  onClose?: () => void;
  onSelectLine?: (line: number | null, asmIndex?: number | null) => void;
  onPausePlayback?: () => void;
  onStepBack?: () => void;
  onStepForward?: () => void;
  onJumpToCycle?: (cycle: number) => void;
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
  isPlaying = false,
  selectionKind = 'asm',
  selectionRevision = 0,
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
  mode = "pipeline",
  onClose,
  onSelectLine,
  onPausePlayback,
  onStepBack,
  onStepForward,
  onJumpToCycle,
}) => {
  const isCompiled = Boolean(simulationData);
  const [pipelineHeader, setPipelineHeader] = useState<HTMLDivElement | null>(null);
  const isSingleMode = mode === "single" || simulationData?.simulator?.mode === "single";

  const cLines = useMemo(() => {
    return (translationSource || "").split(/\r?\n/);
  }, [translationSource]);

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
  const selectionScope = `${isUserSelected}:${manualAsmIndex}:${providedTranslationLine}:${activeTarget}:${currentActiveAsmIndex}`;
  const [stageSelection, setStageSelection] = useState<{ rows: MappedAssemblyRow[]; scope: string; index: number } | null>(null);
  const [wasPlaying, setWasPlaying] = useState(isPlaying);
  const [singleIntent, setSingleIntent] = useState({ run: simulationData, revision: selectionRevision, kind: 'asm' as 'c' | 'asm', version: 0 });
  if (singleIntent.run !== simulationData) setSingleIntent({ run: simulationData, revision: selectionRevision, kind: 'asm', version: singleIntent.version + 1 });
  else if (singleIntent.revision !== selectionRevision) setSingleIntent({ ...singleIntent, revision: selectionRevision, kind: selectionKind, version: singleIntent.version + 1 });
  else if (!wasPlaying && isPlaying) setSingleIntent({ ...singleIntent, kind: 'asm', version: singleIntent.version + 1 });
  if (wasPlaying !== isPlaying) { setWasPlaying(isPlaying); if (isPlaying) setStageSelection(null); }
  const stageIndex = stageSelection?.rows === effectiveRows && stageSelection.scope === selectionScope ? stageSelection.index : null;
  const isExecutionActive = Boolean(
    (historyIndex != null && historyIndex >= 0) || currentActiveAsmIndex != null
  );
  const shouldShowSingleCard = isUserSelected || isExecutionActive || stageIndex != null;
  const followsExecution = stageIndex == null && !isUserSelected && manualAsmIndex == null;
  const selectedAsmIndex = stageIndex ?? (followsExecution ? currentActiveAsmIndex : manualAsmIndex);
  const selectedTranslationLine = (followsExecution || stageIndex != null || selectionKind === 'asm' && activeTarget === 'asm') && selectedAsmIndex != null
    ? effectiveRows[selectedAsmIndex]?.sourceLine ?? providedTranslationLine : providedTranslationLine;

  const selectedRow = useMemo(() => {
    if (selectedAsmIndex !== null && selectedAsmIndex !== undefined && selectedAsmIndex >= 0) {
      return effectiveRows[selectedAsmIndex] || null;
    }
    return null;
  }, [selectedAsmIndex, effectiveRows]);

  const isCrtSelected = Boolean(
    selectedRow && (selectedRow.isRuntime || (selectedRow.sourceLine === null && providedTranslationLine == null))
  );
  const splitView = isCompiled && (activeTarget !== 'asm' || selectedRow != null);

  const mappedAsmForSelectedLine = useMemo(() => {
    if (!selectedTranslationLine || selectedTranslationLine <= 0) return [];
    return effectiveRows
      .map((row, originalIndex) => ({ ...row, asmIndex: originalIndex + 1 }))
      .filter((row) => row.sourceLine === selectedTranslationLine);
  }, [effectiveRows, selectedTranslationLine]);

  const explainedAsmRows = activeTarget === 'asm'
    ? selectedRow ? [{ ...selectedRow, asmIndex: (selectedAsmIndex ?? 0) + 1 }] : []
    : mappedAsmForSelectedLine;

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

  const asmExplanationItems = useMemo<Parameters<typeof fetchTutor>[0]>(() => {
    if (!isCompiled) return [];
    return effectiveRows.flatMap(row => [
      { kind: 'asm' as const, text: row.text },
      ...(row.sourceLine === null || row.isRuntime ? [{ kind: 'crt' as const, text: row.text, pc: row.pc }] : []),
    ]);
  }, [effectiveRows, isCompiled]);

  const cExplanationItems = useMemo<Parameters<typeof fetchTutor>[0]>(() => {
    if (!isCompiled) return [];
    return selectedCLineText !== null && selectedTranslationLine
      ? [{ kind: 'c', text: selectedCLineText, line: selectedTranslationLine }] : [];
  }, [selectedCLineText, selectedTranslationLine, isCompiled]);

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
    if (!body || (!followsExecution && !isUserSelected && activeTarget !== 'asm' && stageIndex == null)) return;
    if (selectedAsmIndex == null) {
      body.scrollTo({ top: 0 });
      return;
    }
    const selectedCard = body.querySelector<HTMLElement>(`[data-asm-index="${selectedAsmIndex}"]`);
    if (selectedCard) {
      const offset = selectedCard.getBoundingClientRect().top - body.getBoundingClientRect().top;
      body.scrollTo({ top: Math.max(0, body.scrollTop + offset - 12) });
    } else if (followsExecution) {
      body.scrollTo({ top: 0 });
    }
  }, [selectedAsmIndex, selectedTranslationLine, isUserSelected, activeTarget, loadingMessage, followsExecution, stageIndex]);

  if (loadingMessage) {
    return (
      <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] p-4 flex flex-col items-center justify-center text-center gap-2.5 transition-colors duration-150">
        <div className="w-7 h-7 border-2 border-[var(--ar-accent)] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-[var(--ar-accent)]">{loadingMessage}</span>
      </div>
    );
  }

  return (
    <TutorDetailHost scrollable={isSingleMode}><section
      className="ar-tutor @container flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] shadow-sm select-none transition-colors duration-150"
      aria-label="튜터 해설 패널"
    >
      <header className="relative h-8 shrink-0 flex items-center justify-between border-b border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-3.5 min-w-0 border-l-2 border-l-emerald-500">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="font-sans text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wide whitespace-nowrap">
            ARCHREACTOR TUTOR
          </h3>
        </div>
        {!isSingleMode && simulationData && <div ref={setPipelineHeader} className="tutor-pipeline-header-controls"/>}
        <div className="flex items-center gap-2 shrink-0">
          {isUserSelected && (
            <button
              type="button"
              className="tutor-return-exec-btn mr-0!"
              title="현재 실행 중인 위치로 돌아가기"
              onClick={() => onSelectLine?.(null, null)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>실행 위치로</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="튜터 모달 닫기"
              className="w-5 h-5 rounded flex items-center justify-center bg-black/5 text-[var(--ar-text-muted)] hover:text-[var(--ar-text-primary)] transition-colors cursor-pointer text-xs font-bold leading-none shrink-0"
            >
              ✕
            </button>
          )}
        </div>
      </header>
      {/* 튜터 메인 본문 영역 */}
      <div ref={tutorBodyRef} className={`min-h-0 flex-1 overflow-y-auto select-text [scrollbar-gutter:stable] ${isSingleMode ? 'p-0! overflow-hidden! flex flex-col' : splitView ? 'p-4 space-y-4 dev-tutor-line-body' : 'p-4 space-y-4'}`}>
        {explanationError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--ar-border)] p-3 text-xs leading-6 text-[var(--ar-text-primary)] m-3">
          <span>해설을 불러오지 못했습니다.</span>
          <button className="rounded border border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-3 py-1 font-medium focus-visible:outline-2 focus-visible:outline-[var(--ar-accent)]" onClick={() => setRetryVersion(x => x + 1)}>다시 시도</button>
        </div>}
        {simulationData && !simulationData.tutor && <p role="status" className="rounded-md border border-[var(--ar-border)] bg-[var(--ar-header-bg)] p-3 text-xs leading-6 text-[var(--ar-text-muted)] m-3">
          상세 실행 해설이 제공되지 않았습니다. 현재는 기본 명령어 설명을 표시합니다.
        </p>}
        {/* ========================================================= */}
        {/* 컴파일/어셈블 전: 대기 화면 표시 (유효성 검증 완료 전 튜터 비활성화) */}
        {/* ========================================================= */}
        {!isSingleMode && simulationData ? (
          <TutorPipelineLesson
            cycle={currentCycleData}
            simulation={simulationData}
            rows={effectiveRows}
            source={cLines}
            historyIndex={historyIndex}
            selectedIndex={selectedAsmIndex}
            sourceLine={selectedTranslationLine}
            selectionKind={selectionKind}
            selectionRevision={selectionRevision}
            isUserSelected={isUserSelected}
            headerTarget={pipelineHeader}
          />
        ) : isSingleMode && simulationData ? (
          shouldShowSingleCard ? (
            <TutorSingleMode
              rows={effectiveRows}
              source={cLines}
              line={isCrtSelected ? null : selectedTranslationLine}
              selectedIndex={selectedAsmIndex}
              simulation={simulationData}
              currentCycleData={currentCycleData}
              historyIndex={historyIndex}
              hasC={activeTarget !== 'asm'}
              requestedView={singleIntent.kind}
              selectionKey={singleIntent.version}
              isPlaying={isPlaying}
              isUserSelected={isUserSelected}
              onSelect={index => {
                setStageSelection({ rows: effectiveRows, scope: selectionScope, index });
              }}
              onSelectLine={onSelectLine}
              onPausePlayback={onPausePlayback}
              onStepBack={onStepBack}
              onStepForward={onStepForward}
              onJumpToCycle={onJumpToCycle}
            />
          ) : (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center select-none m-auto">
              <div className="w-12 h-12 rounded-xl bg-[var(--ar-mode-single)]/10 border border-[var(--ar-mode-single)]/25 flex items-center justify-center text-[var(--ar-mode-single)] mb-3 text-xl shadow-2xs">
                ▶
              </div>
              <strong className="text-xs font-semibold text-[var(--ar-text-primary)]">
                시뮬레이션 대기 중 (0 사이클)
              </strong>
              <p className="text-[11px] text-[var(--ar-text-muted)] mt-1.5 max-w-xs leading-relaxed">
                하단의 재생(▶) 또는 스텝(▷) 버튼을 누르면 첫 번째 명령어부터 단계별 실행 해설이 시작됩니다.
              </p>
              <div className="mt-3.5 inline-flex items-center gap-1.5 text-[10px] text-[var(--ar-text-muted)] bg-[var(--ar-header-bg)] px-3 py-1.5 rounded-md border border-[var(--ar-border)]">
                <span>💡</span>
                <span>코드 라인을 클릭하면 실행 전에도 명령어 해설을 미리 확인할 수 있습니다.</span>
              </div>
            </div>
          )
        ) : splitView && simulationData ? (
          <TutorLineSplit
            rows={effectiveRows}
            source={cLines}
            line={isCrtSelected ? null : selectedTranslationLine}
            selectedIndex={selectedAsmIndex}
            singleScreen={isSingleMode}
            requestedView={singleIntent.kind}
            selectionKey={singleIntent.version}
            simulation={simulationData}
            historyIndex={historyIndex}
            hasC={activeTarget !== 'asm'}
            onSelect={index => setStageSelection({ rows: effectiveRows, scope: selectionScope, index })}
          />
        ) : !isCompiled ? (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-[#F8F8F8] rounded-md border border-dashed border-[#D0D7DE] my-auto">
            <div className="w-10 h-10 rounded-lg bg-white border border-[#E5E5E5] flex items-center justify-center text-[#57606A] mb-3 text-lg shadow-2xs">
              💡
            </div>
            <strong className="text-xs font-semibold text-[#1F2328]">
              {activeTarget === "asm"
                ? "어셈블리 코드를 작성하고 [시뮬레이션]을 실행하세요"
                : "C 코드를 작성하고 [컴파일]을 실행하세요"}
            </strong>
            <span className="text-[11px] text-[#57606A] mt-1.5 max-w-xs leading-relaxed">
              {activeTarget === "asm"
                ? "컴파일 및 어셈블 검증이 완료된 코드에 한해 하드웨어 동작과 명령어 해설이 이곳에 제공됩니다."
                : "정상적으로 컴파일된 코드에 한해 라인별 문법 해설과 파이프라인 하드웨어 동작 풀이가 이곳에 제공됩니다."}
            </span>
          </div>
        ) : activeTarget !== "asm" && isCrtSelected && selectedRow ? (
          <TutorCrtCard
            selectedRow={selectedRow}
            selectedAsmIndex={selectedAsmIndex}
            totalRowsCount={effectiveRows.length}
            simulationData={simulationData}
            historyIndex={historyIndex}
          />
        ) : isCompiled && ((activeTarget === "asm" && (selectedRow || (selectedTranslationLine && selectedAsmLineText !== null))) || (activeTarget !== "asm" && selectedTranslationLine && cLineAnalysis)) ? (
          <TutorSelectedLineSection
            activeTarget={activeTarget}
            selectedRow={selectedRow}
            selectedTranslationLine={selectedTranslationLine}
            selectedAsmLineText={selectedAsmLineText}
            selectedCLineText={selectedCLineText}
            cLineAnalysis={cLineAnalysis}
            lineExplanation={lineExplanation}
            explainedAsmRows={explainedAsmRows}
            effectiveRowsCount={effectiveRows.length}
            selectedAsmIndex={selectedAsmIndex}
            currentActiveAsmIndex={currentActiveAsmIndex}
            isUserSelected={isUserSelected}
            followsExecution={followsExecution}
            simulationData={simulationData}
            historyIndex={historyIndex}
          />
        ) : (
          <TutorCycleOverviewSection
            activeTarget={activeTarget}
            isSingleMode={isSingleMode}
            currentCycleData={currentCycleData}
            simulationData={simulationData}
          />
        )}
        {!splitView && <TutorCycleEvidence bundle={simulationData?.tutor} historyIndex={historyIndex} />}
        {!splitView && <TutorPerformanceSummary bundle={simulationData?.tutor} historyIndex={historyIndex} />}
      </div>
    </section></TutorDetailHost>
  );
};

export default React.memo(TutorArea);
