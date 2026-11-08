import React, { useMemo } from 'react';
import type { CycleHistoryItem, SimulationResult, ProgramMemoryLayout } from '@/type/simulation';

interface MemorySegmentVisualizerProps {
  currentData: CycleHistoryItem | null;
  prevData: CycleHistoryItem | null;
  simulationData: SimulationResult | null;
  translationAssembly?: string | null;
  playSpeed?: number;
  cycle?: number;
}

export type MemorySegmentKey = 'stack' | 'heap' | 'bss' | 'data' | 'code' | 'reserved';

// 16진수 문자열을 10진수 포맷(콤마 포함)으로 변환
const formatAddressDecimal = (hexStr: string): string => {
  const num = parseInt(hexStr, 16);
  if (isNaN(num)) return hexStr;
  return num.toLocaleString();
};

const formatSignedDecimal = (hexStr: string): string => {
  const num = parseInt(hexStr, 16);
  if (isNaN(num)) return '0';
  const signed = num | 0;
  return signed.toLocaleString();
};

// 16진수 언더바 제거 및 대문자 정규화 (예: 0x7FFFEFFC)
const normalizeHex = (hexStr: string): string => {
  const clean = hexStr.replace(/^0x/i, '').replace(/_/g, '').toUpperCase();
  return `0x${clean.padStart(8, '0')}`;
};

// 주소 분류: CORE가 제공하는 정적 memory_layout SSOT를 최우선 기준으로 판별
const classifyAddress = (
  addrHex: string,
  valHex: string,
  layout?: ProgramMemoryLayout | null,
  maxCodePcNum?: number
): MemorySegmentKey => {
  const num = parseInt(addrHex, 16) >>> 0;
  if (num >= 0x70000000) return 'stack';
  if (num >= 0x10004000 && num < 0x10008000) return 'heap';
  if (num >= 0x10008000) return 'stack';

  if (layout) {
    const bssStart = parseInt(layout.bss.start, 16) >>> 0;
    const bssEnd = parseInt(layout.bss.end_exclusive, 16) >>> 0;
    if (layout.bss.size_bytes > 0 && num >= bssStart && num < bssEnd) return 'bss';

    const dataStart = parseInt(layout.data.start, 16) >>> 0;
    const dataEnd = parseInt(layout.data.end_exclusive, 16) >>> 0;
    if (layout.data.size_bytes > 0 && num >= dataStart && num < dataEnd) return 'data';

    const codeStart = parseInt(layout.code.start, 16) >>> 0;
    const codeEnd = parseInt(layout.code.end_exclusive, 16) >>> 0;
    if (num >= codeStart && num < codeEnd) return 'code';
  } else {
    if (maxCodePcNum && maxCodePcNum > 0 && num >= 0x00010000 && num <= maxCodePcNum) return 'code';
    if (num >= 0x10000000 && num < 0x10004000) {
      const valNum = parseInt(valHex, 16) || 0;
      return valNum === 0 ? 'bss' : 'data';
    }
  }

  if (num < 0x00010000) return 'reserved';
  return 'data';
};

interface SegmentDefinition {
  key: MemorySegmentKey;
  name: string;
  shape: 'down-arrow' | 'up-arrow' | 'rect';
  flexRatio: number; // 컴포넌트 전체 세로 높이 기준 상대 비율
  badgeAlignClass: string;
  color: {
    badgeBg: string;
    badgeText: string;
    arrowFill?: string;
  };
}

