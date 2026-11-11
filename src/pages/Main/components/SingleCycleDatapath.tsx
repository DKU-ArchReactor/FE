import React, { useMemo, useState } from "react";
import type { CycleHistoryItem, SimulationResult } from "@/type/simulation";

interface SingleCycleDatapathProps {
  currentData: CycleHistoryItem | null;
  prevData?: CycleHistoryItem | null;
  simulationData?: SimulationResult | null;
  loadingMessage?: string | null;
}

// RISC-V 레지스터 번호 <-> ABI 별칭 매핑
const ABI_TO_REG: Record<string, string> = {
  zero: "x0",
  ra: "x1",
  sp: "x2",
  gp: "x3",
  tp: "x4",
  t0: "x5",
  t1: "x6",
  t2: "x7",
  s0: "x8",
  fp: "x8",
  s1: "x9",
  a0: "x10",
  a1: "x11",
  a2: "x12",
  a3: "x13",
  a4: "x14",
  a5: "x15",
  a6: "x16",
  a7: "x17",
  s2: "x18",
  s3: "x19",
  s4: "x20",
  s5: "x21",
  s6: "x22",
  s7: "x23",
  s8: "x24",
  s9: "x25",
  s10: "x26",
  s11: "x27",
  t3: "x28",
  t4: "x29",
  t5: "x30",
  t6: "x31",
};

const REG_TO_ABI: Record<string, string> = {
  x0: "zero",
  x1: "ra",
  x2: "sp",
  x3: "gp",
  x4: "tp",
  x5: "t0",
  x6: "t1",
  x7: "t2",
  x8: "s0",
  x9: "s1",
  x10: "a0",
  x11: "a1",
  x12: "a2",
  x13: "a3",
  x14: "a4",
  x15: "a5",
  x16: "a6",
  x17: "a7",
  x18: "s2",
  x19: "s3",
  x20: "s4",
  x21: "s5",
  x22: "s6",
  x23: "s7",
  x24: "s8",
  x25: "s9",
  x26: "s10",
  x27: "s11",
  x28: "t3",
  x29: "t4",
  x30: "t5",
  x31: "t6",
};

function normalizeRegKey(token: string | undefined | null): string | null {
  if (!token) return null;
  const clean = token.trim().toLowerCase();
  if (/^x([0-9]|[12][0-9]|3[01])$/.test(clean)) return clean;
  return ABI_TO_REG[clean] ?? null;
}

function formatRegLabel(regKey: string | null): string {
  if (!regKey) return "-";
  const abi = REG_TO_ABI[regKey];
  return abi ? `${abi} (${regKey})` : regKey;
}

function toSignedDec(hexStr: string | undefined | null): number {
  if (!hexStr) return 0;
  const parsed = parseInt(hexStr, 16);
  if (Number.isNaN(parsed)) return 0;
  return parsed | 0;
}

function toHex32(val: number): string {
  return `0x${(val >>> 0).toString(16).padStart(8, "0")}`;
}

function parseImmediateToken(token: string | undefined): number | null {
  if (!token) return null;
  const clean = token.trim();
  if (/^-?0x[0-9a-fA-F]+$/.test(clean)) {
    const v = parseInt(clean, 16);
    return Number.isNaN(v) ? null : v;
  }
  if (/^-?\d+$/.test(clean)) {
    const v = parseInt(clean, 10);
    return Number.isNaN(v) ? null : v;
  }
  return null;
}

export type BusTransactionMode = "IDLE" | "ALU_ONCHIP" | "DRAM_LOAD" | "DRAM_STORE" | "CONTROL_FLOW";

interface ResolvedSingleCycleState {
  isIdle: boolean;
  clock: number;
  pc: string;
  nextPc: string;
  assembly: string;
  rawHex: string;
  opcode: string;
  txMode: BusTransactionMode;
  txBadgeText: string;
  txSummary: string;
  // On-Chip 레지스터 포트
  rs1Key: string | null;
  rs1ValHex: string;
  rs1ValDec: number;
  rs2Key: string | null;
  rs2ValHex: string;
  rs2ValDec: number;
  rdKey: string | null;
  rdValHex: string;
  rdValDec: number;
  regWrite: boolean;
  // 즉시값 및 ALU
  hasImmediate: boolean;
  immDec: number | null;
  immHex: string | null;
  aluOpLabel: string;
  aluSymbol: string;
  aluInputA: string;
  aluInputB: string;
  aluResultHex: string;
  aluResultDec: number;
  // 버스 & DRAM 데이터 메모리
  memRead: boolean;
  memWrite: boolean;
  memAddressHex: string | null;
  memDataHex: string | null;
  memDataDec: number | null;
  isBranchOrJump: boolean;
  branchTaken: boolean;
}

