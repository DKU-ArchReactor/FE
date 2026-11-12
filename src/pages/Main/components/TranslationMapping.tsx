import { useAssistantSelection } from '../hooks/useAssistantSelection';
import type { EditorSelection } from '../utils/assistantSource';
import { useMemo, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "@/context/ThemeContext";
import { mapAssembly, type MappedAssemblyRow } from "../utils/translationCompile";
import type { StageBuffer } from "@/type/simulation";
import type { FileSummary } from "@/type/file";
import AsmFileUploadPopup from "./AsmFileUploadPopup";

type Props = {
  onSourceSelection?: (selection: EditorSelection | null) => void;
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
    { key: "IF", name: "IF", badgeBg: "bg-[#EF4444] text-white" },
    { key: "ID", name: "ID", badgeBg: "bg-[#F97316] text-white" },
    { key: "EX", name: "EX", badgeBg: "bg-[#22C55E] dark:bg-[#15803D] text-white" },
    { key: "MEM", name: "MEM", badgeBg: "bg-[#0EA5E9] text-white" },
    { key: "WB", name: "WB", badgeBg: "bg-[#8B5CF6] text-white" },
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
  onSourceSelection,
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
  onSave,
  onOpenSavedFile,
  savedFiles = [],
  currentFileId,
}: Props) {
  const { theme } = useTheme();
  const trackSelection = useAssistantSelection('asm', onSourceSelection);
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
      {/* 1단: 메인 헤더 바 (어셈블리 제목 + 파일명/개수, 우측 상태 문구) */}
      <header className="h-8 shrink-0 flex items-center justify-between gap-2 border-b border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-3.5 min-w-0 border-l-2 border-l-[#005FB8] dark:border-l-[#007ACC]">
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
            className={`h-[22px] rounded border px-2 text-[10.5px] font-medium transition-colors flex items-center justify-center gap-1 shrink-0 ${activeTarget !== "asm"
                ? "opacity-40 cursor-not-allowed border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#8C959F] dark:text-[#6E7681]"
                : isUploadPopupOpen
                  ? "border-[#005FB8] dark:border-[#007ACC] bg-[#005FB8] text-white dark:bg-[#007ACC] cursor-pointer font-semibold"
                  : "border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#24292F] dark:text-[#CCCCCC] hover:bg-[#F3F4F6] dark:hover:bg-[#37373D] cursor-pointer"
              }`}
            title="어셈블리 파일 불러오기 및 예제 템플릿 열기"
          >
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
              className={`text-[8.5px] opacity-75 transition-transform duration-150 ${isUploadPopupOpen ? "rotate-180" : ""
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
            className={`h-[22px] rounded border px-2 text-[10.5px] font-medium transition-colors flex items-center justify-center gap-1 shrink-0 ${activeTarget !== "asm"
                ? "opacity-40 cursor-not-allowed border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#8C959F] dark:text-[#6E7681]"
                : asmSaveSuccess
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer"
                  : "border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#24292F] dark:text-[#CCCCCC] hover:bg-[#F3F4F6] dark:hover:bg-[#37373D] cursor-pointer"
              }`}
            title="현재 어셈블리 코드를 main.s 파일로 다운로드"
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
            className={`h-[22px] rounded border px-2 text-[10.5px] font-medium transition-colors flex items-center justify-center gap-1 shrink-0 ${activeTarget !== "asm"
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
          {/* 어셈블리 시뮬레이션 버튼 (C 에디터 컴파일 버튼과 동일한 h-[22px], 반응형 쐐기 번개 도형) */}
          <button
            type="button"
            onClick={onSimulateAssembly}
            disabled={busy || !assembly?.trim() || activeTarget !== "asm"}
            className={`h-[22px] rounded px-2.5 text-[10.5px] font-semibold transition-colors flex items-center justify-center gap-1 shrink-0 ${activeTarget === "asm"
                ? "bg-[var(--ar-accent)] text-white hover:bg-[var(--ar-accent-hover)] cursor-pointer"
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
            onMount={trackSelection}
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
                    ? mode === "pipeline"
                      ? "bg-purple-100/90 dark:bg-[#2E1065] border-purple-600 dark:border-[#8B5CF6] text-purple-950 dark:text-[#E9D5FF] font-bold shadow-2xs"
                      : "bg-blue-100/90 dark:bg-[#04395E] border-blue-600 dark:border-[#007ACC] text-blue-950 dark:text-[#9CDCFE] font-bold shadow-2xs"
                    : isSelectedSibling
                      ? mode === "pipeline"
                        ? "bg-purple-50/50 dark:bg-[#2E1065]/40 border-purple-300/60 dark:border-[#8B5CF6]/50 text-purple-900/80 dark:text-[#E9D5FF]/80 font-normal"
                        : "bg-blue-50/50 dark:bg-[#04395E]/40 border-blue-300/60 dark:border-[#007ACC]/50 text-blue-900/80 dark:text-[#9CDCFE]/80 font-normal"
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
                    <span className={`${mode === "pipeline" ? "text-purple-600 dark:text-[#A78BFA]" : "text-[#005FB8] dark:text-[#007ACC]"} text-[10px] leading-none`}>●</span>
                  ) : null}
                </div>

                {/* 2. 라인 번호 */}
                <div
                  className={`w-9 shrink-0 text-right pr-4 select-none text-[13px] ${isSelectedPrimary
                    ? mode === "pipeline"
                      ? "text-purple-700 dark:text-[#C4B5FD] font-bold"
                      : "text-[#005FB8] dark:text-[#79C0FF] font-bold"
                    : isSelectedSibling
                      ? mode === "pipeline"
                        ? "text-purple-500 dark:text-[#C4B5FD]/70 font-medium"
                        : "text-blue-500 dark:text-[#79C0FF]/70 font-medium"
                      : isCurrentSingleActive
                        ? "text-emerald-700 dark:text-[#7EE787] font-bold"
                        : isExecutionSibling
                          ? "text-emerald-600 dark:text-[#7EE787]/70"
                          : "text-[#8C959F] dark:text-[#858585]"
                    }`}
                >
                  {index + 1}
                </div>

                {/* 3. Opcode (CRT 비매핑 코드는 회색, C 매핑 코드는 모드별 액센트 색) */}
                <div className="w-[52px] shrink-0 font-bold select-text">
                  <span
                    className={
                      isSelectedPrimary
                        ? mode === "pipeline"
                          ? "text-purple-900 dark:text-[#E9D5FF] font-bold"
                          : "text-blue-800 dark:text-[#79C0FF] font-bold"
                        : isSelectedSibling
                          ? mode === "pipeline"
                            ? "text-purple-700 dark:text-[#E9D5FF]/80 font-semibold"
                            : "text-blue-600 dark:text-[#79C0FF]/80 font-semibold"
                          : isCurrentSingleActive
                            ? "text-emerald-800 dark:text-[#7EE787] font-bold"
                            : isExecutionSibling
                              ? "text-emerald-700 dark:text-[#7EE787]/80 font-semibold"
                              : isCrt
                                ? "text-[#6E7681] dark:text-[#858585] font-semibold"
                                : mode === "pipeline"
                                  ? "text-purple-700 dark:text-[#A78BFA] font-semibold"
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
                        ? mode === "pipeline"
                          ? "bg-purple-600 text-white font-bold shadow-2xs"
                          : "bg-[#005FB8] dark:bg-[#007ACC] text-white font-bold shadow-2xs"
                        : isCurrentSingleActive
                          ? "bg-emerald-600 text-white font-bold shadow-2xs"
                          : isSelectedSibling
                            ? mode === "pipeline"
                              ? "bg-purple-100 dark:bg-[#2E1065] text-purple-800 dark:text-[#E9D5FF] font-semibold"
                              : "bg-blue-100 dark:bg-[#04395E] text-blue-800 dark:text-[#9CDCFE] font-semibold"
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
                        ? mode === "pipeline"
                          ? "bg-purple-600 text-white font-bold shadow-2xs"
                          : "bg-[#005FB8] dark:bg-[#007ACC] text-white font-bold shadow-2xs"
                        : isCurrentSingleActive
                          ? "bg-emerald-600 text-white font-bold shadow-2xs"
                          : isSelectedSibling
                            ? mode === "pipeline"
                              ? "bg-purple-100 dark:bg-[#2E1065] text-purple-800 dark:text-[#E9D5FF] font-semibold"
                              : "bg-blue-100 dark:bg-[#04395E] text-blue-800 dark:text-[#9CDCFE] font-semibold"
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
