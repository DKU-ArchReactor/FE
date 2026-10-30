import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { CycleHistoryItem, SimulationResult } from '@/type/simulation';

interface StateVisualizerProps {
  currentData: CycleHistoryItem | null;
  prevData: CycleHistoryItem | null;
  simulationData: SimulationResult | null;
}

interface RegisterMeta {
  abi: string;
  desc?: string;
  isPreset?: boolean;
  presetTag?: string;
}

const REGISTER_METAS: Record<string, RegisterMeta> = {
  x0: { abi: 'zero', desc: 'Hardwired 0 (항상 0 고정)', isPreset: true, presetTag: 'Fixed 0' },
  x1: { abi: 'ra', desc: 'Return Address (함수 반환 주소)' },
  x2: { abi: 'sp', desc: 'Stack Pointer (초기 스택 포인터: 0x7FFFEFFC)', isPreset: true, presetTag: 'Init SP' },
  x3: { abi: 'gp', desc: 'Global Pointer (전역 포인터)' },
  x4: { abi: 'tp', desc: 'Thread Pointer (스레드 포인터)' },
  x5: { abi: 't0', desc: 'Temporary (임시)' },
  x6: { abi: 't1', desc: 'Temporary (임시)' },
  x7: { abi: 't2', desc: 'Temporary (임시)' },
  x8: { abi: 's0', desc: 'Saved register / Frame Pointer' },
  x9: { abi: 's1', desc: 'Saved register' },
  x10: { abi: 'a0', desc: 'Function argument / Return value' },
  x11: { abi: 'a1', desc: 'Function argument / Return value' },
  x12: { abi: 'a2', desc: 'Function argument' },
  x13: { abi: 'a3', desc: 'Function argument' },
  x14: { abi: 'a4', desc: 'Function argument' },
  x15: { abi: 'a5', desc: 'Function argument / Temp' },
  x16: { abi: 'a6', desc: 'Function argument' },
  x17: { abi: 'a7', desc: 'Function argument' },
  x18: { abi: 's2', desc: 'Saved register' },
  x19: { abi: 's3', desc: 'Saved register' },
  x20: { abi: 's4', desc: 'Saved register' },
  x21: { abi: 's5', desc: 'Saved register' },
  x22: { abi: 's6', desc: 'Saved register' },
  x23: { abi: 's7', desc: 'Saved register' },
  x24: { abi: 's8', desc: 'Saved register' },
  x25: { abi: 's9', desc: 'Saved register' },
  x26: { abi: 's10', desc: 'Saved register' },
  x27: { abi: 's11', desc: 'Saved register' },
  x28: { abi: 't3', desc: 'Temporary' },
  x29: { abi: 't4', desc: 'Temporary' },
  x30: { abi: 't5', desc: 'Temporary' },
  x31: { abi: 't6', desc: 'Temporary' },
};

// ABI 이름 -> x레지스터 키 변환 맵
const ABI_TO_REG: Record<string, string> = {
  fp: 'x8',
};
Object.entries(REGISTER_METAS).forEach(([regKey, meta]) => {
  ABI_TO_REG[meta.abi] = regKey;
  ABI_TO_REG[regKey] = regKey;
});

type MemorySegmentKey = 'stack' | 'heap' | 'data' | 'code';

interface MemoryEntryItem {
  address: string;
  hexValue: string;
  decText: string;
  asciiHint?: string;
  isChanged: boolean;
  isAccessed: boolean;
  label?: string;
}

interface TransferActivity {
  type: 'load' | 'store';
  stage: 'EX' | 'MEM' | 'WB';
  instruction: string;
  regKey: string;
  abiName: string;
  targetAddress: string;
  segment: MemorySegmentKey;
  valueHex: string;
}

const formatSignedDecimal = (hexStr: string): string => {
  const num = parseInt(hexStr, 16);
  if (isNaN(num)) return '0';
  const signed = num | 0;
  return signed.toLocaleString();
};

const extractPrintableAscii = (hexStr: string): string | undefined => {
  const clean = hexStr.replace(/^0x/i, '').padStart(8, '0');
  if (clean === '00000000') return undefined;
  const chars: string[] = [];
  // Little-endian 바이트 순서로 추출
  for (let i = 6; i >= 0; i -= 2) {
    const code = parseInt(clean.slice(i, i + 2), 16);
    if (code >= 32 && code <= 126) {
      chars.push(String.fromCharCode(code));
    }
  }
  return chars.length >= 2 ? `"${chars.join('')}"` : undefined;
};

