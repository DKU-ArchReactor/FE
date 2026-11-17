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
    bufferName: "IF / ID PIPELINE REGISTER",
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
    bufferName: "ID / EX PIPELINE REGISTER",
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
    bufferName: "EX / MEM PIPELINE REGISTER",
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
    bufferName: "MEM / WB PIPELINE REGISTER",
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
            PIPELINE DATAPATH (9×3 GRID)
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
        ★ 9개 층 그리드:
        - 1열: 105px (가로 테두리 없음, 내부 색상 없음, 컴팩트하고 균형잡힌 스테이지 뱃지)
        - 2열: 1fr (p-0)
        - 3열: 240px
      */}
      <div
        className="flex-1 min-h-0 w-full overflow-hidden p-0 grid grid-cols-[105px_1fr_240px] gap-0 items-stretch"
        style={{
          gridTemplateRows: "3fr 0.4fr 3fr 0.4fr 3fr 0.4fr 2fr 0.4fr 2fr",
        }}
      >
        {NINE_LAYERS.map((layer, rowIndex) => {
          const isBuffer = layer.type === "buffer";
          const isLastRow = rowIndex === NINE_LAYERS.length - 1;
          const buf = getStageBuffer(layer.key);
          const rawAsm = buf?.assembly?.trim();
          const hasInst = Boolean(rawAsm && rawAsm !== "empty" && rawAsm !== "bubble");

          // 1열은 가로 테두리 없음(border-b 제거). 2열과 3열만 가로 테두리 적용
          const borderBottom = isLastRow ? "" : "border-b border-[var(--ar-border)]";

          // ─────────────────────────────────────────────────────────────
          // 짝수행 (버퍼 행)
          // ─────────────────────────────────────────────────────────────
          if (isBuffer) {
            return (
              <React.Fragment key={layer.id}>
                {/* 1열: 가로 테두리 X, 배경색 X (우측 세로 경계선 border-r만 유지) */}
                <div className="border-r border-[var(--ar-border)] min-h-0" />

                {/* 2열: 내부 여백 p-0으로 꽉 찬 파스텔톤 노란 버퍼 바 */}
                <div
                  className={`border-r ${borderBottom} bg-[var(--ar-panel-bg)]/40 p-0 flex items-stretch justify-center min-h-0`}
                >
                  <div className="w-full h-full rounded-md bg-amber-100/85 dark:bg-amber-950/50 flex items-center justify-center">
                    <span className="text-[10px] font-bold font-mono text-amber-900 dark:text-amber-200 tracking-wider">
                      {layer.bufferName}
                    </span>
                  </div>
                </div>

                {/* 3열: 비움 */}
                <div className={`${borderBottom} bg-[var(--ar-panel-bg)]/40 min-h-0`} />
              </React.Fragment>
            );
          }

          // ─────────────────────────────────────────────────────────────
          // 홀수행 (스테이지 행)
          // ─────────────────────────────────────────────────────────────
          return (
            <React.Fragment key={layer.id}>
              {/* 1열: 가로 테두리 없음, 내부 배경색 없음, 비율에 맞춘 컴팩트한 크기 통일 */}
              <div
                className="border-r border-[var(--ar-border)] px-1 py-1 flex items-center justify-center min-h-0 overflow-hidden"
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

              {/* 2열: 중앙 회로도 영역 (p-0) */}
              <div
                className={`border-r ${borderBottom} bg-[var(--ar-panel-bg)] p-0 flex items-center justify-center min-h-0 overflow-hidden relative`}
              >
                {layer.key === "IF" ? (
                  /* 2열 전체 높이를 100% 활용하여 버퍼에 완벽하게 직결되는 순수 HTML 와이어프레임 */
                  <div className="w-full h-full p-2 flex flex-col justify-between relative select-none">
                    {/* 상단: Next PC 루프선 영역 + PC & PC+4 행 */}
                    <div className="w-full flex flex-col items-center pt-1">
                      {/* 점선 Next PC 피드백 바 */}
                      <div className="w-[320px] flex items-center justify-between text-[10px] font-mono text-black mb-1">
                        <div className="flex items-center gap-1">
                          <span>▼</span>
                          <span className="h-[1px] w-32 border-b border-dashed border-black"></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="h-[1px] w-24 border-b border-dashed border-black"></span>
                          <span>Next PC</span>
                        </div>
                      </div>

                      {/* PC 레지스터 & PC + 4 가산기 */}
                      <div className="flex items-center justify-center gap-3 w-full">
                        {/* PC 레지스터 (라운드 박스) */}
                        <div className="w-[140px] h-[38px] rounded-md border border-black flex flex-col items-center justify-center bg-transparent shrink-0">
                          <span className="text-[12px] font-bold font-sans leading-none mb-0.5">PC</span>
                          <span className="text-[11px] font-mono font-bold leading-none">
                            {buf?.pc ?? "0x00010000"}
                          </span>
                        </div>

                        {/* PC ➔ Adder 화살표 */}
                        <div className="flex items-center text-black text-[12px] font-mono">
                          ──►
                        </div>

                        {/* PC + 4 가산기 (라운드 박스) */}
                        <div className="w-[80px] h-[34px] rounded-md border border-black flex items-center justify-center bg-transparent shrink-0">
                          <span className="text-[12px] font-bold font-sans">PC + 4</span>
                        </div>
                      </div>
                    </div>

                    {/* PC ➔ Instruction Memory 연결 화살표 */}
                    <div className="w-full flex justify-center items-center py-0.5">
                      <div className="flex flex-col items-center text-black text-[11px] leading-none">
                        <span className="h-2 w-[1px] bg-black"></span>
                        <span>▼</span>
                      </div>
                    </div>

                    {/* 부품 2: Instruction Memory (라운드 박스) */}
                    <div className="w-full flex justify-center">
                      <div className="w-[320px] h-[48px] rounded-md border border-black flex flex-col items-center justify-center bg-transparent">
                        <span className="text-[13px] font-bold font-sans leading-tight">
                          Instruction Memory
                        </span>
                        <span className="text-[10px] font-mono text-neutral-600 leading-tight">
                          Read Inst [31:0] @ PC
                        </span>
                      </div>
                    </div>

                    {/* Instruction Memory ➔ IF/ID 버퍼 직하강 화살표 (바닥 0px까지 꽉 채움) */}
                    <div className="w-full flex-1 flex flex-col items-center justify-end pb-0">
                      <span className="w-[1px] flex-1 bg-black min-h-[8px]"></span>
                      <span className="text-black text-[11px] leading-none mb-[-2px]">▼</span>
                    </div>
                  </div>
                ) : (
                  <span className="font-semibold text-[11px] text-[var(--ar-text-muted)]">
                    [Row {rowIndex + 1} 중앙] {layer.key} 회로 부품
                  </span>
                )}
              </div>

              {/* 3열: 우측 해저드/동작 설명 영역 */}
              <div
                className={`${borderBottom} bg-[var(--ar-panel-bg)] px-3 py-1 flex flex-col justify-center text-[10px] leading-relaxed min-h-0 overflow-hidden`}
              >
                <span className="font-sans font-semibold text-[var(--ar-text-primary)] mb-0.5">
                  [Row {rowIndex + 1} 우측] {layer.key} 상태
                </span>
                <span className="text-[var(--ar-text-muted)] truncate">
                  {hasInst ? `명령어: ${rawAsm}` : "대기 상태 (Idle / Bubble)"}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default PipelineVisualizer;
