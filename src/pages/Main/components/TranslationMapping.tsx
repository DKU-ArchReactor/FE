import { useMemo, useEffect, useRef } from "react";
import { mapAssembly, type MappedAssemblyRow } from "./translationCompile";
import type { StageBuffer } from "@/type/simulation";

type Props = {
  source: string;
  assembly: string;
  busy: boolean;
  error: string;
  selectedLine?: number | null;
  onSelectLine?: (line: number | null) => void;
  stageBuffers?: {
    IF?: StageBuffer | null;
    ID?: StageBuffer | null;
    EX?: StageBuffer | null;
    MEM?: StageBuffer | null;
    WB?: StageBuffer | null;
  };
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
  busy,
  error,
  selectedLine,
  onSelectLine,
  stageBuffers,
}: Props) {
  const sourceLines = source.split(/\r?\n/);
  const rows: MappedAssemblyRow[] = useMemo(
    () => mapAssembly(assembly, sourceLines.length),
    [assembly, sourceLines.length]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);

  // 파이프라인 스테이지별 활성 명령어 매핑 (현재 클록 사이클 기준)
  const activeStagesByInst = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!stageBuffers) return map;

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
  }, [stageBuffers]);

  // 선택된 C 라인에 매핑된 어셈블리 행들 찾기
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

  // 선택된 라인이 바뀔 때 해당 어셈블리 영역으로 스크롤 이동
  useEffect(() => {
    if (activeRowRef.current && containerRef.current) {
      activeRowRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedLine]);

  return (
    <section
      className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-label="RISC-V 어셈블리 결과"
    >
      {/* 헤더 */}
      <header className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <strong className="text-xs text-slate-700">RISC-V 어셈블리</strong>
          {assembly && (
            <span className="text-[10px] text-slate-400 font-mono">
              ({rows.length} lines)
            </span>
          )}
        </div>
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

            return (
              <div
                key={`${row.sourceLine}-${index}`}
                ref={isFirstOfMatch ? activeRowRef : undefined}
                onClick={() => {
                  if (selectedLine === row.sourceLine) {
                    onSelectLine?.(null);
                  } else {
                    onSelectLine?.(row.sourceLine);
                  }
                }}
                className={`flex items-baseline transition-colors duration-100 cursor-pointer group py-0.5 border-l-4 ${
                  isMatched
                    ? "bg-blue-50 border-blue-600 text-blue-950 font-medium"
                    : activeStages.length > 0
                    ? "bg-amber-50/70 border-transparent"
                    : "border-transparent hover:bg-slate-50 text-slate-700"
                }`}
              >
                {/* 1. 화살표 / 인디케이터 (C 에디터와 동일하게 군더더기 없는 정갈한 인디케이터) */}
                <div className="w-5 shrink-0 flex items-center justify-center select-none pl-1">
                  {isFirstOfMatch ? (
                    <span className="text-blue-600 text-xs font-bold leading-none">➔</span>
                  ) : isMatched ? (
                    <span className="text-blue-400 text-[10px] leading-none opacity-60">·</span>
                  ) : (
                    <span className="opacity-0 group-hover:opacity-40 text-slate-400 text-[10px] leading-none">
                      ›
                    </span>
                  )}
                </div>

                {/* 2. 라인 번호 (C Monaco 라인 넘버와 동일하게 text-[13px], 우측 패딩을 줘서 명령어와 간격 넉넉히 확보) */}
                <div
                  className={`w-9 shrink-0 text-right pr-4 select-none text-[13px] ${
                    isMatched ? "text-blue-600 font-semibold" : "text-slate-400"
                  }`}
                >
                  {index + 1}
                </div>

                {/* 3. Opcode (간격 최적화: 72px -> 52px로 축소하여 오퍼랜드와 적절한 간격 유지) */}
                <div className="w-[52px] shrink-0 font-bold select-text">
                  <span
                    className={
                      isMatched
                        ? "text-blue-700 font-bold"
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
                      isMatched
                        ? "text-slate-900 font-medium"
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

                {/* 5. 우측 C 매핑 라인 태그 (스크롤바에 가리지 않도록 pr-4.5로 왼쪽으로 당김) */}
                <div className="shrink-0 pr-4 flex items-center select-none">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-sans transition-colors ${
                      isMatched
                        ? "bg-blue-600 text-white font-bold"
                        : "bg-slate-100 text-slate-400 group-hover:text-slate-600"
                    }`}
                  >
                    L{row.sourceLine}
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
