import React from 'react';
import type { PanelKey } from '../types';
import { PANEL_METAS } from '../types';

interface FlyoutPanelProps {
  activeFlyout: PanelKey | null;
  flyoutRef: React.RefObject<HTMLDivElement | null>;
  isPlacedInLayout: boolean;
  onPinToLayout: (panel: PanelKey) => void;
  onClose: () => void;
  children: React.ReactNode;
}

const FlyoutPanel: React.FC<FlyoutPanelProps> = ({
  activeFlyout,
  flyoutRef,
  isPlacedInLayout,
  onPinToLayout,
  onClose,
  children,
}) => {
  if (!activeFlyout) return null;

  return (
    <div 
      ref={flyoutRef}
      className="absolute right-12 top-16 bottom-4 w-[480px] bg-white rounded-3xl shadow-2xl border border-slate-200/90 z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200"
    >
      {/* 말풍선 상단 바 */}
      <div className="px-5 py-3.5 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <h3 className="text-xs font-bold text-slate-800">
            {PANEL_METAS[activeFlyout].icon} {PANEL_METAS[activeFlyout].fullName}
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
            말풍선 뷰
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 화면 메인 1구역에 추가 배치하는 옵션 (레이아웃에 등록된 경우에만 노출) */}
          {isPlacedInLayout && (
            <button
              type="button"
              onClick={() => onPinToLayout(activeFlyout)}
              title="이 컴포넌트를 메인 1구역에 고정 배치하기"
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              화면에 고정 ⊞
            </button>
          )}

          {/* 말풍선 닫기 */}
          <button
            type="button"
            onClick={onClose}
            title="말풍선 닫기"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 말풍선 본문 컴포넌트 렌더링 */}
      <div className="flex-1 p-3.5 overflow-y-auto min-h-0 bg-slate-50/30">
        <div className="h-full flex flex-col min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
};

export default FlyoutPanel;
