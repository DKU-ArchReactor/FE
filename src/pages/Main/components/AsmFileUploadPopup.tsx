import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { FileSummary } from "@/type/file";
import { getFileById } from "@/api/file";

const ASM_TEMPLATES = [
  {
    title: "기본 산술 연산 (Basic ALU)",
    desc: "addi, add, sub 명령어를 사용한 기초 레지스터 연산",
    code: `# RISC-V 32IM 기본 산술 연산 예제
.globl main
main:
    addi x1, x0, 10      # x1 = 10
    addi x2, x0, 20      # x2 = 20
    add  x3, x1, x2      # x3 = x1 + x2 (30)
    sub  x4, x3, x1      # x4 = x3 - x1 (20)
    ret
`,
  },
  {
    title: "반복문 카운터 (Loop Counter)",
    desc: "조건 분기(bne)를 이용한 1부터 5까지의 합 계산 루프",
    code: `# RISC-V 32IM 루프 카운터 예제
.globl main
main:
    addi x1, x0, 0       # x1 (sum) = 0
    addi x2, x0, 1       # x2 (i) = 1
    addi x3, x0, 6       # x3 (limit) = 6
loop:
    add  x1, x1, x2      # sum += i
    addi x2, x2, 1       # i++
    bne  x2, x3, loop    # if i != 6 goto loop
    ret
`,
  },
  {
    title: "메모리 로드 및 스토어 (Load & Store)",
    desc: "스택 포인터(sp)를 활용한 lw, sw 메모리 데이터 전송",
    code: `# RISC-V 32IM 메모리 접근 예제
.globl main
main:
    addi sp, sp, -16     # 스택 프레임 16바이트 할당
    addi x5, x0, 42      # x5 = 42
    sw   x5, 8(sp)       # sp + 8 주소에 x5 저장
    lw   x6, 8(sp)       # sp + 8 주소에서 x6로 로드
    addi sp, sp, 16      # 스택 복원
    ret
`,
  },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onSelectAssembly?: (code: string) => void;
  savedFiles?: FileSummary[];
  currentFileId?: string | null;
  onOpenSavedFile?: (fileId: string) => void;
};

