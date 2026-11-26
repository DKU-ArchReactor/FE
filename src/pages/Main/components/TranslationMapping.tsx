import { useAssistantSelection } from '../hooks/useAssistantSelection';
import type { EditorSelection } from '../utils/assistantSource';
import { useMemo, useEffect, useRef, useState } from "react";
import Editor, { type OnMount, type BeforeMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { getAccessToken } from "@/api/authSession";
import { mapAssembly, type MappedAssemblyRow } from "../utils/translationCompile";
import { RISCV_LANGUAGE_ID } from "../utils/riscvLanguage";
import { getRiscvMonacoThemeName, registerRiscvAndThemes } from "../utils/riscvMonacoTheme";
import type { StageBuffer, CycleEvents, SimulationResult } from "@/type/simulation";
import type { FileSummary } from "@/type/file";
import { isMobileViewport } from "../types";
import AsmFileUploadPopup from "./AsmFileUploadPopup";
import { MappingRowList } from "./MappingRowList";

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
  simulationData?: SimulationResult | null;
  playbackCycle?: number;
  mode?: "single" | "pipeline";
  currentActiveStep?: number | null;
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
  cycleEvents,
  simulationData,
  playbackCycle,
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
  const trackSelection = useAssistantSelection('asm', onSourceSelection);
  const sourceLines = source.split(/\r?\n/);
  const rows: MappedAssemblyRow[] = useMemo(() => {
    if (mappedRows && mappedRows.length > 0) return mappedRows;
    return mapAssembly(assembly, sourceLines.length);
  }, [mappedRows, assembly, sourceLines.length]);

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

  const activeThemeName = useMemo(
    () => getRiscvMonacoThemeName(mode),
    [mode]
  );

  useEffect(() => {
    if (asmEditorRef.current && asmMonacoRef.current) {
      registerRiscvAndThemes(asmMonacoRef.current);
      asmMonacoRef.current.editor.setTheme(activeThemeName);
    }
  }, [activeThemeName]);

  const handleAsmBeforeMount: BeforeMount = (monacoInstance) => {
    asmMonacoRef.current = monacoInstance;
    registerRiscvAndThemes(monacoInstance);
  };

  const handleAsmEditorMount: OnMount = (editorInstance, monacoInstance) => {
    trackSelection(editorInstance);
    asmEditorRef.current = editorInstance;
    asmMonacoRef.current = monacoInstance;

    registerRiscvAndThemes(monacoInstance);
    monacoInstance.editor.setTheme(activeThemeName);
    if (editorInstance.getModel()) {
      monacoInstance.editor.setModelLanguage(editorInstance.getModel()!, RISCV_LANGUAGE_ID);
    }
    editorInstance.setPosition({ lineNumber: 1, column: 1 });

    editorInstance.onMouseDown((e) => {
      if (activeTargetRef.current !== "asm") return;

      const isLineNumberClick =
        e.target.type === monacoInstance.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
        e.target.type === monacoInstance.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
        Boolean(e.target.element?.closest(".line-numbers"));

      const clickedLine = e.target.position?.lineNumber;
      if (clickedLine) {
        lastMouseSelectTimeRef.current = Date.now();
        const asmLines = (editorInstance.getModel()?.getValue() ?? assembly).split(/\r?\n/);
        const lineContent = asmLines[clickedLine - 1]?.replace(/#.*$/, "").replace(/\/\/.*$/, "").trim();
        const isEmptyLine = !lineContent || lineContent.length === 0;

        if (isEmptyLine) {
          onSelectLineRef.current?.(null, null, false);
          return;
        }

        const isMobile = isMobileViewport();
        if (selectedLineRef.current === clickedLine && isLineNumberClick && !isMobile) {
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
          const asmLines = (asmEditorRef.current?.getModel()?.getValue() ?? assembly).split(/\r?\n/);
          const lineContent = asmLines[parsed - 1]?.replace(/#.*$/, "").replace(/\/\/.*$/, "").trim();
          if (!lineContent || lineContent.length === 0) {
            onSelectLineRef.current?.(null, null, false);
            return;
          }
          const asmIdx = resolveAsmRowIndex(parsed);
          onSelectLineRef.current?.(parsed, asmIdx, true);
        }
      }
    });

    editorInstance.onDidChangeCursorPosition((e) => {
      if (activeTargetRef.current !== "asm") return;
      if (
        e.reason === monacoInstance.editor.CursorChangeReason.Explicit &&
        e.source !== "modelChange" &&
        Date.now() - lastMouseSelectTimeRef.current > 80
      ) {
        const line = e.position.lineNumber;
        if (line) {
          const asmLines = (editorInstance.getModel()?.getValue() ?? assembly).split(/\r?\n/);
          const lineContent = asmLines[line - 1]?.replace(/#.*$/, "").replace(/\/\/.*$/, "").trim();
          const isEmptyLine = !lineContent || lineContent.length === 0;

          if (isEmptyLine) {
            onSelectLineRef.current?.(null, null, false);
          } else {
            const asmIdx = resolveAsmRowIndex(line);
            onSelectLineRef.current?.(line, asmIdx, false);
          }
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
    const asmLines = (asmEditorRef.current.getModel()?.getValue() ?? assembly).split(/\r?\n/);
    const isLineContentValid = (l: number | null | undefined): l is number => {
      if (!l || l <= 0 || l > asmLines.length) return false;
      const clean = asmLines[l - 1]?.replace(/#.*$/, "").replace(/\/\/.*$/, "").trim();
      return Boolean(clean && clean.length > 0);
    };

    const getOpcodeDecoration = (lineNum: number, inlineClass: string) => {
      if (!asmEditorRef.current || !asmMonacoRef.current) return null;
      const lineContent = asmEditorRef.current.getModel()?.getLineContent(lineNum) || "";
      const clean = lineContent.replace(/#.*$/, "").replace(/\/\/.*$/, "");
      const match = clean.match(/^(\s*(?:[a-zA-Z_]\w*:\s*)?)([a-zA-Z][\w.]*)/);
      if (match && !match[2].startsWith(".")) {
        const startCol = match[1].length + 1;
        const endCol = startCol + match[2].length;
        return {
          range: new asmMonacoRef.current.Range(lineNum, startCol, lineNum, endCol),
          options: {
            inlineClassName: inlineClass,
          },
        };
      }
      return null;
    };

    let executingLine: number | null = null;
    if (isSimulated) {
      if (currentActiveStep !== null && currentActiveStep !== undefined && currentActiveStep >= 0) {
        executingLine = currentActiveStep + 1;
      } else if (mode === "pipeline" && stageBuffers) {
        const stages = ["IF", "ID", "EX", "MEM", "WB"] as const;
        let activeStage: { assembly?: string; status?: string; flush_info?: { is_flushed?: boolean } } | null = null;
        for (const st of stages) {
          const candidate = (stageBuffers as any)[st];
          if (!candidate) continue;
          const status = (candidate.status || "").toLowerCase();
          if (status === "empty" || status === "bubble" || status === "flush" || status === "flushed") continue;
          if (candidate.flush_info?.is_flushed) continue;
          const asm = (candidate.assembly || "").trim().toLowerCase();
          if (!asm || asm === "bubble" || asm === "empty" || asm === "—") continue;
          activeStage = candidate;
          break;
        }
        if (activeStage?.assembly) {
          const norm = activeStage.assembly.trim().toLowerCase();
          const foundIdx = rows.findIndex((r) => r.text.trim().toLowerCase() === norm);
          if (foundIdx >= 0) {
            executingLine = foundIdx + 1;
          }
        }
      }

      if (isLineContentValid(executingLine)) {
        const isAlsoSelected = selectedLine === executingLine;
        newDecorations.push({
          range: new asmMonacoRef.current.Range(executingLine, 1, executingLine, 1),
          options: {
            isWholeLine: true,
            className: isAlsoSelected
              ? (mode === "pipeline" ? "monaco-executing-selected-asm-line-pipeline" : "monaco-executing-selected-asm-line-single")
              : "monaco-executing-asm-line",
            lineNumberClassName: isAlsoSelected
              ? (mode === "pipeline" ? "monaco-selected-asm-linenumber-pipeline" : "monaco-selected-asm-linenumber-single")
              : "monaco-executing-asm-linenumber",
          },
        });

        const opDec = getOpcodeDecoration(
          executingLine,
          isAlsoSelected
            ? (mode === "pipeline" ? "monaco-selected-asm-opcode-pipeline" : "monaco-selected-asm-opcode-single")
            : "monaco-executing-asm-opcode"
        );
        if (opDec) newDecorations.push(opDec);
      }
    }

    if (isLineContentValid(selectedLine) && selectedLine !== executingLine) {
      newDecorations.push({
        range: new asmMonacoRef.current.Range(selectedLine, 1, selectedLine, 1),
        options: {
          isWholeLine: true,
          className: mode === "pipeline"
            ? "monaco-selected-asm-line-pipeline"
            : "monaco-selected-asm-line-single",
          lineNumberClassName: mode === "pipeline"
            ? "monaco-selected-asm-linenumber-pipeline"
            : "monaco-selected-asm-linenumber-single",
        },
      });

      const opDec = getOpcodeDecoration(
        selectedLine,
        mode === "pipeline" ? "monaco-selected-asm-opcode-pipeline" : "monaco-selected-asm-opcode-single"
      );
      if (opDec) newDecorations.push(opDec);
    }

    asmDecorationsRef.current = asmEditorRef.current.deltaDecorations(
      asmDecorationsRef.current,
      newDecorations
    );
  }, [selectedLine, currentActiveStep, stageBuffers, mode, activeTarget, rows, isSimulated, assembly]);

  const [isSaving, setIsSaving] = useState(false);
  const isLoggedIn = !!getAccessToken();

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

  return (
    <section
      data-tutorial-id="asm-section"
      className="@container flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] shadow-sm select-none transition-colors duration-150"
      aria-label="RISC-V 어셈블리 결과"
    >
      {/* 1단: 메인 헤더 바 */}
      <header
        className={`h-8 shrink-0 flex items-center justify-between gap-2 border-b border-[var(--ar-border)] px-3.5 min-w-0 transition-colors ${activeTarget === "asm"
          ? "border-l-2 border-l-amber-500 bg-[var(--ar-header-bg)]"
          : "border-l-2 border-l-[#005FB8] bg-[var(--ar-header-bg)]"
          }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200 ${activeTarget === "asm"
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

        <div className="flex items-center shrink-0 ml-2">
          <span className="text-[10px] text-[#57606A] font-mono truncate">
            {activeTarget === "asm"
              ? "명령어 직접 작성"
              : "C 컴파일 명령어 매핑"}
          </span>
        </div>
      </header>

      {/* 2단: 헤더 밑 툴바 라인 */}
      <div data-tutorial-id="asm-toolbar" className="shrink-0 flex items-center justify-between gap-1.5 px-3 py-1 bg-[#FAFBFD] border-b border-[#E5E5E5] min-w-0">
        <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
          <button
            ref={uploadButtonRef}
            type="button"
            onClick={() => setIsUploadPopupOpen((prev) => !prev)}
            disabled={busy || activeTarget !== "asm"}
            className={`h-[22px] rounded border px-2 text-[10.5px] font-medium transition-colors flex items-center justify-center gap-1 shrink-0 focus:outline-none ${activeTarget !== "asm"
              ? "opacity-40 cursor-not-allowed border-[#D0D7DE] bg-white text-[#8C959F]"
              : isUploadPopupOpen
                ? mode === "pipeline"
                  ? "border-[#7C3AED] bg-[#7C3AED] text-white cursor-pointer font-semibold"
                  : "border-[#005FB8] bg-[#005FB8] text-white cursor-pointer font-semibold"
                : "border-[#D0D7DE] bg-white text-[#24292F] hover:bg-[#F3F4F6] cursor-pointer"
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

          <button
            type="button"
            onClick={handleSaveAsmClick}
            disabled={busy || activeTarget !== "asm" || !assembly?.trim()}
            className={`h-[22px] rounded border px-2 text-[10.5px] font-medium transition-colors flex items-center justify-center gap-1 shrink-0 ${activeTarget !== "asm"
              ? "opacity-40 cursor-not-allowed border-[#D0D7DE] bg-white text-[#8C959F]"
              : asmSaveSuccess
                ? "border-emerald-500 bg-emerald-50 text-emerald-600 font-semibold cursor-pointer"
                : "border-[#D0D7DE] bg-white text-[#24292F] hover:bg-[#F3F4F6] cursor-pointer"
              }`}
            title="현재 어셈블리 코드를 main.s 파일로 다운로드"
          >
            {asmSaveSuccess ? (
              <span className="text-emerald-600 font-bold text-[11px] shrink-0">✓</span>
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

          <button
            type="button"
            onClick={onResetAssembly}
            disabled={busy || activeTarget !== "asm"}
            className={`h-[22px] rounded border px-2 text-[10.5px] font-medium transition-colors flex items-center justify-center gap-1 shrink-0 ${activeTarget !== "asm"
              ? "opacity-40 cursor-not-allowed border-[#D0D7DE] bg-white text-[#8C959F]"
              : "border-[#D0D7DE] bg-white text-[#24292F] hover:bg-[#F3F4F6] cursor-pointer"
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
          <button
            type="button"
            className={`h-[22px] rounded transition-colors flex items-center justify-center gap-1 shrink-0 px-2.5 text-[10.5px] font-semibold ${activeTarget === "asm"
              ? "bg-[var(--ar-accent)] text-white hover:bg-[var(--ar-accent-hover)] disabled:opacity-50 cursor-pointer shadow-2xs"
              : "border border-[#D0D7DE] bg-white text-[#8C959F] opacity-40 cursor-not-allowed"
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
        mode={mode}
      />

      {/* 본문: ASM 직접 작성 모드일 때는 Monaco Editor, C 모드일 때는 매핑 뷰 */}
      {activeTarget === "asm" ? (
        <div className={`min-h-0 flex-1 relative bg-white asm-monaco-container ${mode === "single" ? "is-single-mode" : "is-pipeline-mode"}`}>
          <Editor
            beforeMount={handleAsmBeforeMount}
            onMount={handleAsmEditorMount}
            height="100%"
            language={RISCV_LANGUAGE_ID}
            theme={activeThemeName}
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
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center bg-[#F8F8F8]">
          {busy ? (
            <div className="w-7 h-7 border-2 border-[var(--ar-accent)] border-t-transparent rounded-full animate-spin mb-3" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white border border-[#E5E5E5] flex items-center justify-center text-[#57606A] mb-3 text-lg shadow-2xs">
              📜
            </div>
          )}
          <p className={`text-xs font-semibold ${busy ? "text-[var(--ar-accent)]" : "text-[#1F2328]"}`}>
            {busy
              ? "컴파일 및 어셈블리 매핑 중…"
              : error
                ? "컴파일 오류로 어셈블리를 생성할 수 없습니다."
                : "왼쪽 에디터에서 C 코드를 작성하고 [⚡ 컴파일]을 누르세요."}
          </p>
          <span className="text-[11px] text-[#57606A] mt-1 max-w-xs">
            컴파일 완료 후 C 코드의 줄을 클릭하면 매핑된 어셈블리 라인이 즉시 강조됩니다.
          </span>
        </div>
      ) : (
        <MappingRowList
          rows={rows}
          selectedLine={selectedLine}
          selectedAsmIndex={selectedAsmIndex}
          executionLine={executionLine}
          onSelectLine={onSelectLine}
          stageBuffers={stageBuffers}
          cycleEvents={cycleEvents}
          simulationData={simulationData}
          playbackCycle={playbackCycle}
          mode={mode}
          currentActiveStep={currentActiveStep}
        />
      )}

      {activeTarget === "asm" && error && (
        <pre
          role="alert"
          className="max-h-24 shrink-0 overflow-auto border-t border-rose-200 bg-rose-50 px-3 py-2 text-[11px] whitespace-pre-wrap text-rose-700 font-mono"
        >
          {error}
        </pre>
      )}
    </section>
  );
}