const classifyAddress = (addrHex: string, maxCodePcNum: number): MemorySegmentKey => {
  const num = parseInt(addrHex, 16) >>> 0;
  if (num >= 0x70000000) return 'stack';
  if (num >= 0x10000000) return 'heap';
  if (num <= maxCodePcNum) return 'code';
  return 'data';
};

const SEGMENT_META: Record<
  MemorySegmentKey,
  {
    title: string;
    subtitle: string;
    rangeLabel: string;
    directionBadge?: string;
    borderClass: string;
    bgClass: string;
    activeBgClass: string;
    activeBorderClass: string;
    badgeClass: string;
    textClass: string;
  }
> = {
  stack: {
    title: 'Stack 영역',
    subtitle: '지역 변수 · 복귀 주소(ra) · 함수 프레임',
    rangeLabel: '0x7FFF_EFFC ↓',
    directionBadge: '↓ 아래로 확장',
    borderClass: 'border-violet-200 hover:border-violet-400',
    bgClass: 'bg-violet-50/60',
    activeBgClass: 'bg-violet-200/90',
    activeBorderClass: 'border-violet-500 shadow-sm',
    badgeClass: 'bg-violet-600 text-white',
    textClass: 'text-violet-900',
  },
  heap: {
    title: 'Heap 영역',
    subtitle: '동적 할당 데이터 공간',
    rangeLabel: '0x1000_0000 ↑',
    directionBadge: '↑ 위로 확장',
    borderClass: 'border-emerald-200 hover:border-emerald-400',
    bgClass: 'bg-emerald-50/50',
    activeBgClass: 'bg-emerald-200/90',
    activeBorderClass: 'border-emerald-500 shadow-sm',
    badgeClass: 'bg-emerald-600 text-white',
    textClass: 'text-emerald-900',
  },
  data: {
    title: 'Data 영역 (.data / .rodata)',
    subtitle: '전역 · 정적 변수 및 문자열 상수',
    rangeLabel: '0x0001_0180 ~',
    borderClass: 'border-amber-200 hover:border-amber-400',
    bgClass: 'bg-amber-50/60',
    activeBgClass: 'bg-amber-200/90',
    activeBorderClass: 'border-amber-500 shadow-sm',
    badgeClass: 'bg-amber-500 text-white',
    textClass: 'text-amber-900',
  },
  code: {
    title: 'Code 영역 (.text)',
    subtitle: '컴파일된 RISC-V 기계어 명령어',
    rangeLabel: '0x0001_0000 ~',
    borderClass: 'border-sky-200 hover:border-sky-400',
    bgClass: 'bg-sky-50/60',
    activeBgClass: 'bg-sky-200/90',
    activeBorderClass: 'border-sky-500 shadow-sm',
    badgeClass: 'bg-sky-600 text-white',
    textClass: 'text-sky-900',
  },
};

