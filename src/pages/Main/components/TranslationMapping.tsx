import { useMemo, useEffect, useRef } from "react";
import { mapAssembly, type MappedAssemblyRow } from "./translationCompile";
import type { StageBuffer, SimulationResult } from "@/type/simulation";
import { findAssemblyRow } from '../simulationView';

type Props = {
  instructions?: SimulationResult['program']['instructions'];
  source: string;
  assembly: string;
  busy: boolean;
  error: string;
  selectedLine?: number | null;
  selectedAsmIndex?: number | null;
  executionLine?: number | null;
  onSelectLine?: (line: number | null, asmIndex?: number | null) => void;
  stageBuffers?: {
    IF?: StageBuffer | null;
    ID?: StageBuffer | null;
    EX?: StageBuffer | null;
    MEM?: StageBuffer | null;
    WB?: StageBuffer | null;
  };
  mode?: "single" | "pipeline"; // 싱글 사이클 모드 vs 5단계 파이프라인 모드
  currentActiveStep?: number | null; // Single 모드에서 현재 실행 중인 어셈블리 행 인덱스 (0~17)
};

const STAGES_CONFIG: {
  key: "IF" | "ID" | "EX" | "MEM" | "WB";
  name: string;
  badgeBg: string;
}[] = [
  { key: "IF", name: "IF", badgeBg: "bg-indigo-600 text-white" },
  { key: "ID", name: "ID", badgeBg: "bg-sky-600 text-white" },
  { key: "EX", name: "EX", badgeBg: "bg-amber-600 text-white" },
  { key: "MEM", name: "MEM", badgeBg: "bg-emerald-600 text-white" },
  { key: "WB", name: "WB", badgeBg: "bg-rose-600 text-white" },
];

// 명령어(Opcode)와 피연산자(Operands) 분리 헬퍼
function splitInstruction(text: string): { opcode: string; operands: string } {
  const trimmed = text.trim();
  const firstSpace = trimmed.search(/\s/);
  if (firstSpace === -1) {
    return { opcode: trimmed, operands: "" };
  }
  const rawOperands = trimmed.slice(firstSpace).trim();
  // 쉼표 다음에 공백이 없으면 공백 한 칸 추가 (예: "a0,a1" -> "a0, a1")
  const formattedOperands = rawOperands.replace(/,([^\s])/g, ", $1");
  return {
    opcode: trimmed.slice(0, firstSpace),
    operands: formattedOperands,
  };
}