const SEGMENT_DEFS: SegmentDefinition[] = [
  {
    key: 'stack',
    name: 'Stack',
    shape: 'down-arrow',
    flexRatio: 2.0,
    badgeAlignClass: 'justify-start pt-1',
    color: {
      badgeBg: 'bg-violet-600',
      badgeText: 'text-white',
      arrowFill: '#7C3AED',
    },
  },
  {
    key: 'heap',
    name: 'Heap',
    shape: 'up-arrow',
    flexRatio: 1.2,
    badgeAlignClass: 'justify-end pb-1',
    color: {
      badgeBg: 'bg-emerald-600',
      badgeText: 'text-white',
      arrowFill: '#059669',
    },
  },
  {
    key: 'bss',
    name: 'BSS',
    shape: 'rect',
    flexRatio: 1.1,
    badgeAlignClass: 'justify-center',
    color: {
      badgeBg: 'bg-sky-600',
      badgeText: 'text-white',
    },
  },
  {
    key: 'data',
    name: 'Data',
    shape: 'rect',
    flexRatio: 1.4,
    badgeAlignClass: 'justify-center',
    color: {
      badgeBg: 'bg-blue-600',
      badgeText: 'text-white',
    },
  },
  {
    key: 'code',
    name: 'Code',
    shape: 'rect',
    flexRatio: 3.5,
    badgeAlignClass: 'justify-center',
    color: {
      badgeBg: 'bg-amber-600',
      badgeText: 'text-white',
    },
  },
  {
    key: 'reserved',
    name: 'NULL',
    shape: 'rect',
    flexRatio: 0.9,
    badgeAlignClass: 'justify-center',
    color: {
      badgeBg: 'bg-slate-600',
      badgeText: 'text-white',
    },
  },
];

// 6대 세그먼트 사이의 5대 독립 경계선 기본 주소 (High ➔ Low)
// Stack ➔ [0] ➔ Heap ➔ [1] ➔ BSS ➔ [2] ➔ Data ➔ [3] ➔ Code ➔ [4] ➔ NULL
const DEFAULT_BOUNDARY_DIVIDERS = [
  '0x10008000', // [0] Stack과 Heap 사이 (Heap 최대 한계: 268,468,224)
  '0x10004000', // [1] Heap과 BSS 사이 (Heap 시작점: 268,451,840)
  '0x10000000', // [2] BSS와 Data 사이 (컴파일 전 미정)
  '0x10000000', // [3] Data와 Code 사이 (컴파일 전 미정)
  '0x00010000', // [4] Code와 NULL 사이 (Code 세그먼트 시작점: 65,536)
];

interface CodeSegmentSummary {
  userInstructions: Array<{ address: string; hexValue: string; decText: string; isChanged: boolean }>;
  runtimeInstructions: Array<{ address: string; hexValue: string; decText: string; isChanged: boolean }>;
  userRange: { start: string | null; end: string | null; count: number };
  startupRange: { start: string | null; end: string | null; count: number; bytes: number };
  maxCodePcNum: number;
}

const EMPTY_MEMORY_SNAPSHOT: Record<string, string> = {};

