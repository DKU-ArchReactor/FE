import type { CycleHistoryItem, StageBuffer } from "@/type/simulation";

export type CellType =
  | "IF"
  | "ID"
  | "EX"
  | "MEM"
  | "WB"
  | "DONE"
  | "STALL_IF"
  | "STALL_ID"
  | "BUBBLE";

export interface CellInfo {
  type: CellType;
  stage: "IF" | "ID" | "EX" | "MEM" | "WB";
  label: string;
  isStall?: boolean;
  isBubble?: boolean;
  isForwarded?: boolean;
}

export interface TraceRow {
  id: number;
  pc: string;
  assembly: string;
  firstCycle: number;
  cells: Record<number, CellInfo>;
}

export const STAGE_STYLES: Record<
  CellType,
  {
    bg: string;
    text: string;
    border: string;
    activeRing: string;
    activeGlow: string;
  }
> = {
  // 무지개 스펙트럼 (Red -> Orange -> Green -> Blue -> Purple)
  IF: {
    bg: "bg-[#F87171] dark:bg-[#EF4444]",
    text: "text-white",
    border: "border-0",
    activeRing: "ring-[#FCA5A5]",
    activeGlow: "shadow-[0_0_10px_rgba(239,68,68,0.45)]",
  },
  ID: {
    bg: "bg-[#FB923C] dark:bg-[#F97316]",
    text: "text-white",
    border: "border-0",
    activeRing: "ring-[#FDBA74]",
    activeGlow: "shadow-[0_0_10px_rgba(249,115,22,0.45)]",
  },
  EX: {
    bg: "bg-[#34D399] dark:bg-[#10B981]",
    text: "text-white",
    border: "border-0",
    activeRing: "ring-[#6EE7B7]",
    activeGlow: "shadow-[0_0_10px_rgba(16,185,129,0.45)]",
  },
  MEM: {
    bg: "bg-[#38BDF8] dark:bg-[#0EA5E9]",
    text: "text-white",
    border: "border-0",
    activeRing: "ring-[#7DD3FC]",
    activeGlow: "shadow-[0_0_10px_rgba(14,165,233,0.45)]",
  },
  WB: {
    bg: "bg-[#A78BFA] dark:bg-[#8B5CF6]",
    text: "text-white",
    border: "border-0",
    activeRing: "ring-[#C4B5FD]",
    activeGlow: "shadow-[0_0_10px_rgba(139,92,246,0.45)]",
  },
  DONE: {
    bg: "bg-[#2DD4BF] dark:bg-[#14B8A6]",
    text: "text-white",
    border: "border-0",
    activeRing: "ring-[#5EEAD4]",
    activeGlow: "shadow-[0_0_10px_rgba(20,184,166,0.45)]",
  },
  // 장애 / 스톨 / 버블은 무지개 흐름을 방해하지 않는 차분한 톤다운 그레이/슬레이트
  STALL_IF: {
    bg: "bg-[#94A3B8] dark:bg-[#64748B]",
    text: "text-white",
    border: "border-0",
    activeRing: "ring-[#CBD5E1]",
    activeGlow: "shadow-[0_0_10px_rgba(100,116,139,0.45)]",
  },
  STALL_ID: {
    bg: "bg-[#94A3B8] dark:bg-[#64748B]",
    text: "text-white",
    border: "border-0",
    activeRing: "ring-[#CBD5E1]",
    activeGlow: "shadow-[0_0_10px_rgba(100,116,139,0.45)]",
  },
  BUBBLE: {
    bg: "bg-[#A1A1AA] dark:bg-[#71717A]",
    text: "text-white",
    border: "border-0",
    activeRing: "ring-[#D4D4D8]",
    activeGlow: "shadow-[0_0_10px_rgba(113,113,122,0.45)]",
  },
};

export const isValidStageInst = (buf?: StageBuffer | null): buf is StageBuffer => {
  if (!buf || !buf.assembly) return false;
  const norm = buf.assembly.trim().toLowerCase();
  if (!norm || norm === "bubble" || norm === "empty" || norm === "nop (bubble)") return false;
  if (buf.status === "bubble" || buf.status === "empty") return false;
  return true;
};

