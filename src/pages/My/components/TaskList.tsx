import { useNavigate } from "react-router-dom";
import { AddTaskFileModal, TaskFileDetailModal } from "./TaskFileModals";
import { useTaskFiles } from "../hooks/useTaskFiles";

const TaskList = () => {
  const navigate = useNavigate();
  const {
    fileInputRef,
    files,
    isLoading,
    errorMsg,
    setErrorMsg,
    selectedIds,
    isDeleting,
    isAddModalOpen,
    setIsAddModalOpen,
    newTitle,
    setNewTitle,
    newLang,
    setNewLang,
    newContent,
    setNewContent,
    isSaving,
    detailFile,
    setDetailFile,
    isDetailLoading,
    handleToggleSelect,
    handleToggleSelectAll,
    handleDeleteSingle,
    handleDeleteSelected,
    handleAddButtonClick,
    handleFileChange,
    handleSaveNewFile,
    handleRowDoubleClick,
  } = useTaskFiles();

  // 시뮬레이터로 이동
  const handleMoveToSimulator = (fileId: string) => {
    navigate(`/simulator?fileId=${encodeURIComponent(fileId)}`, {
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
      <AddTaskFileModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={newTitle}
        onChangeTitle={setNewTitle}
        lang={newLang}
        onChangeLang={setNewLang}
        content={newContent}
        onChangeContent={setNewContent}
        isSaving={isSaving}
        onSubmit={handleSaveNewFile}
      />

      {/* 2. 더블클릭 시 파일 상세 내용 확인 & 시뮬레이터 이동 모달 */}
      <TaskFileDetailModal
        isLoading={isDetailLoading}
        detailFile={detailFile}
        onClose={() => setDetailFile(null)}
        onMoveToSimulator={handleMoveToSimulator}
      />
    </div>
  );
};

export default TaskList;
