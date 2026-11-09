import React, { useRef, useEffect, useState, useCallback } from "react";
import type { FileSummary } from "@/type/file";
import { getFileById } from "@/api/file";

interface CFileUploadPopupProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onFile: (file: File) => void;
  savedFiles: FileSummary[];
  isLoggedIn: boolean;
  currentFileId?: string | null;
  onOpenSavedFile?: (fileId: string) => void;
}

export const CFileUploadPopup: React.FC<CFileUploadPopupProps> = ({
  isOpen,
  onClose,
  anchorRef,
  onFile,
  savedFiles,
  isLoggedIn,
  currentFileId,
  onOpenSavedFile,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  // 팝업 위치 계산 (업로드 버튼 바로 아래, 우하단으로 펼쳐지도록 버튼의 왼쪽 정렬)
  const updatePopupPos = useCallback(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const popupWidth = 360;
      const left = Math.max(
        12,
        Math.min(window.innerWidth - popupWidth - 12, rect.left)
      );
      const top = rect.bottom + 6;
      setPopupPos({ top, left });
    }
  }, [anchorRef]);

  // 팝업 열릴 때 위치 계산 및 리사이즈/스크롤 이벤트 동기화
  useEffect(() => {
    if (isOpen) {
      updatePopupPos();
      window.addEventListener("resize", updatePopupPos);
      window.addEventListener("scroll", updatePopupPos, true);
      return () => {
        window.removeEventListener("resize", updatePopupPos);
        window.removeEventListener("scroll", updatePopupPos, true);
      };
    }
  }, [isOpen, updatePopupPos]);

  // 외부 클릭 시 업로드 팝업 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popupRef.current &&
        !popupRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

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
      onFile(files[0]);
      onClose();
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFile(file);
      onClose();
    }
    event.target.value = "";
  };

  // 저장된 파일 목록에서 개별 파일 로컬 다운로드 핸들러
  const handleDownloadSavedFile = async (
    e: React.MouseEvent,
    file: FileSummary
  ) => {
    e.stopPropagation();
    try {
      const detail = await getFileById(file.file_id);
      const blob = new Blob([detail.content], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        detail.title ||
        `${file.title || "source"}.${file.lang === "asm" ? "s" : "c"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("File download error:", err);
      alert("파일을 다운로드하지 못했습니다.");
    }
  };

  return (
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
          onClick={onClose}
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
              클릭하여 파일 선택{" "}
              <span className="font-normal text-[#57606A] dark:text-[#858585]">
                또는 드래그 앤 드롭
              </span>
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

      {/* 2. 하단 섹션: 저장된 파일 목록 */}
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
              <span className="font-medium text-[#1F2328] dark:text-[#CCCCCC]">
                로그인이 필요합니다
              </span>
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
                    onClose();
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
  );
};

export default CFileUploadPopup;

