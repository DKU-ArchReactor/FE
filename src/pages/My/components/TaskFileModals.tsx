import React from "react";
import type { FileDetail } from "@/type/file";

type AddTaskFileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onChangeTitle: (val: string) => void;
  lang: string;
  onChangeLang: (val: string) => void;
  content: string;
  onChangeContent: (val: string) => void;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
};

export const AddTaskFileModal: React.FC<AddTaskFileModalProps> = ({
  isOpen,
  onClose,
  title,
  onChangeTitle,
  lang,
  onChangeLang,
  content,
  onChangeContent,
  isSaving,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">새 소스 코드 확인 및 저장</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                타이틀 (파일명 수정 가능)
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => onChangeTitle(e.target.value)}
                placeholder="파일 제목을 입력하세요"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                언어
              </label>
              <select
                value={lang}
                onChange={(e) => onChangeLang(e.target.value)}
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
              value={content}
              onChange={(e) => onChangeContent(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
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
  );
};

type TaskFileDetailModalProps = {
  isLoading: boolean;
  detailFile: FileDetail | null;
  onClose: () => void;
  onMoveToSimulator: (fileId: string) => void;
};

export const TaskFileDetailModal: React.FC<TaskFileDetailModalProps> = ({
  isLoading,
  detailFile,
  onClose,
  onMoveToSimulator,
}) => {
  if (!isLoading && !detailFile) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {isLoading ? (
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
                  onClick={onClose}
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
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold cursor-pointer"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveToSimulator(detailFile.file_id)}
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
  );
};

