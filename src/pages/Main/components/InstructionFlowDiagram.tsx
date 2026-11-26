import { useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  numericPc,
  type TransferUnit,
  type buildInstructionFlow,
} from "../utils/instructionFlow";
import { BOXES, ROLES, TITLES } from "../utils/instructionFlowLayout";
import {
  computeAluDisplayVal,
  formatRegVal,
  getPathTotalLength,
  getSynchronizedSubstepProgress,
  interpolatePathPoints,
  parseInstructionDetails,
  parseSvgPathPoints,
  resolveRegKey,
  type SubstepAnimState,
} from "../utils/datapathAnimation";
import {
  isAuipc,
  isBranch,
  isBubbleOrNop,
  isLoad,
  isLui,
  isStore,
  usesImm,
  usesRs1,
  usesRs2,
  writesReg,
} from "../utils/pipelineWireState";
import { FloatingChip } from "./FloatingChip";
import type { SimulationResult } from "@/type/simulation";

type Flow = ReturnType<typeof buildInstructionFlow>;

// ============================================================================
// 싱글 사이클 데이터패스 배선 경로 (SVG 좌표계와 1:1 일치, 모듈 레벨 사전 파싱)
// ============================================================================
const SC_PC_TO_IMEM_D = "M 183 565 H 100 V 1256 H 150";
const SC_PC_TO_PLUS4_D = "M 183 565 H 100 V 920 H 238 V 780";
const SC_PLUS4_TO_PC_D = "M 238 740 V 620";

const SC_IMEM_TO_CU_D = "M 345 1188 V 255 H 397";
const SC_IMEM_TO_REGS_D = "M 345 1188 V 645 H 397";
const SC_IMEM_TO_IMM_D = "M 345 1188 V 920 H 397";

const SC_REGS_TO_ALU_D = "M 507 564 H 767";
const SC_REGS_TO_OP_MUX_D = "M 507 726 H 611";
const SC_IMM_TO_OP_MUX_D = "M 507 920 H 559 V 770 H 611";
const SC_OP_MUX_TO_ALU_D = "M 665 745 H 767";

const SC_ALU_TO_DMEM_D = "M 929 645 H 977 V 1188";
const SC_ALU_TO_WB_MUX_D = "M 929 645 H 977 V 410 H 665";
const SC_DMEM_TO_WB_MUX_D = "M 1010 1256 H 1055 V 350 H 665";
const SC_WB_MUX_TO_REGS_D = "M 611 380 H 480 V 510";

const SC_CU_TO_REGS_D = "M 452 310 V 350 H 425 V 510";
const SC_CU_TO_WB_MUX_D = "M 507 255 H 638 V 320";
const SC_CU_TO_OP_MUX_D = "M 507 255 H 700 V 490 H 638 V 680";
const SC_CU_TO_DMEM_D = "M 507 255 H 734 V 1188";
const SC_CU_TO_ALU_D = "M 507 255 H 849 V 526";

const SC_PC_TO_IMEM_PTS = parseSvgPathPoints(SC_PC_TO_IMEM_D);
const SC_PC_TO_PLUS4_PTS = parseSvgPathPoints(SC_PC_TO_PLUS4_D);
const SC_PLUS4_TO_PC_PTS = parseSvgPathPoints(SC_PLUS4_TO_PC_D);
const SC_IMEM_TO_CU_PTS = parseSvgPathPoints(SC_IMEM_TO_CU_D);
const SC_IMEM_TO_REGS_PTS = parseSvgPathPoints(SC_IMEM_TO_REGS_D);
const SC_IMEM_TO_IMM_PTS = parseSvgPathPoints(SC_IMEM_TO_IMM_D);
const SC_REGS_TO_ALU_PTS = parseSvgPathPoints(SC_REGS_TO_ALU_D);
const SC_REGS_TO_OP_MUX_PTS = parseSvgPathPoints(SC_REGS_TO_OP_MUX_D);
const SC_IMM_TO_OP_MUX_PTS = parseSvgPathPoints(SC_IMM_TO_OP_MUX_D);
const SC_OP_MUX_TO_ALU_PTS = parseSvgPathPoints(SC_OP_MUX_TO_ALU_D);
const SC_ALU_TO_DMEM_PTS = parseSvgPathPoints(SC_ALU_TO_DMEM_D);
const SC_ALU_TO_WB_MUX_PTS = parseSvgPathPoints(SC_ALU_TO_WB_MUX_D);
const SC_DMEM_TO_WB_MUX_PTS = parseSvgPathPoints(SC_DMEM_TO_WB_MUX_D);
const SC_WB_MUX_TO_REGS_PTS = parseSvgPathPoints(SC_WB_MUX_TO_REGS_D);

const SC_CU_TO_REGS_PTS = parseSvgPathPoints(SC_CU_TO_REGS_D);
const SC_CU_TO_WB_MUX_PTS = parseSvgPathPoints(SC_CU_TO_WB_MUX_D);
const SC_CU_TO_OP_MUX_PTS = parseSvgPathPoints(SC_CU_TO_OP_MUX_D);
const SC_CU_TO_DMEM_PTS = parseSvgPathPoints(SC_CU_TO_DMEM_D);
const SC_CU_TO_ALU_PTS = parseSvgPathPoints(SC_CU_TO_ALU_D);

