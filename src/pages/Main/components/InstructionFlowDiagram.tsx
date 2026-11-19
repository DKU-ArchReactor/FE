import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  displayValue,
  registerLabel,
  instructionPaths,
  pointOnTransfer,
  transferMotion,
  placeFlowLabel,
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
  mux: "#9860dc",
  "operand-mux": "#009dd8",
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
  const area = useRef<HTMLDivElement>(null);
  const [viewWidth, setViewWidth] = useState(780);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setViewWidth(
        Math.max(
          780,
          (970 * entry.contentRect.width) /
            Math.max(1, entry.contentRect.height),
        ),
      );
    });
    if (area.current) observer.observe(area.current);
    return () => observer.disconnect();
  }, []);
  const scale = viewWidth / 780;
  const sx = (value: number) => value * scale;
  const scalePath = (value: string) =>
    value.replace(
      /([MLHV])([^MLHVZ]*)/g,
      (_, command: string, coordinates: string) => {
        const values = coordinates.trim().split(/[ ,]+/).map(Number);
        return (
          command +
          (command === "V"
            ? values[0]
            : command === "H"
              ? sx(values[0])
              : `${sx(values[0])} ${values[1]}`)
        );
      },
    );
  const paths = useMemo(() => instructionPaths(flow, scale), [flow, scale]);
  const isFetch =
    transfer.id === "fetch-address" || transfer.id === "fetch-instruction";
  const reached = (key: string) =>
    arrived.includes(key) || (transfer.id === key && progress >= 0.95);
  const path = paths[transfer.id];
  const motion = useMemo(
    () => transferMotion(transfer, path),
    [transfer, path],
  );
  const {
    value: packetValue,
    width: packetWidth,
    route,
    startPadding,
    endPadding,
  } = motion;
  const point = route
    ? pointOnTransfer(route, progress, startPadding, endPadding)
    : undefined;
  // A short trail shares the same clock as the data value, including Pause and seek.
  const trail =
    route && point && progress > 0 && progress < 1
      ? Array.from({ length: 7 }, (_, index) => {
          const tail = pointOnTransfer(
            route,
            Math.max(
              0,
              progress - ((6 - index) * 7) / Math.max(1, motion.distance),
            ),
            startPadding,
            endPadding,
          )!;
          return `${index ? "L" : "M"}${tail.x} ${tail.y}`;
        }).join(" ")
      : undefined;
  const color = COLORS[transfer.kind];
  const payload =
    transfer.value == null
      ? "미제공"
      : transfer.kind === "address" ||
          transfer.id === "fetch-instruction" ||
          transfer.id === "decode-immediate"
        ? transfer.value
        : displayValue(transfer.value);
  const tag = (unit: TransferUnit, instructionMemory = false) => {
    if (
      unit === "memory" &&
      instructionMemory !== (isFetch || transfer.id === "decode-immediate")
    )
      return "";
    return transfer.source === unit && transfer.target === unit
      ? "처리 중"
      : transfer.source === unit
        ? "출발"
        : transfer.target === unit
          ? "도착"
          : "";
  };
  const baseBoxes = {
    pc: { x: 260, y: 132, w: 200, h: 70 },
    instruction: { x: 205, y: 245, w: 310, h: 76 },
    registers: { x: 55, y: 380, w: 250, h: 110 },
    immediate: { x: 350, y: 380, w: 180, h: 90 },
    cu: { x: 580, y: 365, w: 180, h: 108 },
    alu: { x: 220, y: 570, w: 280, h: 110 },
    memory: { x: 220, y: 730, w: 280, h: 90 },
  } satisfies Record<string, Box>;
  const boxes = Object.fromEntries(
    Object.entries(baseBoxes).map(([key, box]) => [
      key,
      { ...box, x: sx(box.x), w: sx(box.w) },
    ]),
  ) as Record<keyof typeof baseBoxes, Box>;
  const obstacles = [
    ...Object.values(boxes),
    { x: sx(290), y: 860, w: sx(160), h: 48 },
    { x: sx(410), y: 502, w: sx(60), h: 32 },
    ...(flow.registerInputs.length
      ? [{ x: sx(60), y: 338, w: sx(230), h: 30 }]
      : []),
  ];
  const packetBox = point
    ? placeFlowLabel(point, packetWidth, obstacles, viewWidth)
    : undefined;
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
        ? scalePath("M220 570H337L360 590L383 570H500L456 680H264Z")
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
        data-hardware-shape={
          unit === "registers"
            ? "register-file"
            : unit === "memory" || unit === "cu"
              ? "chip"
              : unit === "alu"
                ? "alu"
                : "register"
        }
        aria-label={`${title} 흐름 선택`}
        onClick={() => onUnit(instructionMemory ? "cu" : unit)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onUnit(instructionMemory ? "cu" : unit);
          }
        }}
        data-flow-active={active}
        opacity={active ? 1 : 0.62}
        className="cursor-pointer outline-none focus-visible:drop-shadow-md"
      >
        {unit === "registers" && (
          <g aria-hidden="true">
            <title>
              32개 × 32비트 레지스터 파일에서 현재 명령어에 관련된 행을
              표시합니다.
            </title>
            <rect
              x={box.x + 7}
              y={box.y - 7}
              width={box.w}
              height={box.h}
              rx="2"
              fill="var(--ar-panel-bg)"
              stroke={stroke}
              strokeWidth="1.4"
            />
            <rect
              x={box.x + 3.5}
              y={box.y - 3.5}
              width={box.w}
              height={box.h}
              rx="2"
              fill="var(--ar-panel-bg)"
              stroke={stroke}
              strokeWidth="1.4"
            />
          </g>
        )}
        {(unit === "memory" || unit === "cu") && (
          <g aria-hidden="true" stroke={stroke} strokeWidth="2">
            {[22, 44, 66].map((offset) => (
              <path
                key={offset}
                d={`M${box.x - 7} ${box.y + offset}h7M${box.x + box.w} ${box.y + offset}h7`}
              />
            ))}
          </g>
        )}
        {shape ? (
          <path
            d={shape}
            fill={
              active
                ? `color-mix(in srgb, ${color} 9%, var(--ar-panel-bg))`
                : "var(--ar-panel-bg)"
            }
            stroke={stroke}
            strokeWidth={active ? 3 : 1.8}
          />
        ) : (
          <rect
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            rx={
              unit === "registers" || unit === "memory" || unit === "cu" ? 2 : 8
            }
            fill={
              active
                ? `color-mix(in srgb, ${color} 9%, var(--ar-panel-bg))`
                : "var(--ar-panel-bg)"
            }
            stroke={stroke}
            strokeWidth={active ? 3 : 1.8}
          />
        )}
        {unit === "registers" && (
          <g
            data-hardware-grid="true"
            aria-hidden="true"
            stroke={stroke}
            strokeOpacity=".4"
            strokeWidth="1"
          >
            {[30, 55, 77].map((offset) => (
              <path
                key={offset}
                d={`M${box.x} ${box.y + offset}H${box.x + box.w}`}
              />
            ))}
          </g>
        )}
        {unit === "registers" && (
          <text
            x={box.x + 10}
            y={box.y + 24}
            fontSize="15"
            fontWeight="750"
            fill="var(--ar-text-primary)"
          >
            32비트
          </text>
        )}
        {(unit === "memory" || unit === "cu") && (
          <path
            d={`M${box.x} ${box.y + 34}H${box.x + box.w}`}
            stroke={stroke}
            strokeOpacity=".45"
            strokeWidth="1"
          />
        )}
        <text
          x={box.x + box.w / 2}
          y={box.y + (shape ? 42 : 25)}
          textAnchor="middle"
          fontSize="22"
          fontWeight="800"
          fill="var(--ar-text-primary)"
        >
          {title}
        </text>
        {status && (
          <text
            x={shape ? box.x + 45 : box.x + box.w - 12}
            y={box.y + (shape ? 29 : 24)}
            textAnchor={shape ? "start" : "end"}
            fontSize="16"
            fontWeight="750"
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
          const baseline = box.y + (shape ? 62 : 49) + i * (shape ? 18 : 22);
          const inset = shape ? Math.max(48, (box.w - 180) / 2) : 12;
          return (
            <g key={i}>
              {unit !== "registers" && (
                <rect
                  x={box.x + inset}
                  y={baseline - 16}
                  width={box.w - inset * 2}
                  height="19"
                  rx="3"
                  fill={active ? "var(--ar-panel-bg)" : "var(--ar-header-bg)"}
                  stroke={selected ? color : "var(--ar-border)"}
                  strokeWidth=".6"
                />
              )}
              <text
                x={box.x + box.w / 2}
                y={baseline}
                textAnchor="middle"
                fontSize="18"
                fontWeight={selected ? 800 : 650}
                fill={selected ? color : "var(--ar-text-primary)"}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {line}
              </text>
            </g>
          );
        })}
      </g>
    );
  };
  const wires: { key: string; system?: boolean; kind?: keyof typeof COLORS }[] =
    [
      { key: "fetch-address", system: true, kind: "address" },
      { key: "fetch-instruction", system: true, kind: "data" },
      { key: "decode-immediate", kind: "data" },
      { key: "next-pc", kind: "control" },
    ];
  if (flow.registerInputs.length)
    wires.push({ key: "read-control", kind: "control" }, { key: "input-a" });
  else if (flow.pcRelative) wires.push({ key: "input-a" });
  if (flow.usesImmediate || flow.registerInputs.length > 1)
    wires.push({ key: "input-b" }, { key: "mux-to-alu" });
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
    wires.push({ key: "result-to-mux" });
  if (!flow.store && flow.writes.length && !flow.error)
    wires.push({ key: "writeback" });
  const regLines = flow.registerInputs.map(
    (value) => `${registerLabel(value.name)}: ${short(value.value)}`,
  );
  if (!regLines.length) regLines.push("입력 읽기 없음");
  if (flow.writes.length)
    regLines.push(
      reached("writeback")
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
          `B: ${reached("mux-to-alu") ? (flow.amount != null ? `${flow.amount}비트 이동` : short(flow.input2)) : "입력 대기"}`,
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
    <div ref={area} className="h-full min-h-0 w-full min-w-0 overflow-hidden">
      <svg
        viewBox={`0 0 ${viewWidth} 970`}
        preserveAspectRatio="xMidYMin meet"
        className="ar-single-flow-diagram block h-full min-h-0 w-full font-sans"
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
            opacity={wire.key === transfer.id ? 1 : 0.28}
            data-memory-connection={wire.system || undefined}
          >
            {wire.system && wire.kind !== "control" && (
              <path
                d={paths[wire.key]}
                fill="none"
                stroke="var(--ar-flow-wire)"
                strokeWidth="8"
                strokeLinejoin="round"
              />
            )}
            <path
              d={paths[wire.key]}
              fill="none"
              stroke={
                wire.kind === "control" ? "#9973bd" : "var(--ar-flow-wire)"
              }
              strokeWidth={
                wire.kind === "control" ? 2.4 : wire.system ? 4 : 3.2
              }
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
              strokeWidth="14"
              strokeLinejoin="round"
            />
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={transfer.kind === "control" ? 4 : 6}
              strokeDasharray={transfer.kind === "control" ? "6 4" : undefined}
              strokeLinejoin="round"
              markerEnd={`url(#${id}-${transfer.kind})`}
            />
          </g>
        )}
        {trail && (
          <path
            className="flow-data-trail"
            d={trail}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            opacity=".18"
          />
        )}
        {point && packetBox && (
          <g className="flow-data-guide" aria-hidden="true">
            <path
              d={`M${point.x} ${point.y}L${Math.max(packetBox.x, Math.min(packetBox.x + packetBox.w, point.x))} ${Math.max(packetBox.y, Math.min(packetBox.y + packetBox.h, point.y))}`}
              stroke={color}
              strokeWidth="1.6"
              fill="none"
            />
            <circle cx={point.x} cy={point.y} r="4" fill={color} />
          </g>
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
            ? reached("decode-immediate")
              ? String(flow.amount ?? flow.immediate ?? "미제공")
              : "명령어 해석 대기"
            : "사용 안 함",
          "즉치값 생성",
        ])}
        {node("cu", boxes.cu, "CU", [
          `해석: ${flow.op.toUpperCase()}`,
          flow.controlSignals
            ? `기록: ${flow.controlSignals.reg_write ? "켜짐" : "꺼짐"}`
            : "신호 미제공",
        ])}
        <g
          aria-label="ALU 입력 선택"
          data-flow-active={
            transfer.source === "operand-mux" ||
            transfer.target === "operand-mux"
          }
          opacity={
            transfer.source === "operand-mux" ||
            transfer.target === "operand-mux"
              ? 1
              : 0.62
          }
        >
          <path
            d={scalePath("M410 502H470L458 534H422Z")}
            fill="var(--ar-panel-bg)"
            stroke="#009dd8"
            strokeWidth="1.6"
          />
          <text
            x={sx(440)}
            y="523"
            textAnchor="middle"
            fontSize="17"
            fontWeight="750"
            fill="var(--ar-text-primary)"
          >
            MUX
          </text>
        </g>
        {node("alu", boxes.alu, "ALU", aluLines)}
        {node("memory", boxes.memory, "Data Memory", memoryLines)}
        <g
          aria-label="기록값 선택"
          data-flow-active={
            transfer.source === "mux" || transfer.target === "mux"
          }
          opacity={
            transfer.source === "mux" || transfer.target === "mux" ? 1 : 0.42
          }
        >
          <title>
            연산 결과·메모리 값·복귀 주소 중 명령어에 맞는 값을 선택합니다.
          </title>
          <path
            d={scalePath("M290 860H450L422 908H318Z")}
            fill="var(--ar-panel-bg)"
            stroke={
              transfer.source === "mux" || transfer.target === "mux"
                ? color
                : "#9860dc"
            }
            strokeWidth="2"
          />
          <text
            x={sx(370)}
            y="879"
            textAnchor="middle"
            fontSize="16"
            fontWeight="700"
            className="font-mono"
            fill="var(--ar-text-primary)"
          >
            기록값 MUX
          </text>
          <text
            x={sx(370)}
            y="900"
            textAnchor="middle"
            fontSize="13"
            fontWeight="650"
            className="font-mono"
            fill={color}
          >
            {reached("load-data") || reached("result-to-mux")
              ? short(flow.writeValue)
              : "\uC804\uB2EC \uB300\uAE30"}
          </text>
        </g>
        <g data-text-layer="true">
          <text x={sx(460)} y="223" fontSize="14" fill={COLORS.address}>
            명령어 주소
          </text>
          <text x={sx(560)} y="322" fontSize="13" fill={COLORS.data}>
            명령어
          </text>
          {(flow.load || flow.store) && (
            <text x={sx(460)} y="707" fontSize="14" fill={COLORS.address}>
              데이터 주소
            </text>
          )}
          <g aria-label="메모리 연결: 시스템 버스의 주소·데이터·제어 역할">
            {(["address", "data", "control"] as const).map((kind, i) => (
              <g key={kind} data-system-bus-label={kind}>
                <path
                  d={`M${sx(55)} ${257 + i * 30}H${sx(78)}`}
                  stroke={COLORS[kind]}
                  strokeWidth={kind === "control" ? 2 : 5}
                  strokeDasharray={kind === "control" ? "5 3" : undefined}
                />
                <text
                  x={sx(87)}
                  y={262 + i * 30}
                  fontSize="14"
                  fontWeight="600"
                  className="font-mono"
                  fill={COLORS[kind]}
                >
                  {kind === "address"
                    ? "Address Bus"
                    : kind === "data"
                      ? "Data Bus"
                      : "Control Bus"}
                </text>
              </g>
            ))}
          </g>
          <text x={sx(32)} y="963" fontSize="11" fill="var(--ar-text-muted)">
            메모리 연결의 버스 역할을 설명한 개념도입니다.
          </text>
        </g>
        {flow.registerInputs.length > 0 && (
          <g
            data-control-selection="true"
            opacity={transfer.id === "read-control" ? 1 : 0.65}
            aria-label="Read select"
          >
            <rect
              x={sx(60)}
              y="338"
              width={sx(230)}
              height="30"
              rx="6"
              fill="var(--ar-panel-bg)"
              stroke={COLORS.control}
              strokeWidth="1.5"
            />
            <text
              x={sx(72)}
              y="358"
              fontSize="18"
              fontWeight="750"
              fill={COLORS.control}
            >
              Read select:{" "}
              {flow.registerInputs.map((value) => value.name).join(", ")}
            </text>
          </g>
        )}
        <g aria-label="현재 이동 데이터" data-transfer={transfer.id}>
          <rect
            x={sx(16)}
            y="10"
            width={sx(748)}
            height="104"
            rx="12"
            fill="var(--ar-header-bg)"
            stroke={color}
            strokeWidth="1.8"
          />
          <text x={sx(32)} y="36" fontSize="18" fontWeight="650" fill={color}>
            {index + 1} / {count} · {transfer.title}
          </text>
          <text
            x={sx(32)}
            y="72"
            fontSize="25"
            fontWeight="700"
            className="font-mono"
            fill="var(--ar-text-primary)"
            data-transfer-value="true"
          >
            {payload}
          </text>
          <text x={sx(32)} y="99" fontSize="14" fill="var(--ar-text-muted)">
            {transfer.detail}
          </text>
        </g>
        {point && packetBox && (
          <g
            className="flow-data-word flow-packet"
            data-moving-value={packetValue}
            data-packet-x={point.x}
            data-packet-y={point.y}
            aria-label={`이동 중인 값 ${packetValue}`}
          >
            <rect
              x={packetBox.x}
              y={packetBox.y}
              width={packetBox.w}
              height={packetBox.h}
              rx="6"
              fill={color}
              stroke="var(--ar-panel-bg)"
              strokeWidth="1"
              style={{ filter: "drop-shadow(0 2px 3px rgb(0 0 0 / .12))" }}
            />
            <text
              x={packetBox.x + packetBox.w / 2}
              y={packetBox.y + 23}
              textAnchor="middle"
              fontSize="19"
              fontWeight="750"
              className="font-mono"
              fill="#fff"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {packetValue}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
