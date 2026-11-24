import React, { useMemo, useState, useCallback } from 'react';
import type { SimulationResult, CycleHistoryItem } from '@/type/simulation';
import type { MappedAssemblyRow } from '../utils/translationCompile';
import {
  analyzeAsmInstruction,
  analyzeCLine,
  instructionAt,
} from '../utils/tutorAnalysis';
import { tutorInstructionDetails } from '../utils/tutorInstructionDetails';
import { TutorText } from './TutorEvidence';
import './TutorSingleMode.css';

export interface TutorSingleModeProps {
  rows: MappedAssemblyRow[];
  source: string[];
  line?: number | null;
  selectedIndex?: number | null;
  simulation: SimulationResult;
  currentCycleData?: CycleHistoryItem | null;
  historyIndex?: number;
  hasC?: boolean;
  requestedView?: 'c' | 'asm';
  selectionKey?: number;
  isPlaying?: boolean;
  isUserSelected?: boolean;
  onSelect: (index: number) => void;
  onSelectLine?: (line: number | null, asmIndex?: number | null) => void;
  onPausePlayback?: () => void;
  onStepBack?: () => void;
  onStepForward?: () => void;
  onJumpToCycle?: (cycle: number) => void;
}

type AsmTabId = 'desc' | 'exec' | 'logic';
type CTabId = 'desc' | 'logic';

