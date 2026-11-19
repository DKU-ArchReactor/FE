import { useEffect, useId, useRef, useState } from "react";
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
  const container = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const id = useId().replace(/:/g, "");
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setWide(rect.width / Math.max(1, rect.height) > 1.25);
    });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const boxes: Record<TransferUnit, Box> = wide
    ? {
        pc: { x: 32, y: 198, w: 156, h: 82 },
        immediate: { x: 205, y: 198, w: 122, h: 82 },
        cu: { x: 346, y: 198, w: 224, h: 82 },
        registers: { x: 32, y: 354, w: 250, h: 128 },
        alu: { x: 346, y: 354, w: 224, h: 128 },
        memory: { x: 766, y: 198, w: 198, h: 284 },
      }
    : {
        pc: { x: 32, y: 195, w: 140, h: 80 },
        immediate: { x: 190, y: 195, w: 120, h: 80 },
        cu: { x: 328, y: 195, w: 300, h: 80 },
        registers: { x: 32, y: 320, w: 260, h: 110 },
        alu: { x: 328, y: 320, w: 300, h: 110 },
        memory: { x: 16, y: 630, w: 628, h: 112 },
      };
  const paths: Record<string, string> = wide
    ? {
        "fetch-address": "M110 198V184H600V258H766",
        "fetch-instruction": "M766 338H610V300H458V280",
        "read-control": "M346 240H334V320H157V354",
        "input-a": flow.pcRelative
          ? "M110 280V304H334V340H390V354"
          : "M282 397H346",
        "input-b": flow.usesImmediate ? "M266 280V318H430V354" : "M282 447H346",
        "memory-address": "M458 482V510H620V258H766",
        "memory-control": "M570 240H590V418H766",
        "store-data": "M157 482V498H610V338H766",
        "load-data": "M766 338H610V498H24V418H32",
        writeback: flow.jump
          ? "M110 280V320H157V354"
          : "M458 482V510H24V418H32",
        "next-pc": "M458 198V184H110V198",
      }
    : {
        "fetch-address": "M32 235H24V456H110V630",
        "fetch-instruction": "M330 630V470H636V288H478V275",
        "read-control": "M328 235H318V300H162V320",
        "input-a": flow.pcRelative
          ? "M102 275V294H304V306H380V320"
          : "M292 354H328",
        "input-b": flow.usesImmediate ? "M250 275V294H400V320" : "M292 400H328",
        "memory-address": "M468 430V456H110V630",
        "memory-control": "M628 235H636V464H550V630",
        "store-data": "M162 430V464H330V630",
        "load-data": "M330 630V470H24V375H32",
        writeback: flow.jump
          ? "M102 275V300H162V320"
          : "M468 430V442H24V375H32",
        "next-pc": "M478 195V184H102V195",
      };
  const path = paths[transfer.id];
  // A single React clock drives line, packet, payload and Pause; no independent SVG timers.
  const point = path ? transferPoint(path, progress) : undefined;
  const color = COLORS[transfer.kind];
  const reached = (id: string) =>
    arrived.includes(id) || (transfer.id === id && progress >= 0.95);
  const payload =
    transfer.value == null
      ? "미제공"
      : transfer.kind === "address" || transfer.id === "fetch-instruction"
        ? transfer.value
        : displayValue(transfer.value);
  const sourceTag = (unit: TransferUnit) =>
    transfer.source === unit && transfer.target === unit
      ? "처리 중"
      : transfer.source === unit
        ? "출발"
        : transfer.target === unit
          ? "도착"
          : "";
  const node = (unit: TransferUnit, title: string, lines: string[]) => {
    const box = boxes[unit],
      tag = sourceTag(unit),
      active = Boolean(tag);
    return (
      <g
        key={unit}
        role="button"
        tabIndex={0}
        data-flow-node={unit}
        data-x={box.x}
        data-y={box.y}
        data-width={box.w}
        data-height={box.h}
        aria-label={`${title} 흐름 선택`}
        onClick={() => onUnit(unit)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onUnit(unit);
          }
        }}
        className="cursor-pointer outline-none focus-visible:drop-shadow-md"
      >
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx="12"
          fill={active ? "var(--ar-header-bg)" : "var(--ar-panel-bg)"}
          stroke={active ? color : "var(--ar-border)"}
          strokeWidth={active ? 3.5 : 1.5}
        />
        <text
          x={box.x + 14}
          y={box.y + 25}
          fontSize={unit === "immediate" ? 16 : 20}
          fontWeight="650"
          fill="var(--ar-text-primary)"
        >
          {title}
        </text>
        {tag && (
          <text
            x={box.x + box.w - 12}
            y={box.y + 24}
            textAnchor="end"
            fontSize="12"
            fontWeight="650"
            fill={color}
          >
            {tag}
          </text>
        )}
        {lines.map((line, i) => {
          const selected =
            active &&
            transfer.value != null &&
            (line.endsWith(`: ${short(transfer.value)}`) ||
              line.endsWith(`← ${short(transfer.value)}`));
          return (
            <text
              key={i}
              x={box.x + 14}
              y={box.y + 49 + i * (box.h > 100 ? 23 : 19)}
              fontSize={unit === "cu" || unit === "immediate" ? 14 : 16}
              className={unit === "cu" ? "" : "font-mono"}
              fontWeight={selected ? 700 : 400}
              fill={selected ? color : "var(--ar-text-primary)"}
            >
              {line}
            </text>
          );
        })}
      </g>
    );
  };
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
    : flow.branch
      ? [
          `A: ${short(flow.input1)}`,
          `B: ${short(flow.input2)}`,
          flow.taken == null
            ? "분기 판정 미제공"
            : flow.taken
              ? "분기 조건 성립"
              : "분기 조건 불성립",
        ]
      : flow.jump
        ? [
            `이동: ${flow.nextPc ?? "미제공"}`,
            `복귀: ${flow.writeValue ?? "미제공"}`,
          ]
        : [
            `A: ${reached("input-a") || (!flow.pcRelative && !flow.registerInputs.length) ? short(flow.input1) : "입력 대기"}`,
            `B: ${reached("input-b") ? (flow.amount != null ? `${flow.amount}비트 이동` : short(flow.input2)) : "입력 대기"}`,
            `결과: ${arrived.includes("calculate") || transfer.id === "calculate" ? short(flow.result) : "연산 대기"}`,
          ];
  const mem = boxes.memory;
  const nodeGroups = (
    <>
      {node("pc", "PC", [flow.pc ?? "미제공"])}
      {node("immediate", "즉치값", [
        flow.usesImmediate || flow.branch
          ? String(flow.amount ?? flow.immediate ?? "미제공")
          : "사용 안 함",
      ])}
      {node("cu", "CU · 제어 장치", [
        `해석: ${flow.op.toUpperCase()}`,
        flow.controlSignals
          ? `레지스터 기록: ${flow.controlSignals.reg_write ? "켜짐" : "꺼짐"}`
          : "제어 신호 미제공",
      ])}
      {node("registers", "레지스터", regLines)}
      {node("alu", "ALU", aluLines)}
      <g
        role="button"
        tabIndex={0}
        aria-label="메모리 흐름 선택"
        onClick={() => onUnit("memory")}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onUnit("memory");
          }
        }}
        className="cursor-pointer outline-none focus-visible:drop-shadow-md"
        data-flow-node="memory"
        data-x={mem.x}
        data-y={mem.y}
        data-width={mem.w}
        data-height={mem.h}
      >
        <rect
          x={mem.x}
          y={mem.y}
          width={mem.w}
          height={mem.h}
          rx="12"
          fill={
            sourceTag("memory") ? "var(--ar-header-bg)" : "var(--ar-panel-bg)"
          }
          stroke={sourceTag("memory") ? color : "var(--ar-border)"}
          strokeWidth={sourceTag("memory") ? 3.5 : 1.5}
        />
        <text
          x={mem.x + 16}
          y={mem.y + 28}
          fontSize="22"
          fontWeight="650"
          fill="var(--ar-text-primary)"
        >
          메모리
        </text>
        {sourceTag("memory") && (
          <text
            x={mem.x + mem.w - 12}
            y={mem.y + 25}
            textAnchor="end"
            fontSize="12"
            fill={color}
          >
            {sourceTag("memory")}
          </text>
        )}
        <text
          x={wide ? mem.x + 16 : mem.x + 190}
          y={wide ? mem.y + 73 : mem.y + 27}
          fontSize="14"
          fill="var(--ar-text-muted)"
        >
          명령어 읽기
        </text>
        <text
          x={wide ? mem.x + 16 : mem.x + 190}
          y={wide ? mem.y + 98 : mem.y + 56}
          fontSize="18"
          fontWeight="600"
          fill="var(--ar-text-primary)"
        >
          {flow.op.toUpperCase()}
        </text>
        <text
          x={wide ? mem.x + 16 : mem.x + 390}
          y={wide ? mem.y + 157 : mem.y + 27}
          fontSize="14"
          fill="var(--ar-text-muted)"
        >
          {flow.load || flow.store
            ? `${flow.width / 8}바이트 ${flow.load ? "읽기" : "쓰기"}`
            : "데이터 접근 없음"}
        </text>
        {(flow.load || flow.store) && (
          <>
            <text
              x={wide ? mem.x + 16 : mem.x + 390}
              y={wide ? mem.y + 186 : mem.y + 55}
              fontSize="16"
              className="font-mono"
              fill="var(--ar-text-primary)"
            >
              {reached("memory-address")
                ? (flow.address ?? "주소 미제공")
                : "주소 전달 대기"}
            </text>
            <text
              x={wide ? mem.x + 16 : mem.x + 390}
              y={wide ? mem.y + 214 : mem.y + 81}
              fontSize="16"
              className="font-mono"
              fill="var(--ar-text-primary)"
            >
              값:{" "}
              {reached("load-data") ||
              reached("store-data") ||
              transfer.id === "discard-load"
                ? short(flow.memoryValue)
                : "전달 대기"}
            </text>
          </>
        )}
      </g>
    </>
  );
  return (
    <div
      ref={container}
      className="h-full min-h-0 w-full min-w-0 overflow-hidden"
    >
      <svg
        viewBox={wide ? "0 0 980 610" : "0 0 660 780"}
        preserveAspectRatio="xMidYMin meet"
        className="block h-full w-full font-sans"
        role="group"
        aria-label="데이터가 이동하는 싱글 사이클 경로"
      >
        <defs>
          {Object.entries(COLORS).map(([kind, stroke]) => (
            <marker
              key={kind}
              id={`${id}-${kind}`}
              viewBox="0 0 12 12"
              refX="10"
              refY="6"
              markerWidth="11"
              markerHeight="11"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d="M0 0L11 6L0 12z" fill={stroke} />
            </marker>
          ))}
        </defs>
        <rect
          x="16"
          y={wide ? 148 : 146}
          width={wide ? 570 : 628}
          height={wide ? 380 : 304}
          rx="16"
          fill="none"
          stroke="var(--ar-border)"
        />
        <text
          x="32"
          y={wide ? 172 : 170}
          fontSize="17"
          fontWeight="600"
          fill="var(--ar-text-muted)"
        >
          CPU 내부 데이터 경로
        </text>
        <path
          d={wide ? "M282 397H346M282 447H346" : "M292 354H328M292 400H328"}
          stroke="var(--ar-border)"
          strokeWidth="2"
          fill="none"
        />
        <g
          aria-label="시스템 버스: 주소 버스, 데이터 버스, 제어 버스"
          data-system-buses="true"
        >
          {(["address", "data", "control"] as const).map((kind, i) => {
            const d = wide
              ? `M600 ${258 + i * 80}H766`
              : `M${110 + i * 220} 470V630`;
            const selected = transfer.systemBus && transfer.kind === kind;
            return (
              <g
                key={kind}
                data-system-bus={kind}
                data-active={Boolean(selected)}
              >
                <path
                  d={d}
                  fill="none"
                  stroke={COLORS[kind]}
                  strokeWidth={selected ? 9 : 5}
                  opacity={selected ? 1 : 0.3}
                  markerEnd={`url(#${id}-${kind})`}
                  markerStart={
                    kind === "data" ? `url(#${id}-${kind})` : undefined
                  }
                />
              </g>
            );
          })}
        </g>
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
              strokeWidth="3"
              strokeDasharray={transfer.kind === "control" ? "7 4" : undefined}
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
            r="7"
            fill={color}
            stroke="var(--ar-panel-bg)"
            strokeWidth="2"
          />
        )}
        {nodeGroups}
        <g data-text-layer="true">
          <text
            x={wide ? 626 : 20}
            y={wide ? 183 : 494}
            fontSize="13"
            fontWeight="650"
            fill="var(--ar-text-muted)"
          >
            시스템 버스
          </text>
          {(["address", "data", "control"] as const).map((kind, i) => (
            <g key={kind} data-system-bus-label={kind}>
              <text
                x={wide ? 682 : 133 + i * 220}
                y={wide ? 240 + i * 80 : 520}
                textAnchor={wide ? "middle" : "start"}
                fontSize="16"
                fontWeight={
                  transfer.systemBus && transfer.kind === kind ? 700 : 500
                }
                fill={COLORS[kind]}
              >
                {kind === "address"
                  ? "주소 버스"
                  : kind === "data"
                    ? "데이터 버스"
                    : "제어 버스"}
              </text>
              {!wide && (
                <text
                  x={133 + i * 220}
                  y="543"
                  fontSize="14"
                  fill="var(--ar-text-muted)"
                >
                  {kind === "control" ? "읽기 / 쓰기" : "32비트"}
                </text>
              )}
            </g>
          ))}
        </g>
        <g aria-label="현재 이동 데이터" data-transfer={transfer.id}>
          <rect
            x="16"
            y="12"
            width={wide ? 948 : 628}
            height="116"
            rx="14"
            fill="var(--ar-header-bg)"
            stroke={color}
            strokeWidth="2"
          />
          <text x="32" y="39" fontSize="18" fontWeight="650" fill={color}>
            {index + 1} / {count} · {transfer.title}
          </text>
          <text
            x="32"
            y="77"
            fontSize="26"
            className="font-mono"
            fontWeight="700"
            fill="var(--ar-text-primary)"
            data-transfer-value="true"
          >
            {payload}
          </text>
          <text x="32" y="105" fontSize="15" fill="var(--ar-text-muted)">
            {transfer.detail}
          </text>
        </g>
        <text
          x="24"
          y={wide ? 589 : 765}
          fontSize="12"
          fill="var(--ar-text-muted)"
        >
          CPU–메모리 연결의 버스 역할을 설명한 개념도입니다.
        </text>
      </svg>
    </div>
  );
}
