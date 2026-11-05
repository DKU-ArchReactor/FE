import React, { useMemo } from 'react';
import type { CycleHistoryItem, SimulationResult } from '@/type/simulation';
import { mapAssembly } from './translationCompile';

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

// 주소 분류: 6대 세그먼트 (Stack, Heap, BSS, Data, Code, Reserved/NULL)
const classifyAddress = (addrHex: string, valHex: string, maxCodePcNum: number): MemorySegmentKey => {
  const num = parseInt(addrHex, 16) >>> 0;
  if (num >= 0x70000000) return 'stack';
  if (num >= 0x10008000) return 'heap';
  if (num >= 0x00010000 && num <= maxCodePcNum) return 'code';
  if (num < 0x00010000) return 'reserved';
  // 0x10000000 ~ 0x10007FFF 영역:
  const valNum = parseInt(valHex, 16) || 0;
  if (valNum === 0) return 'bss';
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

// 6대 세그먼트 사이의 5대 독립 경계선 주소 (High ➔ Low)
// Stack ➔ [1] ➔ Heap ➔ [2] ➔ BSS ➔ [3] ➔ Data ➔ [4] ➔ Code ➔ [5] ➔ NULL
const BOUNDARY_DIVIDERS = [
  '0x10008000', // [1] Stack과 Heap 사이 (Heap 시작점: 268,468,224)
  '0x10004000', // [2] Heap과 BSS 사이 (BSS 시작점: 268,451,840)
  '0x10000000', // [3] BSS와 Data 사이 (Data 시작점: 268,435,456)
  '0x00010000', // [4] Data와 Code 사이 (Code 시작점: 65,536)
  '0x00000000', // [5] Code와 NULL 사이 (NULL 기준점: 0)
];

const EMPTY_MEMORY_SNAPSHOT: Record<string, string> = {};

const MemorySegmentVisualizer: React.FC<MemorySegmentVisualizerProps> = ({
  currentData,
  prevData,
  simulationData,
  translationAssembly,
  playSpeed = 1000,
  cycle = 0,
}) => {
  const memorySnapshot = currentData?.global_result.memory_snapshot ?? EMPTY_MEMORY_SNAPSHOT;
  const prevMemorySnapshot = prevData?.global_result.memory_snapshot;
  const currentPc = currentData?.global_result.current_pc?.toLowerCase();
  const [isUserCodeExpanded, setIsUserCodeExpanded] = React.useState(false);

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

  // 어셈블리 컴포넌트(Section 2)에 들어가는 코드 라인들을 추출하여 Code 메모리 세그먼트에 매핑
  const { codeMap, maxCodePcNum, codeCount, minCodePc, maxCodePc } = useMemo(() => {
    const map: Record<string, { raw: string; asm: string }> = {};
    let minPc = 0x00010018; // 65,560
    let maxPc = 0x00010018;

    // 1. translationAssembly가 있으면 Section 2와 100% 동일한 어셈블리 명령어 추출
    if (translationAssembly) {
      const mappedRows = mapAssembly(translationAssembly, 1000);
      const basePc = 0x00010018; // 65,560 (main 시작 지점)
      minPc = basePc;
      mappedRows.forEach((row, idx) => {
        const pcNum = basePc + idx * 4;
        const pcHex = `0x${pcNum.toString(16).padStart(8, '0')}`;
        map[pcHex.toLowerCase()] = {
          raw: '0x00000000',
          asm: row.text,
        };
      });
      maxPc = basePc + Math.max(0, mappedRows.length - 1) * 4;
      return {
        codeMap: map,
        maxCodePcNum: maxPc,
        codeCount: mappedRows.length,
        minCodePc: minPc,
        maxCodePc: maxPc,
      };
    }

    // 2. translationAssembly가 없을 때는 기존 파이프라인 버퍼 히스토리 폴백
    let calcMax = 0x0001017f;
    if (simulationData?.history) {
      simulationData.history.forEach((cycle) => {
        const stages = [
          cycle.buffers?.IF,
          cycle.buffers?.ID,
          cycle.buffers?.EX,
          cycle.buffers?.MEM,
          cycle.buffers?.WB,
        ];
        stages.forEach((buf) => {
          if (buf?.pc && buf.assembly && buf.assembly !== 'bubble' && buf.assembly !== 'empty') {
            const pcLower = buf.pc.toLowerCase();
            map[pcLower] = {
              raw: buf.raw_instruction || '0x00000000',
              asm: buf.assembly,
            };
            const num = parseInt(pcLower, 16) >>> 0;
            if (!isNaN(num) && num < 0x00010180 && num > calcMax) {
              calcMax = num;
            }
          }
        });
      });
    }
    const keys = Object.keys(map);
    return {
      codeMap: map,
      maxCodePcNum: calcMax,
      codeCount: keys.length,
      minCodePc: 0x00010018,
      maxCodePc: calcMax,
    };
  }, [translationAssembly, simulationData]);

  // 메모리 6대 세그먼트별 분류 및 정렬 (모든 섹션 High ➔ Low 일치)
  const segmentedMemory = useMemo(() => {
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
      const segKey = classifyAddress(addrHex, valHex, maxCodePcNum);
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

    // Code 영역 추출: High ➔ Low (내림차순 정렬) 적용
    // 이렇게 하면 main() 시작점인 65,560이 맨 아래(NULL 경계선 바로 위)에 위치하고 위로 갈수록 주소가 증가함!
    const codeAddresses = Object.keys(codeMap).sort(
      (a, b) => (parseInt(b, 16) >>> 0) - (parseInt(a, 16) >>> 0)
    );
    codeAddresses.forEach((addrHex) => {
      const info = codeMap[addrHex];
      const isCurrentPc = currentPc === addrHex;
      result.code.push({
        address: addrHex,
        hexValue: info.raw,
        decText: info.asm,
        isChanged: isCurrentPc,
        label: isCurrentPc ? 'PC ▶' : undefined,
      });
    });

    // 모든 세그먼트 일관되게 주소 내림차순(High ➔ Low) 정렬
    result.stack.sort((a, b) => (parseInt(b.address, 16) >>> 0) - (parseInt(a.address, 16) >>> 0));
    result.heap.sort((a, b) => (parseInt(b.address, 16) >>> 0) - (parseInt(a.address, 16) >>> 0));
    result.bss.sort((a, b) => (parseInt(b.address, 16) >>> 0) - (parseInt(a.address, 16) >>> 0));
    result.data.sort((a, b) => (parseInt(b.address, 16) >>> 0) - (parseInt(a.address, 16) >>> 0));

    return result;
  }, [memorySnapshot, prevMemorySnapshot, codeMap, maxCodePcNum, currentPc]);

  return (
    <div className="flex-1 bg-white dark:bg-[#1E1E1E] rounded-md shadow-2xs border border-[#E5E5E5] dark:border-[#333333] flex flex-col min-h-0 overflow-hidden select-none transition-colors duration-150">
      {/* 1. 상단 미니멀 헤더 */}
      <div className="shrink-0 flex items-center justify-between px-3.5 py-1.5 bg-[#F3F3F3] dark:bg-[#252526] border-b border-[#E5E5E5] dark:border-[#333333] min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs">💾</span>
          <h3 className="text-xs font-semibold text-[#1F2328] dark:text-[#CCCCCC] whitespace-nowrap">Virtual Memory</h3>
        </div>
        <span className="text-[10px] font-mono text-[#57606A] dark:text-[#858585] font-semibold">High ➔ Low</span>
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
          const dividerHex = index < BOUNDARY_DIVIDERS.length ? BOUNDARY_DIVIDERS[index] : null;

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
                            title={`Hex: ${normalizeHex(`0x${minCodePc.toString(16)}`)} ~ ${normalizeHex(`0x${maxCodePc.toString(16)}`)}`}
                            className="text-[11px] font-bold text-amber-950 font-mono tracking-tight cursor-help"
                          >
                            {minCodePc.toLocaleString()} ~ {maxCodePc.toLocaleString()}
                          </span>
                          <span className="text-[9px] px-1 py-0.2 rounded font-sans font-bold bg-amber-200 text-amber-800 shrink-0">
                            {codeCount} instrs
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
                            {currentPc ? formatAddressDecimal(currentPc) : '-'}
                          </span>
                        </div>

                        {/* 펼쳤을 때: 명령어 리스트 */}
                        {isUserCodeExpanded && (
                          <div className="mt-1 border-t border-amber-200/80 pt-1 divide-y divide-amber-100 max-h-32 overflow-y-auto custom-scrollbar">
                            {items.map((item) => (
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
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 2. C 런타임 스타트업 영역 (세로 스택 최적화) */}
                      <div className="flex flex-col gap-0.5 px-1.5 py-1 rounded-lg border border-dashed border-slate-200 bg-slate-50/80">
                        <div className="flex items-center justify-between">
                          <span
                            title="Hex: 0x00010000 ~ 0x00010017 (24 Bytes)"
                            className="font-mono text-slate-600 font-semibold text-[10.5px] cursor-help"
                          >
                            65,536 ~ 65,559
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">24B</span>
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
                      title={`Hex: ${normalizeHex(dividerHex)}`}
                      className="font-semibold text-[#57606A] dark:text-[#858585] cursor-help"
                    >
                      {formatAddressDecimal(dividerHex)}
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
