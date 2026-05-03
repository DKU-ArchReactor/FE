import React, { useState } from 'react';
import SourceHeader from './SourceHeader';
import SourceViewer from './SourceViewer';
import { compileCode } from '@/api/Build';

const SourceArea: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'c' | 'asm'>('c');
  const [cFileName, setCFileName] = useState<string>('');
  const [cContent, setCContent] = useState<string>('');
  const [asmFileName, setAsmFileName] = useState<string>('');
  const [asmContent, setAsmContent] = useState<string>('');

  const handleFileAdded = (file: File) => {
    setCFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCContent(result);
    };
    reader.readAsText(file);
  };

  const handleCompile = async () => {
    if (!cContent) {
      console.warn("No content to compile");
      return;
    }
    try {
      const result = await compileCode({ content: cContent, lang: 'c', compiler_opt: '' });
      console.log("Compile Result:", result);

      if (result.status === 'success' && result.assembly_url) {
        let fetchUrl = result.assembly_url;
        if (import.meta.env.DEV) {
          fetchUrl = fetchUrl.replace(import.meta.env.VITE_S3_BUCKET_URL, '/s3-proxy');
        }

        const asmResponse = await fetch(fetchUrl);
        const asmText = await asmResponse.text();
        
        setAsmContent(asmText);
        setAsmFileName(cFileName ? cFileName.replace('.c', '.s') : 'assembly.s');
        setActiveTab('asm');
      }
    } catch (error) {
      console.error("Compile Error:", error);
    }
  };

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-0">
      <SourceHeader 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onFileAdded={handleFileAdded}
        onCompile={handleCompile}
      />
      <SourceViewer 
        activeTab={activeTab} 
        fileName={activeTab === 'c' ? cFileName : asmFileName}
        content={activeTab === 'c' ? cContent : asmContent}
      />
    </div>
  );
};

export default SourceArea;
