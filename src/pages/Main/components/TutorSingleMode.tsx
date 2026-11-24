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
}) => {
  // 사용자의 명시적 C ↔ ASM 전환 상태 관리 (selectionKey가 바뀌면 상위 요청 뷰로 초기화)
  const [screen, setScreen] = useState<{ key: number; kind: 'c' | 'asm' }>({
    key: selectionKey,
    kind: requestedView,
  });

  const view = screen.key === selectionKey ? screen.kind : requestedView;

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

  // 현재 선택된 ASM 명령어의 그룹 내 위치
  const position = useMemo(() => {
    if (!group.length) return 0;
    const idx = group.findIndex((row) => row.index === selectedIndex);
    return Math.max(0, idx >= 0 ? idx : 0);
  }, [group, selectedIndex]);

  const currentRow = group[position] ?? null;
  const prevRow = position > 0 ? group[position - 1] : null;
  const nextRow = position < group.length - 1 ? group[position + 1] : null;
  const firstAsmRow = group[0] ?? null;

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
  const availableAsmTabs = useMemo<{ id: AsmTabId; label: string; badge?: string }[]>(() => {
    const tabs: { id: AsmTabId; label: string; badge?: string }[] = [
      { id: 'desc', label: '설명' },
    ];
    if (observations.length > 0 || latest) {
      tabs.push({
        id: 'exec',
        label: '실제 실행',
        badge: latest ? `Step ${latest[1].step}` : undefined,
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

  // ASM 명령어 간 수평 이동 핸들러 (현재 C 라인 범위 안에서만 이동)
  const handleNavigateAsm = useCallback(
    (target: AsmRow | null | undefined) => {
      if (!target) return;

      // 1) 실행 중이면 일시정지 후 수동 선택 모드로 전환
      if (isPlaying) {
        onPausePlayback?.();
      }

      // 2) 튜터 내부 및 외부 에디터 선택 상태 동기화 (현재 C 라인 범위 엄격 유지)
      const currentCLine = hasC && line != null ? line : target.sourceLine;
      onSelect(target.index);
      onSelectLine?.(currentCLine, target.index);
    },
    [isPlaying, onPausePlayback, onSelect, onSelectLine, hasC, line]
  );

  // C -> ASM 드릴다운 핸들러
  const handleDrillDownToAsm = useCallback(() => {
    if (isPlaying) {
      onPausePlayback?.();
    }
    if (firstAsmRow) {
      handleNavigateAsm(firstAsmRow);
    }
    setScreen({ key: selectionKey, kind: 'asm' });
  }, [isPlaying, onPausePlayback, firstAsmRow, handleNavigateAsm, selectionKey]);

  // ASM -> C 롤업 핸들러
  const handleRollUpToC = useCallback(() => {
    if (!hasC || line == null) return;
    if (isPlaying) {
      onPausePlayback?.();
    }
    setScreen({ key: selectionKey, kind: 'c' });
    onSelectLine?.(line, currentRow?.index ?? null);
  }, [hasC, line, isPlaying, onPausePlayback, selectionKey, onSelectLine, currentRow]);

  return (
    <div className="tutor-single-container" data-view={view} aria-label="싱글사이클 튜터 네비게이션">
      {/* ========================================================= */}
      {/* 상단 슬롯: [^] C로 올라가는 버튼 (ASM 뷰에서만 노출 - C 뷰는 윗쪽을 완전히 채움) */}
      {/* ========================================================= */}
      {view === 'asm' && (
        <div className="tutor-single-slot-top">
          <button
            type="button"
            className="tutor-single-btn-vertical up"
            disabled={!hasC || line == null}
            title={
              !hasC || line == null
                ? 'C 코드 매핑 없음 (런타임 또는 직접 작성한 어셈블리)'
                : `C: L${line} 설명으로 올라가기`
            }
            onClick={handleRollUpToC}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            <span>{hasC && line != null ? `C: L${line} 설명으로 올라가기` : 'C 코드 매핑 없음'}</span>
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 중간 스테이지: [<] 버튼 + 중앙 카드(도식 1번 헤더 일체형) + [>] 버튼 */}
      {/* ========================================================= */}
      <div className="tutor-single-stage">
        {/* 좌측 이전 버튼 (ASM 뷰에서만 활성화) */}
        {view === 'asm' ? (
          <button
            type="button"
            className="tutor-single-btn-horizontal"
            disabled={!prevRow}
            title={prevRow ? `이전 ASM: L${prevRow.index + 1}로 이동` : '첫 번째 명령어입니다'}
            aria-label="이전 ASM 명령어"
            onClick={() => prevRow && handleNavigateAsm(prevRow)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        ) : (
          <div className="w-[36px] shrink-0" aria-hidden="true" />
        )}

        {/* ========================================================= */}
        {/* 중앙 카드 본체 (1번 구조: 헤더 한 줄에 태그 + 서류철 탭 + 진행도 결합) */}
        {/* ========================================================= */}
        <div className="tutor-single-card" data-mode={isUserSelected ? 'selected' : 'executing'}>
          {view === 'c' ? (
            /* ==================== C 코드 카드 ==================== */
            <>
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
                  {isUserSelected && (
                    <button
                      type="button"
                      className="tutor-return-exec-btn"
                      title="현재 실행 중인 위치로 돌아가기"
                      onClick={() => onSelectLine?.(null, null)}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      <span>실행 위치로</span>
                    </button>
                  )}
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
            </>
          ) : (
            /* ==================== ASM 어셈블리 카드 ==================== */
            <>
              {/* 1번 스타일: 헤더 안에 태그, 서류철 탭, 카운터가 한 줄로 배치 */}
              <div className="tutor-single-card-header">
                <div className="tutor-header-left">
                  <span className="tutor-single-tag">
                    {currentRow ? `ASM : L${currentRow.index + 1}` : 'ASM'}
                  </span>
                  <span className={`tutor-mode-badge ${isUserSelected ? 'selected' : 'executing'}`}>
                    <span className="tutor-mode-dot" />
                    <span>{isUserSelected ? '선택됨' : '실행 중'}</span>
                  </span>
                  {instruction && (
                    <span className="tutor-single-badge">{instruction.action}</span>
                  )}
                </div>

                {/* 헤더 중앙 서류철 탭 */}
                <div className="tutor-header-tabs" role="tablist">
                  {availableAsmTabs.map((tab) => {
                    const isActive = activeAsmTabId === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={`tutor-folder-tab ${isActive ? 'active' : ''}`}
                        onClick={() => setAsmTab(tab.id as AsmTabId)}
                      >
                        <span>{tab.label}</span>
                        {tab.badge && (
                          <span className="tutor-folder-tab-badge">{tab.badge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="tutor-header-right">
                  {isUserSelected && (
                    <button
                      type="button"
                      className="tutor-return-exec-btn"
                      title="현재 실행 중인 위치로 돌아가기"
                      onClick={() => onSelectLine?.(null, null)}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      <span>실행 위치로</span>
                    </button>
                  )}
                  <span className="tutor-single-counter">
                    {group.length ? `${position + 1} / ${group.length}` : '0 / 0'}
                  </span>
                </div>
              </div>

              <div className="tutor-single-card-body">
                {currentRow && instruction ? (
                  activeAsmTabId === 'desc' ? (
                    /* ---------------- ASM [설명] 탭 ---------------- */
                    <>
                      <div className="tutor-single-code-box">
                        <code>{currentRow.text}</code>
                      </div>

                      <div className="tutor-single-meaning">
                        <span className="tutor-single-meaning-arrow" aria-hidden="true">→</span>
                        <p className="tutor-single-meaning-text">
                          <TutorText text={instruction.explanation} />
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
                    /* ---------------- ASM [실제 실행] 탭 ---------------- */
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
                    /* ---------------- ASM [동작 원리] 탭 ---------------- */
                    <div className="space-y-3">
                      {instruction.hardwareDetail && (
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
                          {item.teaching.walkthrough.map((step, idx) => (
                            <div
                              key={idx}
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
                            {item.teaching.operand_roles.map((role, idx) => (
                              <div
                                key={idx}
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
                  <p className="text-sm text-[var(--ar-text-muted)] p-4 text-center">
                    이 C 줄에 연결된 어셈블리 명령어가 없습니다.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* 우측 다음 버튼 (ASM 뷰에서만 활성화) */}
        {view === 'asm' ? (
          <button
            type="button"
            className="tutor-single-btn-horizontal"
            disabled={!nextRow}
            title={nextRow ? `다음 ASM: L${nextRow.index + 1}로 이동` : '마지막 명령어입니다'}
            aria-label="다음 ASM 명령어"
            onClick={() => nextRow && handleNavigateAsm(nextRow)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ) : (
          <div className="w-[36px] shrink-0" aria-hidden="true" />
        )}
      </div>

      {/* ========================================================= */}
      {/* 하단 슬롯: [v] ASM으로 내려가는 버튼 (C 뷰에서만 렌더링 - ASM 뷰는 아랫쪽을 완전히 채움) */}
      {/* ========================================================= */}
      {view === 'c' && (
        <div className="tutor-single-slot-bottom">
          <button
            type="button"
            className="tutor-single-btn-vertical down"
            disabled={!firstAsmRow}
            title={
              firstAsmRow
                ? `ASM: L${firstAsmRow.index + 1} 설명으로 내려가기 (${group.length}개 명령어)`
                : '연결된 ASM 명령어가 없습니다'
            }
            onClick={handleDrillDownToAsm}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span>
              {firstAsmRow
                ? `ASM: L${firstAsmRow.index + 1} 설명으로 내려가기 (${group.length}개)`
                : '연결된 ASM 없음'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default TutorSingleMode;
