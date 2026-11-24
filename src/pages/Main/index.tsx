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
import { MobileWorkspaceControls } from "./components/MobileWorkspaceControls";

import type { PanelKey, SectionConfig } from "./types";
import { getDefaultSections } from "./types";
import { useResizableLayout } from "./hooks/useResizableLayout";
import { useSimulationPlayback } from "./hooks/useSimulationPlayback";
import { useSimulationSession } from "./hooks/useSimulationSession";
import { useFileManager } from "./hooks/useFileManager";
import { useWorkspaceSplitter } from "./hooks/useWorkspaceSplitter";
import { getLearningExample } from "@/data/learningExamples";

const DEFAULT_CUSTOM_ASSEMBLY = [
  "addi t0, zero, 5",
  "addi t1, zero, 10",
  "add  t2, t0, t1",
  "slli a0, t2, 2",
  "ret",
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
  const [tutorSelection,setTutorSelection]=useState<{kind:'c'|'asm';revision:number}>({kind:'asm',revision:0});
  const [editorTarget, setEditorTarget] = useState<"c" | "asm">("c");
  const [isAiPopupOpen, setIsAiPopupOpen] = useState(false);
  const [isMobileCodeView, setIsMobileCodeView] = useState(true);
  const [isMobileAssistantViewport, setIsMobileAssistantViewport] = useState(false);
  const [assistantHint, setAssistantHint] = useState<{ workspace: string; language: 'c' | 'asm' } | null>(null);
  const assistantHintTimerRef = useRef<number | null>(null);
  const aiPopupOpenRef = useRef(isAiPopupOpen);
  useEffect(() => { aiPopupOpenRef.current = isAiPopupOpen; }, [isAiPopupOpen]);
  const aiButtonRef = useRef<HTMLButtonElement>(null);

  const clearAssistantHint = useCallback(() => {
    if (assistantHintTimerRef.current !== null) {
      window.clearTimeout(assistantHintTimerRef.current);
      assistantHintTimerRef.current = null;
    }
    setAssistantHint(null);
  }, []);

  useEffect(() => {
    return () => {
      if (assistantHintTimerRef.current !== null) {
        window.clearTimeout(assistantHintTimerRef.current);
      }
    };
  }, []);

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
  const cWorkspaceKey = JSON.stringify([fileMgr.translationSource, auth.epoch]);
  const asmWorkspaceKey = JSON.stringify([customAssembly, auth.epoch]);
  const workspaceKey = editorTarget === "c" ? cWorkspaceKey : asmWorkspaceKey;

  const simSession = useSimulationSession({
    workspaceKey,
    editorTarget,
    cWorkspaceKey,
    asmWorkspaceKey,
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
    if (assistantHintTimerRef.current !== null) {
      window.clearTimeout(assistantHintTimerRef.current);
      assistantHintTimerRef.current = null;
    }
    // 컴파일 완료 3초 뒤에 힌트 팝업 표시
    assistantHintTimerRef.current = window.setTimeout(() => {
      if (!aiPopupOpenRef.current) {
        setAssistantHint({ workspace: workspaceKey, language: editorTarget });
      }
      assistantHintTimerRef.current = null;
    }, 3000);
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
    clearAssistantHint();
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
    if (line !== null || asmIndex !== null) {
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
      tutorSelection={tutorSelection}
      onTutorSelect={kind=>setTutorSelection(value=>({kind,revision:value.revision+1}))}
      simulationData={simSession.simulationData}
      currentData={playback.currentData}
      prevData={playback.prevData}
      currentCycle={playback.currentCycle}
      playSpeed={playback.playSpeed}
      onPausePlayback={playback.pauseForFlow}
      singlePlaybackFinished={playback.singlePlaybackFinished}
      playbackRevision={playback.playbackRevision}
      isPlaying={playback.isPlaying}
      isStandby={playback.isStandby}
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
      asmError={simSession.asmError}
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
        clearAssistantHint();
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
      onCustomAssemblyChange={(value) => {
        clearAssistantHint();
        simSession.clearSimulationCache();
        simSession.setAsmError("");
        setCustomAssembly(value);
      }}
      onSimulateAssembly={() => {
        clearAssistantHint();
        return simSession.handleAssemblySimulation(customAssembly, {
          onCompilationComplete,
          onSimulationComplete: playback.handleSimulationComplete,
          triggerPlaybackFeedback: playback.triggerPlaybackFeedback,
        });
      }}
      onResetCustomAssembly={() => {
        clearAssistantHint();
        playback.triggerPlaybackFeedback("trash");
        setCustomAssembly(DEFAULT_CUSTOM_ASSEMBLY);
        simSession.clearSimulationCache();
        simSession.setAsmError("");
        playback.setCurrentCycle(0);
        playback.setIsPlaying(false);
      }}
      onJumpToCycle={playback.handleJumpToCycle}
      savedFiles={fileMgr.savedFiles}
      isLoggedIn={fileMgr.isLoggedIn}
    />
  );

  const maxCycle = playback.totalCycles;

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
    clearAssistantHint();
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
            onPlayCurrentCycle={playback.handlePlayCurrentCycle}
            isCyclePlaying={playback.isCyclePlaying}
            onJumpToCycle={playback.handleJumpToCycle}
            onChangeSpeed={playback.setPlaySpeed}
            isReady={playback.isSimulationReady}
            isCompiling={fileMgr.translationBusy}
            mode={simSession.simulationEngineMode}
            simulationData={simSession.simulationData}
            editorTarget={editorTarget}
            onChangeEditorTarget={(target) => {
              if (fileMgr.translationBusy) return;
              clearAssistantHint();
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
          onClick={() => { clearAssistantHint(); setIsAiPopupOpen((prev) => !prev); }}
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
        {showAssistantHint && <AssistantCompileHint language={assistantHint.language} onDismiss={clearAssistantHint} onOpen={() => { clearAssistantHint(); setIsAiPopupOpen(true); }} />}
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
            style={{ "--left-top-h": `calc((100% - 6px) * ${leftTopHeightPercent / 100})` } as React.CSSProperties}
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
            style={{ flex: 1 }}
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

      {/* 3. 모바일 전용 하단 재생 콘솔 + 바닥 밀착 5버튼 바텀바 (md 미만 노출) */}
      <MobileWorkspaceControls
        currentCycle={playback.currentCycle}
        maxCycle={maxCycle}
        totalCycles={playback.totalCycles}
        playSpeed={playback.playSpeed}
        isPlaying={playback.isPlaying}
        isSimulationReady={playback.isSimulationReady}
        isSingleEngine={simSession.isSingleEngine}
        isMobileCodeView={isMobileCodeView}
        isMobileAssistantViewport={isMobileAssistantViewport}
        rightViewportIndex={rightViewportIndex}
        onJumpToCycle={playback.handleJumpToCycle}
        onChangeSpeed={playback.setPlaySpeed}
        onReset={playback.handleReset}
        onResetAndPlay={playback.handleResetAndPlay}
        onPlayCurrentCycle={playback.handlePlayCurrentCycle}
        isCyclePlaying={playback.isCyclePlaying}
        onStepBack={playback.handleStepBack}
        onTogglePlay={playback.handleTogglePlay}
        onStepForward={playback.handleStepForward}
        onSelectCode={handleMobileCodeSelect}
        onSelectViewport={handleMobileViewportSelect}
        onSelectAssistant={handleMobileAssistantSelect}
      />

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
