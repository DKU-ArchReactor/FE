import React, { useMemo } from "react";
import type { FileSummary } from "@/type/file";
import { getAccessToken } from "@/api/authSession";
import { useUploadPopup } from "../hooks/useUploadPopup";

const ASM_TEMPLATES = [
  {
    title: "기본 산술 연산 (Basic ALU)",
    desc: "addi, add, sub 명령어를 사용한 기초 레지스터 연산",
    code: `addi t0, zero, 10
addi t1, zero, 20
add  t2, t0, t1
sub  a0, t2, t0
ret
`,
  },
  {
    title: "반복문 카운터 (Loop Counter)",
    desc: "조건 분기(bne)를 이용한 1부터 5까지의 합 계산 루프",
    code: `addi t0, zero, 0
addi t1, zero, 1
addi t2, zero, 6
loop:
add  t0, t0, t1
addi t1, t1, 1
bne  t1, t2, loop
addi a0, t0, 0
ret
`,
  },
  {
    title: "메모리 로드 및 스토어 (Load & Store)",
    desc: "lw 직후 결과 사용(Load-Use 해저드)과 sw 메모리 전송",
    code: `addi sp, sp, -16
addi t0, zero, 42
sw   t0, 8(sp)
lw   t1, 8(sp)
addi a0, t1, 1
addi sp, sp, 16
ret
`,
  },
  {
    title: "함수 호출과 복귀 (Jump & Return)",
    desc: "jal 점프(복귀 주소 저장)와 jalr 레지스터 기준 복귀",
    code: `addi a0, zero, 5
jal  t0, add_ten
addi a0, a0, 1
ret
add_ten:
addi a0, a0, 10
jalr zero, t0, 0
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
  mode?: "single" | "pipeline";
};

export default function AsmFileUploadPopup({
  isOpen,
  onClose,
  anchorRef,
  onSelectAssembly,
  savedFiles = [],
  currentFileId,
  onOpenSavedFile,
  mode = "pipeline",
}: Props) {
  const isPipeline = mode === "pipeline";
  const isLoggedIn = !!getAccessToken();

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

  const {
    popupRef,
    fileInputRef,
    isDragOver,
    popupPos,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDownloadSavedFile,
  } = useUploadPopup(isOpen, onClose, anchorRef, 340, readAsmFile);

  // 저장된 파일 중 어셈블리(.s, .asm, lang=asm) 필터링
  const savedAsmFiles = useMemo(() => {
    return savedFiles.filter(
      (f) =>
        f.lang === "asm" ||
        f.title.toLowerCase().endsWith(".s") ||
        f.title.toLowerCase().endsWith(".asm")
    );
  }, [savedFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readAsmFile(file);
      onClose();
    }
    e.target.value = "";
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
          className="fixed z-50 rounded-xl overflow-hidden shadow-2xl border border-[#D0D7DE] bg-white text-[#1F2328] upload-popup-drop-anim flex flex-col max-h-[470px] select-none"
        >
          {/* 팝업 헤더 */}
          <div className="px-3.5 py-2 border-b border-[#E5E5E5] bg-[#F6F8FA] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">📂</span>
              <span className="text-xs font-bold text-[#1F2328]">
                어셈블리 불러오기 및 예제
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-[#57606A] hover:text-[#CF222E] hover:bg-black/5 transition-colors cursor-pointer text-xs font-bold"
              title="창 닫기"
            >
              ✕
            </button>
          </div>

          {/* 1. 상단 섹션: 로컬 어셈블리 파일 업로드 드롭존 */}
          <div className="p-3 border-b border-[#E5E5E5] bg-[#FAFBFD] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#1F2328] flex items-center gap-1">
                <span>📤</span> 로컬 어셈블리 파일 불러오기
              </span>
              <span className="text-[10px] text-[#57606A] font-mono">
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
                  ? isPipeline
                    ? "border-[#7C3AED] bg-purple-50/70 text-[#7C3AED] scale-[1.01]"
                    : "border-[#005FB8] bg-blue-50/70 text-[#005FB8] scale-[1.01]"
                  : isPipeline
                  ? "border-[#D0D7DE] bg-white text-[#57606A] hover:border-[#7C3AED] hover:text-[#7C3AED] hover:bg-purple-50/30"
                  : "border-[#D0D7DE] bg-white text-[#57606A] hover:border-[#005FB8] hover:text-[#005FB8] hover:bg-slate-50"
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
                <p className="text-xs font-semibold text-[#1F2328]">
                  클릭하여 파일 선택 <span className="font-normal text-[#57606A]">또는 드래그 앤 드롭</span>
                </p>
                <p className="text-[10px] text-[#8C959F] mt-0.5">
                  선택 시 즉시 어셈블리 에디터에 로드됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* 2. 중간 섹션: 저장된 어셈블리 파일 목록 */}
          <div className="flex flex-col min-h-0 bg-white border-b border-[#E5E5E5]">
            <div className="px-3.5 py-1.5 border-b border-[#E5E5E5] bg-[#F3F3F3] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">💾</span>
                <span className="text-xs font-semibold text-[#1F2328]">
                  저장된 어셈블리 파일
                </span>
                <span className="text-[10px] font-mono text-[#57606A]">
                  ({isLoggedIn ? savedAsmFiles.length : 0})
                </span>
              </div>
              {isLoggedIn && savedAsmFiles.length > 0 && (
                <span className="text-[10px] text-[#8C959F]">
                  클릭하여 열기
                </span>
              )}
            </div>

            <div className="overflow-y-auto p-1.5 space-y-1 max-h-36 divide-y divide-[#F0F0F0] [scrollbar-width:thin]">
              {!isLoggedIn ? (
                <div className="py-4 px-3 text-center text-xs text-[#57606A] flex flex-col gap-0.5 items-center justify-center">
                  <span className="font-medium text-[#1F2328]">로그인이 필요합니다</span>
                  <span className="text-[10px] text-[#8C959F]">
                    로그인 후 저장한 어셈블리 파일을 불러올 수 있습니다.
                  </span>
                </div>
              ) : savedAsmFiles.length === 0 ? (
                <div className="py-4 px-3 text-center text-xs text-[#57606A] flex flex-col items-center justify-center">
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
                          ? isPipeline
                            ? "bg-purple-50/80 text-[#7C3AED]"
                            : "bg-blue-50/80 text-[#005FB8]"
                          : "hover:bg-[#F3F4F6]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-[11px] text-[#57606A] font-mono shrink-0">
                          ⚙️
                        </span>
                        <span
                          className={`text-xs font-mono truncate ${
                            isSelected
                              ? isPipeline
                                ? "font-bold text-[#7C3AED]"
                                : "font-bold text-[#005FB8]"
                              : isPipeline
                              ? "text-[#1F2328] group-hover/row:text-[#7C3AED]"
                              : "text-[#1F2328] group-hover/row:text-[#005FB8]"
                          }`}
                        >
                          {f.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {dateStr && (
                          <span className="text-[10px] text-[#8C959F] font-mono">
                            {dateStr}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDownloadSavedFile(e, f, "s")}
                          title="로컬 파일로 다운로드"
                          className={`p-1 rounded text-[#57606A] hover:bg-black/5 transition-colors cursor-pointer ${
                            isPipeline
                              ? "hover:text-[#7C3AED]"
                              : "hover:text-[#005FB8]"
                          }`}
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
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            <div className="px-3.5 py-1.5 border-b border-[#E5E5E5] bg-[#F3F3F3] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">📜</span>
                <span className="text-xs font-semibold text-[#1F2328]">
                  RISC-V 어셈블리 예제 템플릿
                </span>
              </div>
              <span className="text-[10px] text-[#8C959F]">
                클릭하여 열기
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 min-h-[120px] max-h-56 divide-y divide-[#F0F0F0] [scrollbar-width:thin]">
              {ASM_TEMPLATES.map((tmpl, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onSelectAssembly?.(tmpl.code);
                    onClose();
                  }}
                  title="클릭하여 어셈블리 에디터에 예제 코드 로드"
                  className="w-full px-2.5 py-2 rounded text-left transition-colors flex flex-col gap-0.5 cursor-pointer hover:bg-[#F3F4F6] group/row"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold group-hover/row:underline ${
                        isPipeline
                          ? "text-[#7C3AED]"
                          : "text-[#005FB8]"
                      }`}
                    >
                      {tmpl.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">로드 ➔</span>
                  </div>
                  <span className="text-[10.5px] text-[#57606A] leading-snug">
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
