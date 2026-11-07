import React, { useState } from "react";
import type { FileSummary } from "@/type/file";

interface FileListPanelProps {
  savedFiles: FileSummary[];
  isLoggedIn: boolean;
  selectedFileId: string | null;
  onOpenFileInEditor: (fileId: string) => void;
  ensureFileContent: (fileId: string) => Promise<{ title: string; content: string } | null>;
  fileContentCache: Record<string, string>;
  loadingPreviewId: string | null;
}

export const FileListPanel: React.FC<FileListPanelProps> = ({
  savedFiles,
  isLoggedIn,
  selectedFileId,
  onOpenFileInEditor,
  ensureFileContent,
  fileContentCache,
  loadingPreviewId,
}) => {
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);

  const hoveredFile = savedFiles.find((f) => f.file_id === hoveredFileId) || null;
  const hoveredCode = hoveredFileId ? fileContentCache[hoveredFileId] : undefined;

  return (
    <div
      className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-xs border border-[var(--ar-border)] flex flex-col min-h-0 overflow-hidden relative transition-colors duration-150"
      onMouseLeave={() => setHoveredFileId(null)}
    >
      <div className="px-3.5 py-1.5 border-b border-[var(--ar-border)] bg-[var(--ar-header-bg)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">📁</span>
          <h3 className="text-xs font-semibold text-[var(--ar-text-primary)]">File List</h3>
          <span className="text-[10px] text-[var(--ar-text-muted)] font-normal hidden sm:inline">
            (호버: 미리보기 · 더블클릭: 열기)
          </span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[var(--ar-accent)] font-mono">
          {isLoggedIn ? `${savedFiles.length}개` : "비로그인"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0 relative">
        {!isLoggedIn ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[var(--ar-text-muted)] px-3 gap-1">
            <span className="text-xs font-semibold text-[var(--ar-text-primary)]">
              로그인이 필요합니다
            </span>
            <span className="text-[11px]">
              로그인하면 저장한 C/ASM 파일 목록을 여기서 바로 불러올 수 있습니다.
            </span>
          </div>
        ) : savedFiles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[var(--ar-text-muted)] px-3 gap-1">
            <span className="text-xs font-semibold text-[var(--ar-text-primary)]">
              저장된 파일이 없습니다
            </span>
            <span className="text-[11px]">
              마이페이지 또는 코드 메뉴에서 파일을 저장해 보세요.
            </span>
          </div>
        ) : (
          savedFiles.map((f) => {
            const isSelected = selectedFileId === f.file_id;
            const isHovered = hoveredFileId === f.file_id;
            const dateStr = f.updated_at
              ? new Date(f.updated_at).toLocaleDateString("ko-KR", {
                  month: "2-digit",
                  day: "2-digit",
                })
              : "";

            return (
              <button
                key={f.file_id}
                type="button"
                onMouseEnter={() => {
                  setHoveredFileId(f.file_id);
                  void ensureFileContent(f.file_id);
                }}
                onDoubleClick={() => void onOpenFileInEditor(f.file_id)}
                title="마우스를 올리면 코드 미리보기, 더블클릭하면 C 소스 코드에 열기"
                className={`w-full px-2.5 py-1.5 rounded-md border text-left transition-all flex items-center justify-between gap-2 cursor-pointer select-none ${
                  isSelected
                    ? "bg-blue-50 dark:bg-[#04395E] border-blue-400 dark:border-[#007ACC] text-blue-900 dark:text-[#9CDCFE] shadow-2xs"
                    : isHovered
                    ? "bg-[var(--ar-header-bg)] border-[var(--ar-border)] text-[var(--ar-text-primary)]"
                    : "bg-[var(--ar-panel-bg)] hover:bg-[var(--ar-header-bg)] border-[var(--ar-border-subtle)] text-[var(--ar-text-primary)]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                      f.lang === "asm"
                        ? "bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300"
                        : "bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300"
                    }`}
                  >
                    {f.lang || "c"}
                  </span>
                  <span className="text-xs font-medium truncate">
                    {f.title}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {dateStr && (
                    <span className="text-[10px] text-[var(--ar-text-muted)] font-mono">
                      {dateStr}
                    </span>
                  )}
                  {isSelected && (
                    <span className="text-[10px] font-bold text-[var(--ar-accent)]">
                      열림
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* 호버 시 우측에 뜨는 코드 미리보기 오버레이 */}
      {hoveredFile && (
        <div className="absolute top-10 bottom-2 right-2 w-[72%] z-30 bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-xs text-[var(--ar-text-primary)] rounded-lg p-3 shadow-xl border border-[var(--ar-border)] flex flex-col overflow-hidden pointer-events-none animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-[var(--ar-border)] shrink-0">
            <span className="text-[11px] font-bold text-[var(--ar-accent)] truncate">
              📄 {hoveredFile.title}
            </span>
            <span className="text-[10px] text-[var(--ar-text-muted)] shrink-0">
              더블클릭하여 열기
            </span>
          </div>
          <div className="flex-1 overflow-hidden font-mono text-[11px] leading-relaxed text-[var(--ar-text-primary)] whitespace-pre-wrap">
            {loadingPreviewId === hoveredFile.file_id && hoveredCode === undefined ? (
              <span className="text-[var(--ar-text-muted)] font-sans text-xs">
                코드를 불러오는 중...
              </span>
            ) : hoveredCode ? (
              hoveredCode
            ) : (
              <span className="text-[var(--ar-text-muted)] font-sans text-xs">
                코드 내용이 비어 있습니다.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileListPanel;

