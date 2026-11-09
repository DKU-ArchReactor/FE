import type { CycleHistoryItem, SimulationResult, ProgramMemoryLayout } from "@/type/simulation";

export type MemorySegmentKey = "stack" | "heap" | "bss" | "data" | "code" | "reserved";

export interface SegmentDefinition {
  key: MemorySegmentKey;
  name: string;
  shape: "down-arrow" | "up-arrow" | "rect";
  flexRatio: number;
  badgeAlignClass: string;
  color: {
    badgeBg: string;
    badgeText: string;
    arrowFill?: string;
  };
}

export interface MemoryItemRow {
  address: string;
  hexValue: string;
  decText: string;
  isChanged: boolean;
  label?: string;
}

export interface CodeSegmentSummary {
  userInstructions: MemoryItemRow[];
  runtimeInstructions: MemoryItemRow[];
  userRange: { start: string | null; end: string | null; count: number };
  startupRange: { start: string | null; end: string | null; count: number; bytes: number };
  maxCodePcNum: number;
}

export const SEGMENT_DEFS: SegmentDefinition[] = [
  {
    key: "stack",
    name: "Stack",
    shape: "down-arrow",
    flexRatio: 2.0,
    badgeAlignClass: "justify-start pt-1",
    color: {
      badgeBg: "bg-violet-600",
      badgeText: "text-white",
      arrowFill: "#7C3AED",
    },
  },
  {
    key: "heap",
    name: "Heap",
    shape: "up-arrow",
    flexRatio: 1.2,
    badgeAlignClass: "justify-end pb-1",
    color: {
      badgeBg: "bg-emerald-600",
      badgeText: "text-white",
      arrowFill: "#059669",
    },
  },
  {
    key: "bss",
    name: "BSS",
    shape: "rect",
    flexRatio: 1.1,
    badgeAlignClass: "justify-center",
    color: {
      badgeBg: "bg-sky-600",
      badgeText: "text-white",
    },
  },
  {
    key: "data",
    name: "Data",
    shape: "rect",
    flexRatio: 1.4,
    badgeAlignClass: "justify-center",
    color: {
      badgeBg: "bg-blue-600",
      badgeText: "text-white",
    },
  },
  {
    key: "code",
    name: "Code",
    shape: "rect",
    flexRatio: 3.5,
    badgeAlignClass: "justify-center",
    color: {
      badgeBg: "bg-amber-600",
      badgeText: "text-white",
    },
  },
  {
    key: "reserved",
    name: "NULL",
    shape: "rect",
    flexRatio: 0.9,
    badgeAlignClass: "justify-center",
    color: {
      badgeBg: "bg-slate-600",
      badgeText: "text-white",
    },
  },
];

// 6대 세그먼트 사이의 5대 독립 경계선 기본 주소 (High ➔ Low)
export const DEFAULT_BOUNDARY_DIVIDERS = [
  "0x10008000", // [0] Stack과 Heap 사이 (Heap 최대 한계: 268,468,224)
  "0x10004000", // [1] Heap과 BSS 사이 (Heap 시작점: 268,451,840)
  "0x10000000", // [2] BSS와 Data 사이 (컴파일 전 미정)
  "0x10000000", // [3] Data와 Code 사이 (컴파일 전 미정)
  "0x00010000", // [4] Code와 NULL 사이 (Code 세그먼트 시작점: 65,536)
];

// 16진수 문자열을 10진수 포맷(콤마 포함)으로 변환
export const formatAddressDecimal = (hexStr: string): string => {
  const num = parseInt(hexStr, 16);
  if (isNaN(num)) return hexStr;
  return num.toLocaleString();
};

export const formatSignedDecimal = (hexStr: string): string => {
  const num = parseInt(hexStr, 16);
  if (isNaN(num)) return "0";
  const signed = num | 0;
  return signed.toLocaleString();
};

// 16진수 언더바 제거 및 대문자 정규화 (예: 0x7FFFEFFC)
export const normalizeHex = (hexStr: string): string => {
  const clean = hexStr.replace(/^0x/i, "").replace(/_/g, "").toUpperCase();
  return `0x${clean.padStart(8, "0")}`;
};

// 주소 분류: CORE가 제공하는 정적 memory_layout SSOT를 최우선 기준으로 판별
export const classifyAddress = (
  addrHex: string,
  valHex: string,
  layout?: ProgramMemoryLayout | null,
  maxCodePcNum?: number
): MemorySegmentKey => {
  const num = parseInt(addrHex, 16) >>> 0;
  if (num >= 0x70000000) return "stack";
  if (num >= 0x10004000 && num < 0x10008000) return "heap";
  if (num >= 0x10008000) return "stack";

  if (layout) {
    const bssStart = parseInt(layout.bss.start, 16) >>> 0;
    const bssEnd = parseInt(layout.bss.end_exclusive, 16) >>> 0;
    if (layout.bss.size_bytes > 0 && num >= bssStart && num < bssEnd) return "bss";

    const dataStart = parseInt(layout.data.start, 16) >>> 0;
    const dataEnd = parseInt(layout.data.end_exclusive, 16) >>> 0;
    if (layout.data.size_bytes > 0 && num >= dataStart && num < dataEnd) return "data";

    const codeStart = parseInt(layout.code.start, 16) >>> 0;
    const codeEnd = parseInt(layout.code.end_exclusive, 16) >>> 0;
    if (num >= codeStart && num < codeEnd) return "code";
  } else {
    if (maxCodePcNum && maxCodePcNum > 0 && num >= 0x00010000 && num <= maxCodePcNum) return "code";
    if (num >= 0x10000000 && num < 0x10004000) {
      const valNum = parseInt(valHex, 16) || 0;
      return valNum === 0 ? "bss" : "data";
    }
  }

  if (num < 0x00010000) return "reserved";
  return "data";
};