function resolveSingleCycleState(
  currentData: CycleHistoryItem | null,
  prevData?: CycleHistoryItem | null,
  simulationData?: SimulationResult | null
): ResolvedSingleCycleState {
  const clock = currentData?.clock ?? 0;
  const ifBuf =
    currentData?.buffers?.IF ||
    currentData?.stage_activity?.IF ||
    currentData?.if_stage ||
    null;

  const dp = currentData?.datapath;
  const rawAsm = (dp?.instruction?.assembly || ifBuf?.assembly || "empty").trim();
  const isIdle = !currentData || clock === 0 || rawAsm === "empty" || rawAsm === "bubble";

  const pc =
    dp?.pc ||
    ifBuf?.pc ||
    currentData?.global_result?.current_pc ||
    simulationData?.program?.entry_point ||
    "0x00010000";

  const codeMapEntry = simulationData?.program?.code_mapping?.[pc] ||
    simulationData?.program?.code_mapping?.[pc.toLowerCase()] ||
    simulationData?.program?.code_mapping?.[pc.toUpperCase()];

  const rawHex =
    dp?.instruction?.raw ||
    ifBuf?.raw_instruction ||
    codeMapEntry?.raw_instruction ||
    "0x00000013";

  const beforeRegs = prevData?.global_result?.registers ?? currentData?.global_result?.registers ?? {};
  const afterRegs = currentData?.global_result?.registers ?? {};
  const beforeMem = prevData?.global_result?.memory_snapshot ?? {};
  const afterMem = currentData?.global_result?.memory_snapshot ?? {};

  if (isIdle) {
    return {
      isIdle: true,
      clock: 0,
      pc,
      nextPc: pc,
      assembly: "대기 중 (Step 0)",
      rawHex: "—",
      opcode: "IDLE",
      txMode: "IDLE",
      txBadgeText: "IDLE · 실행 대기",
      txSummary: "상단 컨트롤 바에서 [PLAY] 또는 [다음 스텝]을 누르면 DRAM에서 명령어를 인출하여 온칩 실행을 시작합니다.",
      rs1Key: null,
      rs1ValHex: "0x00000000",
      rs1ValDec: 0,
      rs2Key: null,
      rs2ValHex: "0x00000000",
      rs2ValDec: 0,
      rdKey: null,
      rdValHex: "0x00000000",
      rdValDec: 0,
      regWrite: false,
      hasImmediate: false,
      immDec: null,
      immHex: null,
      aluOpLabel: "IDLE",
      aluSymbol: "—",
      aluInputA: "—",
      aluInputB: "—",
      aluResultHex: "0x00000000",
      aluResultDec: 0,
      memRead: false,
      memWrite: false,
      memAddressHex: null,
      memDataHex: null,
      memDataDec: null,
      isBranchOrJump: false,
      branchTaken: false,
    };
  }

  // 명령어 토큰 분리
  const firstSpace = rawAsm.search(/\s/);
  const opcode = (firstSpace === -1 ? rawAsm : rawAsm.slice(0, firstSpace)).toLowerCase();
  const operandStr = firstSpace === -1 ? "" : rawAsm.slice(firstSpace).trim();
  const operands = operandStr
    ? operandStr.split(",").map((s) => s.trim())
    : [];

  // 명령어 분류
  const isLoad = /^(lw|lh|lhu|lb|lbu)$/.test(opcode);
  const isStore = /^(sw|sh|sb)$/.test(opcode);
  const isBranch = /^(beq|bne|blt|bge|bltu|bgeu|beqz|bnez|bltz|bgez|blez|bgtz)$/.test(opcode);
  const isJump = /^(jal|jalr|j|jr|ret|call|tail)$/.test(opcode);

  let rs1Key: string | null = dp?.registers?.rs1 ? `x${dp.registers.rs1.index}` : null;
  let rs2Key: string | null = dp?.registers?.rs2 ? `x${dp.registers.rs2.index}` : null;
  let rdKey: string | null = dp?.registers?.rd ? `x${dp.registers.rd.index}` : null;
  let immDec: number | null = dp?.immediate ? dp.immediate.decimal : null;

  // 어셈블리 구문에서 레지스터/즉시값 추론 (datapath 객체가 없을 때의 폴백)
  if (!rs1Key && !rs2Key && !rdKey) {
    if (isLoad && operands.length >= 2) {
      rdKey = normalizeRegKey(operands[0]);
      const memMatch = operands[1].match(/^(-?(?:0x[0-9a-fA-F]+|\d+)?)\(([^)]+)\)$/);
      if (memMatch) {
        immDec = parseImmediateToken(memMatch[1] || "0");
        rs1Key = normalizeRegKey(memMatch[2]);
      }
    } else if (isStore && operands.length >= 2) {
      rs2Key = normalizeRegKey(operands[0]);
      const memMatch = operands[1].match(/^(-?(?:0x[0-9a-fA-F]+|\d+)?)\(([^)]+)\)$/);
      if (memMatch) {
        immDec = parseImmediateToken(memMatch[1] || "0");
        rs1Key = normalizeRegKey(memMatch[2]);
      }
    } else if (isBranch) {
      if (operands.length === 3) {
        rs1Key = normalizeRegKey(operands[0]);
        rs2Key = normalizeRegKey(operands[1]);
        immDec = parseImmediateToken(operands[2]);
      } else if (operands.length === 2) {
        rs1Key = normalizeRegKey(operands[0]);
        rs2Key = "x0";
        immDec = parseImmediateToken(operands[1]);
      }
    } else if (opcode === "ret") {
      rs1Key = "x1";
    } else if (opcode === "jr") {
      rs1Key = normalizeRegKey(operands[0]);
    } else if (opcode === "j") {
      immDec = parseImmediateToken(operands[0]);
    } else if (opcode === "jal") {
      if (operands.length === 1) {
        rdKey = "x1";
        immDec = parseImmediateToken(operands[0]);
      } else {
        rdKey = normalizeRegKey(operands[0]);
        immDec = parseImmediateToken(operands[1]);
      }
    } else if (opcode === "jalr") {
      if (operands.length === 1) {
        rdKey = "x1";
        rs1Key = normalizeRegKey(operands[0]);
        immDec = 0;
      } else if (operands.length === 2) {
        rdKey = normalizeRegKey(operands[0]);
        const memMatch = operands[1].match(/^(-?(?:0x[0-9a-fA-F]+|\d+)?)\(([^)]+)\)$/);
        if (memMatch) {
          immDec = parseImmediateToken(memMatch[1] || "0");
          rs1Key = normalizeRegKey(memMatch[2]);
        } else {
          rs1Key = normalizeRegKey(operands[0]);
          immDec = parseImmediateToken(operands[1]);
        }
      } else if (operands.length >= 3) {
        rdKey = normalizeRegKey(operands[0]);
        rs1Key = normalizeRegKey(operands[1]);
        immDec = parseImmediateToken(operands[2]);
      }
    } else if (opcode === "lui" || opcode === "auipc" || opcode === "li") {
      rdKey = normalizeRegKey(operands[0]);
      immDec = parseImmediateToken(operands[1]);
    } else if (opcode === "mv" || opcode === "seqz" || opcode === "snez" || opcode === "neg" || opcode === "not") {
      rdKey = normalizeRegKey(operands[0]);
      rs1Key = normalizeRegKey(operands[1]);
      if (opcode === "mv") immDec = 0;
    } else if (operands.length >= 3) {
      rdKey = normalizeRegKey(operands[0]);
      rs1Key = normalizeRegKey(operands[1]);
      const thirdReg = normalizeRegKey(operands[2]);
      if (thirdReg) {
        rs2Key = thirdReg;
      } else {
        immDec = parseImmediateToken(operands[2]);
      }
    }
  }

  // 레지스터 값 조회
  const rs1ValHex = dp?.registers?.rs1?.value ?? (rs1Key ? beforeRegs[rs1Key] ?? "0x00000000" : "0x00000000");
  const rs2ValHex = dp?.registers?.rs2?.value ?? (rs2Key ? beforeRegs[rs2Key] ?? "0x00000000" : "0x00000000");
  const rdValHex = rdKey ? afterRegs[rdKey] ?? dp?.registers?.rd?.value ?? "0x00000000" : "0x00000000";

  const rs1ValDec = toSignedDec(rs1ValHex);
  const rs2ValDec = toSignedDec(rs2ValHex);
  const rdValDec = toSignedDec(rdValHex);

  const regWrite = dp?.control_signals?.reg_write ?? Boolean(rdKey && rdKey !== "x0");
  const hasImmediate = immDec !== null;
  const immHex = immDec !== null ? (dp?.immediate?.hex ?? toHex32(immDec)) : null;

  // 메모리 스냅샷 변경 감지 (Store 시 실제 변경된 주소 탐색)
  let changedMemAddr: string | null = null;
  for (const [addr, val] of Object.entries(afterMem)) {
    if (beforeMem[addr] !== val) {
      changedMemAddr = addr;
      break;
    }
  }

  // ALU 연산 기호 및 결과 계산
  let aluOpLabel = dp?.control_signals?.alu_op || opcode.toUpperCase();
  let aluSymbol = "+";
  let aluResultHex = dp?.alu?.result ?? rdValHex;

  if (isLoad || isStore) {
    aluOpLabel = "ADDR ADD";
    aluSymbol = "+";
    const calcAddr = (rs1ValDec + (immDec ?? 0)) >>> 0;
    aluResultHex = dp?.alu?.result ?? changedMemAddr ?? toHex32(calcAddr);
  } else if (opcode === "sub") {
    aluOpLabel = "SUB";
    aluSymbol = "−";
  } else if (opcode === "mul") {
    aluOpLabel = "MUL";
    aluSymbol = "×";
  } else if (opcode === "div" || opcode === "divu") {
    aluOpLabel = "DIV";
    aluSymbol = "÷";
  } else if (opcode === "and" || opcode === "andi") {
    aluOpLabel = "AND";
    aluSymbol = "&";
  } else if (opcode === "or" || opcode === "ori") {
    aluOpLabel = "OR";
    aluSymbol = "|";
  } else if (opcode === "xor" || opcode === "xori") {
    aluOpLabel = "XOR";
    aluSymbol = "^";
  } else if (opcode === "sll" || opcode === "slli") {
    aluOpLabel = "SHIFT L";
    aluSymbol = "≪";
  } else if (opcode === "srl" || opcode === "srli" || opcode === "sra" || opcode === "srai") {
    aluOpLabel = "SHIFT R";
    aluSymbol = "≫";
  } else if (isBranch) {
    aluOpLabel = "BRANCH CMP";
    aluSymbol = "==";
  } else if (isJump) {
    aluOpLabel = "PC LINK";
    aluSymbol = "➔";
  } else if (opcode === "lui" || opcode === "li") {
    aluOpLabel = "IMM PASS";
    aluSymbol = "=";
  }

  const aluResultDec = toSignedDec(aluResultHex);
  const aluInputA = rs1Key ? `${REG_TO_ABI[rs1Key] || rs1Key}(${rs1ValDec})` : opcode === "auipc" || isJump ? pc : "0";
  const aluInputB = rs2Key
    ? `${REG_TO_ABI[rs2Key] || rs2Key}(${rs2ValDec})`
    : immDec !== null
    ? `${immDec}`
    : "0";

  // 메모리 Read / Write 세부 정보
  const memRead = dp?.control_signals?.mem_read ?? isLoad;
  const memWrite = dp?.control_signals?.mem_write ?? isStore;

  let memAddressHex: string | null = null;
  let memDataHex: string | null = null;

  if (memRead) {
    memAddressHex = dp?.data_memory?.read_address ?? aluResultHex;
    memDataHex =
      dp?.data_memory?.read_data ??
      (memAddressHex && afterMem[memAddressHex] ? afterMem[memAddressHex] : rdValHex);
  } else if (memWrite) {
    memAddressHex = dp?.data_memory?.write_address ?? changedMemAddr ?? aluResultHex;
    memDataHex =
      dp?.data_memory?.write_data ??
      (memAddressHex && afterMem[memAddressHex] ? afterMem[memAddressHex] : rs2ValHex);
  }

  const memDataDec = memDataHex ? toSignedDec(memDataHex) : null;
  const pcPlus4Hex = dp?.pc_plus_4 ?? toHex32((parseInt(pc, 16) + 4) >>> 0);
  const branchTaken = Boolean(
    currentData?.cycle_events?.control_hazard?.taken ||
      dp?.control_signals?.pc_src === "branch/jump" ||
      isJump
  );
  const nextPc =
    dp?.next_pc ||
    (branchTaken && currentData?.cycle_events?.control_hazard?.target_pc
      ? currentData.cycle_events.control_hazard.target_pc
      : pcPlus4Hex);

  // 버스 트랜잭션 모드 및 해설 생성
  let txMode: BusTransactionMode = "ALU_ONCHIP";
  let txBadgeText = "ON-CHIP ALU · 내부 레지스터 연산";
  let txSummary = `DRAM(${pc})에서 [${rawAsm}] 인출 ➔ 온칩 ALU 연산(${aluInputA} ${aluSymbol} ${aluInputB} = ${rdValDec}) ➔ 레지스터 ${formatRegLabel(rdKey)}에 저장`;

  if (memRead) {
    txMode = "DRAM_LOAD";
    txBadgeText = "BUS READ (LOAD) · DRAM ➔ On-Chip";
    txSummary = `온칩 ALU가 계산한 주소(${memAddressHex})를 Address Bus로 전송 ➔ DRAM에서 데이터 ${memDataHex}(${memDataDec})를 읽어 Data Bus를 통해 레지스터 ${formatRegLabel(rdKey)}에 적재`;
  } else if (memWrite) {
    txMode = "DRAM_STORE";
    txBadgeText = "BUS WRITE (STORE) · On-Chip ➔ DRAM";
    txSummary = `온칩 ALU가 계산한 주소(${memAddressHex})와 레지스터 ${formatRegLabel(rs2Key)}의 값 ${memDataHex}(${memDataDec})를 System Bus로 전송하여 DRAM에 기록`;
  } else if (isBranch || isJump) {
    txMode = "CONTROL_FLOW";
    txBadgeText = isJump ? "JUMP · 제어 흐름 이동" : branchTaken ? "BRANCH TAKEN · 조건 분기 이동" : "BRANCH NOT TAKEN · 순차 진행";
    txSummary = `DRAM(${pc})에서 [${rawAsm}] 인출 ➔ 온칩에서 분기/점프 주소 계산 후 다음 PC(${nextPc})로 제어 흐름 갱신`;
  }

  return {
    isIdle: false,
    clock,
    pc,
    nextPc,
    assembly: rawAsm,
    rawHex,
    opcode,
    txMode,
    txBadgeText,
    txSummary,
    rs1Key,
    rs1ValHex,
    rs1ValDec,
    rs2Key,
    rs2ValHex,
    rs2ValDec,
    rdKey,
    rdValHex,
    rdValDec,
    regWrite,
    hasImmediate,
    immDec,
    immHex,
    aluOpLabel,
    aluSymbol,
    aluInputA,
    aluInputB,
    aluResultHex,
    aluResultDec,
    memRead,
    memWrite,
    memAddressHex,
    memDataHex,
    memDataDec,
    isBranchOrJump: isBranch || isJump,
    branchTaken,
  };
}