const SC_PC_TO_IMEM_LEN = getPathTotalLength(SC_PC_TO_IMEM_PTS);
const SC_PC_TO_PLUS4_LEN = getPathTotalLength(SC_PC_TO_PLUS4_PTS);
const SC_PLUS4_TO_PC_LEN = getPathTotalLength(SC_PLUS4_TO_PC_PTS);
const SC_IMEM_TO_CU_LEN = getPathTotalLength(SC_IMEM_TO_CU_PTS);
const SC_IMEM_TO_REGS_LEN = getPathTotalLength(SC_IMEM_TO_REGS_PTS);
const SC_IMEM_TO_IMM_LEN = getPathTotalLength(SC_IMEM_TO_IMM_PTS);
const SC_REGS_TO_ALU_LEN = getPathTotalLength(SC_REGS_TO_ALU_PTS);
const SC_REGS_TO_OP_MUX_LEN = getPathTotalLength(SC_REGS_TO_OP_MUX_PTS);
const SC_IMM_TO_OP_MUX_LEN = getPathTotalLength(SC_IMM_TO_OP_MUX_PTS);
const SC_OP_MUX_TO_ALU_LEN = getPathTotalLength(SC_OP_MUX_TO_ALU_PTS);
const SC_ALU_TO_DMEM_LEN = getPathTotalLength(SC_ALU_TO_DMEM_PTS);
const SC_ALU_TO_WB_MUX_LEN = getPathTotalLength(SC_ALU_TO_WB_MUX_PTS);
const SC_DMEM_TO_WB_MUX_LEN = getPathTotalLength(SC_DMEM_TO_WB_MUX_PTS);
const SC_WB_MUX_TO_REGS_LEN = getPathTotalLength(SC_WB_MUX_TO_REGS_PTS);

const SC_CU_TO_REGS_LEN = getPathTotalLength(SC_CU_TO_REGS_PTS);
const SC_CU_TO_WB_MUX_LEN = getPathTotalLength(SC_CU_TO_WB_MUX_PTS);
const SC_CU_TO_OP_MUX_LEN = getPathTotalLength(SC_CU_TO_OP_MUX_PTS);
const SC_CU_TO_ALU_LEN = getPathTotalLength(SC_CU_TO_ALU_PTS);

interface StepSlotSpec {
  id: "if1" | "id1" | "ex1" | "ex2" | "mem" | "wbLoad" | "wbReg";
  len: number;
  pauseAfter: number;
}

interface ScheduledStepWindow {
  start: number;
  end: number;
  pauseAfter: number;
  persist: boolean;
}

/**
 * 활성 스텝들의 최장 선분 길이에 비례하여 1사이클 [0, 1] 내 주행 구간과 휴지 시간을 배분한다.
 */
function buildSingleCycleSchedule(
  steps: StepSlotSpec[],
  endHold = 0.06,
): Record<string, ScheduledStepWindow> {
  const active = steps.filter((s) => s.len > 0);
  if (active.length === 0) return {};

  const totalPause =
    active.slice(0, -1).reduce((sum, s) => sum + s.pauseAfter, 0) + endHold;
  const driveBudget = Math.max(0.2, 1.0 - totalPause);
  const minFloor = Math.min(0.08, driveBudget / active.length);
  const remBudget = Math.max(0, driveBudget - minFloor * active.length);
  const lenSum = active.reduce((sum, s) => sum + s.len, 0);

  const result: Record<string, ScheduledStepWindow> = {};
  let cursor = 0;
  active.forEach((step, idx) => {
    const isLast = idx === active.length - 1;
    const drive = minFloor + (lenSum > 0 ? remBudget * (step.len / lenSum) : 0);
    const pause = isLast ? 0 : step.pauseAfter;
    result[step.id] = {
      start: cursor,
      end: cursor + drive,
      pauseAfter: pause,
      persist: isLast,
    };
    cursor += drive + pause;
  });
  return result;
}

function formatScalarValue(raw: string | null | undefined, fallback = "0"): string {
  if (!raw) return fallback;
  if (/^-?0x[\da-f]+$/i.test(raw.trim())) {
    return formatRegVal(raw.trim());
  }
  return raw;
}

function formatHexAddr(raw: string | null | undefined, fallback = "0x0"): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (/^0x[\da-f]+$/i.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 16);
    return Number.isFinite(parsed) ? `0x${(parsed >>> 0).toString(16)}` : trimmed;
  }
  const num = Number.parseInt(trimmed, 10);
  return Number.isFinite(num) ? `0x${(num >>> 0).toString(16)}` : trimmed;
}

