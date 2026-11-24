import React, { useState, useEffect } from 'react';
import type { CycleHistoryItem, SimulationResult } from '@/type/simulation';
import SingleCycleDatapath from './SingleCycleDatapath';
import type { InstructionLessonContext } from './InstructionLesson';
import { timelineSync } from '../utils/timelineSync';
import { numericPc } from '../utils/instructionFlow';
import {
  computePipelineWireState,
  isBranch,
  isLoad,
  isStore,
  isITypeAlu,
  isRType,
  isLui,
  isAuipc,
  isBubbleOrNop,
  usesImm,
  writesReg,
} from '../utils/pipelineWireState';
import './PipelineVisualizer.css';

// SVG 경로(M, L, H, V)를 안전하게 파싱하여 진행률(0~1)에 따른 좌표를 산출하는 보간 헬퍼
function parseSvgPathPoints(pathStr: string): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const regex = /([MLHV])\s*([^MLHV]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(pathStr)) !== null) {
    const cmd = match[1].toUpperCase();
    const nums = match[2].trim().split(/[\s,]+/).map(Number);
    const prev = points[points.length - 1] || { x: 0, y: 0 };
    if (cmd === "M" || cmd === "L") {
      for (let i = 0; i < nums.length; i += 2) {
        if (!isNaN(nums[i]) && !isNaN(nums[i + 1])) {
          points.push({ x: nums[i], y: nums[i + 1] });
        }
      }
    } else if (cmd === "H") {
      nums.forEach((x) => { if (!isNaN(x)) points.push({ x, y: prev.y }); });
    } else if (cmd === "V") {
      nums.forEach((y) => { if (!isNaN(y)) points.push({ x: prev.x, y }); });
    }
  }
  return points;
}

// IF 주요 선분 경로 사전 파싱 (불필요한 useMemo 제거 및 모듈 레벨 정적 캐싱)
const PC_TO_IMEM_PTS = parseSvgPathPoints("M 380,136 L 380,174");
const PC_TO_PLUS4_PTS = parseSvgPathPoints("M 500,108 L 756,108");
const PC_TO_ADDR_PTS = parseSvgPathPoints("M 701,108 L 701,283");
const IMEM_TO_IFID_PTS = parseSvgPathPoints("M 380,248 L 380,283");
const PLUS4_LOOPBACK_PTS = parseSvgPathPoints("M 801,128 L 801,168 L 870,168 L 870,-22 L 410,-22 L 410,12");
const MUX_TO_PC_PTS = parseSvgPathPoints("M 380,52 L 380,78");

// ID 단계 경로
const ID_IFID_TO_REGS_PTS = parseSvgPathPoints("M 380,311 L 380,336 L 295,336 L 295,366");
const ID_IFID_TO_IMM_PTS = parseSvgPathPoints("M 380,311 L 380,336 L 578,336 L 578,366");
const ID_IFID_TO_CU_PTS = parseSvgPathPoints("M 380,311 L 380,336 L 801,336 L 801,366");
const ID_RD1_TO_IDEX_PTS = parseSvgPathPoints("M 225,480 L 225,538");
const ID_RD2_TO_IDEX_PTS = parseSvgPathPoints("M 365,480 L 365,538");
const ID_IMM_TO_IDEX_PTS = parseSvgPathPoints("M 578,482 L 578,538");
const ID_PC_TO_IDEX_PTS = parseSvgPathPoints("M 701,311 L 701,538");

// EX 단계 경로
const EX_RD1_TO_ALU_PTS = parseSvgPathPoints("M 225,566 L 225,739");
const EX_RD2_TO_MUX_PTS = parseSvgPathPoints("M 365,566 L 365,663");
const EX_RD2_TO_EXMEM_PTS = parseSvgPathPoints("M 365,566 L 365,595 L 480,595 L 480,908");
const EX_IMM_TO_MUX_PTS = parseSvgPathPoints("M 578,566 L 578,630 L 425,630 L 425,663");
const EX_MUX_TO_ALU_PTS = parseSvgPathPoints("M 395,703 L 395,739");
const EX_ALU_TO_EXMEM_PTS = parseSvgPathPoints("M 310,869 L 310,908");
const EX_IMM_TO_BRANCH_PTS = parseSvgPathPoints("M 578,566 L 578,743");
const EX_PC_TO_BRANCH_PTS = parseSvgPathPoints("M 701,566 L 701,720 L 652,720 L 652,743");
const EX_BRANCH_LOOPBACK_PTS = parseSvgPathPoints("M 615,808 L 615,845 L 905,845 L 905,-50 L 350,-50 L 350,12");

// MEM 단계 경로
const MEM_BYPASS_PTS = parseSvgPathPoints("M 310,936 L 310,965 L 225,965 L 225,1154");
const MEM_ADDR_TO_DMEM_PTS = parseSvgPathPoints("M 310,936 L 310,994");
const MEM_DATA_TO_DMEM_PTS = parseSvgPathPoints("M 480,936 L 480,994");
const MEM_DMEM_TO_MEMWB_PTS = parseSvgPathPoints("M 470,1106 L 470,1154");

// WB 단계 경로
const WB_ALU_TO_MUX_PTS = parseSvgPathPoints("M 225,1182 L 225,1218 L 410,1218 L 410,1256");
const WB_DMEM_TO_MUX_PTS = parseSvgPathPoints("M 470,1182 L 470,1256");
const WB_FEEDBACK_PTS = parseSvgPathPoints("M 440,1296 L 440,1315 L 85,1315 L 85,424 L 180,424");

// 제어 신호(Control Signal) 경로
const ID_CU_TO_IDEX_PTS = parseSvgPathPoints("M 801,482 L 801,538");
const EX_CTRL_TO_MUX_PTS = parseSvgPathPoints("M 755,566 L 755,684 L 445,684");
const EX_M_TO_EXMEM_PTS = parseSvgPathPoints("M 801,566 L 801,908");
const EX_WB_TO_EXMEM_PTS = parseSvgPathPoints("M 847,566 L 847,908");
const MEM_CTRL_TO_DMEM_PTS = parseSvgPathPoints("M 801,936 L 801,1051 L 550,1051");
const MEM_WB_TO_MEMWB_PTS = parseSvgPathPoints("M 847,936 L 847,1154");
const WB_CTRL_TO_MUX_PTS = parseSvgPathPoints("M 847,1182 L 847,1277 L 490,1277");

// SVG 경로 물리적 픽셀 총 길이 계산 헬퍼
function getPathTotalLength(points: { x: number; y: number }[]): number {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

// IF 경로 길이
const PC_TO_IMEM_LEN = getPathTotalLength(PC_TO_IMEM_PTS); // 38px
const PC_TO_PLUS4_LEN = getPathTotalLength(PC_TO_PLUS4_PTS); // 256px
const PC_TO_ADDR_LEN = getPathTotalLength(PC_TO_ADDR_PTS); // 175px
const IMEM_TO_IFID_LEN = getPathTotalLength(IMEM_TO_IFID_PTS); // 35px
const PLUS4_LOOPBACK_LEN = getPathTotalLength(PLUS4_LOOPBACK_PTS); // 793px
const MUX_TO_PC_LEN = getPathTotalLength(MUX_TO_PC_PTS); // 26px

// ID 경로 길이
const ID_IFID_TO_REGS_LEN = getPathTotalLength(ID_IFID_TO_REGS_PTS); // 155px
const ID_IFID_TO_IMM_LEN = getPathTotalLength(ID_IFID_TO_IMM_PTS); // 253px
const ID_IFID_TO_CU_LEN = getPathTotalLength(ID_IFID_TO_CU_PTS); // 476px
const ID_RD1_TO_IDEX_LEN = getPathTotalLength(ID_RD1_TO_IDEX_PTS); // 58px
const ID_RD2_TO_IDEX_LEN = getPathTotalLength(ID_RD2_TO_IDEX_PTS); // 58px
const ID_IMM_TO_IDEX_LEN = getPathTotalLength(ID_IMM_TO_IDEX_PTS); // 56px
const ID_CU_TO_IDEX_LEN = getPathTotalLength(ID_CU_TO_IDEX_PTS); // 56px
const ID_PC_TO_IDEX_LEN = getPathTotalLength(ID_PC_TO_IDEX_PTS); // 227px

// EX 경로 길이
const EX_RD1_TO_ALU_LEN = getPathTotalLength(EX_RD1_TO_ALU_PTS); // 173px
const EX_RD2_TO_MUX_LEN = getPathTotalLength(EX_RD2_TO_MUX_PTS); // 97px
const EX_RD2_TO_EXMEM_LEN = getPathTotalLength(EX_RD2_TO_EXMEM_PTS); // 472px
const EX_IMM_TO_MUX_LEN = getPathTotalLength(EX_IMM_TO_MUX_PTS); // 265px
const EX_MUX_TO_ALU_LEN = getPathTotalLength(EX_MUX_TO_ALU_PTS); // 36px
const EX_ALU_TO_EXMEM_LEN = getPathTotalLength(EX_ALU_TO_EXMEM_PTS); // 39px
const EX_CTRL_TO_MUX_LEN = getPathTotalLength(EX_CTRL_TO_MUX_PTS); // 443px
const EX_M_TO_EXMEM_LEN = getPathTotalLength(EX_M_TO_EXMEM_PTS); // 342px
const EX_WB_TO_EXMEM_LEN = getPathTotalLength(EX_WB_TO_EXMEM_PTS); // 342px
const EX_IMM_TO_BRANCH_LEN = getPathTotalLength(EX_IMM_TO_BRANCH_PTS); // 177px
const EX_PC_TO_BRANCH_LEN = getPathTotalLength(EX_PC_TO_BRANCH_PTS); // 226px
const EX_BRANCH_LOOPBACK_LEN = getPathTotalLength(EX_BRANCH_LOOPBACK_PTS); // 1839px

// MEM 경로 길이
const MEM_ADDR_TO_DMEM_LEN = getPathTotalLength(MEM_ADDR_TO_DMEM_PTS); // 58px
const MEM_DATA_TO_DMEM_LEN = getPathTotalLength(MEM_DATA_TO_DMEM_PTS); // 58px
const MEM_DMEM_TO_MEMWB_LEN = getPathTotalLength(MEM_DMEM_TO_MEMWB_PTS); // 48px
const MEM_CTRL_TO_DMEM_LEN = getPathTotalLength(MEM_CTRL_TO_DMEM_PTS); // 366px
const MEM_WB_TO_MEMWB_LEN = getPathTotalLength(MEM_WB_TO_MEMWB_PTS); // 218px

// WB 경로 길이
const WB_ALU_TO_MUX_LEN = getPathTotalLength(WB_ALU_TO_MUX_PTS); // 259px
const WB_DMEM_TO_MUX_LEN = getPathTotalLength(WB_DMEM_TO_MUX_PTS); // 74px
const WB_FEEDBACK_LEN = getPathTotalLength(WB_FEEDBACK_PTS); // 1345px
const WB_CTRL_TO_MUX_LEN = getPathTotalLength(WB_CTRL_TO_MUX_PTS); // 452px

// 명령어 피연산자 및 레지스터 값 추출 헬퍼
interface ParsedInstruction {
  op: string;
  rd: string | null;
  rs1: string | null;
  rs2: string | null;
  imm: string | null;
}

function parseInstructionDetails(assembly: string | null | undefined): ParsedInstruction {
  if (!assembly || isBubbleOrNop(assembly)) return { op: '', rd: null, rs1: null, rs2: null, imm: null };
  const trimmed = assembly.trim();
  const spaceIdx = trimmed.search(/\s/);
  if (spaceIdx === -1) {
    return { op: trimmed.toLowerCase(), rd: null, rs1: null, rs2: null, imm: null };
  }
  const op = trimmed.slice(0, spaceIdx).toLowerCase();
  const args = trimmed.slice(spaceIdx).split(',').map(s => s.trim()).filter(Boolean);

  const parseOffsetBase = (str: string) => {
    const match = str.match(/^([+-]?\w+)?\s*\(\s*(\w+)\s*\)$/);
    if (match) {
      return { offset: match[1] || '0', base: match[2] };
    }
    return { offset: null, base: str };
  };

  // 1) Stores: sw rs2, offset(rs1)
  if (isStore(op)) {
    const rs2 = args[0] || null;
    const { offset, base } = args[1] ? parseOffsetBase(args[1]) : { offset: null, base: null };
    return { op, rd: null, rs1: base, rs2, imm: offset };
  }

  // 2) Loads: lw rd, offset(rs1)
  if (isLoad(op)) {
    const rd = args[0] || null;
    const { offset, base } = args[1] ? parseOffsetBase(args[1]) : { offset: null, base: null };
    return { op, rd, rs1: base, rs2: null, imm: offset };
  }

  // 3) Branches: beq rs1, rs2, offset
  if (isBranch(op)) {
    return { op, rd: null, rs1: args[0] || null, rs2: args[1] || null, imm: args[2] || null };
  }

  // 4) Upper Immediates: lui rd, imm / auipc rd, imm
  if (isLui(op) || isAuipc(op)) {
    return { op, rd: args[0] || null, rs1: null, rs2: null, imm: args[1] || null };
  }

  // 5) Jump: jal rd, offset OR jal offset
  if (op === 'jal') {
    if (args.length === 1) {
      return { op, rd: 'ra', rs1: null, rs2: null, imm: args[0] };
    }
    return { op, rd: args[0] || 'ra', rs1: null, rs2: null, imm: args[1] || null };
  }

  // 6) Jump: jalr rd, offset(rs1) OR jalr rs1
  if (op === 'jalr') {
    if (args.length === 1) {
      const { base } = parseOffsetBase(args[0]);
      return { op, rd: 'ra', rs1: base, rs2: null, imm: '0' };
    }
    const rd = args[0] || 'ra';
    const { offset, base } = parseOffsetBase(args[1] || '');
    return { op, rd, rs1: base, rs2: null, imm: offset || '0' };
  }

  // 7) I-type ALU: addi rd, rs1, imm
  if (isITypeAlu(op)) {
    return { op, rd: args[0] || null, rs1: args[1] || null, rs2: null, imm: args[2] || null };
  }

  // 8) R-type & default: add rd, rs1, rs2
  return {
    op,
    rd: args[0] || null,
    rs1: args[1] || null,
    rs2: args[2] || null,
    imm: null
  };
}

function resolveRegKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const clean = name.replace(/[^\w]/g, '').toLowerCase();
  if (/^x\d+$/.test(clean)) return clean;
  const ABI_MAP: Record<string, string> = {
    zero: 'x0', ra: 'x1', sp: 'x2', gp: 'x3', tp: 'x4',
    t0: 'x5', t1: 'x6', t2: 'x7', s0: 'x8', fp: 'x8', s1: 'x9',
    a0: 'x10', a1: 'x11', a2: 'x12', a3: 'x13', a4: 'x14', a5: 'x15', a6: 'x16', a7: 'x17',
    s2: 'x18', s3: 'x19', s4: 'x20', s5: 'x21', s6: 'x22', s7: 'x23', s8: 'x24', s9: 'x25',
    s10: 'x26', s11: 'x27', t3: 'x28', t4: 'x29', t5: 'x30', t6: 'x31'
  };
  return ABI_MAP[clean] || null;
}

function formatRegVal(valHex: string | undefined): string {
  if (!valHex) return '0';
  const num = Number.parseInt(valHex, 16);
  if (Number.isFinite(num)) {
    return String(num << 0);
  }
  return valHex;
}

function getAluOpSymbol(op: string): string {
  if (op === 'add' || op === 'addi') return '+';
  if (op === 'sub') return '−';
  if (op === 'and' || op === 'andi') return '&';
  if (op === 'or' || op === 'ori') return '|';
  if (op === 'xor' || op === 'xori') return '^';
  if (op === 'sll' || op === 'slli') return '<<';
  if (op === 'srl' || op === 'srli') return '>>>';
  if (op === 'sra' || op === 'srai') return '>>';
  if (op === 'slt' || op === 'slti' || op === 'sltu' || op === 'sltiu') return '<';
  if (isLoad(op) || isStore(op)) return '+ (Addr)';
  if (isBranch(op)) return '== (Cmp)';
  if (op === 'lui' || op === 'auipc') return 'imm';
  return '';
}