export const isSameInstruction = (row: TraceRow, buf: StageBuffer): boolean => {
  const bufPc = (buf.pc || "").toLowerCase();
  const bufAsm = buf.assembly.replace(/\s+/g, " ").trim().toLowerCase();
  const rowAsm = row.assembly.replace(/\s+/g, " ").trim().toLowerCase();
  if (row.pc && bufPc) {
    return row.pc.toLowerCase() === bufPc && rowAsm === bufAsm;
  }
  return rowAsm === bufAsm;
};

export function buildMultiCycleTraceRows(
  history: CycleHistoryItem[],
  isSingleMode: boolean
): TraceRow[] {
  if (!history.length) return [];

  // [Single-Cycle 모드 전용 다이어그램]: 매 클럭 1개 명령어가 IF-ID-EX-MEM-WB 전 과정을 1칸에 직렬 완료
  if (isSingleMode) {
    return history.map((item, cIdx) => {
      const stageInfo = item.buffers?.IF || item.if_stage || item.stage_activity?.IF;
      const pc = stageInfo?.pc || "";
      const assembly = stageInfo?.assembly || `inst_${cIdx}`;

      const cells: Record<number, CellInfo> = {
        [cIdx]: {
          type: "DONE",
          stage: "WB",
          label: "DONE",
        },
      };

      return {
        id: cIdx,
        pc,
        assembly,
        firstCycle: cIdx,
        cells,
      };
    });
  }

  // [5-Stage Pipeline 모드]: 계단식(Stair-step) 다이어그램 행 생성
  const rows: TraceRow[] = [];
  let prevStageRow: Partial<Record<"IF" | "ID" | "EX" | "MEM" | "WB", number>> = {};

  const createRow = (buf: StageBuffer, cIdx: number): number => {
    const id = rows.length;
    rows.push({
      id,
      pc: buf.pc || "",
      assembly: buf.assembly.trim(),
      firstCycle: cIdx,
      cells: {},
    });
    return id;
  };

  history.forEach((item, cIdx) => {
    const nextStageRow: Partial<Record<"IF" | "ID" | "EX" | "MEM" | "WB", number>> = {};
    const usedPrevStages = new Set<"IF" | "ID" | "EX" | "MEM" | "WB">();

    const hasStallEvent = Boolean(item.cycle_events?.stall?.has_stall);
    const hasForwardEvent = Boolean(item.cycle_events?.forwarding?.has_forwarded);

    // 1. WB 단계 매칭 (이전 사이클 MEM -> 현재 WB)
    const wbBuf = item.buffers?.WB;
    if (isValidStageInst(wbBuf)) {
      let rowId: number | undefined;
      if (
        prevStageRow.MEM !== undefined &&
        isSameInstruction(rows[prevStageRow.MEM], wbBuf)
      ) {
        rowId = prevStageRow.MEM;
        usedPrevStages.add("MEM");
      } else if (
        prevStageRow.WB !== undefined &&
        isSameInstruction(rows[prevStageRow.WB], wbBuf)
      ) {
        rowId = prevStageRow.WB;
        usedPrevStages.add("WB");
      } else {
        rowId = createRow(wbBuf, cIdx);
      }
      rows[rowId].cells[cIdx] = {
        type: "WB",
        stage: "WB",
        label: "WB",
      };
      nextStageRow.WB = rowId;
    }

    // 2. MEM 단계 매칭 (이전 사이클 EX -> 현재 MEM)
    const memBuf = item.buffers?.MEM;
    if (isValidStageInst(memBuf)) {
      let rowId: number | undefined;
      if (
        prevStageRow.EX !== undefined &&
        isSameInstruction(rows[prevStageRow.EX], memBuf)
      ) {
        rowId = prevStageRow.EX;
        usedPrevStages.add("EX");
      } else if (
        prevStageRow.MEM !== undefined &&
        !usedPrevStages.has("MEM") &&
        isSameInstruction(rows[prevStageRow.MEM], memBuf)
      ) {
        rowId = prevStageRow.MEM;
        usedPrevStages.add("MEM");
      } else {
        rowId = createRow(memBuf, cIdx);
      }
      rows[rowId].cells[cIdx] = {
        type: "MEM",
        stage: "MEM",
        label: "MEM",
      };
      nextStageRow.MEM = rowId;
    }

    // 3. EX 단계 매칭 (이전 사이클 ID -> 현재 EX)
    const exBuf = item.buffers?.EX;
    if (isValidStageInst(exBuf)) {
      let rowId: number | undefined;
      if (
        prevStageRow.ID !== undefined &&
        isSameInstruction(rows[prevStageRow.ID], exBuf)
      ) {
        rowId = prevStageRow.ID;
        usedPrevStages.add("ID");
      } else if (
        prevStageRow.EX !== undefined &&
        !usedPrevStages.has("EX") &&
        isSameInstruction(rows[prevStageRow.EX], exBuf)
      ) {
        rowId = prevStageRow.EX;
        usedPrevStages.add("EX");
      } else {
        rowId = createRow(exBuf, cIdx);
      }
      rows[rowId].cells[cIdx] = {
        type: "EX",
        stage: "EX",
        label: "EX",
        isForwarded: hasForwardEvent,
      };
      nextStageRow.EX = rowId;
    }

    // 4. ID 단계 매칭 (스톨로 인해 이전 ID 유지 or 이전 IF -> 현재 ID)
    const idBuf = item.buffers?.ID;
    if (isValidStageInst(idBuf)) {
      let rowId: number | undefined;
      let isStalledInId = false;

      if (
        prevStageRow.ID !== undefined &&
        !usedPrevStages.has("ID") &&
        isSameInstruction(rows[prevStageRow.ID], idBuf)
      ) {
        rowId = prevStageRow.ID;
        usedPrevStages.add("ID");
        isStalledInId = true;
      } else if (
        prevStageRow.IF !== undefined &&
        isSameInstruction(rows[prevStageRow.IF], idBuf)
      ) {
        rowId = prevStageRow.IF;
        usedPrevStages.add("IF");
      } else {
        rowId = createRow(idBuf, cIdx);
      }

      const markStall = isStalledInId || (hasStallEvent && !isValidStageInst(exBuf));
      rows[rowId].cells[cIdx] = {
        type: markStall ? "STALL_ID" : "ID",
        stage: "ID",
        label: markStall ? "STL" : "ID",
        isStall: markStall,
      };
      nextStageRow.ID = rowId;
    }

    // 5. IF 단계 매칭 (스톨로 인해 이전 IF 유지 or 새로운 명령어 인출)
    const ifBuf = item.buffers?.IF;
    if (isValidStageInst(ifBuf)) {
      let rowId: number | undefined;
      let isStalledInIf = false;

      if (
        prevStageRow.IF !== undefined &&
        !usedPrevStages.has("IF") &&
        isSameInstruction(rows[prevStageRow.IF], ifBuf)
      ) {
        rowId = prevStageRow.IF;
        usedPrevStages.add("IF");
        isStalledInIf = true;
      } else {
        rowId = createRow(ifBuf, cIdx);
      }

      rows[rowId].cells[cIdx] = {
        type: isStalledInIf ? "STALL_IF" : "IF",
        stage: "IF",
        label: isStalledInIf ? "STL" : "IF",
        isStall: isStalledInIf,
      };
      nextStageRow.IF = rowId;
    }

    // 6. 분기/점프 플러시(Flush) 또는 버블(Bubble)로 인해 파이프라인에서 도중 취소된 명령어 표시
    if (prevStageRow.ID !== undefined && !usedPrevStages.has("ID")) {
      const flushedRow = rows[prevStageRow.ID];
      if (flushedRow && !flushedRow.cells[cIdx]) {
        flushedRow.cells[cIdx] = {
          type: "BUBBLE",
          stage: "EX",
          label: "BBL",
          isBubble: true,
        };
      }
    }
    if (prevStageRow.IF !== undefined && !usedPrevStages.has("IF")) {
      const flushedRow = rows[prevStageRow.IF];
      if (flushedRow && !flushedRow.cells[cIdx]) {
        flushedRow.cells[cIdx] = {
          type: "BUBBLE",
          stage: "ID",
          label: "BBL",
          isBubble: true,
        };
      }
    }

    prevStageRow = nextStageRow;
  });

  return rows;
}

