import React, { useMemo, useState } from "react";
import type { CycleHistoryItem, SimulationResult, SingleCycleRegisterSignal } from "@/type/simulation";

interface SingleCycleDatapathProps {
  currentData: CycleHistoryItem | null;
  prevData?: CycleHistoryItem | null;
  simulationData?: SimulationResult | null;
  loadingMessage?: string | null;
}

const ABI_NAMES = [
  "zero", "ra", "sp", "gp", "tp", "t0", "t1", "t2",
  "s0", "s1", "a0", "a1", "a2", "a3", "a4", "a5",
  "a6", "a7", "s2", "s3", "s4", "s5", "s6", "s7",
  "s8", "s9", "s10", "s11", "t3", "t4", "t5", "t6",
];

const REG_TO_ABI: Record<string, string> = Object.fromEntries(
  ABI_NAMES.map((name, i) => [`x${i}`, name])
);

const ABI_TO_REG: Record<string, string> = {
  ...Object.fromEntries(ABI_NAMES.map((name, i) => [name, `x${i}`])),
  fp: "x8",
};

const ALU_OP_MAP: Record<string, { label: string; symbol: string }> = {
  sub: { label: "SUB", symbol: "−" },
  mul: { label: "MUL", symbol: "×" },
  div: { label: "DIV", symbol: "÷" },
  divu: { label: "DIV", symbol: "÷" },
  and: { label: "AND", symbol: "&" },
  andi: { label: "AND", symbol: "&" },
  or: { label: "OR", symbol: "|" },
  ori: { label: "OR", symbol: "|" },
  xor: { label: "XOR", symbol: "^" },
  xori: { label: "XOR", symbol: "^" },
  sll: { label: "SLL", symbol: "≪" },
  slli: { label: "SLL", symbol: "≪" },
  srl: { label: "SRL", symbol: "≫" },
  srli: { label: "SRL", symbol: "≫" },
  sra: { label: "SRL", symbol: "≫" },
  srai: { label: "SRL", symbol: "≫" },
  lui: { label: "PASS", symbol: "=" },
  li: { label: "PASS", symbol: "=" },
};

function isValidRegKey(key: string | undefined | null): key is string {
  return typeof key === "string" && /^x([0-9]|[12][0-9]|3[01])$/.test(key);
}

function normalizeRegKey(token: string | undefined | null): string | null {
  if (!token) return null;
  const clean = token.trim().toLowerCase();
  if (isValidRegKey(clean)) return clean;
  return ABI_TO_REG[clean] ?? null;
}

function extractSignalRegKey(sig: SingleCycleRegisterSignal | null | undefined): string | null {
  if (!sig) return null;
  if (typeof sig.index === "number" && Number.isInteger(sig.index) && sig.index >= 0 && sig.index <= 31) {
    return `x${sig.index}`;
  }
  if (typeof sig.name === "string" && sig.name.trim()) {
    return normalizeRegKey(sig.name);
  }
  return null;
}

function formatRegLabel(regKey: string | null): string {
  if (!isValidRegKey(regKey)) return "—";
  const abi = REG_TO_ABI[regKey];
  return abi ? `${abi} (${regKey})` : regKey;
}

function toSignedDec(hexStr: string | undefined | null): number {
  if (!hexStr) return 0;
  const parsed = parseInt(hexStr, 16);
  return Number.isNaN(parsed) ? 0 : parsed | 0;
}

function toHex32(val: number): string {
  return `0x${(val >>> 0).toString(16).padStart(8, "0")}`;
}

function getResponsiveNumberClass(
  valStr: string,
  baseClass = "text-[16px]",
  midClass = "text-[13px]",
  smallClass = "text-[10.5px]"
): string {
  if (valStr.length > 8) return smallClass;
  if (valStr.length > 5) return midClass;
  return baseClass;
}

function parseImmediateToken(token: string | undefined): number | null {
  if (!token) return null;
  const clean = token.trim();
  const radix = clean.startsWith("0x") || clean.startsWith("-0x") ? 16 : 10;
  const v = parseInt(clean, radix);
  return Number.isNaN(v) ? null : v;
}

export type BusTransactionMode = "IDLE" | "ALU_ONCHIP" | "DRAM_LOAD" | "DRAM_STORE" | "CONTROL_FLOW";

interface ResolvedSingleCycleState {
  isIdle: boolean;
  clock: number;
  pc: string;
  assembly: string;
  opcode: string;
  txMode: BusTransactionMode;
  txBadgeText: string;
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
  hasImmediate: boolean;
  immDec: number | null;
  immHex: string | null;
  aluOpLabel: string;
  aluSymbol: string;
  aluInputALabel: string;
  aluInputAValDec: string;
  aluInputAValHex: string;
  aluInputBLabel: string;
  aluInputBValDec: string;
  aluInputBValHex: string;
  aluResultHex: string;
  aluResultDec: number;
  memRead: boolean;
  memWrite: boolean;
  memAddressHex: string | null;
  memDataHex: string | null;
  memDataDec: number | null;
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

