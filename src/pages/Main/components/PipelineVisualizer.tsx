import React from "react";
import type { CycleHistoryItem, SimulationResult, StageBuffer } from "@/type/simulation";
import SingleCycleDatapath from "./SingleCycleDatapath";

interface PipelineVisualizerProps {
  currentData: CycleHistoryItem | null;
  prevData?: CycleHistoryItem | null;
  simulationData?: SimulationResult | null;
  loadingMessage?: string | null;
  mode?: "single" | "pipeline";
}

// 9개 층(Row) 정의
interface LayerDef {
  id: string;
  type: "stage" | "buffer";
  key?: "IF" | "ID" | "EX" | "MEM" | "WB";
  bufferName?: string;
  titleLines?: [string, string];
  colors: {
    badgeBg: string;
    badgeText: string;
  };
}

const NINE_LAYERS: LayerDef[] = [
  // 1층: IF Stage
  {
    id: "layer-1-if",
    type: "stage",
    key: "IF",
    titleLines: ["Instruction", "Fetch"],
    colors: {
      badgeBg: "bg-red-500",
      badgeText: "text-white",
    },
  },
  // 2층: IF / ID Buffer
  {
    id: "layer-2-buf-if-id",
    type: "buffer",
    bufferName: "IF / ID BUFFER",
    colors: {
      badgeBg: "",
      badgeText: "",
    },
  },
  // 3층: ID Stage
  {
    id: "layer-3-id",
    type: "stage",
    key: "ID",
    titleLines: ["Instruction", "Decode"],
    colors: {
      badgeBg: "bg-orange-500",
      badgeText: "text-white",
    },
  },
  // 4층: ID / EX Buffer
  {
    id: "layer-4-buf-id-ex",
    type: "buffer",
    bufferName: "ID / EX BUFFER",
    colors: {
      badgeBg: "",
      badgeText: "",
    },
  },
  // 5층: EX Stage
  {
    id: "layer-5-ex",
    type: "stage",
    key: "EX",
    titleLines: ["Execution", "(ALU)"],
    colors: {
      badgeBg: "bg-emerald-600",
      badgeText: "text-white",
    },
  },
  // 6층: EX / MEM Buffer
  {
    id: "layer-6-buf-ex-mem",
    type: "buffer",
    bufferName: "EX / MEM BUFFER",
    colors: {
      badgeBg: "",
      badgeText: "",
    },
  },
  // 7층: MEM Stage
  {
    id: "layer-7-mem",
    type: "stage",
    key: "MEM",
    titleLines: ["Memory", "Access"],
    colors: {
      badgeBg: "bg-sky-500",
      badgeText: "text-white",
    },
  },
  // 8층: MEM / WB Buffer
  {
    id: "layer-8-buf-mem-wb",
    type: "buffer",
    bufferName: "MEM / WB BUFFER",
    colors: {
      badgeBg: "",
      badgeText: "",
    },
  },
  // 9층: WB Stage
  {
    id: "layer-9-wb",
    type: "stage",
    key: "WB",
    titleLines: ["Write", "Back"],
    colors: {
      badgeBg: "bg-purple-600",
      badgeText: "text-white",
    },
  },
];

