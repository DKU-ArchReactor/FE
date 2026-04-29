const SourceViewer = () => {
  return (
    <div className="flex-1 p-4 overflow-auto bg-slate-50 text-left">
      <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">우측 상단의 버튼을 눌러 C 파일을 추가해주세요</p>
      </div>
    </div>
  );
};

export default SourceViewer;
