import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  displayValue,
  numericPc,
  registerLabel,
  instructionFields,
  instructionPaths,
  pointOnTransfer,
  transferMotion,
  type TransferUnit,
  type InstructionTransfer,
  type buildInstructionFlow,
} from "../utils/instructionFlow";

type Flow = ReturnType<typeof buildInstructionFlow>;
type Box = { x: number; y: number; w: number; h: number };
const COLORS = { address: "#bc700a", data: "#087fce", control: "#8951ce" };
const BOXES: Record<TransferUnit, Box> = {
  pc: { x: 55, y: 165, w: 160, h: 80 },
  decoder: { x: 300, y: 165, w: 450, h: 130 },
  cu: { x: 580, y: 340, w: 245, h: 135 },
  registers: { x: 55, y: 340, w: 260, h: 155 },
  immediate: { x: 360, y: 340, w: 180, h: 100 },
  "operand-mux": { x: 350, y: 515, w: 180, h: 80 },
  alu: { x: 585, y: 520, w: 240, h: 140 },
  mux: { x: 350, y: 660, w: 180, h: 85 },
  "pc-select": { x: 55, y: 640, w: 205, h: 135 },
  "instruction-memory": { x: 1050, y: 165, w: 300, h: 145 },
  memory: { x: 1050, y: 510, w: 300, h: 200 },
};
const TITLES: Record<TransferUnit, string> = {
  pc: "PC",
  decoder: "명령어 해독",
  cu: "CU · 제어 장치",
  registers: "레지스터 파일",
  immediate: "Imm Gen",
  "operand-mux": "입력 MUX",
  alu: "ALU · 연산 장치",
  mux: "기록값 MUX",
  "pc-select": "다음 주소 회로",
  "instruction-memory": "명령어 메모리",
  memory: "데이터 메모리",
};
const ROLES: Record<TransferUnit, string> = {
  pc: "읽을 명령어 주소 보관",
  decoder: "opcode 연산 · rd 기록 · rs1/rs2 읽기",
  cu: "계산·읽기·쓰기를 제어",
  registers: "계산에 쓸 값을 가까이 보관",
  immediate: "명령어 속 상수를 구성",
  "operand-mux": "ALU의 두 번째 입력 선택",
  alu: "입력 선택 · 계산 · 조건 비교",
  mux: "레지스터에 쓸 결과 선택",
  "pc-select": "주소 계산 + PC 선택 MUX",
  "instruction-memory": "주소에 해당하는 명령어 반환",
  memory: "주소를 받아 데이터를 읽거나 저장",
};
const short = (value?: string | null) => displayValue(value).split(" · ")[0];
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
  { key: "pc-alu", kind: "address" },
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
}: {
  flow: Flow;
  transfer: InstructionTransfer;
  progress: number;
  index: number;
  count: number;
  arrived: string[];
  onUnit: (unit: TransferUnit) => void;
}) {
  const id = useId().replace(/:/g, "");
  const area = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    const measure = (width: number, height: number) => {
      if (width && height) setCompact(width / height < 1.25);
    };
    const bounds = element.getBoundingClientRect();
    measure(bounds.width, bounds.height);
    const observer = new ResizeObserver(([entry]) =>
      measure(entry.contentRect.width, entry.contentRect.height),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const boxes = compact
    ? {
        ...BOXES,
        "instruction-memory": { ...BOXES["instruction-memory"], x: 55, y: 930 },
        memory: { ...BOXES.memory, x: 550, y: 930 },
      }
    : BOXES;
  const paths = useMemo(
    () => instructionPaths(flow, 1, compact),
    [flow, compact],
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
    ? { x: point.x - motion.width / 2, y: point.y - 14, w: motion.width, h: 28 }
    : undefined;
  const color = COLORS[transfer.kind];
  const reached = (key: string) =>
    arrived.includes(key) || (transfer.id === key && progress >= 0.95);
  const decoded = instructionFields(flow.raw);
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
    pc: [flow.pc ?? "미제공"],
    decoder: [flow.raw ?? "기계어 미제공"],
    cu: [
      `ALU: ${flow.system ? "사용 안 함" : flow.load || flow.store ? "ADD · 주소 계산" : flow.op.toUpperCase()}`,
      `RegWrite ${signal(flow.controlSignals?.reg_write)}`,
      `MemRead ${signal(flow.controlSignals?.mem_read)} · MemWrite ${signal(flow.controlSignals?.mem_write)}`,
    ],
    registers: [
      ...flow.registerInputs.map(
        (input) => `${registerLabel(input.name)}: ${short(input.value)}`,
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
    alu: flow.system
      ? ["실행 환경 서비스 요청", "일반 ALU 계산 없음"]
      : [
          `A ${!flow.pcRelative && !flow.registerInputs.length ? short(flow.input1) : reached("input-a") ? short(flow.input1) : "입력 대기"}`,
          `B ${reached("mux-to-alu") ? (flow.amount == null ? short(flow.input2) : `${flow.amount}비트 이동`) : "입력 대기"}`,
          flow.branch
            ? `비교 ${reached("calculate") ? (flow.taken == null ? "미제공" : flow.taken ? "성립" : "불성립") : "대기"}`
            : `결과 ${reached("calculate") ? short(flow.result) : "계산 대기"}`,
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
      `PC+4 ${pcPlusFour}`,
      `다음 ${reached("next-pc") ? (flow.nextPc ?? "미제공") : "선택 대기"}`,
    ],
    "instruction-memory": [
      `주소 ${flow.pc ?? "미제공"}`,
      `명령 ${flow.op.toUpperCase()}`,
      flow.raw ?? "기계어 미제공",
    ],
    memory:
      flow.load || flow.store
        ? [
            `주소 ${reached("memory-address") ? (flow.address ?? "미제공") : "전달 대기"}`,
            `${flow.width / 8}바이트 ${flow.load ? "읽기" : "쓰기"}`,
            `값 ${reached("load-data") || reached("store-data") || reached("discard-load") ? short(flow.memoryValue) : "전달 대기"}`,
            flow.error
              ? "접근 오류 · 성공값 미표시"
              : flow.load && flow.width < 32
                ? /^(lb|lh)$/.test(flow.op)
                  ? "부호 확장 후 32비트 기록"
                  : "0 확장 후 32비트 기록"
                : "32비트 데이터 경로",
          ]
        : ["이번 명령어는 접근 안 함", "계산 명령은 레지스터 사용"],
  };
  const node = (unit: TransferUnit) => {
    const b = boxes[unit],
      active = transfer.source === unit || transfer.target === unit;
    const status =
      transfer.source === unit && transfer.target === unit
        ? "처리 중"
        : transfer.source === unit
          ? "출발"
          : transfer.target === unit
            ? "도착"
            : "";
    const mux = unit === "mux" || unit === "operand-mux";
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
        ? `M${b.x} ${b.y}H${b.x + 95}L${b.x + 120} ${b.y + 15}L${b.x + 145} ${b.y}H${b.x + b.w}L${b.x + b.w - 24} ${b.y + b.h}H${b.x + 24}Z`
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
        onClick={() => onUnit(unit)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onUnit(unit);
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
            y={b.y - 5}
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
        <text
          x={b.x + b.w / 2}
          y={b.y + (mux ? 21 : 27)}
          textAnchor="middle"
          fontSize={mux ? 18 : 22}
          fontWeight="800"
          fill="var(--ar-text-primary)"
        >
          {TITLES[unit]}
        </text>
        {status && (
          <g data-device-status={status}>
            <rect
              x={b.x + b.w - 58}
              y={b.y - 19}
              width="58"
              height="23"
              rx="5"
              fill={color}
            />
            <text
              x={b.x + b.w - 29}
              y={b.y - 3}
              textAnchor="middle"
              fontSize="14"
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
            y={b.y + 48}
            textAnchor="middle"
            fontSize={unit === "immediate" ? 13 : 15}
            fill="var(--ar-text-muted)"
          >
            {ROLES[unit]}
          </text>
        )}
        {unit === "registers" && (
          <text
            x={b.x + 14}
            y={b.y + 72}
            fontSize="13"
            fontWeight="700"
            fill={stroke}
          >
            32 × 32비트 · x0 = 0
          </text>
        )}
        {lines[unit].map((line, i) => {
          const baseline =
            b.y +
            (unit === "registers" ? 95 : mux ? 43 : unit === "pc" ? 69 : 75) +
            i * (mux ? 21 : 23);
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
                unit === "cu" || unit === "pc-select" ? 16 : mux ? 15 : 18
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
              y={b.y + 99}
              textAnchor="middle"
              fontSize="15"
              fontWeight="700"
              fill="var(--ar-text-primary)"
            >
              {decoded
                ? `${decoded.format}형 · opcode ${decoded.opcode}${decoded.funct3 == null ? "" : ` · funct3 ${decoded.funct3}`}${decoded.funct7 == null ? "" : ` · funct7 ${decoded.funct7}`}`
                : "기계어가 있어야 비트 필드를 해독합니다"}
            </text>
            <text
              x={b.x + b.w / 2}
              y={b.y + 121}
              textAnchor="middle"
              fontSize="17"
              fontWeight="700"
              fill={COLORS.control}
            >
              {decoded
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
        viewBox={compact ? "-120 0 1120 1220" : "-80 0 1480 880"}
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
          x="16"
          y="120"
          width="850"
          height="698"
          rx="16"
          fill="var(--ar-header-bg)"
          stroke="var(--ar-border)"
          strokeWidth="2"
          data-hardware-region="cpu"
        />
        <text
          x="35"
          y="147"
          fontSize="20"
          fontWeight="800"
          fill="var(--ar-text-primary)"
        >
          CPU · 칩 내부 장치
        </text>
        <rect
          x={compact ? 16 : 1030}
          y={compact ? 890 : 120}
          width={compact ? 850 : 345}
          height={compact ? 285 : 698}
          rx="16"
          fill="var(--ar-header-bg)"
          stroke="var(--ar-border)"
          strokeWidth="2"
          data-hardware-region="memory"
        />
        <text
          x={compact ? 35 : 1050}
          y={compact ? 917 : 147}
          fontSize="20"
          fontWeight="800"
          fill="var(--ar-text-primary)"
        >
          메모리 · CPU 밖의 논리 영역
        </text>
        {WIRES.map((wire) => (
          <g
            key={wire.key}
            data-circuit-wire={wire.key}
            data-memory-connection={wire.system || undefined}
          >
            <path
              d={paths[wire.key]}
              fill="none"
              stroke={COLORS[wire.kind]}
              strokeOpacity=".25"
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
            x={compact ? 35 : 1050}
            y={compact ? 845 : 365}
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
                    ? `M${35 + i * 280} 866h28`
                    : `M1055 ${393 + i * 34}H1090`
                }
                stroke={COLORS[kind]}
                strokeWidth={kind === "control" ? 2.5 : 5}
                strokeDasharray={kind === "control" ? "5 4" : undefined}
              />
              <text
                x={compact ? 75 + i * 280 : 1105}
                y={compact ? 871 : 399 + i * 34}
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
            y="10"
            width={compact ? 930 : 1359}
            height="94"
            rx="12"
            fill="var(--ar-header-bg)"
            stroke={color}
            strokeWidth="1.5"
          />
          <text x="36" y="36" fontSize="19" fontWeight="800" fill={color}>
            {index + 1} / {count} · {transfer.title}
          </text>
          <text
            x="36"
            y="67"
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
          <text x="36" y="91" fontSize="16" fill="var(--ar-text-muted)">
            {transfer.detail}
          </text>
          <text
            x={compact ? 924 : 1352}
            y="35"
            textAnchor="end"
            fontSize="16"
            fontWeight="700"
            fill={color}
            visibility={compact ? "hidden" : "visible"}
          >
            {TITLES[transfer.target]}
          </text>
        </g>
        <text
          x="28"
          y={compact ? 1195 : 844}
          fontSize="15"
          fill="var(--ar-text-muted)"
        >
          하버드형 교육 모델 · 명령어/데이터 경로 분리 · 해독·주소 계산 회로는
          기능별로 묶어 표시
        </text>
        <text
          x="28"
          y={compact ? 1218 : 868}
          fontSize="15"
          fill="var(--ar-text-muted)"
        >
          한 클록 내부 동작을 느리게 재생합니다. 실제 칩 배치·버스 중재·전파
          시간을 재현한 그림은 아닙니다.
        </text>
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
                y={point.y + 6}
                textAnchor="middle"
                fontSize="18"
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