  const beforeRegs = prevData?.global_result?.registers ?? currentData?.global_result?.registers ?? {};
  const afterRegs = currentData?.global_result?.registers ?? {};
  const beforeMem = prevData?.global_result?.memory_snapshot ?? {};
  const afterMem = currentData?.global_result?.memory_snapshot ?? {};

  if (isIdle) {
    return {
      isIdle: true,
      clock: 0,
      pc,
      assembly: "대기 중 (Step 0)",
      opcode: "IDLE",
      txMode: "IDLE",
      txBadgeText: "IDLE",
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
      aluSymbol: "+",
      aluInputALabel: "—",
      aluInputAValDec: "—",
      aluInputAValHex: "",
      aluInputBLabel: "—",
      aluInputBValDec: "—",
      aluInputBValHex: "",
      aluResultHex: "0x00000000",
      aluResultDec: 0,
      memRead: false,
      memWrite: false,
      memAddressHex: null,
      memDataHex: null,
      memDataDec: null,
    };
  }

  const firstSpace = rawAsm.search(/\s/);
  const opcode = (firstSpace === -1 ? rawAsm : rawAsm.slice(0, firstSpace)).toLowerCase();
  const operandStr = firstSpace === -1 ? "" : rawAsm.slice(firstSpace).trim();
  const operands = operandStr ? operandStr.split(",").map((s) => s.trim()) : [];

  const isLoad = /^(lw|lh|lhu|lb|lbu)$/.test(opcode);
  const isStore = /^(sw|sh|sb)$/.test(opcode);
  const isBranch = /^(beq|bne|blt|bge|bltu|bgeu|beqz|bnez|bltz|bgez|blez|bgtz)$/.test(opcode);
  const isJump = /^(jal|jalr|j|jr|ret|call|tail)$/.test(opcode);

  let rs1Key: string | null = extractSignalRegKey(dp?.registers?.rs1);
  let rs2Key: string | null = extractSignalRegKey(dp?.registers?.rs2);
  let rdKey: string | null = extractSignalRegKey(dp?.registers?.rd);
  let immDec: number | null =
    typeof dp?.immediate?.decimal === "number" && !Number.isNaN(dp.immediate.decimal)
      ? dp.immediate.decimal
      : null;

  if (!rs1Key && !rs2Key && !rdKey) {
    if ((isLoad || isStore) && operands.length >= 2) {
      if (isLoad) rdKey = normalizeRegKey(operands[0]);
      if (isStore) rs2Key = normalizeRegKey(operands[0]);
      const memMatch = operands[1].match(/^(-?(?:0x[0-9a-fA-F]+|\d+)?)\(([^)]+)\)$/);
      if (memMatch) {
        immDec = parseImmediateToken(memMatch[1] || "0");
        rs1Key = normalizeRegKey(memMatch[2]);
      }
    } else if (isBranch) {
      rs1Key = normalizeRegKey(operands[0]);
      if (operands.length === 3) {
        rs2Key = normalizeRegKey(operands[1]);
        immDec = parseImmediateToken(operands[2]);
      } else {
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
      rdKey = operands.length === 1 ? "x1" : normalizeRegKey(operands[0]);
      immDec = parseImmediateToken(operands[operands.length - 1]);
    } else if (opcode === "jalr") {
      rdKey = operands.length === 1 ? "x1" : normalizeRegKey(operands[0]);
      if (operands.length === 1) {
        rs1Key = normalizeRegKey(operands[0]);
        immDec = 0;
      } else {
        const memMatch = operands[1].match(/^(-?(?:0x[0-9a-fA-F]+|\d+)?)\(([^)]+)\)$/);
        if (memMatch) {
          immDec = parseImmediateToken(memMatch[1] || "0");
          rs1Key = normalizeRegKey(memMatch[2]);
        } else {
          rs1Key = normalizeRegKey(operands[1]);
          immDec = operands[2] ? parseImmediateToken(operands[2]) : 0;
        }
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
      if (thirdReg) rs2Key = thirdReg;
      else immDec = parseImmediateToken(operands[2]);
    }
  }

  if (!isValidRegKey(rs1Key)) rs1Key = null;
  if (!isValidRegKey(rs2Key)) rs2Key = null;
  if (!isValidRegKey(rdKey)) rdKey = null;

  const rs1ValHex = dp?.registers?.rs1?.value ?? (rs1Key ? beforeRegs[rs1Key] ?? "0x00000000" : "0x00000000");
  const rs2ValHex = dp?.registers?.rs2?.value ?? (rs2Key ? beforeRegs[rs2Key] ?? "0x00000000" : "0x00000000");
  const rdValHex = rdKey ? afterRegs[rdKey] ?? dp?.registers?.rd?.value ?? "0x00000000" : "0x00000000";

  const rs1ValDec = toSignedDec(rs1ValHex);
  const rs2ValDec = toSignedDec(rs2ValHex);
  const rdValDec = toSignedDec(rdValHex);