export const TutorSingleMode: React.FC<TutorSingleModeProps> = ({
  rows,
  source,
  line,
  selectedIndex,
  simulation,
  historyIndex,
  hasC = true,
  requestedView = 'asm',
  selectionKey = 0,
  isPlaying = false,
  isUserSelected = false,
  onSelect,
  onSelectLine,
  onPausePlayback,
  onStepBack,
  onStepForward,
  onJumpToCycle,
}) => {
  // 사용자의 명시적 C ↔ ASM 전환 상태 관리 (selectionKey가 바뀌면 상위 요청 뷰로 초기화)
  const [screen, setScreen] = useState<{ key: number; kind: 'c' | 'asm' }>({
    key: selectionKey,
    kind: requestedView,
  });

  const view = screen.key === selectionKey ? screen.kind : requestedView;

  // C 매핑 존재 여부 및 ASM 뷰 수직 이동 상태 계산
  const showCSection = hasC && line != null;
  const isAsmShifted = showCSection && view === 'asm';

  // 서류철 탭 상태 관리
  const [asmTab, setAsmTab] = useState<AsmTabId>('desc');
  const [cTab, setCTab] = useState<CTabId>('desc');

  // 현재 C 라인에 매핑된 ASM 명령어 그룹 (C가 없거나 CRT인 경우 전체 또는 CRT 그룹)
  const group = useMemo(() => {
    return rows
      .map((row, index) => ({ ...row, index }))
      .filter((row) => {
        if (!hasC) return true;
        if (line != null) return row.sourceLine === line;
        return row.sourceLine == null || row.isRuntime;
      });
  }, [rows, hasC, line]);

  // 현재 선택된 ASM 명령어의 그룹 내 위치 (0 <= position < group.length)
  const position = useMemo(() => {
    if (!group.length) return 0;
    const idx = group.findIndex((row) => row.index === selectedIndex);
    return Math.max(0, idx >= 0 ? idx : 0);
  }, [group, selectedIndex]);

  const currentRow = group[position] ?? null;
  const prevRow = position > 0 ? group[position - 1] : null;
  const nextRow = position < group.length - 1 ? group[position + 1] : null;
  const firstAsmRow = group[0] ?? null;
  const targetAsmRow = currentRow ?? firstAsmRow;

  // 활성 카드 식별 키 (포커싱 카드가 변경될 때마다 서류철 탭을 기본 'desc'로 자동 리셋)
  const activeCardKey = `${isUserSelected}:${line}:${currentRow?.index}:${view}`;
  const [prevCardKey, setPrevCardKey] = useState(activeCardKey);

  if (prevCardKey !== activeCardKey) {
    setPrevCardKey(activeCardKey);
    setAsmTab('desc');
    setCTab('desc');
  }

  // C 소스 라인 텍스트 및 분석
  const cText = line != null ? source[line - 1] ?? '' : '';
  const cAnalysis = line != null && cText ? analyzeCLine(cText, line) : null;
  const lineExplanation = simulation.tutor?.line_explanations?.find(
    (val) => val.source_line === line
  );

  // ASM 명령어 분석
  const item = currentRow ? instructionAt(simulation.tutor, currentRow.pc) : undefined;
  const instruction = currentRow ? analyzeAsmInstruction(currentRow.text, item?.explanation) : null;
  const details = item ? tutorInstructionDetails(item, simulation.tutor, historyIndex) : null;
  const observations = details ? [...details.observations].sort((a, b) => a[1].history_index - b[1].history_index) : [];
  const latest = observations.at(-1);

  // ASM 활성화 탭 계산 (데이터가 유효한 탭만 동적으로 노출)
  const availableAsmTabs = useMemo<{ id: AsmTabId; label: string }[]>(() => {
    const tabs: { id: AsmTabId; label: string }[] = [
      { id: 'desc', label: '설명' },
    ];
    if (observations.length > 0 || latest) {
      tabs.push({
        id: 'exec',
        label: '실제 실행',
      });
    }
    if (
      instruction?.hardwareDetail ||
      (item?.teaching?.walkthrough && item.teaching.walkthrough.length > 0) ||
      (item?.teaching?.operand_roles && item.teaching.operand_roles.length > 0)
    ) {
      tabs.push({ id: 'logic', label: '동작 원리' });
    }
    return tabs;
  }, [observations, latest, instruction, item]);

  // C 활성화 탭 계산
  const availableCTabs = useMemo<{ id: CTabId; label: string }[]>(() => {
    const tabs: { id: CTabId; label: string }[] = [{ id: 'desc', label: '코드 설명' }];
    if (lineExplanation?.detail || cAnalysis?.detail) {
      tabs.push({ id: 'logic', label: '컴파일 원리' });
    }
    return tabs;
  }, [lineExplanation, cAnalysis]);

  // 현재 유효한 탭 ID 결정 (유효하지 않은 탭이면 'desc'로 자동 안전 복귀)
  const activeAsmTabId = availableAsmTabs.some((t) => t.id === asmTab) ? asmTab : 'desc';
  const activeCTabId = availableCTabs.some((t) => t.id === cTab) ? cTab : 'desc';

  type AsmRow = (typeof group)[number];

  // ASM 명령어 간 수평 이동 핸들러
  const handleNavigateAsm = useCallback(
    (target: AsmRow | null | undefined, direction?: 'prev' | 'next') => {
      if (!target) return;

      if (isPlaying) {
        onPausePlayback?.();
      }

      if (isUserSelected) {
        // 선택 모드: 시뮬레이션 클록은 그대로 두고 코드 설명만 좌우 이동
        const currentCLine = hasC && line != null ? line : target.sourceLine;
        onSelect(target.index);
        onSelectLine?.(currentCLine, target.index);
      } else {
        // 실행 모드: 같은 C에 매핑된 이전/다음 ASM 사이클로 시뮬레이션 전진/후진!
        const isPrev = direction === 'prev' || target.index < (currentRow?.index ?? 0);
        if (isPrev) {
          if (onStepBack) {
            onStepBack();
          } else if (onJumpToCycle && historyIndex != null && historyIndex > 0) {
            onJumpToCycle(historyIndex);
          }
        } else {
          if (onStepForward) {
            onStepForward();
          } else if (onJumpToCycle && historyIndex != null) {
            onJumpToCycle(historyIndex + 2);
          }
        }
      }
    },
    [isPlaying, onPausePlayback, isUserSelected, hasC, line, onSelect, onSelectLine, currentRow, onStepBack, onStepForward, onJumpToCycle, historyIndex]
  );

  // C -> ASM 드릴다운 핸들러
  const handleDrillDownToAsm = useCallback(() => {
    if (isPlaying) {
      onPausePlayback?.();
    }
    const target = currentRow ?? firstAsmRow;
    if (isUserSelected && target && target.index !== selectedIndex) {
      handleNavigateAsm(target);
    }
    setScreen({ key: selectionKey, kind: 'asm' });
  }, [isPlaying, onPausePlayback, currentRow, firstAsmRow, isUserSelected, selectedIndex, handleNavigateAsm, selectionKey]);

  // ASM -> C 롤업 핸들러
  const handleRollUpToC = useCallback(() => {
    if (!hasC || line == null) return;
    if (isPlaying) {
      onPausePlayback?.();
    }
    setScreen({ key: selectionKey, kind: 'c' });
    if (isUserSelected) {
      onSelectLine?.(line, currentRow?.index ?? null);
    }
  }, [hasC, line, isPlaying, onPausePlayback, selectionKey, isUserSelected, onSelectLine, currentRow]);

  // 키보드 좌우(이전/다음 ASM), 상하(C 롤업/드릴다운) 탐색 핸들러
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (view === 'asm') {
        if (e.key === 'ArrowLeft' && prevRow) {
          e.preventDefault();
          handleNavigateAsm(prevRow, 'prev');
        } else if (e.key === 'ArrowRight' && nextRow) {
          e.preventDefault();
          handleNavigateAsm(nextRow, 'next');
        } else if (e.key === 'ArrowUp' && hasC && line != null) {
          e.preventDefault();
          handleRollUpToC();
        }
      } else if (view === 'c') {
        if (e.key === 'ArrowDown' && targetAsmRow) {
          e.preventDefault();
          handleDrillDownToAsm();
        }
      }
    },
    [view, prevRow, nextRow, hasC, line, handleNavigateAsm, handleRollUpToC, targetAsmRow, handleDrillDownToAsm]
  );

  return (
    <div
      className="tutor-single-container"
      data-view={view}
      data-has-c={showCSection}
      aria-label="싱글사이클 튜터 네비게이션"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="tutor-single-vertical-viewport">
        <div
          className="tutor-single-vertical-track"
          style={{
            transform: isAsmShifted ? 'translateY(-100%)' : 'translateY(0%)',
          }}
        >
          {/* ==================== 1층: C 코드 페이지 ==================== */}
          {showCSection && (
            <div className="tutor-single-page tutor-single-page-c">
              <div
                key={`c-${line}`}
                className="tutor-single-card"
                data-mode={isUserSelected ? 'selected' : 'executing'}
              >
                {/* 1번 스타일: 헤더 안에 태그, 서류철 탭, 카운터가 한 줄로 배치 */}
                <div className="tutor-single-card-header">
                  <div className="tutor-header-left">
                    <span className="tutor-single-tag">
                      {line != null ? `C : L${line}` : 'C 코드'}
                    </span>
                    <span className={`tutor-mode-badge ${isUserSelected ? 'selected' : 'executing'}`}>
                      <span className="tutor-mode-dot" />
                      <span>{isUserSelected ? '선택됨' : '실행 중'}</span>
                    </span>
                    {cAnalysis && (
                      <span className="tutor-single-badge">{cAnalysis.type}</span>
                    )}
                  </div>

                  {/* 헤더 중앙 서류철 탭 */}
                  <div className="tutor-header-tabs" role="tablist">
                    {availableCTabs.map((tab) => {
                      const isActive = activeCTabId === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          className={`tutor-folder-tab ${isActive ? 'active' : ''}`}
                          onClick={() => setCTab(tab.id as CTabId)}
                        >
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="tutor-header-right">
                    <span className="tutor-single-counter">
                      {group.length > 0 ? `연결된 ASM ${group.length}개` : '매핑된 ASM 없음'}
                    </span>
                  </div>
                </div>

                <div className="tutor-single-card-body">
                  {activeCTabId === 'desc' ? (
                    /* ---------------- C [코드 설명] 탭 ---------------- */
                    <>
                      <div className="tutor-single-code-box">
                        <code>{cText.trim() || (line != null ? '// 빈 라인 또는 주석' : 'C 위치 정보 없음')}</code>
                      </div>

                      <div className="tutor-single-meaning">
                        <span className="tutor-single-meaning-arrow" aria-hidden="true">→</span>
                        <p className="tutor-single-meaning-text">
                          <TutorText
                            text={
                              cAnalysis?.summary ??
                              (line != null
                                ? '선택한 C 라인의 문법 해설을 분석 중입니다.'
                                : '시작 코드·어셈블리 직접 작성 등으로 연결된 C 라인이 없습니다.')
                            }
                          />
                        </p>
                      </div>

                      {lineExplanation && (
                        <div className="text-xs text-[var(--ar-text-muted)] bg-[var(--ar-header-bg)] p-2.5 rounded-md border border-[var(--ar-border)]">
                          <strong className="block font-semibold text-[var(--ar-text-primary)] mb-1">
                            컴파일된 어셈블리 동작 요약
                          </strong>
                          <p>{lineExplanation.summary}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    /* ---------------- C [컴파일 원리] 탭 ---------------- */
                    <div className="space-y-3">
                      {cAnalysis?.detail && (
                        <div className="p-3 rounded-lg border border-[var(--ar-border)] bg-[var(--ar-header-bg)] border-l-3 border-l-[var(--ar-accent)]">
                          <strong className="block text-xs font-semibold text-[var(--ar-text-primary)] mb-1">
                            C 코드 컴파일 해석
                          </strong>
                          <p className="text-[13px] leading-relaxed text-[var(--ar-text-primary)]">
                            <TutorText text={cAnalysis.detail} />
                          </p>
                        </div>
                      )}

                      {lineExplanation?.detail && (
                        <div className="p-3 rounded-lg border border-[var(--ar-border)] bg-[var(--ar-panel-bg)]">
                          <strong className="block text-xs font-semibold text-[var(--ar-text-primary)] mb-1">
                            어셈블리 매핑 원리
                          </strong>
                          <p className="text-[13px] leading-relaxed text-[var(--ar-text-muted)]">
                            <TutorText text={lineExplanation.detail} />
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* C 페이지 하단: ASM 설명 보기 버튼 */}
              <div className="tutor-single-slot-bottom">
                <button
                  type="button"
                  className="tutor-single-btn-vertical down"
                  data-mode={isUserSelected ? 'selected' : 'executing'}
                  disabled={!targetAsmRow}
                  title={
                    targetAsmRow
                      ? `ASM: L${targetAsmRow.index + 1} 설명 보기 (${group.length}개 명령어)`
                      : '연결된 ASM 명령어가 없습니다'
                  }
                  onClick={handleDrillDownToAsm}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  <span>
                    {targetAsmRow
                      ? `ASM: L${targetAsmRow.index + 1} 설명 보기 (${group.length}개)`
                      : '연결된 ASM 없음'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ==================== 2층: ASM 코드 페이지 ==================== */}
          <div className="tutor-single-page tutor-single-page-asm">
            {/* ASM 페이지 상단: C 설명 보기 버튼 (C 매핑이 있을 때만 노출) */}
            {showCSection && (
              <div className="tutor-single-slot-top">
                <button
                  type="button"
                  className="tutor-single-btn-vertical up"
                  data-mode={isUserSelected ? 'selected' : 'executing'}
                  disabled={!hasC || line == null}
                  title={`C: L${line} 설명 보기`}
                  onClick={handleRollUpToC}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                  <span>{`C: L${line} 설명 보기`}</span>
                </button>
              </div>
            )}

            {/* ASM 카드 스테이지 (수평 캐러셀) */}
            <div className="tutor-single-stage">
              {group.length === 0 ? (
                <div className="tutor-single-card" data-mode="inactive">
                  <div className="tutor-single-card-body">
                    <p className="text-sm text-[var(--ar-text-muted)] p-4 text-center">
                      연결된 어셈블리 명령어가 없습니다.
                    </p>
                  </div>
                </div>
              ) : (
          /* ==================== ASM 수평 슬라이딩 캐러셀 트랙 ==================== */
          <div
            className="tutor-single-carousel-track"
            data-multi={group.length > 1}
            style={{
              transform:
                group.length > 1
                  ? `translateX(calc(var(--peek-margin) - ${position} * var(--slide-step)))`
                  : 'none',
              justifyContent: group.length <= 1 ? 'center' : undefined,
            }}
          >
            {group.map((row, idx) => {
              const isActive = idx === position;
              const rowItem = instructionAt(simulation.tutor, row.pc);
              const rowInstruction = analyzeAsmInstruction(row.text, rowItem?.explanation);

              const peekMode = isUserSelected ? 'inactive' : 'executing-peek';

              return (
                <div
                  key={`asm-slide-${row.index}`}
                  className={`tutor-single-card-slide ${isActive ? 'active' : 'inactive'}`}
                  role={isActive ? undefined : 'button'}
                  tabIndex={isActive ? undefined : 0}
                  aria-label={
                    isActive
                      ? undefined
                      : `어셈블리 L${row.index + 1} (${row.text}) 카드로 이동`
                  }
                  title={
                    isActive
                      ? undefined
                      : idx < position
                      ? isUserSelected
                        ? `이전 명령어 L${row.index + 1} (${row.text})로 이동`
                        : `이전 명령어 사이클로 후진 (L${row.index + 1})`
                      : isUserSelected
                      ? `다음 명령어 L${row.index + 1} (${row.text})로 이동`
                      : `다음 명령어 사이클로 전진 (L${row.index + 1})`
                  }
                  onClick={isActive ? undefined : () => handleNavigateAsm(row, idx < position ? 'prev' : 'next')}
                  onKeyDown={
                    isActive
                      ? undefined
                      : (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleNavigateAsm(row, idx < position ? 'prev' : 'next');
                          }
                        }
                  }
                >
                  <div
                    className="tutor-single-card"
                    data-mode={isActive ? (isUserSelected ? 'selected' : 'executing') : peekMode}
                  >
                    {/* 카드 헤더 */}
                    <div className="tutor-single-card-header">
                      <div className="tutor-header-left">
                        <span className="tutor-single-tag">{`ASM : L${row.index + 1}`}</span>
                        {isActive && (
                          <span className={`tutor-mode-badge ${isUserSelected ? 'selected' : 'executing'}`}>
                            <span className="tutor-mode-dot" />
                            <span>{isUserSelected ? '선택됨' : '실행 중'}</span>
                          </span>
                        )}
                        {rowInstruction && (
                          <span className="tutor-single-badge">{rowInstruction.action}</span>
                        )}
                      </div>

                      {/* 헤더 중앙 서류철 탭 */}
                      <div className="tutor-header-tabs" role="tablist">
                        {isActive ? (
                          availableAsmTabs.map((tab) => {
                            const isTabActive = activeAsmTabId === tab.id;
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={isTabActive}
                                className={`tutor-folder-tab ${isTabActive ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAsmTab(tab.id as AsmTabId);
                                }}
                              >
                                <span>{tab.label}</span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="tutor-folder-tab active">
                            <span>설명</span>
                          </div>
                        )}
                      </div>

                      {/* 헤더 우측 카운터 */}
                      <div className="tutor-header-right">
                        <span className="tutor-single-counter">{`${idx + 1} / ${group.length}`}</span>
                      </div>
                    </div>

                    {/* 카드 본문 */}
                    <div className="tutor-single-card-body">
                      {isActive ? (
                        activeAsmTabId === 'desc' ? (
                          <>
                            <div className="tutor-single-code-box">
                              <code>{row.text}</code>
                            </div>
                            <div className="tutor-single-meaning">
                              <span className="tutor-single-meaning-arrow" aria-hidden="true">→</span>
                              <p className="tutor-single-meaning-text">
                                <TutorText text={rowInstruction?.explanation ?? ''} />
                              </p>
                            </div>
                            {latest && (
                              <div className="tutor-single-observed">
                                <div className="tutor-single-observed-title">
                                  <span>실제 실행 요약</span>
                                  <span>Step {latest[1].step} · {latest[0]}</span>
                                </div>
                                <p className="tutor-single-observed-content">
                                  <TutorText text={latest[1].summary} />
                                </p>
                              </div>
                            )}
                          </>
                        ) : activeAsmTabId === 'exec' ? (
                          <div className="space-y-2.5">
                            <div className="text-xs text-[var(--ar-text-muted)] flex items-center justify-between pb-1 border-b border-[var(--ar-border)]">
                              <span>시뮬레이터에서 실행되며 발생한 하드웨어 상태 변화입니다.</span>
                              {latest && (
                                <span className="font-mono font-semibold text-[var(--ar-accent)]">
                                  최종 관찰: Step {latest[1].step}
                                </span>
                              )}
                            </div>
                            {observations.map(([stage, val]) => (
                              <div
                                key={stage}
                                className="p-2.5 rounded-lg border border-[var(--ar-border)] bg-[var(--ar-header-bg)] border-l-3 border-l-emerald-500"
                              >
                                <div className="flex items-center justify-between text-xs font-semibold text-[var(--ar-text-primary)] mb-1">
                                  <span>Step {val.step} · {stage}</span>
                                  {val.cycle != null && (
                                    <span className="font-mono text-[11px] text-[var(--ar-text-muted)]">
                                      CORE Clock {val.cycle}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[13px] leading-relaxed text-[var(--ar-text-primary)]">
                                  <TutorText text={val.summary} />
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {instruction?.hardwareDetail && (
                              <div className="p-3 rounded-lg border border-[var(--ar-border)] bg-[var(--ar-header-bg)] border-l-3 border-l-[var(--ar-accent)]">
                                <strong className="block text-xs font-semibold text-[var(--ar-text-primary)] mb-1">
                                  하드웨어 동작 원리
                                </strong>
                                <p className="text-[13px] leading-relaxed text-[var(--ar-text-primary)]">
                                  <TutorText text={instruction.hardwareDetail} />
                                </p>
                              </div>
                            )}
                            {item?.teaching?.walkthrough && item.teaching.walkthrough.length > 0 && (
                              <div className="space-y-1.5">
                                <strong className="block text-xs font-semibold text-[var(--ar-text-muted)]">
                                  단계별 처리 순서
                                </strong>
                                {item.teaching.walkthrough.map((step, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="p-2 rounded border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] text-xs"
                                  >
                                    <span className="font-bold text-[var(--ar-accent)] mr-1.5">
                                      {step.title}:
                                    </span>
                                    <span className="text-[var(--ar-text-primary)]">{step.text}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {item?.teaching?.operand_roles && item.teaching.operand_roles.length > 0 && (
                              <div className="space-y-1.5">
                                <strong className="block text-xs font-semibold text-[var(--ar-text-muted)]">
                                  피연산자 역할
                                </strong>
                                <div className="grid grid-cols-2 gap-2">
                                  {item.teaching.operand_roles.map((role, rIdx) => (
                                    <div
                                      key={rIdx}
                                      className="p-2 rounded border border-[var(--ar-border)] bg-[var(--ar-header-bg)] text-xs"
                                    >
                                      <span className="font-mono font-bold text-[var(--ar-accent)] mr-1.5">
                                        {role.operand}
                                      </span>
                                      <span className="text-[var(--ar-text-muted)]">{role.role}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      ) : (
                        <>
                          <div className="tutor-single-code-box">
                            <code>{row.text}</code>
                          </div>
                          <div className="tutor-single-meaning">
                            <span className="tutor-single-meaning-arrow" aria-hidden="true">→</span>
                            <p className="tutor-single-meaning-text">
                              <TutorText text={rowInstruction?.explanation ?? ''} />
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorSingleMode;
