import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SourceHeader from './SourceHeader';
import SourceViewer from './SourceViewer';
import { compileCode } from '@/api/build';
import { runSimulation } from '@/api/simulation';
import { getFiles, getFileById, saveFile, deleteFile } from '@/api/file';

import type { StageBuffer, SimulationResult } from '@/type/simulation';
import type { FileSummary } from '@/type/file';
import type { CodeLineSelectInfo } from './SourceViewer';

interface SourceAreaProps {
  fileId?: string | null;
  onStartSimulation?: () => void;
  onSimulationComplete?: (data: SimulationResult) => void;
  onLoadingChange?: (loadingMessage: string | null) => void;
  stageBuffers?: {
    IF?: StageBuffer | null;
    ID?: StageBuffer | null;
    EX?: StageBuffer | null;
    MEM?: StageBuffer | null;
    WB?: StageBuffer | null;
  };
  selectedLine?: CodeLineSelectInfo | null;
  onSelectLine?: (info: CodeLineSelectInfo) => void;
}

const SourceArea: React.FC<SourceAreaProps> = ({ 
  fileId: externalFileId = null,
  onSimulationComplete,
  onLoadingChange,
  stageBuffers,
  selectedLine,
  onSelectLine,
}) => {
  const [activeTab, setActiveTab] = useState<'c' | 'asm'>('c');
  const [fileId, setFileId] = useState<string | null>(externalFileId);
  const [cFileName, setCFileName] = useState<string>('');
  const [cContent, setCContent] = useState<string>('');
  const [asmFileName, setAsmFileName] = useState<string>('');
  const [asmContent, setAsmContent] = useState<string>('');
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const loadedFileIdRef = useRef<string | null>(null);

  // 로그인 상태 및 저장된 파일 목록
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => !!localStorage.getItem('access_token'));
  const [savedFiles, setSavedFiles] = useState<FileSummary[]>([]);

  // 파일 저장 모달 상태
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [saveTitle, setSaveTitle] = useState<string>('');
  const [saveLang, setSaveLang] = useState<string>('c');
  const [saveContent, setSaveContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // 파일 다운로드 모달 상태
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);

  const updateLoading = (msg: string | null) => {
    setLoadingMessage(msg);
    onLoadingChange?.(msg);
  };

  const fetchSavedFileList = async () => {
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
    if (!token) {
      setSavedFiles([]);
      return;
    }
    try {
      const list = await getFiles();
      setSavedFiles(list);
    } catch (err) {
      console.error('Saved file list fetch error:', err);
    }
  };

  useEffect(() => {
    fetchSavedFileList();
  }, []);

  const executeCompileAndSimulate = async (targetFileId: string | null, targetContent: string, targetFileName: string) => {
    if (!targetFileId && !targetContent) {
      setErrorMsg('먼저 + 버튼을 눌러 C 소스 파일을 추가해 주세요.');
      return;
    }

    setErrorMsg(null);
    updateLoading('1/2 C 코드를 어셈블리로 컴파일하는 중...');

    try {
      // file_id가 있는 경우와 없는 경우(직접 입력 모드)로 분기하여 컴파일 요청
      const compilePayload = targetFileId
        ? {
            file_id: targetFileId,
            compile_profile: 'rv32im',
            compiler_opt: '',
          }
        : {
            content: targetContent,
            lang: 'c',
            compile_profile: 'rv32im',
            compiler_opt: '',
          };

      const result = await compileCode(compilePayload);
      console.log("Compile Result:", result);

      if (result.status === 'success' && result.assembly_url) {
        try {
          let fetchUrl = result.assembly_url;
          if (import.meta.env.DEV && import.meta.env.VITE_S3_BUCKET_URL) {
            fetchUrl = fetchUrl.replace(import.meta.env.VITE_S3_BUCKET_URL, '/s3-proxy');
          }

          let asmResponse = await fetch(fetchUrl);
          if (!asmResponse.ok && fetchUrl !== result.assembly_url) {
            asmResponse = await fetch(result.assembly_url);
          }
          const asmText = await asmResponse.text();

          setAsmContent(asmText);
          setAsmFileName(targetFileName ? targetFileName.replace(/\.c$/i, '.s') : 'assembly.s');
          setActiveTab('asm');
        } catch (asmErr) {
          console.error("Assembly Fetch Error:", asmErr);
        }

        // file_id 기반으로 컴파일하여 build_id가 있는 경우 build_id 사용,
        // file_id 없이 직접 입력으로 컴파일하여 simulation_token이 있는 경우 simulation_token 사용
        if (result.build_id) {
          updateLoading('2/2 파이프라인 시뮬레이션 실행 중...');
          const simResult = await runSimulation({
            build_id: result.build_id,
            mode: 'pipeline',
            max_cycles: 2000,
          });
          console.log("Simulation Result:", simResult);
          onSimulationComplete?.(simResult);
        } else if (result.simulation_token) {
          updateLoading('2/2 파이프라인 시뮬레이션 실행 중...');
          const simResult = await runSimulation({
            simulation_token: result.simulation_token,
            mode: 'pipeline',
            max_cycles: 2000,
          });
          console.log("Simulation Result:", simResult);
          onSimulationComplete?.(simResult);
        } else {
          setErrorMsg('시뮬레이션 실행에 필요한 build_id 또는 simulation_token이 반환되지 않았습니다.');
        }
      } else {
        setErrorMsg(result.log || '컴파일에 실패했습니다.');
      }
    } catch (error) {
      console.error("Compile/Simulation Error:", error);
      if (axios.isAxiosError(error) && error.response?.status === 410) {
        setErrorMsg('시뮬레이션 토큰이 만료되었습니다. 다시 컴파일해 주세요.');
      } else {
        setErrorMsg('컴파일 또는 시뮬레이션 요청 중 오류가 발생했습니다.');
      }
    } finally {
      updateLoading(null);
    }
  };

  // 특정 저장 파일(file_id)을 로드하고 즉시 시각화까지 실행하는 함수
  const loadSavedFileAndSimulate = async (targetId: string) => {
    loadedFileIdRef.current = targetId;
    setFileId(targetId);
    setErrorMsg(null);
    updateLoading('저장된 소스 코드 불러오는 중...');

    try {
      const detail = await getFileById(targetId);
      setCFileName(detail.title);
      setCContent(detail.content);
      setActiveTab(detail.lang === 'asm' ? 'asm' : 'c');
      await executeCompileAndSimulate(detail.file_id, detail.content, detail.title);
    } catch (err) {
      console.error("File Load Error:", err);
      setErrorMsg('선택한 소스 코드 파일을 불러오지 못했습니다.');
      updateLoading(null);
    }
  };

  // 마이페이지 등에서 fileId를 선택해 진입한 경우 파일 상세 조회 후 자동 컴파일 & 시뮬레이션 실행
  useEffect(() => {
    if (!externalFileId || loadedFileIdRef.current === externalFileId) return;
    loadSavedFileAndSimulate(externalFileId);
  }, [externalFileId]);

  const handleFileAdded = (file: File) => {
    setErrorMsg(null);
    setFileId(null);
    loadedFileIdRef.current = null;
    setCFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCContent(result);
      setActiveTab('c');
    };
    reader.readAsText(file);
  };

  const handleCompile = async () => {
    const activeFileId = fileId;
    await executeCompileAndSimulate(activeFileId, cContent, cFileName);
  };

  // 1) 삼선 메뉴 - 파일 저장 팝업 열기
  const handleOpenSaveModal = () => {
    if (!localStorage.getItem('access_token')) {
      setErrorMsg('파일 저장은 로그인 후 이용할 수 있습니다.');
      return;
    }

    const currentContent = activeTab === 'c' ? cContent : asmContent;
    const currentName = activeTab === 'c' ? cFileName : asmFileName;

    if (!currentContent && !cContent) {
      setErrorMsg('저장할 코드 내용이 없습니다. 먼저 파일을 추가해 주세요.');
      return;
    }

    setSaveTitle(currentName || cFileName || 'untitled.c');
    setSaveLang(activeTab === 'asm' && !cContent ? 'asm' : 'c');
    setSaveContent(cContent || currentContent);
    setIsSaveModalOpen(true);
  };

  const handleSaveFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveTitle.trim() || !saveContent.trim()) return;

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const saved = await saveFile({
        title: saveTitle.trim(),
        content: saveContent,
        lang: saveLang,
      });
      setFileId(saved.file_id);
      loadedFileIdRef.current = saved.file_id;
      setCFileName(saved.title);
      setCContent(saved.content);
      setIsSaveModalOpen(false);
      await fetchSavedFileList();
    } catch (err) {
      console.error('File save error:', err);
      setErrorMsg('파일 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 2) 삼선 메뉴 - 현재 보고 있는 파일 삭제
  const handleDeleteCurrentFile = async () => {
    if (!fileId && !cContent && !asmContent) {
      setErrorMsg('현재 열려 있는 파일이 없습니다.');
      return;
    }

    const targetName = (activeTab === 'c' ? cFileName : asmFileName) || cFileName || '현재 파일';
    if (!window.confirm(`'${targetName}'을(를) 삭제하시겠습니까?`)) return;

    setErrorMsg(null);
    try {
      if (fileId) {
        await deleteFile(fileId);
        await fetchSavedFileList();
      }
      setFileId(null);
      loadedFileIdRef.current = null;
      setCFileName('');
      setCContent('');
      setAsmFileName('');
      setAsmContent('');
      setActiveTab('c');
    } catch (err) {
      console.error('File delete error:', err);
      setErrorMsg('파일 삭제 중 오류가 발생했습니다.');
    }
  };

  // 3) 삼선 메뉴 - 파일 다운로드 모달 및 다운로드 실행
  const handleOpenDownloadModal = () => {
    if (!cContent && !asmContent) {
      setErrorMsg('다운로드할 파일 내용이 없습니다.');
      return;
    }
    setIsDownloadModalOpen(true);
  };

  const handleDownload = (type: 'c' | 'asm') => {
    const targetContent = type === 'c' ? cContent : asmContent;
    if (!targetContent) return;

    const defaultName = type === 'c' ? 'source.c' : 'assembly.s';
    const rawName = type === 'c' ? cFileName : asmFileName;
    const downloadName = rawName || defaultName;

    const blob = new Blob([targetContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsDownloadModalOpen(false);
  };

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-0 relative">
      {errorMsg && (
        <div className="px-3 py-2 bg-rose-50 border-b border-rose-200 text-rose-600 text-xs font-medium flex items-center justify-between shrink-0">
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

      <SourceViewer 
        activeTab={activeTab} 
        fileName={activeTab === 'c' ? cFileName : asmFileName}
        content={activeTab === 'c' ? cContent : asmContent}
        isLoggedIn={isLoggedIn}
        savedFiles={savedFiles}
        selectedFileId={fileId}
        onSelectSavedFile={loadSavedFileAndSimulate}
        stageBuffers={stageBuffers}
        selectedLine={selectedLine}
        onSelectLine={onSelectLine}
      />

      {loadingMessage && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center gap-3 p-4 text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-xs font-semibold text-blue-700">{loadingMessage}</div>
          <div className="text-[11px] text-slate-500">잠시만 기다려 주세요...</div>
        </div>
      )}

      <SourceHeader 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onFileAdded={handleFileAdded}
        onCompile={handleCompile}
        isCompiling={!!loadingMessage}
        onOpenSaveModal={handleOpenSaveModal}
        onDeleteCurrentFile={handleDeleteCurrentFile}
        onOpenDownloadModal={handleOpenDownloadModal}
      />

      {/* 파일 저장 팝업 모달 */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">소스 코드 확인 및 저장</h3>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFileSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    타이틀 (파일명 수정 가능)
                  </label>
                  <input
                    type="text"
                    required
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    placeholder="파일 제목을 입력하세요"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    언어
                  </label>
                  <select
                    value={saveLang}
                    onChange={(e) => setSaveLang(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-blue-500"
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
                  value={saveContent}
                  onChange={(e) => setSaveContent(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold shadow-sm cursor-pointer"
                >
                  {isSaving ? '저장 중...' : '저장하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 파일 다운로드 선택 모달 (C 또는 ASM 선택) */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">파일 다운로드 선택</h3>
              <button
                type="button"
                onClick={() => setIsDownloadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3">
              <p className="text-xs text-slate-500">
                다운로드할 파일 형식을 선택해 주세요.
              </p>

              <button
                type="button"
                disabled={!cContent}
                onClick={() => handleDownload('c')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-transparent flex items-center justify-between text-left transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <div>
                  <div className="text-xs font-bold text-slate-800">C 소스 파일 (.c)</div>
                  <div className="text-[11px] text-slate-400">
                    {cContent ? cFileName || 'source.c' : 'C 코드가 없습니다'}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-semibold">
                  다운로드
                </span>
              </button>

              <button
                type="button"
                disabled={!asmContent}
                onClick={() => handleDownload('asm')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-transparent flex items-center justify-between text-left transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <div>
                  <div className="text-xs font-bold text-slate-800">어셈블리 파일 (.s)</div>
                  <div className="text-[11px] text-slate-400">
                    {asmContent ? asmFileName || 'assembly.s' : '변환된 어셈블리 코드가 없습니다'}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-semibold">
                  다운로드
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SourceArea;
