import React, { useMemo, useEffect, useState } from 'react';
import type { CycleHistoryItem, SimulationResult } from '@/type/simulation';
import { mapAssembly, type MappedAssemblyRow } from '../utils/translationCompile';
import { analyzeCLine, fetchTutor } from '../utils/tutorAnalysis';
import TutorPages from './TutorPages';
import './TutorTypography.css';
import { tutorExecutionFocus } from '../utils/tutorFocus';

export interface TutorAreaProps {
  onSelectAsm?: (line: number | null, index: number) => void;
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

  const group = activeTarget === 'c' ? effectiveRows.map((row, index) => ({row, index})).filter(value => value.row.sourceLine === selectedTranslationLine) : [];
  const selectedIndex = selectedAsmIndex != null && selectedAsmIndex >= 0 ? selectedAsmIndex : group[0]?.index;
  const selectedRow = selectedIndex != null ? effectiveRows[selectedIndex] : undefined;
  const selectedCLineText = activeTarget === 'c' && selectedTranslationLine ? cLines[selectedTranslationLine - 1] ?? '' : null;
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

  const cLineAnalysis = selectedCLineText != null && selectedTranslationLine ? analyzeCLine(selectedCLineText, selectedTranslationLine) : null;
  return <section className="ar-tutor @container flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] text-[var(--ar-text-primary)]" aria-label="튜터 해설 패널">
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-3 py-2">
      <h3 className="text-[11px] font-semibold">ARCHREACTOR TUTOR</h3>
      <span className="text-[10px] text-[var(--ar-text-muted)]">{followsExecution && executionFocus ? `${executionFocus.stage} · 실행 따라가기` : '선택한 줄 설명'}</span>
      {onClose && <button type="button" onClick={onClose} title="튜터 모달 닫기" aria-label="튜터 닫기" className="text-xs">닫기</button>}
    </header>
    {explanationError && <div role="alert" className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--ar-border)] p-2 text-xs"><span>해설을 불러오지 못했습니다.</span><button onClick={() => setRetryVersion(value => value + 1)}>다시 시도</button></div>}
    {loadingMessage ? <p className="p-4 text-sm" role="status">{loadingMessage}</p>
      : simulationData && selectedRow && selectedIndex != null ? <TutorPages key={`${selectedRow.pc}-${activeTarget}`} row={selectedRow} index={selectedIndex} rows={effectiveRows}
        source={activeTarget === 'c' ? translationSource : undefined} simulation={simulationData} historyIndex={historyIndex} current={currentCycleData} onSelect={onSelectAsm}/>
      : <div className="min-h-0 flex-1 overflow-auto p-4 text-sm leading-7"><h4 className="font-semibold">{cLineAnalysis?.type ?? '코드 한 줄을 선택하세요'}</h4><p>{cLineAnalysis?.summary ?? '컴파일 후 C 또는 어셈블리 줄을 선택하면 한 명령어씩 설명합니다.'}</p>{cLineAnalysis && <p className="mt-3 text-xs text-[var(--ar-text-muted)]">이 줄에 연결된 실행 명령어가 없습니다. 주석·선언·컴파일러의 줄 정보에 따라 매핑되지 않을 수 있습니다.</p>}</div>}
  </section>;
};
export default TutorArea;
