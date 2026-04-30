import React, { useRef } from 'react';

interface SourceHeaderProps {
  activeTab: 'c' | 'asm';
  setActiveTab: (tab: 'c' | 'asm') => void;
  onFileAdded?: (file: File) => void;
}

const SourceHeader: React.FC<SourceHeaderProps> = ({
  activeTab,
  setActiveTab,
  onFileAdded,
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
          onClick={handleAddFileClick}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          파일 추가
        </button>
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