const KEY_WATCH_REGS = ["x1", "x2", "x8", "x10", "x11", "x14", "x15", "x5"];

export const SingleCycleDatapath: React.FC<SingleCycleDatapathProps> = ({
  currentData,
  prevData,
  simulationData,
  loadingMessage,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  const state = useMemo(
    () => resolveSingleCycleState(currentData, prevData, simulationData),
    [currentData, prevData, simulationData]
  );

  // DRAM 코드 영역에 표시할 명령어 슬롯 (현재 PC 주변 4개)
  const codeSlots = useMemo(() => {
    const codeMap = simulationData?.program?.code_mapping;
    if (codeMap && Object.keys(codeMap).length > 0) {
      const sorted = Object.entries(codeMap)
        .sort((a, b) => parseInt(a[0], 16) - parseInt(b[0], 16))
        .map(([addr, item]) => ({
          pc: addr,
          assembly: item.assembly,
          raw: item.raw_instruction || "0x00000013",
        }));
      const activeIdx = sorted.findIndex(
        (item) => item.pc.toLowerCase() === state.pc.toLowerCase()
      );
      const start = Math.max(0, Math.min(activeIdx === -1 ? 0 : activeIdx - 1, Math.max(0, sorted.length - 4)));
      return sorted.slice(start, start + 4);
    }

    // 폴백: 히스토리에서 추출
    const hist = simulationData?.history ?? [];
    const seen = new Map<string, { pc: string; assembly: string; raw: string }>();
    for (const h of hist) {
      const b = h.buffers?.IF || h.stage_activity?.IF || h.if_stage;
      if (b?.pc && b.assembly && b.assembly !== "empty" && b.assembly !== "bubble") {
        const k = b.pc.toLowerCase();
        if (!seen.has(k)) {
          seen.set(k, {
            pc: b.pc,
            assembly: b.assembly,
            raw: b.raw_instruction || "0x00000013",
          });
        }
      }
    }
    const list = Array.from(seen.values());
    if (list.length === 0) {
      return [{ pc: state.pc, assembly: state.assembly, raw: state.rawHex }];
    }
    const activeIdx = list.findIndex((i) => i.pc.toLowerCase() === state.pc.toLowerCase());
    const start = Math.max(0, Math.min(activeIdx === -1 ? 0 : activeIdx - 1, Math.max(0, list.length - 4)));
    return list.slice(start, start + 4);
  }, [simulationData, state]);

  // DRAM 데이터/스택 영역에 표시할 메모리 슬롯 (최대 5개, 현재 접근 중인 주소 우선 포함)
  const dataSlots = useMemo(() => {
    const snap = currentData?.global_result?.memory_snapshot ?? {};
    const entries = Object.entries(snap)
      .map(([addr, val]) => ({
        addr,
        val,
        dec: toSignedDec(val),
        numAddr: parseInt(addr, 16),
      }))
      .sort((a, b) => b.numAddr - a.numAddr);

    if (state.memAddressHex) {
      const targetLower = state.memAddressHex.toLowerCase();
      const hasTarget = entries.some((e) => e.addr.toLowerCase() === targetLower);
      if (!hasTarget && state.memDataHex) {
        entries.unshift({
          addr: state.memAddressHex,
          val: state.memDataHex,
          dec: state.memDataDec ?? 0,
          numAddr: parseInt(state.memAddressHex, 16),
        });
      }
    }

    return entries.slice(0, 5);
  }, [currentData, state]);

  // 온칩 핵심 레지스터 스냅샷 (현재 명령어의 rs1, rs2, rd가 항상 보이도록 보장)
  const watchRegisters = useMemo(() => {
    const regs = currentData?.global_result?.registers ?? {};
    const activeSet = new Set<string>();
    if (state.rs1Key) activeSet.add(state.rs1Key);
    if (state.rs2Key) activeSet.add(state.rs2Key);
    if (state.rdKey) activeSet.add(state.rdKey);

    const orderedKeys = [...activeSet];
    for (const k of KEY_WATCH_REGS) {
      if (orderedKeys.length >= 6) break;
      if (!orderedKeys.includes(k)) orderedKeys.push(k);
    }

    return orderedKeys.slice(0, 6).map((key) => {
      const hex = regs[key] ?? "0x00000000";
      return {
        key,
        abi: REG_TO_ABI[key] ?? key,
        hex,
        dec: toSignedDec(hex),
        isRs1: state.rs1Key === key,
        isRs2: state.rs2Key === key,
        isRd: state.rdKey === key && state.regWrite,
      };
    });
  }, [currentData, state]);

  if (loadingMessage) {
    return (
      <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] p-6 flex flex-col items-center justify-center gap-3 text-center transition-colors duration-150">
        <div className="w-9 h-9 border-3 border-[var(--ar-accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-[var(--ar-accent)]">{loadingMessage}</p>
        <p className="text-xs text-[var(--ar-text-muted)]">
          싱글 사이클 온칩(On-Chip) 및 DRAM 버스 시뮬레이션 데이터를 준비하고 있습니다.
        </p>
      </div>
    );
  }

  if (!currentData) {
    return (
      <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] p-6 flex items-center justify-center text-[var(--ar-text-muted)] text-sm transition-colors duration-150">
        C 소스 코드를 작성하고 [⚡ 컴파일]을 누르면 싱글 사이클 데이터패스(On-Chip ↔ Bus ↔ DRAM)가 활성화됩니다.
      </div>
    );
  }

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(2.0, +(prev + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.6, +(prev - 0.15).toFixed(2)));
  const handleZoomReset = () => setZoomLevel(1.0);

  const isBusInstActive = !state.isIdle;
  const isBusLoadActive = state.txMode === "DRAM_LOAD";
  const isBusStoreActive = state.txMode === "DRAM_STORE";
  const isOnChipAluWriteBack = !state.isIdle && state.regWrite && !state.memRead;

  return (
    <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] flex flex-col justify-between overflow-hidden relative select-none min-h-0 transition-colors duration-150">
      {/* 버스 데이터 스트리밍 애니메이션 스타일 */}
      <style>{`
        @keyframes busStreamRight {
          from { stroke-dashoffset: 32; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes busStreamLeft {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: 32; }
        }
        @keyframes busStreamDown {
          from { stroke-dashoffset: 28; }
          to { stroke-dashoffset: 0; }
        }
        .bus-flow-right {
          stroke-dasharray: 9 6;
          animation: busStreamRight 0.75s linear infinite;
        }
        .bus-flow-left {
          stroke-dasharray: 9 6;
          animation: busStreamLeft 0.75s linear infinite;
        }
        .bus-flow-down {
          stroke-dasharray: 8 5;
          animation: busStreamDown 0.75s linear infinite;
        }
      `}</style>

      {/* 1. 상단 헤더 & 트랜잭션 상태 뱃지 */}
      <div className="shrink-0 flex items-center justify-between px-3.5 py-1.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 border-l-2 border-l-sky-500">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold text-sky-500">◆</span>
          <h3 className="font-sans text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wide whitespace-nowrap">
            SINGLE-CYCLE ARCHITECTURE (ON-CHIP ↔ BUS ↔ DRAM)
          </h3>
          <span className="text-[10px] text-[var(--ar-text-muted)] font-mono">
            (CLK:{state.clock})
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
              state.txMode === "DRAM_LOAD"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                : state.txMode === "DRAM_STORE"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40"
                : state.txMode === "ALU_ONCHIP"
                ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40"
                : state.txMode === "CONTROL_FLOW"
                ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40"
                : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-400/30"
            }`}
          >
            {state.txBadgeText}
          </span>

          <div className="flex items-center bg-[#F6F8FA] dark:bg-[#252526] border border-[#D0D7DE] dark:border-[#3E3E42] rounded px-1 py-0.5 text-[#57606A] dark:text-[#CCCCCC] text-[10px]">
            <button
              type="button"
              onClick={handleZoomOut}
              className="px-1 hover:text-[#005FB8] dark:hover:text-[#007ACC] font-bold cursor-pointer"
              title="축소"
            >
              −
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              className="px-1 font-mono font-semibold hover:text-[#005FB8] dark:hover:text-[#007ACC] cursor-pointer"
              title="100% 리셋"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="px-1 hover:text-[#005FB8] dark:hover:text-[#007ACC] font-bold cursor-pointer"
              title="확대"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* 2. 상단 현재 클록 데이터 흐름 요약 바 */}
      <div className="shrink-0 px-3.5 py-1.5 bg-[#F8FAFC] dark:bg-[#181B22] border-b border-[var(--ar-border)] flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 min-w-0 truncate">
          <span className="px-1.5 py-0.5 rounded bg-sky-600 text-white font-mono text-[10px] font-bold shrink-0">
            {state.isIdle ? "STEP 0" : `STEP ${state.clock}`}
          </span>
          <code className="font-mono font-bold text-[#005FB8] dark:text-[#38BDF8] shrink-0">
            {state.assembly}
          </code>
          <span className="text-[var(--ar-text-muted)] truncate">{state.txSummary}</span>
        </div>
        <span className="font-mono text-[10px] text-[var(--ar-text-muted)] shrink-0">
          PC: {state.pc} ➔ {state.nextPc}
        </span>
      </div>

      {/* 3. 메인 온칩(CPU) ↔ 시스템 버스 ↔ DRAM 다이어그램 (SVG) */}
      <div className="flex-1 overflow-auto relative w-full min-h-0 p-2 custom-scrollbar flex">
        <div
          className="m-auto shrink-0 transition-[height,width] duration-150"
          style={{
            width: `${zoomLevel * 100}%`,
            height: `${zoomLevel * 100}%`,
          }}
        >
          <svg
            viewBox="0 0 1000 920"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full select-none block"
          >
            <defs>
              <marker id="sc-arr-muted" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#94A3B8" />
              </marker>
              <marker id="sc-arr-blue" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#0284C7" />
              </marker>
              <marker id="sc-arr-indigo" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#4F46E5" />
              </marker>
              <marker id="sc-arr-emerald" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#059669" />
              </marker>
              <marker id="sc-arr-amber" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#D97706" />
              </marker>

              <linearGradient id="sc-onchip-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F8FAFC" />
                <stop offset="100%" stopColor="#EFF6FF" />
              </linearGradient>
              <linearGradient id="sc-dram-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F8FAFC" />
                <stop offset="100%" stopColor="#ECFDF5" />
              </linearGradient>
              <linearGradient id="sc-alu-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FEF3C7" />
                <stop offset="100%" stopColor="#FDE68A" />
              </linearGradient>
            </defs>

            {/* ============================================================== */}
            {/* [ZONE 1] 상단: ON-CHIP (CPU CORE : PC + REGISTER FILE + ALU)    */}
            {/* ============================================================== */}
            <rect
              x="24"
              y="16"
              width="952"
              height="430"
              rx="16"
              fill="url(#sc-onchip-bg)"
              stroke="#0284C7"
              strokeWidth="2.5"
            />
            {/* 온칩 타이틀 바 */}
            <rect x="24" y="16" width="952" height="36" rx="14" fill="#0284C7" />
            <text x="44" y="39" fill="#FFFFFF" fontSize="13.5" fontWeight="800" letterSpacing="0.6">
              ON-CHIP : RISC-V CPU CORE (레지스터 파일 + ALU 연산기 + 제어 유닛)
            </text>
            <text x="956" y="39" fill="#E0F2FE" fontSize="11.5" fontFamily="monospace" fontWeight="700" textAnchor="end">
              Single-Cycle 1 CPI Engine
            </text>

            {/* -------------------------------------------------------------- */}
            {/* 1-A. 좌측: PC & 명령어 디코더 (Instruction Register & Control)  */}
            {/* -------------------------------------------------------------- */}
            <rect
              x="44"
              y="68"
              width="225"
              height="155"
              rx="12"
              fill="#FFFFFF"
              stroke={isBusInstActive ? "#4F46E5" : "#CBD5E1"}
              strokeWidth="2"
            />
            <text x="60" y="90" fill="#4338CA" fontSize="12" fontWeight="800">
              1. PC &amp; 명령어 인출 제어
            </text>
            {/* 현재 PC 박스 */}
            <rect x="60" y="100" width="193" height="50" rx="8" fill="#EEF2FF" stroke="#818CF8" strokeWidth="1.5" />
            <text x="72" y="118" fill="#4338CA" fontSize="10.5" fontWeight="700">
              현재 PC (명령어 주소)
            </text>
            <text x="72" y="138" fill="#1E1B4B" fontSize="14" fontFamily="monospace" fontWeight="800">
              {state.pc}
            </text>
            {/* Next PC 표시 */}
            <rect x="60" y="158" width="193" height="50" rx="8" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.2" />
            <text x="72" y="176" fill="#64748B" fontSize="10" fontWeight="700">
              다음 클록 PC ({state.branchTaken ? "Branch/Jump 이동" : "PC + 4 순차"})
            </text>
            <text x="72" y="196" fill={state.branchTaken ? "#7C3AED" : "#334155"} fontSize="13" fontFamily="monospace" fontWeight="800">
              {state.nextPc}
            </text>

            {/* 하단: 명령어 디코더 & 즉시값 생성기(ImmGen) */}
            <rect
              x="44"
              y="238"
              width="225"
              height="190"
              rx="12"
              fill="#FFFFFF"
              stroke={isBusInstActive ? "#0284C7" : "#CBD5E1"}
              strokeWidth="2"
            />
            <text x="60" y="260" fill="#0369A1" fontSize="12" fontWeight="800">
              2. 명령어 디코더 (IR / Control)
            </text>
            <rect x="60" y="270" width="193" height="54" rx="8" fill="#F0F9FF" stroke="#38BDF8" strokeWidth="1.5" />
            <text x="72" y="287" fill="#0369A1" fontSize="10" fontFamily="monospace" fontWeight="700">
              기계어: {state.rawHex}
            </text>
            <text x="72" y="309" fill="#0C4A6E" fontSize="13.5" fontFamily="monospace" fontWeight="800">
              {state.assembly}
            </text>

            {/* ImmGen (즉시값) & 제어 신호 요약 */}
            <rect
              x="60"
              y="334"
              width="193"
              height="44"
              rx="8"
              fill={state.hasImmediate ? "#FEFCE8" : "#F8FAFC"}
              stroke={state.hasImmediate ? "#FACC15" : "#E2E8F0"}
              strokeWidth="1.4"
            />
            <text x="72" y="351" fill="#854D0E" fontSize="10" fontWeight="700">
              ImmGen (즉시값 상수 확장)
            </text>
            <text x="72" y="369" fill={state.hasImmediate ? "#713F12" : "#94A3B8"} fontSize="12" fontFamily="monospace" fontWeight="800">
              {state.hasImmediate ? `${state.immDec} (${state.immHex})` : "미사용 (레지스터 연산)"}
            </text>

            {/* 활성 제어 신호 뱃지 줄 */}
            <g transform="translate(60, 388)">
              {[
                { label: "RegWrite", active: state.regWrite, color: "#0284C7" },
                { label: "MemRead", active: state.memRead, color: "#059669" },
                { label: "MemWrite", active: state.memWrite, color: "#D97706" },
              ].map((sig, i) => (
                <g key={sig.label} transform={`translate(${i * 65}, 0)`}>
                  <rect
                    x="0"
                    y="0"
                    width="61"
                    height="24"
                    rx="6"
                    fill={sig.active ? sig.color : "#F1F5F9"}
                    stroke={sig.active ? sig.color : "#CBD5E1"}
                  />
                  <text
                    x="30.5"
                    y="15.5"
                    fill={sig.active ? "#FFFFFF" : "#94A3B8"}
                    fontSize="9.5"
                    fontFamily="monospace"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {sig.label}
                  </text>
                </g>
              ))}
            </g>

            {/* -------------------------------------------------------------- */}
            {/* 1-B. 중앙: REGISTER FILE (32 × 32-bit On-Chip 고속 레지스터)     */}
            {/* -------------------------------------------------------------- */}
            <rect
              x="310"
              y="68"
              width="340"
              height="360"
              rx="12"
              fill="#FFFFFF"
              stroke="#059669"
              strokeWidth="2.2"
            />
            <rect x="310" y="68" width="340" height="32" rx="10" fill="#ECFDF5" />
            <text x="326" y="89" fill="#065F46" fontSize="12.5" fontWeight="800">
              3. REGISTER FILE (온칩 레지스터 32개)
            </text>
            <text x="636" y="89" fill="#047857" fontSize="10.5" fontFamily="monospace" fontWeight="700" textAnchor="end">
              x0 ~ x31
            </text>

            {/* Read / Write 포트 카드 3개 (rs1, rs2, rd) */}
            {/* Read Port 1 (rs1) */}
            <rect
              x="326"
              y="110"
              width="308"
              height="50"
              rx="8"
              fill={state.rs1Key ? "#EFF6FF" : "#F8FAFC"}
              stroke={state.rs1Key ? "#3B82F6" : "#E2E8F0"}
              strokeWidth="1.6"
            />
            <text x="338" y="128" fill="#1D4ED8" fontSize="10" fontWeight="800">
              READ PORT 1 (rs1 · 소스 1)
            </text>
            <text x="338" y="148" fill="#1E293B" fontSize="12.5" fontFamily="monospace" fontWeight="800">
              {formatRegLabel(state.rs1Key)}
            </text>
            <text x="622" y="146" fill="#1D4ED8" fontSize="12.5" fontFamily="monospace" fontWeight="800" textAnchor="end">
              {state.rs1Key ? `${state.rs1ValDec} (${state.rs1ValHex})` : "—"}
            </text>

            {/* Read Port 2 (rs2) */}
            <rect
              x="326"
              y="168"
              width="308"
              height="50"
              rx="8"
              fill={state.rs2Key ? "#EFF6FF" : "#F8FAFC"}
              stroke={state.rs2Key ? "#3B82F6" : "#E2E8F0"}
              strokeWidth="1.6"
            />
            <text x="338" y="186" fill="#1D4ED8" fontSize="10" fontWeight="800">
              READ PORT 2 (rs2 · 소스 2 / Store 데이터)
            </text>
            <text x="338" y="206" fill="#1E293B" fontSize="12.5" fontFamily="monospace" fontWeight="800">
              {formatRegLabel(state.rs2Key)}
            </text>
            <text x="622" y="204" fill="#1D4ED8" fontSize="12.5" fontFamily="monospace" fontWeight="800" textAnchor="end">
              {state.rs2Key ? `${state.rs2ValDec} (${state.rs2ValHex})` : "—"}
            </text>

            {/* Write Port (rd) */}
            <rect
              x="326"
              y="226"
              width="308"
              height="54"
              rx="8"
              fill={state.regWrite ? "#ECFDF5" : "#F8FAFC"}
              stroke={state.regWrite ? "#10B981" : "#E2E8F0"}
              strokeWidth="1.8"
            />
            <text x="338" y="244" fill="#047857" fontSize="10" fontWeight="800">
              WRITE PORT (rd · 결과 저장 레지스터) {state.memRead ? "⬅ [DRAM Load]" : state.regWrite ? "⬅ [ALU 결과]" : ""}
            </text>
            <text x="338" y="266" fill="#064E3B" fontSize="12.5" fontFamily="monospace" fontWeight="800">
              {state.regWrite ? formatRegLabel(state.rdKey) : "쓰기 없음 (RegWrite=0)"}
            </text>
            <text x="622" y="266" fill="#059669" fontSize="12.5" fontFamily="monospace" fontWeight="800" textAnchor="end">
              {state.regWrite ? `${state.rdValDec} (${state.rdValHex})` : "—"}
            </text>

            {/* 하단: 실시간 주요 레지스터 미니 그리드 (6개) */}
            <text x="326" y="298" fill="#64748B" fontSize="10" fontWeight="700">
              실시간 주요 레지스터 스냅샷 (읽기: 파란색 / 쓰기: 초록색)
            </text>
            {watchRegisters.map((reg, idx) => {
              const col = idx % 3;
              const row = Math.floor(idx / 3);
              const rx = 326 + col * 104;
              const ry = 306 + row * 54;
              const borderCol = reg.isRd
                ? "#10B981"
                : reg.isRs1 || reg.isRs2
                ? "#3B82F6"
                : "#E2E8F0";
              const bgCol = reg.isRd
                ? "#D1FAE5"
                : reg.isRs1 || reg.isRs2
                ? "#DBEAFE"
                : "#F8FAFC";
              return (
                <g key={reg.key} transform={`translate(${rx}, ${ry})`}>
                  <rect x="0" y="0" width="98" height="46" rx="7" fill={bgCol} stroke={borderCol} strokeWidth="1.5" />
                  <text x="8" y="17" fill="#334155" fontSize="10.5" fontFamily="monospace" fontWeight="800">
                    {reg.abi} ({reg.key})
                  </text>
                  <text x="90" y="17" fill="#0F172A" fontSize="10.5" fontFamily="monospace" fontWeight="800" textAnchor="end">
                    {reg.dec}
                  </text>
                  <text x="8" y="36" fill="#64748B" fontSize="9.5" fontFamily="monospace">
                    {reg.hex}
                  </text>
                </g>
              );
            })}

            {/* -------------------------------------------------------------- */}
            {/* 1-C. 우측: ON-CHIP ALU (산술/논리 연산 및 메모리 주소 계산기)    */}
            {/* -------------------------------------------------------------- */}
            <rect
              x="695"
              y="68"
              width="260"
              height="360"
              rx="12"
              fill="#FFFFFF"
              stroke="#D97706"
              strokeWidth="2.2"
            />
            <rect x="695" y="68" width="260" height="32" rx="10" fill="#FEF3C7" />
            <text x="711" y="89" fill="#92400E" fontSize="12.5" fontWeight="800">
              4. ALU (온칩 산술·논리 연산기)
            </text>

            {/* ALU 사다리꼴/쉐브론 하드웨어 심볼 */}
            <polygon
              points="730,118 920,148 920,252 730,282 730,218 762,200 730,182"
              fill="url(#sc-alu-grad)"
              stroke="#D97706"
              strokeWidth="2.4"
            />
            <text x="838" y="175" fill="#92400E" fontSize="12" fontFamily="monospace" fontWeight="800" textAnchor="middle">
              [{state.aluOpLabel}]
            </text>
            <text x="838" y="203" fill="#78350F" fontSize="13.5" fontFamily="monospace" fontWeight="800" textAnchor="middle">
              {state.isIdle ? "IDLE" : `${state.aluInputA} ${state.aluSymbol} ${state.aluInputB}`}
            </text>
            <text x="838" y="228" fill="#B45309" fontSize="11.5" fontFamily="monospace" fontWeight="700" textAnchor="middle">
              = {state.aluResultDec}
            </text>

            {/* ALU 출력 결과 카드 */}
            <rect x="713" y="298" width="224" height="54" rx="8" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.6" />
            <text x="725" y="316" fill="#92400E" fontSize="10" fontWeight="800">
              ALU OUTPUT ({state.memRead || state.memWrite ? "DRAM 접근 주소" : "연산 결과값"})
            </text>
            <text x="725" y="338" fill="#78350F" fontSize="13" fontFamily="monospace" fontWeight="800">
              {state.aluResultHex} ({state.aluResultDec})
            </text>

            {/* ALU 결과 목적지 안내 카드 */}
            <rect
              x="713"
              y="362"
              width="224"
              height="52"
              rx="8"
              fill={isOnChipAluWriteBack ? "#ECFDF5" : state.memRead || state.memWrite ? "#EFF6FF" : "#F8FAFC"}
              stroke={isOnChipAluWriteBack ? "#10B981" : state.memRead || state.memWrite ? "#3B82F6" : "#CBD5E1"}
              strokeWidth="1.5"
            />
            <text x="725" y="381" fill="#334155" fontSize="10" fontWeight="800">
              데이터 이동 경로:
            </text>
            <text x="725" y="400" fill="#0F172A" fontSize="11" fontWeight="700">
              {isOnChipAluWriteBack
                ? `온칩 내부 피드백 ➔ ${formatRegLabel(state.rdKey)} 저장`
                : state.memRead || state.memWrite
                ? `Address Bus ➔ DRAM (${state.memAddressHex})`
                : "온칩 PC 제어 흐름 업데이트"}
            </text>

            {/* -------------------------------------------------------------- */}
            {/* 온칩 내부 배선 (Decoder ➔ RegFile ➔ ALU ➔ RegFile 피드백)       */}
            {/* -------------------------------------------------------------- */}
            {/* Decoder ➔ RegFile 제어선 */}
            <line
              x1="269"
              y1="295"
              x2="310"
              y2="295"
              stroke={isBusInstActive ? "#0284C7" : "#CBD5E1"}
              strokeWidth="2.5"
              className={isBusInstActive ? "bus-flow-right" : ""}
              markerEnd={isBusInstActive ? "url(#sc-arr-blue)" : "url(#sc-arr-muted)"}
            />
            {/* RegFile rs1 ➔ ALU Input A */}
            <line
              x1="634"
              y1="145"
              x2="728"
              y2="155"
              stroke={!state.isIdle && state.rs1Key ? "#0284C7" : "#CBD5E1"}
              strokeWidth="2.8"
              className={!state.isIdle && state.rs1Key ? "bus-flow-right" : ""}
              markerEnd={!state.isIdle && state.rs1Key ? "url(#sc-arr-blue)" : "url(#sc-arr-muted)"}
            />
            {/* RegFile rs2 / Imm ➔ ALU Input B */}
            <line
              x1="634"
              y1="205"
              x2="728"
              y2="235"
              stroke={!state.isIdle && (state.rs2Key || state.hasImmediate) ? "#D97706" : "#CBD5E1"}
              strokeWidth="2.8"
              className={!state.isIdle && (state.rs2Key || state.hasImmediate) ? "bus-flow-right" : ""}
              markerEnd={!state.isIdle && (state.rs2Key || state.hasImmediate) ? "url(#sc-arr-amber)" : "url(#sc-arr-muted)"}
            />
            {/* 온칩 내부 ALU Write-Back 루프 (ALU ➔ RegFile Write Port) */}
            <path
              d="M 713 325 L 672 325 L 672 253 L 636 253"
              fill="none"
              stroke={isOnChipAluWriteBack ? "#059669" : "#CBD5E1"}
              strokeWidth={isOnChipAluWriteBack ? "3" : "1.8"}
              className={isOnChipAluWriteBack ? "bus-flow-left" : ""}
              markerEnd={isOnChipAluWriteBack ? "url(#sc-arr-emerald)" : "url(#sc-arr-muted)"}
            />

            {/* ============================================================== */}
            {/* [ZONE 2] 중앙: SYSTEM BUS (ON-CHIP ↔ DRAM 버스 인터페이스)       */}
            {/* ============================================================== */}
            <rect
              x="24"
              y="464"
              width="952"
              height="118"
              rx="14"
              fill="#0F172A"
              stroke="#334155"
              strokeWidth="2"
            />
            <text x="48" y="488" fill="#38BDF8" fontSize="11.5" fontFamily="monospace" fontWeight="800" letterSpacing="0.8">
              SYSTEM BUS INTERCONNECT (온칩 CPU ↔ 오프칩 DRAM 메모리 버스)
            </text>
            <text x="952" y="488" fill="#94A3B8" fontSize="10.5" fontFamily="monospace" textAnchor="end">
              {isBusLoadActive
                ? "ACTIVE: 명령어 인출 + 데이터 메모리 읽기 (LOAD)"
                : isBusStoreActive
                ? "ACTIVE: 명령어 인출 + 데이터 메모리 쓰기 (STORE)"
                : isBusInstActive
                ? "ACTIVE: 명령어 인출만 수행 (데이터 버스는 유휴 상태)"
                : "IDLE: 버스 대기 중"}
            </text>

            {/* [버스 채널 1] 좌측: Instruction & PC Bus (PC ➔ DRAM Code ➔ IR) */}
            <rect
              x="48"
              y="500"
              width="270"
              height="68"
              rx="8"
              fill="#1E293B"
              stroke={isBusInstActive ? "#818CF8" : "#475569"}
              strokeWidth="1.6"
            />
            <text x="62" y="519" fill="#A5B4FC" fontSize="10.5" fontWeight="800">
              ① INSTRUCTION BUS (DRAM ➔ CPU)
            </text>
            <text x="62" y="538" fill="#FFFFFF" fontSize="11.5" fontFamily="monospace" fontWeight="700">
              {isBusInstActive ? `PC ${state.pc} ➔ [${state.assembly}]` : "대기 중"}
            </text>
            <text x="62" y="556" fill="#94A3B8" fontSize="10" fontFamily="monospace">
              기계어 패킷: {state.rawHex}
            </text>

            {/* [버스 채널 2] 중앙: Address Bus (ALU / PC ➔ DRAM) */}
            <rect
              x="342"
              y="500"
              width="280"
              height="68"
              rx="8"
              fill="#1E293B"
              stroke={isBusLoadActive || isBusStoreActive ? "#F59E0B" : "#475569"}
              strokeWidth="1.6"
            />
            <text x="356" y="519" fill="#FCD34D" fontSize="10.5" fontWeight="800">
              ② ADDRESS BUS (CPU ➔ DRAM)
            </text>
            <text x="356" y="538" fill="#FFFFFF" fontSize="11.5" fontFamily="monospace" fontWeight="700">
              {state.memAddressHex
                ? `데이터 타겟 주소: ${state.memAddressHex}`
                : `명령어 주소: ${state.pc}`}
            </text>
            <text x="356" y="556" fill="#94A3B8" fontSize="10" fontFamily="monospace">
              {state.memAddressHex
                ? `ALU 계산 (${state.rs1ValHex} + ${state.immDec ?? 0})`
                : "데이터 메모리 접근 없음 (On-Chip 연산)"}
            </text>

            {/* [버스 채널 3] 우측: Data Bus (CPU RegFile ⇄ DRAM Data/Stack) */}
            <rect
              x="646"
              y="500"
              width="306"
              height="68"
              rx="8"
              fill="#1E293B"
              stroke={
                isBusLoadActive
                  ? "#10B981"
                  : isBusStoreActive
                  ? "#F97316"
                  : "#475569"
              }
              strokeWidth="2"
            />
            <text
              x="660"
              y="519"
              fill={
                isBusLoadActive
                  ? "#34D399"
                  : isBusStoreActive
                  ? "#FB923C"
                  : "#94A3B8"
              }
              fontSize="10.5"
              fontWeight="800"
            >
              ③ DATA BUS (양방향 데이터 전송 ⇄)
            </text>
            <text x="660" y="538" fill="#FFFFFF" fontSize="12" fontFamily="monospace" fontWeight="800">
              {isBusLoadActive
                ? `◀ LOAD: ${state.memDataHex} (${state.memDataDec}) ➔ ${formatRegLabel(state.rdKey)}`
                : isBusStoreActive
                ? `▶ STORE: ${formatRegLabel(state.rs2Key)} (${state.memDataDec}) ➔ DRAM`
                : "IDLE (데이터 버스 전송 없음)"}
            </text>
            <text x="660" y="556" fill="#94A3B8" fontSize="10" fontFamily="monospace">
              {isBusLoadActive
                ? "DRAM에서 읽은 워드가 온칩 레지스터로 유입됨"
                : isBusStoreActive
                ? `온칩 레지스터 값을 DRAM[${state.memAddressHex}]에 기록`
                : "온칩 레지스터 ↔ ALU 내부에서만 데이터 이동"}
            </text>

            {/* 수직 버스 파이프 배선 (On-Chip ↔ System Bus ↔ DRAM) */}
            {/* 1) 명령어 인출 파이프 (DRAM Code ➔ System Bus ➔ On-Chip IR) */}
            <line
              x1="160"
              y1="600"
              x2="160"
              y2="568"
              stroke={isBusInstActive ? "#6366F1" : "#CBD5E1"}
              strokeWidth="3.5"
              className={isBusInstActive ? "bus-flow-left" : ""}
            />
            <line
              x1="160"
              y1="500"
              x2="160"
              y2="428"
              stroke={isBusInstActive ? "#6366F1" : "#CBD5E1"}
              strokeWidth="3.5"
              className={isBusInstActive ? "bus-flow-left" : ""}
              markerEnd={isBusInstActive ? "url(#sc-arr-indigo)" : "url(#sc-arr-muted)"}
            />

            {/* 2) 주소 버스 파이프 (On-Chip ALU ➔ System Bus ➔ DRAM Data) */}
            <path
              d="M 825 428 L 825 452 L 482 452 L 482 500"
              fill="none"
              stroke={isBusLoadActive || isBusStoreActive ? "#D97706" : "#CBD5E1"}
              strokeWidth="3"
              className={isBusLoadActive || isBusStoreActive ? "bus-flow-down" : ""}
            />
            <line
              x1="482"
              y1="568"
              x2="482"
              y2="600"
              stroke={isBusLoadActive || isBusStoreActive ? "#D97706" : "#CBD5E1"}
              strokeWidth="3"
              className={isBusLoadActive || isBusStoreActive ? "bus-flow-down" : ""}
              markerEnd={isBusLoadActive || isBusStoreActive ? "url(#sc-arr-amber)" : "url(#sc-arr-muted)"}
            />

            {/* 3) 데이터 버스 파이프 (On-Chip RegFile ⇄ System Bus ⇄ DRAM Data) */}
            {isBusLoadActive ? (
              <>
                {/* DRAM ➔ System Bus ➔ RegFile Write Port */}
                <line
                  x1="780"
                  y1="600"
                  x2="780"
                  y2="568"
                  stroke="#059669"
                  strokeWidth="4"
                  className="bus-flow-left"
                />
                <path
                  d="M 780 500 L 780 456 L 480 456 L 480 428"
                  fill="none"
                  stroke="#059669"
                  strokeWidth="4"
                  className="bus-flow-left"
                  markerEnd="url(#sc-arr-emerald)"
                />
              </>
            ) : isBusStoreActive ? (
              <>
                {/* RegFile rs2 ➔ System Bus ➔ DRAM */}
                <path
                  d="M 480 428 L 480 456 L 780 456 L 780 500"
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="4"
                  className="bus-flow-down"
                />
                <line
                  x1="780"
                  y1="568"
                  x2="780"
                  y2="600"
                  stroke="#D97706"
                  strokeWidth="4"
                  className="bus-flow-down"
                  markerEnd="url(#sc-arr-amber)"
                />
              </>
            ) : (
              <>
                <line x1="780" y1="428" x2="780" y2="500" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 4" />
                <line x1="780" y1="568" x2="780" y2="600" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 4" />
              </>
            )}

            {/* ============================================================== */}
            {/* [ZONE 3] 하단: OFF-CHIP DRAM (명령어 영역 + 데이터/스택 영역)     */}
            {/* ============================================================== */}
            <rect
              x="24"
              y="600"
              width="952"
              height="304"
              rx="16"
              fill="url(#sc-dram-bg)"
              stroke="#059669"
              strokeWidth="2.5"
            />
            <rect x="24" y="600" width="952" height="36" rx="14" fill="#059669" />
            <text x="44" y="623" fill="#FFFFFF" fontSize="13.5" fontWeight="800" letterSpacing="0.6">
              OFF-CHIP : DRAM MAIN MEMORY (코드 세그먼트 &amp; 데이터/스택 메모리 뱅크)
            </text>
            <text x="956" y="623" fill="#D1FAE5" fontSize="11.5" fontFamily="monospace" fontWeight="700" textAnchor="end">
              32-Bit Word Addressable DRAM
            </text>

            {/* -------------------------------------------------------------- */}
            {/* 3-A. 좌측: DRAM CODE SEGMENT (.text 명령어 메모리 뱅크)           */}
            {/* -------------------------------------------------------------- */}
            <rect
              x="44"
              y="650"
              width="430"
              height="238"
              rx="12"
              fill="#FFFFFF"
              stroke="#6366F1"
              strokeWidth="2"
            />
            <rect x="44" y="650" width="430" height="30" rx="10" fill="#EEF2FF" />
            <text x="60" y="670" fill="#3730A3" fontSize="12" fontWeight="800">
              DRAM Bank A : Instruction Memory (.text 코드 영역)
            </text>
            <text x="458" y="670" fill="#4F46E5" fontSize="10" fontFamily="monospace" fontWeight="700" textAnchor="end">
              Read-Only Fetch
            </text>

            {codeSlots.map((slot, idx) => {
              const isCurrentPc = !state.isIdle && slot.pc.toLowerCase() === state.pc.toLowerCase();
              const y = 690 + idx * 46;
              return (
                <g key={`${slot.pc}-${idx}`} transform={`translate(58, ${y})`}>
                  <rect
                    x="0"
                    y="0"
                    width="402"
                    height="40"
                    rx="7"
                    fill={isCurrentPc ? "#EEF2FF" : "#F8FAFC"}
                    stroke={isCurrentPc ? "#4F46E5" : "#E2E8F0"}
                    strokeWidth={isCurrentPc ? "2" : "1.2"}
                  />
                  <text
                    x="12"
                    y="25"
                    fill={isCurrentPc ? "#4338CA" : "#64748B"}
                    fontSize="11.5"
                    fontFamily="monospace"
                    fontWeight="800"
                  >
                    {slot.pc}
                  </text>
                  <text
                    x="115"
                    y="25"
                    fill={isCurrentPc ? "#1E1B4B" : "#334155"}
                    fontSize="12.5"
                    fontFamily="monospace"
                    fontWeight="800"
                  >
                    {slot.assembly}
                  </text>
                  {isCurrentPc && (
                    <g transform="translate(318, 9)">
                      <rect x="0" y="0" width="74" height="22" rx="5" fill="#4F46E5" />
                      <text x="37" y="15" fill="#FFFFFF" fontSize="9.5" fontFamily="monospace" fontWeight="800" textAnchor="middle">
                        ▲ FETCH
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* -------------------------------------------------------------- */}
            {/* 3-B. 우측: DRAM DATA & STACK SEGMENT (.data / .stack 뱅크)       */}
            {/* -------------------------------------------------------------- */}
            <rect
              x="498"
              y="650"
              width="458"
              height="238"
              rx="12"
              fill="#FFFFFF"
              stroke={
                isBusLoadActive
                  ? "#10B981"
                  : isBusStoreActive
                  ? "#D97706"
                  : "#CBD5E1"
              }
              strokeWidth="2"
            />
            <rect
              x="498"
              y="650"
              width="458"
              height="30"
              rx="10"
              fill={
                isBusLoadActive
                  ? "#ECFDF5"
                  : isBusStoreActive
                  ? "#FEF3C7"
                  : "#F1F5F9"
              }
            />
            <text
              x="514"
              y="670"
              fill={
                isBusLoadActive
                  ? "#065F46"
                  : isBusStoreActive
                  ? "#92400E"
                  : "#334155"
              }
              fontSize="12"
              fontWeight="800"
            >
              DRAM Bank B : Data &amp; Stack Memory (.data / .stack 영역)
            </text>
            <text
              x="940"
              y="670"
              fill={
                isBusLoadActive
                  ? "#059669"
                  : isBusStoreActive
                  ? "#D97706"
                  : "#64748B"
              }
              fontSize="10"
              fontFamily="monospace"
              fontWeight="700"
              textAnchor="end"
            >
              {isBusLoadActive
                ? "MEM READ (Load)"
                : isBusStoreActive
                ? "MEM WRITE (Store)"
                : "IDLE (No Access)"}
            </text>

            {dataSlots.length === 0 ? (
              <g transform="translate(514, 710)">
                <rect x="0" y="0" width="426" height="150" rx="10" fill="#F8FAFC" stroke="#E2E8F0" strokeDasharray="5 4" />
                <text x="213" y="70" fill="#64748B" fontSize="12" fontWeight="700" textAnchor="middle">
                  아직 기록된 데이터/스택 메모리 워드가 없습니다.
                </text>
                <text x="213" y="92" fill="#94A3B8" fontSize="11" textAnchor="middle">
                  sw(Store) 또는 lw(Load) 명령어 실행 시 이곳의 DRAM 슬롯과 데이터 버스가 활성화됩니다.
                </text>
              </g>
            ) : (
              dataSlots.slice(0, 4).map((slot, idx) => {
                const isTarget =
                  Boolean(state.memAddressHex) &&
                  slot.addr.toLowerCase() === state.memAddressHex?.toLowerCase();
                const y = 690 + idx * 46;
                const rowBg = isTarget
                  ? isBusLoadActive
                    ? "#ECFDF5"
                    : "#FEF3C7"
                  : "#F8FAFC";
                const rowBorder = isTarget
                  ? isBusLoadActive
                    ? "#10B981"
                    : "#D97706"
                  : "#E2E8F0";

                return (
                  <g key={slot.addr} transform={`translate(514, ${y})`}>
                    <rect
                      x="0"
                      y="0"
                      width="426"
                      height="40"
                      rx="7"
                      fill={rowBg}
                      stroke={rowBorder}
                      strokeWidth={isTarget ? "2.2" : "1.2"}
                    />
                    <text
                      x="12"
                      y="25"
                      fill={isTarget ? "#0F172A" : "#64748B"}
                      fontSize="11.5"
                      fontFamily="monospace"
                      fontWeight="800"
                    >
                      addr: {slot.addr}
                    </text>
                    <text
                      x="175"
                      y="25"
                      fill={isTarget ? "#0F172A" : "#334155"}
                      fontSize="12"
                      fontFamily="monospace"
                      fontWeight="800"
                    >
                      val: {slot.val} ({slot.dec})
                    </text>
                    {isTarget && (
                      <g transform="translate(334, 9)">
                        <rect
                          x="0"
                          y="0"
                          width="82"
                          height="22"
                          rx="5"
                          fill={isBusLoadActive ? "#059669" : "#D97706"}
                        />
                        <text
                          x="41"
                          y="15"
                          fill="#FFFFFF"
                          fontSize="9.5"
                          fontFamily="monospace"
                          fontWeight="800"
                          textAnchor="middle"
                        >
                          {isBusLoadActive ? "▲ BUS READ" : "▼ BUS WRITE"}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};

export default SingleCycleDatapath;
