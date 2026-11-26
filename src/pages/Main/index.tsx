import { useAssistantCode } from './hooks/useAssistantCode';
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
import TutorialOverlay from "./components/TutorialOverlay";
import {
  shouldAutoOpenTutorial,
  TUTORIAL_DEMO_ACTIVE_ROW,
  TUTORIAL_DEMO_SOURCE,
  TUTORIAL_DEMO_ASSEMBLY,
  TUTORIAL_DEMO_CURRENT_DATA,
  TUTORIAL_DEMO_CYCLE,
  TUTORIAL_DEMO_MAPPED_ROWS,
  TUTORIAL_DEMO_PREV_DATA,
  TUTORIAL_DEMO_SIMULATION,
} from "./utils/tutorialDemoData";

import type { PanelKey, SectionConfig } from "./types";
import {
  getDefaultSections,
  isMobileViewport,
  useIsMobileViewport,
} from "./types";
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
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(() =>
    shouldAutoOpenTutorial()
  );
  const [isMobileCodeView, setIsMobileCodeView] = useState(true);
  const [isMobileAssistantViewport, setIsMobileAssistantViewport] = useState(false);

  const handleOpenTutorial = useCallback(() => {
    setRightViewportIndex(0);
    setIsMobileCodeView(true);
    setIsMobileAssistantViewport(false);
    setIsMobileTutorModalOpen(false);
    setIsTutorialOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener("ar-open-tutorial", handleOpenTutorial);
    return () => window.removeEventListener("ar-open-tutorial", handleOpenTutorial);
  }, [handleOpenTutorial]);
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

  const isMobile = useIsMobileViewport();

  useEffect(() => {
    if (!isMobile) {
      setIsMobileAssistantViewport(false);
    }
  }, [isMobile]);

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

  // 싱글 모드와 파이프라인 모드별 독립된 라인 선택 상태 캐시
  type ModeSelection = { line: number | null; asmIndex: number | null };
  const [modeSelections, setModeSelections] = useState<
    Record<"single" | "pipeline", ModeSelection>
  >({
    single: { line: null, asmIndex: null },
    pipeline: { line: null, asmIndex: null },
  });

  const currentSelection = modeSelections[simSession.simulationEngineMode];
  const translationSelectedLine = currentSelection.line;
  const translationSelectedAsmIndex = currentSelection.asmIndex;

  const showAssistantHint = assistantHint?.workspace === workspaceKey && !isAiPopupOpen && !fileMgr.translationBusy;
  const onCompilationComplete = () => {
    setModeSelections({
      single: { line: null, asmIndex: null },
      pipeline: { line: null, asmIndex: null },
    });
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
    setModeSelections((prev) => ({
      ...prev,
      [simSession.simulationEngineMode]: { line: null, asmIndex: null },
    }));
    setIsMobileTutorModalOpen(false);
  }, [simSession.simulationEngineMode]);

  // 5. 시뮬레이션 재생 및 스텝 컨트롤 훅
  const playback = useSimulationPlayback({
    simulationData: simSession.simulationData,
    mappedAssemblyRows: simSession.mappedAssemblyRows,
    isSingleEngine: simSession.isSingleEngine,
    rightViewportIndex,
    editorTarget,
    translationSelectedLine,
    onClearSelection: handleClearSelection,
  });

  const onResetSimulation = () => {
    clearAssistantHint();
    simSession.clearSimulationCache();
    setModeSelections({
      single: { line: null, asmIndex: null },
      pipeline: { line: null, asmIndex: null },
    });
    playback.handleResetAll();
  };

  useEffect(() => {
    resetSimulationRef.current = onResetSimulation;
  });

  const assistantCode = useAssistantCode(
    { c: fileMgr.translationSource, asm: customAssembly },
    JSON.stringify([auth.epoch, fileMgr.fileId, fileMgr.cFileName, fileMgr.asmFileName]),
    editorTarget,
    fileMgr.translationBusy,
    program => {
      setSourceSelection(null);
      handleClearSelection();
      setEditorTarget(program.language);
      if (program.language === 'c') {
        fileMgr.updateTranslationSource(program.source, fileMgr.cFileName, true, null, onResetSimulation);
      } else {
        setCustomAssembly(program.source);
        fileMgr.setFileId(null);
        simSession.setAsmError('');
        onResetSimulation();
      }
    },
    JSON.stringify([auth.epoch, null, fileMgr.cFileName, fileMgr.asmFileName]),
  );

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
    setModeSelections((prev) => ({
      ...prev,
      [simSession.simulationEngineMode]: { line, asmIndex },
    }));
    if ((line !== null || asmIndex !== null) && openTutorModal && simSession.simulationData) {
      if (isMobileViewport()) {
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

  // 튜토리얼이 열려 있거나 demo 미리보기 모드이고 아직 컴파일된 시뮬레이션이 없을 때 저장해 둔 기준 사이클 스냅샷을 표시
  const useTutorialDemo =
    (isTutorialOpen || searchParams.get("demo") === "1") &&
    !simSession.simulationData;
  const activeSimData = useTutorialDemo
    ? TUTORIAL_DEMO_SIMULATION
    : simSession.simulationData;
  const activeCurrentData = useTutorialDemo
    ? TUTORIAL_DEMO_CURRENT_DATA
    : playback.currentData;
  const activePrevData = useTutorialDemo
    ? TUTORIAL_DEMO_PREV_DATA
    : playback.prevData;
  const activeCurrentCycle = useTutorialDemo
    ? TUTORIAL_DEMO_CYCLE
    : playback.currentCycle;
  const activeTotalCycles = useTutorialDemo
    ? TUTORIAL_DEMO_SIMULATION.history.length
    : playback.totalCycles;
  const activeSimMode = simSession.simulationEngineMode;
  const activeIsSingle = simSession.isSingleEngine;
  const activeMappedRows = useTutorialDemo
    ? TUTORIAL_DEMO_MAPPED_ROWS
    : simSession.mappedAssemblyRows;
  const activeAssembly = useTutorialDemo
    ? TUTORIAL_DEMO_ASSEMBLY
    : fileMgr.translationAssembly;
  const activeRow = useTutorialDemo
    ? TUTORIAL_DEMO_ACTIVE_ROW
    : playback.currentActiveRow;
  const activeExecCLine = useTutorialDemo
    ? TUTORIAL_DEMO_ACTIVE_ROW.sourceLine ?? 1
    : playback.activeExecutionCLine;

  const renderPanel = (panelKey: PanelKey, onCloseTutor?: () => void) => (
    <PanelRenderer
      panelKey={panelKey}
      onCloseTutor={onCloseTutor}
      onSourceSelection={setSourceSelection}
      tutorSelection={tutorSelection}
      onTutorSelect={kind=>setTutorSelection(value=>({kind,revision:value.revision+1}))}
      simulationData={activeSimData}
      currentData={activeCurrentData}
      prevData={activePrevData}
      currentCycle={activeCurrentCycle}
      playSpeed={playback.playSpeed}
      onPausePlayback={playback.pauseForFlow}
      singlePlaybackFinished={playback.singlePlaybackFinished}
      playbackRevision={playback.playbackRevision}
      isPlaying={playback.isPlaying}
      playMode={playback.playMode}
      isStandby={useTutorialDemo ? false : playback.isStandby}
      loadingMessage={simSession.loadingMessage}
      simulationMode={activeSimMode}
      isSingleEngine={activeIsSingle}
      currentActiveRow={activeRow}
      mappedAssemblyRows={activeMappedRows}
      activeExecutionCLine={activeExecCLine}
      effectiveSelectedLine={playback.effectiveSelectedLine}
      translationSource={useTutorialDemo ? TUTORIAL_DEMO_SOURCE : fileMgr.translationSource}
      translationAssembly={activeAssembly}
      cFileName={useTutorialDemo ? "tutorial.c" : fileMgr.cFileName}
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
      onStepBack={playback.handleStepBack}
      onStepForward={playback.handleStepForward}
      onJumpToCycle={playback.handleJumpToCycle}
      savedFiles={fileMgr.savedFiles}
      isLoggedIn={fileMgr.isLoggedIn}
    />
  );

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
      className={`flex-1 flex flex-col ${
        isMobile ? "px-0 pb-0 pt-2" : "px-4 pb-3 pt-2.5"
      } w-full h-full min-h-0 overflow-hidden relative transition-colors duration-500 ${
        playback.isPlaying
          ? simSession.isSingleEngine
            ? "is-playing-single-light"
            : "is-playing-pipeline-light"
          : ""
      }`}
    >
      {/* 1. 최상단 제어 바 */}
      <div
        className={`h-[42px] shrink-0 flex items-stretch gap-2 mb-2 ${
          isMobile ? "px-3" : "px-0"
        } min-h-0 w-full`}
      >
        <div className="flex-1 h-full min-w-0 flex">
          <ControlPanel
            currentCycle={activeCurrentCycle}
            totalCycles={activeTotalCycles}
            isPlaying={playback.isPlaying}
            playSpeed={playback.playSpeed}
            onStepBack={playback.handleStepBack}
            onStepForward={playback.handleStepForward}
            onTogglePlay={playback.handleTogglePlay}
            onReset={playback.handleReset}
            onResetAndPlay={playback.handleResetAndPlay}
            onPlayCurrentCycle={playback.handlePlayCurrentCycle}
            isCyclePlaying={playback.isCyclePlaying}
            isAtTimelineEnd={playback.isAtTimelineEnd}
            onJumpToCycle={playback.handleJumpToCycle}
            onChangeSpeed={playback.setPlaySpeed}
            rightViewportIndex={rightViewportIndex}
            isReady={useTutorialDemo ? true : playback.isSimulationReady}
            isCompiling={fileMgr.translationBusy}
            mode={activeSimMode}
            simulationData={activeSimData}
            editorTarget={editorTarget}
            onChangeEditorTarget={(target) => {
              if (fileMgr.translationBusy) return;
              clearAssistantHint();
              setSourceSelection(null);
              setEditorTarget(target);
              if (target === "asm") {
                setModeSelections({
                  single: { line: null, asmIndex: null },
                  pipeline: { line: null, asmIndex: null },
                });
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

        {/* AI 어시스턴트 팝업 버튼 (모바일에서는 하단 바텀바로 분리) */}
        <div
          data-tutorial-id="ai-assistant"
          className={`${
            isMobile ? "hidden" : "block"
          } relative h-full aspect-square shrink-0`}
        >
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
        codeEditor={assistantCode}
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

      {/* 2. 메인 워크스페이스 분할 레이아웃 (모바일: 탭별 100% 풀화면 전환 / 데스크톱: 좌우 고정 분할) */}
      <div
        ref={mainWorkspaceRef}
        className={`flex-1 flex ${
          isMobile ? "flex-col px-3 pb-2" : "flex-row px-0 pb-0"
        } w-full min-h-0 overflow-hidden items-stretch ${
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
          className={`${
            isMobile
              ? "hidden"
              : "flex flex-none w-[var(--left-pane-w)] pr-1.5"
          } flex-col h-full min-h-0 overflow-hidden`}
          style={{ "--left-pane-w": `${leftPaneWidth}%` } as React.CSSProperties}
        >
          {/* 상단: C 소스 + ASM */}
          <div
            className="flex flex-col w-full flex-none h-[var(--left-top-h)] min-h-0 overflow-hidden"
            style={{ "--left-top-h": `calc((100% - 6px) * ${leftTopHeightPercent / 100})` } as React.CSSProperties}
          >
            <div
              ref={leftTopContainerRef}
              className="flex-1 flex flex-row gap-0 w-full min-h-0 overflow-hidden"
            >
              <div
                className="flex flex-col w-[var(--c-col-w)] flex-none h-full min-h-0 overflow-hidden p-[1.5px]"
                style={{ "--c-col-w": `${leftCodeColRatio}%` } as React.CSSProperties}
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
                className="flex w-2.5 -mx-0.5 relative items-center justify-center cursor-col-resize group shrink-0 z-20 hover:bg-[var(--ar-accent)]/10 rounded-sm transition-colors"
              >
                <div
                  className={`w-[3px] rounded-full transition-all duration-200 ${
                    resizingLeftCodeCol
                      ? "h-24 bg-[var(--ar-accent)] shadow-sm"
                      : "h-10 bg-[#D0D7DE] group-hover:h-20 group-hover:bg-[var(--ar-accent)]"
                  }`}
                />
              </div>

              <div
                className="flex flex-col w-full flex-1 h-full min-h-0 overflow-hidden p-[1.5px]"
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
            className="flex h-2.5 -my-0.5 relative items-center justify-center cursor-row-resize group shrink-0 z-20 hover:bg-[var(--ar-accent)]/10 rounded-sm transition-colors"
          >
            <div
              className={`h-[3px] rounded-full transition-all duration-200 ${
                resizingLeftVertical
                  ? "w-28 bg-[var(--ar-accent)] shadow-sm"
                  : "w-12 bg-[#D0D7DE] group-hover:w-24 group-hover:bg-[var(--ar-accent)]"
              }`}
            />
          </div>

          {/* 하단: 튜터 영역 */}
          <div
            data-tutorial-id="tutor-panel"
            className="flex w-full min-h-0 overflow-hidden flex-col p-[1.5px]"
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
          className={`${
            isMobile ? "hidden" : "flex"
          } w-2.5 relative items-center justify-center cursor-col-resize group shrink-0 z-30 hover:bg-[var(--ar-accent)]/10 rounded-md transition-colors`}
        >
          <div
            className={`w-[4px] rounded-full transition-all duration-200 ${
              resizingLeftPane
                ? "h-36 bg-[var(--ar-accent)] shadow-md ring-2 ring-[var(--ar-accent)]/30"
                : "h-16 bg-[#D0D7DE] group-hover:h-28 group-hover:bg-[var(--ar-accent)]"
            }`}
          />
        </div>

        {/* 슬라이딩 뷰포트 영역 (모바일: 5개 탭 전체 슬라이드 트랙 / 데스크톱: 우측 3개 뷰포트 트랙) */}
        <div
          data-tutorial-id="right-section"
          className={`flex w-full flex-1 h-full min-w-0 min-h-0 overflow-hidden relative items-stretch ${
            isMobile ? "" : "pl-1"
          }`}
        >
          {canGoPrevViewport && (
            <div
              className={`${
                isMobile ? "hidden" : "flex"
              } w-5 shrink-0 items-stretch select-none animate-in fade-in duration-200 mr-1`}
            >
              <button
                type="button"
                onClick={handleGoPrevViewport}
                title="이전 뷰포트(왼쪽 영역)로 이동"
                className={`w-full h-full rounded-md border-0 bg-transparent flex flex-col items-center justify-center gap-2.5 transition-all duration-150 cursor-pointer group active:scale-[0.98] ${
                  simSession.isSingleEngine
                    ? "text-[#8C959F] hover:text-[#005FB8] hover:bg-[#005FB8]/10"
                    : "text-[#8C959F] hover:text-purple-600 hover:bg-purple-500/10"
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
                codeEditor={assistantCode}
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
            <div
              data-tutorial-id="viewport-nav"
              className={`${
                isMobile ? "hidden" : "flex"
              } w-5 shrink-0 items-stretch select-none animate-in fade-in duration-200 ml-1`}
            >
              <button
                type="button"
                onClick={handleGoNextViewport}
                title="다음 뷰포트(오른쪽 영역)로 이동"
                className={`w-full h-full rounded-md border-0 bg-transparent flex flex-col items-center justify-center gap-2.5 transition-all duration-150 cursor-pointer group active:scale-[0.98] ${
                  simSession.isSingleEngine
                    ? "text-[#8C959F] hover:text-[#005FB8] hover:bg-[#005FB8]/10"
                    : "text-[#8C959F] hover:text-purple-600 hover:bg-purple-500/10"
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
        currentCycle={activeCurrentCycle}
        maxCycle={activeTotalCycles}
        totalCycles={activeTotalCycles}
        playSpeed={playback.playSpeed}
        isPlaying={playback.isPlaying}
        isSimulationReady={useTutorialDemo ? true : playback.isSimulationReady}
        isSingleEngine={activeIsSingle}
        isMobileCodeView={isMobileCodeView}
        isMobileAssistantViewport={isMobileAssistantViewport}
        rightViewportIndex={rightViewportIndex}
        onJumpToCycle={playback.handleJumpToCycle}
        onChangeSpeed={playback.setPlaySpeed}
        onReset={playback.handleReset}
        onResetAndPlay={playback.handleResetAndPlay}
        onPlayCurrentCycle={playback.handlePlayCurrentCycle}
        isCyclePlaying={playback.isCyclePlaying}
        isAtTimelineEnd={playback.isAtTimelineEnd}
        onStepBack={playback.handleStepBack}
        onTogglePlay={playback.handleTogglePlay}
        onStepForward={playback.handleStepForward}
        onSelectCode={handleMobileCodeSelect}
        onSelectViewport={handleMobileViewportSelect}
        onSelectAssistant={handleMobileAssistantSelect}
        onOpenTutorial={handleOpenTutorial}
      />

      {/* 4. 모바일 전용 튜터 해설 모달 (코드 클릭 시 또는 모바일 튜토리얼 9단계 노출) */}
      {isMobile && isMobileTutorModalOpen && activeSimData && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-3 animate-in fade-in duration-150"
          onClick={() => setIsMobileTutorModalOpen(false)}
        >
          <div
            data-tutorial-id="tutor-panel"
            className="w-full max-h-[72dvh] flex flex-col relative rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {renderPanel("tutor", () => setIsMobileTutorModalOpen(false))}
          </div>
        </div>
      )}

      {/* Play / Pause / Reset / Trash / Check 화면 중앙 애니메이션 피드백 */}
      <PlaybackFeedbackOverlay feedback={playback.playbackFeedback} />

      {/* 반투명 전체 튜토리얼 가이드 오버레이 */}
      <TutorialOverlay
        isOpen={isTutorialOpen}
        onClose={() => {
          setIsTutorialOpen(false);
          setIsMobileTutorModalOpen(false);
          setIsMobileAssistantViewport(false);
          setIsMobileCodeView(true);
          setRightViewportIndex(0);
        }}
        onChangeViewport={(idx, mobileMode) => {
          setRightViewportIndex(idx);
          if (mobileMode === "code") {
            setIsMobileCodeView(true);
            setIsMobileAssistantViewport(false);
            setIsMobileTutorModalOpen(false);
          } else if (mobileMode === "viewport") {
            setIsMobileCodeView(false);
            setIsMobileAssistantViewport(false);
            setIsMobileTutorModalOpen(false);
          } else if (mobileMode === "tutor") {
            setIsMobileCodeView(true);
            setIsMobileAssistantViewport(false);
            if (isMobileViewport()) {
              setIsMobileTutorModalOpen(true);
            }
          } else if (mobileMode === "assistant") {
            setIsMobileTutorModalOpen(false);
            if (isMobileViewport()) {
              setIsMobileCodeView(false);
              setIsMobileAssistantViewport(true);
            }
          }
        }}
      />
    </main>
  );
};

export default MainPage;
