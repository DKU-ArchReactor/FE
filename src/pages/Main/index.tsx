import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import ControlPanel from "./components/ControlPanel";
import FlyoutPanel from "./components/FlyoutPanel";
import PanelRenderer from "./components/PanelRenderer";
import SlidingViewportTrack from "./components/SlidingViewportTrack";
import AiAssistantPopup from "@/components/AiAssistantPopup";

import type { SimulationResult } from "@/type/simulation";
import type { CodeLineSelectInfo } from "./components/Source/SourceViewer";
import type { PanelKey, SectionConfig } from "./types";
import { getDefaultSections } from "./types";
import { useResizableLayout } from "./hooks/useResizableLayout";
import { useSimulationPlayback } from "./hooks/useSimulationPlayback";
import { useFileManager } from "./hooks/useFileManager";
import { useWorkspaceSplitter } from "./hooks/useWorkspaceSplitter";
import {
  compileTranslation,
  compileAssemblyDirectly,
  mapAssembly,
  extractAssemblyFromSimulation,
} from "./components/translationCompile";
import { runSimulation } from "@/api/simulation";

const MainPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initialFileId =
    searchParams.get("fileId") ||
    (location.state as { fileId?: string } | null)?.fileId ||
    null;

  // 1. 라우트 및 뷰포트 상태
  const isManagementPath =
    location.pathname === "/management" || location.pathname === "/coming-soon";
  const isPipelinePath = location.pathname === "/pipeline";

  const rightViewportIndex = useMemo(() => {
    if (isManagementPath) return 2;
    if (isPipelinePath) return 1;
    return 0;
  }, [isManagementPath, isPipelinePath]);

  // 2. 파일 및 소스 코드 상태 훅
  const fileMgr = useFileManager(initialFileId);

  // 3. UI 및 작성 타겟 제어 ("c" vs "asm")
  const [editorTarget, setEditorTarget] = useState<"c" | "asm">("c");
  const [isAiPopupOpen, setIsAiPopupOpen] = useState(false);
  const aiButtonRef = useRef<HTMLButtonElement>(null);

  const [translationSelectedLine, setTranslationSelectedLine] = useState<number | null>(null);
  const [translationSelectedAsmIndex, setTranslationSelectedAsmIndex] = useState<number | null>(null);

  const [customAssembly, setCustomAssembly] = useState<string>(() => {
    return [
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
  });

  // 4. 시뮬레이션 상태 및 엔진 모드 ("single" | "pipeline")
  const [simulationCache, setSimulationCache] = useState<{
    single: SimulationResult | null;
    pipeline: SimulationResult | null;
  }>({ single: null, pipeline: null });

  const [simulationEngineMode, setSimulationEngineMode] = useState<"single" | "pipeline">("single");
  const simulationData = simulationCache[simulationEngineMode];
  const loadingMessage = null;
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [activeSimulationToken, setActiveSimulationToken] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("mode-single", "mode-pipeline");
    root.classList.add(`mode-${simulationEngineMode}`);
  }, [simulationEngineMode]);

  const isSingleEngine = simulationEngineMode === "single";

  // 어셈블리 행 파싱: 백엔드가 시뮬레이션 로그에 직접 주입한 source_line 매핑을 단일 진실 원천으로 사용
  const mappedAssemblyRows = useMemo(() => {
    const fromSim = extractAssemblyFromSimulation(simulationData);
    if (fromSim.length > 0) return fromSim;
    if (!fileMgr.translationAssembly) return [];
    return mapAssembly(fileMgr.translationAssembly, 1000);
  }, [simulationData, fileMgr.translationAssembly]);

  // 5. 시뮬레이션 재생 및 스텝 컨트롤 훅
  const playback = useSimulationPlayback({
    simulationData,
    mappedAssemblyRows,
    isSingleEngine,
    editorTarget,
    translationSelectedLine,
    onClearSelection: () => {
      setTranslationSelectedLine(null);
      setTranslationSelectedAsmIndex(null);
    },
  });

  const onResetSimulation = () => {
    setSimulationCache({ single: null, pipeline: null });
    playback.setCurrentCycle(0);
    playback.setIsPlaying(false);
    playback.triggerPlaybackFeedback("reset");
  };

  // 6. 분할 레이아웃 & 스플리터 훅
  const [sections, setSections] = useState<SectionConfig[]>(getDefaultSections);
  const splitter = useWorkspaceSplitter();
  const {
    containerRef,
    resizingSplitterIndex,
    resizingRowSlot,
    resizingPair,
    handleSlotResizeStart,
    handlePairResizeStart,
    handlePairReset,
    handleSlotReset,
  } = useResizableLayout(sections, setSections);

  // 7. 컴파일 및 시뮬레이션 실행 핸들러
  const handleTranslationCompile = async () => {
    if (!fileMgr.translationSource.trim() || fileMgr.translationBusy) return;
    fileMgr.setTranslationBusy(true);
    fileMgr.setTranslationError("");
    fileMgr.setAsmContent("");
    try {
      const {
        assembly,
        simulationResult,
        singleSimulationResult,
        pipelineSimulationResult,
        buildId,
        simulationToken,
      } = await compileTranslation(fileMgr.translationSource, simulationEngineMode);

      fileMgr.setTranslationAssembly(assembly);
      fileMgr.setAsmContent(assembly);
      fileMgr.setAsmFileName("assembly.s");
      setActiveBuildId(buildId ?? null);
      setActiveSimulationToken(simulationToken ?? null);

      setSimulationCache({
        single: singleSimulationResult ?? (simulationEngineMode === "single" ? simulationResult : null),
        pipeline: pipelineSimulationResult ?? (simulationEngineMode === "pipeline" ? simulationResult : null),
      });

      if (simulationResult) {
        playback.handleSimulationComplete(simulationResult);
        playback.triggerPlaybackFeedback("check");
      }
    } catch (error) {
      fileMgr.setTranslationError(error instanceof Error ? error.message : "컴파일에 실패했습니다.");
    } finally {
      fileMgr.setTranslationBusy(false);
    }
  };

  const handleAssemblySimulation = async () => {
    const codeToSimulate = customAssembly;
    if (!codeToSimulate.trim() || fileMgr.translationBusy) return;

    fileMgr.setTranslationBusy(true);
    fileMgr.setTranslationError("");
    fileMgr.setAsmContent(codeToSimulate);
    fileMgr.setTranslationAssembly(codeToSimulate);

    try {
      const {
        assembly,
        simulationResult,
        singleSimulationResult,
        pipelineSimulationResult,
        buildId,
        simulationToken,
      } = await compileAssemblyDirectly(codeToSimulate, simulationEngineMode);

      fileMgr.setTranslationAssembly(assembly);
      fileMgr.setAsmContent(assembly);
      setActiveBuildId(buildId ?? null);
      setActiveSimulationToken(simulationToken ?? null);

      setSimulationCache({
        single: singleSimulationResult ?? (simulationEngineMode === "single" ? simulationResult : null),
        pipeline: pipelineSimulationResult ?? (simulationEngineMode === "pipeline" ? simulationResult : null),
      });

      if (simulationResult) {
        playback.handleSimulationComplete(simulationResult);
        playback.triggerPlaybackFeedback("check");
      }
    } catch (err: any) {
      console.error("Assembly simulation error:", err);
      fileMgr.setTranslationError(err?.message || "어셈블리 시뮬레이션 요청에 실패했습니다.");
    } finally {
      fileMgr.setTranslationBusy(false);
    }
  };

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

  // 모드 전환 시 즉시 캐시 스위칭 (0ms 딜레이)
  const handleSimulationModeChange = async (m: "single" | "pipeline") => {
    if (playback.isPlaying || playback.currentCycle > 0) {
      playback.triggerPlaybackFeedback("reset");
    }
    setSimulationEngineMode(m);
    const cachedResult = simulationCache[m];
    if (cachedResult) {
      playback.handleSimulationComplete(cachedResult);
      return;
    }

    // 캐시가 아직 비어있을 때만 폴백 네트워크 호출
    if (activeBuildId || activeSimulationToken) {
      try {
        const targetToken = activeBuildId
          ? { build_id: activeBuildId }
          : { simulation_token: activeSimulationToken! };
        const simResult = await runSimulation({
          ...targetToken,
          mode: m,
          max_cycles: 2000,
        });
        if (simResult) {
          setSimulationCache((prev) => ({ ...prev, [m]: simResult }));
          playback.handleSimulationComplete(simResult);
        }
      } catch (simErr) {
        console.warn("시뮬레이션 모드 전환 재실행 오류:", simErr);
      }
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

  // 9. 플라이아웃(말풍선) 패널 상태
  const [activeFlyout, setActiveFlyout] = useState<PanelKey | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-bookmark-tab]")) {
          setActiveFlyout(null);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [selectedCodeLine, setSelectedCodeLine] = useState<CodeLineSelectInfo | null>(null);

  const renderPanel = (panelKey: PanelKey) => (
    <PanelRenderer
      panelKey={panelKey}
      simulationData={simulationData}
      currentData={playback.currentData}
      prevData={playback.prevData}
      currentCycle={playback.currentCycle}
      activeCycleIndex={playback.activeCycleIndex}
      playSpeed={playback.playSpeed}
      loadingMessage={loadingMessage}
      simulationMode={simulationEngineMode}
      isSingleEngine={isSingleEngine}
      currentActiveRow={playback.currentActiveRow}
      mappedAssemblyRows={mappedAssemblyRows}
      activeExecutionCLine={playback.activeExecutionCLine}
      effectiveSelectedLine={playback.effectiveSelectedLine}
      isActuallyExecuting={true}
      translationSource={fileMgr.translationSource}
      translationAssembly={fileMgr.translationAssembly}
      cContent={fileMgr.cContent}
      asmContent={fileMgr.asmContent}
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
            setSimulationCache({ single: null, pipeline: null });
            playback.setCurrentCycle(0);
            playback.setIsPlaying(false);
          }
        );
      }}
      onTranslationCompile={handleTranslationCompile}
      onTranslationFile={handleTranslationFile}
      onSelectTranslationLine={handleSelectTranslationLine}
      onSaveTranslationFile={fileMgr.handleSaveTranslationFile}
      onOpenSavedFileInEditor={(id) => fileMgr.handleOpenSavedFileInEditor(id, onResetSimulation)}
      onCustomAssemblyChange={setCustomAssembly}
      onSimulateAssembly={handleAssemblySimulation}
      onResetCustomAssembly={() => {
        playback.triggerPlaybackFeedback("trash");
        setCustomAssembly(
          [
            "# RISC-V 32IM 어셈블리 직접 작성",
            ".globl main",
            "main:",
            "    addi x1, x0, 5",
            "    addi x2, x0, 10",
            "    add  x3, x1, x2",
            "    slli x4, x3, 2",
            "    ret",
            "",
          ].join("\n")
        );
        setSimulationCache({ single: null, pipeline: null });
        playback.setCurrentCycle(0);
        playback.setIsPlaying(false);
      }}
      onJumpToCycle={playback.handleJumpToCycle}
      savedFiles={fileMgr.savedFiles}
      isLoggedIn={fileMgr.isLoggedIn}
      ensureFileContent={fileMgr.ensureFileContent}
      fileContentCache={fileMgr.fileContentCache}
      loadingPreviewId={fileMgr.loadingPreviewId}
      selectedCodeLine={selectedCodeLine}
      onClearSelectedCodeLine={() => setSelectedCodeLine(null)}
    />
  );

  return (
    <main
      className={`flex-1 flex flex-col px-4 pb-3 pt-2.5 w-full h-full min-h-0 overflow-hidden relative transition-colors duration-500 ${
        playback.isPlaying && isSingleEngine ? "is-playing-single-light" : ""
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
            mode={simulationEngineMode}
            editorTarget={editorTarget}
            onChangeEditorTarget={(target) => {
              if (editorTarget !== target && (playback.isPlaying || playback.currentCycle > 0)) {
                playback.triggerPlaybackFeedback("reset");
              }
              setEditorTarget(target);
              if (target === "asm") {
                setTranslationSelectedLine(null);
                setTranslationSelectedAsmIndex(null);
              }
            }}
            onChangeSimulationMode={handleSimulationModeChange}
          />
        </div>

        {/* AI 어시스턴트 팝업 버튼 */}
        <button
          ref={aiButtonRef}
          type="button"
          onClick={() => setIsAiPopupOpen((prev) => !prev)}
          title={isAiPopupOpen ? "AI 어시스턴트 창 닫기" : "ArchReactor AI 어시스턴트 열기"}
          className={`h-full aspect-square rounded-md border flex items-center justify-center cursor-pointer transition-all duration-200 shrink-0 select-none shadow-sm group ${
            isAiPopupOpen
              ? "bg-gradient-to-br from-blue-700 via-sky-600 to-cyan-500 border-sky-400/60 ring-2 ring-sky-400/50 scale-95"
              : "bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-400 border-sky-300/40 hover:from-blue-700 hover:via-sky-600 hover:to-cyan-500 hover:shadow-md hover:shadow-sky-500/30 active:scale-95"
          }`}
        >
          <div className="relative flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white transition-transform duration-200 group-hover:scale-110 drop-shadow-xs"
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
        isOpen={isAiPopupOpen}
        onClose={() => setIsAiPopupOpen(false)}
        anchorRef={aiButtonRef}
      />

      {/* 2. 메인 워크스페이스 분할 레이아웃 */}
      <div
        ref={splitter.mainWorkspaceRef}
        className={`flex-1 flex w-full min-h-0 overflow-hidden items-stretch ${
          splitter.resizingLeftPane ||
          resizingSplitterIndex !== null ||
          splitter.resizingLeftVertical ||
          splitter.resizingLeftCodeCol
            ? "select-none"
            : ""
        }`}
      >
        {/* 좌측 고정 패널: 상단(C/ASM 에디터) + 하단(튜터) */}
        <div
          ref={splitter.leftPaneContainerRef}
          className="flex flex-col h-full min-h-0 overflow-hidden pr-1"
          style={{ width: `${splitter.leftPaneWidth}%` }}
        >
          {/* 상단: C 소스 + ASM 가로 분할 */}
          <div
            className="flex flex-col w-full min-h-0 overflow-hidden"
            style={{ height: `${splitter.leftTopHeightPercent}%` }}
          >
            <div
              ref={splitter.leftTopContainerRef}
              className="flex-1 flex w-full min-h-0 overflow-hidden"
            >
              <div
                className="flex flex-col h-full min-h-0 overflow-hidden p-[1.5px]"
                style={{ width: `${splitter.leftCodeColRatio}%` }}
              >
                {renderPanel("cSource")}
              </div>

              {/* C 소스와 ASM 사이 분할 스플리터 */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.detail === 2) {
                    splitter.setLeftCodeColRatio(50);
                    return;
                  }
                  splitter.setResizingLeftCodeCol(true);
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  splitter.setLeftCodeColRatio(50);
                }}
                title="드래그하여 C 코드와 ASM 영역 너비 조절 (더블클릭: 50:50 리셋)"
                className="w-2.5 -mx-0.5 relative flex items-center justify-center cursor-col-resize group shrink-0 z-20 hover:bg-[#005FB8]/10 dark:hover:bg-[#007ACC]/20 rounded-sm transition-colors"
              >
                <div
                  className={`w-[3px] rounded-full transition-all duration-200 ${
                    splitter.resizingLeftCodeCol
                      ? "h-24 bg-[#005FB8] dark:bg-[#007ACC] shadow-sm"
                      : "h-10 bg-[#D0D7DE] dark:bg-[#3E3E42] group-hover:h-20 group-hover:bg-[#005FB8] dark:group-hover:bg-[#007ACC]"
                  }`}
                />
              </div>

              <div
                className="flex flex-col h-full min-h-0 overflow-hidden p-[1.5px]"
                style={{ width: `${100 - splitter.leftCodeColRatio}%` }}
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
                splitter.setLeftTopHeightPercent(56);
                return;
              }
              splitter.setResizingLeftVertical(true);
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              splitter.setLeftTopHeightPercent(56);
            }}
            title="위아래로 드래그하여 코드 영역과 튜터 높이 비율 조절 (더블클릭: 56:44 기본 리셋)"
            className="h-2.5 -my-0.5 relative flex items-center justify-center cursor-row-resize group shrink-0 z-20 hover:bg-[#005FB8]/10 dark:hover:bg-[#007ACC]/20 rounded-sm transition-colors"
          >
            <div
              className={`h-[3px] rounded-full transition-all duration-200 ${
                splitter.resizingLeftVertical
                  ? "w-28 bg-[#005FB8] dark:bg-[#007ACC] shadow-sm"
                  : "w-12 bg-[#D0D7DE] dark:bg-[#3E3E42] group-hover:w-24 group-hover:bg-[#005FB8] dark:group-hover:bg-[#007ACC]"
              }`}
            />
          </div>

          {/* 하단: 튜터 영역 */}
          <div
            className="w-full min-h-0 overflow-hidden flex flex-col p-[1.5px]"
            style={{ height: `${100 - splitter.leftTopHeightPercent}%` }}
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
              splitter.setLeftPaneWidth(50);
              return;
            }
            splitter.handleMainDividerResizeStart(e);
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            splitter.setLeftPaneWidth(50);
          }}
          title="드래그하여 좌측 에디터 영역과 우측 뷰포트 너비 조절 (더블클릭: 50:50 기본 리셋)"
          className="w-3 -mx-0.5 relative flex items-center justify-center cursor-col-resize group shrink-0 z-30 hover:bg-[#005FB8]/10 dark:hover:bg-[#007ACC]/20 rounded-md transition-colors"
        >
          <div
            className={`w-[4px] rounded-full transition-all duration-200 ${
              splitter.resizingLeftPane
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
                  isSingleEngine
                    ? "text-[#8C959F] dark:text-[#858585] hover:text-sky-600 dark:hover:text-sky-400 hover:bg-[#0284C7]/10 dark:hover:bg-[#0284C7]/20"
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
                  isSingleEngine
                    ? "text-[#8C959F] dark:text-[#858585] hover:text-sky-600 dark:hover:text-sky-400 hover:bg-[#0284C7]/10 dark:hover:bg-[#0284C7]/20"
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

      {/* 우측 플라이아웃 패널 */}
      <FlyoutPanel
        activeFlyout={activeFlyout}
        flyoutRef={flyoutRef}
        onClose={() => setActiveFlyout(null)}
      >
        {activeFlyout && renderPanel(activeFlyout)}
      </FlyoutPanel>

      {/* Play / Pause / Reset / Trash / Check 화면 중앙 애니메이션 피드백 (담백한 딥 톤 배경 & 순백색 아이콘) */}
      {playback.playbackFeedback && (() => {
        const type = playback.playbackFeedback.type;
        const feedbackConfigs = {
          check: {
            bgClass: "bg-emerald-700/85",
            icon: (
              <svg
                className="w-12 h-12 stroke-white fill-none drop-shadow-md"
                viewBox="0 0 24 24"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            ),
          },
          play: {
            bgClass: "bg-blue-700/85",
            icon: (
              <svg
                className="w-12 h-12 fill-white translate-x-1 drop-shadow-md"
                viewBox="0 0 24 24"
              >
                <path d="M6 4.5l14 7.5-14 7.5v-15z" />
              </svg>
            ),
          },
          pause: {
            bgClass: "bg-amber-700/85",
            icon: (
              <svg
                className="w-12 h-12 fill-white drop-shadow-md"
                viewBox="0 0 24 24"
              >
                <rect x="5.5" y="4.5" width="4" height="15" rx="1.5" />
                <rect x="14.5" y="4.5" width="4" height="15" rx="1.5" />
              </svg>
            ),
          },
          trash: {
            bgClass: "bg-rose-700/85",
            icon: (
              <svg
                className="w-12 h-12 fill-white drop-shadow-md"
                viewBox="0 0 24 24"
              >
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            ),
          },
          reset: {
            bgClass: "bg-slate-800/90",
            icon: (
              <svg
                className="w-12 h-12 fill-white drop-shadow-md"
                viewBox="0 0 24 24"
              >
                <rect x="4" y="5" width="2.5" height="14" rx="1" />
                <path d="M13 12l6-4.5v9L13 12z" />
                <path d="M7.5 12l6-4.5v9L7.5 12z" />
              </svg>
            ),
          },
        }[type];

        return (
          <div
            key={playback.playbackFeedback.id}
            className={`playback-indicator-overlay fixed inset-0 m-auto w-24 h-24 rounded-3xl ${feedbackConfigs.bgClass} backdrop-blur-md shadow-2xl flex items-center justify-center pointer-events-none z-50 text-white border border-white/20 transition-colors`}
          >
            {feedbackConfigs.icon}
          </div>
        );
      })()}
    </main>
  );
};

export default MainPage;
