import React from 'react';
import type { SectionConfig, PanelKey } from '../types';
import { PANEL_METAS, ALL_PANEL_KEYS } from '../types';

interface LayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  modalRef: React.RefObject<HTMLDivElement | null>;
  sections: SectionConfig[];
  setSections: React.Dispatch<React.SetStateAction<SectionConfig[]>>;
  onResetToDefault: () => void;
}

const LayoutModal: React.FC<LayoutModalProps> = ({
  isOpen,
  onClose,
  modalRef,
  sections,
  setSections,
  onResetToDefault,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        className="w-full max-w-6xl h-[86vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col p-6 overflow-hidden text-slate-100"
      >
        {/* 모달 상단 헤더: 제목 및 상단 액션 */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <span className="text-xl">⊞</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">화면 레이아웃 실시간 에디터</h2>
                <span className="text-[11px] font-semibold text-indigo-300 bg-indigo-950/80 border border-indigo-700/50 px-2 py-0.5 rounded-full">
                  현재 {sections.length}구역 / 최대 4구역
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                화면 전체 비율을 직접 보면서 구역(열)과 슬롯(행/묶음)을 추가·제거하며 자유롭게 배치하세요.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onResetToDefault}
              title="기본 3구역 배치로 되돌리기"
              className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl transition-all cursor-pointer"
            >
              기본 3구역 초기화
            </button>

            {sections.length < 4 && (
              <button
                type="button"
                onClick={() => {
                  const newWidth = Math.round(100 / (sections.length + 1));
                  setSections((prev) => [
                    ...prev.map((s) => ({ ...s, widthPercent: newWidth })),
                    {
                      id: `sec-${Date.now()}`,
                      widthPercent: newWidth,
                      slots: [{ type: 'single', panel: 'source' }],
                    },
                  ]);
                }}
                className="px-3.5 py-2 text-xs font-bold text-indigo-300 hover:text-white bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-700/60 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>+</span>
                <span>구역 추가 ({sections.length}/4)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>✓</span>
              <span>편집 완료 및 적용</span>
            </button>
          </div>
        </div>

        {/* 중앙 와이어프레임 캔버스 (전체 화면 가로 분할 시각화) */}
        <div className="flex-1 flex gap-3 min-h-0 w-full p-3 bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden mt-4">
          {sections.map((section, secIndex) => (
            <div 
              key={section.id} 
              className="flex flex-col h-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3 min-h-0 overflow-hidden shadow-lg"
              style={{ width: `${section.widthPercent}%` }}
            >
              {/* 구역 헤더: 번호, 너비 조절, 삭제 */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/70 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shadow-xs">
                    {secIndex + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-200">
                    {secIndex + 1}구역 ({section.widthPercent}%)
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* 구역 삭제 */}
                  {sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const remaining = sections.filter((_, idx) => idx !== secIndex);
                        const newWidth = Math.round(100 / remaining.length);
                        setSections(remaining.map((s) => ({ ...s, widthPercent: newWidth })));
                      }}
                      title="이 구역 삭제"
                      className="text-[11px] text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 border border-rose-800/40 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                    >
                      구역 삭제
                    </button>
                  )}
                </div>
              </div>

              {/* 구역 내부 세로 슬롯들 (최대 3개) */}
              <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto pr-0.5">
                {section.slots.map((slot, slotIndex) => (
                  <div 
                    key={slotIndex} 
                    className="flex-1 min-h-[90px] p-2.5 bg-slate-950/60 rounded-xl border border-slate-700/80 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800 text-xs">
                      <span className="text-[10px] font-mono text-slate-400 font-bold">
                        슬롯 #{slotIndex + 1}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {slot.type === 'single' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSections((prev) => {
                                const updated = [...prev];
                                updated[secIndex].slots[slotIndex] = { 
                                  type: 'pair', 
                                  left: slot.panel, 
                                  right: slot.panel === 'registers' ? 'memory' : 'registers' 
                                };
                                return updated;
                              });
                            }}
                            title="가로 2개 묶음으로 분할"
                            className="text-[10px] font-semibold text-indigo-400 bg-indigo-950/70 border border-indigo-800/50 px-2 py-0.5 rounded-md hover:bg-indigo-900 transition-colors cursor-pointer"
                          >
                            [2개 묶기]
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSections((prev) => {
                                const updated = [...prev];
                                updated[secIndex].slots[slotIndex] = { 
                                  type: 'single', 
                                  panel: slot.left 
                                };
                                return updated;
                              });
                            }}
                            title="단일 슬롯으로 환원"
                            className="text-[10px] font-semibold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md hover:bg-slate-700 transition-colors cursor-pointer"
                          >
                            [단일로 분할]
                          </button>
                        )}

                        {section.slots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSections((prev) => {
                                const updated = [...prev];
                                updated[secIndex].slots = updated[secIndex].slots.filter((_, idx) => idx !== slotIndex);
                                return updated;
                              });
                            }}
                            title="슬롯 제거"
                            className="text-slate-400 hover:text-rose-400 px-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 슬롯 내용 선택 셀렉터 */}
                    {slot.type === 'single' ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400">컴포넌트 선택</span>
                        <select
                          value={slot.panel}
                          onChange={(e) => {
                            const val = e.target.value as PanelKey;
                            setSections((prev) => {
                              const updated = [...prev];
                              updated[secIndex].slots[slotIndex] = { type: 'single', panel: val };
                              return updated;
                            });
                          }}
                          className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          {ALL_PANEL_KEYS.map((pKey) => (
                            <option key={pKey} value={pKey}>
                              {PANEL_METAS[pKey].icon} {PANEL_METAS[pKey].fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-indigo-400 font-semibold">좌측 컴포넌트</span>
                          <select
                            value={slot.left}
                            onChange={(e) => {
                              const val = e.target.value as PanelKey;
                              setSections((prev) => {
                                const updated = [...prev];
                                const currentSlot = updated[secIndex].slots[slotIndex];
                                if (currentSlot.type === 'pair') {
                                  updated[secIndex].slots[slotIndex] = { ...currentSlot, left: val };
                                }
                                return updated;
                              });
                            }}
                            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            {ALL_PANEL_KEYS.map((pKey) => (
                              <option key={pKey} value={pKey}>
                                {PANEL_METAS[pKey].icon} {PANEL_METAS[pKey].label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-indigo-400 font-semibold">우측 컴포넌트</span>
                          <select
                            value={slot.right}
                            onChange={(e) => {
                              const val = e.target.value as PanelKey;
                              setSections((prev) => {
                                const updated = [...prev];
                                const currentSlot = updated[secIndex].slots[slotIndex];
                                if (currentSlot.type === 'pair') {
                                  updated[secIndex].slots[slotIndex] = { ...currentSlot, right: val };
                                }
                                return updated;
                              });
                            }}
                            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            {ALL_PANEL_KEYS.map((pKey) => (
                              <option key={pKey} value={pKey}>
                                {PANEL_METAS[pKey].icon} {PANEL_METAS[pKey].label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 구역 내부 하단: 슬롯 추가 버튼 */}
              {section.slots.length < 3 && (
                <button
                  type="button"
                  onClick={() => {
                    setSections((prev) =>
                      prev.map((sec, idx) => {
                        if (idx !== secIndex || sec.slots.length >= 3) return sec;
                        return {
                          ...sec,
                          slots: [...sec.slots, { type: 'single', panel: 'source', flexRatio: 1 }],
                        };
                      })
                    );
                  }}
                  className="mt-2 w-full py-1.5 text-center text-[11px] font-semibold text-slate-400 hover:text-indigo-300 bg-slate-950/60 hover:bg-slate-950 border border-dashed border-slate-700 hover:border-indigo-500/80 rounded-xl transition-all cursor-pointer shrink-0"
                >
                  + 세로 슬롯 추가 ({section.slots.length}/3)
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 모달 하단 안내 바 */}
        <div className="mt-4 shrink-0 flex items-center justify-between text-xs text-slate-400 px-2">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold">💡 Tip</span>
            <span>화면에 배치되지 않은 컴포넌트는 자동으로 <strong>우측 북마크 탭</strong>에 대기하며 언제든 <strong>말풍선(플로팅 창)</strong>으로 호출할 수 있습니다.</span>
          </div>
          <span className="text-[11px] text-slate-500">배치가 끝나면 우측 상단 <strong>[편집 완료 및 적용]</strong>을 클릭하세요.</span>
        </div>
      </div>
    </div>
  );
};

export default LayoutModal;
