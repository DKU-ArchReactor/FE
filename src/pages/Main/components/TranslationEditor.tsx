import { useRef, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

type Props = {
  source: string;
  onChange: (source: string) => void;
  onCompile: () => void;
  onFile: (file: File) => void;
  onReset: () => void;
  busy: boolean;
  error: string;
  selectedLine?: number | null;
  executionLine?: number | null;
  onSelectLine?: (line: number | null) => void;
};

export default function TranslationEditor({
  source,
  onChange,
  onCompile,
  onFile,
  onReset,
  busy,
  error,
  selectedLine,
  executionLine,
  onSelectLine,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const selectedLineRef = useRef<number | null | undefined>(selectedLine);

  useEffect(() => {
    selectedLineRef.current = selectedLine;
  }, [selectedLine]);

  const handleEditorMount: OnMount = (editorInstance, monacoInstance) => {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;

    // 마우스 클릭 시 동일 라인이면 토글 해제(null), 다른 라인이면 해당 라인 선택
    editorInstance.onMouseDown((e) => {
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
  }, [selectedLine, executionLine]);

  return (
    <section
      className="@container flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-label="Translation C 편집기"
    >
      <header className="shrink-0 flex items-center justify-between gap-1.5 border-b border-slate-200 bg-slate-50/80 px-2.5 py-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 shrink">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
          <strong className="text-xs text-slate-700 truncate whitespace-nowrap">C 소스 코드</strong>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
          <button
            type="button"
            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            onClick={() => input.current?.click()}
            disabled={busy}
            title="파일 열기"
          >
            <span>📁</span>
            <span className="hidden @[380px]:inline">파일 열기</span>
          </button>
          <input
            ref={input}
            hidden
            type="file"
            accept=".c,text/x-c,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            onClick={onReset}
            disabled={busy}
            title="초기화"
          >
            <span>🔄</span>
            <span className="hidden @[300px]:inline">초기화</span>
          </button>
          <button
            type="button"
            className="rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center gap-1 shrink-0"
            onClick={onCompile}
            disabled={busy || !source.trim()}
            title="컴파일"
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
              {busy ? (
                <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <span className="text-[12px] leading-none">⚡</span>
              )}
            </span>
            <span className="hidden @[230px]:inline">컴파일</span>
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 relative bg-white">
        <Editor
          height="100%"
          language="c"
          theme="vs"
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
            readOnly: busy,
            stickyScroll: { enabled: false },
          }}
        />
      </div>

      {error && (
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
