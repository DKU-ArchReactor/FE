import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import SourceArea from "./components/Source";
import TutorArea from "./components/TutorArea";
import AIAgentArea from "./components/AIAgentArea";
import PipelineVisualizer from "./components/PipelineVisualizer";
import StateVisualizer from "./components/StateVisualizer";
import RegisterVisualizer from "./components/RegisterVisualizer";
import MemoryVisualizer from "./components/MemoryVisualizer";
import ControlPanel from "./components/ControlPanel";
import LayoutModal from "./components/LayoutModal";
import FlyoutPanel from "./components/FlyoutPanel";

import type { SimulationResult } from "@/type/simulation";
import type { CodeLineSelectInfo } from "./components/Source/SourceViewer";
import type { PanelKey, SectionConfig } from "./types";
import { PANEL_METAS, ALL_PANEL_KEYS, getDefaultSections } from "./types";
import { useResizableLayout } from "./hooks/useResizableLayout";

const MainPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const initialFileId =
    searchParams.get("fileId") ||
    (location.state as { fileId?: string } | null)?.fileId ||
    null;

  const [simulationData, setSimulationData] = useState<SimulationResult | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const totalCycles = simulationData?.history?.length ?? 0;

  // ========================================================
  // 1. 시뮬레이션 제어 상태 관리
  // ========================================================
  const [currentCycle, setCurrentCycle] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(800);
  const [selectedCodeLine, setSelectedCodeLine] = useState<CodeLineSelectInfo | null>(null);

  const timerRef = useRef<number | null>(null);

  const handleSimulationComplete = (data: SimulationResult) => {
    setIsPlaying(false);
    setCurrentCycle(0);
    setSelectedCodeLine(null);
    setSimulationData(data);
  };

  // 자동 재생 타이머
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        setCurrentCycle((prev) => {
          if (prev >= totalCycles - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, playSpeed);
    } else {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, playSpeed, totalCycles]);

  const handleStepBack = () => {
    setIsPlaying(false);
    setCurrentCycle((prev) => Math.max(0, prev - 1));
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    setCurrentCycle((prev) => Math.min(totalCycles - 1, prev + 1));
  };

  const handleTogglePlay = () => {
    if (currentCycle >= totalCycles - 1) {
      setCurrentCycle(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentCycle(0);
  };

  const handleJumpToCycle = (cycle: number) => {
    setIsPlaying(false);
    setCurrentCycle(cycle);
  };

  const handleChangeSpeed = (speed: number) => {
    setPlaySpeed(speed);
  };

  const handleStartSimulation = () => {
    setCurrentCycle(0);
    setIsPlaying(true);
  };

  // ========================================================
  // 2. 동적 레이아웃 상태 및 리사이징 훅 연동
  // ========================================================
  const [sections, setSections] = useState<SectionConfig[]>(getDefaultSections);
  const resetToDefaultLayout = () => {
    setSections(getDefaultSections());
  };

  const {
    containerRef,
    resizingSplitterIndex,
    resizingRowSlot,
    resizingPair,
    handleColResizeStart,
    handleSlotResizeStart,
    handlePairResizeStart,
  } = useResizableLayout(sections, setSections);

  // 레이아웃 모달 & 우측 책갈피 말풍선 상태
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState<boolean>(false);
  const layoutModalRef = useRef<HTMLDivElement>(null);

  const [activeFlyout, setActiveFlyout] = useState<PanelKey | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 말풍선 및 레이아웃 모달 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (layoutModalRef.current && !layoutModalRef.current.contains(e.target as Node)) {
        setIsLayoutModalOpen(false);
      }
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-bookmark-tab]')) {
          setActiveFlyout(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 화면에 배치된 패널 및 미배치(우측 책갈피) 패널 계산
  const placedPanelsSet = new Set<PanelKey>();
  sections.forEach((sec) => {
    sec.slots.forEach((slot) => {
      if (slot.type === 'single') {
        placedPanelsSet.add(slot.panel);
      } else if (slot.type === 'pair') {
        placedPanelsSet.add(slot.left);
        placedPanelsSet.add(slot.right);
      }
    });
  });

  const unplacedPanels: PanelKey[] = ALL_PANEL_KEYS.filter((key) => !placedPanelsSet.has(key));

  const currentData = simulationData?.history?.[currentCycle] ?? null;
  const prevData = currentCycle > 0 ? simulationData?.history?.[currentCycle - 1] ?? null : null;

  // ========================================================
  // 3. 컴포넌트 공통 렌더러 (슬롯 및 말풍선에서 공용 렌더링)
  // ========================================================
  const renderPanelComponent = (panelKey: PanelKey) => {
    switch (panelKey) {
      case 'pipeline':
        return <PipelineVisualizer currentData={currentData} loadingMessage={loadingMessage} />;
      case 'source':
        return (
          <SourceArea 
            fileId={initialFileId}
            onStartSimulation={handleStartSimulation}
            onSimulationComplete={handleSimulationComplete}
            onLoadingChange={setLoadingMessage}
            stageBuffers={currentData?.buffers}
            selectedLine={selectedCodeLine}
            onSelectLine={setSelectedCodeLine}
          />
        );
      case 'tutor':
        return (
          <TutorArea 
            simulationData={simulationData}
            currentCycleData={currentData}
            loadingMessage={loadingMessage}
            selectedCodeLine={selectedCodeLine}
            onClearSelectedCodeLine={() => setSelectedCodeLine(null)}
          />
        );
      case 'state':
        return (
          <StateVisualizer
            currentData={currentData}
            prevData={prevData}
            simulationData={simulationData}
          />
        );
      case 'registers':
        return (
          <RegisterVisualizer 
            registers={currentData?.global_result.registers || {}}
            prevRegisters={prevData?.global_result.registers}
          />
        );
      case 'memory':
        return (
          <MemoryVisualizer 
            memorySnapshot={currentData?.global_result.memory_snapshot || {}}
            prevMemorySnapshot={prevData?.global_result.memory_snapshot}
          />
        );
      case 'aiPanel':
        return <AIAgentArea />;
      default:
        return null;
    }
  };

  const handlePinToLayout = (panel: PanelKey) => {
    setSections((prev) =>
      prev.map((sec, idx) => {
        if (idx !== 0 || sec.slots.length >= 3) return sec;
        return {
          ...sec,
          slots: [...sec.slots, { type: 'single', panel, flexRatio: 1 }],
        };
      })
    );
    setActiveFlyout(null);
  };

  return (
    <main className="flex-1 flex flex-col px-4 pb-3 pt-2.5 w-full h-full min-h-0 overflow-hidden relative">
      {/* ============================================================ */}
      {/* [최상단 제어 바]: 재생 컨트롤러 + 우측 [⊞ 레이아웃] 조절 버튼 */}
      {/* ============================================================ */}
      <div className="h-[48px] shrink-0 flex items-center gap-2 mb-2 min-h-0 w-full">
        <div className="flex-1 h-full min-w-0">
          <ControlPanel 
            currentCycle={currentCycle}
            totalCycles={totalCycles}
            isPlaying={isPlaying}
            playSpeed={playSpeed}
            onStepBack={handleStepBack}
            onStepForward={handleStepForward}
            onTogglePlay={handleTogglePlay}
            onReset={handleReset}
            onJumpToCycle={handleJumpToCycle}
            onChangeSpeed={handleChangeSpeed}
          />
        </div>

        {/* 레이아웃 커스터마이징 트리거 버튼 */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsLayoutModalOpen((prev) => !prev)}
            title="화면 구역 분할 및 컴포넌트 자유 배치"
            className={`h-[48px] px-3.5 bg-white border rounded-2xl shadow-xs flex items-center gap-2 text-xs font-semibold transition-all duration-200 cursor-pointer ${
              isLayoutModalOpen 
                ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50 shadow-sm' 
                : 'border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span>레이아웃 배치</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* [동적 구역 스플릿 컨테이너]: 1~4구역 렌더링 + 가로 리사이저 */}
      {/* ============================================================ */}
      <div 
        ref={containerRef}
        className={`flex-1 flex w-full min-h-0 overflow-hidden ${resizingSplitterIndex !== null ? 'select-none' : ''}`}
      >
        {sections.map((section, secIdx) => (
          <div key={section.id} className="flex h-full min-h-0 overflow-hidden" style={{ width: `${section.widthPercent}%` }}>
            {/* 구역 내부 세로 슬롯 렌더링 (최대 3개 층) */}
            <div className="flex-1 flex flex-col gap-1.5 min-w-0 h-full overflow-hidden">
              {section.slots.map((slot, slotIdx) => {
                const defaultRatio = (section.slots.length === 2 && slot.type === 'single' && slot.panel === 'pipeline') ? 1.9 : 1;
                const flexVal = slot.flexRatio ?? defaultRatio;

                return (
                  <React.Fragment key={slotIdx}>
                    <div 
                      className="min-h-0 overflow-hidden flex"
                      style={{ flex: `${flexVal} 1 0%` }}
                    >
                      {slot.type === 'single' ? (
                        /* 1) 단일 컴포넌트 렌더링 */
                        <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
                          {renderPanelComponent(slot.panel)}
                        </div>
                      ) : (
                        /* 2) 가로 2개 묶음 렌더링 + 내부 좌우 가로 스플리터 바 */
                        <div className="w-full h-full flex min-h-0 overflow-hidden relative">
                          <div 
                            className="flex flex-col min-h-0 overflow-hidden"
                            style={{ width: `${slot.pairRatio ?? 50}%` }}
                          >
                            {renderPanelComponent(slot.left)}
                          </div>

                          {/* 2개 묶음 내부 좌우 분할 조절 스플리터 바 */}
                          <div
                            onMouseDown={(e) => handlePairResizeStart(secIdx, slotIdx, slot.pairRatio ?? 50, e)}
                            title="좌우로 드래그하여 가로 분할 비율 조절"
                            className="w-2.5 -mx-1 relative flex items-center justify-center cursor-col-resize group shrink-0 z-20 hover:bg-indigo-50/50 rounded-sm transition-colors"
                          >
                            <div className={`w-[3px] rounded-full transition-all duration-200 ${
                              resizingPair?.secIdx === secIdx && resizingPair?.slotIdx === slotIdx
                                ? 'h-16 bg-indigo-600 shadow-sm'
                                : 'h-8 bg-slate-300 group-hover:h-14 group-hover:bg-indigo-500'
                            }`} />
                          </div>

                          <div 
                            className="flex flex-col min-h-0 overflow-hidden"
                            style={{ width: `${100 - (slot.pairRatio ?? 50)}%` }}
                          >
                            {renderPanelComponent(slot.right)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 세로 슬롯 간 실시간 높이 조절 스플리터 바 */}
                    {slotIdx < section.slots.length - 1 && (
                      <div
                        onMouseDown={(e) => {
                          const topSlot = section.slots[slotIdx];
                          const btmSlot = section.slots[slotIdx + 1];
                          const topDefault = topSlot.type === 'single' && topSlot.panel === 'pipeline' ? 1.9 : 1;
                          const btmDefault = btmSlot.type === 'single' && btmSlot.panel === 'pipeline' ? 1.9 : 1;
                          const topRatio = topSlot.flexRatio ?? topDefault;
                          const btmRatio = btmSlot.flexRatio ?? btmDefault;
                          handleSlotResizeStart(secIdx, slotIdx, topRatio, btmRatio, e);
                        }}
                        title="위아래로 드래그하여 슬롯 높이 비율 조절"
                        className="h-2.5 -my-1 relative flex items-center justify-center cursor-row-resize group shrink-0 z-20 hover:bg-indigo-50/50 rounded-sm transition-colors"
                      >
                        <div className={`h-[3px] rounded-full transition-all duration-200 ${
                          resizingRowSlot?.secIdx === secIdx && resizingRowSlot?.slotIdx === slotIdx
                            ? 'w-24 bg-indigo-600 shadow-sm'
                            : 'w-10 bg-slate-300 group-hover:w-20 group-hover:bg-indigo-500'
                        }`} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* 구역 간 가로 조절 스플리터 바 */}
            {secIdx < sections.length - 1 && (
              <div
                onMouseDown={() => handleColResizeStart(secIdx)}
                title="드래그하여 구역 간 너비 조절"
                className="w-2.5 -mx-0.5 relative flex items-center justify-center cursor-col-resize group shrink-0 z-20 hover:bg-blue-50/50 rounded-sm transition-colors"
              >
                <div className={`w-[3px] rounded-full transition-all duration-200 ${
                  resizingSplitterIndex === secIdx 
                    ? 'h-24 bg-blue-600 shadow-sm' 
                    : 'h-10 bg-slate-300 group-hover:h-20 group-hover:bg-blue-500'
                }`} />
              </div>
            )}
          </div>
        ))}

        {/* ============================================================ */}
        {/* [우측 벽면 책갈피 인덱스 탭]: 화면에 배치되지 않은 컴포넌트들 */}
        {/* ============================================================ */}
        {unplacedPanels.length > 0 && (
          <aside className="flex flex-col gap-2 shrink-0 ml-1.5 pt-1 z-30">
            {unplacedPanels.map((pKey) => {
              const meta = PANEL_METAS[pKey];
              const isActive = activeFlyout === pKey;
              return (
                <button
                  key={pKey}
                  type="button"
                  data-bookmark-tab="true"
                  onClick={() => setActiveFlyout((prev) => (prev === pKey ? null : pKey))}
                  title={`${meta.fullName} (말풍선으로 열기)`}
                  className={`w-8 py-3 rounded-l-xl border shadow-xs flex flex-col items-center gap-1.5 transition-all duration-200 group cursor-pointer ${
                    isActive 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md translate-x-[-2px]' 
                      : 'bg-white hover:bg-indigo-50/80 text-slate-500 hover:text-indigo-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <span className="text-xs">{meta.icon}</span>
                  <span className="text-[10px] font-bold tracking-widest [writing-mode:vertical-rl] select-none py-0.5">
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </aside>
        )}
      </div>

      {/* ============================================================ */}
      {/* [레이아웃 모달]: 구역 및 슬롯 실시간 에디터 */}
      {/* ============================================================ */}
      <LayoutModal 
        isOpen={isLayoutModalOpen}
        onClose={() => setIsLayoutModalOpen(false)}
        modalRef={layoutModalRef}
        sections={sections}
        setSections={setSections}
        onResetToDefault={resetToDefaultLayout}
      />

      {/* ============================================================ */}
      {/* [말풍선 / 플로팅 플라이아웃 창]: 미배치 컴포넌트 호출 */}
      {/* ============================================================ */}
      <FlyoutPanel 
        activeFlyout={activeFlyout}
        flyoutRef={flyoutRef}
        isPlacedInLayout={activeFlyout ? placedPanelsSet.has(activeFlyout) : false}
        onPinToLayout={handlePinToLayout}
        onClose={() => setActiveFlyout(null)}
      >
        {activeFlyout && renderPanelComponent(activeFlyout)}
      </FlyoutPanel>
    </main>
  );
};

export default MainPage;
