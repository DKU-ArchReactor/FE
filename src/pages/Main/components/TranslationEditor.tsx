import { useRef, useEffect, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useTheme } from "@/context/ThemeContext";
import type { FileSummary } from "@/type/file";
import CFileUploadPopup from "./CFileUploadPopup";

type Props = {
  source: string;
  fileName?: string;
  onChange: (source: string) => void;
  onCompile: () => void;
  onFile: (file: File) => void;
  onReset: () => void;
  busy: boolean;
  error: string;
  selectedLine?: number | null;
  executionLine?: number | null;
  onSelectLine?: (line: number | null) => void;
  savedFiles?: FileSummary[];
  isLoggedIn?: boolean;
  currentFileId?: string | null;
  onOpenSavedFile?: (fileId: string) => void;
  onSave?: (fileName?: string) => Promise<boolean> | boolean | void;
  activeTarget?: "c" | "asm";
};

export default function TranslationEditor({
  source,
  fileName = "main.c",
  onChange,
  onCompile,
  onFile,
  onReset,
  busy,
  error,
  selectedLine,
  executionLine,
  onSelectLine,
  savedFiles = [],
  isLoggedIn = false,
  currentFileId,
  onOpenSavedFile,
  onSave,
  activeTarget = "c",
}: Props) {
  const { theme } = useTheme();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const selectedLineRef = useRef<number | null | undefined>(selectedLine);
  const activeTargetRef = useRef<"c" | "asm">(activeTarget);

  useEffect(() => {
    activeTargetRef.current = activeTarget;
  }, [activeTarget]);

  // 저장 상태 관리
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 업로드 팝업 상태 및 참조
  const [isUploadPopupOpen, setIsUploadPopupOpen] = useState(false);
  const uploadButtonRef = useRef<HTMLButtonElement>(null);

  // 서버에 현재 소스 코드 저장 핸들러
  const handleSaveClick = async () => {
    if (busy || isSaving) return;
    if (!isLoggedIn) {
      alert("파일 저장은 로그인 후 이용할 수 있습니다.");
      return;
    }

    setIsSaving(true);
    try {
      let targetName = fileName;
      if (!targetName || targetName === "main.c") {
        const inputName = window.prompt(
          "저장할 파일 이름을 입력해 주세요:",
          targetName || "main.c"
        );
        if (!inputName || !inputName.trim()) {
          setIsSaving(false);
          return;
        }
        targetName = inputName.trim();
        if (!targetName.toLowerCase().endsWith(".c")) {
          targetName += ".c";
        }
      }

      const res = await onSave?.(targetName);
      if (res !== false) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    selectedLineRef.current = selectedLine;
  }, [selectedLine]);

  const handleEditorMount: OnMount = (editorInstance, monacoInstance) => {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;

    // 마우스 클릭 시 동일 라인이면 토글 해제(null), 다른 라인이면 해당 라인 선택
    editorInstance.onMouseDown((e) => {
      // 어셈블리 작성 모드일 때는 C 라인 클릭 및 선택 비활성화
      if (activeTargetRef.current !== "c") return;

      const clickedLine = e.target.position?.lineNumber;
      if (clickedLine) {
        if (selectedLineRef.current === clickedLine) {
          onSelectLine?.(null);
        } else {
          onSelectLine?.(clickedLine);
        }
      }
    });
  };

  // 선택된 라인 및 실행 중인 라인이 변경되었을 때 Monaco Editor 라인 하이라이트(Decoration) 갱신
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    // 어셈블리 작성 모드일 때는 C 라인 하이라이트 모두 해제
    if (activeTarget !== "c") {
      decorationsRef.current = editorRef.current.deltaDecorations(
        decorationsRef.current,
        []
      );
      return;
    }

    const newDecorations: editor.IModelDeltaDecoration[] = [];

    // 1. 실행 중인 라인 (초록색 에메랄드 테마)
    if (executionLine && executionLine > 0) {
      const isAlsoSelected = selectedLine === executionLine;
      newDecorations.push({
        range: new monacoRef.current.Range(executionLine, 1, executionLine, 1),
        options: {
          isWholeLine: true,
          className: isAlsoSelected
            ? "monaco-executing-selected-c-line"
            : "monaco-executing-c-line",
          lineNumberClassName: isAlsoSelected
            ? "monaco-executing-selected-c-linenumber"
            : "monaco-executing-c-linenumber",
        },
      });
    }

    // 2. 사용자가 수동 선택한 라인 (실행 라인과 다를 때 파란색 테마)
    if (selectedLine && selectedLine > 0 && selectedLine !== executionLine) {
      newDecorations.push({
        range: new monacoRef.current.Range(selectedLine, 1, selectedLine, 1),
        options: {
          isWholeLine: true,
          className: "monaco-selected-c-line",
          lineNumberClassName: "monaco-selected-c-linenumber",
        },
      });
    }

    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current,
      newDecorations
    );
  }, [selectedLine, executionLine, activeTarget]);

  return (
    <section
      className={`@container flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg border shadow-sm select-none transition-all duration-200 ${
        activeTarget !== "c"
          ? "border-[var(--ar-border)] bg-[#F8FAFC] dark:bg-[#141415]"
          : "border-[var(--ar-border)] bg-[var(--ar-panel-bg)]"
      }`}
      aria-label="Translation C 편집기"
    >
      {/* 1단: 메인 헤더 바 (C 소스 코드 + 파일명) */}
      <header
        className={`h-8 shrink-0 flex items-center justify-between gap-2 border-b border-[var(--ar-border)] px-3.5 min-w-0 transition-colors border-l-2 border-l-blue-600 dark:border-l-blue-500 ${
          activeTarget !== "c"
            ? "bg-[#F1F5F9] dark:bg-[#1A1A1C]"
            : "bg-[var(--ar-header-bg)]"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200 ${
              activeTarget === "c"
                ? "bg-[#005FB8] dark:bg-[#007ACC] scale-100"
                : "bg-transparent scale-0"
            }`}
          />
          <h3
            className={`font-sans text-[11px] font-semibold uppercase tracking-wide truncate whitespace-nowrap transition-colors ${
              activeTarget !== "c"
                ? "text-[var(--ar-text-muted)]"
                : "text-[var(--ar-text-primary)]"
            }`}
          >
            C SOURCE CODE
          </h3>
          <span className="text-[10px] font-mono truncate text-[var(--ar-text-muted)]">
            ({fileName})
          </span>
        </div>
      </header>

      {/* 2단: 헤더 밑 툴바 라인 (버튼 전용 행) */}
      <div
        className={`shrink-0 flex items-center justify-between gap-1.5 px-3 py-1 border-b min-w-0 transition-colors ${
          activeTarget !== "c"
            ? "border-[#D0D7DE] dark:border-[#2C2C2E] bg-[#E6E8EB] dark:bg-[#161618] opacity-50 pointer-events-none"
            : "border-[#E5E5E5] dark:border-[#3E3E42] bg-[#FAFBFD] dark:bg-[#1E1E1E]"
        }`}
      >
        <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
          {/* 1. 불러오기 버튼 */}
          <button
            ref={uploadButtonRef}
            type="button"
            onClick={() => setIsUploadPopupOpen((prev) => !prev)}
            disabled={busy || activeTarget !== "c"}
            className={`h-[22px] rounded border px-2 text-[10.5px] font-medium transition-colors flex items-center justify-center gap-1 shrink-0 ${
              activeTarget !== "c"
                ? "opacity-40 cursor-not-allowed border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#8C959F] dark:text-[#6E7681]"
                : isUploadPopupOpen
                ? "border-[#005FB8] dark:border-[#007ACC] bg-[#005FB8] text-white dark:bg-[#007ACC] cursor-pointer font-semibold"
                : "border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#24292F] dark:text-[#CCCCCC] hover:bg-[#F3F4F6] dark:hover:bg-[#37373D] cursor-pointer"
            }`}
            title="파일 불러오기 및 예제 열기"
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
            onClick={handleSaveClick}
            disabled={busy || isSaving || activeTarget !== "c"}
            className={`h-[22px] rounded border px-2 text-[10.5px] font-medium transition-colors flex items-center justify-center gap-1 shrink-0 ${
              activeTarget !== "c"
                ? "opacity-40 cursor-not-allowed border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#8C959F] dark:text-[#6E7681]"
                : saveSuccess
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer"
                : "border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#24292F] dark:text-[#CCCCCC] hover:bg-[#F3F4F6] dark:hover:bg-[#37373D] cursor-pointer"
            }`}
            title="현재 소스 코드를 서버에 저장"
          >
            {isSaving ? (
              <span className="w-3 h-3 rounded-full border-2 border-[#005FB8] dark:border-[#007ACC] border-t-transparent animate-spin shrink-0" />
            ) : saveSuccess ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] shrink-0">
                ✓
              </span>
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
              {saveSuccess ? "저장됨" : "저장"}
            </span>
          </button>

          {/* 3. 초기화 버튼 */}
          <button
            type="button"
            disabled={busy || activeTarget !== "c"}
            className={`h-[22px] rounded border px-2 text-[10.5px] font-medium transition-colors flex items-center justify-center gap-1 shrink-0 ${
              activeTarget !== "c"
                ? "opacity-40 cursor-not-allowed border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#8C959F] dark:text-[#6E7681]"
                : "border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#24292F] dark:text-[#CCCCCC] hover:bg-[#F3F4F6] dark:hover:bg-[#37373D] cursor-pointer"
            }`}
            onClick={onReset}
            title="초기화"
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
          {/* 4. 컴파일 버튼 */}
          <button
            type="button"
            className="h-[22px] rounded bg-[var(--ar-accent)] text-white hover:bg-[var(--ar-accent-hover)] disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-1 shrink-0 px-2.5 text-[10.5px] font-semibold"
            onClick={onCompile}
            disabled={busy || !source.trim()}
            title="C 코드 컴파일 및 어셈블리 변환"
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
            <span className="hidden @[200px]:inline">컴파일</span>
          </button>
        </div>
      </div>

      {/* 파일 업로드 및 저장 목록 팝업 */}
      <CFileUploadPopup
        isOpen={isUploadPopupOpen}
        onClose={() => setIsUploadPopupOpen(false)}
        anchorRef={uploadButtonRef}
        onFile={onFile}
        savedFiles={savedFiles}
        isLoggedIn={isLoggedIn}
        currentFileId={currentFileId}
        onOpenSavedFile={onOpenSavedFile}
      />

      <div
        className={`min-h-0 flex-1 relative transition-all duration-200 ${
          activeTarget !== "c"
            ? "bg-[#EBECEF] dark:bg-[#141415] opacity-65 grayscale-[35%]"
            : "bg-white dark:bg-[#1E1E1E]"
        }`}
      >
        {activeTarget !== "c" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none select-none">
            <div className="px-3.5 py-1.5 rounded-full bg-[#24292F]/85 dark:bg-[#252528]/95 text-white dark:text-[#E0E0E0] text-[11px] font-medium backdrop-blur-xs shadow-lg border border-black/10 dark:border-white/10 flex items-center gap-1.5 animate-fadeIn">
              <span>🔒</span>
              <span>어셈블리 작성 모드 (C 코드 읽기 전용)</span>
            </div>
          </div>
        )}
        <Editor
          height="100%"
          language="c"
          theme={theme === "dark" ? "vs-dark" : "vs"}
          value={source}
          onChange={(value) => onChange(value ?? "")}
          onMount={handleEditorMount}
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
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 16,
            padding: { top: 8, bottom: 8 },
            readOnly: busy || activeTarget !== "c",
            stickyScroll: { enabled: false },
          }}
        />
      </div>

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