export default function AsmFileUploadPopup({
  isOpen,
  onClose,
  anchorRef,
  onSelectAssembly,
  savedFiles = [],
  currentFileId,
  onOpenSavedFile,
}: Props) {
  const popupRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const isLoggedIn = !!localStorage.getItem("access_token");

  // 저장된 파일 중 어셈블리(.s, .asm, lang=asm) 필터링
  const savedAsmFiles = useMemo(() => {
    return savedFiles.filter(
      (f) =>
        f.lang === "asm" ||
        f.title.toLowerCase().endsWith(".s") ||
        f.title.toLowerCase().endsWith(".asm")
    );
  }, [savedFiles]);

  const updatePopupPos = useCallback(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const popupWidth = 340;
      const left = Math.max(12, Math.min(window.innerWidth - popupWidth - 12, rect.left));
      const top = rect.bottom + 6;
      setPopupPos({ top, left });
    }
  }, [anchorRef]);

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
  }, [isOpen, anchorRef, onClose]);

  const readAsmFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        onSelectAssembly?.(content);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readAsmFile(file);
      onClose();
    }
    e.target.value = "";
  };

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
      readAsmFile(file);
      onClose();
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
      a.download = detail.title || `${file.title || "source"}.s`;
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
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".s,.asm,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      {isOpen && (
        <div
          ref={popupRef}
          style={{
            top: `${popupPos.top}px`,
            left: `${popupPos.left}px`,
            width: "340px",
          }}
          className="fixed z-50 rounded-xl overflow-hidden shadow-2xl border border-[#D0D7DE] dark:border-[#3E3E42] bg-white dark:bg-[#1E1E1E] text-[#1F2328] dark:text-[#CCCCCC] upload-popup-drop-anim flex flex-col max-h-[470px] select-none"
        >
          {/* 팝업 헤더 */}
          <div className="px-3.5 py-2 border-b border-[#E5E5E5] dark:border-[#3E3E42] bg-[#F6F8FA] dark:bg-[#252526] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">📂</span>
              <span className="text-xs font-bold text-[#1F2328] dark:text-[#CCCCCC]">
                어셈블리 불러오기 및 예제
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

          {/* 1. 상단 섹션: 로컬 어셈블리 파일 업로드 드롭존 */}
          <div className="p-3 border-b border-[#E5E5E5] dark:border-[#3E3E42] bg-[#FAFBFD] dark:bg-[#1E1E1E] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#1F2328] dark:text-[#CCCCCC] flex items-center gap-1">
                <span>📤</span> 로컬 어셈블리 파일 불러오기
              </span>
              <span className="text-[10px] text-[#57606A] dark:text-[#858585] font-mono">
                .s, .asm 지원
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
                  선택 시 즉시 어셈블리 에디터에 로드됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* 2. 중간 섹션: 저장된 어셈블리 파일 목록 */}
          <div className="flex flex-col min-h-0 bg-white dark:bg-[#252526] border-b border-[#E5E5E5] dark:border-[#3E3E42]">
            <div className="px-3.5 py-1.5 border-b border-[#E5E5E5] dark:border-[#3E3E42] bg-[#F3F3F3] dark:bg-[#1E1E1E] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">💾</span>
                <span className="text-xs font-semibold text-[#1F2328] dark:text-[#CCCCCC]">
                  저장된 어셈블리 파일
                </span>
                <span className="text-[10px] font-mono text-[#57606A] dark:text-[#858585]">
                  ({isLoggedIn ? savedAsmFiles.length : 0})
                </span>
              </div>
              {isLoggedIn && savedAsmFiles.length > 0 && (
                <span className="text-[10px] text-[#8C959F] dark:text-[#6E7681]">
                  클릭하여 열기
                </span>
              )}
            </div>

            <div className="overflow-y-auto p-1.5 space-y-1 max-h-36 divide-y divide-[#F0F0F0] dark:divide-[#333333]/50 [scrollbar-width:thin]">
              {!isLoggedIn ? (
                <div className="py-4 px-3 text-center text-xs text-[#57606A] dark:text-[#858585] flex flex-col gap-0.5 items-center justify-center">
                  <span className="font-medium text-[#1F2328] dark:text-[#CCCCCC]">로그인이 필요합니다</span>
                  <span className="text-[10px] text-[#8C959F] dark:text-[#6E7681]">
                    로그인 후 저장한 어셈블리 파일을 불러올 수 있습니다.
                  </span>
                </div>
              ) : savedAsmFiles.length === 0 ? (
                <div className="py-4 px-3 text-center text-xs text-[#57606A] dark:text-[#858585] flex flex-col items-center justify-center">
                  저장된 어셈블리 파일이 없습니다
                </div>
              ) : (
                savedAsmFiles.map((f) => {
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
                      title="클릭하여 어셈블리 에디터에 열기"
                      className={`w-full px-2.5 py-1.5 rounded text-left transition-colors flex items-center justify-between gap-2 cursor-pointer group/row ${
                        isSelected
                          ? "bg-blue-50/80 dark:bg-[#007ACC]/15 text-[#005FB8] dark:text-[#79C0FF]"
                          : "hover:bg-[#F3F4F6] dark:hover:bg-[#2A2D2E]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-[11px] text-[#57606A] dark:text-[#858585] font-mono shrink-0">
                          ⚙️
                        </span>
                        <span
                          className={`text-xs font-mono truncate ${
                            isSelected
                              ? "font-bold text-[#005FB8] dark:text-[#79C0FF]"
                              : "text-[#1F2328] dark:text-[#CCCCCC] group-hover/row:text-[#005FB8] dark:group-hover/row:text-[#79C0FF]"
                          }`}
                        >
                          {f.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {dateStr && (
                          <span className="text-[10px] text-[#8C959F] dark:text-[#6E7681] font-mono">
                            {dateStr}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDownloadSavedFile(e, f)}
                          title="로컬 파일로 다운로드"
                          className="p-1 rounded text-[#57606A] dark:text-[#858585] hover:text-[#005FB8] dark:hover:text-[#79C0FF] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <svg
                            className="w-3.5 h-3.5 stroke-current"
                            fill="none"
                            viewBox="0 0 24 24"
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

          {/* 3. 하단 섹션: ArchReactor RISC-V 템플릿 목록 */}
          <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#252526]">
            <div className="px-3.5 py-1.5 border-b border-[#E5E5E5] dark:border-[#3E3E42] bg-[#F3F3F3] dark:bg-[#1E1E1E] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">📜</span>
                <span className="text-xs font-semibold text-[#1F2328] dark:text-[#CCCCCC]">
                  RISC-V 어셈블리 예제 템플릿
                </span>
              </div>
              <span className="text-[10px] text-[#8C959F] dark:text-[#6E7681]">
                클릭하여 열기
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 min-h-[120px] max-h-56 divide-y divide-[#F0F0F0] dark:divide-[#333333]/50 [scrollbar-width:thin]">
              {ASM_TEMPLATES.map((tmpl, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onSelectAssembly?.(tmpl.code);
                    onClose();
                  }}
                  title="클릭하여 어셈블리 에디터에 예제 코드 로드"
                  className="w-full px-2.5 py-2 rounded text-left transition-colors flex flex-col gap-0.5 cursor-pointer hover:bg-[#F3F4F6] dark:hover:bg-[#2A2D2E] group/row"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#005FB8] dark:text-[#79C0FF] group-hover/row:underline">
                      {tmpl.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">로드 ➔</span>
                  </div>
                  <span className="text-[10.5px] text-[#57606A] dark:text-[#858585] leading-snug">
                    {tmpl.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
