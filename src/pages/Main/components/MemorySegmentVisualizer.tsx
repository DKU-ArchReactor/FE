import React, { useMemo } from 'react';
import type { CycleHistoryItem, SimulationResult } from '@/type/simulation';
import {
  SEGMENT_DEFS,
  formatAddressDecimal,
  normalizeHex,
  extractCodeSegmentSummary,
  buildSegmentedMemory,
  computeBoundaryDividers,
  type CodeSegmentSummary,
} from '../utils/memoryLayout';

interface MemorySegmentVisualizerProps {
  currentData: CycleHistoryItem | null;
  prevData: CycleHistoryItem | null;
  simulationData: SimulationResult | null;
  playSpeed?: number;
  cycle?: number;
}

const EMPTY_MEMORY_SNAPSHOT: Record<string, string> = {};

const MemorySegmentVisualizer: React.FC<MemorySegmentVisualizerProps> = ({
  currentData,
  prevData,
  simulationData,
  playSpeed = 1000,
  cycle = 0,
}) => {
  const memorySnapshot = currentData?.global_result.memory_snapshot ?? EMPTY_MEMORY_SNAPSHOT;
  const prevMemorySnapshot = prevData?.global_result.memory_snapshot;
  const currentPc = currentData?.global_result.current_pc?.toLowerCase();
  const [isUserCodeExpanded, setIsUserCodeExpanded] = React.useState(true);
  const userCodeScrollRef = React.useRef<HTMLDivElement>(null);
  const stackScrollRef = React.useRef<HTMLDivElement>(null);

  // 어셈블리 및 코드 세그먼트 메타데이터 추출: CORE가 제공하는 memory_layout 및 code_mapping을 최우선 SSOT로 사용
  const {
    userInstructions,
    runtimeInstructions,
    userRange,
    startupRange,
    maxCodePcNum,
  } = useMemo<CodeSegmentSummary>(
    () => extractCodeSegmentSummary(simulationData, currentPc),
    [simulationData, currentPc]
  );

  // 메모리 6대 세그먼트별 분류 및 정렬 (모든 섹션 High ➔ Low 일치)
  const segmentedMemory = useMemo(
    () =>
      buildSegmentedMemory(
        memorySnapshot,
        prevMemorySnapshot,
        simulationData?.program?.memory_layout,
        maxCodePcNum,
        userInstructions,
        runtimeInstructions
      ),
    [memorySnapshot, prevMemorySnapshot, simulationData, maxCodePcNum, userInstructions, runtimeInstructions]
  );

  // 새로 값이 쓰인 메모리 주소들에 대해 절반 주기(50%) 동안 점등 상태 유지
  const [pulsingAddresses, setPulsingAddresses] = React.useState<Set<string>>(() => new Set());
  const prevMemRef = React.useRef<Record<string, string> | undefined>(undefined);

  React.useEffect(() => {
    const referencePrev = prevMemorySnapshot || prevMemRef.current;
    prevMemRef.current = memorySnapshot;

    if (!referencePrev) {
      setPulsingAddresses((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    const changed = new Set<string>();
    Object.entries(memorySnapshot).forEach(([addr, val]) => {
      const prevVal = referencePrev[addr];
      if (prevVal !== undefined && prevVal !== val) {
        changed.add(addr.toLowerCase());
      } else if (prevVal === undefined && val !== undefined) {
        // 새로 할당된 메모리 주소인 경우에도 점등
        changed.add(addr.toLowerCase());
      }
    });

    if (changed.size > 0) {
      setPulsingAddresses(changed);
      // 부드러운 페이드아웃 효과를 위해 유지 시간을 재생 속도에 맞춰 탄력적으로 설정 (최소 300ms ~ 재생 주기의 70%)
      const flashDuration = Math.max(300, Math.round(playSpeed * 0.7));
      const timer = window.setTimeout(() => {
        setPulsingAddresses((prev) => (prev.size === 0 ? prev : new Set()));
      }, flashDuration);

      return () => clearTimeout(timer);
    } else {
      setPulsingAddresses((prev) => (prev.size === 0 ? prev : new Set()));
    }
  }, [cycle, memorySnapshot, prevMemorySnapshot, playSpeed]);

  // 사용자가 코드를 펼쳤거나 실행 중 PC가 변경되었을 때, 현재 실행 중인 명령어(data-active="true") 위치로 자동 포커싱
  React.useEffect(() => {
    if (isUserCodeExpanded && userCodeScrollRef.current) {
      const activeEl = userCodeScrollRef.current.querySelector<HTMLElement>('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        // 활성 명령어가 없으면 시작 지점(하단)으로 이동
        userCodeScrollRef.current.scrollTop = userCodeScrollRef.current.scrollHeight;
      }
    }
  }, [isUserCodeExpanded, currentPc, userInstructions.length]);

  // 스택에 새 데이터가 푸시되거나 스택 항목이 변경되었을 때, 스택의 최신 성장 방향(아래/낮은 주소)으로 자동 스크롤
  React.useEffect(() => {
    if (stackScrollRef.current) {
      stackScrollRef.current.scrollTo({
        top: stackScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [segmentedMemory.stack.length, cycle]);

  // 동적 세그먼트 경계선 주소 계산 (High ➔ Low)
  const boundaryDividers = useMemo(
    () => computeBoundaryDividers(currentData, simulationData, userRange.count),
    [currentData, simulationData, userRange.count]
  );

  return (
    <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg border border-[var(--ar-border)] flex flex-col min-h-0 overflow-hidden select-none font-mono text-[var(--ar-text-primary)] shadow-sm transition-colors duration-150">
      {/* 1. 상단 미니멀 헤더 (레지스터 뷰와 통일된 VS Code VARIABLES 스타일) */}
      <div className="h-8 shrink-0 flex items-center justify-between px-3.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 border-l-2 border-l-yellow-500 font-sans">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] text-yellow-500 font-bold">◆</span>
          <h3 className="font-sans text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wide whitespace-nowrap">
            MEMORY LAYOUT
          </h3>
        </div>
        <span className="text-[10px] text-[var(--ar-text-muted)] font-mono">
          HIGH ➔ LOW
        </span>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-3 py-2">
        {/* 2. 최상단 시작 주소 헤더 바 (일체형 꺾인 브래킷 ┌─── 주소 ───┐ 형태) */}
        <div className="relative shrink-0 mt-2 mb-1 select-none border-t border-l border-r border-[#D0D7DE] dark:border-[#3E3E42] h-4 flex items-center justify-between px-1.5">
          {/* 좌측 HIGH 라벨 (하단 baseline이 꺾인 선의 끝 y축과 일치) */}
          <span className="text-[9px] font-mono tracking-wider font-semibold text-[#8C959F] dark:text-[#6E7681] leading-none self-end pb-0.5">
            HIGH
          </span>

          {/* 상단 가로선 정중앙에 얹히는 주소 텍스트 뱃지 */}
          <div className="absolute left-1/2 -top-[7px] -translate-x-1/2 bg-white dark:bg-[#1E1E1E] px-2 text-[10px] text-[#57606A] dark:text-[#858585] font-mono leading-none z-10">
            <span
              title="Hex: 0x7FFFEFFC (High Address Top)"
              className="font-semibold cursor-help hover:text-[#005FB8] dark:hover:text-[#79C0FF] transition-colors"
            >
              {formatAddressDecimal('0x7FFFEFFC')}
            </span>
          </div>
        </div>

      {/* 3. 전체 6대 가상 메모리 영역과 세그먼트 사이 독립 경계선 5개 */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {SEGMENT_DEFS.map((seg, index) => {
          const items = segmentedMemory[seg.key];
          const isCode = seg.key === 'code';
          const isReserved = seg.key === 'reserved';
          const dividerHex = index < boundaryDividers.length ? boundaryDividers[index] : null;

          return (
            <React.Fragment key={seg.key}>
              {/* 세그먼트 본체 (경계선과 완전히 분리되어 100% 독립된 높이 영역 점유) */}
              <div
                style={{ flex: seg.flexRatio }}
                className="flex min-h-0 overflow-hidden py-0.5"
              >
                {/* 좌측: 섹션 뱃지 */}
                <div className={`w-[62px] shrink-0 flex flex-col items-center ${seg.badgeAlignClass}`}>
                  {seg.shape === 'down-arrow' ? (
                    <div className="flex flex-col items-center">
                      <div className={`px-2.5 py-1 rounded-t font-bold text-[11px] ${seg.color.badgeBg} ${seg.color.badgeText} shadow-2xs leading-none`}>
                        {seg.name}
                      </div>
                      <div
                        className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[8px]"
                        style={{ borderTopColor: seg.color.arrowFill }}
                      />
                    </div>
                  ) : seg.shape === 'up-arrow' ? (
                    <div className="flex flex-col items-center">
                      <div
                        className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-b-[8px]"
                        style={{ borderBottomColor: seg.color.arrowFill }}
                      />
                      <div className={`px-2.5 py-1 rounded-b font-bold text-[11px] ${seg.color.badgeBg} ${seg.color.badgeText} shadow-2xs leading-none`}>
                        {seg.name}
                      </div>
                    </div>
                  ) : (
                    <span className={`px-2.5 py-1 rounded-md font-bold text-[11px] ${seg.color.badgeBg} ${seg.color.badgeText} shadow-2xs leading-none`}>
                      {seg.name}
                    </span>
                  )}
                </div>

                {/* 우측: 데이터 리스트 (Code 영역은 내부 스크롤로 가두기 위해 overflow-hidden 적용) */}
                <div
                  ref={seg.key === 'stack' ? stackScrollRef : undefined}
                  className={`flex-1 flex flex-col min-w-0 pl-1.5 py-0.5 ${
                    isCode ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'
                  } ${
                    isCode ? (isUserCodeExpanded ? 'justify-start' : 'justify-end') : items.length === 0 && !isReserved ? 'justify-center' : 'justify-start'
                  }`}
                >
                  {isReserved ? (
                    <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-500 dark:text-slate-400 font-semibold text-[10.5px]">
                          0 ~ 65,535
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">64KB</span>
                      </div>
                      <span className="font-sans text-[9.5px] text-slate-400 dark:text-slate-500 leading-tight">
                        NULL Pointer Guard (접근 금지 보호 구역)
                      </span>
                    </div>
                  ) : isCode ? (
                    <div className={`flex flex-col gap-1.5 py-0.5 ${isUserCodeExpanded ? 'flex-1 min-h-0 overflow-hidden' : ''}`}>
                      {/* 1. 사용자 프로그램 메인 코드 통합 블록 (펼쳤을 때 세로 영역을 유연하게 차지하며 내부 스크롤 보장) */}
                      <div className={`rounded-lg border border-amber-300 dark:border-amber-900/60 bg-[#FFFDF7] dark:bg-[#1E1D1A] p-1.5 shadow-2xs flex flex-col gap-1 ${
                        isUserCodeExpanded ? 'flex-1 min-h-0 overflow-hidden' : ''
                      }`}>
                        {/* 1층: 타이틀 & 명령어 개수 뱃지 & 토글 버튼 */}
                        <div className="flex items-center justify-between gap-1 text-[10px] shrink-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-amber-900 dark:text-amber-300 font-sans truncate">
                              User Program (main)
                            </span>
                            <span className="text-[9px] px-1 py-0.2 rounded font-sans font-bold bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 shrink-0">
                              {userRange.count > 0 ? `${userRange.count} instrs` : '대기'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsUserCodeExpanded(!isUserCodeExpanded)}
                            className="text-[9.5px] font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 bg-amber-100/90 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/70 px-1.5 py-0.5 rounded cursor-pointer transition-colors shrink-0"
                          >
                            {isUserCodeExpanded ? '닫기 ▼' : '열기 ▲'}
                          </button>
                        </div>

                        {/* 2층: 주소 범위 & Current PC */}
                        <div className="flex items-center justify-between gap-1 text-[9.5px] border-t border-amber-200/60 dark:border-amber-900/40 pt-1 shrink-0 font-mono">
                          <span
                            title={
                              userRange.start && userRange.end
                                ? `Hex: ${normalizeHex(userRange.start)} ~ ${normalizeHex(userRange.end)}`
                                : undefined
                            }
                            className="text-amber-950 dark:text-amber-200 font-semibold tracking-tight cursor-help truncate"
                          >
                            {userRange.start && userRange.end
                              ? `${formatAddressDecimal(userRange.start)} ~ ${formatAddressDecimal(userRange.end)}`
                              : '— ~ —'}
                          </span>
                          <span className="text-amber-900 dark:text-amber-300 font-bold shrink-0">
                            PC {currentPc ? formatAddressDecimal(currentPc) : '—'}
                          </span>
                        </div>

                        {/* 펼쳤을 때: 명령어 리스트 (자체 스크롤 컨테이너로 동작) */}
                        {isUserCodeExpanded && (
                          <div
                            ref={userCodeScrollRef}
                            className="mt-0.5 border border-amber-200/80 dark:border-amber-900/50 rounded bg-white dark:bg-[#141414] p-0.5 pb-1 divide-y divide-amber-100/60 dark:divide-amber-900/30 flex-1 min-h-0 overflow-y-auto custom-scrollbar"
                          >
                            {userInstructions.length === 0 ? (
                              <div className="text-[10px] text-amber-800/60 dark:text-amber-400/60 font-sans italic py-2 text-center">
                                컴파일 후 명령어가 로드됩니다.
                              </div>
                            ) : (
                              userInstructions.map((item) => (
                                <div
                                  key={item.address}
                                  data-active={item.isChanged ? 'true' : undefined}
                                  className={`flex items-center justify-between px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 transition-colors ${
                                    item.isChanged
                                      ? 'bg-amber-500 text-white font-bold shadow-xs'
                                      : 'text-slate-700 dark:text-slate-300 hover:bg-amber-50/60 dark:hover:bg-amber-950/30'
                                  }`}
                                >
                                  <div className="flex items-center gap-1 min-w-0">
                                    {item.isChanged && <span className="text-[8px] animate-pulse">▶</span>}
                                    <span className={item.isChanged ? 'text-white' : 'text-slate-500 dark:text-slate-400'}>
                                      {formatAddressDecimal(item.address)}
                                    </span>
                                  </div>
                                  <span className={`font-semibold truncate ml-2 ${item.isChanged ? 'text-amber-100' : 'text-indigo-900 dark:text-indigo-300'}`}>
                                    {item.decText}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* 2. C 런타임 스타트업 영역 (공간 절약을 위한 컴팩트 단일 라인 칩) */}
                      <div
                        title={
                          startupRange.start && startupRange.end
                            ? `Hex: ${normalizeHex(startupRange.start)} ~ ${normalizeHex(startupRange.end)} (${startupRange.bytes} Bytes)`
                            : undefined
                        }
                        className="flex items-center justify-between px-2 py-1 rounded border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-[#1A1D23] shrink-0 text-[9.5px] cursor-help"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 text-slate-600 dark:text-slate-400">
                          <span className="font-sans font-medium text-slate-600 dark:text-slate-300">_start</span>
                          <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500">
                            ({startupRange.start && startupRange.end ? `${formatAddressDecimal(startupRange.start)}~` : '—'})
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                          {startupRange.bytes > 0 ? `${startupRange.bytes}B` : '—B'}
                        </span>
                      </div>
                    </div>
                  ) : items.length === 0 ? (
                    <div className="py-2 text-slate-300 text-[10.5px] font-sans text-center">
                      비어 있음
                    </div>
                  ) : (
                    items.map((item) => {
                      const isPulsing = pulsingAddresses.has(item.address.toLowerCase());
                      
                      // 세그먼트별 시그니처 배경 점멸 색상 매핑
                      let pulsingBgClass = 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold';
                      if (seg.key === 'stack') {
                        pulsingBgClass = 'bg-violet-100 dark:bg-violet-950/80 text-violet-950 dark:text-violet-100 font-bold';
                      } else if (seg.key === 'heap') {
                        pulsingBgClass = 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-100 font-bold';
                      } else if (seg.key === 'bss') {
                        pulsingBgClass = 'bg-sky-100 dark:bg-sky-950/80 text-sky-950 dark:text-sky-100 font-bold';
                      } else if (seg.key === 'data') {
                        pulsingBgClass = 'bg-blue-100 dark:bg-blue-950/80 text-blue-950 dark:text-blue-100 font-bold';
                      }

                      return (
                        <div
                          key={item.address}
                          className={`flex items-center px-2 py-1 border-b border-[#F0F2F5] dark:border-[#2D3139] last:border-b-0 transition-colors duration-300 ease-out shrink-0 ${
                            isPulsing
                              ? pulsingBgClass
                              : 'bg-transparent hover:bg-[#F6F8FA] dark:hover:bg-[#2A2D2E] text-[#24292F] dark:text-[#CCCCCC]'
                          }`}
                        >
                          {/* 1열 & 2열: addr: 라벨 + 주소 (탄력적 비율 너비 w-[65%] shrink-0) */}
                          <div className="w-[65%] shrink-0 flex items-center gap-1 min-w-0 pr-1">
                            <span className="text-[9.5px] font-mono text-[#8C959F] dark:text-[#6E7681] select-none shrink-0">
                              addr:
                            </span>
                            <span
                              title={`Hex: ${normalizeHex(item.address)}`}
                              className={`text-[11.5px] font-mono font-semibold cursor-help whitespace-nowrap ${
                                isPulsing
                                  ? 'text-inherit font-bold'
                                  : 'text-[#24292F] dark:text-[#CCCCCC]'
                              }`}
                            >
                              {formatAddressDecimal(item.address)}
                            </span>
                            {item.label && (
                              <span className="text-[8px] px-1 py-0.2 rounded font-sans font-bold bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 shrink-0">
                                {item.label}
                              </span>
                            )}
                          </div>

                          {/* 3열 & 4열: val: 라벨 + 값 (탄력적 비율 너비 w-[35%] shrink-0) */}
                          <div className="w-[35%] shrink-0 flex items-center gap-1 min-w-0">
                            <span className="text-[9.5px] font-mono text-[#8C959F] dark:text-[#6E7681] select-none shrink-0">
                              val:
                            </span>
                            <span
                              className={`font-mono text-[11.5px] tracking-wide ${
                                isPulsing
                                  ? 'text-inherit font-black'
                                  : isCode
                                  ? 'text-indigo-950 dark:text-[#9CDCFE] font-bold'
                                  : 'text-[#1F2328] dark:text-[#CCCCCC] font-bold'
                              }`}
                            >
                              {item.decText}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 세그먼트 사이 독립 경계선 */}
              {dividerHex && index < SEGMENT_DEFS.length - 1 && (
                <div className="relative flex items-center justify-center my-1 shrink-0">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-dashed border-[#D0D7DE] dark:border-[#3E3E42]" />
                  </div>
                  <div className="relative flex items-center bg-white dark:bg-[#1E1E1E] px-2 text-[10px] text-[#57606A] dark:text-[#858585] font-mono z-10">
                    <span
                      title={
                        dividerHex === '—'
                          ? '컴파일 후 확정되는 경계 주소'
                          : `Hex: ${normalizeHex(dividerHex)}`
                      }
                      className="font-semibold text-[#57606A] dark:text-[#858585] cursor-help"
                    >
                      {dividerHex === '—' ? '—' : formatAddressDecimal(dividerHex)}
                    </span>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 4. 최하단 메모리 끝 경계선 (일체형 꺾인 브래킷 └─── 주소 ───┘ 형태) */}
      <div className="relative shrink-0 mt-1 mb-2 select-none border-b border-l border-r border-[#D0D7DE] dark:border-[#3E3E42] h-4 flex items-center justify-between px-1.5">
        {/* 좌측 LOW 라벨 (상단이 꺾인 선의 시작 y축과 일치) */}
        <span className="text-[9px] font-mono tracking-wider font-semibold text-[#8C959F] dark:text-[#6E7681] leading-none self-start pt-0.5">
          LOW
        </span>

        {/* 하단 가로선 정중앙에 얹히는 주소 텍스트 뱃지 */}
        <div className="absolute left-1/2 -bottom-[7px] -translate-x-1/2 bg-white dark:bg-[#1E1E1E] px-2 text-[10px] text-[#57606A] dark:text-[#858585] font-mono leading-none z-10">
          <span
            title="Hex: 0x00000000 (Low Address Origin)"
            className="font-semibold cursor-help hover:text-[#005FB8] dark:hover:text-[#79C0FF] transition-colors"
          >
            0
          </span>
        </div>
      </div>
      </div>
    </div>
  );
};

export default MemorySegmentVisualizer;