function computeAluDisplayVal(
  parsed: ParsedInstruction,
  regMap: Record<string, string>,
  pc: number = 0
): string {
  const { op, rd, rs1, rs2, imm } = parsed;
  const rs1Key = rs1 ? resolveRegKey(rs1) : null;
  const rs2Key = rs2 ? resolveRegKey(rs2) : null;

  const v1 = rs1Key && regMap[rs1Key] ? Number.parseInt(regMap[rs1Key], 16) || 0 : 0;
  const v2 = rs2Key && regMap[rs2Key] ? Number.parseInt(regMap[rs2Key], 16) || 0 : 0;

  let immNum = 0;
  if (imm) {
    immNum = imm.startsWith('0x') || imm.startsWith('0X')
      ? Number.parseInt(imm, 16) || 0
      : Number.parseInt(imm, 10) || 0;
  }

  // 1) Memory Load / Store: Effective address computation = Base (rs1) + Offset (imm)
  if (isLoad(op) || isStore(op)) {
    const addr = (v1 + immNum) | 0;
    return `0x${(addr >>> 0).toString(16)}`;
  }

  // 2) Branch condition evaluation: 깔끔하고 직관적인 Zero 플래그 표현
  if (isBranch(op)) {
    let conditionMet = false;
    if (op === 'beq') conditionMet = (v1 === v2);
    else if (op === 'bne') conditionMet = (v1 !== v2);
    else if (op === 'blt') conditionMet = (v1 < v2);
    else if (op === 'bge') conditionMet = (v1 >= v2);
    else if (op === 'bltu') conditionMet = ((v1 >>> 0) < (v2 >>> 0));
    else if (op === 'bgeu') conditionMet = ((v1 >>> 0) >= (v2 >>> 0));
    return conditionMet ? 'Zero: 1 (T)' : 'Zero: 0 (NT)';
  }

  // 3) Arithmetic & Logic
  const b = usesImm(op) ? immNum : v2;
  if (op === 'add' || op === 'addi') return String((v1 + b) | 0);
  if (op === 'sub') return String((v1 - b) | 0);
  if (op === 'and' || op === 'andi') return String(v1 & b);
  if (op === 'or' || op === 'ori') return String(v1 | b);
  if (op === 'xor' || op === 'xori') return String(v1 ^ b);
  if (op === 'sll' || op === 'slli') return String((v1 << (b & 0x1f)) | 0);
  if (op === 'srl' || op === 'srli') return String(v1 >>> (b & 0x1f));
  if (op === 'sra' || op === 'srai') return String(v1 >> (b & 0x1f));
  if (op === 'slt' || op === 'slti') return String(v1 < b ? 1 : 0);
  if (op === 'sltu' || op === 'sltiu') return String((v1 >>> 0) < (b >>> 0) ? 1 : 0);
  if (op === 'lui') return `0x${((immNum << 12) >>> 0).toString(16)}`;
  if (op === 'auipc') return `0x${((pc + (immNum << 12)) >>> 0).toString(16)}`;
  if (op === 'jal' || op === 'jalr') return String((pc + 4) | 0);

  if (rd) return `${rd}`;
  return 'res';
}

function getIdControlSignals(op: string): string[] {
  if (!op || isBubbleOrNop(op)) return [];

  // 1) Load: lw, lh, lb, lhu, lbu
  if (isLoad(op)) {
    return [
      "ALUSrc: 1",
      "MemRead: 1",
      "RegWrite: 1"
    ];
  }

  // 2) Store: sw, sh, sb
  if (isStore(op)) {
    return [
      "ALUSrc: 1",
      "MemWrite: 1"
    ];
  }

  // 3) Branch: beq, bne, blt, bge, etc.
  if (isBranch(op)) {
    return [
      "ALUSrc: 0",
      "Branch: 1"
    ];
  }

  // 4) I-type ALU: addi, andi, ori, xori, slti, slli, srli, srai
  if (isITypeAlu(op)) {
    return [
      "ALUSrc: 1",
      "RegWrite: 1"
    ];
  }

  // 5) R-type: add, sub, and, or, xor, sll, srl, sra, slt, etc.
  if (isRType(op)) {
    return [
      "ALUSrc: 0",
      "RegWrite: 1"
    ];
  }

  // 6) lui / auipc
  if (isLui(op) || isAuipc(op)) {
    return [
      "ALUSrc: 1",
      "RegWrite: 1"
    ];
  }

  // 7) Jumps: jal, jalr
  if (op === "jal" || op === "jalr") {
    return [
      "Branch: 1",
      "RegWrite: 1"
    ];
  }

  // Default fallback if writes register
  if (writesReg(op)) {
    return [
      usesImm(op) ? "ALUSrc: 1" : "ALUSrc: 0",
      "RegWrite: 1"
    ];
  }

  return ["Ctrl: Active"];
}

const FloatingChip: React.FC<{
  x: number;
  y: number;
  text?: string;
  lines?: string[];
  stroke: string;
  title: string;
  opacity?: number;
  fontSize?: number;
}> = ({ x, y, text, lines, stroke, title, opacity = 1.0, fontSize }) => {
  const displayLines = lines && lines.length > 0 ? lines : [text || ''];
  const maxLineLen = Math.max(...displayLines.map(l => l.length));
  const isMulti = displayLines.length > 1;
  const effectiveFontSize = fontSize ?? (isMulti ? 14 : 16);
  const chipWidth = Math.max(isMulti ? 88 : 68, maxLineLen * (isMulti ? 9.0 : 9.8) + (isMulti ? 28 : 32));
  const chipHeight = isMulti ? displayLines.length * 19 + 14 : 30;
  const rx = isMulti ? 10 : 15;

  return (
    <g
      className="cursor-pointer pointer-events-auto"
      style={{ opacity, transition: "opacity 0.08s ease-out" }}
    >
      <rect
        x={x - chipWidth / 2}
        y={y - chipHeight / 2}
        width={chipWidth}
        height={chipHeight}
        rx={rx}
        fill="#1E293B"
        stroke={stroke}
        strokeWidth="2.2"
        filter="url(#token-glow)"
      />
      {displayLines.map((line, idx) => {
        const lineOffset = isMulti ? (idx - (displayLines.length - 1) / 2) * 18 : 0;
        return (
          <text
            key={idx}
            x={x}
            y={y + lineOffset}
            dominantBaseline="central"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize={effectiveFontSize}
            fontWeight="bold"
            fontFamily="D2Coding, monospace"
          >
            {line}
          </text>
        );
      })}
      <title>{title}</title>
    </g>
  );
};


function interpolatePathPoints(points: { x: number; y: number }[], progress: number): { x: number; y: number } | null {
  if (!points || points.length === 0) return null;
  if (points.length === 1) return points[0];
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    lengths.push(dist);
    total += dist;
  }
  if (total === 0) return points[0];
  const target = Math.max(0, Math.min(1, progress)) * total;
  let acc = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= acc + lengths[i] || i === lengths.length - 1) {
      const segLen = lengths[i];
      const ratio = segLen > 0 ? (target - acc) / segLen : 0;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
        y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
      };
    }
    acc += lengths[i];
  }
  return points[points.length - 1];
}

// 1사이클 진행률(0~1) 내에서 스텝 하위 시간 구간([start, end]) 동안 주행하고,
// 도착 후 소자 처리 및 안착 여유 시간(holdDuration) 동안 머무른 뒤 부드럽게 다음 스텝으로 전달하는 헬퍼
function getSynchronizedSubstepProgress(
  globalProgress: number,
  start: number,
  end: number,
  persistAfterArrival: boolean = false,
  holdDuration: number = 0
): { progress: number; opacity: number } | null {
  if (globalProgress < start) {
    return null; // 아직 시작 전: 미표시
  }

  const stepDuration = end - start;
  if (stepDuration <= 0) return null;

  // 1) 아직 스텝 종료 전 (이동 중: 선 길이에 비례한 속도로 주행하여 정확히 end 시점에 동시 도착)
  if (globalProgress <= end) {
    const ratio = Math.max(0, Math.min(1, (globalProgress - start) / stepDuration));
    const fadeInWindow = 0.05;
    const opacity = ratio < fadeInWindow ? ratio / fadeInWindow : 1.0;
    return { progress: ratio, opacity };
  }

  // 2) 스텝 종료 이후 - 영구 유지(persist)인 경우 클록 종료(1.0)까지 유지
  if (persistAfterArrival) {
    return { progress: 1.0, opacity: 1.0 };
  }

  // 3) 도착 후 소자 안착 및 처리 지연 여유 시간 (holdDuration 동안 위치 1.0 및 투명도 1.0 고정)
  if (globalProgress <= end + holdDuration) {
    return { progress: 1.0, opacity: 1.0 };
  }

  // 4) 여유 시간 종료 직후 0.03 구간 동안 빠르게 페이드아웃 후 다음 단계로 매끄럽게 전달
  const fadeDuration = 0.03;
  const fadeEnd = end + holdDuration + fadeDuration;
  if (globalProgress <= fadeEnd) {
    const fadeRatio = (globalProgress - (end + holdDuration)) / fadeDuration;
    return { progress: 1.0, opacity: Math.max(0, 1 - fadeRatio) };
  }
  return null; // 완전 소멸
}

interface PipelineVisualizerProps {
  lessonContext?: InstructionLessonContext;
  currentData: CycleHistoryItem | null;
  prevData?: CycleHistoryItem | null;
  simulationData?: SimulationResult | null;
  loadingMessage?: string | null;
  mode?: "single" | "pipeline";
  playSpeed?: number;
  isPlaying?: boolean;
  currentCycle?: number;
  playbackRevision?: number;
  onPausePlayback?: () => void;
}

const MASTER_WIDTH = 1240;
const MASTER_HEIGHT = 1400;

