import { useId } from "react";
import {
  displayValue,
  registerLabel,
  transferPoint,
  type TransferUnit,
  type InstructionTransfer,
  type buildInstructionFlow,
} from "../utils/instructionFlow";

type Flow = ReturnType<typeof buildInstructionFlow>;
type Box = { x: number; y: number; w: number; h: number };
const COLORS = { address: "#d17a09", data: "#087fce", control: "#9860dc" };
const NODES = {
  pc: "#ec5478",
  registers: "#00a981",
  alu: "#ed9300",
  memory: "#009dd8",
  cu: "#a45de4",
  immediate: "#009dd8",
};
const short = (value?: string | null) => displayValue(value).split(" · ")[0];

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
  const paths: Record<string, string> = {
    "fetch-address": "M360 202V235",
    "fetch-instruction": "M515 273H670V365",
    "read-control": "M580 420H550V345H225V380",
    "input-a": flow.pcRelative
      ? "M260 167H38V550H290V570"
      : "M145 490V540H290V570",
    "input-b": flow.usesImmediate ? "M440 470V570" : "M240 490V510H440V570",
    "memory-address": "M360 680V730",
    "memory-control": "M760 420H770V775H500",
    "store-data": "M140 490V775H220",
    "load-data": "M360 820V908H24V435H55",
    writeback: flow.jump
      ? "M460 167H748V838H420V882H370V908H24V435H55"
      : "M300 680V700H190V838H330V882H370V908H24V435H55",
    "next-pc": "M700 365V167H460",
  };
  const isFetch =
    transfer.id === "fetch-address" || transfer.id === "fetch-instruction";
  const reached = (key: string) =>
    arrived.includes(key) || (transfer.id === key && progress >= 0.95);
  const path = paths[transfer.id];
  const point = path ? transferPoint(path, progress) : undefined;
  const color = COLORS[transfer.kind];
  const payload =
    transfer.value == null
      ? "미제공"
      : transfer.kind === "address" || transfer.id === "fetch-instruction"
        ? transfer.value
        : displayValue(transfer.value);
  const tag = (unit: TransferUnit, instructionMemory = false) => {
    if (unit === "memory" && instructionMemory !== isFetch) return "";
    return transfer.source === unit && transfer.target === unit
      ? "처리 중"
      : transfer.source === unit
        ? "출발"
        : transfer.target === unit
          ? "도착"
          : "";
  };
  const boxes = {
    pc: { x: 260, y: 132, w: 200, h: 70 },
    instruction: { x: 205, y: 235, w: 310, h: 76 },
    registers: { x: 55, y: 380, w: 250, h: 110 },
    immediate: { x: 350, y: 380, w: 180, h: 90 },
    cu: { x: 580, y: 365, w: 180, h: 108 },
    alu: { x: 220, y: 570, w: 280, h: 110 },
    memory: { x: 220, y: 730, w: 280, h: 90 },
  } satisfies Record<string, Box>;
  const node = (
    unit: TransferUnit,
    box: Box,
    title: string,
    lines: string[],
    instructionMemory = false,
  ) => {
    const status = tag(unit, instructionMemory),
      active = Boolean(status);
    const stroke = active ? color : NODES[unit];
    const shape =
      unit === "alu"
        ? "M220 570H337L360 590L383 570H500L456 680H264Z"
        : undefined;
    return (
      <g
        role="button"
        tabIndex={0}
        data-flow-node={instructionMemory ? "instruction-memory" : unit}
        data-x={box.x}
        data-y={box.y}
        data-width={box.w}
        data-height={box.h}
        aria-label={`${title} 흐름 선택`}
        onClick={() => onUnit(instructionMemory ? "cu" : unit)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onUnit(instructionMemory ? "cu" : unit);
          }
        }}
        className="cursor-pointer outline-none focus-visible:drop-shadow-md"
      >
        {shape ? (
          <path
            d={shape}
            fill={active ? "var(--ar-header-bg)" : "var(--ar-panel-bg)"}
            stroke={stroke}
            strokeWidth={active ? 3 : 1.8}
          />
        ) : (
          <rect
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            rx="10"
            fill={active ? "var(--ar-header-bg)" : "var(--ar-panel-bg)"}
            stroke={stroke}
            strokeWidth={active ? 3 : 1.8}
          />
        )}
        <text
          x={box.x + box.w / 2}
          y={box.y + (shape ? 42 : 25)}
          textAnchor="middle"
          fontSize="19"
          fontWeight="650"
          fill="var(--ar-text-primary)"
        >
          {title}
        </text>
        {status && (
          <text
            x={box.x + box.w - (shape ? 24 : 12)}
            y={box.y + (shape ? 34 : 24)}
            textAnchor="end"
            fontSize="11"
            fontWeight="600"
            fill={color}
          >
            {status}
          </text>
        )}
        {lines.filter(Boolean).map((line, i) => {
          const selected =
            active &&
            transfer.value != null &&
            (line.endsWith(`: ${short(transfer.value)}`) ||
              line.endsWith(`← ${short(transfer.value)}`));
          return (
            <text
              key={i}
              x={box.x + box.w / 2}
              y={box.y + (shape ? 62 : 49) + i * (shape ? 18 : 22)}
              textAnchor="middle"
              fontSize={unit === "cu" || unit === "immediate" ? 14 : 15}
              fontWeight={selected ? 700 : 400}
              fill={selected ? color : "var(--ar-text-primary)"}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {line}
            </text>
          );
        })}
      </g>
    );
  };
  const wires: { key: string; system?: boolean; kind?: keyof typeof COLORS }[] =
    [
      { key: "fetch-address", system: true, kind: "address" },
      { key: "fetch-instruction", system: true, kind: "data" },
      { key: "next-pc", kind: "control" },
    ];
  if (flow.registerInputs.length)
    wires.push({ key: "read-control", kind: "control" }, { key: "input-a" });
  else if (flow.pcRelative) wires.push({ key: "input-a" });
  if (flow.usesImmediate || flow.registerInputs.length > 1)
    wires.push({ key: "input-b" });
  if (flow.load || flow.store)
    wires.push(
      { key: "memory-address", system: true, kind: "address" },
      { key: "memory-control", system: true, kind: "control" },
    );
  if (flow.store && !flow.error)
    wires.push({ key: "store-data", system: true });
  if (flow.load && flow.writes.length && !flow.error)
    wires.push({ key: "load-data", system: true });
  if (!flow.load && !flow.store && flow.writes.length)
    wires.push({ key: "writeback" });
  const regLines = flow.registerInputs.map(
    (value) => `${registerLabel(value.name)}: ${short(value.value)}`,
  );
  if (!regLines.length) regLines.push("입력 읽기 없음");
  if (flow.writes.length)
    regLines.push(
      reached("writeback") || reached("load-data")
        ? `${flow.writes[0]} ← ${short(flow.writeValue)}`
        : "결과 기록 대기",
    );
  const aluLines = flow.system
    ? ["일반 ALU 연산 없음"]
    : flow.jump
      ? [
          `이동: ${flow.nextPc ?? "미제공"}`,
          `복귀: ${flow.writeValue ?? "미제공"}`,
        ]
      : [
          `A: ${reached("input-a") || (!flow.pcRelative && !flow.registerInputs.length) ? short(flow.input1) : "입력 대기"}`,
          `B: ${reached("input-b") ? (flow.amount != null ? `${flow.amount}비트 이동` : short(flow.input2)) : "입력 대기"}`,
          flow.branch
            ? arrived.includes("calculate") || transfer.id === "calculate"
              ? flow.taken == null
                ? "분기 판정 미제공"
                : flow.taken
                  ? "분기 조건 성립"
                  : "분기 조건 불성립"
              : "조건 비교 대기"
            : `결과: ${arrived.includes("calculate") || transfer.id === "calculate" ? short(flow.result) : "연산 대기"}`,
        ];
  const memoryLines =
    flow.load || flow.store
      ? [
          `${reached("memory-address") ? (flow.address ?? "주소 미제공") : "주소 전달 대기"} · ${flow.width / 8}B ${flow.load ? "읽기" : "쓰기"}`,
          `값: ${reached("load-data") || reached("store-data") || transfer.id === "discard-load" ? short(flow.memoryValue) : "전달 대기"}`,
        ]
      : ["데이터 접근 없음"];
  return (
    <svg
      viewBox="0 0 780 970"
      preserveAspectRatio="xMidYMin meet"
      className="block h-full min-h-0 w-full font-sans"
      role="group"
      aria-label="데이터가 이동하는 싱글 사이클 경로"
      data-layout="vertical-datapath"
    >
      <defs>
        {Object.entries(COLORS).map(([kind, stroke]) => (
          <marker
            key={kind}
            id={`${id}-${kind}`}
            viewBox="0 0 12 12"
            refX="10"
            refY="6"
            markerWidth="10"
            markerHeight="10"
            markerUnits="userSpaceOnUse"
            orient="auto"
          >
            <path d="M0 0L11 6L0 12z" fill={stroke} />
          </marker>
        ))}
      </defs>
      {wires.map((wire) => (
        <g
          key={wire.key}
          data-circuit-wire={wire.key}
          data-memory-connection={wire.system || undefined}
        >
          {wire.system && wire.kind !== "control" && (
            <path
              d={paths[wire.key]}
              fill="none"
              stroke="var(--ar-border)"
              strokeWidth="8"
              strokeLinejoin="round"
            />
          )}
          <path
            d={paths[wire.key]}
            fill="none"
            stroke="var(--ar-border)"
            strokeWidth={wire.kind === "control" ? 1.8 : wire.system ? 4 : 2.5}
            strokeDasharray={wire.kind === "control" ? "6 4" : undefined}
            strokeLinejoin="round"
            markerEnd={`url(#${id}-${wire.kind ?? "data"})`}
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
            strokeWidth={
              transfer.kind === "control" ? 2.5 : transfer.systemBus ? 6 : 3
            }
            strokeDasharray={transfer.kind === "control" ? "6 4" : undefined}
            strokeLinejoin="round"
            markerEnd={`url(#${id}-${transfer.kind})`}
          />
        </g>
      )}
      {point && progress > 0 && progress < 1 && (
        <circle
          className="flow-packet"
          data-packet-x={point.x}
          data-packet-y={point.y}
          cx={point.x}
          cy={point.y}
          r="6"
          fill={color}
          stroke="var(--ar-panel-bg)"
          strokeWidth="2"
        />
      )}
      {node("pc", boxes.pc, "PC", [flow.pc ?? "미제공"])}
      {node(
        "memory",
        boxes.instruction,
        "Instruction Memory",
        [flow.op.toUpperCase()],
        true,
      )}
      {node("registers", boxes.registers, "레지스터", regLines)}
      {node("immediate", boxes.immediate, "Imm Gen", [
        flow.usesImmediate || flow.branch
          ? String(flow.amount ?? flow.immediate ?? "미제공")
          : "사용 안 함",
        "즉치값 생성",
      ])}
      {node("cu", boxes.cu, "CU", [
        `해석: ${flow.op.toUpperCase()}`,
        flow.controlSignals
          ? `기록: ${flow.controlSignals.reg_write ? "켜짐" : "꺼짐"}`
          : "신호 미제공",
      ])}
      <g aria-label="ALU 입력 선택">
        <path
          d="M410 520H470L458 552H422Z"
          fill="var(--ar-panel-bg)"
          stroke="#009dd8"
          strokeWidth="1.6"
        />
        <text
          x="440"
          y="541"
          textAnchor="middle"
          fontSize="13"
          fill="var(--ar-text-primary)"
        >
          MUX
        </text>
      </g>
      {node("alu", boxes.alu, "ALU", aluLines)}
      {node("memory", boxes.memory, "Data Memory", memoryLines)}
      <g aria-label="기록값 선택">
        <title>
          연산 결과·메모리 값·복귀 주소 중 명령어에 맞는 값을 선택합니다.
        </title>
        <path
          d="M290 860H450L422 908H318Z"
          fill="var(--ar-panel-bg)"
          stroke={
            transfer.id === "writeback" || transfer.id === "load-data"
              ? color
              : "#9860dc"
          }
          strokeWidth="2"
        />
        <text
          x="370"
          y="885"
          textAnchor="middle"
          fontSize="14"
          fontWeight="600"
          fill="var(--ar-text-primary)"
        >
          기록값 MUX
        </text>
      </g>
      <g data-text-layer="true">
        <text x="390" y="223" fontSize="14" fill={COLORS.address}>
          명령어 주소
        </text>
        <text x="690" y="340" fontSize="13" fill={COLORS.data}>
          명령어
        </text>
        <text x="250" y="531" fontSize="14" fill="var(--ar-text-muted)">
          A
        </text>
        <text x="465" y="558" fontSize="14" fill="var(--ar-text-muted)">
          B
        </text>
        {(flow.load || flow.store) && (
          <text x="390" y="709" fontSize="14" fill={COLORS.address}>
            데이터 주소
          </text>
        )}
        {flow.store && (
          <text x="155" y="710" fontSize="13" fill={COLORS.data}>
            저장 데이터
          </text>
        )}
        <g aria-label="메모리 연결: 시스템 버스의 주소·데이터·제어 역할">
          {(["address", "data", "control"] as const).map((kind, i) => (
            <g key={kind} data-system-bus-label={kind}>
              <path
                d={`M${220 + i * 150} 937h24`}
                stroke={COLORS[kind]}
                strokeWidth={kind === "control" ? 2 : 5}
                strokeDasharray={kind === "control" ? "5 3" : undefined}
              />
              <text x={252 + i * 150} y="941" fontSize="13" fill={COLORS[kind]}>
                {kind === "address"
                  ? "주소"
                  : kind === "data"
                    ? "데이터"
                    : "제어"}
              </text>
            </g>
          ))}
        </g>
        <text x="32" y="963" fontSize="11" fill="var(--ar-text-muted)">
          메모리 연결의 버스 역할을 설명한 개념도입니다.
        </text>
      </g>
      <g aria-label="현재 이동 데이터" data-transfer={transfer.id}>
        <rect
          x="16"
          y="10"
          width="748"
          height="104"
          rx="12"
          fill="var(--ar-header-bg)"
          stroke={color}
          strokeWidth="1.8"
        />
        <text x="32" y="36" fontSize="18" fontWeight="650" fill={color}>
          {index + 1} / {count} · {transfer.title}
        </text>
        <text
          x="32"
          y="72"
          fontSize="25"
          fontWeight="700"
          className="font-mono"
          fill="var(--ar-text-primary)"
          data-transfer-value="true"
        >
          {payload}
        </text>
        <text x="32" y="99" fontSize="14" fill="var(--ar-text-muted)">
          {transfer.detail}
        </text>
      </g>
    </svg>
  );
}
