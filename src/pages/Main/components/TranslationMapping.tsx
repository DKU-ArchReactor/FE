import { useAssistantSelection } from '../hooks/useAssistantSelection';
import type { EditorSelection } from '../utils/assistantSource';
import { useMemo, useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useTheme } from "@/context/ThemeContext";
import { mapAssembly, type MappedAssemblyRow } from "../utils/translationCompile";
import { RISCV_LANGUAGE_ID, riscvLanguageDef } from "../utils/riscvLanguage";
import type { StageBuffer, CycleEvents } from "@/type/simulation";
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
  onSelectLine?: (line: number | null, asmIndex?: number | null, openTutorModal?: boolean) => void;
  stageBuffers?: {
    IF?: StageBuffer | null;
    ID?: StageBuffer | null;
    EX?: StageBuffer | null;
    MEM?: StageBuffer | null;
    WB?: StageBuffer | null;
  };
  prevStageBuffers?: {
    IF?: StageBuffer | null;
    ID?: StageBuffer | null;
    EX?: StageBuffer | null;
    MEM?: StageBuffer | null;
    WB?: StageBuffer | null;
  };
  cycleEvents?: CycleEvents | null;
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
  isSimulated?: boolean;
};

const STAGES_CONFIG: {
  key: "IF" | "ID" | "EX" | "MEM" | "WB";
  name: string;
  badgeBg: string;
  // 매핑 코드들을 위한 연한 파스텔 배경 및 테두리 스타일 (빨/주/초/파/보)
  mappedBg: string;
}[] = [
    {
      key: "IF",
      name: "IF",
      badgeBg: "bg-[#EF4444] text-white",
      mappedBg: "bg-red-500/10 dark:bg-red-500/20 border-red-400/60 dark:border-red-500/50 text-red-950 dark:text-red-200",
    },
    {
      key: "ID",
      name: "ID",
      badgeBg: "bg-[#F97316] text-white",
      mappedBg: "bg-orange-500/10 dark:bg-orange-500/20 border-orange-400/60 dark:border-orange-500/50 text-orange-950 dark:text-orange-200",
    },
    {
      key: "EX",
      name: "EX",
      badgeBg: "bg-[#22C55E] dark:bg-[#15803D] text-white",
      mappedBg: "bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-400/60 dark:border-emerald-500/50 text-emerald-950 dark:text-emerald-200",
    },
    {
      key: "MEM",
      name: "MEM",
      badgeBg: "bg-[#0EA5E9] text-white",
      mappedBg: "bg-sky-500/10 dark:bg-sky-500/20 border-sky-400/60 dark:border-sky-500/50 text-sky-950 dark:text-sky-200",
    },
    {
      key: "WB",
      name: "WB",
      badgeBg: "bg-[#8B5CF6] text-white",
      mappedBg: "bg-purple-500/10 dark:bg-purple-500/20 border-purple-400/60 dark:border-purple-500/50 text-purple-950 dark:text-purple-200",
    },
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
  prevStageBuffers,
  cycleEvents,
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
  isSimulated = false,
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

  const asmEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const asmMonacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const asmDecorationsRef = useRef<string[]>([]);
  const selectedLineRef = useRef<number | null | undefined>(selectedLine);
  const activeTargetRef = useRef<"c" | "asm">(activeTarget);
  const assemblyRef = useRef<string>(assembly);
  const rowsRef = useRef<MappedAssemblyRow[]>(rows);
  const onSelectLineRef = useRef<Props["onSelectLine"]>(onSelectLine);
  const lastMouseSelectTimeRef = useRef<number>(0);

  useEffect(() => {
    selectedLineRef.current = selectedLine;
  }, [selectedLine]);

  useEffect(() => {
    activeTargetRef.current = activeTarget;
  }, [activeTarget]);

  useEffect(() => {
    assemblyRef.current = assembly;
  }, [assembly]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    onSelectLineRef.current = onSelectLine;
  }, [onSelectLine]);

  const resolveAsmRowIndex = (lineNum: number): number | null => {
    const lines = (assemblyRef.current || "").split(/\r?\n/);
    const rawTarget = (lines[lineNum - 1] ?? "").replace(/#.*/, "").trim();
    if (!rawTarget || rawTarget.startsWith(".") || /^[.$\w]+:$/.test(rawTarget)) {
      return null;
    }
    let execIdx = -1;
    for (let i = 0; i < Math.min(lineNum, lines.length); i++) {
      const clean = lines[i].replace(/#.*/, "").trim();
      if (!clean || clean.startsWith(".") || /^[.$\w]+:$/.test(clean)) continue;
      if (/^[a-zA-Z][\w.]*\s*[^=]*$/.test(clean)) {
        execIdx++;
      }
    }
    const currentRows = rowsRef.current;
    if (execIdx >= 0 && execIdx < currentRows.length) return execIdx;
    const normTarget = rawTarget.replace(/\s+/g, " ").trim().toLowerCase();
    const byText = currentRows.findIndex(
      (r) => r.text.replace(/\s+/g, " ").trim().toLowerCase() === normTarget
    );
    return byText >= 0 ? byText : execIdx >= 0 ? execIdx : null;
  };

  useEffect(() => {
    if (asmEditorRef.current && asmMonacoRef.current) {
      asmMonacoRef.current.editor.setTheme(theme === "dark" ? "riscv-asm-theme-dark" : "riscv-asm-theme-light");
    }
  }, [theme]);

  const handleAsmEditorMount: OnMount = (editorInstance, monacoInstance) => {
    trackSelection(editorInstance);
    asmEditorRef.current = editorInstance;
    asmMonacoRef.current = monacoInstance;

    // 1. RISC-V 커스텀 언어 등록 및 어셈블리 전용 정갈한 테마 등록
    if (!monacoInstance.languages.getLanguages().some((l: { id: string }) => l.id === RISCV_LANGUAGE_ID)) {
      monacoInstance.languages.register({ id: RISCV_LANGUAGE_ID });
      monacoInstance.languages.setMonarchTokensProvider(RISCV_LANGUAGE_ID, riscvLanguageDef);

      monacoInstance.editor.defineTheme("riscv-asm-theme-light", {
        base: "vs",
        inherit: false,
        rules: [
          { token: "keyword", foreground: "6D28D9", fontStyle: "bold" },
          { token: "keyword.directive", foreground: "6E7681", fontStyle: "italic" },
          { token: "type.identifier", foreground: "1F2328", fontStyle: "bold" },
          { token: "variable.predefined", foreground: "24292F" },
          { token: "identifier", foreground: "24292F" },
          { token: "number", foreground: "24292F" },
          { token: "number.hex", foreground: "24292F" },
          { token: "comment", foreground: "8C959F", fontStyle: "italic" },
          { token: "string", foreground: "24292F" },
        ],
        colors: {
          "editor.background": "#FFFFFF",
          "editor.foreground": "#24292F",
          "editorLineNumber.foreground": "#8C959F",
          "editorLineNumber.activeForeground": "#8C959F",
          "editorGutter.background": "#FFFFFF",
          "editor.lineHighlightBackground": "#00000000",
          "editor.lineHighlightBorder": "#00000000",
        },
      });

      monacoInstance.editor.defineTheme("riscv-asm-theme-dark", {
        base: "vs-dark",
        inherit: false,
        rules: [
          { token: "keyword", foreground: "A78BFA", fontStyle: "bold" },
          { token: "keyword.directive", foreground: "858585", fontStyle: "italic" },
          { token: "type.identifier", foreground: "E9D5FF", fontStyle: "bold" },
          { token: "variable.predefined", foreground: "CCCCCC" },
          { token: "identifier", foreground: "CCCCCC" },
          { token: "number", foreground: "CCCCCC" },
          { token: "number.hex", foreground: "CCCCCC" },
          { token: "comment", foreground: "6E7681", fontStyle: "italic" },
          { token: "string", foreground: "CCCCCC" },
        ],
        colors: {
          "editor.background": "#1E1E1E",
          "editor.foreground": "#CCCCCC",
          "editorLineNumber.foreground": "#858585",
          "editorLineNumber.activeForeground": "#858585",
          "editorGutter.background": "#1E1E1E",
          "editor.lineHighlightBackground": "#00000000",
          "editor.lineHighlightBorder": "#00000000",
        },
      });
    }

    monacoInstance.editor.setTheme(theme === "dark" ? "riscv-asm-theme-dark" : "riscv-asm-theme-light");

    editorInstance.onMouseDown((e) => {
      if (activeTargetRef.current !== "asm") return;

      const isLineNumberClick =
        e.target.type === monacoInstance.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
        e.target.type === monacoInstance.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
        Boolean(e.target.element?.closest(".line-numbers"));

      const clickedLine = e.target.position?.lineNumber;
      if (clickedLine) {
        lastMouseSelectTimeRef.current = Date.now();
        const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
        if (selectedLineRef.current === clickedLine && (!isMobile || !isLineNumberClick)) {
          onSelectLineRef.current?.(null, null, false);
        } else {
          const asmIdx = resolveAsmRowIndex(clickedLine);
          onSelectLineRef.current?.(clickedLine, asmIdx, isLineNumberClick);
        }
      }
    });

    const domNode = editorInstance.getDomNode();
    domNode?.addEventListener("click", (evt) => {
      if (activeTargetRef.current !== "asm") return;
      if (Date.now() - lastMouseSelectTimeRef.current < 80) return;
      const lineNumEl = (evt.target as HTMLElement | null)?.closest(".line-numbers");
      if (lineNumEl) {
        const parsed = parseInt((lineNumEl.textContent || "").trim(), 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          const asmIdx = resolveAsmRowIndex(parsed);
          onSelectLineRef.current?.(parsed, asmIdx, true);
        }
      }
    });

    editorInstance.onDidChangeCursorPosition((e) => {
      if (activeTargetRef.current !== "asm") return;
      if (
        e.reason === monacoInstance.editor.CursorChangeReason.Explicit &&
        e.source !== "keyboard" &&
        e.source !== "modelChange" &&
        Date.now() - lastMouseSelectTimeRef.current > 80
      ) {
        const line = e.position.lineNumber;
        if (line) {
          const asmIdx = resolveAsmRowIndex(line);
          onSelectLineRef.current?.(line, asmIdx, false);
        }
      }
    });
  };

  useEffect(() => {
    if (!asmEditorRef.current || !asmMonacoRef.current) return;
    if (activeTarget !== "asm") {
      asmDecorationsRef.current = asmEditorRef.current.deltaDecorations(
        asmDecorationsRef.current,
        []
      );
      return;
    }

    const newDecorations: editor.IModelDeltaDecoration[] = [];

    // 1. 현재 CPU 실행 중인 라인 (시뮬레이션 완료 후 재생 시)
    let executingLine: number | null = null;
    if (isSimulated) {
      if (mode === "single" && currentActiveStep !== null && currentActiveStep !== undefined && currentActiveStep >= 0) {
        executingLine = currentActiveStep + 1;
      } else if (mode === "pipeline" && stageBuffers) {
        const activeStage = stageBuffers.EX || stageBuffers.ID || stageBuffers.WB;
        if (activeStage?.assembly) {
          const norm = activeStage.assembly.trim().toLowerCase();
          const foundIdx = rows.findIndex((r) => r.text.trim().toLowerCase() === norm);
          if (foundIdx >= 0) {
            executingLine = foundIdx + 1;
          }
        }
      }

      if (executingLine && executingLine > 0) {
        const isAlsoSelected = selectedLine === executingLine;
        newDecorations.push({
          range: new asmMonacoRef.current.Range(executingLine, 1, executingLine, 1),
          options: {
            isWholeLine: true,
            className: isAlsoSelected
              ? "monaco-executing-selected-asm-line"
              : "monaco-executing-asm-line",
            lineNumberClassName: isAlsoSelected
              ? "monaco-executing-selected-asm-linenumber"
              : "monaco-executing-asm-linenumber",
          },
        });
      }
    }

    // 2. 사용자가 선택한 라인 (줄 번호 클릭 또는 라인 클릭)
    if (selectedLine && selectedLine > 0 && selectedLine !== executingLine) {
      newDecorations.push({
        range: new asmMonacoRef.current.Range(selectedLine, 1, selectedLine, 1),
        options: {
          isWholeLine: true,
          className: "monaco-selected-asm-line",
          lineNumberClassName: "monaco-selected-asm-linenumber",
        },
      });
    }

    asmDecorationsRef.current = asmEditorRef.current.deltaDecorations(
      asmDecorationsRef.current,
      newDecorations
    );
  }, [selectedLine, currentActiveStep, stageBuffers, mode, activeTarget, rows, isSimulated]);

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
  // 스테이지 이름, 스톨(지연) 여부, 플러시(버블) 여부를 함께 기록
  const activeStagesByInst = useMemo(() => {
    const map: Record<string, { stage: string; isStall: boolean; isBubble: boolean }[]> = {};
    if (!stageBuffers || mode === "single") return map;

    const hasGlobalStall = Boolean(cycleEvents?.stall?.has_stall);
    const stallStage = cycleEvents?.stall?.stage; // 예: "ID"

    const hasGlobalFlush = Boolean(cycleEvents?.control_hazard?.has_flush);
    const flushedStages = cycleEvents?.control_hazard?.flushed_stages || ["IF", "ID"];

    // 1. 현재 파이프라인 버퍼에 존재하는 명령어들 매핑
    STAGES_CONFIG.forEach(({ key, name }) => {
      const buf = stageBuffers[key];
      if (buf && buf.assembly && buf.assembly !== "bubble" && buf.assembly !== "empty") {
        const norm = buf.assembly.replace(/\s+/g, " ").trim().toLowerCase();
        if (norm) {
          if (!map[norm]) map[norm] = [];
          const isStalled =
            buf.status === "stalled" ||
            buf.status === "stall" ||
            (hasGlobalStall && (stallStage ? stallStage === name : name === "ID"));

          const isBubble =
            buf.status === "flushed" ||
            buf.flush_info?.is_flushed === true ||
            (hasGlobalFlush && flushedStages.includes(name));

          if (!map[norm].some((s) => s.stage === name)) {
            map[norm].push({ stage: name, isStall: isStalled, isBubble });
          }
        }
      }
    });

    // 2. 분기 플러시(Flush)가 일어났을 때: 이전 사이클에서 IF/ID에 들어있던 명령어가 현재 버블로 변환되었을 경우
    // 현재 버퍼의 IF/ID가 'nop' 또는 'bubble'로 바뀌었더라도, 플러시된 원래 명령어를 찾아 BBL 뱃지 추가
    if (hasGlobalFlush && prevStageBuffers) {
      flushedStages.forEach((stgName) => {
        const key = stgName as "IF" | "ID" | "EX" | "MEM" | "WB";
        const prevBuf = prevStageBuffers[key];
        const curBuf = stageBuffers[key];

        // 이전 사이클에 실제 명령어가 있었는데 이번 사이클에 버블/nop으로 대체된 경우
        if (
          prevBuf &&
          prevBuf.assembly &&
          prevBuf.assembly !== "bubble" &&
          prevBuf.assembly !== "empty" &&
          (!curBuf || curBuf.assembly === "bubble" || curBuf.assembly === "nop" || curBuf.status === "flushed" || curBuf.flush_info?.is_flushed)
        ) {
          const prevNorm = prevBuf.assembly.replace(/\s+/g, " ").trim().toLowerCase();
          if (prevNorm) {
            if (!map[prevNorm]) map[prevNorm] = [];
            if (!map[prevNorm].some((s) => s.stage === stgName && s.isBubble)) {
              map[prevNorm].push({ stage: stgName, isStall: false, isBubble: true });
            }
          }
        }
      });
    }

    return map;
  }, [stageBuffers, prevStageBuffers, cycleEvents, mode]);

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
      <header
        className={`h-8 shrink-0 flex items-center justify-between gap-2 border-b border-[var(--ar-border)] px-3.5 min-w-0 transition-colors ${
          activeTarget === "asm"
            ? "border-l-2 border-l-amber-500 bg-[var(--ar-header-bg)]"
            : "border-l-2 border-l-[#005FB8] dark:border-l-[#007ACC] bg-[var(--ar-header-bg)]"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200 ${
              activeTarget === "asm"
                ? "bg-amber-500 scale-100"
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
          {/* 어셈블리 시뮬레이션 버튼 (ASM 모드일 때만 활성화 & C 에디터 컴파일 버튼과 동일한 액센트/이펙트, C 모드일 때는 비활성화 회색 처리) */}
          <button
            type="button"
            className={`h-[22px] rounded transition-colors flex items-center justify-center gap-1 shrink-0 px-2.5 text-[10.5px] font-semibold ${
              activeTarget === "asm"
                ? "bg-[var(--ar-accent)] text-white hover:bg-[var(--ar-accent-hover)] disabled:opacity-50 cursor-pointer shadow-2xs"
                : "border border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#8C959F] dark:text-[#6E7681] opacity-40 cursor-not-allowed"
            }`}
            onClick={onSimulateAssembly}
            disabled={busy || !assembly?.trim() || activeTarget !== "asm"}
            title={activeTarget === "asm" ? "어셈블리 빌드 및 시뮬레이션 준비" : "어셈블리 작성 모드를 선택한 후 실행할 수 있습니다"}
          >
            {busy ? (
              <span className="w-3 h-3 flex items-center justify-center shrink-0">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              </span>
            ) : (
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
        <div className="min-h-0 flex-1 relative bg-white dark:bg-[#1E1E1E] asm-monaco-container">
          <Editor
            onMount={handleAsmEditorMount}
            height="100%"
            language={RISCV_LANGUAGE_ID}
            theme={theme === "dark" ? "riscv-asm-theme-dark" : "riscv-asm-theme-light"}
            value={assembly}
            onChange={(val) => onAssemblyChange?.(val ?? "")}
            options={{
              automaticLayout: true,
              fontSize: 13,
              lineHeight: 24,
              fontFamily: "'D2Coding', Consolas, 'Fira Code', monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: "off",
              tabSize: 4,
              insertSpaces: true,
              lineNumbers: "on",
              lineNumbersMinChars: 3,
              glyphMargin: true,
              folding: false,
              lineDecorationsWidth: 22,
              padding: { top: 4, bottom: 4 },
              readOnly: busy,
              stickyScroll: { enabled: false },
              renderLineHighlight: "none",
              overviewRulerBorder: false,
              hideCursorInOverviewRuler: true,
              renderWhitespace: "none",
              guides: {
                indentation: false,
                highlightActiveIndentation: false,
                bracketPairs: false,
              },
            }}
          />
        </div>
      ) : busy || (!assembly && rows.length === 0) ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center bg-[#F8F8F8] dark:bg-[#1E1E1E]">
          {busy ? (
            <div className="w-7 h-7 border-2 border-[#005FB8] dark:border-[#007ACC] border-t-transparent rounded-full animate-spin mb-3" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white dark:bg-[#252526] border border-[#E5E5E5] dark:border-[#333333] flex items-center justify-center text-[#57606A] dark:text-[#858585] mb-3 text-lg shadow-2xs">
              📜
            </div>
          )}
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

            // [싱글 모드] 같은 C 실행 라인에 속해 있는 형제 어셈블리 라인인지 확인
            const isSingleExecutionSibling =
              mode === "single" &&
              executionLine !== null &&
              executionLine !== undefined &&
              row.sourceLine === executionLine &&
              !isCurrentSingleActive;

            // [파이프라인 모드 & 싱글 모드 공통] 연속된 C 라인 청크 기준 트리 브래킷 타입 계산
            // "start"(┌), "middle"(│), "end"(└), "single"(─), null(CRT 등 비매핑)
            type BracketType = "start" | "middle" | "end" | "single" | null;
            let bracketType: BracketType = null;

            if (row.sourceLine !== null && row.sourceLine !== undefined) {
              const prevSame = index > 0 && rows[index - 1]?.sourceLine === row.sourceLine;
              const nextSame = index < rows.length - 1 && rows[index + 1]?.sourceLine === row.sourceLine;

              if (!prevSame && nextSame) {
                bracketType = "start";
              } else if (prevSame && nextSame) {
                bracketType = "middle";
              } else if (prevSame && !nextSame) {
                bracketType = "end";
              } else {
                bracketType = "single";
              }
            }

            // 선택 라인(파란색/보라색) 그룹
            const isSelectedPrimary =
              selectedAsmIndex !== null && selectedAsmIndex !== undefined
                ? selectedAsmIndex === index
                : isFirstOfMatch;
            const isSelectedSibling = isMatched && !isSelectedPrimary;

            // 실행 중인 라인이면서 동시에 사용자가 선택한 라인인 경우
            const isExecutingAndSelected = isCurrentSingleActive && isSelectedPrimary;
            const isCrt = row.sourceLine === null;

            // 배경 클래스 결정:
            // 1) 사용자가 직접 선택한 라인: 보라/파랑 (최우선)
            // 2) 실제 실행 중인 라인 (파이프라인 activeStages 또는 싱글 activeStep): 연한 녹색 하이라이트!
            // 3) 형제 라인(매핑 코드)들은 배경색을 칠하지 않고 트리 브래킷 기호로만 관계 표현
            let rowColorClass = "border-transparent hover:bg-slate-100/70 dark:hover:bg-[#2A2D2E] text-[#24292F] dark:text-[#CCCCCC]";

            // 버블/플러시된 스테이지 여부
            const hasEffectiveExecution = activeStages.some((s) => !s.isBubble);
            const isPipelineExecuting = mode === "pipeline" && hasEffectiveExecution;
            const isPipelineBubble = mode === "pipeline" && !hasEffectiveExecution && activeStages.some((s) => s.isBubble);
            const isLineExecuting = isCurrentSingleActive || isPipelineExecuting;

            if (isSelectedPrimary) {
              rowColorClass = mode === "pipeline"
                ? "bg-purple-100/90 dark:bg-[#2E1065] border-purple-600 dark:border-[#8B5CF6] text-purple-950 dark:text-[#E9D5FF] font-bold shadow-2xs"
                : "bg-blue-100/90 dark:bg-[#04395E] border-blue-600 dark:border-[#007ACC] text-blue-950 dark:text-[#9CDCFE] font-bold shadow-2xs";
            } else if (isSelectedSibling) {
              rowColorClass = mode === "pipeline"
                ? "bg-purple-50/50 dark:bg-[#2E1065]/40 border-purple-300/60 dark:border-[#8B5CF6]/50 text-purple-900/80 dark:text-[#E9D5FF]/80 font-normal"
                : "bg-blue-50/50 dark:bg-[#04395E]/40 border-blue-300/60 dark:border-[#007ACC]/50 text-blue-900/80 dark:text-[#9CDCFE]/80 font-normal";
            } else if (isLineExecuting) {
              // 싱글 모드와 파이프라인 모드 공통: 실제 실행 중인 라인은 싱글 모드의 선명한 에메랄드 테마를 1:1 그대로 적용
              rowColorClass = "bg-emerald-100/90 dark:bg-[#133A27] border-emerald-500 dark:border-[#23D18B] text-emerald-950 dark:text-[#7EE787] font-bold shadow-2xs";
            } else if (isPipelineBubble || isSingleExecutionSibling) {
              // 싱글 모드 매핑 형제 라인 디자인을 파이프라인의 버블(플러시) 라인에도 그대로 동일하게 적용!
              rowColorClass = "bg-emerald-50/50 dark:bg-[#133A27]/40 border-emerald-300/60 dark:border-[#23D18B]/50 text-emerald-900/80 dark:text-[#7EE787]/80 font-normal";
            }

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
                role="button"
                tabIndex={0}
                aria-label={`ASM L${index + 1} ${row.text}`}
                aria-pressed={isSelectedPrimary}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.currentTarget.click();
                  }
                }}
                className={`flex items-stretch transition-colors duration-100 cursor-pointer group min-h-[24px] border-l-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ar-accent)] ${rowColorClass}`}
              >
                {/* 1. 화살표 / 인디케이터 (버블 라인은 화살표 없음, 유효한 실행 라인에는 초록색 ▶ 유지) */}
                <div className="w-5 shrink-0 flex items-center justify-center select-none pl-0.5">
                  {isExecutingAndSelected ? (
                    <div className="flex items-center gap-0.5">
                      <span className="text-emerald-600 dark:text-[#23D18B] text-xs font-bold leading-none animate-pulse">▶</span>
                      <span className="text-[#005FB8] dark:text-[#007ACC] text-[9px] leading-none">●</span>
                    </div>
                  ) : isLineExecuting ? (
                    <span className="text-emerald-600 dark:text-[#23D18B] text-xs font-bold leading-none animate-pulse">▶</span>
                  ) : isSelectedPrimary ? (
                    <span className={`${mode === "pipeline" ? "text-purple-600 dark:text-[#A78BFA]" : "text-[#005FB8] dark:text-[#007ACC]"} text-[10px] leading-none`}>●</span>
                  ) : null}
                </div>

                {/* 2. CSS 기반 연속 트리 브래킷 (위아래 빈틈 없이 100% 실선 연결) */}
                <div className="w-3.5 self-stretch shrink-0 relative select-none">
                  {bracketType && (
                    <div
                      className={`absolute inset-0 pointer-events-none ${isSelectedPrimary || isSelectedSibling
                        ? mode === "pipeline"
                          ? "text-purple-600 dark:text-[#A78BFA]"
                          : "text-[#005FB8] dark:text-[#007ACC]"
                        : "text-slate-300 dark:text-[#3E4245] group-hover:text-slate-400 dark:group-hover:text-[#585C60]"
                        }`}
                    >
                      {/* 그룹 시작: ┌ (위쪽 절반 비움, 아래쪽 수직선 + 중간 가로선) */}
                      {bracketType === "start" && (
                        <>
                          <span className="absolute left-1/2 top-1/2 bottom-0 w-[1.5px] -translate-x-1/2 bg-current" />
                          <span className="absolute left-1/2 top-1/2 right-0.5 h-[1.5px] -translate-y-1/2 bg-current" />
                        </>
                      )}
                      {/* 그룹 중간: │ (위아래 100% 관통 수직선) */}
                      {bracketType === "middle" && (
                        <span className="absolute left-1/2 top-0 bottom-0 w-[1.5px] -translate-x-1/2 bg-current" />
                      )}
                      {/* 그룹 끝: └ (위쪽 수직선 + 중간 가로선) */}
                      {bracketType === "end" && (
                        <>
                          <span className="absolute left-1/2 top-0 bottom-1/2 w-[1.5px] -translate-x-1/2 bg-current" />
                          <span className="absolute left-1/2 top-1/2 right-0.5 h-[1.5px] -translate-y-1/2 bg-current" />
                        </>
                      )}
                      {/* 1줄 단독 매핑: ─ (중간 가로 막대) */}
                      {bracketType === "single" && (
                        <span className="absolute left-1.5 right-0.5 top-1/2 h-[1.5px] -translate-y-1/2 bg-current" />
                      )}
                    </div>
                  )}
                </div>

                {/* 3. 라인 번호 */}
                <div
                  className={`w-8 shrink-0 text-right pr-3 select-none text-[13px] flex items-center justify-end ${isSelectedPrimary
                    ? mode === "pipeline"
                      ? "text-purple-700 dark:text-[#C4B5FD] font-bold"
                      : "text-[#005FB8] dark:text-[#79C0FF] font-bold"
                    : isSelectedSibling
                      ? mode === "pipeline"
                        ? "text-purple-500 dark:text-[#C4B5FD]/70 font-medium"
                        : "text-blue-500 dark:text-[#79C0FF]/70 font-medium"
                      : isLineExecuting
                        ? "text-emerald-700 dark:text-[#7EE787] font-bold"
                        : isPipelineBubble || isSingleExecutionSibling
                          ? "text-emerald-600 dark:text-[#7EE787]/70"
                          : "text-[#8C959F] dark:text-[#858585]"
                    }`}
                >
                  {index + 1}
                </div>

                {/* 4. Opcode (CRT 비매핑 코드는 회색, C 매핑 코드는 모드별 액센트 색) */}
                <div className="w-[52px] shrink-0 font-bold select-text flex items-center">
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
                          : isLineExecuting
                            ? "text-emerald-800 dark:text-[#7EE787] font-bold"
                            : isPipelineBubble || isSingleExecutionSibling
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
                          : isLineExecuting
                            ? "text-slate-950 dark:text-white font-bold"
                            : isPipelineBubble || isSingleExecutionSibling
                              ? "text-slate-800 dark:text-[#D4D4D4] font-normal"
                              : isCrt
                                ? "text-[#6E7681]/90 dark:text-[#858585]"
                                : "text-[#24292F] dark:text-[#CCCCCC]"
                    }
                  >
                    {operands}
                  </span>

                  {/* 파이프라인 스테이지 뱃지 (실행 라인 표시: 스톨 시 STL 뱃지, 플러시 시 BBL 뱃지 표시) */}
                  {activeStages.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0 select-none">
                      {activeStages.map(({ stage: stg, isStall, isBubble }) => {
                        const cfg = STAGES_CONFIG.find((s) => s.name === stg);
                        return (
                          <div key={stg} className="flex items-center gap-1">
                            {/* 1. 스톨 발생 시: 다이어그램 헤더와 1:1 동일한 둥근 캡슐 STL 뱃지(SVG 화살표 포함)를 왼쪽에 표시 */}
                            {isStall && (
                              <span
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-[#451A03] text-amber-600 dark:text-amber-300 border border-amber-400 dark:border-amber-500 text-[8.5px] font-black shadow-2xs animate-in zoom-in-95 duration-100"
                                title="스톨(Stall): 데이터 대기(Hazard)로 인해 1클록 지연되어 이 스테이지에 정지 상태로 유지됨"
                              >
                                <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                                  <path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-7.85-1.42 1.42L16.86 11H5v2z" />
                                </svg>
                                <span className="inline-block -translate-y-[0.5px]">STL</span>
                              </span>
                            )}

                            {/* 2. 플러시(버블) 발생 시: 다이어그램 헤더와 1:1 동일한 둥근 캡슐 BBL 뱃지(구름/버블 SVG 포함) 표시 */}
                            {isBubble && !isStall && (
                              <span
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-[#182C3D] text-sky-500 dark:text-sky-300 border border-sky-400 dark:border-sky-400 text-[8.5px] font-black shadow-2xs animate-in zoom-in-95 duration-100"
                                title="플러시(Bubble): 분기/점프로 인해 무효화되어 버블(NOP)로 변환됨"
                              >
                                <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                                </svg>
                                <span className="inline-block -translate-y-[0.5px]">BBL</span>
                              </span>
                            )}

                            {/* 3. 스테이지 뱃지 (버블인 경우 반투명 딤 처리, 정상인 경우 선명한 솔리드) */}
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-sans font-bold shadow-2xs animate-in zoom-in-95 duration-100 ${isBubble
                                  ? "bg-slate-400/60 dark:bg-slate-600/60 text-white/90 line-through decoration-white/70"
                                  : isStall
                                    ? `${cfg?.badgeBg || "bg-slate-700 text-white"} ring-1 ring-amber-400 ring-offset-0.5`
                                    : cfg?.badgeBg || "bg-slate-700 text-white"
                                }`}
                              title={
                                isBubble
                                  ? `분기 예측 실패로 플러시(버블) 처리된 ${stg} 단계`
                                  : isStall
                                    ? `스톨로 인해 지연되어 유지 중인 ${stg} 단계`
                                    : `${stg} 단계 실행 중`
                              }
                            >
                              {stg}
                            </span>
                          </div>
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
                        : isLineExecuting
                          ? "bg-emerald-600 text-white font-bold shadow-2xs"
                          : isSelectedSibling
                            ? mode === "pipeline"
                              ? "bg-purple-100 dark:bg-[#2E1065] text-purple-800 dark:text-[#E9D5FF] font-semibold"
                              : "bg-blue-100 dark:bg-[#04395E] text-blue-800 dark:text-[#9CDCFE] font-semibold"
                            : isPipelineBubble || isSingleExecutionSibling
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
                        : isLineExecuting
                          ? "bg-emerald-600 text-white font-bold shadow-2xs"
                          : isSelectedSibling
                            ? mode === "pipeline"
                              ? "bg-purple-100 dark:bg-[#2E1065] text-purple-800 dark:text-[#E9D5FF] font-semibold"
                              : "bg-blue-100 dark:bg-[#04395E] text-blue-800 dark:text-[#9CDCFE] font-semibold"
                            : isPipelineBubble || isSingleExecutionSibling
                              ? "bg-emerald-100 dark:bg-[#133A27] text-emerald-800 dark:text-[#7EE787] font-semibold"
                              : "bg-[#F0F0F0] dark:bg-[#252526] text-[#8C959F] dark:text-[#858585] group-hover:text-[#57606A] dark:group-hover:text-[#CCCCCC]"
                        }`}
                      title="대응하는 C 소스 위치가 확인되지 않았습니다. CRT 여부는 줄 정보만으로 확정할 수 없습니다."
                    >
                      미매핑
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

      {/* C 에디터와 100% 동일한 하단 컴파일/어셈블 에러 로그 배너 */}
      {error && (
        <pre
          role="alert"
          className="max-h-24 shrink-0 overflow-auto border-t border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-[11px] whitespace-pre-wrap text-rose-700 dark:text-rose-300 font-mono"
        >
          {error}
        </pre>
      )}
    </section>
  );
}