export function extractCodeSegmentSummary(
  simulationData: SimulationResult | null,
  currentPc?: string
): CodeSegmentSummary {
  const layout = simulationData?.program?.memory_layout;
  const codeMapping = simulationData?.program?.code_mapping;

  // 1순위: CORE가 계산한 layout과 code_mapping이 모두 있는 경우 (단일 진실 공급원 SSOT)
  if (layout?.code && codeMapping && Object.keys(codeMapping).length > 0) {
    const userList: MemoryItemRow[] = [];
    const runtimeList: MemoryItemRow[] = [];

    const sortedPcs = Object.keys(codeMapping).sort(
      (a, b) => (parseInt(b, 16) >>> 0) - (parseInt(a, 16) >>> 0)
    );

    sortedPcs.forEach((pcHex) => {
      const item = codeMapping[pcHex];
      const isCurrent = currentPc === pcHex.toLowerCase();
      const row: MemoryItemRow = {
        address: pcHex,
        hexValue: item.raw_instruction || "0x00000000",
        decText: item.assembly || "",
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
    const userList: MemoryItemRow[] = [];
    const runtimeList: MemoryItemRow[] = [];

    const sortedPcs = Object.keys(codeMapping).sort(
      (a, b) => (parseInt(b, 16) >>> 0) - (parseInt(a, 16) >>> 0)
    );

    sortedPcs.forEach((pcHex) => {
      const item = codeMapping[pcHex];
      const isCurrent = currentPc === pcHex.toLowerCase();
      const row: MemoryItemRow = {
        address: pcHex,
        hexValue: item.raw_instruction || "0x00000000",
        decText: item.assembly || "",
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

  // 3순위: 컴파일 전 초기 빈 화면 상태
  return {
    userInstructions: [],
    runtimeInstructions: [],
    userRange: { start: null, end: null, count: 0 },
    startupRange: { start: null, end: null, count: 0, bytes: 0 },
    maxCodePcNum: 0,
  };
}

export function buildSegmentedMemory(
  memorySnapshot: Record<string, string>,
  prevMemorySnapshot: Record<string, string> | undefined,
  layout: ProgramMemoryLayout | undefined | null,
  maxCodePcNum: number,
  userInstructions: MemoryItemRow[],
  runtimeInstructions: MemoryItemRow[]
): Record<MemorySegmentKey, MemoryItemRow[]> {
  const result: Record<MemorySegmentKey, MemoryItemRow[]> = {
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
    if (segKey === "stack" && addrHex.toLowerCase() === "0x7fffeffc") {
      label = "Init SP";
    }

    result[segKey].push({
      address: addrHex,
      hexValue: valHex,
      decText: formatSignedDecimal(valHex),
      isChanged,
      label,
    });
  });

  result.code = [...userInstructions, ...runtimeInstructions];

  result.stack.sort((a, b) => (parseInt(b.address, 16) >>> 0) - (parseInt(a.address, 16) >>> 0));
  result.heap.sort((a, b) => (parseInt(b.address, 16) >>> 0) - (parseInt(a.address, 16) >>> 0));
  result.bss.sort((a, b) => (parseInt(b.address, 16) >>> 0) - (parseInt(a.address, 16) >>> 0));
  result.data.sort((a, b) => (parseInt(b.address, 16) >>> 0) - (parseInt(a.address, 16) >>> 0));

  return result;
}

export function computeBoundaryDividers(
  currentData: CycleHistoryItem | null,
  simulationData: SimulationResult | null,
  userInstructionCount: number
): string[] {
  const layout = simulationData?.program?.memory_layout;
  const isCompiled = Boolean(layout || userInstructionCount > 0);

  const spVal =
    currentData?.global_result?.active_stack_pointer ||
    currentData?.global_result?.registers?.["x2"] ||
    currentData?.global_result?.registers?.["sp"];
  const stackHeapDivider =
    spVal && spVal !== "0x00000000" && spVal.toLowerCase() !== "0x7fffeffc"
      ? spVal
      : layout?.boundary_dividers?.[0] || DEFAULT_BOUNDARY_DIVIDERS[0];

  const heapBssDivider = layout?.boundary_dividers?.[1] || DEFAULT_BOUNDARY_DIVIDERS[1];
  const bssDataDivider: string = isCompiled
    ? layout?.boundary_dividers?.[2] || DEFAULT_BOUNDARY_DIVIDERS[2]
    : "—";
  const dataCodeDivider: string = isCompiled
    ? layout?.boundary_dividers?.[3] || DEFAULT_BOUNDARY_DIVIDERS[3]
    : "—";
  const codeNullDivider: string = layout?.boundary_dividers?.[4] || DEFAULT_BOUNDARY_DIVIDERS[4];

  return [stackHeapDivider, heapBssDivider, bssDataDivider, dataCodeDivider, codeNullDivider];
}

