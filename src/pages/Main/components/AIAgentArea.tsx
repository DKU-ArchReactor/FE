import React from 'react';

const AIAgentArea: React.FC = () => {
  return (
    <div className="flex-1 bg-white dark:bg-[#1E1E1E] rounded-md shadow-2xs border border-[#E5E5E5] dark:border-[#333333] flex flex-col h-full min-h-0 overflow-hidden select-none transition-colors duration-150">
      <div className="shrink-0 flex items-center justify-between px-3.5 py-1.5 bg-[#F3F3F3] dark:bg-[#252526] border-b border-[#E5E5E5] dark:border-[#333333] min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs">🤖</span>
          <h3 className="text-xs font-semibold text-[#1F2328] dark:text-[#CCCCCC] whitespace-nowrap">AI 연동 센터</h3>
        </div>
        <span className="text-[10px] font-mono text-[#005FB8] dark:text-[#79C0FF] font-semibold px-2 py-0.5 rounded bg-[#EAEAEA] dark:bg-[#333333]">
          Coming Soon
        </span>
      </div>
      <div className="flex-1 flex flex-col p-4 min-h-0 text-center items-center justify-center">
        <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-[#252526] border border-sky-100 dark:border-[#3E3E42] flex items-center justify-center text-[#005FB8] dark:text-[#007ACC] mb-2.5 shadow-2xs">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
        </div>
        <h3 className="text-xs font-bold text-[#1F2328] dark:text-[#CCCCCC] tracking-tight">AI Agent Ready</h3>
        <p className="mt-1.5 text-xs text-[#57606A] dark:text-[#858585] max-w-[200px] leading-relaxed">
          생성형 AI API를 연동하여 코드 및 파이프라인 실시간 질의응답을 제공할 예정입니다.
        </p>
      </div>
    </div>
  );
};

export default AIAgentArea;