export default function InstructionFlowDiagram({
  flow,
  instructionText,
  animProgress = 0,
  isActiveCycle = false,
  isCompiled = false,
}: {
  flow: Flow;
  instructionText?: string;
  animProgress?: number;
  isActiveCycle?: boolean;
  isCompiled?: boolean;
  executionStatus?: SimulationResult["execution_status"];
}) {
  const id = useId().replace(/:/g, "");
  const area = useRef<HTMLDivElement>(null);
  const [{ compact }, setCanvas] = useState({
    compact: false,
    verticalScale: 1,
  });
  const sy = (value: number) => value;

  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    const measure = (width: number, height: number) => {
      if (!width || !height) return;
      const compact = width / height < 1.25;
      const verticalScale = Math.min(
        1.35,
        Math.max(
          1,
          (height * (compact ? 1470 : 1830)) / (width * (compact ? 1368 : 1040)),
        ),
      );
      setCanvas((previous) =>
        previous.compact === compact &&
          Math.abs(previous.verticalScale - verticalScale) < 0.001
          ? previous
          : { compact, verticalScale },
      );
    };
    const bounds = element.getBoundingClientRect();
    measure(bounds.width, bounds.height);
    const observer = new ResizeObserver(([entry]) =>
      measure(entry.contentRect.width, entry.contentRect.height),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // ============================================================================
  // 1. 명령어 해석 및 단계별 와이어 활성 판정
  // ============================================================================
  const parsed = parseInstructionDetails(instructionText);
  const op = (parsed.op || flow.op || "").toLowerCase();
  const hasRealInst = Boolean(
    isActiveCycle && flow.actual && op && !isBubbleOrNop(instructionText),
  );

  const isLoadOp = hasRealInst && (flow.load || isLoad(op));
  const isStoreOp = hasRealInst && (flow.store || isStore(op));
  const isMemOp = isLoadOp || isStoreOp;
  const isBranchOp = hasRealInst && (flow.branch || isBranch(op));
  const isJumpOp = hasRealInst && (flow.jump || op === "jal" || op === "jalr");
  const isSysOp = hasRealInst && (flow.system || op === "ecall");
  const hasImmOp = hasRealInst && (flow.usesImmediate || usesImm(op));
  const readsRs1Op = hasRealInst && usesRs1(op);
  const readsRs2Op = hasRealInst && usesRs2(op);
  const writesRegOp = hasRealInst && (flow.writes.length > 0 || writesReg(op));
  const usesAluOp = hasRealInst && !isSysOp && !isLui(op) && op !== "jal";
  const usesPcAluBypassOp = hasRealInst && (isLui(op) || op === "jal");

  const readsRegsInId =
    hasRealInst && (readsRs1Op || readsRs2Op || writesRegOp);
  const needsEx1Step =
    hasRealInst &&
    (usesAluOp || usesPcAluBypassOp || isMemOp || writesRegOp);
  const needsEx2Step = usesAluOp;
  const needsMemStep =
    isMemOp || writesRegOp || isBranchOp;
  const needsWbLoadStep = isLoadOp;
  const needsWbRegStep = writesRegOp;

  // ============================================================================
  // 2. 최장 길이 비례 + 휴지 시간 포함 동적 타임라인 산출 (5초 1사이클 내 완료)
  // ============================================================================
  const schedule = buildSingleCycleSchedule([
    {
      id: "if1",
      len: Math.max(SC_PC_TO_IMEM_LEN, SC_PC_TO_PLUS4_LEN),
      pauseAfter: 0.04,
    },
    {
      id: "id1",
      len: Math.max(
        SC_PLUS4_TO_PC_LEN,
        SC_IMEM_TO_CU_LEN,
        readsRegsInId ? SC_IMEM_TO_REGS_LEN : 0,
        hasImmOp ? SC_IMEM_TO_IMM_LEN : 0,
      ),
      pauseAfter: 0.05,
    },
    {
      id: "ex1",
      len: needsEx1Step
        ? Math.max(
            usesAluOp ? SC_CU_TO_OP_MUX_LEN : 0,
            usesAluOp ? SC_CU_TO_ALU_LEN : 0,
            writesRegOp ? SC_CU_TO_REGS_LEN : 0,
            writesRegOp ? SC_CU_TO_WB_MUX_LEN : 0,
            readsRs2Op ? SC_REGS_TO_OP_MUX_LEN : 0,
            hasImmOp && usesAluOp ? SC_IMM_TO_OP_MUX_LEN : 0,
            readsRs1Op && usesAluOp ? SC_REGS_TO_ALU_LEN : 0,
            220,
          )
        : 0,
      pauseAfter: needsEx2Step ? 0.04 : 0.04,
    },
    {
      id: "ex2",
      len: needsEx2Step ? Math.max(SC_OP_MUX_TO_ALU_LEN + 110, 220) : 0,
      pauseAfter: 0.05,
    },
    {
      id: "mem",
      len: needsMemStep
        ? isMemOp
          ? SC_ALU_TO_DMEM_LEN
          : writesRegOp
            ? SC_ALU_TO_WB_MUX_LEN
            : 200
        : 0,
      pauseAfter: isLoadOp ? 0.06 : writesRegOp ? 0.04 : 0,
    },
    {
      id: "wbLoad",
      len: needsWbLoadStep ? SC_DMEM_TO_WB_MUX_LEN : 0,
      pauseAfter: 0.04,
    },
    {
      id: "wbReg",
      len: needsWbRegStep ? SC_WB_MUX_TO_REGS_LEN : 0,
      pauseAfter: 0,
    },
  ]);

  const stepState = (key: StepSlotSpec["id"]): SubstepAnimState | null => {
    if (!hasRealInst) return null;
    const w = schedule[key];
    if (!w) return null;
    return getSynchronizedSubstepProgress(
      animProgress,
      w.start,
      w.end,
      w.persist,
      w.pauseAfter,
    );
  };

  const if1State = stepState("if1");
  const id1State = stepState("id1");
  const ex1State = stepState("ex1");
  const ex2State = stepState("ex2");
  const memState = stepState("mem");
  const wbLoadState = stepState("wbLoad");
  const wbRegState = stepState("wbReg");

  // ALU 입력 A(rs1): ex1 시작과 동시에 출발해 ex2(Operand MUX -> ALU) 종료 시점에 동시 도착
  const exAluAState =
    hasRealInst && readsRs1Op && usesAluOp && schedule.ex1 && schedule.ex2
      ? getSynchronizedSubstepProgress(
          animProgress,
          schedule.ex1.start,
          schedule.ex2.end,
          schedule.ex2.persist,
          schedule.ex2.pauseAfter,
        )
      : null;

  // DMEM 제어 신호(MemRead/MemWrite): ex1 시작 -> ex2 종료 시점까지 하강 후 DMEM 도착 유지
  const ctrlDmemState =
    hasRealInst && isMemOp && schedule.ex1 && (schedule.ex2 || schedule.ex1)
      ? getSynchronizedSubstepProgress(
          animProgress,
          schedule.ex1.start,
          (schedule.ex2 ?? schedule.ex1).end,
          false,
          (schedule.mem?.end ?? 1) - (schedule.ex2 ?? schedule.ex1).end,
        )
      : null;

  // ============================================================================
  // 3. 파이프라인 동일 실시간 데이터·제어 값 매핑
  // ============================================================================
  const pcNum = numericPc(flow.pc);
  const pcDec = Number.isFinite(pcNum) ? String(pcNum) : (flow.pc || "0");
  const pcPlus4Dec = Number.isFinite(pcNum) ? String(pcNum + 4) : "4";
  const nextPcNum = numericPc(flow.nextPc);
  const nextPcDec = Number.isFinite(nextPcNum) ? String(nextPcNum) : pcPlus4Dec;

  const rs1Name = parsed.rs1 || "";
  const rs2Name = parsed.rs2 || "";
  const rdName = parsed.rd || (flow.writes[0] ?? "");
  const immText =
    parsed.imm ??
    (flow.amount != null
      ? String(flow.amount)
      : flow.immediate != null
        ? String(flow.immediate)
        : "0");

  const regFieldsParts = [
    rs1Name || null,
    rs2Name || null,
    rdName && !rs1Name && !rs2Name ? rdName : null,
  ].filter(Boolean);
  const regFieldsLabel =
    regFieldsParts.length > 0 ? regFieldsParts.join(", ") : "regs";

  const regMap: Record<string, string> = {};
  for (const r of flow.registerInputs) {
    if (r.name && r.value != null) {
      regMap[r.name] = r.value;
      const key = resolveRegKey(r.name);
      if (key) regMap[key] = r.value;
    }
  }
  const fallbackAluVal = computeAluDisplayVal(
    parsed,
    regMap,
    Number.isFinite(pcNum) ? pcNum : 0,
  );

  const aVal = flow.input1
    ? formatScalarValue(flow.input1)
    : rs1Name && resolveRegKey(rs1Name) && regMap[resolveRegKey(rs1Name)!]
      ? formatRegVal(regMap[resolveRegKey(rs1Name)!])
      : isAuipc(op)
        ? pcDec
        : rs1Name || "A";

  const bRegVal = flow.input2
    ? formatScalarValue(flow.input2)
    : rs2Name && resolveRegKey(rs2Name) && regMap[resolveRegKey(rs2Name)!]
      ? formatRegVal(regMap[resolveRegKey(rs2Name)!])
      : rs2Name || "B";

  const aluBVal = hasImmOp
    ? immText
    : bRegVal;

  const aluResText = flow.result
    ? formatScalarValue(flow.result)
    : fallbackAluVal;

  const addrText = formatHexAddr(flow.address ?? flow.result, fallbackAluVal);
  const memValText = formatScalarValue(flow.memoryValue, "0");
  const wbValText = flow.writeValue
    ? formatScalarValue(flow.writeValue)
    : isJumpOp
      ? pcPlus4Dec
      : aluResText;

  const branchChipText =
    flow.taken != null
      ? flow.taken
        ? "Zero: 1 (T)"
        : "Zero: 0 (NT)"
      : fallbackAluVal;

  // ============================================================================
  // 4. 활성 칩 좌표 보간 및 와이어 동기화 스타일
  // ============================================================================
  const syncWireProps = (
    active: boolean,
    state: SubstepAnimState | null | undefined,
    isDashed = false,
  ) => {
    const isDriving = Boolean(
      active && state && state.progress < 1.0 && state.opacity > 0.05,
    );
    const strokeWidth = isDriving ? (isDashed ? 3.4 : 4.0) : 2.6;
    const opacity = active ? (isDriving ? 1.0 : 0.4) : 0;
    return {
      strokeWidth,
      style: {
        opacity,
        transition: "stroke-width 0.15s ease-out, opacity 0.2s ease-out",
      },
    };
  };

  const pt = (pts: { x: number; y: number }[], st: SubstepAnimState | null) =>
    st ? interpolatePathPoints(pts, st.progress) : null;

  const pcToImemPt = pt(SC_PC_TO_IMEM_PTS, if1State);
  const pcToPlus4Pt = pt(SC_PC_TO_PLUS4_PTS, if1State);
  const plus4ToPcPt = pt(SC_PLUS4_TO_PC_PTS, id1State);
  const imemToCuPt = pt(SC_IMEM_TO_CU_PTS, id1State);
  const imemToRegsPt = readsRegsInId ? pt(SC_IMEM_TO_REGS_PTS, id1State) : null;
  const imemToImmPt = hasImmOp ? pt(SC_IMEM_TO_IMM_PTS, id1State) : null;

  const regsToAluPt = pt(SC_REGS_TO_ALU_PTS, exAluAState);
  const regsToOpMuxPt = readsRs2Op ? pt(SC_REGS_TO_OP_MUX_PTS, ex1State) : null;
  const immToOpMuxPt =
    hasImmOp && usesAluOp ? pt(SC_IMM_TO_OP_MUX_PTS, ex1State) : null;
  const cuToOpMuxPt = usesAluOp ? pt(SC_CU_TO_OP_MUX_PTS, ex1State) : null;
  const cuToDmemPt = pt(SC_CU_TO_DMEM_PTS, ctrlDmemState);
  const cuToWbMuxPt = writesRegOp ? pt(SC_CU_TO_WB_MUX_PTS, ex1State) : null;

  const opMuxToAluPt = usesAluOp ? pt(SC_OP_MUX_TO_ALU_PTS, ex2State) : null;

  const aluToDmemPt = isMemOp ? pt(SC_ALU_TO_DMEM_PTS, memState) : null;
  const aluToWbMuxPt =
    !isMemOp && writesRegOp ? pt(SC_ALU_TO_WB_MUX_PTS, memState) : null;

  const dmemToWbMuxPt = isLoadOp ? pt(SC_DMEM_TO_WB_MUX_PTS, wbLoadState) : null;
  const wbMuxToRegsPt = writesRegOp ? pt(SC_WB_MUX_TO_REGS_PTS, wbRegState) : null;

  // 명령어 유형별 1색 통일 팔레트
  const instColor = !hasRealInst
    ? { stroke: "#94A3B8", text: "#94A3B8", fill: "#F8FAFC" }
    : isLoadOp
      ? { stroke: "#059669", text: "#047857", fill: "#ECFDF5" }
      : isStoreOp
        ? { stroke: "#D97706", text: "#B45309", fill: "#FFFBEB" }
        : isBranchOp
          ? { stroke: "#7C3AED", text: "#6D28D9", fill: "#F5F3FF" }
          : isJumpOp
            ? { stroke: "#DB2777", text: "#BE185D", fill: "#FDF2F8" }
            : isSysOp
              ? { stroke: "#6366F1", text: "#4F46E5", fill: "#EEF2FF" }
              : { stroke: "#0284C7", text: "#0369A1", fill: "#F0F9FF" };

  // 입력 도착(휴지 시작, in.end) ~ 출력 도착 직전(out.end)까지 요소와 출력선을 함께 강조
  const inSpan = (start?: number, end?: number, isSink = false) =>
    hasRealInst &&
    start != null &&
    end != null &&
    animProgress >= start &&
    (isSink ? animProgress <= 1 : animProgress < end);

  const isPcPlus4Active = inSpan(schedule.if1?.end, schedule.id1?.end);

  const isUnitActive = (unit: TransferUnit): boolean => {
    if (!hasRealInst) return false;
    switch (unit) {
      case "pc":
        return (
          inSpan(schedule.if1?.start, schedule.if1?.end) ||
          inSpan(schedule.id1?.end, 1, true)
        );
      case "instruction-memory":
        return inSpan(schedule.if1?.end, schedule.id1?.end);
      case "cu": {
        const cuOutEnd = isMemOp
          ? (schedule.ex2 ?? schedule.ex1)?.end
          : schedule.ex1?.end;
        return cuOutEnd != null
          ? inSpan(schedule.id1?.end, cuOutEnd)
          : inSpan(schedule.id1?.end, 1, true);
      }
      case "immediate":
        return (
          hasImmOp &&
          inSpan(schedule.id1?.end, schedule.ex1?.end ?? 1, !schedule.ex1)
        );
      case "registers": {
        const readOutEnd =
          readsRs1Op && usesAluOp && schedule.ex2
            ? schedule.ex2.end
            : schedule.ex1?.end;
        const readingActive =
          readsRegsInId &&
          (readsRs1Op || readsRs2Op) &&
          inSpan(schedule.id1?.end, readOutEnd ?? 1, !readOutEnd);
        const writingActive =
          writesRegOp && inSpan(schedule.wbReg?.end, 1, true);
        return readingActive || writingActive;
      }
      case "operand-mux":
        return usesAluOp && inSpan(schedule.ex1?.end, schedule.ex2?.end);
      case "alu": {
        if (!usesAluOp && !isBranchOp) return false;
        const aluInEnd = schedule.ex2?.end ?? schedule.ex1?.end;
        if (isBranchOp && !isMemOp && !writesRegOp) {
          return inSpan(aluInEnd, 1, true);
        }
        return inSpan(aluInEnd, schedule.mem?.end ?? 1, !schedule.mem);
      }
      case "memory":
        if (!isMemOp) return false;
        return isLoadOp
          ? inSpan(schedule.mem?.end, schedule.wbLoad?.end)
          : inSpan(schedule.mem?.end, 1, true);
      case "mux": {
        if (!writesRegOp) return false;
        const muxInEnd = isLoadOp ? schedule.wbLoad?.end : schedule.mem?.end;
        return inSpan(muxInEnd, schedule.wbReg?.end);
      }
      default:
        return false;
    }
  };

  // 회로 소자 렌더러 (입력 도착~출력 도착 구간 동안 명령어 색으로 점등)
  const node = (unit: TransferUnit) => {
    const b = BOXES[unit];
    const mux = unit === "mux" || unit === "operand-mux";
    const active = isUnitActive(unit);
    const stroke = active ? instColor.stroke : "#94A3B8";
    const textColor = active ? instColor.text : "#94A3B8";
    const shape =
      unit === "alu"
        ? `M${b.x - 4} ${b.y - sy(4)}V${b.y + b.h / 2 - b.h * 0.15}L${b.x - 4 + b.w * 0.24} ${b.y + b.h / 2}L${b.x - 4} ${b.y + b.h / 2 + b.h * 0.15}V${b.y + b.h + sy(4)}L${b.x + b.w + 4} ${b.y + b.h + sy(4) - b.h * 0.13}V${b.y - sy(4) + b.h * 0.13}Z`
        : undefined;
    const fill = active ? instColor.fill : "#F8FAFC";
    return (
      <g
        key={unit}
        aria-label={`${TITLES[unit]} (${ROLES[unit]})`}
        data-flow-node={unit}
        data-flow-active={active ? "true" : "false"}
        data-x={b.x}
        data-y={b.y}
        data-width={b.w}
        data-height={b.h}
      >
        <title>{`${TITLES[unit]}: ${ROLES[unit]}`}</title>
        {shape ? (
          <path
            data-device-surface="true"
            d={shape}
            fill={fill}
            stroke={stroke}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
        ) : (
          <rect
            data-device-surface="true"
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={
              mux || unit === "cu" || unit === "immediate"
                ? Math.min(b.w, b.h) / 2
                : 8
            }
            ry={
              mux || unit === "cu" || unit === "immediate"
                ? Math.min(b.w, b.h) / 2
                : undefined
            }
            fill={fill}
            stroke={stroke}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
        )}
        <text
          x={b.x + b.w / 2}
          y={b.y + b.h / 2}
          dominantBaseline="central"
          textAnchor="middle"
          fontFamily="sans-serif"
          fontSize={18}
          fontWeight="bold"
          fill={textColor}
        >
          {(unit === "cu" || unit === "immediate") &&
          TITLES[unit].includes(" ")
            ? TITLES[unit].split(" ").map((word, idx, arr) => (
                <tspan
                  key={word}
                  x={b.x + b.w / 2}
                  dy={idx === 0 ? `${-(arr.length - 1) * 0.55}em` : "1.15em"}
                >
                  {word}
                </tspan>
              ))
            : TITLES[unit]}
        </text>
      </g>
    );
  };

  return (
    <div
      className="ar-single-flow flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden"
      style={{} as CSSProperties}
    >
      <div ref={area} className="min-h-0 flex-1 overflow-hidden">
        <svg
          viewBox="-25 40 1190 1450"
          preserveAspectRatio="xMidYMid meet"
          className="ar-single-flow-diagram block h-full w-full font-sans"
          role="group"
          aria-label="CPU 내부 장치와 메모리의 싱글 사이클 구조"
          data-layout="hardware-architecture"
          data-layout-compact={compact}
        >
          <defs>
            <marker
              id={`${id}-inactive`}
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerUnits="userSpaceOnUse"
              markerWidth="12"
              markerHeight="12"
              orient="auto"
            >
              <path d="M0 1.2L9 5L0 8.8Z" fill="#94A3B8" />
            </marker>
            <marker
              id={`${id}-arr-inst`}
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerUnits="userSpaceOnUse"
              markerWidth="12"
              markerHeight="12"
              orient="auto"
            >
              <path d="M0 1.2L9 5L0 8.8Z" fill={instColor.stroke} />
            </marker>
            <filter
              id="token-glow"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feDropShadow
                dx="0"
                dy="1.5"
                stdDeviation="2"
                floodColor="#EF4444"
                floodOpacity="0.45"
              />
            </filter>
          </defs>

          {instructionText && (
            <g data-current-instruction="true">
              <rect
                x="-10"
                y={sy(48)}
                width={Math.max(220, instructionText.length * 17 + 56)}
                height={sy(54)}
                rx="10"
                fill="var(--ar-header-bg)"
                stroke={hasRealInst ? instColor.stroke : "var(--ar-border)"}
                strokeWidth="2.5"
              />
              <circle
                cx="12"
                cy={sy(75)}
                r="6"
                fill={hasRealInst ? instColor.stroke : "var(--ar-mode-single)"}
              />
              <text
                x="30"
                y={sy(84)}
                fontSize="26"
                fontWeight="700"
                className="font-mono"
                fill="var(--ar-text-primary)"
              >
                {instructionText}
              </text>
            </g>
          )}

          {/* CPU / MEMORY 본체 (좌우/하단 여백 축소 및 크기 확대) */}
          <g data-datapath-body="true" transform="translate(-74, -26) scale(1.11)">
          {/* CPU / MEMORY 영역 */}
          <rect
            x="130"
            y={sy(130)}
            width="900"
            height={sy(900)}
            rx="24"
            fill="#059669"
            fillOpacity={0.18}
            stroke="none"
            data-hardware-region="cpu"
          />
          <text
            x="150"
            y={sy(162)}
            dominantBaseline="central"
            fontSize="26"
            fontWeight="800"
            fill="var(--ar-text-primary)"
          >
            CPU
          </text>
          <rect
            x="130"
            y={sy(1135)}
            width="900"
            height={sy(210)}
            rx="16"
            fill="#D97706"
            fillOpacity={0.18}
            stroke="none"
            data-hardware-region="memory"
          />
          <text
            x="150"
            y={sy(1162)}
            dominantBaseline="central"
            fontSize="24"
            fontWeight="800"
            fill="var(--ar-text-primary)"
          >
            MEMORY
          </text>

          {/* 1. 정적 데이터패스 배선 골격 (컴파일 즉시 투명화) */}
          <g
            data-datapath-wires="true"
            fill="none"
            stroke="#94A3B8"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{
              opacity: isCompiled ? 0 : 1,
              transition: "opacity 0.2s ease-out",
            }}
          >
            <path d={SC_PC_TO_IMEM_D} markerEnd={`url(#${id}-inactive)`} />
            <path
              d="M 100 920 H 238 V 780"
              markerEnd={`url(#${id}-inactive)`}
            />
            <path d={SC_PLUS4_TO_PC_D} markerEnd={`url(#${id}-inactive)`} />
            <path d={SC_IMEM_TO_CU_D} markerEnd={`url(#${id}-inactive)`} />
            <path d={SC_IMEM_TO_REGS_D} markerEnd={`url(#${id}-inactive)`} />
            <path d={SC_IMEM_TO_IMM_D} markerEnd={`url(#${id}-inactive)`} />
            <path d={SC_REGS_TO_ALU_D} markerEnd={`url(#${id}-inactive)`} />
            <path d={SC_REGS_TO_OP_MUX_D} markerEnd={`url(#${id}-inactive)`} />
            <path d={SC_IMM_TO_OP_MUX_D} markerEnd={`url(#${id}-inactive)`} />
            <path d={SC_OP_MUX_TO_ALU_D} markerEnd={`url(#${id}-inactive)`} />
            <path d={SC_ALU_TO_DMEM_D} markerEnd={`url(#${id}-inactive)`} />
            <path
              d="M 977 645 V 410 H 665"
              markerEnd={`url(#${id}-inactive)`}
            />
            <path d={SC_DMEM_TO_WB_MUX_D} markerEnd={`url(#${id}-inactive)`} />
            <path d={SC_WB_MUX_TO_REGS_D} markerEnd={`url(#${id}-inactive)`} />
          </g>

          {/* 2. 정적 제어 시그널 배선 골격 (컴파일 즉시 투명화) */}
          <g
            data-control-wires="true"
            fill="none"
            stroke="#64748B"
            strokeWidth={1.8}
            strokeDasharray="6 4"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{
              opacity: isCompiled ? 0 : 1,
              transition: "opacity 0.2s ease-out",
            }}
          >
            <path d={SC_CU_TO_WB_MUX_D} markerEnd={`url(#${id}-inactive)`} />
            <path d={SC_CU_TO_OP_MUX_D} markerEnd={`url(#${id}-inactive)`} />
            <path d={SC_CU_TO_DMEM_D} markerEnd={`url(#${id}-inactive)`} />
          </g>

          {/* 3. 활성 단계 동기화 배선 오버레이 (파이프라인 동일 규격) */}
          {hasRealInst && (
            <g
              data-active-wires="true"
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            >
              {/* IF Stage */}
              <path
                d={SC_PC_TO_IMEM_D}
                stroke={instColor.stroke}
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(true, if1State)}
              />
              <path
                d={SC_PC_TO_PLUS4_D}
                stroke={instColor.stroke}
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(true, if1State)}
              />
              <path
                d={SC_PLUS4_TO_PC_D}
                stroke={instColor.stroke}
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(true, id1State)}
              />

              {/* ID Stage */}
              <path
                d={SC_IMEM_TO_CU_D}
                stroke={instColor.stroke}
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(true, id1State)}
              />
              <path
                d={SC_IMEM_TO_REGS_D}
                stroke={instColor.stroke}
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(readsRegsInId, id1State)}
              />
              <path
                d={SC_IMEM_TO_IMM_D}
                stroke={instColor.stroke}
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(hasImmOp, id1State)}
              />

              {/* EX Stage & Control */}
              <path
                d={SC_REGS_TO_ALU_D}
                stroke={instColor.stroke}
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(readsRs1Op && usesAluOp, exAluAState)}
              />
              <path
                d={SC_REGS_TO_OP_MUX_D}
                stroke={instColor.stroke}
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(readsRs2Op, ex1State)}
              />
              <path
                d={SC_IMM_TO_OP_MUX_D}
                stroke={instColor.stroke}
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(hasImmOp && usesAluOp, ex1State)}
              />
              <path
                d={SC_OP_MUX_TO_ALU_D}
                stroke={instColor.stroke}
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(usesAluOp, ex2State)}
              />

              <path
                d={SC_CU_TO_OP_MUX_D}
                stroke={instColor.stroke}
                strokeDasharray="6 4"
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(usesAluOp, ex1State, true)}
              />
              <path
                d={SC_CU_TO_DMEM_D}
                stroke={instColor.stroke}
                strokeDasharray="6 4"
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(isMemOp, ctrlDmemState, true)}
              />
              <path
                d={SC_CU_TO_WB_MUX_D}
                stroke={instColor.stroke}
                strokeDasharray="6 4"
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(writesRegOp, ex1State, true)}
              />

              {/* MEM / WB Stages */}
              <path
                d={SC_ALU_TO_DMEM_D}
                stroke={instColor.stroke}
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(isMemOp, memState)}
              />
              <path
                d={SC_ALU_TO_WB_MUX_D}
                stroke={instColor.stroke}
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(!isMemOp && writesRegOp, memState)}
              />
              <path
                d={SC_DMEM_TO_WB_MUX_D}
                stroke={instColor.stroke}
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(isLoadOp, wbLoadState)}
              />
              <path
                d={SC_WB_MUX_TO_REGS_D}
                stroke={instColor.stroke}
                markerEnd={`url(#${id}-arr-inst)`}
                {...syncWireProps(writesRegOp, wbRegState)}
              />
            </g>
          )}

          {/* 4. 회로 소자 */}
          {(Object.keys(BOXES) as TransferUnit[])
            .filter((u) => u !== "pc-select" && u !== "decoder")
            .map(node)}
          <g
            data-pc-plus4="true"
            data-flow-active={isPcPlus4Active ? "true" : "false"}
            aria-label="PC + 4 가산기"
          >
            <polygon
              points={`213,${sy(740)} 263,${sy(740)} 283,${sy(780)} 193,${sy(780)}`}
              fill={isPcPlus4Active ? instColor.fill : "#F8FAFC"}
              stroke={isPcPlus4Active ? instColor.stroke : "#94A3B8"}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            <text
              x={238}
              y={sy(760)}
              dominantBaseline="central"
              textAnchor="middle"
              fontFamily="sans-serif"
              fontSize={18}
              fontWeight="bold"
              fill={isPcPlus4Active ? instColor.text : "#94A3B8"}
            >
              + 4
            </text>
          </g>

          {/* 5. 최상단 이동 데이터·제어 칩 레이어 (파이프라인 FloatingChip 동일 디자인) */}
          {hasRealInst && (
            <g data-flow-chips="true">
              {/* Step 1: IF */}
              {pcToImemPt && if1State && (
                <FloatingChip
                  x={pcToImemPt.x}
                  y={pcToImemPt.y}
                  text={`PC: ${pcDec}`}
                  stroke={instColor.stroke}
                  title={`PC 주소: ${pcDec}`}
                  opacity={if1State.opacity}
                />
              )}
              {pcToPlus4Pt && if1State && (
                <FloatingChip
                  x={pcToPlus4Pt.x}
                  y={pcToPlus4Pt.y}
                  text={`PC: ${pcDec}`}
                  stroke={instColor.stroke}
                  title={`PC + 4 입력: ${pcDec}`}
                  opacity={if1State.opacity}
                />
              )}

              {/* Step 2: ID (+4 루프백 및 명령어 분배) */}
              {plus4ToPcPt && id1State && (
                <FloatingChip
                  x={plus4ToPcPt.x}
                  y={plus4ToPcPt.y}
                  text={
                    flow.taken || isJumpOp
                      ? `Next: ${nextPcDec}`
                      : `+4: ${pcPlus4Dec}`
                  }
                  stroke={instColor.stroke}
                  title={`다음 PC: ${flow.taken || isJumpOp ? nextPcDec : pcPlus4Dec}`}
                  opacity={id1State.opacity}
                />
              )}
              {imemToCuPt && id1State && (
                <FloatingChip
                  x={imemToCuPt.x}
                  y={imemToCuPt.y}
                  text={op || instructionText || "—"}
                  stroke={instColor.stroke}
                  title={`명령어 디코드: ${instructionText || op}`}
                  opacity={id1State.opacity}
                />
              )}
              {imemToRegsPt && id1State && (
                <FloatingChip
                  x={imemToRegsPt.x}
                  y={imemToRegsPt.y}
                  text={regFieldsLabel}
                  stroke={instColor.stroke}
                  title={`레지스터 필드: ${regFieldsLabel}`}
                  opacity={id1State.opacity}
                />
              )}
              {imemToImmPt && id1State && (
                <FloatingChip
                  x={imemToImmPt.x}
                  y={imemToImmPt.y}
                  text={`imm: ${immText}`}
                  stroke={instColor.stroke}
                  title={`즉치수 필드: ${immText}`}
                  opacity={id1State.opacity}
                />
              )}

              {/* Step 3: EX-1 피연산자 및 제어 신호 */}
              {regsToAluPt && exAluAState && (
                <FloatingChip
                  x={regsToAluPt.x}
                  y={regsToAluPt.y}
                  text={`A: ${aVal}`}
                  stroke={instColor.stroke}
                  title={`ALU 입력 A: ${aVal}`}
                  opacity={exAluAState.opacity}
                />
              )}
              {regsToOpMuxPt && ex1State && (
                <FloatingChip
                  x={regsToOpMuxPt.x}
                  y={regsToOpMuxPt.y}
                  text={`B: ${bRegVal}`}
                  stroke={instColor.stroke}
                  title={`MUX 레지스터 입력: ${bRegVal}`}
                  opacity={ex1State.opacity}
                />
              )}
              {immToOpMuxPt && ex1State && (
                <FloatingChip
                  x={immToOpMuxPt.x}
                  y={immToOpMuxPt.y}
                  text={`imm: ${immText}`}
                  stroke={instColor.stroke}
                  title={`MUX 즉치수 입력: ${immText}`}
                  opacity={ex1State.opacity}
                />
              )}
              {cuToOpMuxPt && ex1State && (
                <FloatingChip
                  x={cuToOpMuxPt.x}
                  y={cuToOpMuxPt.y}
                  text={hasImmOp ? "ALUSrc: 1" : "ALUSrc: 0"}
                  stroke={instColor.stroke}
                  title={`ALUSrc 제어 신호: ${hasImmOp ? "1 (즉치수)" : "0 (레지스터)"}`}
                  opacity={ex1State.opacity}
                />
              )}
              {cuToDmemPt && ctrlDmemState && (
                <FloatingChip
                  x={cuToDmemPt.x}
                  y={cuToDmemPt.y}
                  text={isLoadOp ? "MemRead: 1" : "MemWrite: 1"}
                  stroke={instColor.stroke}
                  title={isLoadOp ? "MemRead: 1" : "MemWrite: 1"}
                  opacity={ctrlDmemState.opacity}
                />
              )}
              {cuToWbMuxPt && ex1State && (
                <FloatingChip
                  x={cuToWbMuxPt.x}
                  y={cuToWbMuxPt.y}
                  text={isLoadOp ? "MemtoReg: 1" : "MemtoReg: 0"}
                  stroke={instColor.stroke}
                  title={`MemtoReg 제어 신호: ${isLoadOp ? 1 : 0}`}
                  opacity={ex1State.opacity}
                />
              )}

              {/* Step 4: EX-2 Operand MUX -> ALU */}
              {opMuxToAluPt && ex2State && (
                <FloatingChip
                  x={opMuxToAluPt.x}
                  y={opMuxToAluPt.y}
                  text={`B: ${aluBVal}`}
                  stroke={instColor.stroke}
                  title={`선택된 ALU 입력 B: ${aluBVal}`}
                  opacity={ex2State.opacity}
                />
              )}

              {/* Step 5: MEM / ALU 출력 */}
              {aluToDmemPt && memState && (
                <FloatingChip
                  x={aluToDmemPt.x}
                  y={aluToDmemPt.y}
                  lines={
                    isStoreOp
                      ? [`Addr: ${addrText}`, `WData: ${memValText}`]
                      : [`Addr: ${addrText}`]
                  }
                  stroke={instColor.stroke}
                  title={
                    isStoreOp
                      ? `메모리 쓰기 주소 ${addrText}, 데이터 ${memValText}`
                      : `메모리 읽기 주소 ${addrText}`
                  }
                  opacity={memState.opacity}
                />
              )}
              {aluToWbMuxPt && memState && (
                <FloatingChip
                  x={aluToWbMuxPt.x}
                  y={aluToWbMuxPt.y}
                  text={isJumpOp ? `PC+4: ${pcPlus4Dec}` : `ALU: ${aluResText}`}
                  stroke={instColor.stroke}
                  title={`연산 결과: ${isJumpOp ? pcPlus4Dec : aluResText}`}
                  opacity={memState.opacity}
                />
              )}
              {isBranchOp && memState && (
                <FloatingChip
                  x={929}
                  y={645}
                  text={branchChipText}
                  stroke={instColor.stroke}
                  title={`분기 판정 결과: ${branchChipText}`}
                  opacity={memState.opacity}
                />
              )}

              {/* Step 6: WB (Load 읽기 복귀 & 레지스터 쓰기) */}
              {dmemToWbMuxPt && wbLoadState && (
                <FloatingChip
                  x={dmemToWbMuxPt.x}
                  y={dmemToWbMuxPt.y}
                  text={`RData: ${memValText}`}
                  stroke={instColor.stroke}
                  title={`메모리 읽기 값: ${memValText}`}
                  opacity={wbLoadState.opacity}
                />
              )}
              {wbMuxToRegsPt && wbRegState && (
                <FloatingChip
                  x={wbMuxToRegsPt.x}
                  y={wbMuxToRegsPt.y}
                  text={rdName ? `${rdName}: ${wbValText}` : wbValText}
                  stroke={instColor.stroke}
                  title={`레지스터 기록: ${rdName ? `${rdName} = ${wbValText}` : wbValText}`}
                  opacity={wbRegState.opacity}
                />
              )}
            </g>
          )}
          </g>
        </svg>
      </div>
    </div>
  );
}