const MemorySegmentVisualizer: React.FC<MemorySegmentVisualizerProps> = ({
  currentData,
  prevData,
  simulationData,
  translationAssembly: _translationAssembly,
  playSpeed = 1000,
  cycle = 0,
}) => {
  const memorySnapshot = currentData?.global_result.memory_snapshot ?? EMPTY_MEMORY_SNAPSHOT;
  const prevMemorySnapshot = prevData?.global_result.memory_snapshot;
  const currentPc = currentData?.global_result.current_pc?.toLowerCase();
  const [isUserCodeExpanded, setIsUserCodeExpanded] = React.useState(true);

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
      const halfDuration = Math.max(120, Math.round(playSpeed * 0.5));
      const timer = window.setTimeout(() => {
        setPulsingAddresses((prev) => (prev.size === 0 ? prev : new Set()));
      }, halfDuration);

      return () => clearTimeout(timer);
    } else {
      setPulsingAddresses((prev) => (prev.size === 0 ? prev : new Set()));
    }
  }, [cycle, memorySnapshot, prevMemorySnapshot, playSpeed]);

  // 어셈블리 및 코드 세그먼트 메타데이터 추출: CORE가 제공하는 memory_layout 및 code_mapping을 최우선 SSOT로 사용
  const {
    userInstructions,
    runtimeInstructions,
    userRange,
    startupRange,
    maxCodePcNum,
  } = useMemo<CodeSegmentSummary>(() => {
    const layout = simulationData?.program?.memory_layout;
    const codeMapping = simulationData?.program?.code_mapping;

    // 1순위: CORE가 계산한 layout과 code_mapping이 모두 있는 경우 (단일 진실 공급원 SSOT)
    if (layout?.code && codeMapping && Object.keys(codeMapping).length > 0) {
      const userList: Array<{ address: string; hexValue: string; decText: string; isChanged: boolean }> = [];
      const runtimeList: Array<{ address: string; hexValue: string; decText: string; isChanged: boolean }> = [];

      // High ➔ Low (주소 내림차순 정렬)
      const sortedPcs = Object.keys(codeMapping).sort(
        (a, b) => (parseInt(b, 16) >>> 0) - (parseInt(a, 16) >>> 0)
      );

      sortedPcs.forEach((pcHex) => {
        const item = codeMapping[pcHex];
        const isCurrent = currentPc === pcHex.toLowerCase();
        const row = {
          address: pcHex,
          hexValue: item.raw_instruction || '0x00000000',
          decText: item.assembly || '',
          isChanged: isCurrent,
        };
        if (item.source_line !== undefined && item.source_line !== null) {
          userList.push(row);
        } else {
          runtimeList.push(row);
        }
      });

      const maxPc = parseInt(layout.code.end_exclusive, 16) - 4;

      return {
        userInstructions: userList,
        runtimeInstructions: runtimeList,
        userRange: {
          start: layout.code.user_program.start,
          end: layout.code.user_program.end,
          count: layout.code.user_program.instruction_count,
        },
        startupRange: {
          start: layout.code.runtime_startup.start,
          end: layout.code.runtime_startup.end,
          count: layout.code.runtime_startup.instruction_count,
          bytes: layout.code.runtime_startup.instruction_count * 4,
        },
        maxCodePcNum: maxPc,
      };
    }

    // 2순위: code_mapping만 있고 memory_layout이 없는 경우
    if (codeMapping && Object.keys(codeMapping).length > 0) {
      const userList: Array<{ address: string; hexValue: string; decText: string; isChanged: boolean }> = [];
      const runtimeList: Array<{ address: string; hexValue: string; decText: string; isChanged: boolean }> = [];

      const sortedPcs = Object.keys(codeMapping).sort(
        (a, b) => (parseInt(b, 16) >>> 0) - (parseInt(a, 16) >>> 0)
      );

      sortedPcs.forEach((pcHex) => {
        const item = codeMapping[pcHex];
        const isCurrent = currentPc === pcHex.toLowerCase();
        const row = {
          address: pcHex,
          hexValue: item.raw_instruction || '0x00000000',
          decText: item.assembly || '',
          isChanged: isCurrent,
        };
        if (item.source_line !== undefined && item.source_line !== null) {
          userList.push(row);
        } else {
          runtimeList.push(row);
        }
      });

      const ascUserPcs = userList.map((r) => r.address).reverse();
      const ascStartupPcs = runtimeList.map((r) => r.address).reverse();

      const userStart = ascUserPcs.length > 0 ? ascUserPcs[0] : null;
      const userEnd = ascUserPcs.length > 0 ? ascUserPcs[ascUserPcs.length - 1] : null;
      const startupStart = ascStartupPcs.length > 0 ? ascStartupPcs[0] : null;
      const startupEnd = ascStartupPcs.length > 0 ? ascStartupPcs[ascStartupPcs.length - 1] : null;
      const maxPc = sortedPcs.length > 0 ? parseInt(sortedPcs[0], 16) >>> 0 : 0;

      return {
        userInstructions: userList,
        runtimeInstructions: runtimeList,
        userRange: {
          start: userStart,
          end: userEnd,
          count: userList.length,
        },
        startupRange: {
          start: startupStart,
          end: startupEnd,
          count: runtimeList.length,
          bytes: runtimeList.length * 4,
        },
        maxCodePcNum: maxPc,
      };
    }

    // 3순위: 컴파일 전 초기 빈 화면 상태 (하드코딩 더미 범위 제거)
    return {
      userInstructions: [],
      runtimeInstructions: [],
      userRange: { start: null, end: null, count: 0 },
      startupRange: { start: null, end: null, count: 0, bytes: 0 },
      maxCodePcNum: 0,
    };
  }, [simulationData, currentPc]);

  // 메모리 6대 세그먼트별 분류 및 정렬 (모든 섹션 High ➔ Low 일치)
  const segmentedMemory = useMemo(() => {
    const layout = simulationData?.program?.memory_layout;
    const result: Record<
      MemorySegmentKey,
      Array<{
        address: string;
        hexValue: string;
        decText: string;
        isChanged: boolean;
        label?: string;
      }>
    > = {
      stack: [],
      heap: [],
      bss: [],
      data: [],
      code: [],
      reserved: [],
    };

    Object.entries(memorySnapshot).forEach(([addrHex, valHex]) => {
      const segKey = classifyAddress(addrHex, valHex, layout, maxCodePcNum);
      const prevVal = prevMemorySnapshot ? prevMemorySnapshot[addrHex] : undefined;
      const isChanged = prevVal !== undefined && prevVal !== valHex;

      let label: string | undefined;
      if (segKey === 'stack' && addrHex.toLowerCase() === '0x7fffeffc') {
        label = 'Init SP';
      }

      result[segKey].push({
        address: addrHex,
        hexValue: valHex,
        decText: formatSignedDecimal(valHex),
        isChanged,
        label,
      });
    });

    // Code 항목: 전체 명령어 수용
    result.code = [...userInstructions, ...runtimeInstructions];

    // 모든 세그먼트 일관되게 주소 내림차순(High ➔ Low) 정렬
    result.stack.sort((a, b) => (parseInt(b.address, 16) >>> 0) - (parseInt(a.address, 16) >>> 0));
    result.heap.sort((a, b) => (parseInt(b.address, 16) >>> 0) - (parseInt(a.address, 16) >>> 0));
    result.bss.sort((a, b) => (parseInt(b.address, 16) >>> 0) - (parseInt(a.address, 16) >>> 0));
    result.data.sort((a, b) => (parseInt(b.address, 16) >>> 0) - (parseInt(a.address, 16) >>> 0));

    return result;
  }, [memorySnapshot, prevMemorySnapshot, simulationData, maxCodePcNum, userInstructions, runtimeInstructions]);

  // 동적 세그먼트 경계선 주소 계산 (High ➔ Low)
  // [0] Stack ➔ Heap: 현재 $sp (유효할 경우) 또는 기본 Heap 한계선 0x10008000
  // [1] Heap ➔ BSS: 기본 0x10004000
  // [2] BSS ➔ Data: 컴파일 전 '—' (컴파일 후 CORE memory_layout boundary_dividers[2])
  // [3] Data ➔ Code: 컴파일 전 '—' (컴파일 후 CORE memory_layout boundary_dividers[3])
  // [4] Code ➔ NULL: Code 세그먼트 기준점 0x00010000 (65,536) - 규격상 고정
  const boundaryDividers = useMemo(() => {
    const layout = simulationData?.program?.memory_layout;
    const isCompiled = Boolean(layout || (userRange.count > 0));

    const spVal =
      currentData?.global_result?.active_stack_pointer ||
      currentData?.global_result?.registers?.['x2'] ||
      currentData?.global_result?.registers?.['sp'];
    const stackHeapDivider =
      spVal && spVal !== '0x00000000' && spVal.toLowerCase() !== '0x7fffeffc'
        ? spVal
        : layout?.boundary_dividers?.[0] || DEFAULT_BOUNDARY_DIVIDERS[0];

    const heapBssDivider = layout?.boundary_dividers?.[1] || DEFAULT_BOUNDARY_DIVIDERS[1];
    const bssDataDivider: string = isCompiled
      ? (layout?.boundary_dividers?.[2] || DEFAULT_BOUNDARY_DIVIDERS[2])
      : '—';
    const dataCodeDivider: string = isCompiled
      ? (layout?.boundary_dividers?.[3] || DEFAULT_BOUNDARY_DIVIDERS[3])
      : '—';
    const codeNullDivider: string = layout?.boundary_dividers?.[4] || DEFAULT_BOUNDARY_DIVIDERS[4];

    return [stackHeapDivider, heapBssDivider, bssDataDivider, dataCodeDivider, codeNullDivider];
  }, [currentData, simulationData, userRange.count]);

  return (
    <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg border border-[var(--ar-border)] flex flex-col min-h-0 overflow-hidden select-none font-mono text-[var(--ar-text-primary)] shadow-sm transition-colors duration-150">
      {/* 1. 상단 미니멀 헤더 (레지스터 뷰와 통일된 VS Code VARIABLES 스타일) */}
      <div className="shrink-0 flex items-center justify-between px-3.5 py-1.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 border-l-2 border-l-yellow-500 font-sans">
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
        {/* 2. 최상단 시작 주소 헤더 바 */}
        <div className="shrink-0 flex flex-col mb-1">
          <div className="flex items-center justify-between text-[10px] text-[#57606A] dark:text-[#858585] font-mono pb-1 px-0.5">
            <span
              title="Hex: 0x7FFFEFFC"
              className="font-semibold text-[#24292F] dark:text-[#CCCCCC] cursor-help"
            >
            {formatAddressDecimal('0x7FFFEFFC')}
          </span>
          <span className="text-[#8C959F] dark:text-[#6E7681]">High Address (Top)</span>
        </div>
        <div className="w-full border-t border-[#E5E5E5] dark:border-[#333333]" />
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

                {/* 우측: 데이터 리스트 */}
                <div className={`flex-1 flex flex-col divide-y divide-slate-100 min-w-0 pl-1.5 py-1 overflow-y-auto custom-scrollbar ${
                  items.length === 0 && !isCode && !isReserved ? 'justify-center' : 'justify-start'
                }`}>
                  {isReserved ? (
                    <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 text-slate-500">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-500 font-semibold text-[10.5px]">
                          0 ~ 65,535
                        </span>
                        <span className="text-[9px] font-mono text-slate-400">64KB</span>
                      </div>
                      <span className="font-sans text-[9.5px] text-slate-400 leading-tight">
                        NULL Pointer Guard (접근 금지 보호 구역)
                      </span>
                    </div>
                  ) : isCode ? (
                    <div className="flex flex-col gap-1.5 py-0.5">
                      {/* 1. 사용자 프로그램 메인 코드 통합 블록 (세로 스택 최적화) */}
                      <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-1.5 shadow-2xs flex flex-col gap-1">
                        {/* 1층: 주소 범위 & 뱃지 */}
                        <div className="flex items-center justify-between gap-1">
                          <span
                            title={
                              userRange.start && userRange.end
                                ? `Hex: ${normalizeHex(userRange.start)} ~ ${normalizeHex(userRange.end)}`
                                : undefined
                            }
                            className="text-[11px] font-bold text-amber-950 font-mono tracking-tight cursor-help"
                          >
                            {userRange.start && userRange.end
                              ? `${formatAddressDecimal(userRange.start)} ~ ${formatAddressDecimal(userRange.end)}`
                              : '— ~ —'}
                          </span>
                          <span className="text-[9px] px-1 py-0.2 rounded font-sans font-bold bg-amber-200 text-amber-800 shrink-0">
                            {userRange.count > 0 ? `${userRange.count} instrs` : '컴파일 대기'}
                          </span>
                        </div>

                        {/* 2층: 영역 라벨 & 명령어 토글 버튼 */}
                        <div className="flex items-center justify-between gap-1 text-[10px]">
                          <span className="font-semibold text-amber-900 font-sans">
                            User Program (main)
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsUserCodeExpanded(!isUserCodeExpanded)}
                            className="text-[9.5px] font-medium text-amber-700 hover:text-amber-900 bg-amber-100/90 hover:bg-amber-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors shrink-0"
                          >
                            {isUserCodeExpanded ? '닫기 ▲' : '명령어 ▼'}
                          </button>
                        </div>

                        {/* 3층: 현재 실행 중인 PC 위치 (라벨 위, 값 아래 또는 좌우 콤팩트 배치) */}
                        <div className="flex items-center justify-between text-[9.5px] border-t border-amber-200/60 pt-1">
                          <span className="text-slate-500 font-sans">Current PC</span>
                          <span className="font-mono font-bold text-amber-950">
                            {currentPc ? formatAddressDecimal(currentPc) : '—'}
                          </span>
                        </div>

                        {/* 펼쳤을 때: 명령어 리스트 (사용자 프로그램 코드만 전용 표시) */}
                        {isUserCodeExpanded && (
                          <div className="mt-1 border-t border-amber-200/80 pt-1 divide-y divide-amber-100 max-h-32 overflow-y-auto custom-scrollbar">
                            {userInstructions.length === 0 ? (
                              <div className="text-[10px] text-amber-800/60 font-sans italic py-2 text-center">
                                컴파일 후 명령어가 로드됩니다.
                              </div>
                            ) : (
                              userInstructions.map((item) => (
                                <div
                                  key={item.address}
                                  className={`flex items-center justify-between px-1 py-0.5 rounded text-[10px] font-mono ${
                                    item.isChanged
                                      ? 'bg-amber-200/80 text-amber-950 font-bold'
                                      : 'text-slate-700 hover:bg-amber-100/50'
                                  }`}
                                >
                                  <span>{formatAddressDecimal(item.address)}</span>
                                  <span className="font-semibold text-indigo-950">{item.decText}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* 2. C 런타임 스타트업 영역 (세로 스택 최적화) */}
                      <div className="flex flex-col gap-0.5 px-1.5 py-1 rounded-lg border border-dashed border-slate-200 bg-slate-50/80">
                        <div className="flex items-center justify-between">
                          <span
                            title={
                              startupRange.start && startupRange.end
                                ? `Hex: ${normalizeHex(startupRange.start)} ~ ${normalizeHex(startupRange.end)} (${startupRange.bytes} Bytes)`
                                : undefined
                            }
                            className="font-mono text-slate-600 font-semibold text-[10.5px] cursor-help"
                          >
                            {startupRange.start && startupRange.end
                              ? `${formatAddressDecimal(startupRange.start)} ~ ${formatAddressDecimal(startupRange.end)}`
                              : '— ~ —'}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">
                            {startupRange.bytes > 0 ? `${startupRange.bytes}B` : '—B'}
                          </span>
                        </div>
                        <span className="font-sans text-[9.5px] text-slate-400 leading-tight">
                          System Runtime Startup (_start)
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
                      const isStack = seg.key === 'stack';

                      return (
                        <div
                          key={item.address}
                          className={`flex items-center justify-between px-2 py-1 rounded transition-colors duration-150 shrink-0 ${
                            isPulsing
                              ? isStack
                                ? 'bg-violet-200 dark:bg-violet-950/70 text-violet-950 dark:text-violet-200 font-bold'
                                : 'bg-amber-200/95 dark:bg-amber-950/70 text-amber-950 dark:text-amber-200 font-bold'
                              : 'bg-white dark:bg-[#1E1E1E] hover:bg-[#F6F8FA] dark:hover:bg-[#2A2D2E] text-[#24292F] dark:text-[#CCCCCC]'
                          }`}
                        >
                          {/* 좌측 주소 (10진수 고정 + 호버 시 16진수) */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              title={`Hex: ${normalizeHex(item.address)}`}
                              className={`text-[11px] font-mono font-medium cursor-help ${
                                isPulsing
                                  ? isStack
                                    ? 'text-violet-950 dark:text-violet-200 font-bold'
                                    : 'text-amber-950 dark:text-amber-200 font-bold'
                                  : 'text-[#57606A] dark:text-[#858585]'
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

                          {/* 우측 값 */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`font-mono text-[11.5px] tracking-wide ${
                                isPulsing
                                  ? isStack
                                    ? 'text-violet-950 dark:text-violet-200 font-black'
                                    : 'text-amber-950 dark:text-amber-200 font-black'
                                  : isCode
                                  ? 'text-indigo-950 dark:text-[#9CDCFE] font-semibold'
                                  : 'text-[#1F2328] dark:text-[#CCCCCC] font-medium'
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

      {/* 4. 최하단 메모리 끝 경계선 */}
      <div className="shrink-0 flex flex-col pt-1 mt-1">
        <div className="w-full border-t border-[#E5E5E5] dark:border-[#333333] mb-1" />
        <div className="flex items-center justify-between text-[10px] text-[#57606A] dark:text-[#858585] font-mono px-0.5">
          <span
            title="Hex: 0x00000000"
            className="font-semibold text-[#24292F] dark:text-[#CCCCCC] cursor-help"
          >
            0
          </span>
          <span className="text-[#8C959F] dark:text-[#6E7681]">Low Address (Origin)</span>
        </div>
      </div>
      </div>
    </div>
  );
};

export default MemorySegmentVisualizer;
