import type { CycleHistoryItem } from "@/type/simulation";

export const parseOp = (assembly: string | null | undefined): string => {
  if (!assembly) return "";
  const trimmed = assembly.trim().toLowerCase();
  if (trimmed === "bubble" || trimmed === "empty" || trimmed === "flush" || trimmed === "stall") return "";
  const match = trimmed.match(/^([a-z0-9_.]+)/);
  return match ? match[1] : "";
};

export const isRType = (op: string) =>
  /^(add|sub|and|or|xor|sll|srl|sra|slt|sltu|mul|mulh|mulhsu|mulhu|div|divu|rem|remu)$/.test(op);
export const isITypeAlu = (op: string) =>
  /^(addi|andi|ori|xori|slti|sltiu|slli|srli|srai|li|mv|not|neg|seqz|snez)$/.test(op);
export const isLoad = (op: string) => /^(lw|lh|lb|lhu|lbu)$/.test(op);
export const isStore = (op: string) => /^(sw|sh|sb)$/.test(op);
export const isBranch = (op: string) =>
  /^(beq|bne|blt|bge|bltu|bgeu|beqz|bnez|bltz|bgez|blez|bgtz)$/.test(op);
export const isJump = (op: string) => /^(jal|jalr|j|jr|ret|call|tail)$/.test(op);
export const isLui = (op: string) => op === "lui";
export const isAuipc = (op: string) => op === "auipc";

export const usesRs1 = (op: string) =>
  isRType(op) ||
  isITypeAlu(op) ||
  isLoad(op) ||
  isStore(op) ||
  isBranch(op) ||
  op === "jalr" ||
  op === "jr" ||
  op === "ret" ||
  (!isRType(op) &&
    !isITypeAlu(op) &&
    !isLoad(op) &&
    !isStore(op) &&
    !isBranch(op) &&
    !isJump(op) &&
    !isLui(op) &&
    !isAuipc(op) &&
    Boolean(op));

export const usesRs2 = (op: string) => isRType(op) || isStore(op) || isBranch(op);
export const usesImm = (op: string) =>
  isITypeAlu(op) ||
  isLoad(op) ||
  isStore(op) ||
  isBranch(op) ||
  isLui(op) ||
  isAuipc(op) ||
  isJump(op) ||
  (!isRType(op) && Boolean(op));
export const usesPc = (op: string) => isBranch(op) || isJump(op) || isAuipc(op);
export const writesReg = (op: string) =>
  isRType(op) ||
  isITypeAlu(op) ||
  isLoad(op) ||
  isLui(op) ||
  isAuipc(op) ||
  op === "jal" ||
  op === "jalr" ||
  op === "call" ||
  (!isStore(op) && !isBranch(op) && Boolean(op));

