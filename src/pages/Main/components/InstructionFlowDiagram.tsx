import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  displayValue,
  numericPc,
  registerLabel,
  instructionFields,
  immediateField,
  instructionPaths,
  pointOnTransfer,
  transferMotion,
  instructionTransfers,
  type TransferUnit,
  type InstructionTransfer,
  type buildInstructionFlow,
} from "../utils/instructionFlow";
import { aluLesson } from "../utils/hardwareLesson";
import type { SimulationResult } from "@/type/simulation";

type Flow = ReturnType<typeof buildInstructionFlow>;
type Box = { x: number; y: number; w: number; h: number };
const COLORS = {
  address: "var(--ar-flow-address)",
  data: "var(--ar-flow-data)",
  control: "var(--ar-flow-control)",
};
const BOXES: Record<TransferUnit, Box> = {
  pc: { x: 55, y: 175, w: 190, h: 120 },
  decoder: { x: 335, y: 175, w: 490, h: 180 },
  registers: { x: 35, y: 390, w: 280, h: 210 },
  immediate: { x: 415, y: 390, w: 190, h: 125 },
  cu: { x: 690, y: 390, w: 270, h: 180 },
  "operand-mux": { x: 375, y: 625, w: 300, h: 100 },
  alu: { x: 710, y: 625, w: 300, h: 205 },
  mux: { x: 375, y: 865, w: 300, h: 100 },
  "pc-select": { x: 55, y: 865, w: 240, h: 180 },
  "instruction-memory": { x: 1200, y: 230, w: 320, h: 210 },
  memory: { x: 1200, y: 705, w: 320, h: 210 },
};
const TITLES: Record<TransferUnit, string> = {
  pc: "PC",
  decoder: "Instruction Decoder",
  cu: "Control Unit",
  registers: "Registers",
  immediate: "Imm Gen",
  "operand-mux": "MUX",
  alu: "ALU",
  mux: "MUX",
  "pc-select": "PC Select",
  "instruction-memory": "Instruction Memory",
  memory: "Data Memory",
};
const ROLES: Record<TransferUnit, string> = {
  pc: "명령어 주소",
  decoder: "CU의 해독 회로 · 명령어 필드 분리",
  cu: "계산·읽기·쓰기를 제어",
  registers: "입력·계산 결과 보관",
  immediate: "상수 생성",
  "operand-mux": "ALU의 두 번째 입력 선택",
  alu: "연산 회로 선택",
  mux: "레지스터에 쓸 결과 선택",
  "pc-select": "가산기 + PC MUX",
  "instruction-memory": "주소 → 명령어 읽기",
  memory: "주소 → 읽기·쓰기",
};
const short = (value?: string | null) => displayValue(value).split(" · ")[0];
const AUXILIARY_CONNECTIONS = new Set([
  "pc-input",
  "pc-control",
  "next-pc",
  "result-link",
  "pc-immediate",
  "pc-base",
  "branch-decision",
]);
// Fixed physical-model connections: instructions select paths, never change the topology.
const WIRES: { key: string; kind: keyof typeof COLORS; system?: boolean }[] = [
  { key: "fetch-address", kind: "address", system: true },
  { key: "fetch-instruction", kind: "data", system: true },
  { key: "decode-control", kind: "control" },
  { key: "decode-immediate", kind: "data" },
  { key: "read-control", kind: "control" },
  { key: "input-a-register", kind: "data" },
  { key: "input-a-pc", kind: "data" },
  { key: "input-b-register", kind: "data" },
  { key: "input-b-immediate", kind: "data" },
  { key: "mux-to-alu", kind: "data" },
  { key: "memory-address", kind: "address", system: true },
  { key: "memory-control", kind: "control", system: true },
  { key: "store-data", kind: "data", system: true },
  { key: "load-data", kind: "data", system: true },
  { key: "result-alu", kind: "data" },
  { key: "result-link", kind: "data" },
  { key: "writeback", kind: "data" },
  { key: "pc-input", kind: "address" },
  { key: "pc-immediate", kind: "data" },
  { key: "pc-base", kind: "address" },
  { key: "pc-control", kind: "control" },
  { key: "next-pc", kind: "address" },
  { key: "branch-decision", kind: "control" },
  { key: "alu-select-control", kind: "control" },
  { key: "operand-select-control", kind: "control" },
  { key: "register-write-control", kind: "control" },
  { key: "write-select-control", kind: "control" },
];

