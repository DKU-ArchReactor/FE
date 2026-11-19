import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
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

type Flow = ReturnType<typeof buildInstructionFlow>;
type Box = { x: number; y: number; w: number; h: number };
const COLORS = { address: "#bc700a", data: "#087fce", control: "#8951ce" };
const BOXES: Record<TransferUnit, Box> = {
  pc: { x: 55, y: 175, w: 190, h: 120 },
  decoder: { x: 335, y: 175, w: 490, h: 180 },
  registers: { x: 35, y: 390, w: 280, h: 210 },
  immediate: { x: 415, y: 390, w: 190, h: 125 },
  cu: { x: 690, y: 390, w: 270, h: 180 },
  "operand-mux": { x: 420, y: 625, w: 210, h: 100 },
  alu: { x: 710, y: 625, w: 300, h: 205 },
  mux: { x: 420, y: 865, w: 210, h: 100 },
  "pc-select": { x: 55, y: 865, w: 240, h: 180 },
  "instruction-memory": { x: 1200, y: 230, w: 320, h: 210 },
  memory: { x: 1200, y: 705, w: 320, h: 210 },
};
const TITLES: Record<TransferUnit, string> = {
  pc: "PC",
  decoder: "명령어 해독",
  cu: "CU",
  registers: "레지스터 파일",
  immediate: "Imm Gen",
  "operand-mux": "입력 MUX",
  alu: "ALU",
  mux: "기록값 MUX",
  "pc-select": "PC 가산·선택",
  "instruction-memory": "명령어 메모리",
  memory: "데이터 메모리",
};
const ROLES: Record<TransferUnit, string> = {
  pc: "명령어 주소",
  decoder: "opcode 연산 · rd 기록 · rs1/rs2 읽기",
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
}: {
  flow: Flow;
  transfer: InstructionTransfer;
  progress: number;
  index: number;
  count: number;
  arrived: string[];
  onUnit: (unit: TransferUnit) => void;
  onInspect: (unit: "alu" | "pc-select" | "decoder") => void;
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
          (height * (compact ? 1470 : 1830)) /
            (width * (compact ? 1408 : 1080)),
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
  const point = motion.route
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
  const color = COLORS[transfer.kind];
  const reached = (key: string) =>
    arrived.includes(key) || (transfer.id === key && progress >= 0.95);
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
    pc: [flow.pc?.replace(/^0x0+(?=[\da-f])/i, "0x") ?? "미제공"],
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
        : "레지스터 기록 없음",
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
      ? ["PC ????", "?? ?????"]
      : flow.system
        ? ["환경 요청", "ALU 사용 안 함"]
        : [
            `A ${!flow.pcRelative && !flow.registerInputs.length ? short(flow.input1) : reached("input-a") ? short(flow.input1) : "입력 대기"}`,
            `B ${reached("mux-to-alu") ? (flow.amount == null ? short(flow.input2) : `${flow.amount}비트 이동`) : "입력 대기"}`,
            flow.branch
              ? `비교 ${reached("calculate") ? (flow.taken == null ? "미제공" : flow.taken ? "성립" : "불성립") : "대기"}`
              : `→ ${reached("calculate") ? short(flow.result) : "계산 대기"}`,
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
      `${flow.op.toUpperCase()} · 32비트 명령어`,
      flow.raw ?? "기계어 미제공",
      "해독 회로에 명령어 전달",
    ],
    memory:
      flow.load || flow.store
        ? [
            `주소 ${reached("memory-address") ? (flow.address ?? "미제공") : "전달 대기"}`,
            `${flow.width / 8}바이트 ${flow.load ? "읽기" : "쓰기"}`,
            `${flow.store ? (storeName ?? "rs2") : "값"} ${reached("load-data") || reached("store-data") || reached("discard-load") ? `→ ${short(flow.memoryValue)}` : "전달 대기"}`,
            flow.error
              ? "접근 오류 · 성공값 미표시"
              : flow.load && flow.width < 32
                ? /^(lb|lh)$/.test(flow.op)
                  ? "부호 확장 → 32비트"
                  : "0 확장 → 32비트"
                : "32비트 데이터 경로",
          ]
        : [
            "이번 명령어는 접근 안 함",
            "메모리 읽기·쓰기 없음",
            "계산은 레지스터에서",
            "Load / Store에서 사용",
          ],
  };
  const node = (unit: TransferUnit) => {
    const b = boxes[unit],
      active = transfer.source === unit || transfer.target === unit;
    const status =
      transfer.source === unit && transfer.target === unit
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
    const stroke = active
      ? color
      : unit === "registers"
        ? "#169b80"
        : unit === "cu" || unit === "decoder"
          ? "#9165c3"
          : "#64839e";
    const shape = mux
      ? `M${b.x} ${b.y}H${b.x + b.w}L${b.x + b.w - 18} ${b.y + b.h}H${b.x + 18}Z`
      : unit === "alu"
        ? `M${b.x} ${b.y}H${b.x + b.w / 2 - 25}L${b.x + b.w / 2} ${b.y + sy(15)}L${b.x + b.w / 2 + 25} ${b.y}H${b.x + b.w}L${b.x + b.w - 24} ${b.y + b.h}H${b.x + 24}Z`
        : undefined;
    const fill = active
      ? `color-mix(in srgb, ${color} 8%, var(--ar-panel-bg))`
      : "var(--ar-panel-bg)";
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
            fill="var(--ar-panel-bg)"
            stroke={stroke}
          />
        )}
        {shape ? (
          <path
            d={shape}
            fill={fill}
            stroke={stroke}
            strokeWidth={active ? 3 : 1.5}
          />
        ) : (
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="8"
            fill={fill}
            stroke={stroke}
            strokeWidth={active ? 3 : 1.5}
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
        <text
          x={b.x + b.w / 2}
          y={b.y + sy(unit === "alu" ? 53 : mux ? 33 : 40)}
          textAnchor="middle"
          fontSize={mux ? 26 : 30}
          fontWeight="800"
          fill="var(--ar-text-primary)"
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
              fill={color}
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
            fontSize={22}
            fill="var(--ar-text-muted)"
          >
            {unit === "alu"
              ? flow.load || flow.store
                ? `주소 = ${addressFormula}`
                : lesson.category === "adder"
                  ? `가산기 · A ${lesson.operator} B`
                  : lesson.unit
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
            fill={stroke}
          >
            32 × 32비트 · x0 = 0
          </text>
        )}
        {lines[unit].map((line, i) => {
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
                      ? 28
                      : 30
              }
              fontWeight="650"
              opacity={overlap ? 0 : 1}
              fill="var(--ar-text-primary)"
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
              fill="var(--ar-text-primary)"
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
              fill={COLORS.control}
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
    <div ref={area} className="h-full min-h-0 w-full min-w-0 overflow-hidden">
      <svg
        viewBox={
          compact ? `-210 0 1470 ${sy(1408)}` : `-210 0 1830 ${sy(1080)}`
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
              viewBox="0 0 12 12"
              refX="10"
              refY="6"
              markerWidth="9"
              markerHeight="9"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path d="M0 0L11 6L0 12Z" fill={stroke} />
            </marker>
          ))}
        </defs>
        <rect
          x="-110"
          y={sy(130)}
          width="1176"
          height={sy(920)}
          rx="16"
          fill="var(--ar-header-bg)"
          stroke="var(--ar-border)"
          strokeWidth="2"
          data-hardware-region="cpu"
        />
        <text
          x="-90"
          y={sy(157)}
          fontSize="20"
          fontWeight="800"
          fill="var(--ar-text-primary)"
        >
          CPU · 칩 내부 장치
        </text>
        <rect
          x={compact ? 16 : 1180}
          y={sy(compact ? 1120 : 130)}
          width={compact ? 1050 : 365}
          height={sy(compact ? 285 : 920)}
          rx="16"
          fill="var(--ar-header-bg)"
          stroke="var(--ar-border)"
          strokeWidth="2"
          data-hardware-region="memory"
        />
        <text
          x={compact ? 35 : 1200}
          y={sy(compact ? 1147 : 157)}
          fontSize="20"
          fontWeight="800"
          fill="var(--ar-text-primary)"
        >
          메모리 · CPU 외부
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
              stroke={COLORS[wire.kind]}
              strokeOpacity=".19"
              strokeWidth={wire.system ? 5 : 2.5}
              strokeDasharray={wire.kind === "control" ? "6 5" : undefined}
              strokeLinejoin="round"
            />
          </g>
        ))}
        {path && (
          <g data-flow-route={transfer.id} data-active="true">
            <path
              d={path}
              fill="none"
              stroke="var(--ar-panel-bg)"
              strokeWidth="10"
              strokeLinejoin="round"
            />
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={transfer.kind === "control" ? 3.5 : 5}
              strokeDasharray={transfer.kind === "control" ? "6 5" : undefined}
              strokeLinejoin="round"
              markerEnd={`url(#${id}-${transfer.kind})`}
            />
          </g>
        )}
        {(Object.keys(BOXES) as TransferUnit[]).map(node)}
        <g
          data-bus-legend="true"
          aria-label="CPU와 메모리를 연결하는 주소·데이터·제어 경로"
        >
          <text
            x={compact ? 35 : 1200}
            y={sy(compact ? 1080 : 515)}
            fontSize="19"
            fontWeight="800"
            fill="var(--ar-text-primary)"
          >
            CPU ↔ 메모리 연결
          </text>
          {(["address", "data", "control"] as const).map((kind, i) => (
            <g key={kind} data-system-bus-label={kind}>
              <path
                d={
                  compact
                    ? `M${35 + i * 340} ${sy(1100)}h28`
                    : `M1205 ${sy(550 + i * 36)}H1240`
                }
                stroke={COLORS[kind]}
                strokeWidth={kind === "control" ? 2.5 : 5}
                strokeDasharray={kind === "control" ? "5 4" : undefined}
              />
              <text
                x={compact ? 75 + i * 340 : 1255}
                y={sy(compact ? 1106 : 556 + i * 36)}
                fontSize={compact ? 15 : 17}
                fontWeight="700"
                fill={COLORS[kind]}
              >
                {kind === "address"
                  ? "Address Bus · 주소"
                  : kind === "data"
                    ? "Data Bus · 값·명령어"
                    : "Control Bus · 읽기·쓰기"}
              </text>
            </g>
          ))}
        </g>
        <g aria-label="현재 장치 동작" data-transfer={transfer.id}>
          <rect
            x="16"
            y={sy(10)}
            width={compact ? 1140 : 1528}
            height={sy(94)}
            rx="12"
            fill="var(--ar-header-bg)"
            stroke={color}
            strokeWidth="1.5"
          />
          <text x="36" y={sy(36)} fontSize="19" fontWeight="800" fill={color}>
            {index + 1} / {count} · {transfer.title}
          </text>
          <text
            x="36"
            y={sy(67)}
            fontSize="23"
            fontWeight="750"
            fill="var(--ar-text-primary)"
            data-transfer-value="true"
          >
            {transfer.value == null
              ? "미제공"
              : transfer.kind === "address" ||
                  transfer.id === "fetch-instruction" ||
                  transfer.id === "decode-immediate"
                ? transfer.value
                : displayValue(transfer.value)}
          </text>
          <text x="36" y={sy(91)} fontSize="16" fill="var(--ar-text-muted)">
            {detailText}
          </text>
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
                  transfer.kind === "control" ? "var(--ar-panel-bg)" : color
                }
                stroke={
                  transfer.kind === "control" ? color : "var(--ar-panel-bg)"
                }
                strokeWidth="1.8"
                strokeDasharray={
                  transfer.kind === "control" ? "5 3" : undefined
                }
                style={{ filter: "drop-shadow(0 2px 3px rgb(0 0 0 / .12))" }}
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
  );
}
