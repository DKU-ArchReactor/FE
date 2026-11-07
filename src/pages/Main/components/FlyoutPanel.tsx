import React from 'react';
import type { PanelKey } from '../types';
import { PANEL_METAS } from '../types';

interface FlyoutPanelProps {
  activeFlyout: PanelKey | null;
  flyoutRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  children: React.ReactNode;
}

const FlyoutPanel: React.FC<FlyoutPanelProps> = ({
  activeFlyout,
  flyoutRef,
  onClose,
  children,
}) => {
  if (!activeFlyout) return null;

  return (
    <div 
      ref={flyoutRef}
      className="absolute right-12 top-16 bottom-4 w-[480px] bg-white dark:bg-[#1E1E1E] rounded-xl shadow-2xl border border-[#E5E5E5] dark:border-[#333333] z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200 transition-colors duration-150"
    >
      {/* 말풍선 상단 바 */}
      <div className="px-4 py-2 bg-[#F3F3F3] dark:bg-[#252526] border-b border-[#E5E5E5] dark:border-[#333333] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#005FB8] dark:bg-[#007ACC] animate-pulse" />
          <h3 className="text-xs font-semibold text-[#1F2328] dark:text-[#CCCCCC]">
            {PANEL_METAS[activeFlyout].icon} {PANEL_METAS[activeFlyout].fullName}
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#EAEAEA] dark:bg-[#333333] text-[#005FB8] dark:text-[#79C0FF] font-medium">
            말풍선 뷰
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 말풍선 닫기 */}
          <button
            type="button"
            onClick={onClose}
            title="말풍선 닫기"
            className="p-1 rounded text-[#57606A] dark:text-[#858585] hover:text-[#1F2328] dark:hover:text-[#CCCCCC] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 말풍선 본문 컴포넌트 렌더링 */}
      <div className="flex-1 p-3 overflow-y-auto min-h-0 bg-[#F8F8F8] dark:bg-[#1E1E1E]">
        <div className="h-full flex flex-col min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
};

export default FlyoutPanel;
