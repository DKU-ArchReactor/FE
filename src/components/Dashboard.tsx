import React, { useState, useRef } from 'react';
import CodeEditor from './CodeEditor';
import PipelineVisualizer from './PipelineVisualizer';
import StatePanel from './StatePanel';
import AIChat from './AIChat';

const Dashboard: React.FC = () => {
  const [pipelineHeight, setPipelineHeight] = useState(60); // Default 60% top, 40% bottom
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    // Calculate initial height ratio based on viewport position
    const handleDrag = (moveEvent: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      
      const { top, height } = containerRef.current.getBoundingClientRect();
      const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : (moveEvent as MouseEvent).clientY;
      
      const newPercent = ((clientY - top) / height) * 100;
      setPipelineHeight(Math.max(20, Math.min(80, newPercent)));
    };

    const handleUp = () => {
      document.body.style.cursor = ''; // Reset cursor
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleDrag);
      document.removeEventListener('touchend', handleUp);
    };

    document.body.style.cursor = 'row-resize';
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleDrag, { passive: false });
    document.addEventListener('touchend', handleUp);
  };

  return (
    <div className="flex-1 w-full p-4 grid grid-cols-9 gap-4 bg-gray-50 text-gray-900 overflow-hidden">
      {/* 2:5:2 Ratio Layout */}
      
      {/* Left (2) - Code Editor */}
      <div className="col-span-2 h-full overflow-hidden flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
        <CodeEditor />
      </div>

      {/* Center (5) - Pipeline & State */}
      <div 
        ref={containerRef}
        className="col-span-5 h-full flex flex-col overflow-hidden relative"
      >
        {/* Top: Pipeline */}
        <div 
          style={{ height: `calc(${pipelineHeight}% - 4px)` }}
          className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 overflow-hidden flex flex-col transition-none transform-gpu"
        >
          <PipelineVisualizer />
        </div>
        
        {/* Resize Handle */}
        <div 
          onMouseDown={startDrag}
          onTouchStart={startDrag}
          className="h-2 w-full cursor-row-resize hover:bg-cyan-200 active:bg-cyan-300 rounded-full transition-colors flex items-center justify-center shrink-0 z-10 py-2 group"
        >
            <div className="w-12 h-1 bg-gray-300 group-hover:bg-cyan-400 group-active:bg-cyan-500 rounded-full transition-colors" />
        </div>

        {/* Bottom: Registers/Memory + Animation Bar */}
        <div 
          style={{ height: `calc(${100 - pipelineHeight}% - 4px)` }}
          className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 overflow-hidden flex flex-col transition-none transform-gpu"
        >
          <StatePanel />
        </div>
      </div>

      {/* Right (2) - AI Chat */}
      <div className="col-span-2 h-full overflow-hidden flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
        <AIChat />
      </div>
    </div>
  );
};

export default Dashboard;