export function computePipelineWireState(currentData: CycleHistoryItem | null, isSingle: boolean) {
  const buffers = currentData?.buffers;
  const cycle_events = currentData?.cycle_events;
  const clock = currentData?.clock;
  const isStall = Boolean(!isSingle && cycle_events?.stall?.has_stall);
  const isForward = Boolean(!isSingle && cycle_events?.forwarding?.has_forwarded);
  const isBranchFlush = Boolean(!isSingle && cycle_events?.control_hazard?.has_flush);

  const singleCycleInst = isSingle
    ? buffers?.IF?.assembly || currentData?.stage_activity?.IF?.assembly || currentData?.if_stage?.assembly || "—"
    : null;

  const ifInst = isSingle ? singleCycleInst || "—" : buffers?.IF?.assembly || "—";
  const idInst = isSingle ? singleCycleInst || "—" : buffers?.ID?.assembly || "—";
  const exInst = isSingle ? singleCycleInst || "—" : buffers?.EX?.assembly || "—";
  const memInst = isSingle ? singleCycleInst || "—" : buffers?.MEM?.assembly || "—";
  const wbInst = isSingle ? singleCycleInst || "—" : buffers?.WB?.assembly || "—";

  const isIfActive = ifInst !== "—" && ifInst !== "bubble" && ifInst !== "empty";
  const isIdActive = idInst !== "—" && idInst !== "bubble" && idInst !== "empty";
  const isExActive = exInst !== "—" && exInst !== "bubble" && exInst !== "empty";
  const isMemActive = memInst !== "—" && memInst !== "bubble" && memInst !== "empty";
  const isWbActive = wbInst !== "—" && wbInst !== "bubble" && wbInst !== "empty";

  const ifOp = parseOp(ifInst);
  const idOp = parseOp(idInst);
  const exOp = parseOp(exInst);
  const memOp = parseOp(memInst);
  const wbOp = parseOp(wbInst);

  const isInitialEmpty = !currentData;
  const inactiveStroke = isInitialEmpty ? "#94A3B8" : "transparent";
  const inactiveMarker = isInitialEmpty ? "url(#m-arr-def)" : undefined;

  // [IF 단계 와이어 활성 조건]
  const ifPcMuxToPcActive = isIfActive;
  const ifPcToImemActive = isIfActive;
  const ifPcToPlus4Active = isIfActive;
  const ifPcToIfIdActive = isIfActive && usesPc(ifOp);
  const ifPlus4LoopbackActive = isIfActive && !isBranchFlush;
  const branchLoopbackActive = isBranchFlush || Boolean(cycle_events?.control_hazard?.taken);
  const ifImemToIfIdActive = isIfActive;

  // [ID 단계 와이어 활성 조건]
  const idTrunkActive = isIdActive;
  const idControlUnitActive = isIdActive;
  const idToRegsActive = isIdActive && (usesRs1(idOp) || usesRs2(idOp));
  const idToImmGenActive = isIdActive && usesImm(idOp);
  const idRd1ToIdExActive = isIdActive && usesRs1(idOp);
  const idRd2ToIdExActive = isIdActive && usesRs2(idOp);
  const idImmToIdExActive = isIdActive && usesImm(idOp);
  const idPcToIdExActive = isIdActive && usesPc(idOp);

  // [EX 단계 와이어 활성 조건]
  const exRd1ToAluActive = isExActive && usesRs1(exOp);
  const exRd2TrunkActive = isExActive && usesRs2(exOp);
  const exRd2ToAluSrcActive = isExActive && (isRType(exOp) || isBranch(exOp));
  const exRd2ToWriteDataActive = isExActive && isStore(exOp);
  const exImmTrunkActive = isExActive && usesImm(exOp);
  const exImmToAluSrcActive =
    isExActive && (isITypeAlu(exOp) || isLoad(exOp) || isStore(exOp) || isLui(exOp) || exOp === "jalr");
  const exAluSrcToAluActive =
    isExActive &&
    (isRType(exOp) || isITypeAlu(exOp) || isLoad(exOp) || isStore(exOp) || isBranch(exOp) || isLui(exOp) || exOp === "jalr");
  const exBranchAddActive = isExActive && (isBranch(exOp) || isJump(exOp) || isAuipc(exOp));
  const exImmToBranchAddActive = isExActive && (isBranch(exOp) || isJump(exOp) || isAuipc(exOp));
  const exPcToBranchAddActive = isExActive && (isBranch(exOp) || isJump(exOp) || isAuipc(exOp));
  const exAluToExMemActive =
    isExActive && (isRType(exOp) || isITypeAlu(exOp) || isLoad(exOp) || isStore(exOp) || isLui(exOp) || exOp === "jalr");

  // [MEM 단계 와이어 활성 조건]
  const memAluTrunkActive =
    isMemActive &&
    (isLoad(memOp) || isStore(memOp) || isRType(memOp) || isITypeAlu(memOp) || isLui(memOp) || isAuipc(memOp) || memOp === "jalr");
  const memAluToDmemAddrActive = isMemActive && (isLoad(memOp) || isStore(memOp));
  const memAluBypassActive =
    isMemActive && (isRType(memOp) || isITypeAlu(memOp) || isLui(memOp) || isAuipc(memOp) || memOp === "jalr");
  const memWriteDataActive = isMemActive && isStore(memOp);
  const memDmemReadDataActive = isMemActive && isLoad(memOp);

  // [WB 단계 와이어 활성 조건]
  const wbAluBypassActive =
    isWbActive && (isRType(wbOp) || isITypeAlu(wbOp) || isLui(wbOp) || isAuipc(wbOp) || wbOp === "jalr");
  const wbDmemReadDataActive = isWbActive && isLoad(wbOp);
  const wbReverseFeedbackActive = isWbActive && writesReg(wbOp);

  return {
    buffers,
    cycle_events,
    clock,
    isStall,
    isForward,
    isBranchFlush,
    ifInst,
    idInst,
    exInst,
    memInst,
    wbInst,
    isIfActive,
    isIdActive,
    isExActive,
    isMemActive,
    isWbActive,
    ifOp,
    idOp,
    exOp,
    memOp,
    wbOp,
    isInitialEmpty,
    inactiveStroke,
    inactiveMarker,
    ifPcMuxToPcActive,
    ifPcToImemActive,
    ifPcToPlus4Active,
    ifPcToIfIdActive,
    ifPlus4LoopbackActive,
    branchLoopbackActive,
    ifImemToIfIdActive,
    idTrunkActive,
    idControlUnitActive,
    idToRegsActive,
    idToImmGenActive,
    idRd1ToIdExActive,
    idRd2ToIdExActive,
    idImmToIdExActive,
    idPcToIdExActive,
    exRd1ToAluActive,
    exRd2TrunkActive,
    exRd2ToAluSrcActive,
    exRd2ToWriteDataActive,
    exImmTrunkActive,
    exImmToAluSrcActive,
    exAluSrcToAluActive,
    exBranchAddActive,
    exImmToBranchAddActive,
    exPcToBranchAddActive,
    exAluToExMemActive,
    memAluTrunkActive,
    memAluToDmemAddrActive,
    memAluBypassActive,
    memWriteDataActive,
    memDmemReadDataActive,
    wbAluBypassActive,
    wbDmemReadDataActive,
    wbReverseFeedbackActive,
  };
}