const StateVisualizer: React.FC<StateVisualizerProps> = ({
  currentData,
  prevData,
  simulationData,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoHorizontal, setAutoHorizontal] = useState<boolean>(true);
  const [manualLayout, setManualLayout] = useState<'auto' | 'horizontal' | 'vertical'>('auto');
  const [onlyNonZero, setOnlyNonZero] = useState<boolean>(false);
  const [hoveredSegment, setHoveredSegment] = useState<MemorySegmentKey | null>(null);
  const [pinnedSegment, setPinnedSegment] = useState<MemorySegmentKey | null>(null);

  // 가로/세로 비율 실시간 감지 (ResizeObserver)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          // 가로가 세로보다 1.15배 이상 넓고 최소 폭이 460px 이상이면 좌우(가로형) 배치
          setAutoHorizontal(width >= height * 1.15 && width >= 460);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isHorizontal =
    manualLayout === 'auto' ? autoHorizontal : manualLayout === 'horizontal';

  const registers = currentData?.global_result.registers || {};
  const prevRegisters = prevData?.global_result.registers;
  const memorySnapshot = currentData?.global_result.memory_snapshot || {};
  const prevMemorySnapshot = prevData?.global_result.memory_snapshot;
  const currentPc = currentData?.global_result.current_pc?.toLowerCase();

  // 시뮬레이션 히스토리에서 Code 영역 명령어들 추출
  const { codeMap, maxCodePcNum } = useMemo(() => {
    const map: Record<string, { raw: string; asm: string }> = {};
    let maxPc = 0x0001017f;
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
            if (!isNaN(num) && num < 0x00010180 && num > maxPc) {
              maxPc = num;
            }
          }
        });
      });
    }
    return { codeMap: map, maxCodePcNum: maxPc };
  }, [simulationData]);

  // 현재 사이클 Load / Store 이동 활동 감지
  const transferActivity: TransferActivity | null = useMemo(() => {
    if (!currentData?.buffers) return null;

    const candidates: { stage: 'MEM' | 'WB' | 'EX'; inst?: string }[] = [
      { stage: 'MEM', inst: currentData.buffers.MEM?.assembly },
      { stage: 'WB', inst: currentData.buffers.WB?.assembly },
      { stage: 'EX', inst: currentData.buffers.EX?.assembly },
    ];

    for (const { stage, inst } of candidates) {
      if (!inst || inst === 'bubble' || inst === 'empty') continue;
      const trimmed = inst.trim();

      const match = trimmed.match(
        /^(lw|lh|lb|lhu|lbu|sw|sh|sb)\s+([a-zA-Z0-9]+)\s*,\s*(-?\d+)\s*\(([a-zA-Z0-9]+)\)/i
      );
      if (match) {
        const op = match[1].toLowerCase();
        const isLoad = op.startsWith('l');
        const targetRegToken = match[2].toLowerCase();
        const offset = parseInt(match[3], 10);
        const baseRegToken = match[4].toLowerCase();

        const regKey = ABI_TO_REG[targetRegToken] || 'x0';
        const baseRegKey = ABI_TO_REG[baseRegToken] || 'x2';
        const meta = REGISTER_METAS[regKey] || { abi: regKey };

        const baseValHex = registers[baseRegKey] || '0x7fffeffc';
        const baseValNum = parseInt(baseValHex, 16) >>> 0;
        const effectiveAddrNum = (baseValNum + offset) >>> 0;
        const targetAddress = `0x${effectiveAddrNum.toString(16).padStart(8, '0')}`;
        const segment = classifyAddress(targetAddress, maxCodePcNum);

        const valueHex = isLoad
          ? memorySnapshot[targetAddress] || registers[regKey] || '0x00000000'
          : registers[regKey] || memorySnapshot[targetAddress] || '0x00000000';

        return {
          type: isLoad ? 'load' : 'store',
          stage,
          instruction: trimmed,
          regKey,
          abiName: meta.abi,
          targetAddress,
          segment,
          valueHex,
        };
      }
    }
    return null;
  }, [currentData, registers, memorySnapshot, maxCodePcNum]);

  // 메모리 4개 영역별 데이터 분류
  const segmentedMemory = useMemo(() => {
    const result: Record<MemorySegmentKey, MemoryEntryItem[]> = {
      stack: [],
      heap: [],
      data: [],
      code: [],
    };

    const spValNum = parseInt(registers['x2'] || '0x7fffeffc', 16) >>> 0;

    // 1. memorySnapshot 엔트리 분류
    Object.entries(memorySnapshot).forEach(([addr, val]) => {
      const addrLower = addr.toLowerCase();
      const seg = classifyAddress(addrLower, maxCodePcNum);
      const prevVal = prevMemorySnapshot ? prevMemorySnapshot[addr] : undefined;
      const isChanged = prevVal !== undefined && prevVal !== val;
      const isAccessed = transferActivity?.targetAddress.toLowerCase() === addrLower;

      let label: string | undefined;
      if (seg === 'stack') {
        const addrNum = parseInt(addrLower, 16) >>> 0;
        const diff = addrNum - spValNum;
        if (diff === 0) label = '← SP';
        else if (diff > 0 && diff <= 256) label = `sp+${diff}`;
        else if (diff < 0 && diff >= -256) label = `sp${diff}`;
      }

      result[seg].push({
        address: addrLower,
        hexValue: val,
        decText: formatSignedDecimal(val),
        asciiHint: seg === 'data' ? extractPrintableAscii(val) : undefined,
        isChanged,
        isAccessed,
        label,
      });
    });

    // Store/Load 중인 주소가 아직 스냅샷에 없을 경우에도 시각화를 위해 표시
    if (transferActivity) {
      const targetAddrLower = transferActivity.targetAddress.toLowerCase();
      const seg = transferActivity.segment;
      const exists = result[seg].some((item) => item.address === targetAddrLower);
      if (!exists) {
        result[seg].push({
          address: targetAddrLower,
          hexValue: transferActivity.valueHex,
          decText: formatSignedDecimal(transferActivity.valueHex),
          isChanged: transferActivity.type === 'store',
          isAccessed: true,
          label: transferActivity.type === 'store' ? 'Store 대상' : 'Load 대상',
        });
      }
    }

    // 2. Code 영역 채우기 (시뮬레이션 명령어 테이블)
    Object.entries(codeMap).forEach(([pc, info]) => {
      if (!result.code.some((item) => item.address === pc)) {
        result.code.push({
          address: pc,
          hexValue: info.raw,
          decText: info.asm,
          isChanged: false,
          isAccessed: currentPc === pc,
          label: currentPc === pc ? '← PC' : undefined,
        });
      }
    });

    // 주소 정렬 (Stack은 위에서 아래로 높은 주소 -> 낮은 주소, 나머지는 오름차순)
    result.stack.sort((a, b) => (parseInt(b.address, 16) >>> 0) - (parseInt(a.address, 16) >>> 0));
    result.heap.sort((a, b) => (parseInt(a.address, 16) >>> 0) - (parseInt(b.address, 16) >>> 0));
    result.data.sort((a, b) => (parseInt(a.address, 16) >>> 0) - (parseInt(b.address, 16) >>> 0));
    result.code.sort((a, b) => (parseInt(a.address, 16) >>> 0) - (parseInt(b.address, 16) >>> 0));

    return result;
  }, [memorySnapshot, prevMemorySnapshot, registers, codeMap, maxCodePcNum, transferActivity, currentPc]);

  // 기존 RegisterVisualizer와 동일한 레지스터 키 및 스마트 정렬
  const regKeys = useMemo(() => Array.from({ length: 32 }, (_, i) => `x${i}`), []);

  const sortedRegKeys = useMemo(() => {
    return [...regKeys].sort((a, b) => {
      const valA = registers[a] || '0x00000000';
      const valB = registers[b] || '0x00000000';
      const hasValA = valA !== '0x00000000';
      const hasValB = valB !== '0x00000000';

      if (hasValA && !hasValB) return -1;
      if (!hasValA && hasValB) return 1;

      const numA = parseInt(a.slice(1), 10);
      const numB = parseInt(b.slice(1), 10);
      return numA - numB;
    });
  }, [regKeys, registers]);

  const filteredRegKeys = useMemo(() => {
    return onlyNonZero
      ? sortedRegKeys.filter((k) => registers[k] && registers[k] !== '0x00000000')
      : sortedRegKeys;
  }, [onlyNonZero, sortedRegKeys, registers]);

  const activeRegCount = useMemo(() => {
    return regKeys.filter((k) => registers[k] && registers[k] !== '0x00000000').length;
  }, [regKeys, registers]);

  const activeSegmentKey = hoveredSegment || pinnedSegment;

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-3 flex flex-col min-h-0 overflow-hidden relative"
    >
      {/* 애니메이션 키프레임 */}
      <style>{`
        @keyframes packetRight {
          0% { transform: translateX(-18px); opacity: 0.3; }
          50% { opacity: 1; }
          100% { transform: translateX(18px); opacity: 0.3; }
        }
        @keyframes packetLeft {
          0% { transform: translateX(18px); opacity: 0.3; }
          50% { opacity: 1; }
          100% { transform: translateX(-18px); opacity: 0.3; }
        }
        @keyframes packetDown {
          0% { transform: translateY(-10px); opacity: 0.3; }
          50% { opacity: 1; }
          100% { transform: translateY(10px); opacity: 0.3; }
        }
        @keyframes packetUp {
          0% { transform: translateY(10px); opacity: 0.3; }
          50% { opacity: 1; }
          100% { transform: translateY(-10px); opacity: 0.3; }
        }
        .anim-packet-right { animation: packetRight 1s ease-in-out infinite; }
        .anim-packet-left { animation: packetLeft 1s ease-in-out infinite; }
        .anim-packet-down { animation: packetDown 1s ease-in-out infinite; }
        .anim-packet-up { animation: packetUp 1s ease-in-out infinite; }
      `}</style>

      {/* 상단 통합 헤더 바 */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span>🗄️</span>
            <span>레지스터 & 메모리 아키텍처 뷰</span>
          </h3>
          {transferActivity && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse ${
                transferActivity.type === 'store'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-cyan-100 text-cyan-800 border border-cyan-300'
              }`}
            >
              <span>{transferActivity.type === 'store' ? '📤 STORE' : '📥 LOAD'}</span>
              <span className="font-mono">{transferActivity.instruction}</span>
            </span>
          )}
        </div>

        {/* 가로/세로 배치 모드 스위치 (기본값: 비율 자동 감지) */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setManualLayout('auto')}
            className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
              manualLayout === 'auto' ? 'bg-white text-indigo-600 shadow-2xs' : 'hover:text-slate-900'
            }`}
            title="컨테이너 가로/세로 비율에 맞춰 자동으로 좌우 또는 상하 배치"
          >
            자동({isHorizontal ? '좌우' : '상하'})
          </button>
          <button
            type="button"
            onClick={() => setManualLayout('horizontal')}
            className={`px-1.5 py-0.5 rounded-md transition-colors cursor-pointer ${
              manualLayout === 'horizontal' ? 'bg-white text-indigo-600 shadow-2xs' : 'hover:text-slate-900'
            }`}
          >
            좌우↔
          </button>
          <button
            type="button"
            onClick={() => setManualLayout('vertical')}
            className={`px-1.5 py-0.5 rounded-md transition-colors cursor-pointer ${
              manualLayout === 'vertical' ? 'bg-white text-indigo-600 shadow-2xs' : 'hover:text-slate-900'
            }`}
          >
            상하↕
          </button>
        </div>
      </div>

      {/* 본문 영역: 비율에 따라 좌우(flex-row) 또는 상하(flex-col) 자동 배치 */}
      <div
        className={`flex-1 flex min-h-0 overflow-hidden gap-2 ${
          isHorizontal ? 'flex-row' : 'flex-col'
        }`}
      >
        {/* ============================================================ */}
        {/* [영역 1] 레지스터 (기존 RegisterVisualizer 원상복구)          */}
        {/* ============================================================ */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200/80 p-3 flex flex-col min-h-0 min-w-0 overflow-hidden">
          {/* 상단 헤더 & 필터 안내 */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Registers</h3>
              <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold font-mono">
                활성 {activeRegCount}/32
              </span>
              <span className="text-[10px] text-slate-400">
                (값 있는 레지스터 상단 정렬)
              </span>
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyNonZero}
                onChange={(e) => setOnlyNonZero(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-0 w-3.5 h-3.5"
              />
              <span>유효값만</span>
            </label>
          </div>

          {/* 1열 전체 너비 한 줄 리스트 */}
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 text-xs font-mono custom-scrollbar">
            {filteredRegKeys.map((regKey) => {
              const val = registers[regKey] || '0x00000000';
              const prevVal = prevRegisters ? prevRegisters[regKey] : undefined;
              const isChanged = prevVal !== undefined && prevVal !== val;
              const hasVal = val !== '0x00000000';
              const meta = REGISTER_METAS[regKey] || { abi: regKey };

              return (
                <div
                  key={regKey}
                  title={meta.desc || regKey}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-xl border transition-all ${
                    isChanged
                      ? 'bg-amber-100/90 border-amber-400 text-amber-950 font-bold shadow-xs animate-pulse ring-1 ring-amber-300'
                      : hasVal
                      ? 'bg-blue-50/60 border-blue-200 text-slate-900 font-semibold shadow-2xs'
                      : 'bg-slate-50/40 border-slate-100 text-slate-400'
                  }`}
                >
                  {/* 좌측: 번호, ABI 이름, 설명 태그, 사전 배정 뱃지 */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-8 font-bold ${isChanged ? 'text-amber-900' : hasVal ? 'text-blue-700' : 'text-slate-500'}`}>
                      {regKey}
                    </span>

                    <span className="text-[11px] text-slate-500 font-medium w-10 truncate">
                      ({meta.abi})
                    </span>

                    {meta.presetTag && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-sans font-bold bg-purple-100 text-purple-700 shrink-0">
                        {meta.presetTag}
                      </span>
                    )}

                    {hasVal && !meta.presetTag && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-sans font-semibold bg-blue-100 text-blue-700 shrink-0">
                        Active
                      </span>
                    )}
                  </div>

                  {/* 우측: 16진수 값 전체 표시 (잘림 없음) */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-mono text-xs tracking-wider ${isChanged ? 'text-amber-950 font-extrabold' : hasVal ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                      {val}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ============================================================ */}
        {/* [영역 2] 중앙 레지스터 ↔ 메모리 이동 브릿지 (Load / Store)   */}
        {/* ============================================================ */}
        <div
          className={`shrink-0 flex items-center justify-center ${
            isHorizontal ? 'w-24 flex-col py-2' : 'h-10 flex-row px-3'
          } bg-slate-50 rounded-xl border border-dashed border-slate-200 relative overflow-hidden`}
        >
          {transferActivity ? (
            <div
              className={`flex items-center justify-center text-center ${
                isHorizontal ? 'flex-col gap-1 px-1' : 'flex-row gap-3 w-full'
              }`}
            >
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                  transferActivity.type === 'store'
                    ? 'bg-amber-500 text-white'
                    : 'bg-cyan-600 text-white'
                }`}
              >
                {transferActivity.type === 'store' ? 'STORE (sw)' : 'LOAD (lw)'}
              </span>

              <div
                className={`flex items-center justify-center font-mono text-xs font-extrabold shrink-0 ${
                  transferActivity.type === 'store' ? 'text-amber-600' : 'text-cyan-600'
                } ${
                  isHorizontal
                    ? transferActivity.type === 'store'
                      ? 'anim-packet-right'
                      : 'anim-packet-left'
                    : transferActivity.type === 'store'
                    ? 'anim-packet-down'
                    : 'anim-packet-up'
                }`}
              >
                {isHorizontal
                  ? transferActivity.type === 'store'
                    ? '━━▶'
                    : '◀━━'
                  : transferActivity.type === 'store'
                  ? '⬇'
                  : '⬆'}
              </div>

              <div className="text-[10px] font-mono font-bold text-slate-700 leading-tight shrink-0">
                {transferActivity.type === 'store' ? (
                  <>
                    <span className="text-amber-700">{transferActivity.abiName}</span>
                    <span> → </span>
                    <span className="uppercase text-violet-700">{transferActivity.segment}</span>
                  </>
                ) : (
                  <>
                    <span className="uppercase text-violet-700">{transferActivity.segment}</span>
                    <span> → </span>
                    <span className="text-cyan-700">{transferActivity.abiName}</span>
                  </>
                )}
              </div>

              <div className="text-[10px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                {transferActivity.valueHex}
              </div>
            </div>
          ) : (
            <div
              className={`flex items-center justify-center text-center text-slate-400 ${
                isHorizontal ? 'flex-col gap-0.5' : 'flex-row gap-2'
              }`}
            >
              <span className="text-xs font-mono">
                {isHorizontal ? '⇄' : '⇅'}
              </span>
              <span className="text-[10px] font-semibold leading-tight">
                Data Bus
              </span>
              <span className="text-[10px] text-slate-400 leading-tight">
                (lw / sw 대기)
              </span>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* [영역 3] 메모리 4대 영역 구조도 (호버 시 줄글 상세 확인)      */}
        {/* ============================================================ */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-slate-50/70 rounded-xl border border-slate-200/80 p-2.5 overflow-hidden relative">
          <div className="flex items-center justify-between gap-1 pb-2 mb-2 border-b border-slate-200/70 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">💾 Memory Map</span>
              <span className="text-[10px] text-slate-400">
                (영역에 마우스 호버 시 상세 데이터 표시)
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">High → Low</span>
          </div>

          {/* 4개 메모리 세그먼트 블록 스택 */}
          <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto pr-0.5">
            {(['stack', 'heap', 'data', 'code'] as MemorySegmentKey[]).map((segKey) => {
              const meta = SEGMENT_META[segKey];
              const items = segmentedMemory[segKey];
              const isTargetSeg = transferActivity?.segment === segKey;
              const changedCount = items.filter((i) => i.isChanged).length;
              const isSelected = activeSegmentKey === segKey;

              return (
                <div
                  key={segKey}
                  onMouseEnter={() => setHoveredSegment(segKey)}
                  onMouseLeave={() => setHoveredSegment(null)}
                  onClick={() =>
                    setPinnedSegment((prev) => (prev === segKey ? null : segKey))
                  }
                  className={`flex-1 min-h-[54px] px-3 py-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isTargetSeg
                      ? `${meta.activeBgClass} ${meta.activeBorderClass}`
                      : isSelected
                      ? `${meta.activeBgClass} ${meta.borderClass}`
                      : `${meta.bgClass} ${meta.borderClass}`
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${meta.badgeClass}`}
                      >
                        {meta.title}
                      </span>
                      {meta.directionBadge && (
                        <span className="text-[10px] font-semibold text-slate-500">
                          {meta.directionBadge}
                        </span>
                      )}
                      {isTargetSeg && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white animate-bounce">
                          {transferActivity?.type === 'store'
                            ? `📥 Store (${transferActivity.targetAddress})`
                            : `📤 Load (${transferActivity.targetAddress})`}
                        </span>
                      )}
                      {changedCount > 0 && !isTargetSeg && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500 text-white">
                          변경 {changedCount}건
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-slate-500">
                        {meta.rangeLabel}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/80 text-slate-700 border border-slate-200">
                        {items.length} words
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1 text-[11px]">
                    <span className="text-slate-500 truncate">{meta.subtitle}</span>
                    {items.length > 0 ? (
                      <span className="font-mono text-[10px] text-slate-700 bg-white/70 px-1.5 py-0.2 rounded border border-slate-200/70 shrink-0">
                        최근: {items[0].address} → {items[0].hexValue}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 shrink-0">비어 있음</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ============================================================ */}
          {/* 호버(또는 클릭 고정) 시 우측에 뜨는 세그먼트 줄글 상세 오버레이 */}
          {/* (좌측 ~32%는 뒤의 4개 영역 블록이 보여 바로 다른 영역 선택 가능) */}
          {/* ============================================================ */}
          {activeSegmentKey && (
            <div
              onMouseEnter={() => setHoveredSegment(activeSegmentKey)}
              onMouseLeave={() => setHoveredSegment(null)}
              className="absolute top-2 bottom-2 right-2 w-[85%] z-30 bg-slate-900/95 backdrop-blur-xs text-slate-100 rounded-xl p-3 shadow-2xl border border-slate-700 flex flex-col overflow-hidden animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ${SEGMENT_META[activeSegmentKey].badgeClass}`}
                  >
                    {SEGMENT_META[activeSegmentKey].title}
                  </span>
                  <span className="text-[11px] text-slate-300 font-mono truncate">
                    ({segmentedMemory[activeSegmentKey].length} words)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHoveredSegment(null);
                    setPinnedSegment(null);
                  }}
                  className="text-[11px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 font-mono text-[11px]">
                {segmentedMemory[activeSegmentKey].length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs font-sans text-center px-2">
                    현재 이 메모리 영역에 할당된 데이터가 없습니다.
                  </div>
                ) : (
                  segmentedMemory[activeSegmentKey].map((entry) => (
                    <div
                      key={entry.address}
                      className={`px-2 py-1.5 rounded-lg border flex items-center justify-between gap-1.5 ${
                        entry.isAccessed
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                          : entry.isChanged
                          ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200 font-bold'
                          : 'bg-slate-800/80 border-slate-700/80 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sky-400 font-bold">{entry.address}</span>
                        {entry.label && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-violet-500/30 text-violet-200 border border-violet-400/40 shrink-0">
                            {entry.label}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-white font-bold">{entry.hexValue}</span>
                        <span className="text-[10px] text-slate-400">
                          ({activeSegmentKey === 'code' ? entry.decText : `=${entry.decText}`})
                        </span>
                        {entry.asciiHint && (
                          <span className="text-[9px] text-emerald-300 bg-emerald-950/80 px-1 py-0.2 rounded">
                            {entry.asciiHint}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StateVisualizer;

