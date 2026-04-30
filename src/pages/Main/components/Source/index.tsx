import React, { useState } from 'react';
import SourceHeader from './SourceHeader';
import SourceViewer from './SourceViewer';

const SourceArea: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'c' | 'asm'>('c');
  const [cFileName, setCFileName] = useState<string>('');
  const [cContent, setCContent] = useState<string>('');

  const handleFileAdded = (file: File) => {
    setCFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCContent(result);
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
      <SourceHeader 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onFileAdded={handleFileAdded}
      />
      <SourceViewer 
        activeTab={activeTab} 
        fileName={activeTab === 'c' ? cFileName : undefined}
        content={activeTab === 'c' ? cContent : undefined}
      />
    </div>
  );
};

export default SourceArea;
