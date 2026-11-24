import React, { useMemo, useState, useCallback } from 'react';
import type { SimulationResult, CycleHistoryItem } from '@/type/simulation';
import type { MappedAssemblyRow } from '../utils/translationCompile';
import {
  analyzeAsmInstruction,
  analyzeCLine,
  analyzeCrtInstruction,
  instructionAt,
} from '../utils/tutorAnalysis';
import { instructionCycleForPc } from '../utils/instructionFlow';
import { tutorInstructionDetails } from '../utils/tutorInstructionDetails';
import TutorDetailPages, { TutorDetailHost, type TutorDetailPage } from './TutorDetailPages';
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
  onSelect: (index: number) => void;
  onSelectLine?: (line: number | null, asmIndex?: number | null) => void;
  onJumpToCycle?: (cycle: number) => void;
  onPausePlayback?: () => void;
}

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
  onSelect,
  onSelectLine,
  onJumpToCycle,
  onPausePlayback,
}) => {
  // 사용자의 명시적 C ↔ ASM 전환 상태 관리 (selectionKey가 바뀌면 상위 요청 뷰로 초기화)
  const [screen, setScreen] = useState<{ key: number; kind: 'c' | 'asm' }>({
    key: selectionKey,
    kind: requestedView,
  });

  const view = screen.key === selectionKey ? screen.kind : requestedView;

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

  type AsmRow = (typeof group)[number];

  // ASM 명령어 간 수평 이동 핸들러
  const handleNavigateAsm = useCallback(
    (target: AsmRow | null | undefined) => {
      if (!target) return;

      // 1) 실행 중이면 일시정지 후 수동 선택 모드로 전환
      if (isPlaying) {
        onPausePlayback?.();
      }

      // 2) 튜터 내부 및 외부 에디터 선택 상태 동기화
      onSelect(target.index);
      onSelectLine?.(target.sourceLine, target.index);

      // 3) 정지 상태에서 해당 명령어의 실행 사이클이 존재하면 시뮬레이터 상태도 동기화
      if (!isPlaying && target.pc && simulation.history) {
        const cycle = instructionCycleForPc(
          simulation.history,
          target.pc,
          historyIndex != null && historyIndex >= 0 ? historyIndex + 1 : 1
        );
        if (cycle !== undefined) {
          onJumpToCycle?.(cycle);
        }
      }
    },
    [isPlaying, onPausePlayback, onSelect, onSelectLine, simulation.history, historyIndex, onJumpToCycle]
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

  // 상세 페이지 구성 (TutorDetailPages)
  const cDetailPages: TutorDetailPage[] = useMemo(() => {
    if (!cAnalysis) return [];
    return [
      {
        title: cAnalysis.type,
        blocks: [
          { label: '선택한 C 코드', text: cText },
          { label: '이 코드의 의미', text: cAnalysis.summary },
          { label: '컴파일 결과 해석', text: cAnalysis.detail },
        ],
      },
      ...(lineExplanation
        ? [
          {
            title: 'C와 어셈블리 연결',
            blocks: [
              { label: '어셈블리 동작 요약', text: lineExplanation.summary },
              { label: '상세 매핑 원리', text: lineExplanation.detail },
            ],
          },
        ]
        : []),
    ];
  }, [cAnalysis, cText, lineExplanation]);

  const asmDetailPages: TutorDetailPage[] = useMemo(() => {
    if (!currentRow || !instruction) return [];
    return [
      {
        title: '명령어 해설',
        blocks: [
          { label: '명령어 의미', text: instruction.explanation },
          { label: '연산 분류', text: instruction.action },
        ],
      },
      ...(observations.length
        ? [
          {
            title: '실제 실행 관찰',
            blocks: observations.map(([stage, val]) => ({
              label: `Step ${val.step} · ${stage}`,
              text: val.summary,
            })),
          },
        ]
        : []),
      ...(details?.pages ?? []),
      ...(instruction.hardwareDetail
        ? [
          {
            title: '하드웨어 원리와 주의사항',
            blocks: [{ text: instruction.hardwareDetail }],
          },
        ]
        : []),
      ...(currentRow.sourceLine == null
        ? [
          {
            title: '소스 위치와 실행 문맥',
            blocks: [
              { text: analyzeCrtInstruction(currentRow.text, currentRow.pc).summary },
              { text: analyzeCrtInstruction(currentRow.text, currentRow.pc).detail },
            ],
          },
        ]
        : []),
    ];
  }, [currentRow, instruction, observations, details, currentRow?.sourceLine, currentRow?.text, currentRow?.pc]);

  return (
    <TutorDetailHost
      inline
      label={view === 'c' ? 'C 라인 해설 자세히 보기' : '어셈블리 명령어 해설 자세히 보기'}
      onOpen={() => {
        if (currentRow) onSelect(currentRow.index);
      }}
    >
      <div className="tutor-single-container" aria-label="싱글사이클 튜터 네비게이션">
        {/* ========================================================= */}
        {/* 상단 슬롯: [^] C로 올라가는 버튼 (ASM 뷰에서만 노출) */}
        {/* ========================================================= */}
        <div className="tutor-single-slot-vertical">
          {view === 'asm' && (
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
          )}
        </div>

        {/* ========================================================= */}
        {/* 중간 스테이지: [<] 버튼 + 중앙 카드 + [>] 버튼 */}
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
            <div className="w-[38px] shrink-0" aria-hidden="true" />
          )}

          {/* 중앙 메인 카드 */}
          <div className="tutor-single-card">
            {view === 'c' ? (
              /* ---------------- C 코드 카드 ---------------- */
              <>
                <div className="tutor-single-card-header">
                  <div className="flex items-center gap-2">
                    <span className="tutor-single-tag">
                      {line != null ? `C : L${line}` : 'C 코드'}
                    </span>
                    {cAnalysis && (
                      <span className="tutor-single-badge">{cAnalysis.type}</span>
                    )}
                  </div>
                  <span className="tutor-single-counter">
                    {group.length > 0 ? `연결된 ASM ${group.length}개` : '매핑된 ASM 없음'}
                  </span>
                </div>

                <div className="tutor-single-card-body">
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
                </div>

                <div className="tutor-single-card-footer">
                  {cDetailPages.length > 0 ? (
                    <TutorDetailPages
                      title="C 설명 자세히 보기"
                      context={`C: L${line} · ${cText.trim()}`}
                      pages={cDetailPages}
                    />
                  ) : (
                    <span />
                  )}
                  <span className="tutor-single-mapping-hint">
                    아래 버튼을 눌러 어셈블리 명령어를 확인하세요
                  </span>
                </div>
              </>
            ) : (
              /* ---------------- ASM 어셈블리 카드 ---------------- */
              <>
                <div className="tutor-single-card-header">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="tutor-single-tag">
                      {currentRow ? `ASM : L${currentRow.index + 1}` : 'ASM'}
                    </span>
                    {instruction && (
                      <span className="tutor-single-badge">{instruction.action}</span>
                    )}
                  </div>
                  <span className="tutor-single-counter">
                    {group.length ? `${position + 1} / ${group.length}` : '0 / 0'}
                  </span>
                </div>

                <div className="tutor-single-card-body">
                  {currentRow && instruction ? (
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
                            <span>실제 실행 관찰</span>
                            <span>Step {latest[1].step} · {latest[0]}</span>
                          </div>
                          <p className="tutor-single-observed-content">
                            <TutorText text={latest[1].summary} />
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-[var(--ar-text-muted)] p-4 text-center">
                      이 C 줄에 연결된 어셈블리 명령어가 없습니다.
                    </p>
                  )}
                </div>

                <div className="tutor-single-card-footer">
                  {asmDetailPages.length > 0 ? (
                    <TutorDetailPages
                      title="명령어 자세히 보기"
                      context={currentRow ? `ASM: L${currentRow.index + 1} · ${currentRow.text}` : 'ASM 해설'}
                      pages={asmDetailPages}
                    />
                  ) : (
                    <span />
                  )}
                  {hasC && line != null && (
                    <span className="tutor-single-mapping-hint">
                      C: L{line}에 매핑된 명령어
                    </span>
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
            <div className="w-[38px] shrink-0" aria-hidden="true" />
          )}
        </div>

        {/* ========================================================= */}
        {/* 하단 슬롯: [v] ASM으로 내려가는 버튼 (C 뷰에서만 노출) */}
        {/* ========================================================= */}
        <div className="tutor-single-slot-vertical">
          {view === 'c' && (
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
          )}
        </div>
      </div>
    </TutorDetailHost>
  );
};

export default TutorSingleMode;
