import React from "react";
import type { FileSummary } from "@/type/file";
import { useUploadPopup } from "../hooks/useUploadPopup";

const C_TEMPLATES = [
  {
    title: "기본 산술 연산 (Basic Arithmetic)",
    desc: "변수 선언 및 덧셈 연산과 레지스터 반환 과정",
    fileName: "addition.c",
    code: `int main(void) {
    int a = 5;
    int b = 3;
    int sum = a + b;
    return sum;
}
`,
  },
  {
    title: "반복문과 누적 합 (Loop & Sum)",
    desc: "for 반복문을 사용한 1부터 4까지의 누적 합 계산",
    fileName: "loop.c",
    code: `int main(void) {
    int sum = 0;
    for (int i = 1; i <= 4; i++) {
        sum += i;
    }
    return sum;
}
`,
  },
  {
    title: "배열과 메모리 접근 (Array & Memory)",
    desc: "전역 배열 메모리로부터 값을 로드하여 연산",
    fileName: "memory.c",
    code: `volatile int values[2] = {12, 30};

int main(void) {
    int first = values[0];
    int second = values[1];
    return first + second;
}
`,
  },
  {
    title: "조건 분기문 (Branch & If-Else)",
    desc: "if-else 조건 분기에 따른 분기 명령어 생성 과정",
    fileName: "condition.c",
    code: `int main(void) {
    int a = 10;
    int b = 20;
    int max;
    if (a > b) {
        max = a;
    } else {
        max = b;
    }
    return max;
}
`,
  },
];

interface CFileUploadPopupProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onFile: (file: File) => void;
  onSelectExample?: (code: string, fileName?: string) => void;
  savedFiles: FileSummary[];
  isLoggedIn: boolean;
  currentFileId?: string | null;
  onOpenSavedFile?: (fileId: string) => void;
  mode?: "single" | "pipeline";
}