export default function InstructionFlowDiagram({
  flow,
  transfer,
  progress,
  index,
  count,
  arrived,
  onUnit,
  onInspect,
  finished = false,
  completionLabel,
  executionStatus,
}: {
  flow: Flow;
  transfer: InstructionTransfer;
  progress: number;
  index: number;
  count: number;
  arrived: string[];
  onUnit: (unit: TransferUnit) => void;
  onInspect: (unit: "alu" | "pc-select" | "decoder") => void;
  finished?: boolean;
  completionLabel?: string;
  executionStatus?: SimulationResult["execution_status"];
}) {
  const id = useId().replace(/:/g, "");
  const area = useRef<HTMLDivElement>(null);
  const lesson = aluLesson(flow);
  const selectUnit = (unit: TransferUnit) => {
    onUnit(unit);
    if (unit === "alu" || unit === "pc-select" || unit === "decoder")
      onInspect(unit);
  };
  const [{ compact, verticalScale }, setCanvas] = useState({
    compact: false,
    verticalScale: 1,
  });
  const sy = (value: number) => value * verticalScale;
  const usedPaths = useMemo(
    () =>
      new Set(
        instructionTransfers(flow).map((t) => {
          if (t.id === "input-a")
            return flow.pcRelative ? "input-a-pc" : "input-a-register";
          if (t.id === "input-b")
            return flow.usesImmediate
              ? "input-b-immediate"
              : "input-b-register";
          if (t.id === "result-to-mux")
            return flow.jump ? "result-link" : "result-alu";
          return t.id;
        }),
      ),
    [flow],
  );
  const showWire = (key: string) =>
    usedPaths.has(key) && !AUXILIARY_CONNECTIONS.has(key);
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
          (height * (compact ? 1470 : 1830)) / (width * (compact ? 1298 : 970)),
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
  const baseBoxes = compact
    ? {
        ...BOXES,
        "instruction-memory": {
          ...BOXES["instruction-memory"],
          x: 55,
          y: 1165,
          w: 330,
        },
        memory: { ...BOXES.memory, x: 675, y: 1165, w: 330 },
      }
    : BOXES;
  const boxes = Object.fromEntries(
    Object.entries(baseBoxes).map(([key, box]) => [
      key,
      { ...box, y: sy(box.y), h: sy(box.h) },
    ]),
  ) as Record<TransferUnit, Box>;
  const paths = useMemo(
    () => instructionPaths(flow, 1, compact, verticalScale),
    [flow, compact, verticalScale],
  );
  const path = paths[transfer.id];
  const motion = useMemo(
    () => transferMotion(transfer, path),
    [transfer, path],
  );
  const point =
    !finished && motion.route
      ? pointOnTransfer(
          motion.route,
          progress,
          motion.startPadding,
          motion.endPadding,
        )
      : undefined;
  const packet = point
    ? { x: point.x - motion.width / 2, y: point.y - 23, w: motion.width, h: 46 }
    : undefined;
  const color = finished ? "var(--ar-text-muted)" : COLORS[transfer.kind];
  const reached = (key: string) =>
    arrived.includes(key) ||
    (transfer.id === key && (finished || progress >= 0.95));
  const decoded = instructionFields(flow.raw);
  const baseName =
    decoded?.rs1 == null
      ? undefined
      : registerLabel(`x${decoded.rs1}`).split(" ")[0];
  const storeName =
    decoded?.rs2 == null
      ? undefined
      : registerLabel(`x${decoded.rs2}`).split(" ")[0];
  const offset = flow.immediate ?? decoded?.immediate;
  const addressFormula = `${baseName ?? "rs1"} ${offset == null ? "+ imm" : offset < 0 ? `− ${Math.abs(offset)}` : `+ ${offset}`}`;
  const detailText =
    transfer.id === "decode-immediate"
      ? `${immediateField(flow.raw)?.format ?? ""}형 즉치 필드를 전달하고, Imm Gen에서 비트를 조합·확장합니다.`
      : (flow.load || flow.store) && transfer.id === "memory-address"
        ? `ALU가 ${addressFormula}로 계산한 주소를 Address Bus로 보냅니다.`
        : flow.store && transfer.id === "store-data"
          ? `${storeName ?? "rs2"}의 하위 ${flow.width}비트를 Data Bus로 보냅니다. CU가 메모리 쓰기를 제어합니다.`
          : transfer.id === "calculate" && !flow.jump && !flow.system
            ? flow.load || flow.store
              ? `ALU의 가산기가 ${addressFormula}를 계산해 메모리 접근 주소를 만듭니다.`
              : lesson.category === "pass"
                ? "상위 즉치값을 결과의 상위 20비트에 놓고 하위 12비트를 0으로 채웁니다."
                : flow.branch
                  ? `ALU가 두 입력을 ${lesson.operator} 조건으로 비교합니다. 비교 결과는 다음 PC 선택에 사용됩니다.`
                  : `CU가 ${flow.op.toUpperCase()} 연산을 선택합니다. ALU는 두 입력에 ${lesson.operator} 연산을 적용하고 32비트 결과를 출력합니다.`
            : transfer.id === "read-control"
              ? "명령어의 rs1·rs2 필드가 읽을 레지스터 번호를 지정합니다. 레지스터 파일은 선택된 번호의 값을 출력합니다."
              : transfer.id === "decode-control"
                ? `해독 회로가 opcode·funct 필드를 해석합니다. CU는 ${flow.op.toUpperCase()}에 필요한 연산과 레지스터·메모리 제어 신호를 선택합니다.`
                : transfer.detail;
  const specialEncoding =
    decoded && ["1110011", "0001111"].includes(decoded.opcode);
  const signal = (value?: boolean) =>
    value == null ? "미제공" : value ? "1" : "0";
  const hasWrite = flow.writes.length > 0 && !flow.store;
  const pcPlusFour = Number.isFinite(numericPc(flow.pc))
    ? `0x${((numericPc(flow.pc) + 4) >>> 0).toString(16).padStart(8, "0")}`
    : "미제공";
  const nextRule =
    flow.op === "jalr"
      ? "(rs1 + imm) & ~1"
      : flow.op === "jal"
        ? "PC + imm"
        : flow.branch
          ? flow.taken == null
            ? "분기 판정 미제공"
            : flow.taken
              ? "분기: PC + imm"
              : "불성립: PC + 4"
          : "순차: PC + 4";
  const lines: Record<TransferUnit, string[]> = {
    pc: [
      (finished && flow.completed ? flow.nextPc : flow.pc)?.replace(
        /^0x0+(?=[\da-f])/i,
        "0x",
      ) ?? "미제공",
    ],
    decoder: [flow.raw ?? "기계어 미제공"],
    cu: [
      `ALU: ${flow.system ? "사용 안 함" : flow.load || flow.store ? "ADD · 주소 계산" : flow.op.toUpperCase()}`,
      `기록 ${signal(flow.controlSignals?.reg_write)}`,
      `읽기 ${signal(flow.controlSignals?.mem_read)} · 쓰기 ${signal(flow.controlSignals?.mem_write)}`,
    ],
    registers: [
      ...flow.registerInputs.map(
        (input) =>
          `${registerLabel(input.name).split(" ")[0]}: ${short(input.value)}`,
      ),
      hasWrite
        ? reached("writeback")
          ? `${flow.writes[0]} ← ${short(flow.writeValue)}`
          : `기록 대상 ${flow.writes[0]} · 대기`
        : decoded?.rd === 0
          ? "x0 쓰기는 버림 · 항상 0"
          : "레지스터 값 유지",
    ],
    immediate: [
      flow.usesImmediate || flow.branch
        ? reached("decode-immediate")
          ? flow.amount != null
            ? `shamt ${flow.amount}비트`
            : String(flow.immediate ?? "미제공")
          : "해독 대기"
        : "사용 안 함",
    ],
    "operand-mux": [
      flow.usesImmediate
        ? "즉치값 선택"
        : flow.registerInputs.length > 1
          ? "rs2 값 선택"
          : "사용 안 함",
      reached("input-b")
        ? short(
            flow.amount == null || !flow.usesImmediate
              ? flow.input2
              : String(flow.amount),
          )
        : "입력 대기",
    ],
    alu: flow.jump
      ? ["ALU 사용 안 함", "PC 회로에서 주소 계산"]
      : flow.system
        ? ["환경 요청", "ALU 사용 안 함"]
        : [
            `A ${!flow.pcRelative && !flow.registerInputs.length ? short(flow.input1) : reached("input-a") ? short(flow.input1) : "← " + (flow.pcRelative ? "PC" : "레지스터")}`,
            `${lesson.operator} ${reached("mux-to-alu") ? (flow.amount == null ? short(flow.input2) : `${flow.amount}비트 이동`) : "B ← 입력 MUX"}`,
            flow.branch
              ? `비교 ${reached("calculate") ? (flow.taken == null ? "미제공" : flow.taken ? "성립" : "불성립") : "대기"}`
              : `= ${reached("calculate") ? short(flow.result) : "결과 대기"}`,
          ],
    mux: [
      hasWrite
        ? flow.load
          ? "메모리 값 선택"
          : flow.jump
            ? "PC + 4 선택"
            : "연산 결과 선택"
        : "사용 안 함",
      reached("load-data") || reached("result-to-mux")
        ? short(flow.writeValue)
        : "전달 대기",
    ],
    "pc-select": [
      nextRule,
      `+4 ${pcPlusFour.replace(/^0x0+(?=[\da-f])/i, "0x")}`,
      `다음 ${reached("next-pc") ? (flow.nextPc?.replace(/^0x0+(?=[\da-f])/i, "0x") ?? "미제공") : "선택 대기"}`,
    ],
    "instruction-memory": [
      `주소 ${flow.pc ?? "미제공"}`,
      flow.raw ?? "기계어 미제공",
    ],
    memory:
      flow.load || flow.store
        ? [
            `주소 ${reached("memory-address") ? (flow.address ?? "미제공") : "전달 대기"}`,
            `${flow.width / 8}바이트 ${flow.load ? "읽기" : "쓰기"}`,
            reached("load-data") ||
            reached("store-data") ||
            reached("discard-load")
              ? short(flow.memoryValue)
              : "값 대기",
            flow.error
              ? "접근 오류"
              : flow.load && flow.width < 32
                ? /^(lb|lh)$/.test(flow.op)
                  ? "부호 확장 → 32비트"
                  : "0 확장 → 32비트"
                : "",
          ]
        : ["이번 명령은 사용 안 함"],
  };
  const node = (unit: TransferUnit) => {
    const b = boxes[unit],
      active =
        !finished && (transfer.source === unit || transfer.target === unit);
    const status = !active
      ? ""
      : transfer.source === unit && transfer.target === unit
        ? unit === "alu"
          ? flow.load || flow.store
            ? "주소 계산"
            : flow.branch
              ? "조건 비교"
              : `${flow.op.toUpperCase()} 연산`
          : unit === "pc-select"
            ? "주소 선택"
            : flow.system
              ? "환경 요청"
              : "읽기 확인"
        : transfer.id === "memory-address" && unit === "alu"
          ? "주소 전달"
          : transfer.id === "memory-address" && unit === "memory"
            ? "주소 수신"
            : transfer.source === unit
              ? "출발"
              : transfer.target === unit
                ? "도착"
                : "";
    const mux = unit === "mux" || unit === "operand-mux";
    const statusWidth = Math.max(58, [...status].length * 18 + 20);
    const stroke = active ? color : "var(--ar-flow-device-border)";
    const textColor = active
      ? `var(--ar-flow-${transfer.kind}-text)`
      : "var(--ar-flow-idle-text)";
    const shape = mux
      ? `M${b.x} ${b.y}H${b.x + b.w}L${b.x + b.w - 18} ${b.y + b.h}H${b.x + 18}Z`
      : unit === "alu"
        ? `M${b.x} ${b.y}H${b.x + b.w / 2 - 25}L${b.x + b.w / 2} ${b.y + sy(15)}L${b.x + b.w / 2 + 25} ${b.y}H${b.x + b.w}L${b.x + b.w - 24} ${b.y + b.h}H${b.x + 24}Z`
        : unit === "cu"
          ? `M${b.x + 18} ${b.y}H${b.x + b.w - 18}L${b.x + b.w} ${b.y + sy(18)}V${b.y + b.h - sy(18)}L${b.x + b.w - 18} ${b.y + b.h}H${b.x + 18}L${b.x} ${b.y + b.h - sy(18)}V${b.y + sy(18)}Z`
          : undefined;
    const fill = active
      ? `color-mix(in srgb, ${color} 6%, var(--ar-flow-device-bg))`
      : "var(--ar-flow-device-bg)";
    return (
      <g
        key={unit}
        role="button"
        tabIndex={0}
        aria-label={`${TITLES[unit]} 역할과 동작 보기`}
        data-flow-node={unit}
        data-flow-active={active}
        data-x={b.x}
        data-y={b.y}
        data-width={b.w}
        data-height={b.h}
        data-hardware-shape={
          mux
            ? "mux"
            : unit === "alu"
              ? "alu"
              : unit === "registers"
                ? "register-file"
                : "chip"
        }
        onClick={() => selectUnit(unit)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectUnit(unit);
          }
        }}
        className="cursor-pointer outline-none focus-visible:drop-shadow-md"
      >
        <title>
          {TITLES[unit]}: {ROLES[unit]}. {lines[unit].join(". ")}
        </title>
        {unit === "registers" && (
          <rect
            x={b.x + 5}
            y={b.y - sy(5)}
            width={b.w}
            height={b.h}
            rx="8"
            fill="var(--ar-flow-device-bg)"
            stroke={stroke}
          />
        )}
        {shape ? (
          <path
            data-device-surface="true"
            d={shape}
            fill={fill}
            stroke={stroke}
            strokeWidth={active ? 2.6 : 2.2}
          />
        ) : (
          <rect
            data-device-surface="true"
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="8"
            fill={fill}
            stroke={stroke}
            strokeWidth={active ? 2.6 : 2.2}
          />
        )}
        {[
          "cu",
          "decoder",
          "memory",
          "instruction-memory",
          "immediate",
        ].includes(unit) && (
          <g
            aria-hidden="true"
            stroke={stroke}
            strokeWidth="1.5"
            opacity=".65"
            data-hardware-pins="true"
          >
            {[0.32, 0.5, 0.68].map((position) => (
              <path
                key={position}
                d={`M${b.x - 7} ${b.y + b.h * position}h7M${b.x + b.w} ${b.y + b.h * position}h7`}
              />
            ))}
          </g>
        )}
        {(unit === "memory" || unit === "instruction-memory") && (
          <rect
            x={b.x + 6}
            y={b.y + sy(6)}
            width={b.w - 12}
            height={b.h - sy(12)}
            rx="4"
            fill="none"
            stroke={stroke}
            strokeOpacity=".4"
            data-memory-bank="true"
          />
        )}
        <text
          x={b.x + b.w / 2}
          y={b.y + sy(unit === "alu" ? 53 : mux ? 33 : 40)}
          textAnchor="middle"
          fontSize={mux ? 26 : 30}
          fontWeight={active ? 800 : 700}
          fill={textColor}
        >
          {TITLES[unit]}
        </text>
        {status && (
          <g data-device-status={status}>
            <rect
              x={b.x + b.w - statusWidth}
              y={b.y - sy(24)}
              width={statusWidth}
              height={sy(28)}
              rx="5"
              fill="var(--ar-flow-token-bg)"
            />
            <text
              x={b.x + b.w - statusWidth / 2}
              y={b.y - sy(4)}
              textAnchor="middle"
              fontSize="18"
              fontWeight="750"
              fill="white"
            >
              {status}
            </text>
          </g>
        )}
        {!mux && (
          <text
            x={b.x + b.w / 2}
            y={b.y + sy(unit === "alu" ? 82 : 66)}
            textAnchor="middle"
            fontSize={unit === "alu" ? 24 : 22}
            fontWeight={unit === "alu" ? 800 : 400}
            fill={textColor}
          >
            {unit === "alu"
              ? flow.jump || flow.system
                ? "연산 경로 비활성"
                : flow.load || flow.store
                  ? `ADD · ${addressFormula}`
                  : lesson.category === "adder"
                    ? `${flow.op.toUpperCase()} · 가산기`
                    : `${flow.op.toUpperCase()} · ${lesson.operator}`
              : unit === "pc" && finished && flow.completed
                ? "다음 명령어 주소"
                : unit === "registers" && flow.store
                  ? "읽은 값을 메모리에 저장"
                  : ROLES[unit]}
          </text>
        )}
        {unit === "registers" && (
          <text
            data-register-width="true"
            x={b.x + b.w / 2}
            y={b.y + sy(91)}
            textAnchor="middle"
            fontSize="18"
            fontWeight="700"
            fill={textColor}
          >
            32 × 32비트 · x0 = 0
          </text>
        )}
        {unit === "alu" && !flow.jump && !flow.system && (
          <rect
            x={b.x + 26}
            y={b.y + sy(163)}
            width={b.w - 52}
            height={sy(34)}
            rx="6"
            fill="var(--ar-flow-result-bg)"
          />
        )}
        {lines[unit].filter(Boolean).map((line, i) => {
          const baseline =
            b.y +
            sy(
              (unit === "registers"
                ? 126
                : unit === "alu"
                  ? 127
                  : mux
                    ? 57
                    : 107) +
                i * 29,
            );
          const overlap =
            packet &&
            packet.x < b.x + b.w &&
            packet.x + packet.w > b.x &&
            packet.y < baseline + 4 &&
            packet.y + packet.h > baseline - 16;
          return (
            <text
              key={i}
              data-alu-equation={
                unit === "alu" && !flow.jump && !flow.system ? i : undefined
              }
              x={b.x + b.w / 2}
              y={baseline}
              textAnchor="middle"
              fontSize={
                unit === "cu" || unit === "pc-select"
                  ? 24
                  : mux
                    ? i === 0
                      ? 22
                      : 28
                    : unit === "registers"
                      ? i === lines[unit].length - 1
                        ? 22
                        : 28
                      : unit === "alu"
                        ? 28
                        : unit === "memory" || unit === "instruction-memory"
                          ? 25
                          : 30
              }
              fontWeight={unit === "alu" && i === 2 ? 800 : 650}
              opacity={overlap ? 0 : 1}
              fill={textColor}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {line}
            </text>
          );
        })}
        {unit === "decoder" && (
          <g data-instruction-fields="true">
            <text
              x={b.x + b.w / 2}
              y={b.y + sy(140)}
              textAnchor="middle"
              fontSize="24"
              fontWeight="700"
              fill={textColor}
            >
              {decoded
                ? `${decoded.format}\uD615 \u00b7 opcode ${decoded.opcode}`
                : "\uAE30\uACC4\uC5B4 \uBBF8\uC81C\uACF5"}
            </text>
            <text
              x={b.x + b.w / 2}
              y={b.y + sy(166)}
              textAnchor="middle"
              fontSize="23"
              fontWeight="700"
              fill={textColor}
            >
              {specialEncoding
                ? "SYSTEM / FENCE"
                : decoded
                  ? [
                      decoded.rd == null ? "" : `rd x${decoded.rd}`,
                      decoded.rs1 == null ? "" : `rs1 x${decoded.rs1}`,
                      decoded.rs2 == null ? "" : `rs2 x${decoded.rs2}`,
                      decoded.shamt != null
                        ? `shamt ${decoded.shamt}`
                        : decoded.immediate == null
                          ? ""
                          : `imm ${decoded.immediate}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "필드 정보 미제공"}
            </text>
          </g>
        )}
      </g>
    );
  };
  return (
    <div
      className="ar-single-flow flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden"
      style={
        {
          "--ar-flow-token-bg": `var(--ar-flow-${transfer.kind}-token)`,
        } as CSSProperties
      }
    >
      <div
        className="mx-3 mb-2 shrink-0 rounded-lg border-l-4 bg-[var(--ar-header-bg)] px-3 py-2.5"
        style={{ borderLeftColor: color }}
        aria-label="현재 장치 동작"
        data-transfer={transfer.id}
      >
        <p className="text-sm font-bold text-[var(--ar-text-primary)]">
          {finished
            ? completionLabel
            : `${index + 1} / ${count} · ${transfer.title}`}
        </p>
        <p
          className="mt-1 break-words font-mono text-sm font-semibold"
          style={{ color }}
          data-transfer-value="true"
        >
          {finished && flow.completed
            ? `실행 PC ${flow.pc ?? "미제공"} → 다음 PC ${flow.nextPc ?? "미제공"}`
            : transfer.value == null
              ? "미제공"
              : transfer.kind === "address" ||
                  transfer.id === "fetch-instruction" ||
                  transfer.id === "decode-immediate"
                ? transfer.value
                : displayValue(transfer.value)}
        </p>
        <p
          className="mt-1 text-[13px] leading-relaxed text-[var(--ar-text-secondary)]"
          data-operation-description="true"
        >
          {finished
            ? flow.completed
              ? "레지스터와 메모리의 실행 결과를 유지합니다. 다시 보기로 이 명령어의 처리 과정을 확인할 수 있습니다."
              : "설명 재생이 끝났습니다. 확인되지 않은 실행 결과는 표시하지 않습니다."
            : detailText}
        </p>
        {finished && executionStatus && (
          <p
            className="mt-1 text-xs font-semibold"
            data-execution-status={executionStatus}
          >
            {executionStatus === "COMPLETED"
              ? "프로그램 실행 완료 · 서버 확인"
              : executionStatus === "CYCLE_LIMIT"
                ? "최대 클록 수 도달 · 실행 중단"
                : "시뮬레이션 오류 · 실행 중단"}
          </p>
        )}
      </div>
      <div ref={area} className="min-h-0 flex-1 overflow-hidden">
        <svg
          viewBox={
            compact
              ? `-210 ${sy(110)} 1470 ${sy(1298)}`
              : `-210 ${sy(110)} 1830 ${sy(970)}`
          }
          preserveAspectRatio="xMidYMin meet"
          className="ar-single-flow-diagram block h-full w-full font-sans"
          role="group"
          aria-label="CPU 내부 장치와 메모리·버스의 싱글 사이클 구조"
          data-layout="hardware-architecture"
          data-layout-compact={compact}
        >
          <defs>
            {Object.entries(COLORS).map(([kind, stroke]) => (
              <marker
                key={kind}
                id={`${id}-${kind}`}
                viewBox="0 0 10 10"
                refX="8.5"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0 1.2L9 5L0 8.8Z" fill={stroke} />
              </marker>
            ))}
            <marker
              id={`${id}-inactive`}
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path d="M0 1.2L9 5L0 8.8Z" fill="var(--ar-flow-wire)" />
            </marker>
          </defs>
          <rect
            x="-110"
            y={sy(130)}
            width="1176"
            height={sy(920)}
            rx="24"
            fill="var(--ar-flow-region-bg)"
            stroke="var(--ar-flow-region-border)"
            strokeWidth="3.5"
            data-hardware-region="cpu"
          />
          <g
            data-cpu-package="true"
            aria-hidden="true"
            stroke="var(--ar-flow-region-border)"
            strokeWidth="2"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <path
                key={i}
                d={`M${-40 + i * 90} ${sy(118)}v${sy(12)}M${-40 + i * 90} ${sy(1050)}v${sy(12)}M-122 ${sy(205 + i * 68)}h12M1066 ${sy(205 + i * 68)}h12`}
              />
            ))}
          </g>
          <rect
            x="-100"
            y={sy(135)}
            width="300"
            height={sy(32)}
            rx="4"
            fill="var(--ar-flow-region-heading-bg)"
          />
          <text
            x="-90"
            y={sy(157)}
            fontSize="26"
            fontWeight="800"
            fill="var(--ar-text-primary)"
          >
            CPU · 내부 회로
          </text>
          <rect
            x={compact ? 16 : 1180}
            y={sy(compact ? 1120 : 130)}
            width={compact ? 1050 : 365}
            height={sy(compact ? 285 : 920)}
            rx="16"
            fill="var(--ar-flow-region-bg)"
            stroke="var(--ar-flow-region-border)"
            strokeWidth="3.5"
            data-hardware-region="memory"
          />
          <rect
            x={compact ? 25 : 1190}
            y={sy(compact ? 1127 : 137)}
            width={compact ? 350 : 345}
            height={sy(32)}
            rx="4"
            fill="var(--ar-flow-region-heading-bg)"
          />
          <text
            x={compact ? 35 : 1200}
            y={sy(compact ? 1147 : 157)}
            fontSize="24"
            fontWeight="800"
            fill="var(--ar-text-primary)"
          >
            Memory · CPU 외부
          </text>
          {WIRES.map((wire) => (
            <g
              key={wire.key}
              data-circuit-wire={wire.key}
              data-memory-connection={wire.system || undefined}
              data-wire-visible={showWire(wire.key)}
              opacity={showWire(wire.key) ? 1 : 0}
              aria-hidden="true"
            >
              <path
                d={paths[wire.key]}
                fill="none"
                stroke="var(--ar-flow-wire)"
                strokeWidth={wire.system ? 2.8 : 2}
                strokeDasharray={wire.kind === "control" ? "6 5" : undefined}
                strokeLinejoin="round"
                markerEnd={`url(#${id}-inactive)`}
              />
            </g>
          ))}
          {!finished && path && (
            <g data-flow-route={transfer.id} data-active="true">
              <path
                d={path}
                fill="none"
                stroke="var(--ar-panel-bg)"
                strokeWidth="6"
                strokeLinejoin="round"
              />
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeOpacity=".2"
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              <path
                className="flow-arrow-stream"
                data-flow-stream="true"
                d={path}
                fill="none"
                stroke={color}
                strokeWidth="2.8"
                strokeDasharray={transfer.kind === "control" ? "6 5" : "8 5"}
                strokeDashoffset={-progress * motion.distance}
                strokeLinejoin="round"
                markerEnd={`url(#${id}-${transfer.kind})`}
              />
            </g>
          )}
          {(Object.keys(BOXES) as TransferUnit[]).map(node)}
          <g
            data-bus-legend="true"
            aria-label="현재 전송의 주소·데이터·제어 종류"
          >
            <text
              x={compact ? 35 : 1220}
              y={sy(compact ? 1080 : 515)}
              fontSize="25"
              fontWeight="800"
              fill="var(--ar-text-primary)"
            >
              전송 신호·버스 구분
            </text>
            {(["address", "data", "control"] as const).map((kind, i) => {
              const busActive = Boolean(
                !finished && path && transfer.kind === kind,
              );
              return (
                <g
                  key={kind}
                  data-system-bus-label={kind}
                  data-bus-active={busActive}
                >
                  {busActive && (
                    <rect
                      x={compact ? 25 + i * 340 : 1195}
                      y={sy(compact ? 1084 : 535 + i * 46)}
                      width={330}
                      height={sy(34)}
                      rx="4"
                      fill={`color-mix(in srgb, ${COLORS[kind]} 8%, var(--ar-panel-bg))`}
                    />
                  )}
                  <path
                    d={
                      compact
                        ? `M${35 + i * 340} ${sy(1100)}h28`
                        : `M1205 ${sy(550 + i * 46)}H1240`
                    }
                    stroke={busActive ? COLORS[kind] : "var(--ar-flow-wire)"}
                    strokeWidth={busActive ? 7 : kind === "control" ? 4 : 6}
                    strokeDasharray={kind === "control" ? "5 4" : undefined}
                  />
                  <text
                    x={compact ? 75 + i * 340 : 1255}
                    y={sy(compact ? 1106 : 557 + i * 46)}
                    fontSize="26"
                    fontWeight={busActive ? 800 : 600}
                    fill={busActive ? COLORS[kind] : "var(--ar-text-muted)"}
                  >
                    {kind === "address"
                      ? "Address Bus"
                      : kind === "data"
                        ? "Data Bus"
                        : "Control Bus"}
                  </text>
                </g>
              );
            })}
          </g>

          {point && packet && (
            <g className="flow-token">
              <g
                className={
                  transfer.kind === "control"
                    ? "flow-control-word flow-packet"
                    : "flow-data-word flow-packet"
                }
                data-label-kind={transfer.kind}
                data-moving-value={motion.value}
                data-packet-x={point.x}
                data-packet-y={point.y}
                aria-label={`이동 중인 ${transfer.kind === "control" ? "선택·제어 정보" : "값"} ${motion.value}`}
              >
                <rect
                  data-flow-marker="true"
                  x={packet.x}
                  y={packet.y}
                  width={packet.w}
                  height={packet.h}
                  rx="6"
                  fill={
                    transfer.kind === "control"
                      ? "var(--ar-panel-bg)"
                      : "var(--ar-flow-token-bg)"
                  }
                  stroke={
                    transfer.kind === "control" ? color : "var(--ar-panel-bg)"
                  }
                  strokeWidth="1.8"
                  strokeDasharray={
                    transfer.kind === "control" ? "5 3" : undefined
                  }
                />
                <text
                  x={point.x}
                  y={point.y + 10}
                  textAnchor="middle"
                  fontSize="32"
                  fontWeight="750"
                  className="font-mono"
                  fill={transfer.kind === "control" ? color : "#fff"}
                >
                  {motion.value}
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
