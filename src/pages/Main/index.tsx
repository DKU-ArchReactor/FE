import type { EditorSelection } from './utils/assistantSource';
import { useAuthSession } from '@/api/authSession';
import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import ControlPanel from "./components/ControlPanel";
import PanelRenderer from "./components/PanelRenderer";
import SlidingViewportTrack from "./components/SlidingViewportTrack";
import AiAssistantPopup from "@/components/AiAssistantPopup";
import PlaybackFeedbackOverlay from "./components/PlaybackFeedbackOverlay";

import type { PanelKey, SectionConfig } from "./types";
import { getDefaultSections } from "./types";
import { useResizableLayout } from "./hooks/useResizableLayout";
import { useSimulationPlayback } from "./hooks/useSimulationPlayback";
import { useSimulationSession } from "./hooks/useSimulationSession";
import { useFileManager } from "./hooks/useFileManager";
import { useWorkspaceSplitter } from "./hooks/useWorkspaceSplitter";

const DEFAULT_CUSTOM_ASSEMBLY = [
  "# RISC-V 32IM 어셈블리 직접 작성",
  ".globl main",
  "main:",
  "    addi x1, x0, 5",
  "    addi x2, x0, 10",
  "    add  x3, x1, x2",
  "    slli x4, x3, 2",
  "    ret",
  "",
].join("\n");

const MainPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initialFileId =
    searchParams.get("fileId") ||
    (location.state as { fileId?: string } | null)?.fileId ||
    null;

  // 1. 라우트 및 뷰포트 상태
  const isManagementPath = location.pathname === "/management";
  const isPipelinePath = location.pathname === "/pipeline";

  const rightViewportIndex = useMemo(() => {
    if (isManagementPath) return 2;
    if (isPipelinePath) return 1;
    return 0;
  }, [isManagementPath, isPipelinePath]);

  // 2. 파일 및 소스 코드 상태 훅
  const resetSimulationRef = useRef<(() => void) | null>(null);
  const fileMgr = useFileManager(initialFileId, () => {
    resetSimulationRef.current?.();
  });

  // 3. UI 및 작성 타겟 제어 ("c" vs "asm")
  const [sourceSelection, setSourceSelection] = useState<EditorSelection | null>(null);
  const [editorTarget, setEditorTarget] = useState<"c" | "asm">("c");
  const [isAiPopupOpen, setIsAiPopupOpen] = useState(false);
  const aiButtonRef = useRef<HTMLButtonElement>(null);

  const [translationSelectedLine, setTranslationSelectedLine] = useState<number | null>(null);
  const [translationSelectedAsmIndex, setTranslationSelectedAsmIndex] = useState<number | null>(null);
  const [customAssembly, setCustomAssembly] = useState<string>(DEFAULT_CUSTOM_ASSEMBLY);

  // 4. 시뮬레이션 세션 & 엔진 모드 훅 ("single" | "pipeline")
  const auth = useAuthSession();
  const workspaceKey = JSON.stringify([fileMgr.translationSource, customAssembly, editorTarget, auth.epoch]);
  const simSession = useSimulationSession({
    workspaceKey,
    translationSource: fileMgr.translationSource,
    translationAssembly: fileMgr.translationAssembly,
    translationBusy: fileMgr.translationBusy,
    setTranslationBusy: fileMgr.setTranslationBusy,
    setTranslationError: fileMgr.setTranslationError,
    setTranslationAssembly: fileMgr.setTranslationAssembly,
  });

  const handleClearSelection = useCallback(() => {
    setTranslationSelectedLine(null);
    setTranslationSelectedAsmIndex(null);
  }, []);

  // 5. 시뮬레이션 재생 및 스텝 컨트롤 훅
  const playback = useSimulationPlayback({
    simulationData: simSession.simulationData,
    mappedAssemblyRows: simSession.mappedAssemblyRows,
    isSingleEngine: simSession.isSingleEngine,
    editorTarget,
    translationSelectedLine,
    onClearSelection: handleClearSelection,
  });

  const onResetSimulation = () => {
    simSession.clearSimulationCache();
    playback.setCurrentCycle(0);
    playback.setIsPlaying(false);
    playback.triggerPlaybackFeedback("reset");
  };

  useEffect(() => {
    resetSimulationRef.current = onResetSimulation;
  });

  // 6. 분할 레이아웃 & 스플리터 훅
  const [sections, setSections] = useState<SectionConfig[]>(getDefaultSections);
  const {
    leftPaneWidth,
    setLeftPaneWidth,
    resizingLeftPane,
    mainWorkspaceRef,
    handleMainDividerResizeStart,
    leftTopHeightPercent,
    setLeftTopHeightPercent,
    resizingLeftVertical,
    setResizingLeftVertical,
    leftPaneContainerRef,
    leftCodeColRatio,
    setLeftCodeColRatio,
    resizingLeftCodeCol,
    setResizingLeftCodeCol,
    leftTopContainerRef,
  } = useWorkspaceSplitter();
  const {
    containerRef,
    resizingRowSlot,
    resizingPair,
    handleSlotResizeStart,
    handlePairResizeStart,
    handlePairReset,
    handleSlotReset,
  } = useResizableLayout(sections, setSections);

  // 7. 에디터 상호작용 및 시뮬레이션 연결 핸들러
  const handleSelectTranslationLine = (line: number | null, asmIndex: number | null = null) => {
    if (line !== null) {
      playback.setIsPlaying((prev) => {
        if (prev) playback.triggerPlaybackFeedback("pause");
        return false;
      });
    }
    setTranslationSelectedLine(line);
    setTranslationSelectedAsmIndex(asmIndex);
  };

  const handleTranslationFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".c")) {
      fileMgr.setTranslationError(".c 파일을 선택해 주세요.");
      return;
    }
    if (file.size > 64 * 1024) {
      fileMgr.setTranslationError("C 파일은 64 KiB 이하로 열어 주세요.");
      return;
    }
    try {
      fileMgr.updateTranslationSource(
        (await file.text()).replace(/^\uFEFF/, ""),
        file.name,
        false,
        null,
        onResetSimulation
      );
    } catch {
      fileMgr.setTranslationError("파일을 읽지 못했습니다.");
    }
  };

  // 8. 뷰포트 네비게이션
  const canGoPrevViewport = rightViewportIndex > 0;
  const canGoNextViewport = rightViewportIndex < 2;

  const handleGoPrevViewport = () => {
    if (rightViewportIndex === 2) navigate("/pipeline");
    else if (rightViewportIndex === 1) navigate("/");
  };

  const handleGoNextViewport = () => {
    if (rightViewportIndex === 0) navigate("/pipeline");
    else if (rightViewportIndex === 1) navigate("/management");
  };

  const renderPanel = (panelKey: PanelKey) => (
    <PanelRenderer
      panelKey={panelKey}
      onSourceSelection={setSourceSelection}
      simulationData={simSession.simulationData}
      currentData={playback.currentData}
      prevData={playback.prevData}
      currentCycle={playback.currentCycle}
      playSpeed={playback.playSpeed}
      loadingMessage={simSession.loadingMessage}
      simulationMode={simSession.simulationEngineMode}
      isSingleEngine={simSession.isSingleEngine}
      currentActiveRow={playback.currentActiveRow}
      mappedAssemblyRows={simSession.mappedAssemblyRows}
      activeExecutionCLine={playback.activeExecutionCLine}
      effectiveSelectedLine={playback.effectiveSelectedLine}
      translationSource={fileMgr.translationSource}
      translationAssembly={fileMgr.translationAssembly}
      cFileName={fileMgr.cFileName}
      fileId={fileMgr.fileId}
      editorTarget={editorTarget}
      customAssembly={customAssembly}
      translationBusy={fileMgr.translationBusy}
      translationError={fileMgr.translationError}
      translationSelectedLine={translationSelectedLine}
      translationSelectedAsmIndex={translationSelectedAsmIndex}
      onUpdateTranslationSource={(val) =>
        fileMgr.updateTranslationSource(val, "main.c", false, null, onResetSimulation)
      }
      onResetTranslationSource={() => {
        playback.triggerPlaybackFeedback("trash");
        fileMgr.updateTranslationSource(
          fileMgr.DEFAULT_TRANSLATION_SOURCE,
          "main.c",
          true,
          null,
          () => {
            simSession.clearSimulationCache();
            playback.setCurrentCycle(0);
            playback.setIsPlaying(false);
          }
        );
      }}
      onTranslationCompile={() =>
        simSession.handleTranslationCompile({
          onSimulationComplete: playback.handleSimulationComplete,
          triggerPlaybackFeedback: playback.triggerPlaybackFeedback,
        })
      }
      onTranslationFile={handleTranslationFile}
      onSelectTranslationLine={handleSelectTranslationLine}
      onSaveTranslationFile={fileMgr.handleSaveTranslationFile}
      onOpenSavedFileInEditor={(id) => fileMgr.handleOpenSavedFileInEditor(id, onResetSimulation)}
      onCustomAssemblyChange={(value) => { simSession.clearSimulationCache(); setCustomAssembly(value); }}
      onSimulateAssembly={() =>
        simSession.handleAssemblySimulation(customAssembly, {
          onSimulationComplete: playback.handleSimulationComplete,
          triggerPlaybackFeedback: playback.triggerPlaybackFeedback,
        })
      }
      onResetCustomAssembly={() => {
        playback.triggerPlaybackFeedback("trash");
        setCustomAssembly(DEFAULT_CUSTOM_ASSEMBLY);
        simSession.clearSimulationCache();
        playback.setCurrentCycle(0);
        playback.setIsPlaying(false);
      }}
      onJumpToCycle={playback.handleJumpToCycle}
      savedFiles={fileMgr.savedFiles}
      isLoggedIn={fileMgr.isLoggedIn}
    />
  );

  return (
    <main
      className={`flex-1 flex flex-col px-4 pb-3 pt-2.5 w-full h-full min-h-0 overflow-hidden relative transition-colors duration-500 ${
        playback.isPlaying && simSession.isSingleEngine ? "is-playing-single-light" : ""
      }`}
    >
      {/* 1. 최상단 제어 바 */}
      <div className="h-[42px] shrink-0 flex items-stretch gap-2 mb-2 min-h-0 w-full">
        <div className="flex-1 h-full min-w-0 flex">
          <ControlPanel
            currentCycle={playback.currentCycle}
            totalCycles={playback.totalCycles}
            isPlaying={playback.isPlaying}
            playSpeed={playback.playSpeed}
            onStepBack={playback.handleStepBack}
            onStepForward={playback.handleStepForward}
            onTogglePlay={playback.handleTogglePlay}
            onReset={playback.handleReset}
            onResetAndPlay={playback.handleResetAndPlay}
            onJumpToCycle={playback.handleJumpToCycle}
            onChangeSpeed={playback.setPlaySpeed}
            isReady={playback.isSimulationReady}
            mode={simSession.simulationEngineMode}
            editorTarget={editorTarget}
            onChangeEditorTarget={(target) => {
              if (editorTarget !== target && (playback.isPlaying || playback.currentCycle > 0)) {
                playback.triggerPlaybackFeedback("reset");
              }
              setSourceSelection(null);
              setEditorTarget(target);
              if (target === "asm") {
                setTranslationSelectedLine(null);
                setTranslationSelectedAsmIndex(null);
              }
            }}
            onChangeSimulationMode={(m) =>
              simSession.handleSimulationModeChange(m, {
                onSimulationComplete: playback.handleSimulationComplete,
                triggerPlaybackFeedback: playback.triggerPlaybackFeedback,
                isPlaying: playback.isPlaying,
                currentCycle: playback.currentCycle,
              })
            }
          />
        </div>

        {/* AI 어시스턴트 팝업 버튼 */}
        <button
          ref={aiButtonRef}
          type="button"
          onClick={() => setIsAiPopupOpen((prev) => !prev)}
          title={isAiPopupOpen ? "AI 어시스턴트 창 닫기" : "ArchReactor AI 어시스턴트 열기"}
          className={`h-full aspect-square rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 shrink-0 select-none border-0 group active:scale-95 ${
            isAiPopupOpen
              ? "bg-gradient-to-tr from-[#004C99] via-[#007ACC] to-[#0284C7] text-white ring-2 ring-[#38BDF8]/70 ring-offset-1 dark:ring-offset-[#18181B] shadow-inner"
              : "bg-gradient-to-tr from-[#0066CC] via-[#0091FF] to-[#38BDF8] hover:from-[#0055B3] hover:via-[#0080FF] hover:to-[#7DD3FC] text-white shadow-[0_2px_12px_rgba(0,145,255,0.32)] hover:shadow-[0_4px_18px_rgba(0,145,255,0.48)] hover:scale-[1.03]"
          }`}
        >
          <div className="relative flex items-center justify-center">
            <svg
              className="w-[19px] h-[19px] text-white transition-transform duration-200 group-hover:scale-110 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
              />
            </svg>
          </div>
        </button>
      </div>

      <AiAssistantPopup
        key={auth.epoch}
        sourceSelection={sourceSelection}
        editorLanguage={editorTarget}
        editorContent={editorTarget === 'c' ? fileMgr.translationSource : customAssembly}
        authenticated={auth.authenticated}
        simulation={simSession.simulationData}
        currentData={playback.currentData}
        mode={simSession.simulationEngineMode}
        beforeExecution={simSession.isSingleEngine && playback.currentCycle === 0}
        isOpen={isAiPopupOpen}
        onClose={() => setIsAiPopupOpen(false)}
        anchorRef={aiButtonRef}
      />

      {/* 2. 메인 워크스페이스 분할 레이아웃 */}
      <div
        ref={mainWorkspaceRef}
        className={`flex-1 flex w-full min-h-0 overflow-hidden items-stretch ${
          resizingLeftPane ||
          resizingLeftVertical ||
          resizingLeftCodeCol
            ? "select-none"
            : ""
        }`}
      >
        {/* 좌측 고정 패널: 상단(C/ASM 에디터) + 하단(튜터) */}
        <div
          ref={leftPaneContainerRef}
          className="flex flex-col h-full min-h-0 overflow-hidden pr-1"
          style={{ width: `${leftPaneWidth}%` }}
        >
          {/* 상단: C 소스 + ASM 가로 분할 */}
          <div
            className="flex flex-col w-full min-h-0 overflow-hidden"
            style={{ height: `${leftTopHeightPercent}%` }}
          >
            <div
              ref={leftTopContainerRef}
              className="flex-1 flex w-full min-h-0 overflow-hidden"
            >
              <div
                className="flex flex-col h-full min-h-0 overflow-hidden p-[1.5px]"
                style={{ width: `${leftCodeColRatio}%` }}
              >
                {renderPanel("cSource")}
              </div>

              {/* C 소스와 ASM 사이 분할 스플리터 */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.detail === 2) {
                    setLeftCodeColRatio(50);
                    return;
                  }
                  setResizingLeftCodeCol(true);
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLeftCodeColRatio(50);
                }}
                title="드래그하여 C 코드와 ASM 영역 너비 조절 (더블클릭: 50:50 리셋)"
                className="w-2.5 -mx-0.5 relative flex items-center justify-center cursor-col-resize group shrink-0 z-20 hover:bg-[#005FB8]/10 dark:hover:bg-[#007ACC]/20 rounded-sm transition-colors"
              >
                <div
                  className={`w-[3px] rounded-full transition-all duration-200 ${
                    resizingLeftCodeCol
                      ? "h-24 bg-[#005FB8] dark:bg-[#007ACC] shadow-sm"
                      : "h-10 bg-[#D0D7DE] dark:bg-[#3E3E42] group-hover:h-20 group-hover:bg-[#005FB8] dark:group-hover:bg-[#007ACC]"
                  }`}
                />
              </div>

              <div
                className="flex flex-col h-full min-h-0 overflow-hidden p-[1.5px]"
                style={{ width: `${100 - leftCodeColRatio}%` }}
              >
                {renderPanel("source")}
              </div>
            </div>
          </div>

          {/* 상단(에디터)과 하단(튜터) 사이 세로 분할 스플리터 */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.detail === 2) {
                setLeftTopHeightPercent(56);
                return;
              }
              setResizingLeftVertical(true);
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setLeftTopHeightPercent(56);
            }}
            title="위아래로 드래그하여 코드 영역과 튜터 높이 비율 조절 (더블클릭: 56:44 기본 리셋)"
            className="h-2.5 -my-0.5 relative flex items-center justify-center cursor-row-resize group shrink-0 z-20 hover:bg-[#005FB8]/10 dark:hover:bg-[#007ACC]/20 rounded-sm transition-colors"
          >
            <div
              className={`h-[3px] rounded-full transition-all duration-200 ${
                resizingLeftVertical
                  ? "w-28 bg-[#005FB8] dark:bg-[#007ACC] shadow-sm"
                  : "w-12 bg-[#D0D7DE] dark:bg-[#3E3E42] group-hover:w-24 group-hover:bg-[#005FB8] dark:group-hover:bg-[#007ACC]"
              }`}
            />
          </div>

          {/* 하단: 튜터 영역 */}
          <div
            className="w-full min-h-0 overflow-hidden flex flex-col p-[1.5px]"
            style={{ height: `${100 - leftTopHeightPercent}%` }}
          >
            {renderPanel("tutor")}
          </div>
        </div>

        {/* 좌우 메인 분할선 스플리터 */}
        <div
          onMouseDown={(e) => {
            if (e.detail === 2) {
              e.preventDefault();
              e.stopPropagation();
              setLeftPaneWidth(50);
              return;
            }
            handleMainDividerResizeStart(e);
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setLeftPaneWidth(50);
          }}
          title="드래그하여 좌측 에디터 영역과 우측 뷰포트 너비 조절 (더블클릭: 50:50 기본 리셋)"
          className="w-3 -mx-0.5 relative flex items-center justify-center cursor-col-resize group shrink-0 z-30 hover:bg-[#005FB8]/10 dark:hover:bg-[#007ACC]/20 rounded-md transition-colors"
        >
          <div
            className={`w-[4px] rounded-full transition-all duration-200 ${
              resizingLeftPane
                ? "h-36 bg-[#005FB8] dark:bg-[#007ACC] shadow-md ring-2 ring-[#005FB8]/30 dark:ring-[#007ACC]/30"
                : "h-16 bg-[#D0D7DE] dark:bg-[#3E3E42] group-hover:h-28 group-hover:bg-[#005FB8] dark:group-hover:bg-[#007ACC]"
            }`}
          />
        </div>

        {/* 우측 슬라이딩 뷰포트 영역 */}
        <div className="flex-1 flex h-full min-w-0 overflow-hidden relative items-stretch pl-1">
          {canGoPrevViewport && (
            <div className="w-5 shrink-0 flex items-stretch select-none animate-in fade-in duration-200 mr-1">
              <button
                type="button"
                onClick={handleGoPrevViewport}
                title="이전 뷰포트(왼쪽 영역)로 이동"
                className={`w-full h-full rounded-md border-0 bg-transparent flex flex-col items-center justify-center gap-2.5 transition-all duration-150 cursor-pointer group active:scale-[0.98] ${
                  simSession.isSingleEngine
                    ? "text-[#8C959F] dark:text-[#858585] hover:text-[#005FB8] dark:hover:text-[#007ACC] hover:bg-[#005FB8]/10 dark:hover:bg-[#007ACC]/20"
                    : "text-[#8C959F] dark:text-[#858585] hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 dark:hover:bg-purple-500/20"
                }`}
              >
                <span className="text-base font-bold leading-none transition-transform group-hover:-translate-x-0.5">
                  ‹
                </span>
                <span className="text-[9px] font-mono font-bold tracking-widest [writing-mode:vertical-rl]">
                  PREV
                </span>
              </button>
            </div>
          )}

          <SlidingViewportTrack
            sections={sections}
            rightViewportIndex={rightViewportIndex}
            containerRef={containerRef}
            renderPanel={renderPanel}
            resizingPair={resizingPair}
            resizingRowSlot={resizingRowSlot}
            onPairResizeStart={handlePairResizeStart}
            onSlotResizeStart={handleSlotResizeStart}
            onPairReset={handlePairReset}
            onSlotReset={handleSlotReset}
          />

          {canGoNextViewport && (
            <div className="w-5 shrink-0 flex items-stretch select-none animate-in fade-in duration-200 ml-1">
              <button
                type="button"
                onClick={handleGoNextViewport}
                title="다음 뷰포트(오른쪽 영역)로 이동"
                className={`w-full h-full rounded-md border-0 bg-transparent flex flex-col items-center justify-center gap-2.5 transition-all duration-150 cursor-pointer group active:scale-[0.98] ${
                  simSession.isSingleEngine
                    ? "text-[#8C959F] dark:text-[#858585] hover:text-[#005FB8] dark:hover:text-[#007ACC] hover:bg-[#005FB8]/10 dark:hover:bg-[#007ACC]/20"
                    : "text-[#8C959F] dark:text-[#858585] hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 dark:hover:bg-purple-500/20"
                }`}
              >
                <span className="text-base font-bold leading-none transition-transform group-hover:translate-x-0.5">
                  ›
                </span>
                <span className="text-[9px] font-mono font-bold tracking-widest [writing-mode:vertical-rl]">
                  NEXT
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Play / Pause / Reset / Trash / Check 화면 중앙 애니메이션 피드백 */}
      <PlaybackFeedbackOverlay feedback={playback.playbackFeedback} />
    </main>
  );
};

export default MainPage;
