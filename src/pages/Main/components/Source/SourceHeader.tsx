import React, { useRef } from 'react';

interface SourceHeaderProps {
  activeTab: 'c' | 'asm';
  setActiveTab: (tab: 'c' | 'asm') => void;
  onFileAdded?: (file: File) => void;
  onCompile?: () => void;
  isCompiling?: boolean;
}

const SourceHeader: React.FC<SourceHeaderProps> = ({
  activeTab,
  setActiveTab,
  onFileAdded,
  onCompile,
  isCompiling = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('추가된 파일:', file.name, file);
      if (onFileAdded) {
        onFileAdded(file);
      }
    }
    
    // Reset the input value so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddFileClick = () => {
    fileInputRef.current?.click();
  };
  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/50 shrink-0">
      <div className="flex space-x-1.5">
        <button
          onClick={() => setActiveTab('c')}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'c'
              ? 'bg-blue-50 text-blue-600 shadow-xs'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          C
        </button>
        <button
          onClick={() => setActiveTab('asm')}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'asm'
              ? 'bg-blue-50 text-blue-600 shadow-xs'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          ASM
        </button>
      </div>
      
      <div className="flex items-center space-x-2">
        <div className="relative group">
          <button
            onClick={handleAddFileClick}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1} className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:flex items-center pointer-events-none z-30">
            <div className="bg-slate-900 text-white text-[11px] font-medium px-2 py-1 rounded-md shadow-lg whitespace-nowrap">
              C 소스 파일 업로드
            </div>
          </div>
        </div>

        <div className="relative group">
          <button
            onClick={onCompile}
            disabled={isCompiling}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1 shadow-xs cursor-pointer disabled:cursor-wait"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.2}
              stroke="currentColor"
              className={`w-3.5 h-3.5 ${isCompiling ? 'animate-spin' : ''}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            {isCompiling && <span>변환 중...</span>}
          </button>
          <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:flex items-center pointer-events-none z-30">
            <div className="bg-slate-900 text-white text-[11px] font-medium px-2 py-1 rounded-md shadow-lg whitespace-nowrap">
              {isCompiling ? '컴파일 및 시뮬레이션 변환 중...' : 'C 코드 컴파일 및 어셈블리 변환'}
            </div>
          </div>
        </div>
        <input
          type="file"
          accept=".c"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default SourceHeader;
