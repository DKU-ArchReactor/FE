import { useLayoutEffect, useId, useMemo, useRef, useState } from "react";
import {
  displayValue,
  registerLabel,
  instructionPaths,
  pointOnTransfer,
  transferMotion,
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
  useLayoutEffect(() => {
    const measure = (width: number, height: number) => {
      if (width > 0 && height > 0)
        setViewWidth(Math.max(780, (1080 * width) / height));
    };
    const element = area.current;
    if (element) {
      const rect = element.getBoundingClientRect();
      measure(rect.width, rect.height);
    }
    const observer = new ResizeObserver(([entry]) =>
      measure(entry.contentRect.width, entry.contentRect.height),
    );
    if (element) observer.observe(element);
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
    pc: { x: 260, y: 132, w: 200, h: 60 },
    instruction: { x: 205, y: 245, w: 310, h: 76 },
    registers: { x: 180, y: 400, w: 210, h: 110 },
    immediate: { x: 425, y: 400, w: 160, h: 70 },
    cu: { x: 625, y: 395, w: 145, h: 108 },
    alu: { x: 220, y: 690, w: 280, h: 110 },
    memory: { x: 220, y: 850, w: 280, h: 86 },
    "operand-mux": { x: 330, y: 550, w: 220, h: 80 },
    mux: { x: 255, y: 966, w: 230, h: 76 },
  } satisfies Record<string, Box>;
  const boxes = Object.fromEntries(
    Object.entries(baseBoxes).map(([key, box]) => [
      key,
      { ...box, x: sx(box.x), w: sx(box.w) },
    ]),
  ) as Record<keyof typeof baseBoxes, Box>;
  const packetBox = point
    ? { x: point.x - packetWidth / 2, y: point.y - 14, w: packetWidth, h: 28 }
    : undefined;
  const node = (
    unit: TransferUnit,
    box: Box,
    title: string,
    lines: string[],
    instructionMemory = false,
    accessibleLabel?: string,
  ) => {
    const isMux = unit === "mux" || unit === "operand-mux";
    const isAlu = unit === "alu";
    const status = tag(unit, instructionMemory),
      active = Boolean(status);
    const stroke = active ? color : NODES[unit];
    const shape =
      unit === "alu"
        ? scalePath("M220 690H337L360 710L383 690H500L456 800H264Z")
        : unit === "operand-mux"
          ? scalePath("M330 550H550L520 630H360Z")
          : unit === "mux"
            ? scalePath("M255 966H485L450 1042H290Z")
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
                : isMux
                  ? "mux"
                  : "register"
        }
        aria-label={accessibleLabel ?? `${title} 흐름 선택`}
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
          y={box.y + (isAlu ? 42 : 25)}
          textAnchor="middle"
          fontSize={isMux ? 20 : 22}
          data-mux-title={unit === "mux" ? "true" : undefined}
          fontWeight="800"
          fill="var(--ar-text-primary)"
        >
          {title}
        </text>
        {status && (
          <text
            x={isAlu ? box.x + 45 : box.x + box.w - (isMux ? 28 : 12)}
            y={box.y + (isAlu ? 29 : 24)}
            textAnchor={isAlu ? "start" : "end"}
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
          const baseline = isMux
            ? box.y + (unit === "operand-mux" ? 65 : 55)
            : box.y + (isAlu ? 62 : 49) + i * (isAlu ? 18 : 22);
          const inset = isMux
            ? (box.w - 158) / 2
            : isAlu
              ? Math.max(48, (box.w - 180) / 2)
              : 12;
          const coveredByTransfer =
            isMux &&
            active &&
            packetBox &&
            packetBox.x < box.x + box.w - inset &&
            packetBox.x + packetBox.w > box.x + inset &&
            packetBox.y < baseline + 5 &&
            packetBox.y + packetBox.h > baseline - 19;
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
                opacity={coveredByTransfer ? 0 : 1}
                data-mux-status={unit === "mux" ? "true" : undefined}
                data-control-selection={
                  unit === "cu" && line.startsWith("Read:") ? "true" : undefined
                }
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
        viewBox={`0 0 ${viewWidth} 1080`}
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
            className={
              transfer.kind === "control"
                ? "flow-control-trail"
                : "flow-data-trail"
            }
            d={trail}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            opacity=".18"
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
            ? reached("decode-immediate")
              ? String(flow.amount ?? flow.immediate ?? "미제공")
              : "명령어 해석 대기"
            : "사용 안 함",
        ])}
        {node("cu", boxes.cu, "CU", [
          `해석: ${flow.op.toUpperCase()}`,
          ...(flow.registerInputs.length
            ? [
                `Read: ${flow.registerInputs.map((value) => value.name).join(", ")}`,
              ]
            : []),
          flow.controlSignals
            ? `기록: ${flow.controlSignals.reg_write ? "켜짐" : "꺼짐"}`
            : "신호 미제공",
        ])}
        {node(
          "operand-mux",
          boxes["operand-mux"],
          "\uC785\uB825 MUX",
          [
            flow.usesImmediate || flow.registerInputs.length > 1
              ? reached("input-b")
                ? flow.amount != null
                  ? String(flow.amount)
                  : short(flow.input2)
                : "\uC804\uB2EC \uB300\uAE30"
              : "\uC0AC\uC6A9 \uC548 \uD568",
          ],
          false,
          "ALU \uC785\uB825 \uC120\uD0DD",
        )}
        {node("alu", boxes.alu, "ALU", aluLines)}
        {node("memory", boxes.memory, "Data Memory", memoryLines)}
        {node(
          "mux",
          boxes.mux,
          "\uAE30\uB85D\uAC12 MUX",
          [
            flow.writes.length && !flow.store
              ? reached("load-data") || reached("result-to-mux")
                ? short(flow.writeValue)
                : "\uC804\uB2EC \uB300\uAE30"
              : "\uC0AC\uC6A9 \uC548 \uD568",
          ],
          false,
          "\uAE30\uB85D\uAC12 \uC120\uD0DD",
        )}
        <g data-text-layer="true">
          <g data-instruction-address-label="true">
            <title>
              PC가 명령어 메모리에 전달하는, 읽을 명령어의 주소입니다.
            </title>
            <text
              x={boxes.instruction.x - 18}
              y={boxes.instruction.y - 8}
              fontSize="18"
              fontWeight="750"
              fill={COLORS.address}
            >
              명령어 주소
            </text>
          </g>
          <text
            x={sx(540)}
            y="250"
            fontSize="18"
            fontWeight="700"
            data-instruction-word-label="true"
            fill={COLORS.data}
          >
            명령어
          </text>
          {(flow.load || flow.store) && (
            <text
              data-memory-address-label="true"
              x={boxes.memory.x + boxes.memory.w - 40}
              y={boxes.memory.y - 8}
              fontSize="18"
              fontWeight="750"
              fill={COLORS.address}
            >
              데이터 주소
            </text>
          )}
          <text x={sx(32)} y="1073" fontSize="11" fill="var(--ar-text-muted)">
            메모리 연결의 버스 역할을 설명한 개념도입니다.
          </text>
        </g>
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
        <g
          data-bus-legend="true"
          aria-label="메모리 연결: 시스템 버스의 주소·데이터·제어 역할"
        >
          {(["address", "data", "control"] as const).map((kind, i) => (
            <g key={kind} data-system-bus-label={kind}>
              <path
                d={`M${sx(35)} ${172 + i * 32}H${sx(59)}`}
                stroke={COLORS[kind]}
                strokeWidth={kind === "control" ? 2 : 5}
                strokeDasharray={kind === "control" ? "5 3" : undefined}
              />
              <text
                x={sx(70)}
                y={177 + i * 32}
                fontSize="16"
                fontWeight="650"
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

        {point && packetBox && (
          <g className="flow-token">
            <g
              className={
                transfer.kind === "control"
                  ? "flow-control-word flow-packet"
                  : "flow-data-word flow-packet"
              }
              data-label-kind={transfer.kind}
              data-moving-value={packetValue}
              data-packet-x={point.x}
              data-packet-y={point.y}
              aria-label={`${transfer.kind === "control" ? "제어 신호" : "이동 중인 값"} ${packetValue}`}
            >
              <rect
                data-flow-marker="true"
                x={packetBox.x}
                y={packetBox.y}
                width={packetBox.w}
                height={packetBox.h}
                rx="6"
                fill={
                  transfer.kind === "control" ? "var(--ar-panel-bg)" : color
                }
                stroke={
                  transfer.kind === "control" ? color : "var(--ar-panel-bg)"
                }
                strokeWidth={transfer.kind === "control" ? 1.8 : 1}
                strokeDasharray={
                  transfer.kind === "control" ? "5 3" : undefined
                }
                style={{ filter: "drop-shadow(0 2px 3px rgb(0 0 0 / .12))" }}
              />
              <text
                x={packetBox.x + packetBox.w / 2}
                y={packetBox.y + 21}
                textAnchor="middle"
                fontSize="18"
                fontWeight="750"
                className="font-mono"
                fill={transfer.kind === "control" ? color : "#fff"}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {packetValue}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
