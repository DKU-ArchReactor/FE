import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import SourceArea from "./components/Source";
import type { SharedSourceState } from "./components/Source";
import TutorArea from "./components/TutorArea";
import AIAgentArea from "./components/AIAgentArea";
import PipelineVisualizer from "./components/PipelineVisualizer";
import StateVisualizer from "./components/StateVisualizer";
import RegisterVisualizer from "./components/RegisterVisualizer";
import MemorySegmentVisualizer from "./components/MemorySegmentVisualizer";
import ControlPanel from "./components/ControlPanel";
import FlyoutPanel from "./components/FlyoutPanel";

import { getPlaybackFrame, assertSimulationResult } from "./components/simulationView";
import type { SimulationBundle } from "./components/simulationView";
import type { FileSummary } from "@/type/file";
import { getFiles, getFileById } from "@/api/file";
import type { CodeLineSelectInfo } from "./components/Source/SourceViewer";
import type { PanelKey, SectionConfig } from "./types";
import { getDefaultSections } from "./types";
import { useResizableLayout } from "./hooks/useResizableLayout";
import TranslationEditor from "./components/TranslationEditor";
import TranslationMapping from "./components/TranslationMapping";
import { compileTranslation } from "./components/translationCompile";

const DEFAULT_TRANSLATION_SOURCE = "int main(void) {\n    int a = 5;\n    int b = 3;\n    int sum = a + b;\n    return sum;\n}\n";
const TRANSLATION_SOURCE_KEY = "archreactor.translation.source";
const EMPTY_REGISTERS: Record<string, string> = {};

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
  //   · Compile ➔ Execution (/)        -> 0 (1, 2, 3 섹션 노출)
  //   · 5-Stage Pipeline    (/pipeline)-> 1 (2, 3, 4 섹션 노출)
  //   · Management          (/management)-> 2 (3, 4, 5 섹션 노출)
  // - 21:9 이상 화면 비율 (4개 섹션씩 노출):
  //   · Compile ➔ Pipeline    (/, /pipeline) -> 0 (1, 2, 3, 4 섹션 노출)
  //   · Pipeline ➔ Management (/management)  -> 1 (2, 3, 4, 5 섹션 노출)
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

  const isManagementPath =
    location.pathname === "/management" || location.pathname === "/coming-soon";
  const isPipelinePath = location.pathname === "/pipeline";

  const slideStartIndex = useMemo(() => {
    if (aspectTier === "superwide") return 0;
    if (aspectTier === "ultrawide") {
      return isManagementPath ? 1 : 0;
    }
    if (isManagementPath) return 2;
    if (isPipelinePath) return 1;
    return 0;
  }, [isManagementPath, isPipelinePath, aspectTier]);

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
  const [fileContentCache, setFileContentCache] = useState<Record<string, string>>({});
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const loadedInitialFileIdRef = useRef<string | null>(null);
  const sourceRevisionRef = useRef(0);
  const [translationSource, setTranslationSource] = useState(
    () => sessionStorage.getItem(TRANSLATION_SOURCE_KEY) || DEFAULT_TRANSLATION_SOURCE
  );
  const [translationAssembly, setTranslationAssembly] = useState("");
  const [translationError, setTranslationError] = useState("");
  const [translationBusy, setTranslationBusy] = useState(false);
  const [translationSelectedLine, setTranslationSelectedLine] = useState<number | null>(null);
  // 사용자가 수동 클릭한 특정 어셈블리 행 인덱스 (0부터 시작)
  const [translationSelectedAsmIndex, setTranslationSelectedAsmIndex] = useState<number | null>(null);

  const handleSelectTranslationLine = (line: number | null, asmIndex: number | null = null) => {
    // 사용자가 특정 라인을 클릭해 탐색할 때, 자동 재생 중이면 즉시 일시정지(Pause)
    if (line !== null) {
      setIsPlaying((prev) => {
        if (prev) {
          triggerPlaybackFeedback("pause");
        }
        return false;
      });
    }
    setTranslationSelectedLine(line);
    setTranslationSelectedAsmIndex(asmIndex);
  };
  const isTranslationPage = slideStartIndex === 0;

  const updateTranslationSource = (
    source: string,
    fileName = "main.c",
    resetSimulation = false,
    keepFileId: string | null = null
  ) => {
    sourceRevisionRef.current += 1;
    setTranslationSource(source);
    setCContent(source);
    setCFileName(fileName);
    setFileId(keepFileId);
    sessionStorage.setItem(TRANSLATION_SOURCE_KEY, source);
    setAsmContent("");
    setTranslationAssembly("");
    setTranslationError("");
    setTranslationSelectedLine(null);
    setTranslationSelectedAsmIndex(null);

    // Edited source must never retain results from an older build.
    void resetSimulation;
    {
      setSimulationBundle({ results: {}, errors: {} });
      setCurrentStepIndex(0);
      setCurrentCycle(0);
      setIsPlaying(false);
    }
  };

  // 로그인 상태 확인 및 저장된 파일 목록 조회 (Translation 페이지에서도 항상 로드)
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    setIsLoggedIn(!!token);
    if (!token) {
      setSavedFiles([]);
      return;
    }
    getFiles()
      .then((list) => setSavedFiles(list))
      .catch((err) => console.error("Saved file list fetch error:", err));
  }, [location.pathname]);

  // 파일 ID로 상세 내용을 가져와 캐시에 저장하는 헬퍼
  const ensureFileContent = async (targetId: string): Promise<{ title: string; content: string } | null> => {
    const summary = savedFiles.find((f) => f.file_id === targetId);
    if (fileContentCache[targetId] !== undefined) {
      return {
        title: summary?.title || "main.c",
        content: fileContentCache[targetId],
      };
    }
    try {
      setLoadingPreviewId(targetId);
      const detail = await getFileById(targetId);
      setFileContentCache((prev) => ({ ...prev, [targetId]: detail.content }));
      return { title: detail.title, content: detail.content };
    } catch (err) {
      console.error("File detail fetch error:", err);
      return null;
    } finally {
      setLoadingPreviewId((prev) => (prev === targetId ? null : prev));
    }
  };

  // File List에서 더블클릭(또는 마이페이지에서 진입) 시 상단 C 소스 코드 에디터에 코드 로드
  const handleOpenSavedFileInEditor = async (targetId: string) => {
    const detail = await ensureFileContent(targetId);
    if (!detail) {
      setTranslationError("선택한 소스 코드 파일을 불러오지 못했습니다.");
      return;
    }
    setHoveredFileId(null);
    updateTranslationSource(detail.content, detail.title, true, targetId);
  };

  // 마이페이지 등에서 fileId 쿼리/state를 들고 진입한 경우 자동으로 에디터에 로드
  useEffect(() => {
    if (!initialFileId || loadedInitialFileIdRef.current === initialFileId) return;
    loadedInitialFileIdRef.current = initialFileId;
    void handleOpenSavedFileInEditor(initialFileId);
  }, [initialFileId]);

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
    setSimulationBundle({ results: {}, errors: {} });
    setCurrentStepIndex(0);
    setCurrentCycle(0);
    setIsPlaying(false);
    const sourceRevision = sourceRevisionRef.current;
    try {
      const { assembly, simulation } = await compileTranslation(translationSource);
      if (sourceRevision !== sourceRevisionRef.current) return;
      setTranslationAssembly(assembly);
      setAsmContent(assembly);
      setAsmFileName("assembly.s");

      // 5개 컴포넌트 전체가 공유하는 시뮬레이션 상태 갱신
      handleSimulationComplete(simulation);
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
  // 2. 시뮬레이션 제어 상태 관리 (Single-Cycle vs 5-Stage Pipeline 모드)
  // ========================================================
  const [simulationBundle, setSimulationBundle] = useState<SimulationBundle>({ results: {}, errors: {} });
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const isSingleCycleViewport = location.pathname === "/" || location.pathname === "/c-to-asm";
  const simulationMode = isSingleCycleViewport ? "single" : "pipeline";
  const simulationData = simulationBundle.results[simulationMode] ?? null;
  const totalSingleSteps = simulationBundle.results.single?.history.length ?? 0;
  const totalPipelineCycles = simulationBundle.results.pipeline?.history.length ?? 0;
  const totalCycles = isSingleCycleViewport ? totalSingleSteps : totalPipelineCycles;
  const isSimulationReady = totalCycles > 0;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000);
  const [selectedCodeLine, setSelectedCodeLine] = useState<CodeLineSelectInfo | null>(null);
  const [playbackFeedback, setPlaybackFeedback] = useState<{ type: "play" | "pause"; id: number } | null>(null);
  const activeCycleIndex = isSingleCycleViewport ? currentStepIndex : currentCycle;
  const currentData = getPlaybackFrame(simulationData, activeCycleIndex);
  const prevData = activeCycleIndex > 0 ? getPlaybackFrame(simulationData, activeCycleIndex - 1) : null;
  // Compiler .s text contains pseudo-instructions, not linked ELF addresses.
  // Without PC-to-source metadata, static source rows cannot identify execution.
  const activeExecutionCLine = null;
  const isActuallyExecuting = activeCycleIndex > 0;
  const effectiveSelectedLine = translationSelectedLine;

  const timerRef = useRef<number | null>(null);

  const handleSimulationComplete = (data: SimulationBundle) => {
    setIsPlaying(false);
    setCurrentStepIndex(0);
    setCurrentCycle(0);
    setPlaySpeed(1000); // 컴파일 완료 즉시 1.0에 포커스
    setSelectedCodeLine(null);
    setSimulationBundle(data);
  };

  // 자동 재생 타이머: 재생 중에는 튜터 및 에디터가 현재 실행 라인을 실시간으로 따라가도록 수동 선택 자동 해제
  useEffect(() => {
    if (isPlaying) {
      // 재생 시작 시 즉시 수동 선택을 해제하여 실행 라인 추적 모드로 전환
      setTranslationSelectedLine(null);
      setTranslationSelectedAsmIndex(null);

      timerRef.current = window.setInterval(() => {
        if (isSingleCycleViewport) {
          setCurrentStepIndex((prev) => {
            if (prev >= totalSingleSteps) {
              setIsPlaying(false);
              return prev;
            }
            return prev + 1;
          });
        } else {
          setCurrentCycle((prev) => {
            if (prev >= totalPipelineCycles) {
              setIsPlaying(false);
              return prev;
            }
            return prev + 1;
          });
        }
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
  }, [isPlaying, playSpeed, isSingleCycleViewport, totalSingleSteps, totalPipelineCycles]);

  const handleStepBack = () => {
    setIsPlaying(false);
    triggerPlaybackFeedback("pause");
    // 스텝 조작 시 수동 선택을 해제하고 현재 실행 라인으로 자동 포커스
    setTranslationSelectedLine(null);
    setTranslationSelectedAsmIndex(null);
    if (isSingleCycleViewport) {
      setCurrentStepIndex((prev) => Math.max(0, prev - 1));
    } else {
      setCurrentCycle((prev) => Math.max(0, prev - 1));
    }
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    triggerPlaybackFeedback("pause");
    // 스텝 조작 시 수동 선택을 해제하고 현재 실행 라인으로 자동 포커스
    setTranslationSelectedLine(null);
    setTranslationSelectedAsmIndex(null);
    if (isSingleCycleViewport) {
      setCurrentStepIndex((prev) => Math.min(totalSingleSteps, prev + 1));
    } else {
      setCurrentCycle((prev) => Math.min(totalPipelineCycles, prev + 1));
    }
  };

  const triggerPlaybackFeedback = (type: "play" | "pause") => {
    setPlaybackFeedback({ type, id: Date.now() });
  };

  const handleTogglePlay = () => {
    const currentPos = isSingleCycleViewport ? currentStepIndex : currentCycle;
    const maxPos = isSingleCycleViewport ? totalSingleSteps : totalPipelineCycles;

    // 재생 토글 시 수동 선택을 해제하여 실시간 실행 라인 추적 모드로 전환
    setTranslationSelectedLine(null);
    setTranslationSelectedAsmIndex(null);

    if (currentPos >= maxPos) {
      if (isSingleCycleViewport) setCurrentStepIndex(0);
      else setCurrentCycle(0);
      setIsPlaying(true);
      triggerPlaybackFeedback("play");
    } else {
      setIsPlaying((prev) => {
        const nextState = !prev;
        triggerPlaybackFeedback(nextState ? "play" : "pause");
        return nextState;
      });
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setTranslationSelectedLine(null);
    setTranslationSelectedAsmIndex(null);
    setCurrentStepIndex(0);
    setCurrentCycle(0);
  };

  const handleJumpToCycle = (val: number) => {
    setIsPlaying((prev) => {
      if (prev) {
        triggerPlaybackFeedback("pause");
      }
      return false;
    });
    // 슬라이더 조작 시에도 해당 실행 시점 라인으로 자동 포커스
    setTranslationSelectedLine(null);
    setTranslationSelectedAsmIndex(null);
    if (isSingleCycleViewport) {
      setCurrentStepIndex(val);
    } else {
      setCurrentCycle(val);
    }
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
      navigate("/");
    } else {
      if (slideStartIndex === 2) navigate("/pipeline");
      else if (slideStartIndex === 1) navigate("/");
    }
  };

  const handleGoNextViewport = () => {
    if (aspectTier === "ultrawide") {
      navigate("/management");
    } else {
      if (slideStartIndex === 0) navigate("/pipeline");
      else if (slideStartIndex === 1) navigate("/management");
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

  const renderFileListPanel = () => {
    const hoveredFile = savedFiles.find((f) => f.file_id === hoveredFileId) || null;
    const hoveredCode = hoveredFileId ? fileContentCache[hoveredFileId] : undefined;

    return (
      <div
        className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-0 overflow-hidden relative"
        onMouseLeave={() => setHoveredFileId(null)}
      >
        <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">📁</span>
            <h3 className="text-xs font-bold text-slate-800">File List</h3>
            <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
              (호버: 미리보기 · 더블클릭: 열기)
            </span>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-mono">
            {isLoggedIn ? `${savedFiles.length}개` : "비로그인"}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 min-h-0 relative">
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
                마이페이지 또는 코드 메뉴에서 파일을 저장해 보세요.
              </span>
            </div>
          ) : (
            savedFiles.map((f) => {
              const isSelected = fileId === f.file_id;
              const isHovered = hoveredFileId === f.file_id;
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
                  onMouseEnter={() => {
                    setHoveredFileId(f.file_id);
                    void ensureFileContent(f.file_id);
                  }}
                  onDoubleClick={() => void handleOpenSavedFileInEditor(f.file_id)}
                  title="마우스를 올리면 코드 미리보기, 더블클릭하면 C 소스 코드에 열기"
                  className={`w-full px-3 py-2 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer select-none ${
                    isSelected
                      ? "bg-blue-50/90 border-blue-400 text-blue-900 shadow-2xs"
                      : isHovered
                      ? "bg-slate-100 border-slate-300 text-slate-900"
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
                        열림
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* 호버 시 우측에 뜨는 코드 미리보기 오버레이 (뒤의 파일 리스트를 가리지 않도록 우측 68% 배치 & pointer-events-none) */}
        {hoveredFile && (
          <div className="absolute top-10 bottom-2 right-2 w-[72%] z-30 bg-slate-900/95 backdrop-blur-xs text-slate-100 rounded-xl p-3 shadow-xl border border-slate-700 flex flex-col overflow-hidden pointer-events-none animate-in fade-in duration-150">
            <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-700 shrink-0">
              <span className="text-[11px] font-bold text-sky-300 truncate">
                📄 {hoveredFile.title}
              </span>
              <span className="text-[10px] text-slate-400 shrink-0">
                더블클릭하여 열기
              </span>
            </div>
            <div className="flex-1 overflow-hidden font-mono text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap">
              {loadingPreviewId === hoveredFile.file_id && hoveredCode === undefined ? (
                <span className="text-slate-400 font-sans text-xs">
                  코드를 불러오는 중...
                </span>
              ) : hoveredCode ? (
                hoveredCode
              ) : (
                <span className="text-slate-400 font-sans text-xs">
                  코드 내용이 비어 있습니다.
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

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
              executionLine={isActuallyExecuting ? activeExecutionCLine : null}
              onSelectLine={handleSelectTranslationLine}
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
            stageBuffers={currentData?.stage_activity}
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
            selectedAsmIndex={translationSelectedAsmIndex}
            executionLine={activeExecutionCLine}
            onSelectLine={handleSelectTranslationLine}
            mode={simulationMode}
            currentActiveStep={null}
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
            translationSource={translationSource || cContent}
            translationAssembly={translationAssembly || asmContent}
            selectedTranslationLine={effectiveSelectedLine}
            selectedAsmIndex={translationSelectedAsmIndex}
            currentActiveAsmIndex={null}
            executionLine={isActuallyExecuting ? activeExecutionCLine : null}
            isUserSelected={translationSelectedLine !== null}
            onSelectTranslationLine={handleSelectTranslationLine}
          />
        );
      case "pipeline":
        return (
          <PipelineVisualizer
            mode={simulationMode}
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
            registers={currentData?.global_result.registers ?? EMPTY_REGISTERS}
            prevRegisters={prevData?.global_result.registers}
            playSpeed={playSpeed}
            cycle={activeCycleIndex}
          />
        );
      case "memory":
        return (
          <MemorySegmentVisualizer
            currentData={currentData}
            prevData={prevData}
            simulationData={simulationData}
            translationAssembly={translationAssembly || asmContent}
            playSpeed={playSpeed}
            cycle={activeCycleIndex}
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
      <label className="shrink-0 text-xs py-1 cursor-pointer text-sky-700">
        로컬 CORE 실행 결과(JSON) 열기
        <input className="ml-2" type="file" accept=".json,application/json" onChange={async event => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const result: unknown = JSON.parse(await file.text());
            const mode = (result as { simulator?: { mode?: string } }).simulator?.mode;
            if (mode !== 'single' && mode !== 'pipeline') throw new Error('실행 모드를 확인할 수 없습니다.');
            assertSimulationResult(result, mode);
            setSimulationBundle(previous => {
              const other = mode === 'single' ? 'pipeline' : 'single';
              const sameProgram = result.program.fingerprint && result.program.fingerprint === previous.results[other]?.program.fingerprint;
              return { results: { ...(sameProgram ? previous.results : {}), [mode]: result }, errors: {} };
            });
            setCurrentStepIndex(0);
            setCurrentCycle(0);
            setIsPlaying(false);
            navigate(mode === 'single' ? '/' : '/pipeline');
          } catch (error) {
            setSimulationBundle(previous => ({ ...previous, errors: { ...previous.errors, [simulationMode]: error instanceof Error ? error.message : '실행 결과를 읽지 못했습니다.' } }));
          }
          event.target.value = '';
        }} />
      </label>
      {simulationBundle.errors[simulationMode] && (
        <p role="alert" className="shrink-0 p-2 text-xs text-rose-700 bg-rose-50">{simulationBundle.errors[simulationMode]}</p>
      )}
      {simulationData && (
        <div className="shrink-0 p-2 text-xs text-slate-700 bg-slate-50">
          {activeCycleIndex === 0 ? "실행 전" : `${activeCycleIndex}클록 완료`} · {simulationData.status === "error" ? "실행 오류/제한 도달" : simulationData.status === "halted" ? "실행 종료" : simulationData.status}
          <span className="ml-2">전체 결과: {simulationData.summary.instructions_executed}명령 · {simulationData.summary.total_cycles}클록 · CPI {simulationData.summary.instructions_executed ? (simulationData.summary.total_cycles / simulationData.summary.instructions_executed).toFixed(2) : '—'}</span>
          {currentData?.stage_activity?.IF?.pc && <> · IF PC {currentData.stage_activity.IF.pc}: {currentData.stage_activity.IF.assembly}</>}
          <span className="ml-2">C/ASM 연결은 정적 번역 정보입니다. 실행 위치는 실제 PC를 기준으로 확인하세요.</span>
          {activeCycleIndex === totalCycles && simulationData.console_output && <pre className="whitespace-pre-wrap">{simulationData.console_output}</pre>}
        </div>
      )}
      {/* ============================================================ */}
      {/* [최상단 제어 바]: 재생 컨트롤러                               */}
      {/* ============================================================ */}
      <div className="h-[48px] shrink-0 flex items-center gap-2 mb-2 min-h-0 w-full">
        <div className="flex-1 h-full min-w-0">
          <ControlPanel
            currentCycle={isSingleCycleViewport ? currentStepIndex : currentCycle}
            totalCycles={totalCycles}
            isPlaying={isPlaying}
            playSpeed={playSpeed}
            onStepBack={handleStepBack}
            onStepForward={handleStepForward}
            onTogglePlay={handleTogglePlay}
            onReset={handleReset}
            onJumpToCycle={handleJumpToCycle}
            onChangeSpeed={handleChangeSpeed}
            isReady={isSimulationReady}
            mode={simulationMode}
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

      {/* ============================================================ */}
      {/* [Play / Pause 화면 중앙 블러 페이드 피드백 애니메이션]       */}
      {/* ============================================================ */}
      {playbackFeedback && (
        <div
          key={playbackFeedback.id}
          className="playback-indicator-overlay fixed inset-0 m-auto w-24 h-24 rounded-3xl bg-slate-900/80 backdrop-blur-md shadow-2xl flex items-center justify-center pointer-events-none z-50 text-white border border-white/20"
        >
          {playbackFeedback.type === "play" ? (
            // 삼각형 Play 아이콘
            <svg
              className="w-12 h-12 fill-white translate-x-1 drop-shadow-md"
              viewBox="0 0 24 24"
            >
              <path d="M6 4.5l14 7.5-14 7.5v-15z" />
            </svg>
          ) : (
            // 두 개의 세로선 Pause 아이콘
            <svg
              className="w-12 h-12 fill-white drop-shadow-md"
              viewBox="0 0 24 24"
            >
              <rect x="5.5" y="4.5" width="4" height="15" rx="1.5" />
              <rect x="14.5" y="4.5" width="4" height="15" rx="1.5" />
            </svg>
          )}
        </div>
      )}
    </main>
  );
};

export default MainPage;