const PipelineVisualizer: React.FC<PipelineVisualizerProps> = ({
  currentData,
  prevData,
  simulationData,
  loadingMessage,
  mode = "pipeline",
}) => {
  const isSingle = mode === "single";

  if (isSingle) {
    return (
      <SingleCycleDatapath
        currentData={currentData}
        prevData={prevData}
        simulationData={simulationData}
        loadingMessage={loadingMessage}
      />
    );
  }

  if (loadingMessage) {
    return (
      <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] p-6 flex flex-col items-center justify-center gap-3 text-center transition-colors duration-150">
        <div className="w-9 h-9 border-3 border-[var(--ar-accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-[var(--ar-accent)]">{loadingMessage}</p>
        <p className="text-xs text-[var(--ar-text-muted)]">컴파일 및 파이프라인 시뮬레이션 결과를 준비하고 있습니다.</p>
      </div>
    );
  }

  if (!currentData) {
    return (
      <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] p-6 flex items-center justify-center text-[var(--ar-text-muted)] text-sm transition-colors duration-150">
        C 소스 코드를 작성하고 [⚡ 컴파일]을 누르면 파이프라인 데이터패스가 활성화됩니다.
      </div>
    );
  }

  const { buffers, cycle_events, clock } = currentData;
  const isStall = Boolean(cycle_events?.stall?.has_stall);
  const isForward = Boolean(cycle_events?.forwarding?.has_forwarded);
  const isBranchFlush = Boolean(cycle_events?.control_hazard?.has_flush);

  const getStageBuffer = (key?: "IF" | "ID" | "EX" | "MEM" | "WB"): StageBuffer | null => {
    if (!key) return null;
    return buffers?.[key] ?? null;
  };

  return (
    <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] flex flex-col min-h-0 h-full overflow-hidden select-none transition-colors duration-150 font-mono">
      {/* 상단 헤더 바 */}
      <div className="h-8 shrink-0 flex items-center justify-between px-3.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 border-l-2 border-l-purple-500 font-sans">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold text-purple-500">◆</span>
          <h3 className="font-sans text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wide whitespace-nowrap">
            PIPELINE DATAPATH
          </h3>
          <span className="text-[10px] text-[var(--ar-text-muted)] font-mono">(CLK:{clock ?? 0})</span>
        </div>

        {/* 이벤트 뱃지 */}
        <div className="flex items-center gap-1.5">
          {isStall && (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-white animate-pulse shadow-2xs">
              ⚠️ Stall
            </span>
          )}
          {isForward && (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-600 text-white shadow-2xs">
              ⇄ FWD
            </span>
          )}
          {isBranchFlush && (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-500 text-white shadow-2xs">
              🔄 Flush
            </span>
          )}
        </div>
      </div>

      {/* 
        9개 층 3열 그리드:
        - 세로 전체를 100% 꽉 채우도록 비율(fr)과 버퍼 고정 높이(18px) 결합: 아래 여백 제거
        - 경계선(border) 전부 제거하여 시원하고 깔끔한 오픈형 레이아웃
      */}
      <div className="flex-1 min-h-0 w-full overflow-auto p-0 custom-scrollbar">
        <div
          className="w-full min-w-[720px] min-h-[750px] h-full grid grid-cols-[105px_minmax(420px,1fr)_220px] gap-0 items-stretch"
          style={{
            gridTemplateRows: "3fr 18px 3fr 18px 3fr 18px 2fr 18px 2fr",
          }}
        >
        {NINE_LAYERS.map((layer) => {
          const isBuffer = layer.type === "buffer";
          const buf = getStageBuffer(layer.key);
          const rawAsm = buf?.assembly?.trim();
          const hasInst = Boolean(rawAsm && rawAsm !== "empty" && rawAsm !== "bubble");

          // ID 단계부터 WB 단계까지(층 3~9) 2열 좌측에 Write-Back 피드백 버스 세로 테두리 적용
          const hasFeedbackBorder = layer.id !== "layer-1-if" && layer.id !== "layer-2-buf-if-id";
          const feedbackBorderClass = hasFeedbackBorder
            ? "border-l-2 border-purple-600 dark:border-purple-400"
            : "";

          // 짝수행 (버퍼 레지스터 행)
          if (isBuffer) {
            return (
              <React.Fragment key={layer.id}>
                {/* 1열: 비움 */}
                <div className="min-h-0" />

                {/* 2열: 버퍼 레지스터 바 (좌측에 피드백 세로선 테두리 적용 & 가로 길이를 적절히 늘려 시원하게) */}
                <div
                  className={`bg-transparent px-3 py-0.5 flex items-stretch justify-center min-h-0 ${feedbackBorderClass}`}
                >
                  <div className="w-full max-w-[470px] h-full bg-slate-100/90 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 flex items-center justify-center rounded-md shadow-2xs">
                    <span className="text-[10px] font-bold font-sans text-slate-700 dark:text-slate-200 tracking-wider leading-none">
                      {layer.bufferName}
                    </span>
                  </div>
                </div>

                {/* 3열: 비움 */}
                <div className="min-h-0" />
              </React.Fragment>
            );
          }

          // 홀수행 (스테이지 행)
          return (
            <React.Fragment key={layer.id}>
              {/* 1열: 스테이지명 뱃지 */}
              <div
                className="px-1 py-1 flex items-center justify-center min-h-0 overflow-hidden"
              >
                <div
                  className={`w-[78px] h-[32px] flex flex-col items-center justify-center text-center rounded-[5px] ${layer.colors.badgeBg} ${layer.colors.badgeText} select-none shadow-2xs shrink-0`}
                >
                  <span className="text-[11px] font-bold font-sans leading-tight tracking-tight">
                    {layer.titleLines?.[0]}
                  </span>
                  <span className="text-[11px] font-bold font-sans leading-tight tracking-tight">
                    {layer.titleLines?.[1]}
                  </span>
                </div>
              </div>

              {/* 2열: 요소 및 다이어그램 */}
              <div
                className="bg-transparent p-0 flex items-stretch justify-center min-h-0 overflow-hidden relative"
              >
                {/* 
                  Write-Back 피드백 버스 세로선 (절대 위치로 시작점과 끝점 길이 정밀 제어):
                  - ID 층(3층): Registers 중간 높이(약 57.2%)부터 바닥까지만 채움 (위쪽 비움)
                  - WB 층(9층): 천장부터 MemtoReg MUX 가로 라인 높이(약 88.3%)까지만 채움 (아래쪽 비움)
                  - 중간 층(EX, MEM): 100% 꽉 채워서 관통
                */}
                {layer.key === "ID" && (
                  <div
                    className="absolute left-0 bottom-0 w-[2px] bg-purple-600 dark:bg-purple-400 z-10 pointer-events-none"
                    style={{ top: "57.2%" }}
                  />
                )}
                {layer.key === "WB" && (
                  <div
                    className="absolute left-0 top-0 w-[2px] bg-purple-600 dark:bg-purple-400 z-10 pointer-events-none"
                    style={{ height: "88.33%" }}
                  />
                )}
                {(layer.key === "EX" || layer.key === "MEM") && (
                  <div className="absolute left-0 inset-y-0 w-[2px] bg-purple-600 dark:bg-purple-400 z-10 pointer-events-none" />
                )}
                {layer.key === "IF" ? (
                  <svg
                    viewBox="0 0 500 180"
                    preserveAspectRatio="none"
                    className="w-full h-full select-none block font-sans"
                  >
                    <defs>
                      <marker
                        id="arr-pipe"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                      >
                        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="currentColor" className="text-slate-700 dark:text-slate-300" />
                      </marker>
                      <marker
                        id="arr-nextpc"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                      >
                        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94A3B8" />
                      </marker>
                    </defs>

                    {/* Next PC 회귀 점선 */}
                    <path
                      d="M 440 12 L 440 24 L 180 24 L 180 34"
                      fill="none"
                      stroke="#94A3B8"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      markerEnd="url(#arr-nextpc)"
                    />
                    <text x="445" y="20" className="text-[9px] font-mono fill-neutral-500">
                      Next PC
                    </text>

                    {/* PC 박스 */}
                    <g>
                      <rect
                        x="110"
                        y="34"
                        width="140"
                        height="44"
                        rx="8"
                        className="fill-rose-50 dark:fill-rose-950/60 stroke-rose-400 dark:stroke-rose-600"
                        strokeWidth="2"
                      />
                      <text x="180" y="61" textAnchor="middle" className="text-[14px] font-bold fill-rose-950 dark:fill-rose-100 font-sans tracking-wide">
                        PC
                      </text>
                    </g>

                    {/* PC -> PC+4 화살표 */}
                    <path
                      d="M 250 56 L 320 56"
                      fill="none"
                      className="stroke-slate-700 dark:stroke-slate-300"
                      strokeWidth="2"
                      markerEnd="url(#arr-pipe)"
                    />

                    {/* PC + 4 가산기 (모던 사다리꼴) */}
                    <polygon
                      points="330,36 410,36 396,76 344,76"
                      className="fill-white dark:fill-neutral-900 stroke-slate-500 dark:stroke-slate-400"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <text x="370" y="60" textAnchor="middle" className="text-[12px] font-bold fill-slate-800 dark:fill-slate-200 font-sans">
                      PC + 4
                    </text>

                    {/* PC -> Instruction Memory 화살표 */}
                    <path
                      d="M 180 78 L 180 102"
                      fill="none"
                      className="stroke-slate-700 dark:stroke-slate-300"
                      strokeWidth="2"
                      markerEnd="url(#arr-pipe)"
                    />

                    {/* Instruction Memory 박스 */}
                    <g>
                      <rect
                        x="50"
                        y="102"
                        width="260"
                        height="46"
                        rx="8"
                        className="fill-blue-50 dark:fill-blue-950/50 stroke-blue-400 dark:stroke-blue-600"
                        strokeWidth="2"
                      />
                      <text x="180" y="130" textAnchor="middle" className="text-[14px] font-bold fill-blue-950 dark:fill-blue-100 font-sans tracking-wide">
                        Instruction Memory
                      </text>
                    </g>

                    {/* Instruction Memory -> 바닥 버퍼 직결 화살표 */}
                    <path
                      d="M 180 148 L 180 178"
                      fill="none"
                      className="stroke-slate-700 dark:stroke-slate-300"
                      strokeWidth="2.2"
                      markerEnd="url(#arr-pipe)"
                    />
                  </svg>
                ) : layer.key === "ID" ? (
                  /* ══════════════════════════════════════════════════════════════
                      2. ID Stage: Registers / Imm Gen / Control Unit
                  ══════════════════════════════════════════════════════════════ */
                  <svg
                    viewBox="0 0 500 180"
                    preserveAspectRatio="none"
                    className="w-full h-full select-none block font-sans"
                  >
                    {/* 상단 버퍼에서 들어오는 입력선 */}
                    <path
                      d="M 220 0 L 220 40"
                      fill="none"
                      className="stroke-slate-700 dark:stroke-slate-300"
                      strokeWidth="2"
                    />
                    {/* 분기선 (Registers & Imm Gen으로 분기) */}
                    <path
                      d="M 115 40 L 330 40"
                      fill="none"
                      className="stroke-slate-700 dark:stroke-slate-300"
                      strokeWidth="2"
                    />
                    <path
                      d="M 115 40 L 115 60"
                      fill="none"
                      className="stroke-slate-700 dark:stroke-slate-300"
                      strokeWidth="1.8"
                      markerEnd="url(#arr-pipe)"
                    />
                    <path
                      d="M 330 40 L 330 60"
                      fill="none"
                      className="stroke-slate-700 dark:stroke-slate-300"
                      strokeWidth="1.8"
                      markerEnd="url(#arr-pipe)"
                    />

                    {/* 1. Registers (Register File) 박스 (y=60으로 하향 조정) */}
                    <g>
                      <rect
                        x="30"
                        y="60"
                        width="170"
                        height="86"
                        rx="8"
                        className="fill-emerald-50 dark:fill-emerald-950/50 stroke-emerald-500 dark:stroke-emerald-600"
                        strokeWidth="2"
                      />
                      <text x="115" y="108" textAnchor="middle" className="text-[14px] font-bold fill-emerald-950 dark:fill-emerald-100 font-sans tracking-wide">
                        Registers
                      </text>
                    </g>

                    {/* WB 피드백 버스(좌측 테두리 x=0) -> Registers 진입 화살표 */}
                    <path
                      d="M 0 103 L 30 103"
                      fill="none"
                      className="stroke-purple-600 dark:stroke-purple-400"
                      strokeWidth="2"
                      markerEnd="url(#arr-pipe)"
                    />

                    {/* 2. Imm Gen (타원형으로 복원 & y=103으로 하향 정렬) */}
                    <g>
                      <ellipse
                        cx="330"
                        cy="103"
                        rx="60"
                        ry="42"
                        className="fill-sky-50 dark:fill-sky-950/50 stroke-sky-500 dark:stroke-sky-600"
                        strokeWidth="2"
                      />
                      <text x="330" y="108" textAnchor="middle" className="text-[14px] font-bold fill-sky-950 dark:fill-sky-100 font-sans tracking-wide">
                        Imm Gen
                      </text>
                    </g>

                    {/* 바닥 ID/EX 버퍼로 향하는 출력 화살표들 (y=178 바닥 직결) */}
                    <path
                      d="M 85 146 L 85 178"
                      fill="none"
                      className="stroke-emerald-600 dark:stroke-emerald-400"
                      strokeWidth="2"
                      markerEnd="url(#arr-pipe)"
                    />
                    <path
                      d="M 145 146 L 145 178"
                      fill="none"
                      className="stroke-emerald-600 dark:stroke-emerald-400"
                      strokeWidth="2"
                      markerEnd="url(#arr-pipe)"
                    />
                    <path
                      d="M 330 145 L 330 178"
                      fill="none"
                      className="stroke-sky-600 dark:stroke-sky-400"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      markerEnd="url(#arr-pipe)"
                    />
                  </svg>
                ) : layer.key === "EX" ? (
                  /* ══════════════════════════════════════════════════════════════
                      3. EX Stage: ALU / ALUSrc MUX / Branch Add
                  ══════════════════════════════════════════════════════════════ */
                  <svg
                    viewBox="0 0 500 180"
                    preserveAspectRatio="none"
                    className="w-full h-full select-none block font-sans"
                  >
                    {/* ID/EX 버퍼에서 내려오는 Operand A (rs1) 입력 */}
                    <path
                      d="M 85 0 L 85 46 L 140 46 L 140 66"
                      fill="none"
                      className="stroke-slate-700 dark:stroke-slate-300"
                      strokeWidth="2"
                      markerEnd="url(#arr-pipe)"
                    />

                    {/* ALUSrc MUX (알약형 / Stadium Capsule - y=16으로 상향 배치하여 ALU와 완전 분리) */}
                    <rect
                      x="270"
                      y="16"
                      width="42"
                      height="34"
                      rx="17"
                      ry="17"
                      className="fill-sky-50 dark:fill-sky-950/60 stroke-sky-500 dark:stroke-sky-600"
                      strokeWidth="1.8"
                    />
                    <text x="291" y="37" textAnchor="middle" className="text-[10px] font-bold fill-sky-900 dark:fill-sky-100 font-sans">
                      MUX
                    </text>

                    {/* ID/EX 버퍼에서 내려와 MUX로 들어가는 입력 2개 */}
                    <path
                      d="M 145 0 L 145 10 L 282 10 L 282 16"
                      fill="none"
                      className="stroke-slate-700 dark:stroke-slate-300"
                      strokeWidth="1.5"
                      markerEnd="url(#arr-pipe)"
                    />
                    <path
                      d="M 300 0 L 300 16"
                      fill="none"
                      className="stroke-sky-600 dark:stroke-sky-400"
                      strokeWidth="1.8"
                      strokeDasharray="4 3"
                      markerEnd="url(#arr-pipe)"
                    />

                    {/* MUX 출력 -> 아래로 내려와 ALU 오른쪽 어깨(x=240, y=66)로 꽂히는 화살표 */}
                    <path
                      d="M 291 50 L 291 56 L 240 56 L 240 66"
                      fill="none"
                      className="stroke-slate-700 dark:stroke-slate-300"
                      strokeWidth="2"
                      markerEnd="url(#arr-pipe)"
                    />

                    {/* ALU (y=66으로 추가 하향 조정하여 MUX와 여유 있는 거리 확보) */}
                    <polygon
                      points="105,66 172,66 190,84 208,66 275,66 252,142 128,142"
                      className="fill-amber-50 dark:fill-amber-950/50 stroke-amber-500 dark:stroke-amber-600"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    <text x="190" y="116" textAnchor="middle" className="text-[17px] font-bold font-sans fill-amber-950 dark:fill-amber-100 tracking-wider">
                      ALU
                    </text>

                    {/* 우측 Branch Add (가산기 사다리꼴) */}
                    <polygon
                      points="370,66 440,66 428,106 382,106"
                      className="fill-white dark:fill-neutral-900 stroke-slate-500 dark:stroke-slate-400"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <text x="405" y="90" textAnchor="middle" className="text-[11px] font-bold fill-slate-800 dark:fill-slate-200 font-sans">
                      Branch Add
                    </text>

                    {/* ALU Result -> EX/MEM 버퍼 직결 화살표 (y=178 바닥 밀착) */}
                    <path
                      d="M 190 142 L 190 178"
                      fill="none"
                      className="stroke-amber-600 dark:stroke-amber-400"
                      strokeWidth="2.2"
                      markerEnd="url(#arr-pipe)"
                    />

                    {/* Branch Target -> EX/MEM 버퍼 직결 화살표 */}
                    <path
                      d="M 405 106 L 405 178"
                      fill="none"
                      stroke="#94A3B8"
                      strokeWidth="1.6"
                      strokeDasharray="4 3"
                      markerEnd="url(#arr-pipe)"
                    />
                  </svg>
                ) : layer.key === "MEM" ? (
                  /* ══════════════════════════════════════════════════════════════
                      4. MEM Stage: Data Memory
                  ══════════════════════════════════════════════════════════════ */
                  <svg
                    viewBox="0 0 500 120"
                    preserveAspectRatio="none"
                    className="w-full h-full select-none block font-sans"
                  >
                    {/* EX/MEM 버퍼에서 내려오는 ALU Result 화살표 */}
                    <path
                      d="M 190 0 L 190 38"
                      fill="none"
                      className="stroke-amber-600 dark:stroke-amber-400"
                      strokeWidth="2"
                      markerEnd="url(#arr-pipe)"
                    />

                    {/* ALU Result Bypass 선 (좌측으로 우회하여 MEM/WB 버퍼로 직통) */}
                    <path
                      d="M 190 24 L 90 24 L 90 118"
                      fill="none"
                      className="stroke-amber-600 dark:stroke-amber-400"
                      strokeWidth="1.8"
                      strokeDasharray="4 3"
                      markerEnd="url(#arr-pipe)"
                    />
                    <text x="96" y="68" className="text-[9px] font-mono fill-amber-700 dark:fill-amber-300">
                      ALU Bypass
                    </text>

                    {/* Data Memory 박스 (y=24 -> y=38로 하향 조정) */}
                    <g>
                      <rect
                        x="150"
                        y="38"
                        width="240"
                        height="58"
                        rx="8"
                        className="fill-sky-50 dark:fill-sky-950/50 stroke-sky-500 dark:stroke-sky-600"
                        strokeWidth="2"
                      />
                      <text x="270" y="72" textAnchor="middle" className="text-[14px] font-bold fill-sky-950 dark:fill-sky-100 font-sans tracking-wide">
                        Data Memory
                      </text>
                    </g>

                    {/* Data Memory -> MEM/WB 버퍼 직결 화살표 (y=118 바닥 밀착) */}
                    <path
                      d="M 270 96 L 270 118"
                      fill="none"
                      className="stroke-sky-600 dark:stroke-sky-400"
                      strokeWidth="2.2"
                      markerEnd="url(#arr-pipe)"
                    />
                  </svg>
                ) : (
                  /* ══════════════════════════════════════════════════════════════
                      5. WB Stage: MemtoReg MUX
                  ══════════════════════════════════════════════════════════════ */
                  <svg
                    viewBox="0 0 500 120"
                    preserveAspectRatio="none"
                    className="w-full h-full select-none block font-sans"
                  >
                    {/* MEM/WB 버퍼에서 내려오는 두 입력선 (Bypass vs Read Data) */}
                    <path
                      d="M 90 0 L 90 32 L 200 32 L 200 44"
                      fill="none"
                      className="stroke-amber-600 dark:stroke-amber-400"
                      strokeWidth="1.8"
                      strokeDasharray="4 3"
                      markerEnd="url(#arr-pipe)"
                    />
                    <path
                      d="M 270 0 L 270 44"
                      fill="none"
                      className="stroke-sky-600 dark:stroke-sky-400"
                      strokeWidth="2"
                      markerEnd="url(#arr-pipe)"
                    />

                    {/* MemtoReg MUX (알약형 / Stadium Capsule) */}
                    <rect
                      x="165"
                      y="44"
                      width="140"
                      height="40"
                      rx="20"
                      ry="20"
                      className="fill-purple-50 dark:fill-purple-950/60 stroke-purple-500 dark:stroke-purple-600"
                      strokeWidth="1.8"
                    />
                    <text x="235" y="68" textAnchor="middle" className="text-[12px] font-bold fill-purple-950 dark:fill-purple-100 font-sans">
                      MemtoReg MUX
                    </text>

                    {/* MUX 출력 -> 좌측 피드백 테두리선(x=0)으로 연결되는 수평선 */}
                    <path
                      d="M 235 84 L 235 106 L 0 106"
                      fill="none"
                      className="stroke-purple-600 dark:stroke-purple-400"
                      strokeWidth="2"
                    />
                    <text x="110" y="100" className="text-[9.5px] font-mono font-bold fill-purple-700 dark:fill-purple-300">
                      Write Data to rd
                    </text>
                  </svg>
                )}
              </div>

              {/* 3열: 스테이지별 명령어 및 정보 (경계선 제거) */}
              <div
                className="bg-transparent px-3 py-1 flex flex-col justify-center text-[10px] leading-relaxed min-h-0 overflow-hidden font-mono"
              >
                <span className="font-sans font-semibold text-[var(--ar-text-primary)] mb-0.5">
                  {layer.key} Stage
                </span>
                <span className="text-[var(--ar-text-muted)] truncate font-mono">
                  {hasInst ? rawAsm : "bubble"}
                </span>
              </div>
            </React.Fragment>
          );
        })}
        </div>
      </div>
    </div>
  );
};

export default PipelineVisualizer;
