import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import SourceArea from "./components/Source";
import type { SharedSourceState } from "./components/Source";
import TutorArea from "./components/TutorArea";
import AIAgentArea from "./components/AIAgentArea";
import PipelineVisualizer from "./components/PipelineVisualizer";
import StateVisualizer from "./components/StateVisualizer";
import RegisterVisualizer from "./components/RegisterVisualizer";
import MemoryVisualizer from "./components/MemoryVisualizer";
import ControlPanel from "./components/ControlPanel";
import FlyoutPanel from "./components/FlyoutPanel";

import type { SimulationResult } from "@/type/simulation";
import type { FileSummary } from "@/type/file";
import type { CodeLineSelectInfo } from "./components/Source/SourceViewer";
import type { PanelKey, SectionConfig } from "./types";
import { getDefaultSections } from "./types";
import { useResizableLayout } from "./hooks/useResizableLayout";
import TranslationEditor from "./components/TranslationEditor";
import TranslationMapping from "./components/TranslationMapping";
import { compileTranslation } from "./components/translationCompile";

const DEFAULT_TRANSLATION_SOURCE = "int main(void) {\n    int a = 5;\n    int b = 3;\n    int sum = a + b;\n    return sum;\n}\n";
const TRANSLATION_SOURCE_KEY = "archreactor.translation.source";

const MainPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initialFileId =
    searchParams.get("fileId") ||
    (location.state as { fileId?: string } | null)?.fileId ||
    null;

  // ========================================================
  // 0. 현재 라우트에 따른 슬라이드 시작 섹션 인덱스 & 화면 비율 3단계 감지
  // - 일반 비율 (< 21:9, 3개 섹션씩 노출):
  //   · Translation (/c-to-asm) -> 0 (1, 2, 3 섹션 노출)
  //   · Execution   (/)         -> 1 (2, 3, 4 섹션 노출)
  //   · Management  (/coming-soon) -> 2 (3, 4, 5 섹션 노출)
  // - 21:9 이상 화면 비율 (4개 섹션씩 노출):
  //   · Translation & Execution (/c-to-asm, /) -> 0 (1, 2, 3, 4 섹션 노출)
  //   · Execution & Management  (/coming-soon) -> 1 (2, 3, 4, 5 섹션 노출)
  // - 32:9 이상 화면 비율 (5개 섹션 전체 노출):
  //   · 항상 0 (1, 2, 3, 4, 5 섹션 한눈에 노출)
  // ========================================================
  const [aspectTier, setAspectTier] = useState<"normal" | "ultrawide" | "superwide">(() => {
    if (typeof window === "undefined") return "normal";
    const ratio = window.innerWidth / Math.max(1, window.innerHeight);
    if (ratio >= 32 / 9) return "superwide";
    if (ratio >= 21 / 9) return "ultrawide";
    return "normal";
  });

  useEffect(() => {
    const checkAspectRatio = () => {
      const ratio = window.innerWidth / Math.max(1, window.innerHeight);
      if (ratio >= 32 / 9) setAspectTier("superwide");
      else if (ratio >= 21 / 9) setAspectTier("ultrawide");
      else setAspectTier("normal");
    };
    checkAspectRatio();
    window.addEventListener("resize", checkAspectRatio);
    return () => window.removeEventListener("resize", checkAspectRatio);
  }, []);

  const visibleCount =
    aspectTier === "superwide" ? 5 : aspectTier === "ultrawide" ? 4 : 3;

  const slideStartIndex = useMemo(() => {
    if (aspectTier === "superwide") return 0;
    if (aspectTier === "ultrawide") {
      return location.pathname === "/coming-soon" ? 1 : 0;
    }
    if (location.pathname === "/c-to-asm") return 0;
    if (location.pathname === "/coming-soon") return 2;
    return 1;
  }, [location.pathname, aspectTier]);

  // 1섹션(C 코드 + File List)이 화면에 함께 보이는 상태인지 여부 (시작 인덱스가 0일 때)
  void slideStartIndex;

  // ========================================================
  // 1. 1섹션(C 전용) & 2섹션(ASM / C·ASM 전환) 간 공유 소스 상태
  // ========================================================
  const [fileId, setFileId] = useState<string | null>(initialFileId);
  const [cFileName, setCFileName] = useState<string>("");
  const [cContent, setCContent] = useState<string>(() => sessionStorage.getItem(TRANSLATION_SOURCE_KEY) || "");
  const [asmFileName, setAsmFileName] = useState<string>("");
  const [asmContent, setAsmContent] = useState<string>("");
  const [savedFiles, setSavedFiles] = useState<FileSummary[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(
    () => !!localStorage.getItem("access_token")
  );
  const [externalLoadFileId, setExternalLoadFileId] = useState<string | null>(null);
  const [translationSource, setTranslationSource] = useState(
    () => sessionStorage.getItem(TRANSLATION_SOURCE_KEY) || DEFAULT_TRANSLATION_SOURCE
  );
  const [translationAssembly, setTranslationAssembly] = useState("");
  const [translationError, setTranslationError] = useState("");
  const [translationBusy, setTranslationBusy] = useState(false);
  const [translationSelectedLine, setTranslationSelectedLine] = useState<number | null>(null);
  const isTranslationPage = location.pathname === "/c-to-asm";

  const updateTranslationSource = (source: string, fileName = "main.c", resetSimulation = false) => {
    setTranslationSource(source);
    setCContent(source);
    setCFileName(fileName);
    setFileId(null);
    sessionStorage.setItem(TRANSLATION_SOURCE_KEY, source);
    setAsmContent("");
    setTranslationAssembly("");
    setTranslationError("");
    setTranslationSelectedLine(null);

    // 초기화 버튼 클릭 등으로 시뮬레이션 상태도 함께 리셋해야 할 때
    if (resetSimulation) {
      setSimulationData(null);
      setCurrentCycle(0);
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (!isTranslationPage) return;
    if (cContent && cContent !== translationSource) {
      setTranslationSource(cContent);
      sessionStorage.setItem(TRANSLATION_SOURCE_KEY, cContent);
      return;
    }
    setCContent(translationSource);
    setCFileName((current) => current || "main.c");
    setFileId(null);
  }, [cContent, isTranslationPage, translationSource]);

  const handleTranslationCompile = async () => {
    if (!translationSource.trim() || translationBusy) return;
    setTranslationBusy(true);
    setTranslationError("");
    setAsmContent("");
    try {
      const { assembly, simulationResult } = await compileTranslation(translationSource);
      setTranslationAssembly(assembly);
      setAsmContent(assembly);
      setAsmFileName("assembly.s");

      // 5개 컴포넌트 전체가 공유하는 시뮬레이션 상태 갱신
      if (simulationResult) {
        handleSimulationComplete(simulationResult);
      }
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : "컴파일에 실패했습니다.");
    } finally {
      setTranslationBusy(false);
    }
  };

  const handleTranslationFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".c")) {
      setTranslationError(".c 파일을 선택해 주세요.");
      return;
    }
    if (file.size > 64 * 1024) {
      setTranslationError("C 파일은 64 KiB 이하로 열어 주세요.");
      return;
    }
    try {
      updateTranslationSource((await file.text()).replace(/^\uFEFF/, ""), file.name);
    } catch {
      setTranslationError("파일을 읽지 못했습니다.");
    }
  };

  const sharedSourceState: SharedSourceState = {
    fileId,
    setFileId,
    cFileName,
    setCFileName,
    cContent,
    setCContent,
    asmFileName,
    setAsmFileName,
    asmContent,
    setAsmContent,
    savedFiles,
    setSavedFiles,
    isLoggedIn,
    setIsLoggedIn,
    externalLoadFileId,
    onExternalLoadHandled: () => setExternalLoadFileId(null),
  };

  // ========================================================
  // 2. 시뮬레이션 제어 상태 관리
  // ========================================================
  const [simulationData, setSimulationData] = useState<SimulationResult | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const totalCycles = simulationData?.history?.length ?? 0;

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
  // 3. 5섹션 슬라이드 레이아웃 상태 및 리사이징 훅 연동
  // ========================================================
  const [sections, setSections] = useState<SectionConfig[]>(getDefaultSections);

  const {
    containerRef,
    resizingSplitterIndex,
    resizingRowSlot,
    resizingPair,
    handleColResizeStart,
    handleSlotResizeStart,
    handlePairResizeStart,
  } = useResizableLayout(sections, setSections);

  // 슬라이드 뷰 전환 또는 21:9(4섹션) / 일반(3섹션) 전환 시 현재 보이는 섹션들의 너비 합이 100%가 되도록 자동 보정
  useEffect(() => {
    setSections((prev) => {
      const visibleSlice = prev.slice(slideStartIndex, slideStartIndex + visibleCount);
      const visibleSum = visibleSlice.reduce((acc, s) => acc + s.widthPercent, 0);
      if (Math.abs(visibleSum - 100) < 0.2 || visibleSum <= 0) return prev;

      const scale = 100 / visibleSum;
      return prev.map((sec) => ({
        ...sec,
        widthPercent: Math.round(sec.widthPercent * scale * 100) / 100,
      }));
    });
  }, [slideStartIndex, visibleCount]);

  // 현재 시작 인덱스 이전 섹션들의 너비 합만큼 왼쪽으로 슬라이드 이동 (%)
  const slideOffsetPercent = useMemo(() => {
    return sections
      .slice(0, slideStartIndex)
      .reduce((acc, s) => acc + s.widthPercent, 0);
  }, [sections, slideStartIndex]);

  // 좌/우 뷰포트 네비게이션 액션
  const canGoPrevViewport = slideStartIndex > 0;
  const canGoNextViewport = slideStartIndex + visibleCount < sections.length;

  const handleGoPrevViewport = () => {
    if (aspectTier === "ultrawide") {
      navigate("/c-to-asm");
    } else {
      if (slideStartIndex === 2) navigate("/");
      else if (slideStartIndex === 1) navigate("/c-to-asm");
    }
  };

  const handleGoNextViewport = () => {
    if (aspectTier === "ultrawide") {
      navigate("/coming-soon");
    } else {
      if (slideStartIndex === 0) navigate("/");
      else if (slideStartIndex === 1) navigate("/coming-soon");
    }
  };

  // 우측 책갈피 말풍선 상태 (AI 에이전트 전용)
  const [activeFlyout, setActiveFlyout] = useState<PanelKey | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 말풍선 닫기
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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const currentData = simulationData?.history?.[currentCycle] ?? null;
  const prevData =
    currentCycle > 0 ? simulationData?.history?.[currentCycle - 1] ?? null : null;

  // ========================================================
  // 4. 사각형 텍스트 플레이스홀더 카드 및 1섹션 하단 File List 패널
  // ========================================================
  const renderPlaceholderBox = (title: string) => (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center p-4 min-h-0 overflow-hidden select-none">
      <span className="text-base font-bold text-slate-700 tracking-wide">
        {title}
      </span>
    </div>
  );

  const renderFileListPanel = () => (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-0 overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">📁</span>
          <h3 className="text-xs font-bold text-slate-800">File List</h3>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-mono">
          {isLoggedIn ? `${savedFiles.length}개` : "비로그인"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 min-h-0">
        {!isLoggedIn ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 px-3 gap-1">
            <span className="text-xs font-semibold text-slate-500">
              로그인이 필요합니다
            </span>
            <span className="text-[11px]">
              로그인하면 저장한 C/ASM 파일 목록을 여기서 바로 불러올 수 있습니다.
            </span>
          </div>
        ) : savedFiles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 px-3 gap-1">
            <span className="text-xs font-semibold text-slate-500">
              저장된 파일이 없습니다
            </span>
            <span className="text-[11px]">
              상단 C 코드 영역의 ☰ 메뉴에서 파일을 저장해 보세요.
            </span>
          </div>
        ) : (
          savedFiles.map((f) => {
            const isSelected = fileId === f.file_id;
            const dateStr = f.updated_at
              ? new Date(f.updated_at).toLocaleDateString("ko-KR", {
                  month: "2-digit",
                  day: "2-digit",
                })
              : "";

            return (
              <button
                key={f.file_id}
                type="button"
                onClick={() => setExternalLoadFileId(f.file_id)}
                className={`w-full px-3 py-2 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-blue-50/90 border-blue-400 text-blue-900 shadow-2xs"
                    : "bg-slate-50/50 hover:bg-slate-100/80 border-slate-200/70 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                      f.lang === "asm"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    {f.lang || "c"}
                  </span>
                  <span className="text-xs font-semibold truncate">
                    {f.title}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {dateStr && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {dateStr}
                    </span>
                  )}
                  {isSelected && (
                    <span className="text-[10px] font-bold text-blue-600">
                      선택됨
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  // ========================================================
  // 5. 컴포넌트 공통 렌더러 (슬롯 및 말풍선에서 공용 렌더링)
  // ========================================================
  const renderPanelComponent = (panelKey: PanelKey) => {
    switch (panelKey) {
      case "cSource":
        if (isTranslationPage) {
          return (
            <TranslationEditor
              source={translationSource}
              onChange={(value) => updateTranslationSource(value)}
              onCompile={handleTranslationCompile}
              onFile={handleTranslationFile}
              onReset={() => updateTranslationSource(DEFAULT_TRANSLATION_SOURCE, "main.c", true)}
              busy={translationBusy}
              error={translationError}
              selectedLine={translationSelectedLine}
              onSelectLine={setTranslationSelectedLine}
            />
          );
        }
        return (
          <SourceArea
            mode="c-only"
            showFileSelector={false}
            sharedState={sharedSourceState}
            fileId={initialFileId}
            loadingMessage={loadingMessage}
            onStartSimulation={handleStartSimulation}
            onSimulationComplete={handleSimulationComplete}
            onLoadingChange={setLoadingMessage}
            stageBuffers={currentData?.buffers}
            selectedLine={selectedCodeLine}
            onSelectLine={setSelectedCodeLine}
          />
        );
      case "fileList":
        return renderFileListPanel();
      case "source":
        return (
          <TranslationMapping
            source={translationSource || cContent}
            assembly={translationAssembly || asmContent}
            busy={translationBusy}
            error={translationError}
            selectedLine={translationSelectedLine}
            onSelectLine={setTranslationSelectedLine}
            stageBuffers={currentData?.buffers}
          />
        );
      case "tutor":
        return (
          <TutorArea
            simulationData={simulationData}
            currentCycleData={currentData}
            loadingMessage={loadingMessage}
            selectedCodeLine={selectedCodeLine}
            onClearSelectedCodeLine={() => setSelectedCodeLine(null)}
          />
        );
      case "pipeline":
        return (
          <PipelineVisualizer
            currentData={currentData}
            loadingMessage={loadingMessage}
          />
        );
      case "state":
        return (
          <StateVisualizer
            currentData={currentData}
            prevData={prevData}
            simulationData={simulationData}
            defaultLayout="vertical"
          />
        );
      case "registers":
        return (
          <RegisterVisualizer
            registers={currentData?.global_result.registers || {}}
            prevRegisters={prevData?.global_result.registers}
          />
        );
      case "memory":
        return (
          <MemoryVisualizer
            memorySnapshot={currentData?.global_result.memory_snapshot || {}}
            prevMemorySnapshot={prevData?.global_result.memory_snapshot}
          />
        );
      case "queues":
        return renderPlaceholderBox("Queues");
      case "ioDevice":
        return renderPlaceholderBox("IO Device");
      case "aiPanel":
        return <AIAgentArea />;
      default:
        return null;
    }
  };

  return (
    <main className="flex-1 flex flex-col px-4 pb-3 pt-2.5 w-full h-full min-h-0 overflow-hidden relative">
      {/* ============================================================ */}
      {/* [최상단 제어 바]: 재생 컨트롤러                               */}
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
            isReady={totalCycles > 0}
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* [동적 5섹션 가로 슬라이드 컨테이너]: 필요할 때만 여백 버튼 노출 */}
      {/* ============================================================ */}
      <div className="flex-1 flex w-full min-h-0 overflow-hidden items-stretch gap-1.5">
        {/* 좌측 네비게이션 레일 (Translation 등 맨 왼쪽 끝일 때는 여백 없이 꽉 채움) */}
        {canGoPrevViewport && (
          <div className="w-8 shrink-0 flex items-center justify-center py-2 select-none animate-in fade-in duration-200">
            <button
              type="button"
              onClick={handleGoPrevViewport}
              title="이전 뷰포트(왼쪽 영역)로 이동"
              className="w-full h-28 rounded-xl bg-white hover:bg-sky-50 text-slate-400 hover:text-sky-600 border border-slate-200/90 hover:border-sky-300 shadow-2xs hover:shadow-sm flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer group active:scale-95"
            >
              <span className="text-lg font-bold leading-none text-slate-500 group-hover:text-sky-600 transition-transform group-hover:-translate-x-0.5">‹</span>
              <span className="text-[9px] font-sans font-bold tracking-tighter text-slate-400 group-hover:text-sky-600 [writing-mode:vertical-rl]">
                PREV
              </span>
            </button>
          </div>
        )}

        {/* 슬라이드 뷰포트 영역 */}
        <div
          ref={containerRef}
          className={`flex-1 h-full min-w-0 overflow-hidden relative ${
            resizingSplitterIndex !== null ? "select-none" : ""
          }`}
        >
          {/* 5개 섹션을 가로로 나열하는 슬라이딩 트랙 */}
          <div
            className={`flex h-full w-full ${
              resizingSplitterIndex !== null
                ? ""
                : "transition-transform duration-500 ease-in-out"
            }`}
            style={{
              transform: `translate3d(-${slideOffsetPercent}%, 0, 0)`,
            }}
          >
            {sections.map((section, secIdx) => {
              const isLastVisibleInWindow =
                secIdx === slideStartIndex + visibleCount - 1;
              const showColSplitter =
                secIdx < sections.length - 1 && !isLastVisibleInWindow;

              return (
                <div
                  key={section.id}
                  className="flex h-full min-h-0 shrink-0 overflow-hidden pr-1"
                  style={{ width: `${section.widthPercent}%` }}
                >
                  {/* 구역 내부 세로 슬롯 렌더링 */}
                  <div className="flex-1 flex flex-col gap-1.5 min-w-0 h-full overflow-hidden">
                    {section.slots.map((slot, slotIdx) => {
                      const defaultRatio =
                        section.slots.length === 2 &&
                        slot.type === "single" &&
                        slot.panel === "pipeline"
                          ? 1.9
                          : 1;
                      const flexVal = slot.flexRatio ?? defaultRatio;

                      return (
                        <React.Fragment key={slotIdx}>
                          <div
                            className="min-h-0 overflow-hidden flex"
                            style={{ flex: `${flexVal} 1 0%` }}
                          >
                            {slot.type === "single" ? (
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
                                  onMouseDown={(e) =>
                                    handlePairResizeStart(
                                      secIdx,
                                      slotIdx,
                                      slot.pairRatio ?? 50,
                                      e
                                    )
                                  }
                                  title="좌우로 드래그하여 가로 분할 비율 조절"
                                  className="w-2.5 -mx-1 relative flex items-center justify-center cursor-col-resize group shrink-0 z-20 hover:bg-indigo-50/50 rounded-sm transition-colors"
                                >
                                  <div
                                    className={`w-[3px] rounded-full transition-all duration-200 ${
                                      resizingPair?.secIdx === secIdx &&
                                      resizingPair?.slotIdx === slotIdx
                                        ? "h-16 bg-indigo-600 shadow-sm"
                                        : "h-8 bg-slate-300 group-hover:h-14 group-hover:bg-indigo-500"
                                    }`}
                                  />
                                </div>

                                <div
                                  className="flex flex-col min-h-0 overflow-hidden"
                                  style={{
                                    width: `${100 - (slot.pairRatio ?? 50)}%`,
                                  }}
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
                                const topDefault =
                                  topSlot.type === "single" &&
                                  topSlot.panel === "pipeline"
                                    ? 1.9
                                    : 1;
                                const btmDefault =
                                  btmSlot.type === "single" &&
                                  btmSlot.panel === "pipeline"
                                    ? 1.9
                                    : 1;
                                const topRatio = topSlot.flexRatio ?? topDefault;
                                const btmRatio = btmSlot.flexRatio ?? btmDefault;
                                handleSlotResizeStart(
                                  secIdx,
                                  slotIdx,
                                  topRatio,
                                  btmRatio,
                                  e
                                );
                              }}
                              title="위아래로 드래그하여 슬롯 높이 비율 조절"
                              className="h-2.5 -my-1 relative flex items-center justify-center cursor-row-resize group shrink-0 z-20 hover:bg-indigo-50/50 rounded-sm transition-colors"
                            >
                              <div
                                className={`h-[3px] rounded-full transition-all duration-200 ${
                                  resizingRowSlot?.secIdx === secIdx &&
                                  resizingRowSlot?.slotIdx === slotIdx
                                    ? "w-24 bg-indigo-600 shadow-sm"
                                    : "w-10 bg-slate-300 group-hover:w-20 group-hover:bg-indigo-500"
                                }`}
                              />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* 구역 간 가로 조절 스플리터 바 */}
                  {showColSplitter && (
                    <div
                      onMouseDown={(e) => handleColResizeStart(secIdx, e)}
                      title="드래그하여 구역 간 너비 조절"
                      className="w-2.5 -mx-0.5 relative flex items-center justify-center cursor-col-resize group shrink-0 z-20 hover:bg-blue-50/50 rounded-sm transition-colors"
                    >
                      <div
                        className={`w-[3px] rounded-full transition-all duration-200 ${
                          resizingSplitterIndex === secIdx
                            ? "h-24 bg-blue-600 shadow-sm"
                            : "h-10 bg-slate-300 group-hover:h-20 group-hover:bg-blue-500"
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 우측 네비게이션 레일 (Management 등 맨 오른쪽 끝일 때는 여백 없이 꽉 채움) */}
        {canGoNextViewport && (
          <div className="w-8 shrink-0 flex items-center justify-center py-2 select-none animate-in fade-in duration-200">
            <button
              type="button"
              onClick={handleGoNextViewport}
              title="다음 뷰포트(오른쪽 영역)로 이동"
              className="w-full h-28 rounded-xl bg-white hover:bg-sky-50 text-slate-400 hover:text-sky-600 border border-slate-200/90 hover:border-sky-300 shadow-2xs hover:shadow-sm flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer group active:scale-95"
            >
              <span className="text-lg font-bold leading-none text-slate-500 group-hover:text-sky-600 transition-transform group-hover:translate-x-0.5">›</span>
              <span className="text-[9px] font-sans font-bold tracking-tighter text-slate-400 group-hover:text-sky-600 [writing-mode:vertical-rl]">
                NEXT
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* [말풍선 / 플로팅 플라이아웃 창]: AI 에이전트 호출             */}
      {/* ============================================================ */}
      <FlyoutPanel
        activeFlyout={activeFlyout}
        flyoutRef={flyoutRef}
        onClose={() => setActiveFlyout(null)}
      >
        {activeFlyout && renderPanelComponent(activeFlyout)}
      </FlyoutPanel>
    </main>
  );
};

export default MainPage;