  const regWrite = dp?.control_signals?.reg_write ?? Boolean(rdKey && rdKey !== "x0");
  const hasImmediate = immDec !== null;
  const immHex = immDec !== null ? dp?.immediate?.hex ?? toHex32(immDec) : null;

  let changedMemAddr: string | null = null;
  for (const [addr, val] of Object.entries(afterMem)) {
    if (beforeMem[addr] !== val) {
      changedMemAddr = addr;
      break;
    }
  }

  let aluOpLabel = dp?.control_signals?.alu_op || opcode.toUpperCase();
  let aluSymbol = "+";
  let aluResultHex = dp?.alu?.result ?? rdValHex;

  if (isLoad || isStore) {
    aluOpLabel = "ADDR +";
    aluSymbol = "+";
    const calcAddr = (rs1ValDec + (immDec ?? 0)) >>> 0;
    aluResultHex = dp?.alu?.result ?? changedMemAddr ?? toHex32(calcAddr);
  } else if (isBranch) {
    aluOpLabel = "CMP";
    aluSymbol = "==";
  } else if (isJump) {
    aluOpLabel = "JUMP";
    aluSymbol = "➔";
  } else if (ALU_OP_MAP[opcode]) {
    aluOpLabel = ALU_OP_MAP[opcode].label;
    aluSymbol = ALU_OP_MAP[opcode].symbol;
  }

  const aluResultDec = toSignedDec(aluResultHex);

  const aluInputALabel = rs1Key ? formatRegLabel(rs1Key) : opcode === "auipc" || isJump ? "PC" : "—";
  const aluInputAValDec = rs1Key ? `${rs1ValDec}` : opcode === "auipc" || isJump ? `${toSignedDec(pc)}` : "0";
  const aluInputAValHex = rs1Key ? rs1ValHex : opcode === "auipc" || isJump ? pc : "0x00000000";

  const aluInputBLabel = rs2Key ? formatRegLabel(rs2Key) : immDec !== null ? "Immediate" : "—";
  const aluInputBValDec = rs2Key ? `${rs2ValDec}` : immDec !== null ? `${immDec}` : "0";
  const aluInputBValHex = rs2Key ? rs2ValHex : immHex ?? "0x00000000";

  const memRead = dp?.control_signals?.mem_read ?? isLoad;
  const memWrite = dp?.control_signals?.mem_write ?? isStore;

  let memAddressHex: string | null = null;
  let memDataHex: string | null = null;

  if (memRead) {
    memAddressHex = dp?.data_memory?.read_address ?? aluResultHex;
    memDataHex = dp?.data_memory?.read_data ?? (memAddressHex && afterMem[memAddressHex] ? afterMem[memAddressHex] : rdValHex);
  } else if (memWrite) {
    memAddressHex = dp?.data_memory?.write_address ?? changedMemAddr ?? aluResultHex;
    memDataHex = dp?.data_memory?.write_data ?? (memAddressHex && afterMem[memAddressHex] ? afterMem[memAddressHex] : rs2ValHex);
  }

  const memDataDec = memDataHex ? toSignedDec(memDataHex) : null;

  let txMode: BusTransactionMode = "ALU_ONCHIP";
  let txBadgeText = "ON-CHIP ALU";

  if (memRead) {
    txMode = "DRAM_LOAD";
    txBadgeText = "MEMORY LOAD (DRAM ➔ REG)";
  } else if (memWrite) {
    txMode = "DRAM_STORE";
    txBadgeText = "MEMORY STORE (REG ➔ DRAM)";
  } else if (isBranch || isJump) {
    txMode = "CONTROL_FLOW";
    txBadgeText = "BRANCH / JUMP";
  }

  return {
    isIdle: false,
    clock,
    pc,
    assembly: rawAsm,
    opcode,
    txMode,
    txBadgeText,
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
    aluInputALabel,
    aluInputAValDec,
    aluInputAValHex,
    aluInputBLabel,
    aluInputBValDec,
    aluInputBValHex,
    aluResultHex,
    aluResultDec,
    memRead,
    memWrite,
    memAddressHex,
    memDataHex,
    memDataDec,
  };
}

const KEY_WATCH_REGS = ["x1", "x2", "x8", "x10", "x11", "x14", "x15", "x5"];

interface SvgPortCardProps {
  x: number;
  y: number;
  title: string;
  subTitle: string;
  valDec: string | number;
  valHex: string;
  themeColor: "blue" | "indigo";
  active?: boolean;
}