export default function TranslationMapping({
  instructions,
  source,
  assembly,
  busy,
  error,
  selectedLine,
  selectedAsmIndex,
  executionLine,
  onSelectLine,
  stageBuffers,
  mode = "pipeline",
  currentActiveStep,
}: Props) {
  const sourceLines = source.split(/\r?\n/);
  const rows: MappedAssemblyRow[] = useMemo(
    () => mapAssembly(assembly, sourceLines.length),
    [assembly, sourceLines.length]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const rowElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  // 파이프라인 스테이지별 활성 명령어 매핑 (현재 클록 사이클 기준)
  const activeStagesByInst = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!stageBuffers || mode === "single") return map;

    STAGES_CONFIG.forEach(({ key, name }) => {
      const buf = stageBuffers[key];
      if (buf && findAssemblyRow(rows, buf, instructions) !== null) {
        const norm = buf.assembly.replace(/\s+/g, " ").trim().toLowerCase();
        if (norm) {
          if (!map[norm]) map[norm] = [];
          if (!map[norm].includes(name)) map[norm].push(name);
        }
      }
    });
    return map;
  }, [stageBuffers, mode, rows, instructions]);

  // 헬퍼: 타겟 요소(그룹 마지막 행)가 컨테이너 뷰포트 하단에 완전히 드러나도록 스크롤
  const scrollGroupIntoView = (lastEl: HTMLElement, firstEl?: HTMLElement) => {
    const container = containerRef.current;
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    const lastRect = lastEl.getBoundingClientRect();

    // 그룹 마지막 행의 바닥이 컨테이너 바닥보다 아래에 있다면 -> 끝까지 확실하게 아래로 스크롤 (여백 28px)
    if (lastRect.bottom > cRect.bottom - 28) {
      const scrollDiff = lastRect.bottom - (cRect.bottom - 28);
      container.scrollTo({
        top: container.scrollTop + scrollDiff,
        behavior: "smooth",
      });
      return;
    }

    // 그룹 첫 번째 행이 컨테이너 천장보다 위에 있다면 -> 위로 스크롤
    if (firstEl) {
      const firstRect = firstEl.getBoundingClientRect();
      if (firstRect.top < cRect.top + 12) {
        const scrollDiff = (cRect.top + 12) - firstRect.top;
        container.scrollTo({
          top: Math.max(0, container.scrollTop - scrollDiff),
          behavior: "smooth",
        });
      }
    }
  };

  // Single 모드에서 실행 라인이 바뀔 때: 해당 C 구문에 속한 연관 라인 그룹 전체(맨 마지막 행까지)를 한눈에 볼 수 있도록 자동 스크롤
  useEffect(() => {
    if (mode !== "single" || currentActiveStep === null || currentActiveStep === undefined) return;
    if (!containerRef.current) return;

    const activeRow = rows[currentActiveStep];
    if (!activeRow) return;

    // 현재 실행 라인과 동일한 C 라인 번호를 갖는 마지막 어셈블리 행 인덱스 찾기
    let lastSiblingIndex = currentActiveStep;
    for (let i = currentActiveStep; i < rows.length; i++) {
      if (rows[i].sourceLine === activeRow.sourceLine) {
        lastSiblingIndex = i;
      } else {
        break;
      }
    }

    // 그룹의 마지막 행 및 현재 실행 행 요소
    const lastEl = rowElementsRef.current.get(lastSiblingIndex);
    const activeEl = rowElementsRef.current.get(currentActiveStep);

    if (lastEl) {
      scrollGroupIntoView(lastEl, activeEl);
    }
  }, [mode, currentActiveStep, rows]);

  const matchingIndices = useMemo(() => {
    if (!selectedLine) return new Set<number>();
    const indices = new Set<number>();
    rows.forEach((row, idx) => {
      if (row.sourceLine === selectedLine) {
        indices.add(idx);
      }
    });
    return indices;
  }, [rows, selectedLine]);

  // 선택된 라인이 바뀔 때: 해당 그룹의 마지막 행까지 한눈에 보이도록 스크롤 이동
  useEffect(() => {
    if (!selectedLine || !containerRef.current) return;

    // 선택된 C 라인에 매핑된 어셈블리 행들 중 마지막 행과 첫 행 찾기
    let firstIdx = -1;
    let lastIdx = -1;
    rows.forEach((row, idx) => {
      if (row.sourceLine === selectedLine) {
        if (firstIdx === -1) firstIdx = idx;
        lastIdx = idx;
      }
    });

    if (lastIdx !== -1) {
      const lastEl = rowElementsRef.current.get(lastIdx);
      const firstEl = rowElementsRef.current.get(firstIdx);

      if (lastEl) {
        scrollGroupIntoView(lastEl, firstEl);
      }
    }
  }, [selectedLine, rows]);

  return (
    <section
      className="@container flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs select-none"
      aria-label="RISC-V 어셈블리 결과"
    >
      {/* 통일된 상단 헤더 바 */}
      <header className="shrink-0 flex items-center justify-between px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-200/80 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <h3 className="text-xs font-bold text-slate-800 whitespace-nowrap truncate">RISC-V 어셈블리</h3>
        </div>
        {assembly && (
          <span className="text-[10px] font-mono text-slate-400 font-semibold whitespace-nowrap">
            {rows.length} lines
          </span>
        )}
      </header>

      {/* 본문 어셈블리 리스트 */}
      {!assembly ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center bg-slate-50/40">
          <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 text-lg shadow-2xs">
            📜
          </div>
          <p className="text-xs font-semibold text-slate-600">
            {busy
              ? "컴파일 및 어셈블리 매핑 중…"
              : error
              ? "컴파일 오류로 어셈블리를 생성할 수 없습니다."
              : "왼쪽 에디터에서 C 코드를 작성하고 [⚡ 컴파일]을 누르세요."}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 max-w-xs">
            컴파일 완료 후 C 코드의 줄을 클릭하면 매핑된 어셈블리 라인이 즉시 강조됩니다.
          </span>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto text-[13px] leading-snug [scrollbar-gutter:stable] bg-white text-slate-800 select-text py-1"
          style={{ fontFamily: "'D2Coding', Consolas, 'Fira Code', monospace" }}
          role="region"
          aria-label="어셈블리 명령어 목록"
        >
          {rows.map((row, index) => {
            const isMatched = matchingIndices.has(index);
            const isFirstOfMatch =
              isMatched && !matchingIndices.has(index - 1);
            const { opcode, operands } = splitInstruction(row.text);

            const normRowText = row.text.replace(/\s+/g, " ").trim().toLowerCase();
            const activeStages = activeStagesByInst[normRowText] || [];
            const isCurrentSingleActive =
              mode === "single" && currentActiveStep === index;
            // 같은 C 실행 라인에 속해 있는 형제 어셈블리 라인인지 확인
            const isExecutionSibling =
              executionLine !== null &&
              executionLine !== undefined &&
              row.sourceLine === executionLine &&
              !isCurrentSingleActive;

            // 선택 라인(파란색) 그룹:
            // 사용자가 특정 어셈블리 행(selectedAsmIndex)을 클릭했으면 해당 행이 primary,
            // C 에디터에서 클릭했거나 어셈블리 미지정이면 첫 번째 매핑 행이 primary
            const isSelectedPrimary =
              selectedAsmIndex !== null && selectedAsmIndex !== undefined
                ? selectedAsmIndex === index
                : isFirstOfMatch;
            const isSelectedSibling = isMatched && !isSelectedPrimary;

            // 실행 중인 라인이면서 동시에 사용자가 선택한 라인인 경우
            const isExecutingAndSelected = isCurrentSingleActive && isSelectedPrimary;

            return (
              <div
                key={`${row.sourceLine}-${index}`}
                ref={(el) => {
                  if (el) rowElementsRef.current.set(index, el);
                  else rowElementsRef.current.delete(index);
                }}
                onClick={() => {
                  // 동일한 특정 어셈블리 행을 다시 클릭했을 때만 해제
                  if (selectedLine === row.sourceLine && selectedAsmIndex === index) {
                    onSelectLine?.(null, null);
                  } else {
                    onSelectLine?.(row.sourceLine, index);
                  }
                }}
                className={`flex items-baseline transition-colors duration-100 cursor-pointer group py-0.5 border-l-4 ${
                  isCurrentSingleActive && !isSelectedPrimary
                    ? "bg-emerald-100/90 border-emerald-500 text-emerald-950 font-bold shadow-2xs"
                    : isSelectedPrimary
                    ? "bg-blue-100/90 border-blue-600 text-blue-950 font-bold shadow-2xs"
                    : isSelectedSibling
                    ? "bg-blue-50/50 border-blue-300/60 text-blue-900/80 font-normal"
                    : isExecutionSibling
                    ? "bg-emerald-50/50 border-emerald-300/60 text-emerald-900/80 font-normal"
                    : activeStages.length > 0
                    ? "bg-amber-50/70 border-transparent"
                    : "border-transparent hover:bg-slate-50 text-slate-700"
                }`}
              >
                {/* 1. 화살표 / 인디케이터 (현재 실행 라인에는 ▶, 사용자가 선택한 메인 라인에는 ●, 둘 다인 경우 둘 다 표시) */}
                <div className="w-5 shrink-0 flex items-center justify-center select-none pl-0.5">
                  {isExecutingAndSelected ? (
                    <div className="flex items-center gap-0.5">
                      <span className="text-emerald-600 text-xs font-bold leading-none animate-pulse">▶</span>
                      <span className="text-blue-600 text-[9px] leading-none">●</span>
                    </div>
                  ) : isCurrentSingleActive ? (
                    <span className="text-emerald-600 text-xs font-bold leading-none animate-pulse">▶</span>
                  ) : isSelectedPrimary ? (
                    <span className="text-blue-600 text-[10px] leading-none">●</span>
                  ) : null}
                </div>

                {/* 2. 라인 번호 */}
                <div
                  className={`w-9 shrink-0 text-right pr-4 select-none text-[13px] ${
                    isSelectedPrimary
                      ? "text-blue-700 font-bold"
                      : isSelectedSibling
                      ? "text-blue-500 font-medium"
                      : isCurrentSingleActive
                      ? "text-emerald-700 font-bold"
                      : isExecutionSibling
                      ? "text-emerald-600"
                      : "text-slate-400"
                  }`}
                >
                  {index + 1}
                </div>

                {/* 3. Opcode */}
                <div className="w-[52px] shrink-0 font-bold select-text">
                  <span
                    className={
                      isSelectedPrimary
                        ? "text-blue-800 font-bold"
                        : isSelectedSibling
                        ? "text-blue-600 font-semibold"
                        : isCurrentSingleActive
                        ? "text-emerald-800 font-bold"
                        : isExecutionSibling
                        ? "text-emerald-700 font-semibold"
                        : "text-indigo-600 group-hover:text-indigo-700 font-semibold"
                    }
                  >
                    {opcode}
                  </span>
                </div>

                {/* 4. Operands */}
                <div className="flex-1 pr-2 whitespace-pre-wrap break-words select-text flex items-center gap-2">
                  <span
                    className={
                      isSelectedPrimary
                        ? "text-slate-950 font-bold"
                        : isSelectedSibling
                        ? "text-slate-800 font-normal"
                        : isCurrentSingleActive
                        ? "text-slate-950 font-bold"
                        : isExecutionSibling
                        ? "text-slate-800 font-normal"
                        : "text-slate-700 group-hover:text-slate-900"
                    }
                  >
                    {operands}
                  </span>

                  {/* 파이프라인 스테이지 뱃지 (현재 클록에 이 명령어가 파이프라인 어느 단계에 있는지) */}
                  {activeStages.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0 select-none">
                      {activeStages.map((stg) => {
                        const cfg = STAGES_CONFIG.find((s) => s.name === stg);
                        return (
                          <span
                            key={stg}
                            className={`text-[9px] px-1 py-0.2 rounded font-sans font-bold shadow-2xs animate-in zoom-in-95 duration-100 ${
                              cfg?.badgeBg || "bg-slate-700 text-white"
                            }`}
                          >
                            {stg}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 5. 우측 C 매핑 라인 태그 (실행 및 선택 모두 대표 행은 진한색, 연관 행은 연한색) */}
                <div className="shrink-0 pr-4 flex items-center select-none">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium transition-colors ${
                      isSelectedPrimary
                        ? "bg-blue-600 text-white font-bold shadow-2xs"
                        : isCurrentSingleActive
                        ? "bg-emerald-600 text-white font-bold shadow-2xs"
                        : isSelectedSibling
                        ? "bg-blue-100 text-blue-800 font-semibold"
                        : isExecutionSibling
                        ? "bg-emerald-100 text-emerald-800 font-semibold"
                        : "bg-slate-100 text-slate-500 group-hover:text-slate-700"
                    }`}
                  >
                    C: L{row.sourceLine}
                  </span>
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <p className="p-4 text-xs text-slate-400 font-sans">
              줄 정보가 포함된 어셈블리 명령어를 추출하지 못했습니다.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