export const CFileUploadPopup: React.FC<CFileUploadPopupProps> = ({
  isOpen,
  onClose,
  anchorRef,
  onFile,
  onSelectExample,
  savedFiles,
  isLoggedIn,
  currentFileId,
  onOpenSavedFile,
  mode = "pipeline",
}) => {
  const isPipeline = mode === "pipeline";
  const {
    popupRef,
    fileInputRef,
    isDragOver,
    popupPos,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDownloadSavedFile,
  } = useUploadPopup(isOpen, onClose, anchorRef, 360, onFile);

  if (!isOpen) return null;

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFile(file);
      onClose();
    }
    event.target.value = "";
  };

  return (
    <div
      ref={popupRef}
      style={{
        top: `${popupPos.top}px`,
        left: `${popupPos.left}px`,
        width: "360px",
      }}
      className="fixed z-50 rounded-xl overflow-hidden shadow-2xl border border-[#D0D7DE] bg-white text-[#1F2328] upload-popup-drop-anim flex flex-col max-h-[520px] select-none"
    >
      {/* 팝업 헤더 */}
      <div className="px-3.5 py-2 border-b border-[#E5E5E5] bg-[#F6F8FA] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">📂</span>
          <span className="text-xs font-bold text-[#1F2328]">
            C 소스 불러오기 및 예제
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

      {/* 1. 상단 섹션: 로컬 파일 업로드 드롭존 */}
      <div className="p-3 border-b border-[#E5E5E5] bg-[#FAFBFD] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-[#1F2328] flex items-center gap-1">
            <span>📤</span> C 소스 파일 업로드
          </span>
          <span className="text-[10px] text-[#57606A] font-mono">
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
              클릭하여 파일 선택{" "}
              <span className="font-normal text-[#57606A]">
                또는 드래그 앤 드롭
              </span>
            </p>
            <p className="text-[10px] text-[#8C959F] mt-0.5">
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

      {/* 2. 중간 섹션: 저장된 파일 목록 */}
      <div className="flex flex-col min-h-0 bg-white border-b border-[#E5E5E5]">
        <div className="px-3.5 py-1.5 border-b border-[#E5E5E5] bg-[#F3F3F3] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">💾</span>
            <span className="text-xs font-semibold text-[#1F2328]">
              저장된 C 파일 목록
            </span>
            <span className="text-[10px] font-mono text-[#57606A]">
              ({isLoggedIn ? savedFiles.length : 0})
            </span>
          </div>
          {isLoggedIn && savedFiles.length > 0 && (
            <span className="text-[10px] text-[#8C959F]">
              클릭하여 열기
            </span>
          )}
        </div>

        <div className="overflow-y-auto p-1.5 space-y-1 max-h-36 divide-y divide-[#F0F0F0] [scrollbar-width:thin]">
          {!isLoggedIn ? (
            <div className="py-4 px-3 text-center text-xs text-[#57606A] flex flex-col gap-0.5 items-center justify-center">
              <span className="font-medium text-[#1F2328]">
                로그인이 필요합니다
              </span>
              <span className="text-[10px] text-[#8C959F]">
                로그인 후 저장한 C/ASM 파일을 불러올 수 있습니다.
              </span>
            </div>
          ) : savedFiles.length === 0 ? (
            <div className="py-4 px-3 text-center text-xs text-[#57606A] flex flex-col items-center justify-center">
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
                      ? isPipeline
                        ? "bg-purple-50 text-[#7C3AED] font-semibold"
                        : "bg-blue-50 text-[#005FB8] font-semibold"
                      : "hover:bg-[#F3F4F6] text-[#24292F]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span
                      className={`text-[9px] font-bold px-1 py-0.2 rounded uppercase shrink-0 ${
                        f.lang === "asm"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-sky-100 text-sky-700"
                      }`}
                    >
                      {f.lang || "c"}
                    </span>
                    <span className="text-xs truncate">{f.title}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {dateStr && (
                      <span className="text-[9.5px] text-[#8C959F] font-mono">
                        {dateStr}
                      </span>
                    )}
                    {isSelected && (
                      <span
                        className={`text-[9.5px] font-bold ${
                          isPipeline
                            ? "text-[#7C3AED]"
                            : "text-[#005FB8]"
                        }`}
                      >
                        열림
                      </span>
                    )}
                    {/* 개별 파일 로컬 다운로드 버튼 */}
                    <button
                      type="button"
                      onClick={(e) => handleDownloadSavedFile(e, f)}
                      title={`'${f.title}' 파일 로컬 다운로드`}
                      className={`p-1 rounded text-[#8C959F] hover:bg-black/10 transition-colors cursor-pointer ml-0.5 ${
                        isPipeline
                          ? "hover:text-[#7C3AED]"
                          : "hover:text-[#005FB8]"
                      }`}
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

      {/* 3. 하단 섹션: ArchReactor C 예제 템플릿 목록 */}
      <div className="flex-1 flex flex-col min-h-0 bg-white">
        <div className="px-3.5 py-1.5 border-b border-[#E5E5E5] bg-[#F3F3F3] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">📜</span>
            <span className="text-xs font-semibold text-[#1F2328]">
              C 언어 예제 템플릿
            </span>
          </div>
          <span className="text-[10px] text-[#8C959F]">
            클릭하여 열기
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5 space-y-1 min-h-[120px] max-h-56 divide-y divide-[#F0F0F0] [scrollbar-width:thin]">
          {C_TEMPLATES.map((tmpl, idx) => (
            <div
              key={idx}
              onClick={() => {
                if (onSelectExample) {
                  onSelectExample(tmpl.code, tmpl.fileName);
                } else {
                  onFile(new File([tmpl.code], tmpl.fileName, { type: "text/x-c" }));
                }
                onClose();
              }}
              title="클릭하여 C 에디터에 예제 코드 로드"
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
  );
};

export default CFileUploadPopup;