const SvgPortCard: React.FC<SvgPortCardProps> = ({
  x,
  y,
  title,
  subTitle,
  valDec,
  valHex,
  themeColor,
  active = true,
}) => {
  const isBlue = themeColor === "blue";
  const bgClass = active
    ? isBlue
      ? "fill-[#F0F9FF] dark:fill-[#0C2538] stroke-[#0284C7]"
      : "fill-[#EEF2FF] dark:fill-[#191B38] stroke-[#4F46E5]"
    : "fill-[#F8FAFC] dark:fill-[#161A22] stroke-[#E2E8F0] dark:stroke-[#2C3340]";

  const titleClass = isBlue
    ? "fill-[#0284C7] dark:fill-[#38BDF8]"
    : "fill-[#4F46E5] dark:fill-[#818CF8]";

  const valClass = isBlue
    ? "fill-[#0369A1] dark:fill-[#7DD3FC]"
    : "fill-[#4338CA] dark:fill-[#A5B4FC]";

  return (
    <g>
      <rect x={x} y={y} width="166" height="54" rx="7" className={bgClass} strokeWidth={active ? "1.8" : "1"} />
      <text x={x + 12} y={y + 18} className={`font-sans text-[10px] font-bold ${titleClass}`}>
        {title}
      </text>
      <text x={x + 154} y={y + 18} textAnchor="end" className="font-mono text-[11px] font-bold fill-[#0F172A] dark:fill-white">
        {subTitle}
      </text>
      <text
        x={x + 12}
        y={y + 42}
        className={`font-mono ${getResponsiveNumberClass(String(valDec), "text-[13px]", "text-[11px]", "text-[9.5px]")} font-extrabold ${valClass}`}
      >
        {valDec}
      </text>
      <text x={x + 154} y={y + 42} textAnchor="end" className="font-mono text-[9.5px] fill-[#64748B]">
        {valHex}
      </text>
    </g>
  );
};

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

  const memoryColumns = useMemo(() => {
    const snap = currentData?.global_result?.memory_snapshot ?? {};
    const entries = Object.entries(snap)
      .map(([addr, val]) => ({
        addr,
        val,
        dec: toSignedDec(val),
        numAddr: parseInt(addr, 16),
        isEmpty: false,
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
          isEmpty: false,
        });
      }
    }

    const slots = entries.slice(0, 4);
    while (slots.length < 4) {
      slots.push({
        addr: `SLOT ${slots.length + 1}`,
        val: "0x00000000",
        dec: 0,
        numAddr: 0,
        isEmpty: true,
      });
    }
    return slots;
  }, [currentData, state]);

  const watchRegisters = useMemo(() => {
    const regs = currentData?.global_result?.registers ?? {};
    const activeSet = new Set<string>();
    if (isValidRegKey(state.rs1Key)) activeSet.add(state.rs1Key);
    if (isValidRegKey(state.rs2Key)) activeSet.add(state.rs2Key);
    if (isValidRegKey(state.rdKey)) activeSet.add(state.rdKey);

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
      </div>
    );
  }

  if (!currentData) {
    return (
      <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] p-6 flex items-center justify-center text-[var(--ar-text-muted)] text-sm transition-colors duration-150">
        C 소스 코드를 작성하고 [⚡ 컴파일]을 누르면 싱글 사이클 데이터패스가 표시됩니다.
      </div>
    );
  }

  const isBusLoad = state.txMode === "DRAM_LOAD";
  const isBusStore = state.txMode === "DRAM_STORE";
  const isBusActive = isBusLoad || isBusStore;
  const isAluActive = !state.isIdle;
  const isOnChipWriteBack = !state.isIdle && state.regWrite && !state.memRead;

  return (
    <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] flex flex-col justify-between overflow-hidden relative select-none min-h-0 transition-colors duration-150">
      <style>{`
        @keyframes flowForward {
          from { stroke-dashoffset: 28; }
          to { stroke-dashoffset: 0; }
        }
        .wire-flow-fwd {
          stroke-dasharray: 8 6;
          animation: flowForward 0.7s linear infinite;
        }
      `}</style>

      {/* 상단 헤더 (PipelineVisualizer 및 전체 패널 표준 h-8 규격) */}
      <div className="h-8 shrink-0 flex items-center justify-between px-3.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 border-l-2 border-l-blue-500">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold text-blue-500">◆</span>
          <h3 className="font-sans text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wide whitespace-nowrap">
            SINGLE-CYCLE DATAPATH
          </h3>
          <span className="text-[10px] text-[var(--ar-text-muted)] font-mono">
            (CLK:{state.clock})
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${
              isBusLoad
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                : isBusStore
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40"
                : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40"
            }`}
          >
            {state.txBadgeText}
          </span>

          <div className="flex items-center bg-[#F6F8FA] dark:bg-[#252526] border border-[#D0D7DE] dark:border-[#3E3E42] rounded px-1 py-0.5 text-[#57606A] dark:text-[#CCCCCC] text-[10px]">
            <button
              type="button"
              onClick={() => setZoomLevel((p) => Math.max(0.6, +(p - 0.15).toFixed(2)))}
              className="px-1 hover:text-[#005FB8] dark:hover:text-[#007ACC] font-bold cursor-pointer"
              title="축소"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1.0)}
              className="px-1 font-mono font-semibold hover:text-[#005FB8] dark:hover:text-[#007ACC] cursor-pointer"
              title="100% 리셋"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel((p) => Math.min(2.0, +(p + 0.15).toFixed(2)))}
              className="px-1 hover:text-[#005FB8] dark:hover:text-[#007ACC] font-bold cursor-pointer"
              title="확대"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* 메인 다이어그램 */}
      <div className="flex-1 overflow-auto relative w-full min-h-0 p-2 custom-scrollbar flex">
        <div
          className="m-auto shrink-0 transition-[height,width] duration-150"
          style={{ width: `${zoomLevel * 100}%`, height: `${zoomLevel * 100}%` }}
        >
          <svg viewBox="0 0 920 760" preserveAspectRatio="xMidYMid meet" className="w-full h-full select-none block">
            <defs>
              <marker id="arr-muted" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#94A3B8" />
              </marker>
              <marker id="arr-blue" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#0284C7" />
              </marker>
              <marker id="arr-indigo" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#4F46E5" />
              </marker>
              <marker id="arr-emerald" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#059669" />
              </marker>
              <marker id="arr-amber" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#D97706" />
              </marker>
            </defs>

            {/* ZONE 1: ON-CHIP */}
            <rect x="20" y="14" width="880" height="386" rx="14" className="fill-[#F8FAFC] dark:fill-[#151921] stroke-[#CBD5E1] dark:stroke-[#2D3545]" strokeWidth="2" />
            <rect x="382" y="24" width="156" height="24" rx="6" className="fill-[#0284C7]/15 stroke-[#0284C7]/40" strokeWidth="1" />
            <text x="460" y="40" textAnchor="middle" className="font-sans text-[11px] font-extrabold fill-[#0369A1] dark:fill-[#38BDF8]">
              ON-CHIP (CPU CORE)
            </text>

            {/* [1] 좌측 카드: 1. REGISTER FILE */}
            <g>
              <rect x="40" y="58" width="380" height="322" rx="10" className="fill-white dark:fill-[#1C212B] stroke-[#94A3B8] dark:stroke-[#3E485B]" strokeWidth="2" />
              <rect x="40" y="58" width="380" height="32" rx="10" className="fill-[#0284C7]/10 dark:fill-[#0284C7]/20" />
              <text x="230" y="79" textAnchor="middle" className="font-sans text-[13px] font-extrabold fill-[#0369A1] dark:fill-[#38BDF8]">
                1. REGISTER FILE
              </text>

              <SvgPortCard
                x={56}
                y={102}
                title="READ 1 (rs1)"
                subTitle={formatRegLabel(state.rs1Key)}
                valDec={state.rs1Key ? state.rs1ValDec : "—"}
                valHex={state.rs1Key ? state.rs1ValHex : ""}
                themeColor="blue"
                active={Boolean(state.rs1Key)}
              />

              <SvgPortCard
                x={238}
                y={102}
                title="READ 2 (rs2)"
                subTitle={formatRegLabel(state.rs2Key)}
                valDec={state.rs2Key ? state.rs2ValDec : "—"}
                valHex={state.rs2Key ? state.rs2ValHex : ""}
                themeColor="indigo"
                active={Boolean(state.rs2Key)}
              />

              {/* rd (Write Port) */}
              <rect
                x="56"
                y="166"
                width="348"
                height="44"
                rx="7"
                className={state.regWrite && state.rdKey ? "fill-[#ECFDF5] dark:fill-[#0B2922] stroke-[#059669]" : "fill-[#F8FAFC] dark:fill-[#161A22] stroke-[#E2E8F0] dark:stroke-[#2C3340]"}
                strokeWidth={state.regWrite && state.rdKey ? "1.8" : "1"}
              />
              <text x="68" y="192" className="font-sans text-[11px] font-bold fill-[#059669] dark:fill-[#34D399]">
                WRITE (rd) : {formatRegLabel(state.rdKey)}
              </text>
              <text x="392" y="192" textAnchor="end" className="font-mono text-[11.5px] font-extrabold fill-[#065F46] dark:fill-[#6EE7B7]">
                {state.regWrite && state.rdKey ? `⇐ ${state.rdValDec} (${state.rdValHex})` : "—"}
              </text>

              {/* 주요 레지스터 6개 그리드 */}
              <line x1="56" y1="222" x2="404" y2="222" className="stroke-[#E2E8F0] dark:stroke-[#2D3545]" strokeWidth="1" />
              {watchRegisters.map((reg, idx) => {
                const col = idx % 3;
                const row = Math.floor(idx / 3);
                const rx = 56 + col * 118;
                const ry = 232 + row * 66;
                const isHighlighted = reg.isRd || reg.isRs1 || reg.isRs2;

                return (
                  <g key={reg.key}>
                    <rect
                      x={rx}
                      y={ry}
                      width="112"
                      height="56"
                      rx="6"
                      className={
                        reg.isRd
                          ? "fill-[#ECFDF5] dark:fill-[#0E2F26] stroke-[#059669]"
                          : reg.isRs1
                          ? "fill-[#F0F9FF] dark:fill-[#0F293D] stroke-[#0284C7]"
                          : reg.isRs2
                          ? "fill-[#EEF2FF] dark:fill-[#1B1D3C] stroke-[#4F46E5]"
                          : "fill-[#F8FAFC] dark:fill-[#151820] stroke-[#E2E8F0] dark:stroke-[#2A303C]"
                      }
                      strokeWidth={isHighlighted ? "1.8" : "1"}
                    />
                    <text x={rx + 10} y={ry + 19} className="font-mono text-[11px] font-bold fill-[#334155] dark:fill-[#CBD5E1]">
                      {reg.abi} ({reg.key})
                    </text>
                    <text
                      x={rx + 10}
                      y={ry + 42}
                      className={`font-mono ${getResponsiveNumberClass(String(reg.dec), "text-[14px]", "text-[12px]", "text-[10.5px]")} font-extrabold fill-[#0F172A] dark:fill-white`}
                    >
                      {reg.dec}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* [2] 정중앙 연결 배선 (x=420..500) */}
            <g>
              <line
                x1="420"
                y1="129"
                x2="496"
                y2="129"
                stroke={isAluActive ? "#0284C7" : "#CBD5E1"}
                strokeWidth="3"
                markerEnd={isAluActive ? "url(#arr-blue)" : "url(#arr-muted)"}
                className={isAluActive ? "wire-flow-fwd" : ""}
              />
              <rect x="434" y="104" width="52" height="18" rx="4" className="fill-white dark:fill-[#1E2430] stroke-[#0284C7]/60" strokeWidth="1" />
              <text x="460" y="116" textAnchor="middle" className="font-mono text-[9.5px] font-extrabold fill-[#0369A1] dark:fill-[#38BDF8]">
                A · B ➔
              </text>
            </g>

            <g>
              <line
                x1="500"
                y1="336"
                x2="424"
                y2="336"
                stroke={isOnChipWriteBack ? "#059669" : "#CBD5E1"}
                strokeWidth={isOnChipWriteBack ? "3" : "2"}
                markerEnd={isOnChipWriteBack ? "url(#arr-emerald)" : "url(#arr-muted)"}
                className={isOnChipWriteBack ? "wire-flow-fwd" : ""}
              />
              <rect
                x="432"
                y="310"
                width="56"
                height="18"
                rx="4"
                className={isOnChipWriteBack ? "fill-[#ECFDF5] dark:fill-[#0A2720] stroke-[#059669]" : "fill-white dark:fill-[#1E2430] stroke-[#CBD5E1] dark:stroke-[#333C4D]"}
                strokeWidth="1"
              />
              <text
                x="460"
                y="322"
                textAnchor="middle"
                className={`font-mono text-[9.5px] font-extrabold ${isOnChipWriteBack ? "fill-[#065F46] dark:fill-[#6EE7B7]" : "fill-[#94A3B8]"}`}
              >
                ⇐ WB(rd)
              </text>
            </g>

            {/* [3] 우측 카드: 2. ALU */}
            <g>
              <rect x="500" y="58" width="380" height="322" rx="10" className="fill-white dark:fill-[#1C212B] stroke-[#94A3B8] dark:stroke-[#3E485B]" strokeWidth="2" />
              <rect x="500" y="58" width="380" height="32" rx="10" className="fill-[#0284C7]/10 dark:fill-[#0284C7]/20" />
              <text x="690" y="79" textAnchor="middle" className="font-sans text-[13px] font-extrabold fill-[#0369A1] dark:fill-[#38BDF8]">
                2. ALU (ARITHMETIC LOGIC UNIT)
              </text>

              <SvgPortCard
                x={516}
                y={102}
                title="INPUT A"
                subTitle={state.aluInputALabel}
                valDec={state.aluInputAValDec}
                valHex={state.aluInputAValHex}
                themeColor="blue"
                active={isAluActive}
              />

              <SvgPortCard
                x={698}
                y={102}
                title="INPUT B"
                subTitle={state.aluInputBLabel}
                valDec={state.aluInputBValDec}
                valHex={state.aluInputBValHex}
                themeColor="indigo"
                active={isAluActive}
              />

              <line x1="599" y1="156" x2="635" y2="186" stroke={isAluActive ? "#0284C7" : "#CBD5E1"} strokeWidth="2.5" markerEnd={isAluActive ? "url(#arr-blue)" : "url(#arr-muted)"} />
              <line x1="781" y1="156" x2="745" y2="186" stroke={isAluActive ? "#4F46E5" : "#CBD5E1"} strokeWidth="2.5" markerEnd={isAluActive ? "url(#arr-indigo)" : "url(#arr-muted)"} />

              <path
                d="M 556 188 L 664 188 L 690 210 L 716 188 L 824 188 L 778 276 L 602 276 Z"
                className={isAluActive ? "fill-[#EFF6FF] dark:fill-[#13283F] stroke-[#0284C7] dark:stroke-[#38BDF8]" : "fill-[#F8FAFC] dark:fill-[#161A22] stroke-[#94A3B8]"}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <text x="690" y="242" textAnchor="middle" className="font-mono text-[26px] font-black fill-[#0284C7] dark:fill-[#7DD3FC]">
                {state.aluSymbol}
              </text>
              <text x="690" y="264" textAnchor="middle" className="font-mono text-[11px] font-extrabold fill-[#475569] dark:fill-[#94A3B8]">
                {state.aluOpLabel}
              </text>

              <line x1="690" y1="276" x2="690" y2="304" stroke={isAluActive ? "#0284C7" : "#CBD5E1"} strokeWidth="2.8" markerEnd={isAluActive ? "url(#arr-blue)" : "url(#arr-muted)"} />

              <rect x="516" y="308" width="348" height="56" rx="8" className="fill-[#F0F9FF] dark:fill-[#0C2538] stroke-[#0284C7] dark:stroke-[#38BDF8]" strokeWidth="2" />
              <text x="532" y="341" className="font-sans text-[11.5px] font-extrabold fill-[#0284C7] dark:fill-[#38BDF8]">
                ALU RESULT
              </text>
              <text x="848" y="333" textAnchor="end" className="font-mono text-[16px] font-black fill-[#0F172A] dark:fill-white">
                {state.isIdle ? "—" : state.aluResultDec}
              </text>
              <text x="848" y="352" textAnchor="end" className="font-mono text-[10.5px] fill-[#64748B]">
                {state.isIdle ? "" : state.aluResultHex}
              </text>
            </g>

            {/* ZONE 2: SYSTEM BUS */}
            <rect
              x="20"
              y="428"
              width="880"
              height="68"
              rx="10"
              className={
                isBusLoad
                  ? "fill-[#ECFDF5] dark:fill-[#0F2922] stroke-[#059669]"
                  : isBusStore
                  ? "fill-[#FFFBEB] dark:fill-[#2B2111] stroke-[#D97706]"
                  : "fill-[#F1F5F9] dark:fill-[#1A1F29] stroke-[#CBD5E1] dark:stroke-[#2D3545]"
              }
              strokeWidth="2"
            />
            <text x="460" y="456" textAnchor="middle" className="font-sans text-[13px] font-extrabold fill-[#1E293B] dark:fill-[#E2E8F0]">
              SYSTEM BUS (ON-CHIP ⇄ MEMORY)
            </text>
            <text
              x="460"
              y="478"
              textAnchor="middle"
              className={`font-mono text-[11.5px] font-bold ${
                isBusLoad ? "fill-[#059669] dark:fill-[#34D399]" : isBusStore ? "fill-[#D97706] dark:fill-[#FBBF24]" : "fill-[#64748B] dark:fill-[#94A3B8]"
              }`}
            >
              {isBusLoad
                ? `LOAD : Memory[${state.memAddressHex}] = ${state.memDataDec} (${state.memDataHex}) ➔ Register ${formatRegLabel(state.rdKey)}`
                : isBusStore
                ? `STORE : Register ${formatRegLabel(state.rs2Key)} = ${state.memDataDec} (${state.memDataHex}) ➔ Memory[${state.memAddressHex}]`
                : "IDLE (버스 대기 중 · 온칩 내부 연산만 수행)"}
            </text>

            {/* 버스 배선 (좌측 x=230) */}
            <g>
              {isBusLoad ? (
                <>
                  <line x1="230" y1="524" x2="230" y2="382" stroke="#059669" strokeWidth="4" markerEnd="url(#arr-emerald)" className="wire-flow-fwd" />
                  <rect x="148" y="396" width="164" height="22" rx="5" className="fill-[#ECFDF5] dark:fill-[#0B2922] stroke-[#059669]" strokeWidth="1.2" />
                  <text x="230" y="411" textAnchor="middle" className="font-mono text-[10.5px] font-extrabold fill-[#065F46] dark:fill-[#6EE7B7]">
                    ▲ DATA READ: {state.memDataDec}
                  </text>
                </>
              ) : isBusStore ? (
                <>
                  <line x1="230" y1="380" x2="230" y2="522" stroke="#D97706" strokeWidth="4" markerEnd="url(#arr-amber)" className="wire-flow-fwd" />
                  <rect x="148" y="396" width="164" height="22" rx="5" className="fill-[#FFFBEB] dark:fill-[#2B2111] stroke-[#D97706]" strokeWidth="1.2" />
                  <text x="230" y="411" textAnchor="middle" className="font-mono text-[10.5px] font-extrabold fill-[#B45309] dark:fill-[#FCD34D]">
                    ▼ DATA WRITE: {state.memDataDec}
                  </text>
                </>
              ) : (
                <line x1="230" y1="380" x2="230" y2="524" stroke="#CBD5E1" strokeWidth="2.5" strokeDasharray="4 4" />
              )}
            </g>

            {/* 버스 배선 (우측 x=690) */}
            <g>
              <line
                x1="690"
                y1="380"
                x2="690"
                y2="522"
                stroke={isBusActive ? "#0284C7" : "#CBD5E1"}
                strokeWidth={isBusActive ? "3.5" : "2.5"}
                strokeDasharray={isBusActive ? undefined : "4 4"}
                markerEnd={isBusActive ? "url(#arr-blue)" : "url(#arr-muted)"}
                className={isBusActive ? "wire-flow-fwd" : ""}
              />
              {isBusActive && (
                <>
                  <rect x="608" y="396" width="164" height="22" rx="5" className="fill-[#F0F9FF] dark:fill-[#0C2538] stroke-[#0284C7]" strokeWidth="1.2" />
                  <text x="690" y="411" textAnchor="middle" className="font-mono text-[10.5px] font-extrabold fill-[#0369A1] dark:fill-[#7DD3FC]">
                    ▼ ADDR: {state.memAddressHex}
                  </text>
                </>
              )}
            </g>

            {/* ZONE 3: OFF-CHIP DRAM MEMORY */}
            <rect x="20" y="524" width="880" height="220" rx="14" className="fill-[#F8FAFC] dark:fill-[#151921] stroke-[#CBD5E1] dark:stroke-[#2D3545]" strokeWidth="2" />
            <rect x="40" y="540" width="840" height="34" rx="8" className="fill-[#059669]/10 dark:fill-[#059669]/20" />
            <text x="460" y="562" textAnchor="middle" className="font-sans text-[13px] font-extrabold fill-[#065F46] dark:fill-[#34D399]">
              3. MEMORY (OFF-CHIP DRAM)
            </text>

            {memoryColumns.map((slot, idx) => {
              const cardW = 198;
              const gap = 16;
              const cx = 40 + idx * (cardW + gap);
              const cy = 588;
              const isTarget = !slot.isEmpty && Boolean(state.memAddressHex) && slot.addr.toLowerCase() === state.memAddressHex?.toLowerCase();

              return (
                <g key={`${slot.addr}-${idx}`}>
                  <rect
                    x={cx}
                    y={cy}
                    width={cardW}
                    height="136"
                    rx="10"
                    className={
                      slot.isEmpty
                        ? "fill-[#F8FAFC]/60 dark:fill-[#181C24] stroke-[#E2E8F0] dark:stroke-[#262C38]"
                        : isTarget && isBusLoad
                        ? "fill-[#ECFDF5] dark:fill-[#0E2F26] stroke-[#059669]"
                        : isTarget && isBusStore
                        ? "fill-[#FFFBEB] dark:fill-[#2B2111] stroke-[#D97706]"
                        : "fill-white dark:fill-[#1C212B] stroke-[#CBD5E1] dark:stroke-[#333C4D]"
                    }
                    strokeWidth={isTarget ? "2.5" : "1.5"}
                    strokeDasharray={slot.isEmpty ? "5 4" : undefined}
                  />
                  {slot.isEmpty ? (
                    <>
                      <text x={cx + cardW / 2} y={cy + 62} textAnchor="middle" className="font-sans text-[11px] font-bold fill-[#94A3B8] dark:fill-[#475569]">
                        EMPTY MEMORY SLOT
                      </text>
                      <text x={cx + cardW / 2} y={cy + 82} textAnchor="middle" className="font-mono text-[10px] fill-[#CBD5E1] dark:fill-[#334155]">
                        (미사용 영역)
                      </text>
                    </>
                  ) : (
                    <>
                      <text x={cx + 14} y={cy + 26} className="font-sans text-[10px] font-bold fill-[#64748B]">
                        ADDRESS
                      </text>
                      {isTarget && (
                        <text
                          x={cx + cardW - 14}
                          y={cy + 26}
                          textAnchor="end"
                          className={`font-mono text-[10px] font-extrabold ${isBusLoad ? "fill-[#059669] dark:fill-[#34D399]" : "fill-[#D97706] dark:fill-[#FBBF24]"}`}
                        >
                          {isBusLoad ? "▲ READ" : "▼ WRITE"}
                        </text>
                      )}
                      <text x={cx + 14} y={cy + 46} className="font-mono text-[12.5px] font-extrabold fill-[#0F172A] dark:fill-white">
                        {slot.addr}
                      </text>

                      <line x1={cx + 14} y1={cy + 58} x2={cx + cardW - 14} y2={cy + 58} className="stroke-[#E2E8F0] dark:stroke-[#2D3545]" strokeWidth="1" />

                      <text x={cx + 14} y={cy + 78} className="font-sans text-[10px] font-bold fill-[#64748B]">
                        VALUE
                      </text>
                      <text
                        x={cx + 14}
                        y={cy + 104}
                        className={`font-mono ${getResponsiveNumberClass(String(slot.dec), "text-[18px]", "text-[15px]", "text-[12.5px]")} font-black fill-[#0F172A] dark:fill-white`}
                      >
                        {slot.dec}
                      </text>
                      <text x={cx + 14} y={cy + 123} className="font-mono text-[10.5px] fill-[#64748B]">
                        {slot.val}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};

export default SingleCycleDatapath;
