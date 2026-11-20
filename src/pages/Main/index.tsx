import type { EditorSelection } from './utils/assistantSource';
import { useAuthSession } from '@/api/authSession';
import React, { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import ControlPanel from "./components/ControlPanel";
import PanelRenderer from "./components/PanelRenderer";
import SlidingViewportTrack from "./components/SlidingViewportTrack";
import AssistantCompileHint from "./components/AssistantCompileHint";
import AiAssistantPopup from "@/components/AiAssistantPopup";
import PlaybackFeedbackOverlay from "./components/PlaybackFeedbackOverlay";

import type { PanelKey, SectionConfig } from "./types";
import { getDefaultSections } from "./types";
import { useResizableLayout } from "./hooks/useResizableLayout";
import { useSimulationPlayback } from "./hooks/useSimulationPlayback";
import { useSimulationSession } from "./hooks/useSimulationSession";
import { useFileManager } from "./hooks/useFileManager";
import { useWorkspaceSplitter } from "./hooks/useWorkspaceSplitter";
import { getLearningExample } from "@/data/learningExamples";

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
  const initialFileId =
    searchParams.get("fileId") ||
    (location.state as { fileId?: string } | null)?.fileId ||
    null;

  // 1. 뷰포트 상태 (로컬 상태로 관리하여 URL 변경 및 히스토리 스택 누적 방지)
  const [rightViewportIndex, setRightViewportIndex] = useState(0);

  // 2. 파일 및 소스 코드 상태 훅
  const resetSimulationRef = useRef<(() => void) | null>(null);
  const fileMgr = useFileManager(
    initialFileId,
    initialFileId ? undefined : getLearningExample(searchParams.get("example")),
    () => {
      resetSimulationRef.current?.();
    }
  );

  // 3. UI 및 작성 타겟 제어 ("c" vs "asm")
  const [sourceSelection, setSourceSelection] = useState<EditorSelection | null>(null);
  const [editorTarget, setEditorTarget] = useState<"c" | "asm">("c");
  const [isAiPopupOpen, setIsAiPopupOpen] = useState(false);
  const [isMobileCodeView, setIsMobileCodeView] = useState(true);
  const [isMobileAssistantViewport, setIsMobileAssistantViewport] = useState(false);
  const [assistantHint, setAssistantHint] = useState<{ workspace: string; language: 'c' | 'asm' } | null>(null);
  const aiPopupOpenRef = useRef(isAiPopupOpen);
  useEffect(() => { aiPopupOpenRef.current = isAiPopupOpen; }, [isAiPopupOpen]);
  const aiButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileAssistantViewport(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [translationSelectedLine, setTranslationSelectedLine] = useState<number | null>(null);
  const [translationSelectedAsmIndex, setTranslationSelectedAsmIndex] = useState<number | null>(null);
  const [isMobileTutorModalOpen, setIsMobileTutorModalOpen] = useState(false);
  const [customAssembly, setCustomAssembly] = useState<string>(DEFAULT_CUSTOM_ASSEMBLY);

  // 4. 시뮬레이션 세션 & 엔진 모드 훅 ("single" | "pipeline")
  const auth = useAuthSession();
  const workspaceKey = JSON.stringify([fileMgr.translationSource, customAssembly, editorTarget, auth.epoch]);
  const simSession = useSimulationSession({
    workspaceKey,
    savedFileId: auth.authenticated ? fileMgr.savedTranslationFileId : null,
    translationSource: fileMgr.translationSource,
    translationAssembly: fileMgr.translationAssembly,
    translationBusy: fileMgr.translationBusy,
    setTranslationBusy: fileMgr.setTranslationBusy,
    setTranslationError: fileMgr.setTranslationError,
    setTranslationAssembly: fileMgr.setTranslationAssembly,
  });

  const showAssistantHint = assistantHint?.workspace === workspaceKey && !isAiPopupOpen && !fileMgr.translationBusy;
  const onCompilationComplete = () => {
    if (!aiPopupOpenRef.current) setAssistantHint({ workspace: workspaceKey, language: editorTarget });
  };

  const handleClearSelection = useCallback(() => {
    setTranslationSelectedLine(null);
    setTranslationSelectedAsmIndex(null);
    setIsMobileTutorModalOpen(false);
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
    setAssistantHint(null);
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
  const handleSelectTranslationLine = (
    line: number | null,
    asmIndex: number | null = null,
    openTutorModal: boolean = asmIndex !== null
  ) => {
    if (line !== null) {
      playback.setIsPlaying((prev) => {
        if (prev) playback.triggerPlaybackFeedback("pause");
        return false;
      });
    }
    setTranslationSelectedLine(line);
    setTranslationSelectedAsmIndex(asmIndex);
    if ((line !== null || asmIndex !== null) && openTutorModal && simSession.simulationData) {
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setIsMobileTutorModalOpen(true);
      }
    } else if (line === null && asmIndex === null) {
      setIsMobileTutorModalOpen(false);
    }
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
    setRightViewportIndex((prev) => Math.max(0, prev - 1));
  };

  const handleGoNextViewport = () => {
    setRightViewportIndex((prev) => Math.min(2, prev + 1));
  };

  const renderPanel = (panelKey: PanelKey, onCloseTutor?: () => void) => (
    <PanelRenderer
      panelKey={panelKey}
      onCloseTutor={onCloseTutor}
      onSourceSelection={setSourceSelection}
      simulationData={simSession.simulationData}
      currentData={playback.currentData}
      prevData={playback.prevData}
      currentCycle={playback.currentCycle}
      playSpeed={playback.playSpeed}
      onPausePlayback={playback.pauseForFlow}
      singlePlaybackFinished={playback.singlePlaybackFinished}
      isPlaying={playback.isPlaying}
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
      onTranslationCompile={() => {
        setAssistantHint(null);
        return simSession.handleTranslationCompile({
          onCompilationComplete,
          onSimulationComplete: playback.handleSimulationComplete,
          triggerPlaybackFeedback: playback.triggerPlaybackFeedback,
        });
      }}
      onTranslationFile={handleTranslationFile}
      onSelectTranslationLine={handleSelectTranslationLine}
      onSaveTranslationFile={fileMgr.handleSaveTranslationFile}
      onSaveAssemblyFile={(name) => fileMgr.handleSaveAssemblyFile(customAssembly, name)}
      onOpenSavedFileInEditor={(id) => fileMgr.handleOpenSavedFileInEditor(id, onResetSimulation)}
      onOpenSavedAssemblyFile={async (id) => {
        const detail = await fileMgr.ensureFileContent(id);
        if (detail) {
          setCustomAssembly(detail.content);
          fileMgr.setFileId(id);
          fileMgr.setAsmFileName(detail.title);
          onResetSimulation();
        }
      }}
      onCustomAssemblyChange={(value) => { setAssistantHint(null); simSession.clearSimulationCache(); setCustomAssembly(value); }}
      onSimulateAssembly={() => {
        setAssistantHint(null);
        return simSession.handleAssemblySimulation(customAssembly, {
          onCompilationComplete,
          onSimulationComplete: playback.handleSimulationComplete,
          triggerPlaybackFeedback: playback.triggerPlaybackFeedback,
        });
      }}
      onResetCustomAssembly={() => {
        setAssistantHint(null);
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

  const maxCycle = simSession.isSingleEngine
    ? playback.totalCycles
    : Math.max(0, playback.totalCycles - 1);

const handleMobileCodeSelect = () => {
  setIsMobileCodeView(true);
  setIsMobileAssistantViewport(false);
};

const handleMobileViewportSelect = (index: number) => {
  setIsMobileCodeView(false);
  setIsMobileAssistantViewport(false);
  setRightViewportIndex(index);
  };

  const handleMobileAssistantSelect = () => {
    setAssistantHint(null);
    setIsMobileCodeView(false);
    setIsMobileAssistantViewport(true);
  };

  return (
    <main
      className={`flex-1 flex flex-col px-0 pb-0 pt-2 md:px-4 md:pb-3 md:pt-2.5 w-full h-full min-h-0 overflow-hidden relative transition-colors duration-500 ${
        playback.isPlaying
          ? simSession.isSingleEngine
            ? "is-playing-single-light"
            : "is-playing-pipeline-light"
          : ""
      }`}
    >
      {/* 1. 최상단 제어 바 */}
      <div className="h-[42px] shrink-0 flex items-stretch gap-2 mb-2 px-3 md:px-0 min-h-0 w-full">
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
              setAssistantHint(null);
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

        {/* AI 어시스턴트 팝업 버튼 (모바일에서는 하단 바텀바로 분리 예정) */}
        <div className="hidden md:block relative h-full aspect-square shrink-0">
        <button
          ref={aiButtonRef}
          type="button"
          onClick={() => { setAssistantHint(null); setIsAiPopupOpen((prev) => !prev); }}
          aria-describedby={showAssistantHint ? 'assistant-compile-hint' : undefined}
          title={isAiPopupOpen ? "AI 어시스턴트 창 닫기" : "ArchReactor AI 어시스턴트 열기"}
          className={`h-full aspect-square rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 shrink-0 select-none border-0 outline-none group active:scale-95 ${showAssistantHint ? 'ring-2 ring-[var(--ar-accent)] ring-offset-2 shadow-lg' : ''} ${
            isAiPopupOpen
              ? simSession.isSingleEngine
                ? "bg-gradient-to-tr from-[#003870] via-[#005FB8] to-[#1E70BF] text-white shadow-[0_4px_18px_rgba(0,95,184,0.45)] scale-[1.03]"
                : "bg-gradient-to-tr from-[#581C87] via-[#7C3AED] to-[#9D4EDD] text-white shadow-[0_4px_18px_rgba(124,58,237,0.45)] scale-[1.03]"
              : simSession.isSingleEngine
              ? "bg-gradient-to-tr from-[#005FB8] via-[#0D6EFD] to-[#2B7FFF] hover:from-[#004C99] hover:via-[#005FB8] hover:to-[#1E70BF] text-white shadow-[0_2px_12px_rgba(0,95,184,0.35)] hover:shadow-[0_4px_18px_rgba(0,95,184,0.5)] hover:scale-[1.03]"
              : "bg-gradient-to-tr from-[#7C3AED] via-[#8B5CF6] to-[#A855F7] hover:from-[#6D28D9] hover:via-[#7C3AED] hover:to-[#9333EA] text-white shadow-[0_2px_12px_rgba(124,58,237,0.35)] hover:shadow-[0_4px_18px_rgba(124,58,237,0.5)] hover:scale-[1.03]"
          }`}
        >
          <div className="relative flex items-center justify-center">
            <svg
              className="w-[23px] h-[23px] text-white transition-transform duration-200 group-hover:scale-110 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
              />
            </svg>
          </div>
        </button>
        {showAssistantHint && <AssistantCompileHint language={assistantHint.language} onDismiss={() => setAssistantHint(null)} onOpen={() => { setAssistantHint(null); setIsAiPopupOpen(true); }} />}
        </div>
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

      {/* 2. 메인 워크스페이스 분할 레이아웃 (모바일: 탭별 100% 풀화면 전환 / md 이상: 좌우 고정 분할) */}
      <div
        ref={mainWorkspaceRef}
        className={`flex-1 flex flex-col md:flex-row px-3 pb-2 md:px-0 md:pb-0 w-full min-h-0 overflow-hidden items-stretch ${
          resizingLeftPane ||
          resizingLeftVertical ||
          resizingLeftCodeCol
            ? "select-none"
            : ""
        }`}
      >
        {/* 좌측 고정 패널: 상단(C/ASM 에디터) + 하단(튜터) (데스크톱 전용, 모바일에서는 슬라이딩 트랙 0번 슬라이드로 동작) */}
        <div
          ref={leftPaneContainerRef}
className="hidden md:flex flex-col w-full md:w-[var(--left-pane-w)] flex-1 md:flex-none h-full min-h-0 overflow-hidden md:pr-1.5"
          style={{ "--left-pane-w": `${leftPaneWidth}%` } as React.CSSProperties}
        >
          {/* 상단: C 소스 + ASM (모바일: 세로 1:1 배치 & 전체 높이 / md 이상: 가로 분할 & 비율 높이) */}
          <div
            className="flex flex-col w-full flex-1 md:flex-none h-full md:h-[var(--left-top-h)] min-h-0 overflow-hidden"
            style={{ "--left-top-h": `${leftTopHeightPercent}%` } as React.CSSProperties}
          >
            <div
              ref={leftTopContainerRef}
              className="flex-1 flex flex-col md:flex-row gap-1.5 md:gap-0 w-full min-h-0 overflow-hidden"
            >
              <div
                className="flex flex-col w-full md:w-[var(--c-col-w)] flex-1 md:flex-none md:h-full min-h-0 overflow-hidden p-[1.5px]"
                style={{ "--c-col-w": `${leftCodeColRatio}%` } as React.CSSProperties}
              >
                {renderPanel("cSource")}
              </div>

              {/* C 소스와 ASM 사이 분할 스플리터 (모바일 숨김) */}
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
                className="hidden md:flex w-2.5 -mx-0.5 relative items-center justify-center cursor-col-resize group shrink-0 z-20 hover:bg-[var(--ar-accent)]/10 rounded-sm transition-colors"
              >
                <div
                  className={`w-[3px] rounded-full transition-all duration-200 ${
                    resizingLeftCodeCol
                      ? "h-24 bg-[var(--ar-accent)] shadow-sm"
                      : "h-10 bg-[#D0D7DE] dark:bg-[#3E3E42] group-hover:h-20 group-hover:bg-[var(--ar-accent)]"
                  }`}
                />
              </div>

              <div
                className="flex flex-col w-full md:flex-1 md:h-full min-h-0 overflow-hidden p-[1.5px]"
              >
                {renderPanel("source")}
              </div>
            </div>
          </div>

          {/* 상단(에디터)과 하단(튜터) 사이 세로 분할 스플리터 (모바일 숨김) */}
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
            className="hidden md:flex h-2.5 -my-0.5 relative items-center justify-center cursor-row-resize group shrink-0 z-20 hover:bg-[var(--ar-accent)]/10 rounded-sm transition-colors"
          >
            <div
              className={`h-[3px] rounded-full transition-all duration-200 ${
                resizingLeftVertical
                  ? "w-28 bg-[var(--ar-accent)] shadow-sm"
                  : "w-12 bg-[#D0D7DE] dark:bg-[#3E3E42] group-hover:w-24 group-hover:bg-[var(--ar-accent)]"
              }`}
            />
          </div>

          {/* 하단: 튜터 영역 (모바일 숨김) */}
          <div
            className="hidden md:flex w-full min-h-0 overflow-hidden flex-col p-[1.5px]"
            style={{ height: `${100 - leftTopHeightPercent}%` }}
          >
            {renderPanel("tutor")}
          </div>
        </div>

        {/* 좌우 메인 분할선 스플리터 (모바일 숨김) */}
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
          className="hidden md:flex w-2.5 relative items-center justify-center cursor-col-resize group shrink-0 z-30 hover:bg-[var(--ar-accent)]/10 rounded-md transition-colors"
        >
          <div
            className={`w-[4px] rounded-full transition-all duration-200 ${
              resizingLeftPane
                ? "h-36 bg-[var(--ar-accent)] shadow-md ring-2 ring-[var(--ar-accent)]/30"
                : "h-16 bg-[#D0D7DE] dark:bg-[#3E3E42] group-hover:h-28 group-hover:bg-[var(--ar-accent)]"
            }`}
          />
        </div>

        {/* 슬라이딩 뷰포트 영역 (모바일: 5개 탭 전체 슬라이드 트랙 / md 이상: 우측 3개 뷰포트 트랙) */}
        <div className="flex w-full flex-1 h-full min-w-0 min-h-0 overflow-hidden relative items-stretch md:pl-1">
          {canGoPrevViewport && (
            <div className="hidden md:flex w-5 shrink-0 items-stretch select-none animate-in fade-in duration-200 mr-1">
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
                <svg
                  className="w-3.5 h-3.5 fill-current transition-transform duration-150 group-hover:-translate-x-0.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M16 4L6 12l10 8V4z" />
                </svg>
                <span className="text-[11px] font-mono font-bold tracking-widest [writing-mode:vertical-rl]">
                  PREV
                </span>
              </button>
            </div>
          )}

          <SlidingViewportTrack
            sections={sections}
            rightViewportIndex={rightViewportIndex}
            mobileViewportIndex={
              isMobileCodeView ? 0 : isMobileAssistantViewport ? 4 : rightViewportIndex + 1
            }
            containerRef={containerRef}
            renderPanel={renderPanel}
            resizingPair={resizingPair}
            resizingRowSlot={resizingRowSlot}
            onPairResizeStart={handlePairResizeStart}
            onSlotResizeStart={handleSlotResizeStart}
            onPairReset={handlePairReset}
            onSlotReset={handleSlotReset}
            mobileLeadSection={
              <>
                <div className="flex flex-col w-full flex-1 min-h-0 overflow-hidden p-[1.5px]">
                  {renderPanel("cSource")}
                </div>
                <div className="flex flex-col w-full flex-1 min-h-0 overflow-hidden p-[1.5px]">
                  {renderPanel("source")}
                </div>
              </>
            }
            mobileExtraSection={
              <AiAssistantPopup
                key={`mobile-${auth.epoch}`}
                inline
                sourceSelection={sourceSelection}
                editorLanguage={editorTarget}
                editorContent={editorTarget === "c" ? fileMgr.translationSource : customAssembly}
                authenticated={auth.authenticated}
                simulation={simSession.simulationData}
                currentData={playback.currentData}
                mode={simSession.simulationEngineMode}
                beforeExecution={simSession.isSingleEngine && playback.currentCycle === 0}
                isOpen={true}
                onClose={() => setIsMobileAssistantViewport(false)}
              />
            }
          />

          {canGoNextViewport && (
            <div className="hidden md:flex w-5 shrink-0 items-stretch select-none animate-in fade-in duration-200 ml-1">
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
                <svg
                  className="w-3.5 h-3.5 fill-current transition-transform duration-150 group-hover:translate-x-0.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 4l10 8-10 8V4z" />
                </svg>
                <span className="text-[11px] font-mono font-bold tracking-widest [writing-mode:vertical-rl]">
                  NEXT
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. 모바일 전용 하단 재생 콘솔 + 바닥 밀착 4버튼 바텀바 (md 미만 노출) */}
      <div className="md:hidden shrink-0 w-full flex flex-col bg-[var(--ar-panel-bg)] border-t border-[var(--ar-border)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] z-30 select-none font-mono">
        {/* 3-1. 하단 시뮬레이션 재생 콘솔 */}
        <div className="flex flex-col gap-1.5 px-3 py-2">
          {/* 1줄: Cycle 표시 + 슬라이더 + 배속 */}
          <div className="flex items-center gap-2.5 w-full min-w-0">
            <div className="flex items-baseline gap-1 shrink-0 text-[#24292F] dark:text-[#CCCCCC]">
              <span className="text-[10px] text-[#57606A] dark:text-[#858585] uppercase tracking-wider">
                Cycle:
              </span>
              <span
                className={`text-sm font-bold transition-colors ${
                  simSession.isSingleEngine
                    ? "text-[#005FB8] dark:text-[#DCDCAA]"
                    : "text-[#7C3AED] dark:text-[#C084FC]"
                }`}
              >
                {playback.currentCycle}
              </span>
              <span className="text-[10px] text-[#8C959F] dark:text-[#6E7681]">/{maxCycle}</span>
            </div>

            <input
              type="range"
              min={0}
              max={maxCycle}
              disabled={!playback.isSimulationReady || playback.totalCycles <= 1}
              value={playback.currentCycle}
              onChange={(e) => playback.handleJumpToCycle(Number(e.target.value))}
              className={`flex-1 min-w-0 h-1 bg-[#E1E4E8] dark:bg-[#333333] rounded appearance-none cursor-pointer focus:outline-none transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none ${
                simSession.isSingleEngine
                  ? "accent-[#005FB8] dark:accent-[#007ACC]"
                  : "accent-[#7C3AED] dark:accent-[#A855F7]"
              }`}
            />

            <div className="flex items-center gap-0.5 shrink-0 text-[9.5px]">
              {[
                { label: "0.5x", speed: 2000 },
                { label: "1.0x", speed: 1000 },
                { label: "1.5x", speed: 667 },
                { label: "2.0x", speed: 500 },
              ].map(({ label, speed }) => {
                const isSelected = Math.abs(playback.playSpeed - speed) < 50;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={!playback.isSimulationReady}
                    onClick={() => playback.setPlaySpeed(speed)}
                    className={`px-1.5 py-0.5 rounded transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none ${
                      isSelected
                        ? simSession.isSingleEngine
                          ? "bg-[#005FB8] dark:bg-[#007ACC] text-white font-bold"
                          : "bg-[#7C3AED] dark:bg-[#8B5CF6] text-white font-bold"
                        : "text-[#57606A] dark:text-[#858585] hover:text-[#24292F] dark:hover:text-[#CCCCCC]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2줄: 디버그 재생 컨트롤 버튼 5종 */}
          <div className="flex items-center justify-center gap-2 bg-[#F3F4F6] dark:bg-[#252526] p-1 rounded-md border border-[#D0D7DE] dark:border-[#3E3E42]">
            <button
              type="button"
              onClick={playback.handleReset}
              disabled={!playback.isSimulationReady || playback.currentCycle === 0}
              title="처음으로 초기화 (Reset / Stop)"
              className="p-1.5 rounded text-[#57606A] dark:text-[#CCCCCC] hover:text-[#24292F] dark:hover:text-white hover:bg-[#E5E7EB] dark:hover:bg-[#3A3A3A] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            </button>

            <button
              type="button"
              onClick={playback.handleResetAndPlay}
              disabled={!playback.isSimulationReady || playback.totalCycles <= 1}
              title="처음부터 다시시작 (Restart / Reset & Play)"
              className="p-1.5 rounded text-[#57606A] dark:text-[#CCCCCC] hover:text-[#24292F] dark:hover:text-white hover:bg-[#E5E7EB] dark:hover:bg-[#3A3A3A] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={playback.handleStepBack}
              disabled={!playback.isSimulationReady || playback.currentCycle <= 0}
              title="이전 단계 (Step Back)"
              className="p-1.5 rounded text-[#57606A] dark:text-[#CCCCCC] hover:text-[#24292F] dark:hover:text-white hover:bg-[#E5E7EB] dark:hover:bg-[#3A3A3A] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              type="button"
              onClick={playback.handleTogglePlay}
              disabled={!playback.isSimulationReady || playback.totalCycles <= 1}
              title={playback.isPlaying ? "일시정지 (Pause)" : "재생 (Play)"}
              className={`px-4 py-1 rounded text-[11px] font-bold text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none ${
                playback.isPlaying
                  ? "bg-[#D97706] hover:bg-[#B45309] dark:bg-[#E5B567] dark:hover:bg-[#D4A355] text-white dark:text-black font-extrabold"
                  : simSession.isSingleEngine
                  ? "bg-[#005FB8] hover:bg-[#004C99] dark:bg-[#007ACC] dark:hover:bg-[#0062A3]"
                  : "bg-[#7C3AED] hover:bg-[#6D28D9] dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED]"
              }`}
            >
              <span className="w-2.5 h-2.5 flex items-center justify-center shrink-0">
                {playback.isPlaying ? (
                  <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                    <rect x="5" y="4" width="4" height="16" rx="1" />
                    <rect x="15" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                    <path d="M5 3.868v16.264a1 1 0 001.555.832l13.012-8.132a1 1 0 000-1.664L6.555 3.036A1 1 0 005 3.868z" />
                  </svg>
                )}
              </span>
              <span className="tracking-wide">{playback.isPlaying ? "PAUSE" : "PLAY"}</span>
            </button>

            <button
              type="button"
              onClick={playback.handleStepForward}
              disabled={!playback.isSimulationReady || playback.currentCycle >= maxCycle}
              title="한 단계 실행 (Step Over / Forward)"
              className="p-1.5 rounded text-[#57606A] dark:text-[#CCCCCC] hover:text-[#24292F] dark:hover:text-white hover:bg-[#E5E7EB] dark:hover:bg-[#3A3A3A] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* 3-2. 바닥 밀착 5버튼 바텀바 (코드 + 뷰포트 3종 + 어시스턴트) */}
        <nav className="grid grid-cols-5 h-12 border-t border-[var(--ar-border)] bg-[var(--ar-header-bg)] font-sans">
          <button
            type="button"
            onClick={handleMobileCodeSelect}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors cursor-pointer ${
              isMobileCodeView
                ? simSession.isSingleEngine
                  ? "text-[#005FB8] dark:text-[#38BDF8] bg-[#005FB8]/8 dark:bg-[#007ACC]/15 font-bold"
                  : "text-[#7C3AED] dark:text-[#C084FC] bg-[#7C3AED]/8 dark:bg-[#8B5CF6]/15 font-bold"
                : "text-[#57606A] dark:text-[#858585]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span className="truncate">코드</span>
          </button>

          <button
            type="button"
onClick={() => handleMobileViewportSelect(0)}
className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors cursor-pointer ${
  !isMobileCodeView && !isMobileAssistantViewport && rightViewportIndex === 0
                ? simSession.isSingleEngine
                  ? "text-[#005FB8] dark:text-[#38BDF8] bg-[#005FB8]/8 dark:bg-[#007ACC]/15 font-bold"
                  : "text-[#7C3AED] dark:text-[#C084FC] bg-[#7C3AED]/8 dark:bg-[#8B5CF6]/15 font-bold"
                : "text-[#57606A] dark:text-[#858585]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="truncate">레지스터·메모리</span>
          </button>

          <button
            type="button"
onClick={() => handleMobileViewportSelect(1)}
className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors cursor-pointer ${
  !isMobileCodeView && !isMobileAssistantViewport && rightViewportIndex === 1
                ? simSession.isSingleEngine
                  ? "text-[#005FB8] dark:text-[#38BDF8] bg-[#005FB8]/8 dark:bg-[#007ACC]/15 font-bold"
                  : "text-[#7C3AED] dark:text-[#C084FC] bg-[#7C3AED]/8 dark:bg-[#8B5CF6]/15 font-bold"
                : "text-[#57606A] dark:text-[#858585]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="truncate">분석·지표</span>
          </button>

          <button
            type="button" onClick={() => handleMobileViewportSelect(2)}
className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors cursor-pointer ${
  !isMobileCodeView && !isMobileAssistantViewport && rightViewportIndex === 2
                ? simSession.isSingleEngine
                  ? "text-[#005FB8] dark:text-[#38BDF8] bg-[#005FB8]/8 dark:bg-[#007ACC]/15 font-bold"
                  : "text-[#7C3AED] dark:text-[#C084FC] bg-[#7C3AED]/8 dark:bg-[#8B5CF6]/15 font-bold"
                : "text-[#57606A] dark:text-[#858585]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="truncate">데이터패스</span>
          </button>

          <button
            type="button"
            onClick={handleMobileAssistantSelect}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors cursor-pointer ${
              !isMobileCodeView && isMobileAssistantViewport
                ? simSession.isSingleEngine
                  ? "text-[#005FB8] dark:text-[#38BDF8] bg-[#005FB8]/8 dark:bg-[#007ACC]/15 font-bold"
                  : "text-[#7C3AED] dark:text-[#C084FC] bg-[#7C3AED]/8 dark:bg-[#8B5CF6]/15 font-bold"
                : "text-[#57606A] dark:text-[#858585]"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
            <span className="truncate">어시스턴트</span>
          </button>
        </nav>
      </div>

      {/* 4. 모바일 전용 튜터 해설 모달 (코드 클릭 시 노출) */}
      {isMobileTutorModalOpen && simSession.simulationData && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-3 animate-in fade-in duration-150"
          onClick={() => setIsMobileTutorModalOpen(false)}
        >
          <div
            className="w-full max-h-[72vh] flex flex-col relative rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {renderPanel("tutor", () => setIsMobileTutorModalOpen(false))}
          </div>
        </div>
      )}

      {/* Play / Pause / Reset / Trash / Check 화면 중앙 애니메이션 피드백 */}
      <PlaybackFeedbackOverlay feedback={playback.playbackFeedback} />
    </main>
  );
};

export default MainPage;
