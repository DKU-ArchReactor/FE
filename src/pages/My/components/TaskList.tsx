import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFiles, saveFile, getFileById, deleteFile } from "@/api/file";
import type { FileSummary, FileDetail } from "@/type/file";

const TaskList = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<FileSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 다중 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // + 버튼 파일 추가 미리보기/저장 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [newLang, setNewLang] = useState<string>("c");
  const [newContent, setNewContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // 더블클릭 파일 상세 확인 모달 상태
  const [detailFile, setDetailFile] = useState<FileDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);

  const fetchFileList = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await getFiles();
      setFiles(list);
      setSelectedIds(new Set());
    } catch {
      setErrorMsg("파일 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFileList();
  }, []);

  // 체크박스 개별 토글
  const handleToggleSelect = (fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  // 전체 선택 토글
  const handleToggleSelectAll = () => {
    if (selectedIds.size === files.length && files.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.file_id)));
    }
  };

  // 개별 삭제
  const handleDeleteSingle = async (fileId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`'${title}' 파일을 삭제하시겠습니까?`)) return;

    setIsDeleting(true);
    try {
      await deleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.file_id !== fileId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
      if (detailFile?.file_id === fileId) {
        setDetailFile(null);
      }
    } catch {
      setErrorMsg("파일 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  // 선택된 파일 일괄 삭제
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`선택한 ${selectedIds.size}개의 파일을 모두 삭제하시겠습니까?`)) return;

    setIsDeleting(true);
    try {
      const targetIds = Array.from(selectedIds);
      await Promise.all(targetIds.map((id) => deleteFile(id)));
      setFiles((prev) => prev.filter((f) => !selectedIds.has(f.file_id)));
      if (detailFile && selectedIds.has(detailFile.file_id)) {
        setDetailFile(null);
      }
      setSelectedIds(new Set());
    } catch {
      setErrorMsg("일부 파일 삭제 중 오류가 발생했습니다.");
      fetchFileList();
    } finally {
      setIsDeleting(false);
    }
  };

  // + 버튼 클릭 -> 로컬 파일 선택창 열기
  const handleAddButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    const detectedLang = ext === "s" || ext === "asm" ? "asm" : "c";

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = (ev.target?.result as string) || "";
      setNewTitle(file.name);
      setNewLang(detectedLang);
      setNewContent(content);
      setIsAddModalOpen(true);
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 새 파일 저장
  const handleSaveNewFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setIsSaving(true);
    setErrorMsg(null);
    try {
      await saveFile({
        title: newTitle.trim(),
        content: newContent,
        lang: newLang,
      });
      setIsAddModalOpen(false);
      await fetchFileList();
    } catch {
      setErrorMsg("파일 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // 더블클릭 시 상세 조회 모달 열기
  const handleRowDoubleClick = async (fileId: string) => {
    setIsDetailLoading(true);
    setErrorMsg(null);
    try {
      const detail = await getFileById(fileId);
      setDetailFile(detail);
    } catch {
      setErrorMsg("파일 상세 내용을 불러오지 못했습니다.");
    } finally {
      setIsDetailLoading(false);
    }
  };

  // 시뮬레이터로 이동
  const handleMoveToSimulator = (fileId: string) => {
    navigate(`/?fileId=${encodeURIComponent(fileId)}`, {
      state: { fileId },
    });
  };

  return (
    <div className="col-span-1 md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
      {/* 상단 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-800">내 소스 코드 목록</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            항목을 더블클릭하면 코드 내용을 확인하고 시뮬레이터로 이동할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDeleteSelected}
              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              선택 삭제 ({selectedIds.size})
            </button>
          )}

          <button
            type="button"
            onClick={handleAddButtonClick}
            className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold shadow-sm shadow-sky-200 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
            </svg>
            <span>코드 추가</span>
          </button>

          <input
            type="file"
            accept=".c,.s,.asm"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-400 hover:text-rose-700 ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 목록 본문 */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-slate-400">
          파일 목록을 불러오는 중...
        </div>
      ) : files.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
          <p className="text-sm">저장된 소스 코드 파일이 없습니다.</p>
          <p className="text-xs">우측 상단의 [+ 코드 추가] 버튼을 눌러 C 코드를 저장해 보세요.</p>
        </div>
      ) : (
        <div className="mt-3">
          {/* 전체 선택 헤더 바 */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl text-xs font-semibold text-slate-500 mb-2">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={files.length > 0 && selectedIds.size === files.length}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-0 cursor-pointer"
              />
              <span>전체 선택 ({selectedIds.size}/{files.length})</span>
            </label>
            <span>관리</span>
          </div>

          <div className="divide-y divide-slate-100">
            {files.map((file) => {
              const isChecked = selectedIds.has(file.file_id);
              const formattedDate = new Date(file.updated_at).toLocaleString("ko-KR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={file.file_id}
                  onDoubleClick={() => handleRowDoubleClick(file.file_id)}
                  title="더블클릭하여 코드 내용 확인"
                  className={`flex items-center justify-between px-3 py-3.5 rounded-xl transition-colors cursor-pointer select-none ${
                    isChecked ? "bg-sky-50/60" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleSelect(file.file_id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-0 cursor-pointer shrink-0"
                    />
                    <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 text-[11px] font-mono font-bold uppercase shrink-0">
                      {file.lang}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">
                        {file.title}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        수정일: {formattedDate}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveToSimulator(file.file_id);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      시뮬레이터 이동
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={(e) => handleDeleteSingle(file.file_id, file.title, e)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 1. + 버튼 코드 추가 및 타이틀 수정/저장 모달 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">새 소스 코드 확인 및 저장</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewFile} className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    타이틀 (파일명 수정 가능)
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="파일 제목을 입력하세요"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    언어
                  </label>
                  <select
                    value={newLang}
                    onChange={(e) => setNewLang(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-sky-500"
                  >
                    <option value="c">C (c)</option>
                    <option value="asm">Assembly (asm)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  코드 내용 확인
                </label>
                <textarea
                  rows={12}
                  required
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white text-xs font-semibold shadow-sm shadow-sky-200 cursor-pointer"
                >
                  {isSaving ? "저장 중..." : "저장하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. 더블클릭 시 파일 상세 내용 확인 & 시뮬레이터 이동 모달 */}
      {(isDetailLoading || detailFile) && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {isDetailLoading ? (
              <div className="p-12 text-center text-sm text-slate-400">
                파일 내용을 불러오는 중...
              </div>
            ) : (
              detailFile && (
                <>
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 text-xs font-mono font-bold uppercase">
                        {detailFile.lang}
                      </span>
                      <h3 className="text-base font-bold text-slate-800 truncate">
                        {detailFile.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailFile(null)}
                      className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
                    <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-xl border border-slate-200">
                      {detailFile.content}
                    </pre>
                  </div>

                  <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white">
                    <span className="text-xs text-slate-400">
                      마지막 수정: {new Date(detailFile.updated_at).toLocaleString("ko-KR")}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailFile(null)}
                        className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold cursor-pointer"
                      >
                        닫기
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveToSimulator(detailFile.file_id)}
                        className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold shadow-sm shadow-sky-200 cursor-pointer"
                      >
                        선택하여 시뮬레이터로 이동
                      </button>
                    </div>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskList;
