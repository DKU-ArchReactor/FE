import { useState } from 'react';
import SourceHeader from './SourceHeader';
import SourceViewer from './SourceViewer';

const SourceArea = () => {
  const [activeTab, setActiveTab] = useState<'c' | 'asm'>('c');

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
      <SourceHeader 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      <SourceViewer />
    </div>
  );
};

export default SourceArea;
