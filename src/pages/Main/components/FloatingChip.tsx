import React from "react";

export interface FloatingChipProps {
  x: number;
  y: number;
  text?: string;
  lines?: string[];
  stroke: string;
  title: string;
  opacity?: number;
  fontSize?: number;
}

/** 파이프라인/싱글사이클 공통 이동 데이터·제어 칩 SVG 요소 */
export const FloatingChip: React.FC<FloatingChipProps> = ({
  x,
  y,
  text,
  lines,
  stroke,
  title,
  opacity = 1.0,
  fontSize,
}) => {
  const displayLines = lines && lines.length > 0 ? lines : [text || ""];
  const maxLineLen = Math.max(...displayLines.map((l) => l.length));
  const isMulti = displayLines.length > 1;
  const effectiveFontSize = fontSize ?? (isMulti ? 14 : 16);
  const chipWidth = Math.max(
    isMulti ? 88 : 68,
    maxLineLen * (isMulti ? 9.0 : 9.8) + (isMulti ? 28 : 32),
  );
  const chipHeight = isMulti ? displayLines.length * 19 + 14 : 30;
  const rx = isMulti ? 10 : 15;

  return (
    <g
      className="cursor-pointer pointer-events-auto"
      data-flow-marker="true"
      data-moving-value={displayLines.join(" / ")}
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
        const lineOffset = isMulti
          ? (idx - (displayLines.length - 1) / 2) * 18
          : 0;
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
