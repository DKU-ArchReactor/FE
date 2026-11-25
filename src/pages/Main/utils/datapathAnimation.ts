import {
  isAuipc,
  isBranch,
  isBubbleOrNop,
  isITypeAlu,
  isLoad,
  isLui,
  isRType,
  isStore,
  usesImm,
  writesReg,
} from "./pipelineWireState";

export interface SvgPoint {
  x: number;
  y: number;
}

export interface SubstepAnimState {
  progress: number;
  opacity: number;
}

/**
 * SVG 경로(M, L, H, V) 문자열을 좌표 배열로 파싱한다.
 */
export function parseSvgPathPoints(pathStr: string): SvgPoint[] {
  const points: SvgPoint[] = [];
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
      nums.forEach((x) => {
        if (!isNaN(x)) points.push({ x, y: prev.y });
      });
    } else if (cmd === "V") {
      nums.forEach((y) => {
        if (!isNaN(y)) points.push({ x: prev.x, y });
      });
    }
  }
  return points;
}

/**
 * 직교/다각형 SVG 경로의 전체 픽셀 길이를 계산한다.
 */
export function getPathTotalLength(points: SvgPoint[]): number {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

/**
 * 진행률(0~1)에 해당하는 SVG 경로 상의 (x, y) 좌표를 보간한다.
 */
export function interpolatePathPoints(
  points: SvgPoint[],
  progress: number,
): SvgPoint | null {
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

/**
 * 1사이클 진행률(0~1) 내에서 스텝 구간([start, end]) 동안 주행하고,
 * 도착 후 소자 안착 여유 시간(holdDuration) 동안 머무른 뒤 다음 스텝으로 전달한다.
 */
export function getSynchronizedSubstepProgress(
  globalProgress: number,
  start: number,
  end: number,
  persistAfterArrival = false,
  holdDuration = 0,
): SubstepAnimState | null {
  if (globalProgress < start) {
    return null;
  }

  const stepDuration = end - start;
  if (stepDuration <= 0) return null;

  if (globalProgress <= end) {
    const ratio = Math.max(0, Math.min(1, (globalProgress - start) / stepDuration));
    const fadeInWindow = 0.05;
    const opacity = ratio < fadeInWindow ? ratio / fadeInWindow : 1.0;
    return { progress: ratio, opacity };
  }

  if (persistAfterArrival) {
    return { progress: 1.0, opacity: 1.0 };
  }

  if (globalProgress <= end + holdDuration) {
    return { progress: 1.0, opacity: 1.0 };
  }

  const fadeDuration = 0.03;
  const fadeEnd = end + holdDuration + fadeDuration;
  if (globalProgress <= fadeEnd) {
    const fadeRatio = (globalProgress - (end + holdDuration)) / fadeDuration;
    return { progress: 1.0, opacity: Math.max(0, 1 - fadeRatio) };
  }
  return null;
}

export interface ParsedInstruction {
  op: string;
  rd: string | null;
  rs1: string | null;
  rs2: string | null;
  imm: string | null;
}

/**
 * 어셈블리 명령어 문자열에서 연산자(op) 및 피연산자 레지스터·즉치수를 추출한다.
 */
export function parseInstructionDetails(
  assembly: string | null | undefined,
): ParsedInstruction {
  if (!assembly || isBubbleOrNop(assembly)) {
    return { op: "", rd: null, rs1: null, rs2: null, imm: null };
  }
  const trimmed = assembly.trim();
  const spaceIdx = trimmed.search(/\s/);
  if (spaceIdx === -1) {
    return { op: trimmed.toLowerCase(), rd: null, rs1: null, rs2: null, imm: null };
  }
  const op = trimmed.slice(0, spaceIdx).toLowerCase();
  const args = trimmed
    .slice(spaceIdx)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const parseOffsetBase = (str: string) => {
    const match = str.match(/^([+-]?\w+)?\s*\(\s*(\w+)\s*\)$/);
    if (match) {
      return { offset: match[1] || "0", base: match[2] };
    }
    return { offset: null, base: str };
  };

  if (isStore(op)) {
    const rs2 = args[0] || null;
    const { offset, base } = args[1]
      ? parseOffsetBase(args[1])
      : { offset: null, base: null };
    return { op, rd: null, rs1: base, rs2, imm: offset };
  }

  if (isLoad(op)) {
    const rd = args[0] || null;
    const { offset, base } = args[1]
      ? parseOffsetBase(args[1])
      : { offset: null, base: null };
    return { op, rd, rs1: base, rs2: null, imm: offset };
  }

  if (isBranch(op)) {
    return {
      op,
      rd: null,
      rs1: args[0] || null,
      rs2: args[1] || null,
      imm: args[2] || null,
    };
  }

  if (isLui(op) || isAuipc(op)) {
    return { op, rd: args[0] || null, rs1: null, rs2: null, imm: args[1] || null };
  }

  if (op === "jal") {
    if (args.length === 1) {
      return { op, rd: "ra", rs1: null, rs2: null, imm: args[0] };
    }
    return { op, rd: args[0] || "ra", rs1: null, rs2: null, imm: args[1] || null };
  }

  if (op === "jalr") {
    if (args.length === 1) {
      const { base } = parseOffsetBase(args[0]);
      return { op, rd: "ra", rs1: base, rs2: null, imm: "0" };
    }
    const rd = args[0] || "ra";
    const { offset, base } = parseOffsetBase(args[1] || "");
    return { op, rd, rs1: base, rs2: null, imm: offset || "0" };
  }

  if (isITypeAlu(op)) {
    return {
      op,
      rd: args[0] || null,
      rs1: args[1] || null,
      rs2: null,
      imm: args[2] || null,
    };
  }

  return {
    op,
    rd: args[0] || null,
    rs1: args[1] || null,
    rs2: args[2] || null,
    imm: null,
  };
}

const ABI_MAP: Record<string, string> = {
  zero: "x0", ra: "x1", sp: "x2", gp: "x3", tp: "x4",
  t0: "x5", t1: "x6", t2: "x7", s0: "x8", fp: "x8", s1: "x9",
  a0: "x10", a1: "x11", a2: "x12", a3: "x13", a4: "x14", a5: "x15", a6: "x16", a7: "x17",
  s2: "x18", s3: "x19", s4: "x20", s5: "x21", s6: "x22", s7: "x23", s8: "x24", s9: "x25",
  s10: "x26", s11: "x27", t3: "x28", t4: "x29", t5: "x30", t6: "x31",
};

/** ABI 별칭을 x0~x31 키로 정규화한다. */
export function resolveRegKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const clean = name.replace(/[^\w]/g, "").toLowerCase();
  if (/^x\d+$/.test(clean)) return clean;
  return ABI_MAP[clean] || null;
}

/** 16진수 레지스터 값을 부호 있는 10진수로 변환한다. */
export function formatRegVal(valHex: string | undefined): string {
  if (!valHex) return "0";
  const num = Number.parseInt(valHex, 16);
  if (Number.isFinite(num)) {
    return String(num << 0);
  }
  return valHex;
}

/** ALU 연산 기호 문자열을 반환한다. */
export function getAluOpSymbol(op: string): string {
  if (op === "add" || op === "addi") return "+";
  if (op === "sub") return "−";
  if (op === "and" || op === "andi") return "&";
  if (op === "or" || op === "ori") return "|";
  if (op === "xor" || op === "xori") return "^";
  if (op === "sll" || op === "slli") return "<<";
  if (op === "srl" || op === "srli") return ">>>";
  if (op === "sra" || op === "srai") return ">>";
  if (op === "slt" || op === "slti" || op === "sltu" || op === "sltiu") return "<";
  if (isLoad(op) || isStore(op)) return "+ (Addr)";
  if (isBranch(op)) return "== (Cmp)";
  if (op === "lui" || op === "auipc") return "imm";
  return "";
}

/** EX 단계 ALU 결과 칩 표시 문자열을 계산한다. */
export function computeAluDisplayVal(
  parsed: ParsedInstruction,
  regMap: Record<string, string>,
  pc = 0,
): string {
  const { op, rd, rs1, rs2, imm } = parsed;
  const rs1Key = rs1 ? resolveRegKey(rs1) : null;
  const rs2Key = rs2 ? resolveRegKey(rs2) : null;

  const v1 =
    rs1Key && regMap[rs1Key] ? Number.parseInt(regMap[rs1Key], 16) || 0 : 0;
  const v2 =
    rs2Key && regMap[rs2Key] ? Number.parseInt(regMap[rs2Key], 16) || 0 : 0;

  let immNum = 0;
  if (imm) {
    immNum =
      imm.startsWith("0x") || imm.startsWith("0X")
        ? Number.parseInt(imm, 16) || 0
        : Number.parseInt(imm, 10) || 0;
  }

  if (isLoad(op) || isStore(op)) {
    const addr = (v1 + immNum) | 0;
    return `0x${(addr >>> 0).toString(16)}`;
  }

  if (isBranch(op)) {
    let conditionMet = false;
    if (op === "beq") conditionMet = v1 === v2;
    else if (op === "bne") conditionMet = v1 !== v2;
    else if (op === "blt") conditionMet = v1 < v2;
    else if (op === "bge") conditionMet = v1 >= v2;
    else if (op === "bltu") conditionMet = v1 >>> 0 < v2 >>> 0;
    else if (op === "bgeu") conditionMet = v1 >>> 0 >= v2 >>> 0;
    return conditionMet ? "Zero: 1 (T)" : "Zero: 0 (NT)";
  }

  const b = usesImm(op) ? immNum : v2;
  if (op === "add" || op === "addi") return String((v1 + b) | 0);
  if (op === "sub") return String((v1 - b) | 0);
  if (op === "and" || op === "andi") return String(v1 & b);
  if (op === "or" || op === "ori") return String(v1 | b);
  if (op === "xor" || op === "xori") return String(v1 ^ b);
  if (op === "sll" || op === "slli") return String((v1 << (b & 0x1f)) | 0);
  if (op === "srl" || op === "srli") return String(v1 >>> (b & 0x1f));
  if (op === "sra" || op === "srai") return String(v1 >> (b & 0x1f));
  if (op === "slt" || op === "slti") return String(v1 < b ? 1 : 0);
  if (op === "sltu" || op === "sltiu") return String(v1 >>> 0 < b >>> 0 ? 1 : 0);
  if (op === "lui") return `0x${((immNum << 12) >>> 0).toString(16)}`;
  if (op === "auipc") return `0x${((pc + (immNum << 12)) >>> 0).toString(16)}`;
  if (op === "jal" || op === "jalr") return String((pc + 4) | 0);

  if (rd) return `${rd}`;
  return "res";
}

/** Control Unit에서 출력되는 명령어별 제어 시그널 목록을 반환한다. */
export function getIdControlSignals(op: string): string[] {
  if (!op || isBubbleOrNop(op)) return [];

  if (isLoad(op)) {
    return ["ALUSrc: 1", "MemRead: 1", "RegWrite: 1"];
  }
  if (isStore(op)) {
    return ["ALUSrc: 1", "MemWrite: 1"];
  }
  if (isBranch(op)) {
    return ["ALUSrc: 0", "Branch: 1"];
  }
  if (isITypeAlu(op)) {
    return ["ALUSrc: 1", "RegWrite: 1"];
  }
  if (isRType(op)) {
    return ["ALUSrc: 0", "RegWrite: 1"];
  }
  if (isLui(op) || isAuipc(op)) {
    return ["ALUSrc: 1", "RegWrite: 1"];
  }
  if (op === "jal" || op === "jalr") {
    return ["Branch: 1", "RegWrite: 1"];
  }
  if (writesReg(op)) {
    return [usesImm(op) ? "ALUSrc: 1" : "ALUSrc: 0", "RegWrite: 1"];
  }

  return ["Ctrl: Active"];
}