const PipelineVisualizer: React.FC<PipelineVisualizerProps> = ({
  currentData,
  prevData,
  simulationData,
  loadingMessage,
  mode = "pipeline",
  lessonContext,
  playSpeed,
  isPlaying,
  playbackRevision,
  currentCycle,
  onPausePlayback: _onPausePlayback,
}) => {
  // [모든 훅은 React Rules of Hooks에 따라 조건문이나 조기 반환보다 먼저 최상단에서 무조건 실행]
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [animProgress, setAnimProgress] = useState<number>(0);
  const [isSubstepPlaying, setIsSubstepPlaying] = useState<boolean>(true);
  const flowDuration = lessonContext?.flowDurationMs ?? playSpeed ?? 3000;
  const progressRef = React.useRef<number>(0);
  const startTimeRef = React.useRef<number>(performance.now());
  const pausedProgressRef = React.useRef<number>(0);
  const prevDataRef = React.useRef(currentData);
  const prevFlowDurationRef = React.useRef(flowDuration);

  // 뷰포트 교차 감지: 회로도가 화면 밖(다른 탭/뷰포트)으로 슬라이드되면 RAF 애니메이션을 일시 정지하여 CPU 낭비 방지
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState<boolean>(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 1. 사이클 데이터(currentData)가 변경되면 진행률을 즉시 0으로 리셋하고 재생 시작
  useEffect(() => {
    if (prevDataRef.current !== currentData) {
      prevDataRef.current = currentData;
      startTimeRef.current = performance.now();
      progressRef.current = 0;
      pausedProgressRef.current = 0;
      setAnimProgress(0);
      setIsSubstepPlaying(!!isPlaying);
      timelineSync.setProgress(currentCycle ?? 0, 0);
    }
  }, [currentData, currentCycle, isPlaying]);

  // 2. 재생 속도(flowDuration) 변경 시 현재 상대 진행률 유지
  useEffect(() => {
    if (prevFlowDurationRef.current !== flowDuration) {
      startTimeRef.current = performance.now() - progressRef.current * flowDuration;
      prevFlowDurationRef.current = flowDuration;
    }
  }, [flowDuration]);

  // 3. 외부 시뮬레이션 바(상단 ControlPanel)에서 Play / Pause 누를 때:
  // 제자리 일시정지 및 제자리 재개 동작 수행
  useEffect(() => {
    if (isPlaying) {
      if (pausedProgressRef.current > 0 && pausedProgressRef.current < 1) {
        // 일시정지되었던 위치에서 그대로 이어서 재생
        startTimeRef.current = performance.now() - pausedProgressRef.current * flowDuration;
        progressRef.current = pausedProgressRef.current;
        setAnimProgress(pausedProgressRef.current);
      } else {
        // 사이클 처음부터 재생
        startTimeRef.current = performance.now();
        progressRef.current = 0;
        pausedProgressRef.current = 0;
        setAnimProgress(0);
        timelineSync.setProgress(currentCycle ?? 0, 0);
      }
      setIsSubstepPlaying(true);
    } else {
      // 일시정지: 현재 진행률을 정확히 보존하고 정지
      pausedProgressRef.current = progressRef.current;
      setIsSubstepPlaying(false);
    }
  }, [isPlaying, playbackRevision]);

  useEffect(() => {
    if (!isSubstepPlaying || !isIntersecting) {
      return;
    }

    let frameId: number;
    let lastTick = 0;
    const minFrameInterval = 16; // 60 FPS 상한 제한

    const loop = (now: number) => {
      frameId = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (now - lastTick < minFrameInterval) return;
      lastTick = now;

      const cycle = currentCycle ?? 0;
      const elapsed = Math.max(0, now - startTimeRef.current);
      const rawProg = elapsed / flowDuration;
      const prog = Math.min(1, rawProg);
      progressRef.current = prog;
      setAnimProgress(prog);
      timelineSync.setProgress(cycle, prog);

      if (prog >= 1) {
        pausedProgressRef.current = 1;
      }
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isSubstepPlaying, isIntersecting, flowDuration, currentCycle]);

  const isSingle = mode === "single";

  // Single-Cycle 모드에서는 온칩(ALU + 레지스터) ↔ 시스템 버스 ↔ DRAM 데이터패스 다이어그램 렌더링
  if (isSingle) {
    return (
      <SingleCycleDatapath
        lessonContext={lessonContext}
        currentData={currentData}
        prevData={prevData}
        simulationData={simulationData}
        loadingMessage={loadingMessage}
      />
    );
  }

  if (loadingMessage) {
    return (
      <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] p-6 flex flex-col items-center justify-center gap-3 text-center transition-colors duration-150">
        <div className="w-9 h-9 border-3 border-[var(--ar-accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-[var(--ar-accent)]">{loadingMessage}</p>
        <p className="text-xs text-[var(--ar-text-muted)]">컴파일 및 파이프라인 시뮬레이션 결과를 준비하고 있습니다.</p>
      </div>
    );
  }

  const {
    buffers,
    clock,
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
    exMToExMemActive,
    exWbToExMemActive,
    memAluTrunkActive,
    memAluToDmemAddrActive,
    memAluBypassActive,
    memWriteDataActive,
    memDmemReadDataActive,
    memWbToMemWbActive,
    wbAluBypassActive,
    wbDmemReadDataActive,
    wbReverseFeedbackActive,
  } = computePipelineWireState(currentData, isSingle);

  // 10진수 PC 주소값 계산
  const ifPcStr = currentData?.stage_activity?.IF?.pc || buffers?.IF?.pc || currentData?.global_result?.current_pc;
  const ifPcNum = numericPc(ifPcStr);
  const ifPcDec = Number.isFinite(ifPcNum) ? String(ifPcNum) : (ifPcStr || "0");
  const ifPcPlus4Dec = Number.isFinite(ifPcNum) ? String(ifPcNum + 4) : "";

  // =========================================================================
  // [동적 스텝 타임라인 계산: 활성 선분 최장 길이 비례 + 소자 안착/처리 여유 시간(Dwell)]
  // =========================================================================

  // 1. IF STAGE (3 Steps: 주행 ➔ 소자 안착/처리 여유 ➔ 다음 주행)
  // -------------------------------------------------------------------------
  const ifStep1Len = Math.max(
    ifPcToImemActive ? PC_TO_IMEM_LEN : 0,
    ifPcToPlus4Active ? PC_TO_PLUS4_LEN : 0,
    ifPcToIfIdActive ? PC_TO_ADDR_LEN : 0
  ) || PC_TO_PLUS4_LEN;

  const ifStep2Len = Math.max(
    ifImemToIfIdActive ? IMEM_TO_IFID_LEN : 0,
    ifPlus4LoopbackActive ? PLUS4_LOOPBACK_LEN : 0
  ) || PLUS4_LOOPBACK_LEN;

  const ifStep3Len = ifPcMuxToPcActive ? MUX_TO_PC_LEN : 26;

  // 여유 시간(Pause/Dwell): Step1 후(0.06), Step2 후(0.06), 클록 종료 유지(0.06)
  const ifPause1 = 0.06;
  const ifPause2 = 0.06;
  const ifEndHold = 0.06;
  const ifTotalDriveBudget = 1.0 - (ifPause1 + ifPause2 + ifEndHold); // 0.82

  // 선 길이 비례 배분 + 가시성 바닥값 (기존 0.08과 0.06의 중간 0.07 보장)
  const ifStepSum = ifStep1Len + ifStep2Len + ifStep3Len;
  const ifRawDrive1 = ifStepSum > 0 ? ifTotalDriveBudget * (ifStep1Len / ifStepSum) : 0.20;
  const ifRawDrive2 = ifStepSum > 0 ? ifTotalDriveBudget * (ifStep2Len / ifStepSum) : 0.54;
  const ifRawDrive3 = ifTotalDriveBudget - ifRawDrive1 - ifRawDrive2;

  const ifDrive3 = Math.max(0.07, ifRawDrive3);
  const ifRem12 = ifTotalDriveBudget - ifDrive3;
  const ifLen12 = ifStep1Len + ifStep2Len;
  const ifDrive1 = ifLen12 > 0 ? ifRem12 * (ifStep1Len / ifLen12) : 0.20;
  const ifDrive2 = ifRem12 - ifDrive1;

  const ifStep1Start = 0.0;
  const ifStep1End = ifDrive1;
  const ifStep2Start = ifStep1End + ifPause1;
  const ifStep2End = ifStep2Start + ifDrive2;
  const ifStep3Start = ifStep2End + ifPause2;
  const ifStep3End = ifStep3Start + ifDrive3;

  const pcToImemState = getSynchronizedSubstepProgress(animProgress, ifStep1Start, ifStep1End, false, ifPause1);
  const pcToPlus4State = getSynchronizedSubstepProgress(animProgress, ifStep1Start, ifStep1End, false, ifPause1);
  const pcToAddrState = getSynchronizedSubstepProgress(animProgress, ifStep1Start, ifStep1End, false, ifPause1);
  const imemToIfIdState = getSynchronizedSubstepProgress(animProgress, ifStep2Start, ifStep2End, false, ifPause2);
  const plus4LoopbackState = getSynchronizedSubstepProgress(animProgress, ifStep2Start, ifStep2End, false, ifPause2);
  const muxToPcState = getSynchronizedSubstepProgress(animProgress, ifStep3Start, ifStep3End, true);

  const pcToImemPoint = pcToImemState ? interpolatePathPoints(PC_TO_IMEM_PTS, pcToImemState.progress) : null;
  const pcToPlus4Point = pcToPlus4State ? interpolatePathPoints(PC_TO_PLUS4_PTS, pcToPlus4State.progress) : null;
  const pcToAddrPoint = pcToAddrState ? interpolatePathPoints(PC_TO_ADDR_PTS, pcToAddrState.progress) : null;
  const imemToIfIdPoint = imemToIfIdState ? interpolatePathPoints(IMEM_TO_IFID_PTS, imemToIfIdState.progress) : null;
  const plus4LoopbackPoint = plus4LoopbackState ? interpolatePathPoints(PLUS4_LOOPBACK_PTS, plus4LoopbackState.progress) : null;
  const muxToPcPoint = muxToPcState ? interpolatePathPoints(MUX_TO_PC_PTS, muxToPcState.progress) : null;

  // 2. ID STAGE (2 Steps: IF/ID 분기 ➔ RegFile/ImmGen 안착 여유 ➔ ID/EX 전달 및 유지)
  // -------------------------------------------------------------------------
  const idStep1Len = Math.max(
    idToRegsActive ? ID_IFID_TO_REGS_LEN : 0,
    idToImmGenActive ? ID_IFID_TO_IMM_LEN : 0,
    idControlUnitActive ? ID_IFID_TO_CU_LEN : 0
  ) || ID_IFID_TO_IMM_LEN;

  const idStep2Len = Math.max(
    idRd1ToIdExActive ? ID_RD1_TO_IDEX_LEN : 0,
    idRd2ToIdExActive ? ID_RD2_TO_IDEX_LEN : 0,
    idImmToIdExActive ? ID_IMM_TO_IDEX_LEN : 0,
    idControlUnitActive ? ID_CU_TO_IDEX_LEN : 0,
    idPcToIdExActive ? ID_PC_TO_IDEX_LEN : 0
  ) || ID_RD1_TO_IDEX_LEN;

  const idPause = 0.08; // RegFile SRAM read & Imm decode latency
  const idEndHold = 0.08; // ID/EX latch hold
  const idTotalDriveBudget = 1.0 - (idPause + idEndHold); // 0.84

  // Step 1 및 Step 2 선 길이 비례 배분 (기존 0.28과 0.12의 중간 0.20 보장)
  const idLenSum = idStep1Len + idStep2Len;
  const idMinStep2 = Math.max(0.20, idLenSum > 0 ? idTotalDriveBudget * (idStep2Len / idLenSum) : 0.20);
  const idDrive2 = idMinStep2;
  const idDrive1 = idTotalDriveBudget - idDrive2;

  const idStep1Start = 0.0;
  const idStep1End = idDrive1;
  const idStep2Start = idStep1End + idPause;
  const idStep2End = idStep2Start + idDrive2;

  const idStep1State = getSynchronizedSubstepProgress(animProgress, idStep1Start, idStep1End, false, idPause);
  const idStep2State = getSynchronizedSubstepProgress(animProgress, idStep2Start, idStep2End, true);

  const idIfIdToRegsPoint = idStep1State ? interpolatePathPoints(ID_IFID_TO_REGS_PTS, idStep1State.progress) : null;
  const idIfIdToImmPoint = idStep1State ? interpolatePathPoints(ID_IFID_TO_IMM_PTS, idStep1State.progress) : null;
  const idIfIdToCuPoint = idStep1State ? interpolatePathPoints(ID_IFID_TO_CU_PTS, idStep1State.progress) : null;
  const idRd1Point = idStep2State ? interpolatePathPoints(ID_RD1_TO_IDEX_PTS, idStep2State.progress) : null;
  const idRd2Point = idStep2State ? interpolatePathPoints(ID_RD2_TO_IDEX_PTS, idStep2State.progress) : null;
  const idImmPoint = idStep2State ? interpolatePathPoints(ID_IMM_TO_IDEX_PTS, idStep2State.progress) : null;
  const idCuToIdExPoint = idStep2State ? interpolatePathPoints(ID_CU_TO_IDEX_PTS, idStep2State.progress) : null;
  const idPcPoint = idStep2State ? interpolatePathPoints(ID_PC_TO_IDEX_PTS, idStep2State.progress) : null;

  // 3. EX STAGE (3 Steps: MUX/소자 진입 ➔ MUX 선택 및 ALU 연산 ➔ EX/MEM 전달)
  // -------------------------------------------------------------------------
  const exStep1Len = Math.max(
    exRd1ToAluActive ? EX_RD1_TO_ALU_LEN : 0,
    exRd2ToAluSrcActive ? EX_RD2_TO_MUX_LEN : 0,
    exImmToAluSrcActive ? EX_IMM_TO_MUX_LEN : 0,
    exRd2ToWriteDataActive ? EX_RD2_TO_EXMEM_LEN : 0,
    exAluSrcToAluActive ? EX_CTRL_TO_MUX_LEN : 0,
    exImmToBranchAddActive ? EX_IMM_TO_BRANCH_LEN : 0,
    exPcToBranchAddActive ? EX_PC_TO_BRANCH_LEN : 0,
    exMToExMemActive ? EX_M_TO_EXMEM_LEN : 0,
    exWbToExMemActive ? EX_WB_TO_EXMEM_LEN : 0
  ) || EX_RD1_TO_ALU_LEN;

  // ALU는 단순 선분이 아닌 32-bit 전가산기/로직 연산이므로 적정 가중치(45px) 부여 (과도한 늘어짐 방지)
  const exStep2Len = (exAluSrcToAluActive ? EX_MUX_TO_ALU_LEN : 36) + 45;
  const exStep3Len = Math.max(
    exAluToExMemActive ? EX_ALU_TO_EXMEM_LEN : 0,
    exBranchAddActive ? EX_BRANCH_LOOPBACK_LEN : 0
  ) || EX_ALU_TO_EXMEM_LEN;

  const exPause1 = 0.05; // ALUSrc MUX 선택 대기
  const exPause2 = 0.05; // ALU 연산 완료 및 출력 안정화
  const exEndHold = 0.06; // EX/MEM 래치 유지
  const exTotalDriveBudget = 1.0 - (exPause1 + exPause2 + exEndHold); // 0.84

  // 선 길이 비례 드라이브 분배 + 균형 잡힌 가시성 바닥값 (기존 0.28/0.18과 0.16/0.08의 중간: Step 1 min 0.22, Step 2 min 0.13)
  const exStepSum = exStep1Len + exStep2Len + exStep3Len;
  const exRawDrive1 = exStepSum > 0 ? exTotalDriveBudget * (exStep1Len / exStepSum) : 0.38;
  const exRawDrive2 = exStepSum > 0 ? exTotalDriveBudget * (exStep2Len / exStepSum) : 0.22;

  const exDrive1 = Math.max(0.22, exRawDrive1);
  const exDrive2 = Math.max(0.13, exRawDrive2);
  const exDrive3 = exTotalDriveBudget - exDrive1 - exDrive2;

  const exStep1Start = 0.0;
  const exStep1End = exDrive1;
  const exStep2Start = exStep1End + exPause1;
  const exStep2End = exStep2Start + exDrive2;
  const exStep3Start = exStep2End + exPause2;
  const exStep3End = exStep3Start + exDrive3;

  const exStep1State = getSynchronizedSubstepProgress(animProgress, exStep1Start, exStep1End, false, exPause1);
  const exStep2State = getSynchronizedSubstepProgress(animProgress, exStep2Start, exStep2End, false, exPause2);
  const exStep3State = getSynchronizedSubstepProgress(animProgress, exStep3Start, exStep3End, true);

  // A는 Step 1 시작(exStep1Start)에 MUX 입력선들과 동시 출발하여,
  // Step 2 종료(exStep2End) 시점에 MUX ➔ ALU B선과 동시에 ALU 입력 포트에 도착
  const exRd1State = getSynchronizedSubstepProgress(
    animProgress,
    exStep1Start,
    exStep2End,
    false,
    exPause2
  );
  // WData(Store)는 Step 1에서 EX/MEM 버퍼까지 이동 후 사이클 끝까지 Latch 유지
  const exRd2MemState = getSynchronizedSubstepProgress(animProgress, exStep1Start, exStep1End, true);

  // Branch Loopback: Branch Add 출력 ➔ PC MUX 루프백 1839px 외곽 회랑 주행
  // Step 2에서 Branch Add 연산 완료 후 Step 3(동일 스텝선들과 동시 출발)에 PC MUX로 전달 및 도착 유지
  const branchLoopbackState = exBranchAddActive ? exStep3State : null;

  // M / WB 제어 신호 전달: Step 1에서 하강하여 도착 (Step 1 동기화 규격 준수)
  const exMCtrlState = exStep1State;
  const exWbCtrlState = exStep1State;

  const exRd1Point = exRd1State ? interpolatePathPoints(EX_RD1_TO_ALU_PTS, exRd1State.progress) : null;
  const exRd2MuxPoint = exStep1State ? interpolatePathPoints(EX_RD2_TO_MUX_PTS, exStep1State.progress) : null;
  const exRd2MemPoint = exRd2MemState ? interpolatePathPoints(EX_RD2_TO_EXMEM_PTS, exRd2MemState.progress) : null;
  const exImmMuxPoint = exStep1State ? interpolatePathPoints(EX_IMM_TO_MUX_PTS, exStep1State.progress) : null;
  const exCtrlToMuxPoint = exStep1State ? interpolatePathPoints(EX_CTRL_TO_MUX_PTS, exStep1State.progress) : null;
  const exImmToBranchPoint = exStep1State ? interpolatePathPoints(EX_IMM_TO_BRANCH_PTS, exStep1State.progress) : null;
  const exPcToBranchPoint = exStep1State ? interpolatePathPoints(EX_PC_TO_BRANCH_PTS, exStep1State.progress) : null;
  const exMCtrlPoint = exMCtrlState ? interpolatePathPoints(EX_M_TO_EXMEM_PTS, exMCtrlState.progress) : null;
  const exWbCtrlPoint = exWbCtrlState ? interpolatePathPoints(EX_WB_TO_EXMEM_PTS, exWbCtrlState.progress) : null;

  const exMuxToAluPoint = exStep2State ? interpolatePathPoints(EX_MUX_TO_ALU_PTS, exStep2State.progress) : null;
  const exAluToExMemPoint = exStep3State ? interpolatePathPoints(EX_ALU_TO_EXMEM_PTS, exStep3State.progress) : null;
  const exBranchLoopbackPoint = branchLoopbackState ? interpolatePathPoints(EX_BRANCH_LOOPBACK_PTS, branchLoopbackState.progress) : null;

  // 4. MEM STAGE (가변 1~2 Steps: Bypass는 여유 있는 단일 주행, 메모리는 D-Mem 안착 여유 포함)
  // -------------------------------------------------------------------------
  const isMemOp = isLoad(memOp) || isStore(memOp);
  // Bypass는 단일 주행 (0.00 ~ 0.88 후 1.00까지 유지)
  const memBypassState = getSynchronizedSubstepProgress(animProgress, 0.00, 0.88, true);

  const memStep1Len = Math.max(
    memAluToDmemAddrActive ? MEM_ADDR_TO_DMEM_LEN : 0,
    memWriteDataActive ? MEM_DATA_TO_DMEM_LEN : 0,
    memAluToDmemAddrActive ? MEM_CTRL_TO_DMEM_LEN : 0,
    memWbToMemWbActive ? MEM_WB_TO_MEMWB_LEN : 0
  ) || MEM_ADDR_TO_DMEM_LEN;

  const memStep2Len = memDmemReadDataActive ? MEM_DMEM_TO_MEMWB_LEN : 48;

  const memPause = 0.12; // Data Memory SRAM 접근 레이턴시 여유
  const memEndHold = 0.10; // MEM/WB 래치 유지
  const memTotalDriveBudget = 1.0 - (memPause + memEndHold); // 0.78
  const memLenSum = memStep1Len + memStep2Len;
  const memDrive1 = memLenSum > 0 ? memTotalDriveBudget * (memStep1Len / memLenSum) : 0.39;
  const memDrive2 = memTotalDriveBudget - memDrive1;

  const memStep1Start = 0.0;
  const memStep1End = memDrive1;
  const memStep2Start = memStep1End + memPause;
  const memStep2End = memStep2Start + memDrive2;

  const memStep1State = getSynchronizedSubstepProgress(animProgress, memStep1Start, memStep1End, false, memPause);
  const memStep2State = getSynchronizedSubstepProgress(animProgress, memStep2Start, memStep2End, true);
  const memWbCtrlState = memStep1State;

  const memBypassPoint = memBypassState ? interpolatePathPoints(MEM_BYPASS_PTS, memBypassState.progress) : null;
  const memAddrPoint = memStep1State ? interpolatePathPoints(MEM_ADDR_TO_DMEM_PTS, memStep1State.progress) : null;
  const memDataPoint = memStep1State ? interpolatePathPoints(MEM_DATA_TO_DMEM_PTS, memStep1State.progress) : null;
  const memCtrlToDmemPoint = memStep1State ? interpolatePathPoints(MEM_CTRL_TO_DMEM_PTS, memStep1State.progress) : null;
  const memWbCtrlPoint = memWbCtrlState ? interpolatePathPoints(MEM_WB_TO_MEMWB_PTS, memWbCtrlState.progress) : null;
  const memReadPoint = memStep2State ? interpolatePathPoints(MEM_DMEM_TO_MEMWB_PTS, memStep2State.progress) : null;

  // 5. WB STAGE (2 Steps: MUX 진입 ➔ MUX 선택 여유 ➔ 역방향 루프 주행 ➔ RegFile 안착 및 유지)
  // -------------------------------------------------------------------------
  const wbStep1Len = Math.max(
    wbAluBypassActive ? WB_ALU_TO_MUX_LEN : 0,
    wbDmemReadDataActive ? WB_DMEM_TO_MUX_LEN : 0,
    (wbAluBypassActive || wbDmemReadDataActive) ? WB_CTRL_TO_MUX_LEN : 0
  ) || WB_ALU_TO_MUX_LEN;

  const wbStep2Len = wbReverseFeedbackActive ? WB_FEEDBACK_LEN : 1345;

  const wbPause = 0.06; // MemtoReg MUX 선택 판단 여유
  const wbEndHold = 0.08; // Register File 쓰기 래치 유지
  const wbTotalDriveBudget = 1.0 - (wbPause + wbEndHold); // 0.86

  const wbLenSum = wbStep1Len + wbStep2Len;
  const wbDrive1 = Math.max(0.11, wbLenSum > 0 ? wbTotalDriveBudget * (wbStep1Len / wbLenSum) : 0.11);
  const wbDrive2 = wbTotalDriveBudget - wbDrive1;

  const wbStep1Start = 0.0;
  const wbStep1End = wbDrive1;
  const wbStep2Start = wbStep1End + wbPause;
  const wbStep2End = wbStep2Start + wbDrive2;

  const wbStep1State = getSynchronizedSubstepProgress(animProgress, wbStep1Start, wbStep1End, false, wbPause);
  const wbStep2State = getSynchronizedSubstepProgress(animProgress, wbStep2Start, wbStep2End, true);

  const wbAluToMuxPoint = wbStep1State ? interpolatePathPoints(WB_ALU_TO_MUX_PTS, wbStep1State.progress) : null;
  const wbDmemToMuxPoint = wbStep1State ? interpolatePathPoints(WB_DMEM_TO_MUX_PTS, wbStep1State.progress) : null;
  const wbCtrlToMuxPoint = wbStep1State ? interpolatePathPoints(WB_CTRL_TO_MUX_PTS, wbStep1State.progress) : null;
  const wbFeedbackPoint = wbStep2State ? interpolatePathPoints(WB_FEEDBACK_PTS, wbStep2State.progress) : null;

  // =========================================================================
  // [파이프라인 버퍼 래치 판정: 클록 엣지 도착 동기화]
  // 해당 버퍼로 향하는 신호가 안착 지점에 도달(progress >= 0.85)하거나,
  // 다운스트림 스테이지가 이미 해당 명령어를 처리 중인 경우(이전 클록 엣지에서 래치되어 유지)
  // =========================================================================
  const isIfIdLatched = isIdActive || (isIfActive && (imemToIfIdState?.progress ?? 0) >= 0.85);
  const isAddr1Latched = isIdActive || (ifPcToIfIdActive && (pcToAddrState?.progress ?? 0) >= 0.85);

  const isIdExLatched = isExActive || (isIdActive && (idStep2State?.progress ?? 0) >= 0.85);
  const isAddr2Latched = isExActive || (idPcToIdExActive && (idStep2State?.progress ?? 0) >= 0.85);
  const isSignal1Latched = isExActive || (idControlUnitActive && (idStep2State?.progress ?? 0) >= 0.85);

  const isExMemLatched = isMemActive || (isExActive && (exStep3State?.progress ?? 0) >= 0.85);
  const isSignal2Latched = isMemActive || ((exMToExMemActive || exWbToExMemActive) && (exStep3State?.progress ?? 0) >= 0.85);

  const isMemWbLatched = isWbActive || (isMemActive && (memStep2State?.progress ?? 0) >= 0.85);
  const isSignal3Latched = isWbActive || (memWbToMemWbActive && (memStep2State?.progress ?? 0) >= 0.85);

  // 스테이지별 피연산자 및 실시간 값 매핑
  const regMap = currentData?.global_result?.registers || {};

  const idParsed = parseInstructionDetails(idInst);
  const idRs1Name = idParsed.rs1 || '';
  const idRs2Name = idParsed.rs2 || '';
  const idRs1Key = resolveRegKey(idRs1Name);
  const idRs2Key = resolveRegKey(idRs2Name);
  const idRd1Val = idRs1Key && regMap[idRs1Key] !== undefined ? `${idRs1Name}: ${formatRegVal(regMap[idRs1Key])}` : (idRs1Name || 'rs1');
  const idRd2Val = idRs2Key && regMap[idRs2Key] !== undefined ? `${idRs2Name}: ${formatRegVal(regMap[idRs2Key])}` : (idRs2Name || 'rs2');
  const idImmVal = usesImm(idOp) ? (idParsed.imm || 'imm') : 'imm';

  const idPcStr = currentData?.stage_activity?.ID?.pc || buffers?.ID?.pc;
  const idPcNum = numericPc(idPcStr);
  const idPcDec = Number.isFinite(idPcNum) ? String(idPcNum) : (idPcStr || (Number.isFinite(ifPcNum) && ifPcNum !== null ? String(ifPcNum - 4) : "0"));

  const exPcStr = currentData?.stage_activity?.EX?.pc || buffers?.EX?.pc;
  const exPcNum = numericPc(exPcStr) ?? 0;
  const exPcDec = Number.isFinite(exPcNum) ? String(exPcNum) : (exPcStr || "0");

  const exParsed = parseInstructionDetails(exInst);
  const exRs1Name = exParsed.rs1 || '';
  const exRs2Name = exParsed.rs2 || '';
  const exRs1Key = resolveRegKey(exRs1Name);
  const exRs2Key = resolveRegKey(exRs2Name);
  const exRd1Val = exRs1Key && regMap[exRs1Key] !== undefined ? formatRegVal(regMap[exRs1Key]) : (exRs1Name || 'opA');
  const exRs2Val = exRs2Key && regMap[exRs2Key] !== undefined ? formatRegVal(regMap[exRs2Key]) : (exRs2Name || 'opB');
  const exImmVal = exParsed.imm || 'imm';
  const exAluSrcVal = usesImm(exOp) ? exImmVal : exRs2Val;
  const exAluResVal = computeAluDisplayVal(exParsed, regMap, exPcNum);

  let exImmNum = 0;
  if (exParsed.imm) {
    exImmNum = exParsed.imm.startsWith('0x') || exParsed.imm.startsWith('0X')
      ? Number.parseInt(exParsed.imm, 16) || 0
      : Number.parseInt(exParsed.imm, 10) || 0;
  }
  const exBranchTargetNum = (exPcNum + exImmNum) | 0;
  const exBranchTargetVal = `0x${(exBranchTargetNum >>> 0).toString(16)}`;

  const memParsed = parseInstructionDetails(memInst);
  const memRdName = memParsed.rd || memParsed.rs2 || '';
  const memRdKey = resolveRegKey(memRdName);
  const memVal = memRdKey && regMap[memRdKey] !== undefined ? formatRegVal(regMap[memRdKey]) : 'res';

  const wbParsed = parseInstructionDetails(wbInst);
  const wbRdName = wbParsed.rd || '';
  const wbRdKey = resolveRegKey(wbRdName);
  const wbVal = wbRdKey && regMap[wbRdKey] !== undefined ? `${wbRdName}: ${formatRegVal(regMap[wbRdKey])}` : (wbRdName || 'write');

  // 칩 주행과 100% 실시간 동기화되는 와이어 굵기/투명도 헬퍼
  // - 칩이 주행 중일 때: strokeWidth 4.0 (점선 3.6), opacity 1.0 (선명하게 굵어짐)
  // - 칩이 대기/도착 후일 때: strokeWidth 2.4, opacity 0.40 (부드러운 대기선)
  // - 비활성 상태: opacity 0
  const syncWireProps = (
    active: boolean,
    stepState: { progress: number; opacity: number } | null | undefined,
    isDashed = false
  ) => {
    const isDriving = Boolean(active && stepState && stepState.progress < 1.0 && stepState.opacity > 0.05);
    const strokeWidth = active ? (isDriving ? (isDashed ? 3.6 : 4.0) : 2.4) : (isInitialEmpty ? 2.0 : 1.8);
    const opacity = (isInitialEmpty || active) ? (active ? (isDriving ? 1.0 : 0.40) : 1) : 0;
    return {
      strokeWidth,
      style: {
        opacity,
        transition: "stroke-width 0.15s ease-out, opacity 0.2s ease-out",
        pointerEvents: ((isInitialEmpty || active) ? "auto" : "none") as React.CSSProperties["pointerEvents"],
      },
    };
  };

  // 칩이 없는 정적 단순 전달선 (M->M, WB->WB, PC 전달선 등): 1.8px 고정
  const staticWireProps = (active: boolean) => {
    const opacity = (isInitialEmpty || active) ? (active ? 0.45 : 1) : 0;
    return {
      strokeWidth: 1.8,
      style: {
        opacity,
        transition: "opacity 0.25s ease-in-out",
        pointerEvents: ((isInitialEmpty || active) ? "auto" : "none") as React.CSSProperties["pointerEvents"],
      },
    };
  };

  const boxStepClass = (_active: boolean, _step?: number) => undefined;

  const cycleEvents = currentData?.cycle_events;

  // 줌 조절
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(2.5, +(prev + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.5, +(prev - 0.15).toFixed(2)));
  const handleZoomReset = () => setZoomLevel(1.0);

  // 5개 스테이지 카드 렌더링 헬퍼 (스타일 B: 2열 우측 테두리에 플로팅 태그 오버레이)
  const renderStageCard = (
    stage: "IF" | "ID" | "EX" | "MEM" | "WB",
    cardY: number,
    fullName: string,
    inst: string,
    activeColor: string,
    activeBg: string,
    activeDarkText: string,
    isActive: boolean
  ) => {
    const isFlushed = Boolean(
      cycleEvents?.control_hazard?.flushed_stages?.includes(stage) ||
      buffers?.[stage]?.status === "flush" ||
      buffers?.[stage]?.status === "flushed" ||
      buffers?.[stage]?.assembly?.toLowerCase() === "flush"
    );
    const isStalled = Boolean(
      (cycleEvents?.stall?.has_stall && cycleEvents?.stall?.stage === stage) ||
      buffers?.[stage]?.status === "stall"
    );
    const isStallBubble = Boolean(
      !isStalled &&
      cycleEvents?.stall?.has_stall &&
      (inst === "bubble" || inst === "—") &&
      (stage === "EX" || buffers?.[stage]?.status === "bubble")
    );
    const isBubble = inst === "bubble";
    const isEmpty = Boolean(inst === "—" || inst === "empty" || isInitialEmpty);

    // 카드 테두리 및 배경: 활성 명령어일 때만 고유 색상 적용, 버블/플러시/유휴 상태일 때는 모두 차분한 기본 회색 유지
    const cardFill = isActive ? activeBg : "#F8FAFC";
    const cardStroke = isActive ? activeColor : "#94A3B8";
    const headerFill = isActive ? activeColor : "#94A3B8";
    const dividerStroke = isActive ? activeColor : "#94A3B8";

    const hasFloatingTag = isFlushed || isStalled || isStallBubble;

    return (
      <g key={stage}>
        {/* 1. 외곽 카드 바디 */}
        <rect
          x="-40"
          y={cardY}
          width="240"
          height="76"
          rx="10"
          fill={cardFill}
          stroke={cardStroke}
          strokeWidth="2.5"
        />
        {/* 2. 상단 헤더 배너 (1열) */}
        <path
          d={`M -40,${cardY + 10} a 10,10 0 0 1 10,-10 h 220 a 10,10 0 0 1 10,10 v 23 h -240 z`}
          fill={headerFill}
        />
        <text
          x="80"
          y={cardY + 17}
          dominantBaseline="central"
          fill="#FFFFFF"
          fontSize="18.5"
          fontWeight="bold"
          fontFamily="sans-serif"
          textAnchor="middle"
        >
          {fullName}
        </text>
        <line
          x1="-40"
          y1={cardY + 33}
          x2="200"
          y2={cardY + 33}
          stroke={dividerStroke}
          strokeWidth="1.5"
        />

        {/* 3. 하단 본문 영역 (2열: 명령어 또는 bubble) */}
        <text
          x={hasFloatingTag ? "72" : "80"}
          y={cardY + 55}
          dominantBaseline="central"
          fill={isActive ? activeDarkText : "#94A3B8"}
          fontSize={isEmpty ? "19" : isBubble ? "17.5" : "18"}
          fontFamily="'D2Coding', Consolas, monospace"
          fontWeight="bold"
          textAnchor="middle"
        >
          {inst}
        </text>

        {/* 4. 2열 오른쪽 테두리에 걸친 플로팅 태그 (Style B: Border Overlap Tag) */}
        {isFlushed && (
          <g
            transform={`translate(196, ${cardY + 54.5})`}
            style={{ filter: "drop-shadow(0 1.5px 3px rgba(220, 38, 38, 0.25))" }}
          >
            <rect
              x="-28"
              y="-10.5"
              width="56"
              height="21"
              rx="10.5"
              fill="#FEE2E2"
              stroke="#EF4444"
              strokeWidth="1.5"
            />
            <text
              x="0"
              y="0.5"
              dominantBaseline="central"
              textAnchor="middle"
              fill="#DC2626"
              fontSize="11"
              fontWeight="800"
              fontFamily="sans-serif"
            >
              FLUSH
            </text>
          </g>
        )}

        {(isStalled || isStallBubble) && !isFlushed && (
          <g
            transform={`translate(196, ${cardY + 54.5})`}
            style={{ filter: "drop-shadow(0 1.5px 3px rgba(217, 119, 6, 0.25))" }}
          >
            <rect
              x="-28"
              y="-10.5"
              width="56"
              height="21"
              rx="10.5"
              fill="#FEF3C7"
              stroke="#F59E0B"
              strokeWidth="1.5"
            />
            <text
              x="0"
              y="0.5"
              dominantBaseline="central"
              textAnchor="middle"
              fill="#D97706"
              fontSize="11"
              fontWeight="800"
              fontFamily="sans-serif"
            >
              STALL
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div ref={containerRef} className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] flex flex-col justify-between overflow-hidden relative select-none min-h-0 transition-colors duration-150">
      {/* 1. 상단 헤더 & 컨트롤러 */}
      <div className={`h-8 shrink-0 flex items-center justify-between px-3.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 border-l-2 ${isSingle ? "border-l-amber-500" : "border-l-blue-500"}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[11px] font-bold ${isSingle ? "text-amber-500" : "text-blue-500"}`}>◆</span>
          <h3 className="font-sans text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wide whitespace-nowrap">
            {isSingle ? "SINGLE-CYCLE DATAPATH" : "PIPELINE DATAPATH"}
          </h3>
          <span className="text-[10px] text-[var(--ar-text-muted)] font-mono shrink-0 tabular-nums">
            ({isSingle ? `STEP:${clock ?? "—"}` : `CYCLE:${clock ?? "—"}`})
          </span>
        </div>

        {/* 줌 컨트롤 */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-[#F6F8FA] dark:bg-[#252526] border border-[#D0D7DE] dark:border-[#3E3E42] rounded px-1 py-0.5 text-[#57606A] dark:text-[#CCCCCC] text-[10px]">
            <button
              onClick={handleZoomOut}
              className="px-1 hover:text-[#005FB8] dark:hover:text-[#007ACC] font-bold cursor-pointer"
              title="축소"
            >
              −
            </button>
            <button
              onClick={handleZoomReset}
              className="px-1 font-mono font-semibold hover:text-[#005FB8] dark:hover:text-[#007ACC] cursor-pointer"
              title="100% (세로 맞춤)"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="px-1 hover:text-[#005FB8] dark:hover:text-[#007ACC] font-bold cursor-pointer"
              title="확대"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* 2. 고해상도 마스터 SVG 뷰포트:
           - 100%일 때 세로(height: 100%)를 꽉 채우고, SVG 고유 비율에 맞춰 가로 폭 자동 결정
           - overflow: "scroll"로 가로/세로 스크롤바 트랙 여백을 상시 100% 예약하여,
             스크롤바가 활성화되거나 비활성화되어도 다이어그램 크기가 일체 덜컹거리지 않음
           - transform: scale() 대신 실제 레이아웃 크기(height %)와 m-auto를 사용하여 확대 시 상하좌우 잘림 없이 스크롤 가능 */}
      <div
        className="flex-1 relative w-full min-h-0 p-1 custom-scrollbar flex overflow-x-scroll overflow-y-scroll"
        style={{ scrollbarGutter: "stable both-edges" }}
      >
        <div
          className="m-auto shrink-0 transition-all duration-150"
          style={{
            height: `${zoomLevel * 100}%`,
            maxHeight: "100%",
            maxWidth: "100%",
            aspectRatio: `${MASTER_WIDTH} / ${MASTER_HEIGHT}`,
          }}
        >
          <svg
            viewBox="-75 -80 1240 1400"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full select-none block"
          >
            <defs>
              {/* 정밀 화살표 마커 (끝점 refX=8.5로 선 끝이 박스 경계에 정확히 닿도록 설정) */}
              <marker id="m-arr-def" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#94A3B8" />
              </marker>
              <marker id="m-arr-red" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#EF4444" />
              </marker>
              <marker id="m-arr-orange" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#EA580C" />
              </marker>
              <marker id="m-arr-amber" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#D97706" />
              </marker>
              <marker id="m-arr-green" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#16A34A" />
              </marker>
              <marker id="m-arr-blue" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#0284C7" />
              </marker>
              <marker id="m-arr-purple" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#8B5CF6" />
              </marker>
              <marker id="m-arr-cyan" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#0891B2" />
              </marker>
              {/* 5대 스테이지 무지개 대각선 그라데이션 (파스텔 톤: IF 빨 -> ID 주 -> EX 초 -> MEM 파 -> WB 보) */}
              <linearGradient id="stage-rainbow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F87171" />
                <stop offset="25%" stopColor="#FB923C" />
                <stop offset="50%" stopColor="#34D399" />
                <stop offset="75%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#A78BFA" />
              </linearGradient>
              {/* 알약 슬라이더 노브 그림자 */}
              <filter id="pill-knob-shadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#0F172A" floodOpacity="0.2" />
              </filter>
              {/* 펄스 글로우 및 쉐도우 필터 */}
              <filter id="token-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#EF4444" floodOpacity="0.45" />
              </filter>
            </defs>

            {/* ============================================================ */}
            {/* [1열: 좌측 열] 스테이지 + 명령어 컴팩트 2층 카드 5개 (규격 슬림화: x=-40, w=210, h=76) */}
            {/* ============================================================ */}


            {/* [좌측 5개 스테이지 카드] 해저드 배지 (STALL / FLUSH / BUBBLE) 통합 렌더링 */}
            {renderStageCard("IF", 104, "IF · Instruction Fetch", ifInst, "#EF4444", "#FEF2F2", "#991B1B", isIfActive)}
            {renderStageCard("ID", 388, "ID · Instruction Decode", idInst, "#EA580C", "#FFF7ED", "#C2410C", isIdActive)}
            {renderStageCard("EX", 700, "EX · Execute", exInst, "#16A34A", "#F0FDF4", "#15803D", isExActive)}
            {renderStageCard("MEM", 1008, "MEM · Memory Access", memInst, "#0284C7", "#F0F9FF", "#0369A1", isMemActive)}
            {renderStageCard("WB", 1229, "WB · Write Back", wbInst, "#8B5CF6", "#F5F3FF", "#6D28D9", isWbActive)}

            {/* ============================================================ */}
            {/* [2열: 우측 열] 순수 데이터패스 본체 (좌측 60px 당김: translate(170, 0)) */}
            {/* ============================================================ */}
            <g key={clock ?? 0} transform="translate(170, 0)">
              {/* ============================================================ */}
              {/* 부품 0: PC MUX (분기 선택기: 0=PC+4, 1=Branch Target - EX/WB와 규격 통일: 100x38, center 380) */}
              {/* ============================================================ */}
              <rect
                x="330"
                y="14"
                width="100"
                height="38"
                rx="19"
                ry="19"
                className={boxStepClass(ifPcMuxToPcActive, 0)}
                fill={ifPcMuxToPcActive ? "#FEF2F2" : "#F8FAFC"}
                stroke={ifPcMuxToPcActive ? "#EF4444" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="380"
                y="33"
                dominantBaseline="central"
                fill={ifPcMuxToPcActive ? "#991B1B" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                MUX
              </text>

              {/* PC MUX ➔ PC 직하강 화살표 (MUX 하단 y=52 ➔ PC 상단 y=78: 최종 Step 3에서 래치 전파) */}
              <line
                x1="380"
                y1="52"
                x2="380"
                y2="78"
                stroke={ifPcMuxToPcActive ? "#EF4444" : inactiveStroke}
                {...syncWireProps(ifPcMuxToPcActive, muxToPcState)}
                markerEnd={ifPcMuxToPcActive ? "url(#m-arr-red)" : inactiveMarker}
              />

              {/* 부품 1: PC (세로 확장 height=56, y=80..136, center=380: Step 1 주소 출력) */}
              <rect
                x="260"
                y="80"
                width="240"
                height="56"
                rx="8"
                className={boxStepClass(isIfActive, 1)}
                fill={isIfActive ? "#FEF2F2" : "#F8FAFC"}
                stroke={isIfActive ? "#EF4444" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="380"
                y="108"
                dominantBaseline="central"
                textAnchor="middle"
                className="select-none"
                fill={isIfActive ? "#991B1B" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                PC
              </text>

              {/* PC ➔ Instruction Memory 직하강 화살표 */}
              <line
                x1="380"
                y1="136"
                x2="380"
                y2="174"
                stroke={ifPcToImemActive ? "#EF4444" : inactiveStroke}
                {...syncWireProps(ifPcToImemActive, pcToImemState)}
                markerEnd={ifPcToImemActive ? "url(#m-arr-red)" : inactiveMarker}
              />

              {/* PC ➔ PC + 4 Adder 연결 화살표 (x=500 -> 756, y=108) */}
              <path
                d="M 500,108 L 756,108"
                fill="none"
                stroke={ifPcToPlus4Active ? "#EF4444" : inactiveStroke}
                {...syncWireProps(ifPcToPlus4Active, pcToPlus4State)}
                markerEnd={ifPcToPlus4Active ? "url(#m-arr-red)" : inactiveMarker}
              />
              {/* PC 분기 노드 및 IF/ID BUFFER 직하강 라인 (x=701 Addr 버퍼 센터로 직하강, RISC-V 순수 PC 전달) */}
              <circle
                cx="701"
                cy="108"
                r={ifPcToIfIdActive && pcToAddrState && pcToAddrState.progress < 1.0 ? 5.5 : 3.5}
                fill={ifPcToIfIdActive ? "#EF4444" : inactiveStroke}
                style={{
                  opacity: ifPcToIfIdActive && pcToAddrState && pcToAddrState.progress < 1.0 ? 1.0 : 0.45,
                  transition: "r 0.15s ease-out, opacity 0.2s ease-out",
                }}
              />
              <line
                x1="701"
                y1="108"
                x2="701"
                y2="283"
                stroke={ifPcToIfIdActive ? "#EF4444" : inactiveStroke}
                {...syncWireProps(ifPcToIfIdActive, pcToAddrState)}
                markerEnd={ifPcToIfIdActive ? "url(#m-arr-red)" : inactiveMarker}
              />

              {/* PC + 4 가산기 (Control Unit과 동일한 center cx=801로 이동) */}
              <polygon
                points="756,88 846,88 826,128 776,128"
                className={boxStepClass(ifPlus4LoopbackActive, 1)}
                fill={ifPlus4LoopbackActive ? "#FEF2F2" : "#F8FAFC"}
                stroke={ifPlus4LoopbackActive ? "#EF4444" : "#94A3B8"}
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              <text
                x="801"
                y="108"
                dominantBaseline="central"
                fill={ifPlus4LoopbackActive ? "#991B1B" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                + 4
              </text>

              {/* PC + 4 루프백 ➔ PC MUX 입력 0 (포트 0: 상단 x=410 직하강 인입, 우측 회랑 x=870) */}
              <path
                d="M 801,128 L 801,168 L 870,168 L 870,-22 L 410,-22 L 410,12"
                fill="none"
                stroke={ifPlus4LoopbackActive ? "#EF4444" : inactiveStroke}
                {...syncWireProps(ifPlus4LoopbackActive, plus4LoopbackState)}
                markerEnd={ifPlus4LoopbackActive ? "url(#m-arr-red)" : inactiveMarker}
              />

              {/* Branch Target Address ➔ PC MUX 입력 1 (포트 1: EX Branch Add ➔ 우측 외곽 회랑 x=905 ➔ 상단 x=350 직하강) */}
              <path
                d="M 615,808 L 615,845 L 905,845 L 905,-50 L 350,-50 L 350,12"
                fill="none"
                stroke={exBranchAddActive ? "#16A34A" : inactiveStroke}
                strokeDasharray={branchLoopbackActive ? undefined : "6 3"}
                className={branchLoopbackActive ? undefined : "wire-dashed-flowing"}
                {...syncWireProps(exBranchAddActive, branchLoopbackState, !branchLoopbackActive)}
                markerEnd={exBranchAddActive ? "url(#m-arr-green)" : inactiveMarker}
              />

              {/* 부품 2: Instruction Memory (세로 확장 height=72, y=176..248, center=380) */}
              <rect
                x="230"
                y="176"
                width="300"
                height="72"
                rx="8"
                className={boxStepClass(isIfActive, 1)}
                fill={isIfActive ? "#FEF2F2" : "#F8FAFC"}
                stroke={isIfActive ? "#EF4444" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="380"
                y="212"
                dominantBaseline="central"
                fill={isIfActive ? "#991B1B" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Instruction Memory
              </text>

              {/* Instruction Memory ➔ IF/ID BUFFER 직하강 화살표 */}
              <line
                x1="380"
                y1="248"
                x2="380"
                y2="283"
                stroke={ifImemToIfIdActive ? "#EF4444" : inactiveStroke}
                {...syncWireProps(ifImemToIfIdActive, imemToIfIdState)}
                markerEnd={ifImemToIfIdActive ? "url(#m-arr-red)" : inactiveMarker}
              />

              {/* ============================================================ */}
              {/* 파이프라인 버퍼 1: IF / ID BUFFER (메인 데이터 560px + Addr 버퍼 46px, 간격 8px) */}
              {/* ============================================================ */}
              {/* 메인 데이터 버퍼 (X = 110 ~ 670) */}
              <rect
                x="110"
                y="285"
                width="560"
                height="26"
                rx="6"
                fill={isIfIdLatched ? "#FEF9C3" : "#F1F5F9"}
                stroke={isIfIdLatched ? "#EAB308" : "#94A3B8"}
                strokeWidth="2.8"
                style={{ transition: "fill 0.25s ease, stroke 0.25s ease" }}
              />
              <text
                x="390"
                y="298"
                dominantBaseline="central"
                fill={isIfIdLatched ? "#A16207" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
                style={{ transition: "fill 0.25s ease" }}
              >
                IF / ID BUFFER
              </text>

              {/* Addr 버퍼 1 (X = 678 ~ 724, W = 46) */}
              <rect
                x="678"
                y="285"
                width="46"
                height="26"
                rx="6"
                fill={isAddr1Latched ? "#FEF9C3" : "#F1F5F9"}
                stroke={isAddr1Latched ? "#EAB308" : "#94A3B8"}
                strokeWidth="2.8"
                style={{ transition: "fill 0.25s ease, stroke 0.25s ease" }}
              />
              <text
                x="701"
                y="298"
                dominantBaseline="central"
                fill={isAddr1Latched ? "#A16207" : "#94A3B8"}
                fontSize="16"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
                style={{ transition: "fill 0.25s ease" }}
              >
                Addr
              </text>

              {/* ============================================================ */}
              {/* [STAGE 2] INSTRUCTION DECODE (ID) : Y = 311 ~ 540            */}
              {/* ============================================================ */}
              {/* IF/ID BUFFER 직하강 트렁크 (x=380, y=311 -> 336) */}
              <line
                x1="380"
                y1="311"
                x2="380"
                y2="336"
                stroke={idTrunkActive ? "#EA580C" : inactiveStroke}
                {...syncWireProps(idTrunkActive, idStep1State)}
              />
              {/* IF/ID BUFFER ➔ Register File 분기 버스 */}
              <path
                d="M 380,336 L 295,336 L 295,366"
                fill="none"
                stroke={idToRegsActive ? "#EA580C" : inactiveStroke}
                {...syncWireProps(idToRegsActive, idStep1State)}
                markerEnd={idToRegsActive ? "url(#m-arr-orange)" : inactiveMarker}
              />
              {/* IF/ID BUFFER ➔ Imm Gen 분기 버스 */}
              <path
                d="M 380,336 L 578,336 L 578,366"
                fill="none"
                stroke={idToImmGenActive ? "#EA580C" : inactiveStroke}
                {...syncWireProps(idToImmGenActive, idStep1State)}
                markerEnd={idToImmGenActive ? "url(#m-arr-orange)" : inactiveMarker}
              />
              {/* IF/ID BUFFER ➔ Control Unit 분기 버스 */}
              <path
                d="M 380,336 L 801,336 L 801,366"
                fill="none"
                stroke={idControlUnitActive ? "#EA580C" : inactiveStroke}
                strokeDasharray="6 3"
                className="wire-dashed-flowing"
                {...syncWireProps(idControlUnitActive, idStep1State, true)}
                markerEnd={idControlUnitActive ? "url(#m-arr-orange)" : inactiveMarker}
              />

              {/* 부품 3: Registers (x=180, width=230, y=368..480, center=295) */}
              <rect
                x="180"
                y="368"
                width="230"
                height="112"
                rx="8"
                className={boxStepClass(idToRegsActive, 1)}
                fill={idToRegsActive ? "#FFF7ED" : "#F8FAFC"}
                stroke={idToRegsActive ? "#EA580C" : "#94A3B8"}
                strokeWidth="2.8"
              />

              {/* 좌측 중앙: 값이 들어가는 레지스터명 (WB rd) */}
              {writesReg(wbOp) && wbParsed.rd && (
                <text
                  x="200"
                  y="424"
                  dominantBaseline="central"
                  fill="#8B5CF6"
                  fontSize="13"
                  fontWeight="bold"
                  fontFamily="'D2Coding', Consolas, monospace"
                  textAnchor="middle"
                >
                  {wbParsed.rd}
                </text>
              )}

              <text
                x="295"
                y="424"
                dominantBaseline="central"
                fill={idToRegsActive ? "#C2410C" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Registers
              </text>

              {/* 하단: 값이 나오는 레지스터명 (ID rs1, rs2) */}
              {idParsed.rs1 && (
                <text
                  x="225"
                  y="462"
                  dominantBaseline="central"
                  fill="#EA580C"
                  fontSize="13"
                  fontWeight="bold"
                  fontFamily="'D2Coding', Consolas, monospace"
                  textAnchor="middle"
                >
                  {idParsed.rs1}
                </text>
              )}
              {idParsed.rs2 && (
                <text
                  x="365"
                  y="462"
                  dominantBaseline="central"
                  fill="#EA580C"
                  fontSize="13"
                  fontWeight="bold"
                  fontFamily="'D2Coding', Consolas, monospace"
                  textAnchor="middle"
                >
                  {idParsed.rs2}
                </text>
              )}

              {/* 부품 4: Imm Gen (세로형 타원 rx=44, ry=58, cx=578, cy=424) */}
              <ellipse
                cx="578"
                cy="424"
                rx="44"
                ry="58"
                className={boxStepClass(idToImmGenActive, 1)}
                fill={idToImmGenActive ? "#FFF7ED" : "#F8FAFC"}
                stroke={idToImmGenActive ? "#EA580C" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="578"
                y="412"
                dominantBaseline="central"
                fill={idToImmGenActive ? "#C2410C" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Imm
              </text>
              <text
                x="578"
                y="436"
                dominantBaseline="central"
                fill={idToImmGenActive ? "#C2410C" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Gen
              </text>

              {/* 부품 5: Control Unit (세로형 타원 rx=44, ry=58, cx=801, cy=424) */}
              <ellipse
                cx="801"
                cy="424"
                rx="44"
                ry="58"
                className={boxStepClass(idControlUnitActive, 1)}
                fill={idControlUnitActive ? "#FFF7ED" : "#F8FAFC"}
                stroke={idControlUnitActive ? "#EA580C" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="801"
                y="412"
                dominantBaseline="central"
                fill={idControlUnitActive ? "#C2410C" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Control
              </text>
              <text
                x="801"
                y="436"
                dominantBaseline="central"
                fill={idControlUnitActive ? "#C2410C" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Unit
              </text>

              {/* ID 단계 출력 버스 ➔ ID/EX BUFFER (Y = 480 ➔ 538) */}
              {/* 1) Read Data 1 */}
              <line
                x1="225"
                y1="480"
                x2="225"
                y2="538"
                stroke={idRd1ToIdExActive ? "#EA580C" : inactiveStroke}
                {...syncWireProps(idRd1ToIdExActive, idStep2State)}
                markerEnd={idRd1ToIdExActive ? "url(#m-arr-orange)" : inactiveMarker}
              />
              {/* 2) Read Data 2 */}
              <line
                x1="365"
                y1="480"
                x2="365"
                y2="538"
                stroke={idRd2ToIdExActive ? "#EA580C" : inactiveStroke}
                {...syncWireProps(idRd2ToIdExActive, idStep2State)}
                markerEnd={idRd2ToIdExActive ? "url(#m-arr-orange)" : inactiveMarker}
              />
              {/* 3) Imm */}
              <line
                x1="578"
                y1="482"
                x2="578"
                y2="538"
                stroke={idImmToIdExActive ? "#EA580C" : inactiveStroke}
                {...syncWireProps(idImmToIdExActive, idStep2State)}
                markerEnd={idImmToIdExActive ? "url(#m-arr-orange)" : inactiveMarker}
              />
              {/* 4) PC 파이프라인 전달선 (IF/ID Addr ➔ ID/EX Addr, x=701) */}
              <line
                x1="701"
                y1="311"
                x2="701"
                y2="538"
                stroke={idPcToIdExActive ? "#EA580C" : inactiveStroke}
                {...syncWireProps(idPcToIdExActive, idStep2State)}
                markerEnd={idPcToIdExActive ? "url(#m-arr-orange)" : inactiveMarker}
              />
              {/* 5) Control Unit ➔ ID/EX SIGNAL BUFFER [EX, M, WB] 3분기 제어 버스 */}
              {/* 중앙 M셀 인입 직하강선: 제어 신호 칩(idCuToIdExPoint) 주행 경로 ➔ 굵기 펄스 애니메이션 적용 */}
              <line
                x1="801"
                y1="482"
                x2="801"
                y2="538"
                stroke={idControlUnitActive ? "#EA580C" : inactiveStroke}
                strokeDasharray="6 3"
                className="wire-dashed-flowing"
                {...syncWireProps(idControlUnitActive, idStep2State, true)}
                markerEnd={idControlUnitActive ? "url(#m-arr-orange)" : inactiveMarker}
              />
              {/* 좌우 분기 수평 분배선: 칩 없음 ➔ 정적 얇은 선 유지 */}
              <line
                x1="755"
                y1="508"
                x2="847"
                y2="508"
                stroke={idControlUnitActive ? "#EA580C" : inactiveStroke}
                strokeDasharray="6 3"
                className="wire-dashed-flowing"
                {...staticWireProps(idControlUnitActive)}
              />
              {/* 분기 1: EX 셀 인입 (X = 755: 칩 없음 ➔ 정적 얇은 선) */}
              <line
                x1="755"
                y1="508"
                x2="755"
                y2="538"
                stroke={idControlUnitActive ? "#EA580C" : inactiveStroke}
                strokeDasharray="6 3"
                className="wire-dashed-flowing"
                {...staticWireProps(idControlUnitActive)}
                markerEnd={idControlUnitActive ? "url(#m-arr-orange)" : inactiveMarker}
              />
              {/* 분기 3: WB 셀 인입 (X = 847: 칩 없음 ➔ 정적 얇은 선) */}
              <line
                x1="847"
                y1="508"
                x2="847"
                y2="538"
                stroke={idControlUnitActive ? "#EA580C" : inactiveStroke}
                strokeDasharray="6 3"
                className="wire-dashed-flowing"
                {...staticWireProps(idControlUnitActive)}
                markerEnd={idControlUnitActive ? "url(#m-arr-orange)" : inactiveMarker}
              />

              {/* ============================================================ */}
              {/* 파이프라인 버퍼 2: ID / EX BUFFER (데이터 560px + Addr 46px + 시그널 138px) */}
              {/* ============================================================ */}
              {/* 데이터 버퍼 (X = 110 ~ 670) */}
              <rect
                x="110"
                y="540"
                width="560"
                height="26"
                rx="6"
                fill={isIdExLatched ? "#FEF9C3" : "#F1F5F9"}
                stroke={isIdExLatched ? "#EAB308" : "#94A3B8"}
                strokeWidth="2.8"
                style={{ transition: "fill 0.25s ease, stroke 0.25s ease" }}
              />
              <text
                x="390"
                y="553"
                dominantBaseline="central"
                fill={isIdExLatched ? "#A16207" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
                style={{ transition: "fill 0.25s ease" }}
              >
                ID / EX BUFFER
              </text>

              {/* Addr 버퍼 2 (X = 678 ~ 724, W = 46) */}
              <rect
                x="678"
                y="540"
                width="46"
                height="26"
                rx="6"
                fill={isAddr2Latched ? "#FEF9C3" : "#F1F5F9"}
                stroke={isAddr2Latched ? "#EAB308" : "#94A3B8"}
                strokeWidth="2.8"
                style={{ transition: "fill 0.25s ease, stroke 0.25s ease" }}
              />
              <text
                x="701"
                y="553"
                dominantBaseline="central"
                fill={isAddr2Latched ? "#A16207" : "#94A3B8"}
                fontSize="16"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
                style={{ transition: "fill 0.25s ease" }}
              >
                Addr
              </text>

              {/* 시그널 버퍼 (X = 732 ~ 870) : [ EX | M | WB ] */}
              <g>
                <rect
                  x="732"
                  y="540"
                  width="138"
                  height="26"
                  rx="6"
                  fill="#F1F5F9"
                  stroke={isSignal1Latched ? "#EAB308" : "#94A3B8"}
                  strokeWidth="2.8"
                  style={{ transition: "stroke 0.25s ease" }}
                />
                <line x1="778" y1="540" x2="778" y2="566" stroke="#94A3B8" strokeWidth="1" />
                <line x1="824" y1="540" x2="824" y2="566" stroke="#94A3B8" strokeWidth="1" />

                {/* EX 셀 (X = 732 ~ 778) */}
                <rect
                  x="733"
                  y="541"
                  width="44"
                  height="24"
                  rx="5"
                  fill={isSignal1Latched ? "#F0FDF4" : "transparent"}
                  style={{ transition: "fill 0.25s ease" }}
                />
                <text
                  x="755"
                  y="553"
                  dominantBaseline="central"
                  fill={isSignal1Latched ? "#15803D" : "#94A3B8"}
                  fontSize="18"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  style={{ transition: "fill 0.25s ease" }}
                >
                  EX
                </text>

                {/* M 셀 (X = 778 ~ 824) */}
                <rect
                  x="779"
                  y="541"
                  width="44"
                  height="24"
                  rx="5"
                  fill={isSignal1Latched ? "#F0F9FF" : "transparent"}
                  style={{ transition: "fill 0.25s ease" }}
                />
                <text
                  x="801"
                  y="553"
                  dominantBaseline="central"
                  fill={isSignal1Latched ? "#0369A1" : "#94A3B8"}
                  fontSize="18"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  style={{ transition: "fill 0.25s ease" }}
                >
                  M
                </text>

                {/* WB 셀 (X = 824 ~ 870) */}
                <rect
                  x="825"
                  y="541"
                  width="44"
                  height="24"
                  rx="5"
                  fill={isSignal1Latched ? "#F5F3FF" : "transparent"}
                  style={{ transition: "fill 0.25s ease" }}
                />
                <text
                  x="847"
                  y="553"
                  dominantBaseline="central"
                  fill={isSignal1Latched ? "#6D28D9" : "#94A3B8"}
                  fontSize="18"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  style={{ transition: "fill 0.25s ease" }}
                >
                  WB
                </text>
              </g>

              {/* EX 제어선: ID/EX EX셀 ➔ ALUSrc MUX 우측면 인입 */}
              <path
                d="M 755,566 L 755,684 L 445,684"
                fill="none"
                stroke={exAluSrcToAluActive ? "#16A34A" : inactiveStroke}
                strokeDasharray="6 3"
                className="wire-dashed-flowing"
                {...syncWireProps(exAluSrcToAluActive, exStep1State, true)}
                markerEnd={exAluSrcToAluActive ? "url(#m-arr-green)" : inactiveMarker}
              />
              {/* 컨트롤 신호 전달선 1: M ➔ M (ID/EX M셀 ➔ EX/MEM M셀 수직 직하강) */}
              <line
                x1="801"
                y1="566"
                x2="801"
                y2="908"
                stroke={exMToExMemActive ? "#0284C7" : inactiveStroke}
                strokeDasharray="6 3"
                className="wire-dashed-flowing"
                {...syncWireProps(exMToExMemActive, exMCtrlState, true)}
                markerEnd={exMToExMemActive ? "url(#m-arr-blue)" : inactiveMarker}
              />
              {/* 컨트롤 신호 전달선 2: WB ➔ WB (ID/EX WB셀 ➔ EX/MEM WB셀 수직 직하강) */}
              <line
                x1="847"
                y1="566"
                x2="847"
                y2="908"
                stroke={exWbToExMemActive ? "#8B5CF6" : inactiveStroke}
                strokeDasharray="6 3"
                className="wire-dashed-flowing"
                {...syncWireProps(exWbToExMemActive, exWbCtrlState, true)}
                markerEnd={exWbToExMemActive ? "url(#m-arr-purple)" : inactiveMarker}
              />

              {/* ============================================================ */}
              {/* [STAGE 3] EXECUTE / ALU (EX) : Y = 566 ~ 910                  */}
              {/* ============================================================ */}
              {/* 1) Read Data 1 (X = 225) ➔ ALU 좌측 입력 포트(X = 225, Y = 739)로 직하강 */}
              <line
                x1="225"
                y1="566"
                x2="225"
                y2="739"
                stroke={exRd1ToAluActive ? "#16A34A" : inactiveStroke}
                {...syncWireProps(exRd1ToAluActive, exRd1State)}
                markerEnd={exRd1ToAluActive ? "url(#m-arr-green)" : inactiveMarker}
              />

              {/* 2) Read Data 2 Trunk (X = 365, Y = 566 -> 595) */}
              <line
                x1="365"
                y1="566"
                x2="365"
                y2="595"
                stroke={exRd2TrunkActive ? "#16A34A" : inactiveStroke}
                {...syncWireProps(exRd2TrunkActive, exStep1State)}
              />
              {/* Read Data 2 ➔ ALUSrc MUX 좌측 입력(X = 365, Y = 595 -> 663) */}
              <line
                x1="365"
                y1="595"
                x2="365"
                y2="663"
                stroke={exRd2ToAluSrcActive ? "#16A34A" : inactiveStroke}
                {...syncWireProps(exRd2ToAluSrcActive, exStep1State)}
                markerEnd={exRd2ToAluSrcActive ? "url(#m-arr-green)" : inactiveMarker}
              />
              {/* Read Data 2 분기 ➔ EX/MEM 버퍼 (Data Memory Write Data용, x=480 직하강) */}
              <path
                d="M 365,595 L 480,595 L 480,908"
                fill="none"
                stroke={exRd2ToWriteDataActive ? "#16A34A" : inactiveStroke}
                {...syncWireProps(exRd2ToWriteDataActive, exRd2MemState)}
                markerEnd={exRd2ToWriteDataActive ? "url(#m-arr-green)" : inactiveMarker}
              />
              <circle
                cx="365"
                cy="595"
                r={exRd2ToWriteDataActive && exRd2MemState && exRd2MemState.progress < 1.0 ? 5.5 : 3.5}
                fill={exRd2ToWriteDataActive ? "#16A34A" : inactiveStroke}
                style={{
                  opacity: (isInitialEmpty || exRd2ToWriteDataActive) ? (exRd2ToWriteDataActive ? (exRd2MemState && exRd2MemState.progress < 1.0 ? 1.0 : 0.40) : 1) : 0,
                  transition: "r 0.15s ease-out, opacity 0.2s ease-out",
                }}
              />

              {/* 3) Imm Trunk (X = 578, Y = 566 -> 630) */}
              <line
                x1="578"
                y1="566"
                x2="578"
                y2="630"
                stroke={exImmTrunkActive ? "#16A34A" : inactiveStroke}
                {...syncWireProps(exImmTrunkActive, exStep1State)}
              />
              {/* Imm ➔ ALUSrc MUX 우측 입력(X = 425, Y = 663) 분기 */}
              <path
                d="M 578,630 L 425,630 L 425,663"
                fill="none"
                stroke={exImmToAluSrcActive ? "#16A34A" : inactiveStroke}
                {...syncWireProps(exImmToAluSrcActive, exStep1State)}
                markerEnd={exImmToAluSrcActive ? "url(#m-arr-green)" : inactiveMarker}
              />
              <circle
                cx="578"
                cy="630"
                r={exImmToAluSrcActive && exStep1State && exStep1State.progress < 1.0 ? 5.5 : 3.5}
                fill={exImmToAluSrcActive ? "#16A34A" : inactiveStroke}
                style={{
                  opacity: (isInitialEmpty || exImmToAluSrcActive) ? (exImmToAluSrcActive ? (exStep1State && exStep1State.progress < 1.0 ? 1.0 : 0.40) : 1) : 0,
                  transition: "r 0.15s ease-out, opacity 0.2s ease-out",
                }}
              />

              {/* ALUSrc MUX (알약형 / Stadium Capsule: x=345, y=665, w=100, h=38, rx=19, center 395) */}
              <rect
                x="345"
                y="665"
                width="100"
                height="38"
                rx="19"
                ry="19"
                className={boxStepClass(exAluSrcToAluActive, 1)}
                fill={exAluSrcToAluActive ? "#F0FDF4" : "#F8FAFC"}
                stroke={exAluSrcToAluActive ? "#16A34A" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="395"
                y="684"
                dominantBaseline="central"
                fill={exAluSrcToAluActive ? "#15803D" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                MUX
              </text>

              {/* ALUSrc MUX 출력 (X = 395, Y = 703) ➔ ALU 우측 입력 포트(X = 395, Y = 739) */}
              <line
                x1="395"
                y1="703"
                x2="395"
                y2="739"
                stroke={exAluSrcToAluActive ? "#16A34A" : inactiveStroke}
                {...syncWireProps(exAluSrcToAluActive, exStep2State)}
                markerEnd={exAluSrcToAluActive ? "url(#m-arr-green)" : inactiveMarker}
              />

              {/* 부품 6: ALU (center x=310, y=741..869, h=128) */}
              <g>
                <polygon
                  points="
                  180,741
                  270,741
                  310,783
                  350,741
                  440,741
                  405,869
                  215,869
                "
                  className={boxStepClass(exAluToExMemActive || (isExActive && isBranch(exOp)), 2)}
                  fill={exAluToExMemActive || (isExActive && isBranch(exOp)) ? "#F0FDF4" : "#F8FAFC"}
                  stroke={exAluToExMemActive || (isExActive && isBranch(exOp)) ? "#16A34A" : "#94A3B8"}
                  strokeWidth="2.8"
                  strokeLinejoin="round"
                />
                <text
                  x="310"
                  y="815"
                  dominantBaseline="central"
                  fill={exAluToExMemActive || (isExActive && isBranch(exOp)) ? "#15803D" : "#94A3B8"}
                  fontSize="17"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  ALU
                </text>
                {isExActive && exOp && getAluOpSymbol(exOp) && (
                  <text
                    x="310"
                    y="840"
                    dominantBaseline="central"
                    fill={exStep2State ? "#16A34A" : "#64748B"}
                    fontSize="13"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {getAluOpSymbol(exOp)}
                  </text>
                )}
              </g>

              {/* 우측 Branch Adder (center 615: 좌측 포트 x=578, 우측 포트 x=652 수직 직하강) */}
              {/* Branch Add 입력 1: Imm (좌측 포트 x=578, y=630 -> 743 수직 직하강) */}
              <line
                x1="578"
                y1="630"
                x2="578"
                y2="743"
                stroke={exImmToBranchAddActive ? "#16A34A" : inactiveStroke}
                {...syncWireProps(exImmToBranchAddActive, exStep1State)}
                markerEnd={exImmToBranchAddActive ? "url(#m-arr-green)" : inactiveMarker}
              />
              {/* Branch Add 입력 2: PC (우측 포트 x=701 수직 직하강 ➔ x=652 포트 인입) */}
              <path
                d="M 701,566 L 701,720 L 652,720 L 652,743"
                fill="none"
                stroke={exPcToBranchAddActive ? "#16A34A" : inactiveStroke}
                {...syncWireProps(exPcToBranchAddActive, exStep1State)}
                markerEnd={exPcToBranchAddActive ? "url(#m-arr-green)" : inactiveMarker}
              />
              <polygon
                points="550,745 680,745 650,808 580,808"
                className={boxStepClass(exBranchAddActive, 2)}
                fill={exBranchAddActive ? "#F0FDF4" : "#F8FAFC"}
                stroke={exBranchAddActive ? "#16A34A" : "#94A3B8"}
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              <text
                x="615"
                y="765"
                dominantBaseline="central"
                fill={exBranchAddActive ? "#15803D" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Branch
              </text>
              <text
                x="615"
                y="789"
                dominantBaseline="central"
                fill={exBranchAddActive ? "#15803D" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Add
              </text>

              {/* ALU 출력(X = 310, Y = 869) ➔ EX/MEM BUFFER (Y = 910) 직하강 */}
              <line
                x1="310"
                y1="869"
                x2="310"
                y2="908"
                stroke={exAluToExMemActive ? "#16A34A" : inactiveStroke}
                {...syncWireProps(exAluToExMemActive, exStep3State)}
                markerEnd={exAluToExMemActive ? "url(#m-arr-green)" : inactiveMarker}
              />

              {/* ============================================================ */}
              {/* 파이프라인 버퍼 3: EX / MEM BUFFER (데이터 660px + 시그널 92px) */}
              {/* ============================================================ */}
              {/* 데이터 버퍼 (X = 110 ~ 770) */}
              <rect
                x="110"
                y="910"
                width="660"
                height="26"
                rx="6"
                fill={isExMemLatched ? "#FEF9C3" : "#F1F5F9"}
                stroke={isExMemLatched ? "#EAB308" : "#94A3B8"}
                strokeWidth="2.8"
                style={{ transition: "fill 0.25s ease, stroke 0.25s ease" }}
              />
              <text
                x="440"
                y="923"
                dominantBaseline="central"
                fill={isExMemLatched ? "#A16207" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
                style={{ transition: "fill 0.25s ease" }}
              >
                EX / MEM BUFFER
              </text>

              {/* 시그널 버퍼 (X = 778 ~ 870) : [ M | WB ] */}
              <g>
                <rect
                  x="778"
                  y="910"
                  width="92"
                  height="26"
                  rx="6"
                  fill="#F1F5F9"
                  stroke={isSignal2Latched ? "#EAB308" : "#94A3B8"}
                  strokeWidth="2.8"
                  style={{ transition: "stroke 0.25s ease" }}
                />
                <line x1="824" y1="910" x2="824" y2="936" stroke="#94A3B8" strokeWidth="1" />

                {/* M 셀 (X = 778 ~ 824) */}
                <rect
                  x="779"
                  y="911"
                  width="44"
                  height="24"
                  rx="5"
                  fill={isSignal2Latched ? "#F0F9FF" : "transparent"}
                  style={{ transition: "fill 0.25s ease" }}
                />
                <text
                  x="801"
                  y="923"
                  dominantBaseline="central"
                  fill={isSignal2Latched ? "#0369A1" : "#94A3B8"}
                  fontSize="18"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  style={{ transition: "fill 0.25s ease" }}
                >
                  M
                </text>

                {/* WB 셀 (X = 824 ~ 870) */}
                <rect
                  x="825"
                  y="911"
                  width="44"
                  height="24"
                  rx="5"
                  fill={isSignal2Latched ? "#F5F3FF" : "transparent"}
                  style={{ transition: "fill 0.25s ease" }}
                />
                <text
                  x="847"
                  y="923"
                  dominantBaseline="central"
                  fill={isSignal2Latched ? "#6D28D9" : "#94A3B8"}
                  fontSize="18"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  style={{ transition: "fill 0.25s ease" }}
                >
                  WB
                </text>
              </g>

              {/* MEM 제어선: EX/MEM M셀 ➔ Data Memory 우측면 중간 인입 */}
              <path
                d="M 801,936 L 801,1051 L 550,1051"
                fill="none"
                stroke={memAluToDmemAddrActive ? "#0284C7" : inactiveStroke}
                strokeDasharray="6 3"
                className="wire-dashed-flowing"
                {...syncWireProps(memAluToDmemAddrActive, memStep1State, true)}
                markerEnd={memAluToDmemAddrActive ? "url(#m-arr-blue)" : inactiveMarker}
              />
              {/* 컨트롤 신호 전달선: WB ➔ WB (EX/MEM WB셀 ➔ MEM/WB WB셀 수직 직하강) */}
              <line
                x1="847"
                y1="936"
                x2="847"
                y2="1154"
                stroke={memWbToMemWbActive ? "#8B5CF6" : inactiveStroke}
                strokeDasharray="6 3"
                className="wire-dashed-flowing"
                {...syncWireProps(memWbToMemWbActive, memWbCtrlState, true)}
                markerEnd={memWbToMemWbActive ? "url(#m-arr-purple)" : inactiveMarker}
              />

              {/* ============================================================ */}
              {/* [STAGE 4] MEMORY ACCESS (MEM) : Y = 936 ~ 1156               */}
              {/* ============================================================ */}
              {/* ALU Result Trunk (X = 310, Y = 936 -> 965) */}
              <line
                x1="310"
                y1="936"
                x2="310"
                y2="965"
                stroke={memAluTrunkActive ? "#0284C7" : inactiveStroke}
                {...syncWireProps(memAluTrunkActive, memBypassState || memStep1State)}
              />
              {/* 1) ALU Result 분기 ➔ Data Memory Address 입력 (X = 310, Y = 965 -> 994) */}
              <line
                x1="310"
                y1="965"
                x2="310"
                y2="994"
                stroke={memAluToDmemAddrActive ? "#0284C7" : inactiveStroke}
                {...syncWireProps(memAluToDmemAddrActive, memStep1State)}
                markerEnd={memAluToDmemAddrActive ? "url(#m-arr-blue)" : inactiveMarker}
              />
              {/* 2) ALU Result Bypass (EX/MEM ➔ MEM/WB 버퍼 직행, X = 225) */}
              <path
                d="M 310,965 L 225,965 L 225,1154"
                fill="none"
                stroke={memAluBypassActive ? "#0284C7" : inactiveStroke}
                {...syncWireProps(memAluBypassActive, memBypassState)}
                markerEnd={memAluBypassActive ? "url(#m-arr-blue)" : inactiveMarker}
              />
              <circle
                cx="310"
                cy="965"
                r={((memAluBypassActive && memBypassState && memBypassState.progress < 1.0) || (memAluToDmemAddrActive && memStep1State && memStep1State.progress < 1.0)) ? 5.5 : 3.5}
                fill={memAluBypassActive || memAluToDmemAddrActive ? "#0284C7" : inactiveStroke}
                style={{
                  opacity: (isInitialEmpty || memAluBypassActive || memAluToDmemAddrActive)
                    ? ((memAluBypassActive || memAluToDmemAddrActive)
                      ? (((memAluBypassActive && memBypassState && memBypassState.progress < 1.0) || (memAluToDmemAddrActive && memStep1State && memStep1State.progress < 1.0)) ? 1.0 : 0.40)
                      : 1)
                    : 0,
                  transition: "r 0.15s ease-out, opacity 0.2s ease-out",
                }}
              />

              {/* 3) Write Data (sw 명령어용: EX/MEM 버퍼 ➔ Data Memory Write Data 포트, X = 480) */}
              <line
                x1="480"
                y1="936"
                x2="480"
                y2="994"
                stroke={memWriteDataActive ? "#0284C7" : inactiveStroke}
                {...syncWireProps(memWriteDataActive, memStep1State)}
                markerEnd={memWriteDataActive ? "url(#m-arr-blue)" : inactiveMarker}
              />

              {/* 부품 7: Data Memory (미니멀 라운드 박스, x=270, width=280, y=996..1106, center=410) */}
              <rect
                x="270"
                y="996"
                width="280"
                height="110"
                rx="8"
                className={boxStepClass(memAluToDmemAddrActive, 1)}
                fill={memAluToDmemAddrActive ? "#F0F9FF" : "#F8FAFC"}
                stroke={memAluToDmemAddrActive ? "#0284C7" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="410"
                y="1051"
                dominantBaseline="central"
                fill={memAluToDmemAddrActive ? "#0369A1" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Data Memory
              </text>

              {/* Data Memory 출력 ➔ MEM/WB BUFFER (X = 470) */}
              <line
                x1="470"
                y1="1106"
                x2="470"
                y2="1154"
                stroke={memDmemReadDataActive ? "#0284C7" : inactiveStroke}
                {...syncWireProps(memDmemReadDataActive, memStep2State)}
                markerEnd={memDmemReadDataActive ? "url(#m-arr-blue)" : inactiveMarker}
              />

              {/* ============================================================ */}
              {/* 파이프라인 버퍼 4: MEM / WB BUFFER (데이터 706px + 시그널 46px) */}
              {/* ============================================================ */}
              {/* 데이터 버퍼 (X = 110 ~ 816) */}
              <rect
                x="110"
                y="1156"
                width="706"
                height="26"
                rx="6"
                fill={isMemWbLatched ? "#FEF9C3" : "#F1F5F9"}
                stroke={isMemWbLatched ? "#EAB308" : "#94A3B8"}
                strokeWidth="2.8"
                style={{ transition: "fill 0.25s ease, stroke 0.25s ease" }}
              />
              <text
                x="463"
                y="1169"
                dominantBaseline="central"
                fill={isMemWbLatched ? "#A16207" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
                style={{ transition: "fill 0.25s ease" }}
              >
                MEM / WB BUFFER
              </text>

              {/* 시그널 버퍼 (X = 824 ~ 870) : [ WB ] */}
              <g>
                <rect
                  x="824"
                  y="1156"
                  width="46"
                  height="26"
                  rx="6"
                  fill={isSignal3Latched ? "#F5F3FF" : "#F1F5F9"}
                  stroke={isSignal3Latched ? "#8B5CF6" : "#94A3B8"}
                  strokeWidth="2.8"
                  style={{ transition: "fill 0.25s ease, stroke 0.25s ease" }}
                />
                <text
                  x="847"
                  y="1169"
                  dominantBaseline="central"
                  fill={isSignal3Latched ? "#6D28D9" : "#94A3B8"}
                  fontSize="18"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  style={{ transition: "fill 0.25s ease" }}
                >
                  WB
                </text>
              </g>

              {/* WB 제어선: MEM/WB WB셀 ➔ WB MUX 우측면 인입 */}
              <path
                d="M 847,1182 L 847,1277 L 490,1277"
                fill="none"
                stroke={wbAluBypassActive || wbDmemReadDataActive ? "#8B5CF6" : inactiveStroke}
                strokeDasharray="6 3"
                className="wire-dashed-flowing"
                {...syncWireProps(wbAluBypassActive || wbDmemReadDataActive, wbStep1State, true)}
                markerEnd={wbAluBypassActive || wbDmemReadDataActive ? "url(#m-arr-purple)" : inactiveMarker}
              />

              {/* ============================================================ */}
              {/* [STAGE 5] WRITE-BACK (WB) : Y = 1182 ~ 1350                  */}
              {/* ============================================================ */}
              {/* 1) ALU Result Bypass ➔ WB MUX 좌측 입력 (X = 225 -> 410) */}
              <path
                d="M 225,1182 L 225,1218 L 410,1218 L 410,1256"
                fill="none"
                stroke={wbAluBypassActive ? "#8B5CF6" : inactiveStroke}
                {...syncWireProps(wbAluBypassActive, wbStep1State)}
                markerEnd={wbAluBypassActive ? "url(#m-arr-purple)" : inactiveMarker}
              />

              {/* 2) Data Memory Read Data ➔ WB MUX 우측 입력 (X = 470 직선 직하강) */}
              <line
                x1="470"
                y1="1182"
                x2="470"
                y2="1256"
                stroke={wbDmemReadDataActive ? "#8B5CF6" : inactiveStroke}
                {...syncWireProps(wbDmemReadDataActive, wbStep1State)}
                markerEnd={wbDmemReadDataActive ? "url(#m-arr-purple)" : inactiveMarker}
              />

              {/* 부품 8: WB MUX (알약형 / Stadium Capsule: x=390, y=1258, w=100, h=38, rx=19, center 440) */}
              <rect
                x="390"
                y="1258"
                width="100"
                height="38"
                rx="19"
                ry="19"
                className={boxStepClass(wbAluBypassActive || wbDmemReadDataActive, 1)}
                fill={wbAluBypassActive || wbDmemReadDataActive ? "#F5F3FF" : "#F8FAFC"}
                stroke={wbAluBypassActive || wbDmemReadDataActive ? "#8B5CF6" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="440"
                y="1277"
                dominantBaseline="central"
                fill={wbAluBypassActive || wbDmemReadDataActive ? "#6D28D9" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                MUX
              </text>

              {/* ============================================================ */}
              {/* ★ 역방향 피드백 버스 (WB MUX ➔ ID RegFile Write Data In)     */}
              {/* ============================================================ */}
              <path
                d="M 440,1296 L 440,1315 L 85,1315 L 85,424 L 180,424"
                fill="none"
                stroke={wbReverseFeedbackActive ? "#8B5CF6" : inactiveStroke}
                {...syncWireProps(wbReverseFeedbackActive, wbStep2State)}
                markerEnd={wbReverseFeedbackActive ? "url(#m-arr-purple)" : inactiveMarker}
              />

              {/* ============================================================ */}
              {/* [최상단 오버레이 레이어] 실시간 이동 데이터/주소 토큰 (Floating Data Tokens & Chips) */}
              {/* 버퍼 및 기타 소자들보다 항상 위에 렌더링되어 가려지지 않습니다. */}
              {/* ============================================================ */}
              {/* ============================================================ */}
              {/* 1. IF STAGE CHIPS (빨간색 #EF4444) - 3단계                     */}
              {/* ============================================================ */}
              {/* Step 1: PC 주소 출력 */}
              {ifPcToImemActive && pcToImemPoint && pcToImemState && (
                <FloatingChip x={pcToImemPoint.x} y={pcToImemPoint.y} text={`PC: ${ifPcDec}`} stroke="#EF4444" title={`PC 주소 (10진수): ${ifPcDec}`} opacity={pcToImemState.opacity} />
              )}
              {ifPcToPlus4Active && pcToPlus4Point && pcToPlus4State && (
                <FloatingChip x={pcToPlus4Point.x} y={pcToPlus4Point.y} text={`PC: ${ifPcDec}`} stroke="#EF4444" title={`PC 주소 (10진수): ${ifPcDec}`} opacity={pcToPlus4State.opacity} />
              )}
              {ifPcToIfIdActive && pcToAddrPoint && pcToAddrState && (
                <FloatingChip x={pcToAddrPoint.x} y={pcToAddrPoint.y} text={`PC: ${ifPcDec}`} stroke="#EF4444" title={`보존되는 PC 주소 (10진수): ${ifPcDec}`} opacity={pcToAddrState.opacity} />
              )}

              {/* Step 2: IM 명령어 인출 & +4 루프백 */}
              {ifPlus4LoopbackActive && plus4LoopbackPoint && plus4LoopbackState && (
                <FloatingChip x={plus4LoopbackPoint.x} y={plus4LoopbackPoint.y} text={`+4: ${ifPcPlus4Dec}`} stroke="#EF4444" title={`PC + 4 (10진수): ${ifPcPlus4Dec}`} opacity={plus4LoopbackState.opacity} />
              )}
              {ifImemToIfIdActive && imemToIfIdPoint && imemToIfIdState && (
                <FloatingChip x={imemToIfIdPoint.x} y={imemToIfIdPoint.y} text={ifInst || '—'} stroke="#EF4444" title={`인출된 명령어: ${ifInst}`} opacity={imemToIfIdState.opacity} />
              )}

              {/* Step 3: PC MUX 결정 */}
              {ifPcMuxToPcActive && muxToPcPoint && muxToPcState && (
                <FloatingChip x={muxToPcPoint.x} y={muxToPcPoint.y} text={branchLoopbackActive ? `Target: ${exBranchTargetVal}` : `Next: ${ifPcPlus4Dec}`} stroke="#EF4444" title={`다음 PC 입력: ${branchLoopbackActive ? `Branch Target (${exBranchTargetVal})` : ifPcPlus4Dec}`} opacity={muxToPcState.opacity} />
              )}

              {/* ============================================================ */}
              {/* 2. ID STAGE CHIPS (오렌지색 #EA580C) - 2단계                   */}
              {/* ============================================================ */}
              {/* Step 1 (0.00 ~ 0.40): IF/ID -> Regs, Imm Gen, CU */}
              {idToRegsActive && idIfIdToRegsPoint && idStep1State && (
                <FloatingChip x={idIfIdToRegsPoint.x} y={idIfIdToRegsPoint.y} text={idRs1Name ? `${idRs1Name}, ${idRs2Name}` : 'regs'} stroke="#EA580C" title={`레지스터 주소 필드: ${idRs1Name}, ${idRs2Name}`} opacity={idStep1State.opacity} />
              )}
              {idToImmGenActive && idIfIdToImmPoint && idStep1State && (
                <FloatingChip x={idIfIdToImmPoint.x} y={idIfIdToImmPoint.y} text={`imm: ${idImmVal}`} stroke="#EA580C" title={`즉시값 인코딩 필드: ${idImmVal}`} opacity={idStep1State.opacity} />
              )}
              {idControlUnitActive && idIfIdToCuPoint && idStep1State && (
                <FloatingChip x={idIfIdToCuPoint.x} y={idIfIdToCuPoint.y} text="ctrl" stroke="#EA580C" title="제어 장치 디코딩 필드" opacity={idStep1State.opacity} />
              )}

              {/* Step 2 (0.40 ~ 1.00): Regs Rd1, Rd2, Imm, PC -> ID/EX 버퍼 전달 */}
              {idRd1ToIdExActive && idRd1Point && idStep2State && (
                <FloatingChip x={idRd1Point.x} y={idRd1Point.y} text={idRd1Val} stroke="#EA580C" title={`Read Data 1: ${idRd1Val}`} opacity={idStep2State.opacity} />
              )}
              {idRd2ToIdExActive && idRd2Point && idStep2State && (
                <FloatingChip x={idRd2Point.x} y={idRd2Point.y} text={idRd2Val} stroke="#EA580C" title={`Read Data 2: ${idRd2Val}`} opacity={idStep2State.opacity} />
              )}
              {idImmToIdExActive && idImmPoint && idStep2State && (
                <FloatingChip x={idImmPoint.x} y={idImmPoint.y} text={`imm: ${idImmVal}`} stroke="#EA580C" title={`생성된 32-bit 즉시값: ${idImmVal}`} opacity={idStep2State.opacity} />
              )}
              {idPcToIdExActive && idPcPoint && idStep2State && (
                <FloatingChip x={idPcPoint.x} y={idPcPoint.y} text={`PC: ${idPcDec}`} stroke="#EA580C" title={`파이프라인 전달 PC: ${idPcDec}`} opacity={idStep2State.opacity} />
              )}
              {/* 제어 신호 버스: Control Unit ➔ ID/EX 버퍼 (줄바꿈 신호 패킷) */}
              {idControlUnitActive && idCuToIdExPoint && idStep2State && (
                <FloatingChip
                  x={idCuToIdExPoint.x}
                  y={idCuToIdExPoint.y}
                  lines={getIdControlSignals(idOp)}
                  stroke="#EA580C"
                  title={`제어 신호 패킷: ${getIdControlSignals(idOp).join(', ')}`}
                  opacity={idStep2State.opacity}
                />
              )}

              {/* ============================================================ */}
              {/* 3. EX STAGE CHIPS (초록색 #16A34A) - 3단계                     */}
              {/* ============================================================ */}
              {/* Step 1 (0.00 ~ 0.38): 피연산자 진입 및 분기/쓰기 데이터 전파 */}
              {/* 피연산자 A: Step 1에서 하강 후, Step 2 동안 ALU 좌측 입력 포트에 체류 (동시 인입 보장) */}
              {exRd1ToAluActive && exRd1Point && exRd1State && (
                <FloatingChip x={exRd1Point.x} y={exRd1Point.y} text={`A: ${exRd1Val}`} stroke="#16A34A" title={`ALU 입력 A: ${exRd1Val}`} opacity={exRd1State.opacity} />
              )}
              {/* 피연산자 B (레지스터) ➔ ALUSrc MUX 입력 0 */}
              {exRd2ToAluSrcActive && exRd2MuxPoint && exStep1State && (
                <FloatingChip x={exRd2MuxPoint.x} y={exRd2MuxPoint.y} text={`B: ${exRs2Val}`} stroke="#16A34A" title={`MUX 레지스터 입력 (rs2): ${exRs2Name}`} opacity={exStep1State.opacity} />
              )}
              {/* 피연산자 즉시값 ➔ ALUSrc MUX 입력 1 */}
              {exImmToAluSrcActive && exImmMuxPoint && exStep1State && (
                <FloatingChip x={exImmMuxPoint.x} y={exImmMuxPoint.y} text={`imm: ${exImmVal}`} stroke="#16A34A" title={`MUX 즉시값 입력: ${exImmVal}`} opacity={exStep1State.opacity} />
              )}
              {/* 스토어 쓰기 데이터 ➔ EX/MEM 버퍼 (클록 종료 시까지 래치 유지) */}
              {exRd2ToWriteDataActive && exRd2MemPoint && exRd2MemState && (
                <FloatingChip x={exRd2MemPoint.x} y={exRd2MemPoint.y} text={`WData: ${exRs2Val}`} stroke="#16A34A" title={`메모리 저장용 쓰기 데이터 (${exRs2Name}): ${exRs2Val}`} opacity={exRd2MemState.opacity} />
              )}
              {/* Branch Adder 입력 1: Imm */}
              {exImmToBranchAddActive && exImmToBranchPoint && exStep1State && (
                <FloatingChip x={exImmToBranchPoint.x} y={exImmToBranchPoint.y} text={`imm: ${exImmVal}`} stroke="#16A34A" title={`분기 오프셋: ${exImmVal}`} opacity={exStep1State.opacity} />
              )}
              {/* Branch Adder 입력 2: PC */}
              {exPcToBranchAddActive && exPcToBranchPoint && exStep1State && (
                <FloatingChip x={exPcToBranchPoint.x} y={exPcToBranchPoint.y} text={`PC: ${exPcDec}`} stroke="#16A34A" title={`분기 기준 PC: ${exPcDec}`} opacity={exStep1State.opacity} />
              )}
              {/* 제어 신호: ID/EX EX셀 ➔ ALUSrc MUX */}
              {exAluSrcToAluActive && exCtrlToMuxPoint && exStep1State && (
                <FloatingChip
                  x={exCtrlToMuxPoint.x}
                  y={exCtrlToMuxPoint.y}
                  text={usesImm(exOp) ? "ALUSrc: 1" : "ALUSrc: 0"}
                  stroke="#16A34A"
                  title={`ALUSrc 제어 신호: ${usesImm(exOp) ? "1 (즉시값 선택)" : "0 (레지스터 선택)"}`}
                  opacity={exStep1State.opacity}
                />
              )}
              {/* 제어 신호: ID/EX M셀 ➔ EX/MEM M셀 (MemRead / MemWrite / Branch) */}
              {exMToExMemActive && exMCtrlPoint && exMCtrlState && (
                <FloatingChip
                  x={exMCtrlPoint.x}
                  y={exMCtrlPoint.y}
                  text={isLoad(exOp) ? "MemRead: 1" : isStore(exOp) ? "MemWrite: 1" : "Branch: 1"}
                  stroke="#0284C7"
                  fontSize={14}
                  title={`M 제어 신호 전달: ${isLoad(exOp) ? "MemRead: 1" : isStore(exOp) ? "MemWrite: 1" : "Branch: 1"}`}
                  opacity={exMCtrlState.opacity}
                />
              )}
              {/* 제어 신호: ID/EX WB셀 ➔ EX/MEM WB셀 (RegWrite) */}
              {exWbToExMemActive && exWbCtrlPoint && exWbCtrlState && (
                <FloatingChip
                  x={exWbCtrlPoint.x}
                  y={exWbCtrlPoint.y}
                  text="RegWrite: 1"
                  stroke="#8B5CF6"
                  fontSize={14}
                  title="WB 제어 신호 전달: RegWrite: 1"
                  opacity={exWbCtrlState.opacity}
                />
              )}

              {/* Step 2 (0.43 ~ 0.65): ALUSrc MUX 출력 -> ALU B (A와 B 동시 진입 상태에서 ALU 연산) */}
              {exAluSrcToAluActive && exMuxToAluPoint && exStep2State && (
                <FloatingChip x={exMuxToAluPoint.x} y={exMuxToAluPoint.y} text={`B: ${exAluSrcVal}`} stroke="#16A34A" title={`선택된 ALU 입력 B: ${exAluSrcVal}`} opacity={exStep2State.opacity} />
              )}

              {/* Step 3 (0.70 ~ 1.00): ALU 연산 결과 및 분기 성공 타겟 PC 전달 */}
              {(exAluToExMemActive || (isExActive && isBranch(exOp))) && exAluToExMemPoint && exStep3State && (
                <FloatingChip
                  x={exAluToExMemPoint.x}
                  y={exAluToExMemPoint.y}
                  text={isBranch(exOp) ? exAluResVal : `ALU: ${exAluResVal}`}
                  stroke="#16A34A"
                  title={`ALU 연산/판정 결과: ${exAluResVal}`}
                  opacity={exStep3State.opacity}
                />
              )}
              {/* Branch Add 출력 ➔ PC MUX 루프백 칩 (성립/미성립 모두 주행) */}
              {exBranchAddActive && exBranchLoopbackPoint && branchLoopbackState && (
                <FloatingChip
                  x={exBranchLoopbackPoint.x}
                  y={exBranchLoopbackPoint.y}
                  text={branchLoopbackActive ? `Target: ${exBranchTargetVal}` : `Target: ${exBranchTargetVal} (NT)`}
                  stroke="#16A34A"
                  fontSize={13.5}
                  title={
                    branchLoopbackActive
                      ? `분기/점프 성공 타겟 PC (${exBranchTargetVal}) ➔ PC MUX 루프백`
                      : `분기 계산 타겟 PC (${exBranchTargetVal}) - 미성립 (PC+4 채택)`
                  }
                  opacity={branchLoopbackState.opacity}
                />
              )}

              {/* ============================================================ */}
              {/* 4. MEM STAGE CHIPS (파란색 #0284C7) - 1~2단계 가변             */}
              {/* ============================================================ */}
              {/* 비-메모리 명령어: ALU Bypass 직행 (0.00 ~ 1.00 단일 스텝) */}
              {memAluBypassActive && memBypassPoint && memBypassState && (
                <FloatingChip x={memBypassPoint.x} y={memBypassPoint.y} text={`res: ${memVal}`} stroke="#0284C7" title={`ALU Bypass 결과: ${memVal}`} opacity={memBypassState.opacity} />
              )}

              {/* 메모리 명령어: Step 1 주소/쓰기데이터 진입, Step 2 메모리 읽기값 */}
              {isMemOp && memAluToDmemAddrActive && memAddrPoint && memStep1State && (
                <FloatingChip x={memAddrPoint.x} y={memAddrPoint.y} text={`Addr: ${memVal}`} stroke="#0284C7" title={`메모리 접근 주소: ${memVal}`} opacity={memStep1State.opacity} />
              )}
              {isMemOp && memWriteDataActive && memDataPoint && memStep1State && (
                <FloatingChip x={memDataPoint.x} y={memDataPoint.y} text={`WData: ${memVal}`} stroke="#0284C7" title={`메모리 쓰기 데이터: ${memVal}`} opacity={memStep1State.opacity} />
              )}
              {/* 제어 신호: EX/MEM M셀 ➔ Data Memory */}
              {isMemOp && memAluToDmemAddrActive && memCtrlToDmemPoint && memStep1State && (
                <FloatingChip
                  x={memCtrlToDmemPoint.x}
                  y={memCtrlToDmemPoint.y}
                  text={isLoad(memOp) ? "MemRead: 1" : "MemWrite: 1"}
                  stroke="#0284C7"
                  title={`메모리 제어 신호: ${isLoad(memOp) ? "MemRead: 1 (읽기 활성)" : "MemWrite: 1 (쓰기 활성)"}`}
                  opacity={memStep1State.opacity}
                />
              )}
              {/* 제어 신호: EX/MEM WB셀 ➔ MEM/WB WB셀 (RegWrite) */}
              {memWbToMemWbActive && memWbCtrlPoint && memWbCtrlState && (
                <FloatingChip
                  x={memWbCtrlPoint.x}
                  y={memWbCtrlPoint.y}
                  text="RegWrite: 1"
                  stroke="#8B5CF6"
                  fontSize={14}
                  title="WB 제어 신호 전달: RegWrite: 1"
                  opacity={memWbCtrlState.opacity}
                />
              )}
              {isMemOp && memDmemReadDataActive && memReadPoint && memStep2State && (
                <FloatingChip x={memReadPoint.x} y={memReadPoint.y} text={`RData: ${memVal}`} stroke="#0284C7" title={`메모리 읽기 데이터: ${memVal}`} opacity={memStep2State.opacity} />
              )}

              {/* ============================================================ */}
              {/* 5. WB STAGE CHIPS (보라색 #8B5CF6) - 2단계                     */}
              {/* ============================================================ */}
              {/* Step 1 (0.00 ~ 0.25): WB MUX 진입 */}
              {wbAluBypassActive && wbAluToMuxPoint && wbStep1State && (
                <FloatingChip x={wbAluToMuxPoint.x} y={wbAluToMuxPoint.y} text={wbVal} stroke="#8B5CF6" title={`WB 선택값 (ALU): ${wbVal}`} opacity={wbStep1State.opacity} />
              )}
              {wbDmemReadDataActive && wbDmemToMuxPoint && wbStep1State && (
                <FloatingChip x={wbDmemToMuxPoint.x} y={wbDmemToMuxPoint.y} text={wbVal} stroke="#8B5CF6" title={`WB 선택값 (Memory): ${wbVal}`} opacity={wbStep1State.opacity} />
              )}
              {/* 제어 신호: MEM/WB WB셀 ➔ WB MUX */}
              {(wbAluBypassActive || wbDmemReadDataActive) && wbCtrlToMuxPoint && wbStep1State && (
                <FloatingChip
                  x={wbCtrlToMuxPoint.x}
                  y={wbCtrlToMuxPoint.y}
                  text={isLoad(wbOp) ? "MemtoReg: 1" : "MemtoReg: 0"}
                  stroke="#8B5CF6"
                  title={`MemtoReg 제어 신호: ${isLoad(wbOp) ? "1 (메모리 데이터 선택)" : "0 (ALU 연산값 선택)"}`}
                  opacity={wbStep1State.opacity}
                />
              )}

              {/* Step 2 (0.25 ~ 1.00): 거대한 역방향 피드백 와이어 주행 (x=85) */}
              {wbReverseFeedbackActive && wbFeedbackPoint && wbStep2State && (
                <FloatingChip x={wbFeedbackPoint.x} y={wbFeedbackPoint.y} text={wbVal} stroke="#8B5CF6" title={`레지스터 파일 쓰기 피드백: ${wbVal}`} opacity={wbStep2State.opacity} />
              )}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PipelineVisualizer);
