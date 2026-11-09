import { useMemo, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "@/context/ThemeContext";
import { mapAssembly, type MappedAssemblyRow } from "../utils/translationCompile";
import type { StageBuffer } from "@/type/simulation";
import type { FileSummary } from "@/type/file";
import AsmFileUploadPopup from "./AsmFileUploadPopup";

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
  onSave?: (name?: string) => Promise<boolean>;
  onOpenSavedFile?: (fileId: string) => void;
  savedFiles?: FileSummary[];
  currentFileId?: string | null;
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
  executionLine: _executionLine,
  onSelectLine,
  stageBuffers,
  mode = "pipeline",
  currentActiveStep,
  activeTarget = "c",
  onAssemblyChange,
  onSimulateAssembly,
  onResetAssembly,
  onSave,
  onOpenSavedFile,
  savedFiles = [],
  currentFileId,
}: Props) {
  const { theme } = useTheme();
  const sourceLines = source.split(/\r?\n/);
  const rows: MappedAssemblyRow[] = useMemo(() => {
    if (mappedRows && mappedRows.length > 0) return mappedRows;
    return mapAssembly(assembly, sourceLines.length);
  }, [mappedRows, assembly, sourceLines.length]);

  const containerRef = useRef<HTMLDivElement>(null);
  const rowElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const [isUploadPopupOpen, setIsUploadPopupOpen] = useState(false);
  const [asmSaveSuccess, setAsmSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isLoggedIn = !!localStorage.getItem("access_token");

  // ASM 서버 저장 핸들러 (C 에디터와 1:1 동일)
  const handleSaveAsmClick = async () => {
    if (busy || isSaving || !assembly?.trim()) return;
    if (!isLoggedIn) {
      alert("파일 저장은 로그인 후 이용할 수 있습니다.");
      return;
    }

    setIsSaving(true);
    try {
      const inputName = window.prompt("저장할 어셈블리 파일 이름을 입력해 주세요:", "main.s");
      if (!inputName || !inputName.trim()) {
        setIsSaving(false);
        return;
      }
      let targetName = inputName.trim();
      if (!targetName.toLowerCase().endsWith(".s") && !targetName.toLowerCase().endsWith(".asm")) {
        targetName += ".s";
      }

      const res = await onSave?.(targetName);
      if (res !== false) {
        setAsmSaveSuccess(true);
        setTimeout(() => setAsmSaveSuccess(false), 2000);
      }
    } finally {
      setIsSaving(false);
    }
  };

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
          map[norm].push(name);
        }
      }
    });

    return map;
  }, [stageBuffers, mode]);

  // C 코드 라인 선택 시 해당 어셈블리 행으로 자동 스크롤
  useEffect(() => {
    if (selectedLine === null || !containerRef.current) return;
    const targetIdx = rows.findIndex((r) => r.sourceLine === selectedLine);
    if (targetIdx === -1) return;

    const el = rowElementsRef.current.get(targetIdx);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedLine, rows]);

  // 파이프라인/싱글 사이클 실행 중 현재 실행 명령어 위치로 자동 추적 스크롤
  useEffect(() => {
    if (!containerRef.current) return;

    // Single 모드: currentActiveStep (0~17)
    if (mode === "single" && currentActiveStep !== null && currentActiveStep !== undefined) {
      const el = rowElementsRef.current.get(currentActiveStep);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      return;
    }

    // Pipeline 모드: IF 단계 버퍼 명령어 위치 추적
    if (mode === "pipeline" && stageBuffers?.IF?.assembly) {
      const ifInst = stageBuffers.IF.assembly.replace(/\s+/g, " ").trim().toLowerCase();
      if (ifInst && ifInst !== "bubble" && ifInst !== "empty") {
        const targetIdx = rows.findIndex(
          (r) => r.text.replace(/\s+/g, " ").trim().toLowerCase() === ifInst
        );
        if (targetIdx !== -1) {
          const el = rowElementsRef.current.get(targetIdx);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }
      }
    }
  }, [mode, currentActiveStep, stageBuffers?.IF?.assembly, rows]);

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col min-h-0 bg-white dark:bg-[#1E1E1E] text-[#1F2328] dark:text-[#CCCCCC] select-none text-xs"
    >
      {/* 1단: 패널 메인 헤더 */}
      <header className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-[#E5E5E5] dark:border-[#3E3E42] bg-[#F6F8FA] dark:bg-[#252526] min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm shrink-0">⚙️</span>
          <h3 className="font-sans text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wide truncate whitespace-nowrap">
            RISC-V ASSEMBLY
          </h3>
          <span className="text-[10px] text-[var(--ar-text-muted)] font-mono truncate">
            ({activeTarget === "asm" ? "main.s" : assembly ? `${rows.length} instrs` : "빈 코드"})
          </span>
        </div>

        {/* 현재 모드에 대한 ASM 에디터 상태 문구: 윗줄 오른쪽 정렬 */}
        <div className="flex items-center shrink-0 ml-2">
          <span className="text-[10px] text-[#57606A] dark:text-[#858585] font-mono truncate">
            {activeTarget === "asm"
              ? "명령어 직접 작성"
              : "C 컴파일 명령어 매핑"}
          </span>
        </div>
      </header>

      {/* 2단: 헤더 밑 툴바 라인 (C 에디터와 100% 동일한 버튼 디자인 및 반응형 아이콘) */}
      <div className="shrink-0 flex items-center justify-between gap-1.5 px-3 py-1 bg-[#FAFBFD] dark:bg-[#1E1E1E] border-b border-[#E5E5E5] dark:border-[#3E3E42] min-w-0">
        <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
          {/* 1. 불러오기 버튼 (드롭다운 화살표 및 팝업 연동) */}
          <button
            ref={uploadButtonRef}
            type="button"
            onClick={() => setIsUploadPopupOpen((prev) => !prev)}
            disabled={busy || activeTarget !== "asm"}
            className={`h-[22px] rounded border px-2 text-[10.5px] font-medium transition-colors flex items-center justify-center gap-1 shrink-0 ${
              activeTarget !== "asm"
                ? "opacity-40 cursor-not-allowed border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#8C959F] dark:text-[#6E7681]"
                : isUploadPopupOpen
                ? "border-[#005FB8] dark:border-[#007ACC] bg-blue-50 dark:bg-[#007ACC]/20 text-[#005FB8] dark:text-[#79C0FF] font-semibold cursor-pointer"
                : "border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#24292F] dark:text-[#CCCCCC] hover:bg-[#F3F4F6] dark:hover:bg-[#37373D] cursor-pointer"
            }`}
            title="어셈블리 파일 업로드 및 예제 템플릿 불러오기"
          >
            {/* 좁아졌을 때 나타나는 단색 폴더 기하 도형 아이콘 */}
            <svg
              className="w-3 h-3 fill-none stroke-current inline @[380px]:hidden shrink-0"
              viewBox="0 0 24 24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              <path d="M2 10h20" />
            </svg>
            <span className="hidden @[380px]:inline">불러오기</span>
            <span
              className={`text-[8.5px] opacity-75 transition-transform duration-150 ${
                isUploadPopupOpen ? "rotate-180" : ""
              }`}
            >
              ▼
            </span>
          </button>

          {/* 2. 저장 버튼 */}
          <button
            type="button"
            onClick={handleSaveAsmClick}
            disabled={busy || activeTarget !== "asm" || !assembly?.trim()}
            className={`h-[22px] rounded border px-2 text-[10.5px] font-medium transition-colors flex items-center justify-center gap-1 shrink-0 ${
              activeTarget !== "asm"
                ? "opacity-40 cursor-not-allowed border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#8C959F] dark:text-[#6E7681]"
                : asmSaveSuccess
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer"
                : "border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#24292F] dark:text-[#CCCCCC] hover:bg-[#F3F4F6] dark:hover:bg-[#37373D] cursor-pointer"
            }`}
            title="현재 어셈블리 코드를 서버 및 로컬에 저장"
          >
            {asmSaveSuccess ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] shrink-0">✓</span>
            ) : (
              <svg
                className="w-3 h-3 fill-none stroke-current inline @[320px]:hidden shrink-0"
                viewBox="0 0 24 24"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            )}
            <span className="hidden @[320px]:inline">
              {asmSaveSuccess ? "저장됨" : "저장"}
            </span>
          </button>

          {/* 3. 초기화 버튼 */}
          <button
            type="button"
            onClick={onResetAssembly}
            disabled={busy || activeTarget !== "asm"}
            className={`h-[22px] rounded border px-2 text-[10.5px] font-medium transition-colors flex items-center justify-center gap-1 shrink-0 ${
              activeTarget !== "asm"
                ? "opacity-40 cursor-not-allowed border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#8C959F] dark:text-[#6E7681]"
                : "border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#24292F] dark:text-[#CCCCCC] hover:bg-[#F3F4F6] dark:hover:bg-[#37373D] cursor-pointer"
            }`}
            title="기본 어셈블리 템플릿으로 초기화"
          >
            <svg
              className="w-3 h-3 fill-current inline @[260px]:hidden shrink-0"
              viewBox="0 0 24 24"
            >
              <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
            <span className="hidden @[260px]:inline">초기화</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
          {/* 어셈블리 시뮬레이션 버튼 (C 에디터 컴파일 버튼과 동일한 h-[22px], 블루 솔리드, 반응형 쐐기 번개 도형) */}
          <button
            type="button"
            onClick={onSimulateAssembly}
            disabled={busy || !assembly?.trim() || activeTarget !== "asm"}
            className={`h-[22px] rounded px-2.5 text-[10.5px] font-semibold transition-colors flex items-center justify-center gap-1 shrink-0 ${
              activeTarget === "asm"
                ? "bg-[#005FB8] dark:bg-[#007ACC] text-white hover:bg-[#004C99] dark:hover:bg-[#0062A3] cursor-pointer"
                : "border border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#8C959F] dark:text-[#6E7681] opacity-40 cursor-not-allowed"
            }`}
            title={activeTarget === "asm" ? "작성된 어셈블리를 하드웨어에 로드하고 시뮬레이션 준비" : "어셈블리 작성 모드를 선택한 후 실행할 수 있습니다"}
          >
            {busy ? (
              <span className="w-3 h-3 flex items-center justify-center shrink-0">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              </span>
            ) : (
              /* 좁아졌을 때 나타나는 단색 번개 쐐기형 기하 도형 아이콘 */
              <svg
                className="w-3 h-3 fill-current inline @[200px]:hidden shrink-0"
                viewBox="0 0 24 24"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            )}
            <span className="hidden @[200px]:inline">어셈블</span>
          </button>
        </div>
      </div>

      {/* 분리된 ASM 팝업창 컴포넌트 연동 (3단 구조: 로컬 파일, 저장된 파일, 예제 템플릿) */}
      <AsmFileUploadPopup
        isOpen={isUploadPopupOpen}
        onClose={() => setIsUploadPopupOpen(false)}
        anchorRef={uploadButtonRef}
        onSelectAssembly={(code) => onAssemblyChange?.(code)}
        savedFiles={savedFiles}
        currentFileId={currentFileId}
        onOpenSavedFile={onOpenSavedFile}
      />

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
              renderWhitespace: "none",
              padding: { top: 8, bottom: 8 },
              scrollbar: {
                vertical: "auto",
                horizontal: "auto",
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-[#E5E5E5] dark:divide-[#2D2D2D] font-mono [scrollbar-width:thin]">
          {error && (
            <div className="p-2 text-rose-600 bg-rose-50 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900/50">
              {error}
            </div>
          )}

          {rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[var(--ar-text-muted)] gap-1">
              <span className="text-2xl">⚡</span>
              <span className="font-semibold text-xs">
                어셈블리 코드가 비어 있습니다
              </span>
              <span className="text-[10px] text-slate-400">
                C 코드를 작성하고 [컴파일] 버튼을 누르거나, 상단 모드를 [어셈블리]로 전환해 보세요.
              </span>
            </div>
          ) : (
            rows.map((row, idx) => {
              const isSelected =
                (selectedLine !== null && row.sourceLine === selectedLine) ||
                (selectedAsmIndex !== null && idx === selectedAsmIndex);

              // Single 모드: 현재 실행 스텝인지 판별 (PC 일치)
              const isSingleStep =
                mode === "single" &&
                currentActiveStep !== null &&
                currentActiveStep !== undefined &&
                idx === currentActiveStep;

              // Pipeline 모드: 파이프라인 스테이지 태그들
              const normText = row.text.replace(/\s+/g, " ").trim().toLowerCase();
              const stageTags = activeStagesByInst[normText] || [];
              const isPipelineActive = mode === "pipeline" && stageTags.length > 0;

              // C 라인 번호 표시 (중복 라인은 빈칸으로 두어 가독성 증대)
              const showCLine = idx === 0 || rows[idx - 1]?.sourceLine !== row.sourceLine;

              // 명령어 분리 (Opcode / Operands)
              const { opcode, operands } = splitInstruction(row.text);

              return (
                <div
                  key={idx}
                  ref={(el) => {
                    if (el) rowElementsRef.current.set(idx, el);
                    else rowElementsRef.current.delete(idx);
                  }}
                  onClick={() => onSelectLine?.(row.sourceLine ?? null, idx)}
                  className={`flex items-center px-2 py-0.5 transition-colors cursor-pointer text-[11px] leading-snug group ${
                    isSingleStep
                      ? "bg-amber-100/80 dark:bg-amber-950/40 border-l-2 border-amber-500 font-semibold"
                      : isPipelineActive
                      ? "bg-sky-50 dark:bg-sky-950/30 border-l-2 border-sky-500"
                      : isSelected
                      ? "bg-blue-50/80 dark:bg-[#007ACC]/20 border-l-2 border-[#005FB8] dark:border-[#007ACC]"
                      : "hover:bg-[#F3F4F6] dark:hover:bg-[#2A2D2E] border-l-2 border-transparent"
                  }`}
                >
                  {/* 1열: 매핑된 C 코드 라인 번호 */}
                  <span
                    className={`w-7 shrink-0 text-right pr-2 select-none text-[10px] ${
                      isSelected
                        ? "text-[#005FB8] dark:text-[#79C0FF] font-bold"
                        : "text-[#8C959F] dark:text-[#6E7681]"
                    }`}
                  >
                    {showCLine && row.sourceLine ? `L${row.sourceLine}` : ""}
                  </span>

                  {/* 2열: 어셈블리 행 인덱스 */}
                  <span className="w-5 shrink-0 text-right pr-2 select-none text-[10px] text-[#8C959F] dark:text-[#6E7681]">
                    {idx}
                  </span>

                  {/* 3열: Opcode (연산자 - 보라/파랑 계열 강조) */}
                  <span className="w-14 shrink-0 font-bold text-[#8250DF] dark:text-[#D2A8FF]">
                    {opcode}
                  </span>

                  {/* 4열: Operands (피연산자) */}
                  <span className="flex-1 font-mono text-[#1F2328] dark:text-[#CCCCCC] truncate">
                    {operands}
                  </span>

                  {/* 5열: 활성 파이프라인 스테이지 뱃지 or Single Step 마커 */}
                  <div className="shrink-0 flex items-center gap-1 ml-2">
                    {isSingleStep && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500 text-white animate-pulse">
                        EXEC
                      </span>
                    )}

                    {mode === "pipeline" &&
                      stageTags.map((tag) => {
                        const cfg = STAGES_CONFIG.find((s) => s.name === tag);
                        return (
                          <span
                            key={tag}
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              cfg?.badgeBg || "bg-slate-500 text-white"
                            }`}
                          >
                            {tag}
                          </span>
                        );
                      })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
