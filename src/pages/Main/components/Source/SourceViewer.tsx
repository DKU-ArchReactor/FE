import React from 'react';

interface SourceViewerProps {
  activeTab: 'c' | 'asm';
  fileName?: string;
  content?: string;
}

const SourceViewer: React.FC<SourceViewerProps> = ({ activeTab, fileName, content }) => {
  const hasContent = activeTab === 'c' && content;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 text-left">
      {hasContent && fileName && (
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600">
          {fileName}
        </div>
      )}
      
      <div className="flex-1 py-4 overflow-auto">
        {hasContent ? (
          <div className="text-xs font-mono text-slate-800 whitespace-pre min-w-max">
            {content!.split('\n').map((line, i) => (
              <div key={i} className="flex leading-6 hover:bg-slate-100">
                <span className="w-7 flex-shrink-0 text-right pr-2 text-slate-400 select-none border-r border-slate-200">
                  {i + 1}
                </span>
                <span className="pl-2">{line || ' '}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 px-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-xs">{activeTab === 'c' ? '파일 추가 버튼을 눌러 C언어 파일을 추가해주세요' : '실행 버튼을 눌러 파일을 변환하세요'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SourceViewer;
