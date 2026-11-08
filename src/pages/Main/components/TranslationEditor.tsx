import { useRef, useEffect, useState, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useTheme } from "@/context/ThemeContext";
import type { FileSummary } from "@/type/file";
import { getFileById } from "@/api/file";

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
  const popupRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // 팝업 위치 계산 (업로드 버튼 바로 아래, 우하단으로 펼쳐지도록 버튼의 왼쪽 정렬)
  const updatePopupPos = useCallback(() => {
    if (uploadButtonRef.current) {
      const rect = uploadButtonRef.current.getBoundingClientRect();
      const popupWidth = 360;
      const left = Math.max(12, Math.min(window.innerWidth - popupWidth - 12, rect.left));
      const top = rect.bottom + 6;
      setPopupPos({ top, left });
    }
  }, []);

  // 팝업 열릴 때 위치 계산 및 리사이즈/스크롤 이벤트 동기화
  useEffect(() => {
    if (isUploadPopupOpen) {
      updatePopupPos();
      window.addEventListener("resize", updatePopupPos);
      window.addEventListener("scroll", updatePopupPos, true);
      return () => {
        window.removeEventListener("resize", updatePopupPos);
        window.removeEventListener("scroll", updatePopupPos, true);
      };
    }
  }, [isUploadPopupOpen, updatePopupPos]);

  // 외부 클릭 시 업로드 팝업 닫기
  useEffect(() => {
    if (!isUploadPopupOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popupRef.current &&
        !popupRef.current.contains(target) &&
        uploadButtonRef.current &&
        !uploadButtonRef.current.contains(target)
      ) {
        setIsUploadPopupOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isUploadPopupOpen]);

  // 파일 드래그 앤 드롭 및 인풋 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      onFile(file);
      setIsUploadPopupOpen(false);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFile(file);
      setIsUploadPopupOpen(false);
    }
    event.target.value = "";
  };

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
        const inputName = window.prompt("저장할 파일 이름을 입력해 주세요:", targetName || "main.c");
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

  // 저장된 파일 목록에서 개별 파일 로컬 다운로드 핸들러
  const handleDownloadSavedFile = async (e: React.MouseEvent, file: FileSummary) => {
    e.stopPropagation();
    try {
      const detail = await getFileById(file.file_id);
      const blob = new Blob([detail.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = detail.title || `${file.title || "source"}.${file.lang === "asm" ? "s" : "c"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("File download error:", err);
      alert("파일을 다운로드하지 못했습니다.");
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
  }, [selectedLine, executionLine]);

  return (
    <section
      className={`@container flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg border shadow-sm select-none transition-all duration-200 ${
        activeTarget !== "c"
          ? "border-[var(--ar-border)] bg-[#EBECEF] dark:bg-[#141415]"
          : "border-[var(--ar-border)] bg-[var(--ar-panel-bg)]"
      }`}
      aria-label="Translation C 편집기"
    >
      {/* 1단: 메인 헤더 바 (C 소스 코드 + 파일명) */}
      <header
        className={`shrink-0 flex items-center justify-between gap-2 border-b border-[var(--ar-border)] px-3.5 py-1.5 min-w-0 transition-colors border-l-2 border-l-blue-600 dark:border-l-blue-500 ${
          activeTarget !== "c"
            ? "bg-[#E2E4E8] dark:bg-[#1A1A1C]"
            : "bg-[var(--ar-header-bg)]"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200 ${
              activeTarget === "c"
                ? "bg-[#005FB8] dark:bg-[#007ACC] scale-100"
                : "bg-transparent scale-0"
            }`}
          />
          <h3
            className={`text-xs font-semibold truncate whitespace-nowrap transition-colors ${
              activeTarget !== "c"
                ? "text-[var(--ar-text-muted)]"
                : "text-[var(--ar-text-primary)]"
            }`}
          >
            C 소스 코드
          </h3>
          <span
            className="text-[10px] font-mono truncate text-[var(--ar-text-muted)]"
          >
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
          {/* 1. 업로드 버튼 */}
          <button
            ref={uploadButtonRef}
            type="button"
            onClick={() => setIsUploadPopupOpen((prev) => !prev)}
            disabled={busy || activeTarget !== "c"}
            className={`rounded border px-2 py-0.5 text-[11px] font-medium transition-colors flex items-center gap-1 shrink-0 shadow-2xs ${
              activeTarget !== "c"
                ? "opacity-40 cursor-not-allowed border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#8C959F] dark:text-[#6E7681]"
                : isUploadPopupOpen
                ? "border-[#005FB8] dark:border-[#007ACC] bg-[#005FB8] text-white dark:bg-[#007ACC] cursor-pointer"
                : "border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#24292F] dark:text-[#CCCCCC] hover:bg-[#F3F4F6] dark:hover:bg-[#37373D] cursor-pointer"
            }`}
            title="파일 업로드 및 불러오기"
          >
            <span>📁</span>
            <span className="hidden @[420px]:inline">업로드</span>
            <span
              className={`text-[9px] opacity-75 transition-transform duration-150 ${
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
            className={`rounded border px-2 py-0.5 text-[11px] font-medium transition-colors flex items-center gap-1 shrink-0 shadow-2xs ${
              activeTarget !== "c"
                ? "opacity-40 cursor-not-allowed border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#8C959F] dark:text-[#6E7681]"
                : saveSuccess
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer"
                : "border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#24292F] dark:text-[#CCCCCC] hover:bg-[#F3F4F6] dark:hover:bg-[#37373D] cursor-pointer"
            }`}
            title="현재 소스 코드를 서버에 저장"
          >
            {isSaving ? (
              <span className="w-3 h-3 rounded-full border-2 border-[#005FB8] dark:border-[#007ACC] border-t-transparent animate-spin" />
            ) : saveSuccess ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
            ) : (
              <span>💾</span>
            )}
            <span className="hidden @[360px]:inline">
              {saveSuccess ? "저장됨" : "저장"}
            </span>
          </button>

          {/* 3. 초기화 버튼 */}
          <button
            type="button"
            disabled={busy || activeTarget !== "c"}
            className={`rounded border px-2 py-0.5 text-[11px] font-medium transition-colors flex items-center gap-1 shrink-0 shadow-2xs ${
              activeTarget !== "c"
                ? "opacity-40 cursor-not-allowed border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#8C959F] dark:text-[#6E7681]"
                : "border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#2D2D2D] text-[#24292F] dark:text-[#CCCCCC] hover:bg-[#F3F4F6] dark:hover:bg-[#37373D] cursor-pointer"
            }`}
            onClick={onReset}
            title="초기화"
          >
            <span>🔄</span>
            <span className="hidden @[290px]:inline">초기화</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
          {/* 4. 컴파일 버튼 */}
          <button
            type="button"
            className="rounded border border-[#005FB8] dark:border-[#007ACC] bg-[#005FB8] dark:bg-[#007ACC] px-2.5 py-0.5 text-[11px] font-medium text-white hover:bg-[#004C99] dark:hover:bg-[#0062A3] disabled:opacity-50 transition-colors shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
            onClick={onCompile}
            disabled={busy || !source.trim()}
            title="C 코드 컴파일 및 어셈블리 변환"
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
      </div>

      {/* ======================================================== */}
      {/* 업로드 버튼 바로 아래에서 우하단으로 내려오는 팝업창        */}
      {/* ======================================================== */}
      {isUploadPopupOpen && (
        <div
          ref={popupRef}
          style={{
            top: `${popupPos.top}px`,
            left: `${popupPos.left}px`,
            width: "360px",
          }}
          className="fixed z-50 rounded-xl overflow-hidden shadow-2xl border border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#1E1E1E] text-[#1F2328] dark:text-[#CCCCCC] upload-popup-drop-anim flex flex-col max-h-[470px] select-none"
        >
          {/* 팝업 헤더 */}
          <div className="px-3.5 py-2 border-b border-[#E5E5E5] dark:border-[#3E3E42] bg-[#F6F8FA] dark:bg-[#252526] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">📂</span>
              <span className="text-xs font-bold text-[#1F2328] dark:text-[#CCCCCC]">
                파일 업로드 및 불러오기
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsUploadPopupOpen(false)}
              className="p-1 rounded text-[#57606A] dark:text-[#858585] hover:text-[#CF222E] dark:hover:text-[#F85149] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-xs font-bold"
              title="창 닫기"
            >
              ✕
            </button>
          </div>

          {/* 1. 상단 섹션: 로컬 파일 업로드 드롭존 */}
          <div className="p-3 border-b border-[#E5E5E5] dark:border-[#3E3E42] bg-[#FAFBFD] dark:bg-[#1E1E1E] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#1F2328] dark:text-[#CCCCCC] flex items-center gap-1">
                <span>📤</span> C 소스 파일 업로드
              </span>
              <span className="text-[10px] text-[#57606A] dark:text-[#858585] font-mono">
                .c 파일 지원 (최대 64KB)
              </span>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-lg border-2 border-dashed p-3.5 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-150 ${
                isDragOver
                  ? "border-[#005FB8] dark:border-[#007ACC] bg-blue-50/70 dark:bg-[#007ACC]/10 text-[#005FB8] dark:text-[#79C0FF] scale-[1.01]"
                  : "border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#252526] text-[#57606A] dark:text-[#858585] hover:border-[#005FB8] dark:hover:border-[#007ACC] hover:text-[#005FB8] dark:hover:text-[#79C0FF] hover:bg-slate-50 dark:hover:bg-[#2D2D2D]"
              }`}
            >
              <svg
                className="w-6 h-6 stroke-current transition-transform group-hover:-translate-y-0.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <div className="text-center">
                <p className="text-xs font-semibold text-[#1F2328] dark:text-[#CCCCCC]">
                  클릭하여 파일 선택 <span className="font-normal text-[#57606A] dark:text-[#858585]">또는 드래그 앤 드롭</span>
                </p>
                <p className="text-[10px] text-[#8C959F] dark:text-[#6E7681] mt-0.5">
                  선택 시 즉시 에디터에 코드가 불러와집니다.
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".c,text/x-c,text/plain"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>

          {/* 2. 하단 섹션: 저장된 파일 목록 (예전 그대로) */}
          <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#252526]">
            <div className="px-3.5 py-1.5 border-b border-[#E5E5E5] dark:border-[#3E3E42] bg-[#F3F3F3] dark:bg-[#1E1E1E] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">📂</span>
                <span className="text-xs font-semibold text-[#1F2328] dark:text-[#CCCCCC]">
                  저장된 파일 목록
                </span>
                <span className="text-[10px] font-mono text-[#57606A] dark:text-[#858585]">
                  ({isLoggedIn ? savedFiles.length : 0})
                </span>
              </div>
              {isLoggedIn && savedFiles.length > 0 && (
                <span className="text-[10px] text-[#8C959F] dark:text-[#6E7681]">
                  클릭하여 열기
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 min-h-[120px] max-h-56 divide-y divide-[#F0F0F0] dark:divide-[#333333]/50 [scrollbar-width:thin]">
              {!isLoggedIn ? (
                <div className="py-6 px-4 text-center text-xs text-[#57606A] dark:text-[#858585] flex flex-col gap-1 items-center justify-center">
                  <span className="font-medium text-[#1F2328] dark:text-[#CCCCCC]">로그인이 필요합니다</span>
                  <span className="text-[10px] text-[#8C959F] dark:text-[#6E7681]">
                    로그인 후 저장한 C/ASM 파일을 불러올 수 있습니다.
                  </span>
                </div>
              ) : savedFiles.length === 0 ? (
                <div className="py-6 px-4 text-center text-xs text-[#57606A] dark:text-[#858585] flex flex-col items-center justify-center">
                  저장된 파일이 없습니다
                </div>
              ) : (
                savedFiles.map((f) => {
                  const isSelected = currentFileId === f.file_id;
                  const dateStr = f.updated_at
                    ? new Date(f.updated_at).toLocaleDateString("ko-KR", {
                        month: "2-digit",
                        day: "2-digit",
                      })
                    : "";

                  return (
                    <div
                      key={f.file_id}
                      onClick={() => {
                        onOpenSavedFile?.(f.file_id);
                        setIsUploadPopupOpen(false);
                      }}
                      title="클릭하여 C 소스 코드에 열기"
                      className={`w-full px-2.5 py-1.5 rounded text-left transition-colors flex items-center justify-between gap-2 cursor-pointer group/row ${
                        isSelected
                          ? "bg-blue-50 dark:bg-[#04395E] text-[#005FB8] dark:text-[#9CDCFE] font-semibold"
                          : "hover:bg-[#F3F4F6] dark:hover:bg-[#2A2D2E] text-[#24292F] dark:text-[#CCCCCC]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span
                          className={`text-[9px] font-bold px-1 py-0.2 rounded uppercase shrink-0 ${
                            f.lang === "asm"
                              ? "bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300"
                              : "bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300"
                          }`}
                        >
                          {f.lang || "c"}
                        </span>
                        <span className="text-xs truncate">{f.title}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {dateStr && (
                          <span className="text-[9.5px] text-[#8C959F] dark:text-[#6E7681] font-mono">
                            {dateStr}
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[9.5px] font-bold text-[#005FB8] dark:text-[#79C0FF]">
                            열림
                          </span>
                        )}
                        {/* 개별 파일 로컬 다운로드 버튼 */}
                        <button
                          type="button"
                          onClick={(e) => handleDownloadSavedFile(e, f)}
                          title={`'${f.title}' 파일 로컬 다운로드`}
                          className="p-1 rounded text-[#8C959F] dark:text-[#6E7681] hover:text-[#005FB8] dark:hover:text-[#79C0FF] hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer ml-0.5"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

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
