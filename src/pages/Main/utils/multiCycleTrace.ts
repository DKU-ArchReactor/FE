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
    activeBg: string;
    hoverBg: string;
    text: string;
    border: string;
  }
> = {
  // 무지개 스펙트럼 (Red -> Orange -> Green -> Blue -> Purple)
  IF: {
    bg: "bg-[#FCA5A5] dark:bg-[#7F1D1D]", // 평소: 부드러운 파스텔 코랄 레드
    activeBg: "bg-[#EF4444] dark:bg-[#DC2626]", // 포커스: 짙고 선명한 레드
    hoverBg: "hover:bg-[#EF4444] dark:hover:bg-[#DC2626]", // 호버 시 진해짐
    text: "text-white",
    border: "border-0",
  },
  ID: {
    bg: "bg-[#FDBA74] dark:bg-[#7C2D12]", // 평소: 파스텔 오렌지
    activeBg: "bg-[#F97316] dark:bg-[#EA580C]", // 포커스: 짙은 딥 오렌지
    hoverBg: "hover:bg-[#F97316] dark:hover:bg-[#EA580C]",
    text: "text-white",
    border: "border-0",
  },
  EX: {
    bg: "bg-[#A3E635] dark:bg-[#365314]", // 평소: 파스텔 연두 (Lime 400)
    activeBg: "bg-[#22C55E] dark:bg-[#15803D]", // 포커스: 생기있고 화사한 파스텔 초록 (Green 500)
    hoverBg: "hover:bg-[#22C55E] dark:hover:bg-[#15803D]",
    text: "text-white font-bold",
    border: "border-0",
  },
  MEM: {
    bg: "bg-[#93C5FD] dark:bg-[#1E3A8A]", // 평소: 파스텔 스카이블루
    activeBg: "bg-[#0EA5E9] dark:bg-[#0284C7]", // 포커스: 짙은 블루
    hoverBg: "hover:bg-[#0EA5E9] dark:hover:bg-[#0284C7]",
    text: "text-white",
    border: "border-0",
  },
  WB: {
    bg: "bg-[#C4B5FD] dark:bg-[#4C1D95]", // 평소: 파스텔 바이올렛
    activeBg: "bg-[#8B5CF6] dark:bg-[#7C3AED]", // 포커스: 짙은 바이올렛 퍼플
    hoverBg: "hover:bg-[#8B5CF6] dark:hover:bg-[#7C3AED]",
    text: "text-white",
    border: "border-0",
  },
  DONE: {
    bg: "bg-[#A3E635] dark:bg-[#365314]", // 평소: 파스텔 연두 (Lime 400)
    activeBg: "bg-[#22C55E] dark:bg-[#15803D]", // 포커스: 생기있고 화사한 파스텔 초록 (Green 500)
    hoverBg: "hover:bg-[#22C55E] dark:hover:bg-[#15803D]",
    text: "text-white font-bold",
    border: "border-0",
  },
  // 장애 / 스톨 / 버블
  STALL_IF: {
    bg: "bg-[#FDE68A] dark:bg-[#78350F]", // Amber 200 / Amber 900
    activeBg: "bg-[#F59E0B] dark:bg-[#B45309]", // Amber 500 / Amber 700
    hoverBg: "hover:bg-[#F59E0B] dark:hover:bg-[#B45309]",
    text: "text-amber-900 dark:text-amber-100",
    border: "border-0",
  },
  STALL_ID: {
    bg: "bg-[#FDE68A] dark:bg-[#78350F]",
    activeBg: "bg-[#F59E0B] dark:bg-[#B45309]",
    hoverBg: "hover:bg-[#F59E0B] dark:hover:bg-[#B45309]",
    text: "text-amber-900 dark:text-amber-100",
    border: "border-0",
  },
  BUBBLE: {
    bg: "bg-[#BAE6FD] dark:bg-[#164E63]",
    activeBg: "bg-[#38BDF8] dark:bg-[#0284C7]",
    hoverBg: "hover:bg-[#38BDF8] dark:hover:bg-[#0284C7]",
    text: "text-white",
    border: "border-0",
  },
};

export const isValidStageInst = (buf?: StageBuffer | null): buf is StageBuffer => {
  if (!buf || !buf.assembly) return false;
  const norm = buf.assembly.trim().toLowerCase();
  if (
    !norm ||
    norm === "bubble" ||
    norm === "empty" ||
    norm === "nop (bubble)" ||
    norm === "nop"
  ) {
    return false;
  }
  if (buf.status === "bubble" || buf.status === "empty" || buf.status === "flushed") {
    return false;
  }
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

    // 6. 분기/점프 플러시(Flush) 또는 버블(Bubble)로 인해 파이프라인에서 도중 취소된 명령어 표시 (방식 B: WB까지 버블 전파)
    if (prevStageRow.ID !== undefined && !usedPrevStages.has("ID")) {
      const flushedRow = rows[prevStageRow.ID];
      if (flushedRow && !flushedRow.cells[cIdx]) {
        flushedRow.cells[cIdx] = {
          type: "BUBBLE",
          stage: "EX",
          label: "BBL",
          isBubble: true,
        };
        nextStageRow.EX = prevStageRow.ID;
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
        nextStageRow.ID = prevStageRow.IF;
      }
    }
    if (prevStageRow.EX !== undefined && !usedPrevStages.has("EX")) {
      const flushedRow = rows[prevStageRow.EX];
      if (flushedRow && !flushedRow.cells[cIdx]) {
        flushedRow.cells[cIdx] = {
          type: "BUBBLE",
          stage: "MEM",
          label: "BBL",
          isBubble: true,
        };
        nextStageRow.MEM = prevStageRow.EX;
      }
    }
    if (prevStageRow.MEM !== undefined && !usedPrevStages.has("MEM")) {
      const flushedRow = rows[prevStageRow.MEM];
      if (flushedRow && !flushedRow.cells[cIdx]) {
        flushedRow.cells[cIdx] = {
          type: "BUBBLE",
          stage: "WB",
          label: "BBL",
          isBubble: true,
        };
        nextStageRow.WB = prevStageRow.MEM;
      }
    }

    prevStageRow = nextStageRow;
  });

  return rows;
}

