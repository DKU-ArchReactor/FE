import { useMemo, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "@/context/ThemeContext";
import { mapAssembly, type MappedAssemblyRow } from "./translationCompile";
import type { StageBuffer } from "@/type/simulation";

type Props = {
  source: string;
  assembly: string;
  mappedRows?: MappedAssemblyRow[];
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
  activeTarget?: "c" | "asm";
  onAssemblyChange?: (assembly: string) => void;
  onSimulateAssembly?: () => void;
  onResetAssembly?: () => void;
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
  source,
  assembly,
  mappedRows,
  busy,
  error,
  selectedLine,
  selectedAsmIndex,
  executionLine,
  onSelectLine,
  stageBuffers,
  mode = "pipeline",
  currentActiveStep,
  activeTarget = "c",
  onAssemblyChange,
  onSimulateAssembly,
  onResetAssembly,
}: Props) {
  const { theme } = useTheme();
  const sourceLines = source.split(/\r?\n/);
  const rows: MappedAssemblyRow[] = useMemo(() => {
    if (mappedRows && mappedRows.length > 0) return mappedRows;
    return mapAssembly(assembly, sourceLines.length);
  }, [mappedRows, assembly, sourceLines.length]);

  const containerRef = useRef<HTMLDivElement>(null);
  const rowElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  // 파이프라인 스테이지별 활성 명령어 매핑 (현재 클록 사이클 기준)
  const activeStagesByInst = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!stageBuffers || mode === "single") return map;

    STAGES_CONFIG.forEach(({ key, name }) => {
      const buf = stageBuffers[key];
      if (buf && buf.assembly && buf.assembly !== "bubble" && buf.assembly !== "empty") {
        const norm = buf.assembly.replace(/\s+/g, " ").trim().toLowerCase();
        if (norm) {
          if (!map[norm]) map[norm] = [];
          if (!map[norm].includes(name)) map[norm].push(name);
        }
      }
    });
    return map;
  }, [stageBuffers, mode]);

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
      className="@container flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] shadow-sm select-none transition-colors duration-150"
      aria-label="RISC-V 어셈블리 결과"
    >
      {/* 1단: 메인 헤더 바 (어셈블리 제목 + 파일명/개수) */}
      <header className="shrink-0 flex items-center justify-between gap-2 border-b border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-3.5 py-1.5 min-w-0 border-l-2 border-l-sky-500">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200 ${activeTarget === "asm"
                ? "bg-[#005FB8] dark:bg-[#007ACC] scale-100"
                : "bg-transparent scale-0"
              }`}
          />
          <h3 className="font-sans text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wide truncate whitespace-nowrap">
            RISC-V ASSEMBLY
          </h3>
          <span className="text-[10px] text-[var(--ar-text-muted)] font-mono truncate">
            ({activeTarget === "asm" ? "main.s" : assembly ? `${rows.length} instrs` : "빈 코드"})
          </span>
        </div>
      </header>

      {/* 2단: 헤더 밑 툴바 라인 (어셈블리 시뮬레이션 버튼 행) */}
      <div className="shrink-0 flex items-center justify-between gap-1.5 px-3 py-1 bg-[#FAFBFD] dark:bg-[#1E1E1E] border-b border-[#E5E5E5] dark:border-[#3E3E42] min-w-0">
        <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
          {activeTarget === "asm" ? (
            <>
              <button
                type="button"
                onClick={onResetAssembly}
                className="rounded border border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] px-2 py-0.5 text-[11px] font-medium text-[#24292F] dark:text-[#CCCCCC] hover:bg-[#F3F4F6] dark:hover:bg-[#37373D] transition-colors cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs"
                title="기본 어셈블리 템플릿으로 초기화"
              >
                <span>🔄</span>
                <span>초기화</span>
              </button>
              <span className="text-[10px] text-[#57606A] dark:text-[#858585] ml-1 font-mono hidden sm:inline">
                명령어 직접 작성 모드
              </span>
            </>
          ) : (
            <span className="text-[10px] text-[#57606A] dark:text-[#858585] truncate">
              C 컴파일 결과 매핑 및 파이프라인 단계 관찰 뷰
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
          {/* 어셈블리 시뮬레이션 버튼 */}
          <button
            type="button"
            onClick={onSimulateAssembly}
            disabled={busy || !assembly?.trim() || activeTarget !== "asm"}
            className={`rounded border px-2.5 py-0.5 text-[11px] font-medium transition-colors shadow-2xs flex items-center gap-1 shrink-0 ${activeTarget === "asm"
                ? "border-[#005FB8] dark:border-[#007ACC] bg-[#005FB8] dark:bg-[#007ACC] text-white hover:bg-[#004C99] dark:hover:bg-[#0062A3] cursor-pointer"
                : "border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#8C959F] dark:text-[#6E7681] opacity-40 cursor-not-allowed"
              }`}
            title={activeTarget === "asm" ? "작성된 어셈블리로 시뮬레이션 실행" : "어셈블리 작성 모드를 선택한 후 실행할 수 있습니다"}
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
              {busy ? (
                <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <span className="text-[12px] leading-none">⚡</span>
              )}
            </span>
            <span>시뮬레이션</span>
          </button>
        </div>
      </div>

      {/* 본문: ASM 직접 작성 모드일 때는 Monaco Editor, C 모드일 때는 매핑 뷰 */}
      {activeTarget === "asm" ? (
        <div className="min-h-0 flex-1 relative bg-white dark:bg-[#1E1E1E]">
          <Editor
            height="100%"
            language="plaintext"
            theme={theme === "dark" ? "vs-dark" : "vs"}
            value={assembly}
            onChange={(val) => onAssemblyChange?.(val ?? "")}
            options={{
              automaticLayout: true,
              fontSize: 13,
              fontFamily: "'D2Coding', Consolas, 'Fira Code', monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: "off",
              tabSize: 4,
              insertSpaces: true,
              lineNumbers: "on",
              lineNumbersMinChars: 3,
              padding: { top: 8, bottom: 8 },
              readOnly: busy,
              stickyScroll: { enabled: false },
            }}
          />
        </div>
      ) : !assembly && rows.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center bg-[#F8F8F8] dark:bg-[#1E1E1E]">
          <div className="w-10 h-10 rounded-lg bg-white dark:bg-[#252526] border border-[#E5E5E5] dark:border-[#333333] flex items-center justify-center text-[#57606A] dark:text-[#858585] mb-3 text-lg shadow-2xs">
            📜
          </div>
          <p className="text-xs font-semibold text-[#1F2328] dark:text-[#CCCCCC]">
            {busy
              ? "컴파일 및 어셈블리 매핑 중…"
              : error
                ? "컴파일 오류로 어셈블리를 생성할 수 없습니다."
                : "왼쪽 에디터에서 C 코드를 작성하고 [⚡ 컴파일]을 누르세요."}
          </p>
          <span className="text-[11px] text-[#57606A] dark:text-[#858585] mt-1 max-w-xs">
            컴파일 완료 후 C 코드의 줄을 클릭하면 매핑된 어셈블리 라인이 즉시 강조됩니다.
          </span>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto text-[13px] leading-snug [scrollbar-gutter:stable] bg-white dark:bg-[#1E1E1E] text-[#24292F] dark:text-[#CCCCCC] select-text py-1"
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

            // 선택 라인(파란색) 그룹
            const isSelectedPrimary =
              selectedAsmIndex !== null && selectedAsmIndex !== undefined
                ? selectedAsmIndex === index
                : isFirstOfMatch;
            const isSelectedSibling = isMatched && !isSelectedPrimary;

            // 실행 중인 라인이면서 동시에 사용자가 선택한 라인인 경우
            const isExecutingAndSelected = isCurrentSingleActive && isSelectedPrimary;
            const isCrt = row.sourceLine === null;

            return (
              <div
                key={`${row.pc || index}-${row.sourceLine}-${index}`}
                ref={(el) => {
                  if (el) rowElementsRef.current.set(index, el);
                  else rowElementsRef.current.delete(index);
                }}
                onClick={() => {
                  if (selectedLine === row.sourceLine && selectedAsmIndex === index) {
                    onSelectLine?.(null, null);
                  } else {
                    onSelectLine?.(row.sourceLine, index);
                  }
                }}
                className={`flex items-baseline transition-colors duration-100 cursor-pointer group py-0.5 border-l-4 ${isCurrentSingleActive && !isSelectedPrimary
                    ? "bg-emerald-100/90 dark:bg-[#133A27] border-emerald-500 dark:border-[#23D18B] text-emerald-950 dark:text-[#7EE787] font-bold shadow-2xs"
                    : isSelectedPrimary
                      ? "bg-blue-100/90 dark:bg-[#04395E] border-blue-600 dark:border-[#007ACC] text-blue-950 dark:text-[#9CDCFE] font-bold shadow-2xs"
                      : isSelectedSibling
                        ? "bg-blue-50/50 dark:bg-[#04395E]/40 border-blue-300/60 dark:border-[#007ACC]/50 text-blue-900/80 dark:text-[#9CDCFE]/80 font-normal"
                        : isExecutionSibling
                          ? "bg-emerald-50/50 dark:bg-[#133A27]/40 border-emerald-300/60 dark:border-[#23D18B]/50 text-emerald-900/80 dark:text-[#7EE787]/80 font-normal"
                          : activeStages.length > 0
                            ? "bg-amber-50/70 dark:bg-[#3D2E12]/50 border-transparent"
                            : "border-transparent hover:bg-slate-100/70 dark:hover:bg-[#2A2D2E] text-[#24292F] dark:text-[#CCCCCC]"
                  }`}
              >
                {/* 1. 화살표 / 인디케이터 */}
                <div className="w-5 shrink-0 flex items-center justify-center select-none pl-0.5">
                  {isExecutingAndSelected ? (
                    <div className="flex items-center gap-0.5">
                      <span className="text-emerald-600 dark:text-[#23D18B] text-xs font-bold leading-none animate-pulse">▶</span>
                      <span className="text-[#005FB8] dark:text-[#007ACC] text-[9px] leading-none">●</span>
                    </div>
                  ) : isCurrentSingleActive ? (
                    <span className="text-emerald-600 dark:text-[#23D18B] text-xs font-bold leading-none animate-pulse">▶</span>
                  ) : isSelectedPrimary ? (
                    <span className="text-[#005FB8] dark:text-[#007ACC] text-[10px] leading-none">●</span>
                  ) : null}
                </div>

                {/* 2. 라인 번호 */}
                <div
                  className={`w-9 shrink-0 text-right pr-4 select-none text-[13px] ${isSelectedPrimary
                      ? "text-[#005FB8] dark:text-[#79C0FF] font-bold"
                      : isSelectedSibling
                        ? "text-blue-500 dark:text-[#79C0FF]/70 font-medium"
                        : isCurrentSingleActive
                          ? "text-emerald-700 dark:text-[#7EE787] font-bold"
                          : isExecutionSibling
                            ? "text-emerald-600 dark:text-[#7EE787]/70"
                            : "text-[#8C959F] dark:text-[#858585]"
                    }`}
                >
                  {index + 1}
                </div>

                {/* 3. Opcode (CRT 비매핑 코드는 회색, C 매핑 코드는 파란색) */}
                <div className="w-[52px] shrink-0 font-bold select-text">
                  <span
                    className={
                      isSelectedPrimary
                        ? "text-blue-800 dark:text-[#79C0FF] font-bold"
                        : isSelectedSibling
                          ? "text-blue-600 dark:text-[#79C0FF]/80 font-semibold"
                          : isCurrentSingleActive
                            ? "text-emerald-800 dark:text-[#7EE787] font-bold"
                            : isExecutionSibling
                              ? "text-emerald-700 dark:text-[#7EE787]/80 font-semibold"
                              : isCrt
                                ? "text-[#6E7681] dark:text-[#858585] font-semibold"
                                : "text-[#005FB8] dark:text-[#569CD6] font-semibold"
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
                        ? "text-slate-950 dark:text-white font-bold"
                        : isSelectedSibling
                          ? "text-slate-800 dark:text-[#D4D4D4] font-normal"
                          : isCurrentSingleActive
                            ? "text-slate-950 dark:text-white font-bold"
                            : isExecutionSibling
                              ? "text-slate-800 dark:text-[#D4D4D4] font-normal"
                              : isCrt
                                ? "text-[#6E7681]/90 dark:text-[#858585]"
                                : "text-[#24292F] dark:text-[#CCCCCC]"
                    }
                  >
                    {operands}
                  </span>

                  {/* 파이프라인 스테이지 뱃지 */}
                  {activeStages.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0 select-none">
                      {activeStages.map((stg) => {
                        const cfg = STAGES_CONFIG.find((s) => s.name === stg);
                        return (
                          <span
                            key={stg}
                            className={`text-[9px] px-1 py-0.2 rounded font-sans font-bold shadow-2xs animate-in zoom-in-95 duration-100 ${cfg?.badgeBg || "bg-slate-700 text-white"
                              }`}
                          >
                            {stg}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 5. 우측 C 매핑 라인 태그 (CRT와 C: L$ 규격/스타일 일원화) */}
                <div className="shrink-0 pr-4 flex items-center select-none">
                  {row.sourceLine !== null ? (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium transition-colors ${isSelectedPrimary
                          ? "bg-[#005FB8] dark:bg-[#007ACC] text-white font-bold shadow-2xs"
                          : isCurrentSingleActive
                            ? "bg-emerald-600 text-white font-bold shadow-2xs"
                            : isSelectedSibling
                              ? "bg-blue-100 dark:bg-[#04395E] text-blue-800 dark:text-[#9CDCFE] font-semibold"
                              : isExecutionSibling
                                ? "bg-emerald-100 dark:bg-[#133A27] text-emerald-800 dark:text-[#7EE787] font-semibold"
                                : "bg-[#F0F0F0] dark:bg-[#252526] text-[#57606A] dark:text-[#858585] group-hover:text-[#24292F] dark:group-hover:text-[#CCCCCC]"
                        }`}
                    >
                      C: L{row.sourceLine}
                    </span>
                  ) : (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium transition-colors ${isSelectedPrimary
                          ? "bg-[#005FB8] dark:bg-[#007ACC] text-white font-bold shadow-2xs"
                          : isCurrentSingleActive
                            ? "bg-emerald-600 text-white font-bold shadow-2xs"
                            : isSelectedSibling
                              ? "bg-blue-100 dark:bg-[#04395E] text-blue-800 dark:text-[#9CDCFE] font-semibold"
                              : isExecutionSibling
                                ? "bg-emerald-100 dark:bg-[#133A27] text-emerald-800 dark:text-[#7EE787] font-semibold"
                                : "bg-[#F0F0F0] dark:bg-[#252526] text-[#8C959F] dark:text-[#858585] group-hover:text-[#57606A] dark:group-hover:text-[#CCCCCC]"
                        }`}
                      title="C 런타임(CRT) 진입 및 초기화 부트스트랩 코드"
                    >
                      CRT
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <p className="p-4 text-xs text-[#8C959F] dark:text-[#858585] font-sans">
              줄 정보가 포함된 어셈블리 명령어를 추출하지 못했습니다.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
