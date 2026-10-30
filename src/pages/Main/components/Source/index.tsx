import React, { useState } from 'react';
import axios from 'axios';
import SourceHeader from './SourceHeader';
import SourceViewer from './SourceViewer';
import { compileCode } from '@/api/build';
import { runSimulation } from '@/api/simulation';

import type { StageBuffer, SimulationResult } from '@/type/simulation';
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

  const updateLoading = (msg: string | null) => {
    setLoadingMessage(msg);
    onLoadingChange?.(msg);
  };

  const handleFileAdded = (file: File) => {
    setErrorMsg(null);
    setFileId(null);
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
    const activeFileId = externalFileId ?? fileId;

    if (!activeFileId && !cContent) {
      setErrorMsg('먼저 + 버튼을 눌러 C 소스 파일을 추가해 주세요.');
      return;
    }

    setErrorMsg(null);
    updateLoading('1/2 C 코드를 어셈블리로 컴파일하는 중...');

    try {
      // file_id가 있는 경우와 없는 경우(직접 입력 모드)로 분기하여 컴파일 요청
      const compilePayload = activeFileId
        ? {
            file_id: activeFileId,
            compile_profile: 'rv32im',
            compiler_opt: '',
          }
        : {
            content: cContent,
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
          setAsmFileName(cFileName ? cFileName.replace(/\.c$/i, '.s') : 'assembly.s');
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
      />
    </div>
  );
};

export default SourceArea;
