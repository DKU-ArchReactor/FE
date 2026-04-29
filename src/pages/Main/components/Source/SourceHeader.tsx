import React from 'react';

interface SourceHeaderProps {
  activeTab: 'c' | 'asm';
  setActiveTab: (tab: 'c' | 'asm') => void;
}

const SourceHeader: React.FC<SourceHeaderProps> = ({
  activeTab,
  setActiveTab,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
      <div className="flex space-x-2">
        <button
          onClick={() => setActiveTab('c')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'c'
              ? 'bg-blue-50 text-blue-600'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          C
        </button>
        <button
          onClick={() => setActiveTab('asm')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'asm'
              ? 'bg-blue-50 text-blue-600'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          ASM
        </button>
      </div>
      
      <div className="flex items-center space-x-3">
        <button
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          파일 추가
        </button>
      </div>
    </div>
  );
};

export default SourceHeader;
