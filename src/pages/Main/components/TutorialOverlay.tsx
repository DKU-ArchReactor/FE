import React, { useEffect, useState, useCallback } from "react";
import { hideTutorialForToday } from "../utils/tutorialDemoData";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

export type TutorialMobileMode = "code" | "viewport" | "tutor" | "assistant";

interface TutorialItem {
  id: string;
  highlightId: string;
  mobileHighlightId?: string;
  placement: "below-button" | "inside-section";
  viewportIndex: number;
  mobileMode: TutorialMobileMode;
  step: number;
  badgeColor: string;
  borderColor: string;
  spotBorderColor: string;
  tagColor: string;
  nextBtnColor: string;
  dotColor: string;
  title: string;
  buttons: { label: string; desc: string }[];
}

// 시뮬레이터 실제 사용 워크플로우 순서 (1단계 → 10단계, 데스크톱 및 모바일 뷰포트/탭/모달 자동 연동)
const TUTORIAL_STEPS: TutorialItem[] = [
  {
    id: "mode-target",
    highlightId: "mode-target",
    placement: "below-button",
    viewportIndex: 0,
    mobileMode: "code",
    step: 1,
    badgeColor: "bg-[#BAE6FD] text-slate-900",
    borderColor: "border-[#BAE6FD]/75",
    spotBorderColor: "border-[#BAE6FD] shadow-[0_0_16px_rgba(186,230,253,0.55)]",
    tagColor: "bg-[#BAE6FD]/18 text-[#BAE6FD] border-[#BAE6FD]/40",
    nextBtnColor: "bg-[#BAE6FD] hover:bg-[#7DD3FC] text-slate-900",
    dotColor: "bg-[#BAE6FD]",
    title: "작성 모드 선택 (C / ASM)",
    buttons: [
      { label: "C", desc: "C 코드를 작성·컴파일하여 어셈블리 변환 매핑 확인" },
      { label: "ASM", desc: "RISC-V 어셈블리(main.s)를 직접 작성·실행" },
    ],
  },
  {
    id: "mode-engine",
    highlightId: "mode-engine",
    placement: "below-button",
    viewportIndex: 0,
    mobileMode: "code",
    step: 2,
    badgeColor: "bg-[#DDD6FE] text-slate-900",
    borderColor: "border-[#DDD6FE]/75",
    spotBorderColor: "border-[#DDD6FE] shadow-[0_0_16px_rgba(221,214,254,0.55)]",
    tagColor: "bg-[#DDD6FE]/18 text-[#DDD6FE] border-[#DDD6FE]/40",
    nextBtnColor: "bg-[#DDD6FE] hover:bg-[#C4B5FD] text-slate-900",
    dotColor: "bg-[#DDD6FE]",
    title: "시뮬레이션 모드 선택",
    buttons: [
      { label: "Single", desc: "명령어 1개를 한 스텝에 실행하는 단일 사이클 모드" },
      { label: "Pipeline", desc: "IF·ID·EX·MEM·WB 5단계 병렬 파이프라인 및 해저드 분석" },
    ],
  },
  {
    id: "c-section",
    highlightId: "c-section",
    placement: "inside-section",
    viewportIndex: 0,
    mobileMode: "code",
    step: 3,
    badgeColor: "bg-[#BFDBFE] text-slate-900",
    borderColor: "border-[#BFDBFE]/75",
    spotBorderColor: "border-[#BFDBFE] shadow-[0_0_18px_rgba(191,219,254,0.5)]",
    tagColor: "bg-[#BFDBFE]/18 text-[#BFDBFE] border-[#BFDBFE]/40",
    nextBtnColor: "bg-[#BFDBFE] hover:bg-[#93C5FD] text-slate-900",
    dotColor: "bg-[#BFDBFE]",
    title: "C 소스 코드 작성 및 컴파일",
    buttons: [
      { label: "C 코드 작성", desc: "에디터에 C 소스 직접 작성·수정 및 라인 클릭 매핑" },
      { label: "불러오기", desc: "단계별 학습 예제·로컬 .c·저장 파일 열기" },
      { label: "저장 / 초기화", desc: "내 계정 저장 또는 기본 예제 코드 복원" },
      { label: "⚡ 컴파일", desc: "어셈블리 변환 및 시뮬레이션 실행 준비" },
    ],
  },
  {
    id: "asm-section",
    highlightId: "asm-section",
    placement: "inside-section",
    viewportIndex: 0,
    mobileMode: "code",
    step: 4,
    badgeColor: "bg-[#FDE68A] text-slate-900",
    borderColor: "border-[#FDE68A]/75",
    spotBorderColor: "border-[#FDE68A] shadow-[0_0_18px_rgba(253,230,138,0.5)]",
    tagColor: "bg-[#FDE68A]/18 text-[#FDE68A] border-[#FDE68A]/40",
    nextBtnColor: "bg-[#FDE68A] hover:bg-[#FCD34D] text-slate-900",
    dotColor: "bg-[#FDE68A]",
    title: "어셈블리 매핑 확인 & 직접 작성",
    buttons: [
      { label: "ASM 작성 & 매핑", desc: "C↔ASM 1:N 매핑 확인 및 어셈블리 직접 작성" },
      { label: "불러오기 / 저장 / 초기화", desc: "ASM 모드 예제 열기 및 .s 파일 관리" },
      { label: "⚡ 어셈블", desc: "ASM 모드에서 작성한 어셈블리 즉시 빌드·실행" },
    ],
  },
  {
    id: "playback-controls",
    highlightId: "playback-controls",
    mobileHighlightId: "mobile-playback",
    placement: "below-button",
    viewportIndex: 0,
    mobileMode: "code",
    step: 5,
    badgeColor: "bg-[#C7D2FE] text-slate-900",
    borderColor: "border-[#C7D2FE]/75",
    spotBorderColor: "border-[#C7D2FE] shadow-[0_0_16px_rgba(199,210,254,0.55)]",
    tagColor: "bg-[#C7D2FE]/18 text-[#C7D2FE] border-[#C7D2FE]/40",
    nextBtnColor: "bg-[#C7D2FE] hover:bg-[#A5B4FC] text-slate-900",
    dotColor: "bg-[#C7D2FE]",
    title: "시뮬레이션 재생 컨트롤러 & 배속",
    buttons: [
      { label: "■ / ↻1", desc: "Cycle 0 초기화 / 현재 클록 신호 흐름 1회 재생" },
      { label: "◀ PLAY ▶", desc: "이전·다음 클록 스텝 이동 및 연속 자동 재생" },
      { label: "0.5x~3.0x", desc: "재생 배속 조절 및 타임라인 슬라이더 이동" },
    ],
  },
  {
    id: "viewport-1",
    highlightId: "right-section",
    placement: "inside-section",
    viewportIndex: 0,
    mobileMode: "viewport",
    step: 6,
    badgeColor: "bg-[#A5F3FC] text-slate-900",
    borderColor: "border-[#A5F3FC]/75",
    spotBorderColor: "border-[#A5F3FC] shadow-[0_0_18px_rgba(165,243,252,0.5)]",
    tagColor: "bg-[#A5F3FC]/18 text-[#A5F3FC] border-[#A5F3FC]/40",
    nextBtnColor: "bg-[#A5F3FC] hover:bg-[#67E8F9] text-slate-900",
    dotColor: "bg-[#A5F3FC]",
    title: "뷰포트 1 · 레지스터 & 메모리 뷰어",
    buttons: [
      {
        label: "REGISTERS (x0~x31 · PC)",
        desc: "32개 레지스터와 PC의 실시간 값 확인 및 HEX / Signed / Unsigned 진법 전환",
      },
      {
        label: "MEMORY (Text / Data / Stack)",
        desc: "세그먼트별 메모리 주소·데이터 조회 및 최근 읽기/쓰기 접근 주소 추적",
      },
      {
        label: "뷰포트 전환",
        desc: "우측 끝 NEXT 버튼(모바일은 하단 바텀바 탭)으로 다음 뷰포트 전환",
      },
    ],
  },
  {
    id: "viewport-2",
    highlightId: "right-section",
    placement: "inside-section",
    viewportIndex: 1,
    mobileMode: "viewport",
    step: 7,
    badgeColor: "bg-[#99F6E4] text-slate-900",
    borderColor: "border-[#99F6E4]/75",
    spotBorderColor: "border-[#99F6E4] shadow-[0_0_18px_rgba(153,246,228,0.5)]",
    tagColor: "bg-[#99F6E4]/18 text-[#99F6E4] border-[#99F6E4]/40",
    nextBtnColor: "bg-[#99F6E4] hover:bg-[#5EEAD4] text-slate-900",
    dotColor: "bg-[#99F6E4]",
    title: "뷰포트 2 · 하드웨어 데이터패스 회로도",
    buttons: [
      {
        label: "데이터패스 신호 애니메이션",
        desc: "Single-Cycle 또는 5-Stage Pipeline 회로도에서 클록별 데이터·제어 신호 이동 시각화",
      },
      {
        label: "줌·패닝 컨트롤",
        desc: "회로도 위에서 확대/축소, 드래그 이동 및 화면 맞춤(Fit) 제어",
      },
      {
        label: "하드웨어 모듈 클릭",
        desc: "ALU, 레지스터 파일, Imm Gen, MUX 등을 클릭해 내부 비트 연산 과정을 상세 확인",
      },
    ],
  },
  {
    id: "viewport-3",
    highlightId: "right-section",
    placement: "inside-section",
    viewportIndex: 2,
    mobileMode: "viewport",
    step: 8,
    badgeColor: "bg-[#D8B4FE] text-slate-900",
    borderColor: "border-[#D8B4FE]/75",
    spotBorderColor: "border-[#D8B4FE] shadow-[0_0_18px_rgba(216,180,254,0.5)]",
    tagColor: "bg-[#D8B4FE]/18 text-[#D8B4FE] border-[#D8B4FE]/40",
    nextBtnColor: "bg-[#D8B4FE] hover:bg-[#C084FC] text-slate-900",
    dotColor: "bg-[#D8B4FE]",
    title: "뷰포트 3 · 멀티사이클 타이밍 & CPI 성능",
    buttons: [
      {
        label: "MULTI-CYCLE DIAGRAM",
        desc: "클록(Cycle) × 명령어 표에서 IF·ID·EX·MEM·WB 진행과 스톨·플러시 발생 위치 확인",
      },
      {
        label: "PERFORMANCE & CPI",
        desc: "현재 클록까지의 CPI, IPC, 완수 명령어 수, 스톨·포워딩 횟수 및 버블 비율 분석",
      },
      {
        label: "PREV / NEXT & 하단 탭",
        desc: "데스크톱 PREV/NEXT 버튼 또는 모바일 하단 탭으로 3종 뷰포트를 자유롭게 이동",
      },
    ],
  },
  {
    id: "tutor-panel",
    highlightId: "tutor-panel",
    placement: "inside-section",
    viewportIndex: 0,
    mobileMode: "tutor",
    step: 9,
    badgeColor: "bg-[#A7F3D0] text-slate-900",
    borderColor: "border-[#A7F3D0]/75",
    spotBorderColor: "border-[#A7F3D0] shadow-[0_0_18px_rgba(167,243,208,0.5)]",
    tagColor: "bg-[#A7F3D0]/18 text-[#A7F3D0] border-[#A7F3D0]/40",
    nextBtnColor: "bg-[#A7F3D0] hover:bg-[#6EE7B7] text-slate-900",
    dotColor: "bg-[#A7F3D0]",
    title: "실시간 튜터 해설 (TUTOR)",
    buttons: [
      {
        label: "사이클·명령어 풀이",
        desc: "현재 클록(또는 클릭한 줄 번호)의 레지스터·메모리 변화와 해저드 원인을 실시간 해설",
      },
    ],
  },
  {
    id: "ai-assistant",
    highlightId: "ai-assistant",
    mobileHighlightId: "mobile-assistant",
    placement: "below-button",
    viewportIndex: 0,
    mobileMode: "assistant",
    step: 10,
    badgeColor: "bg-[#FBCFE8] text-slate-900",
    borderColor: "border-[#FBCFE8]/75",
    spotBorderColor: "border-[#FBCFE8] shadow-[0_0_16px_rgba(251,207,232,0.55)]",
    tagColor: "bg-[#FBCFE8]/18 text-[#FBCFE8] border-[#FBCFE8]/40",
    nextBtnColor: "bg-[#FBCFE8] hover:bg-[#F9A8D4] text-slate-900",
    dotColor: "bg-[#FBCFE8]",
    title: "AI 어시스턴트 질문 챗봇",
    buttons: [
      {
        label: "✨ AI 어시스턴트",
        desc: "현재 작성 코드(또는 드래그한 구간)와 클록 실행 상태를 첨부해 AI에게 질문",
      },
    ],
  },
];

const MEASURED_IDS = Array.from(
  new Set(
    TUTORIAL_STEPS.flatMap((s) =>
      s.mobileHighlightId ? [s.highlightId, s.mobileHighlightId] : [s.highlightId]
    )
  )
);

interface TutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onChangeViewport?: (index: number, mobileMode?: TutorialMobileMode) => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  isOpen,
  onClose,
  onChangeViewport,
}) => {
  const visible = isOpen;

  const [stepIndex, setStepIndex] = useState(0);
  const [rects, setRects] = useState<Record<string, TargetRect>>({});

  const totalSteps = TUTORIAL_STEPS.length;
  const currentItem = TUTORIAL_STEPS[stepIndex] ?? TUTORIAL_STEPS[0];

  // 데스크톱과 모바일에서 실제로 화면에 표시되고 있는(width > 0 && height > 0) 요소를 탐색하여 측정
  const measureTargets = useCallback(() => {
    if (typeof document === "undefined") return;
    const nextRects: Record<string, TargetRect> = {};
    for (const id of MEASURED_IDS) {
      const elements = document.querySelectorAll<HTMLElement>(
        `[data-tutorial-id="${id}"]`
      );
      for (const el of elements) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          nextRects[id] = {
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom,
            centerX: r.left + r.width / 2,
            centerY: r.top + r.height / 2,
          };
          break;
        }
      }
    }
    setRects(nextRects);
  }, []);

  const goToStep = useCallback(
    (nextIdx: number) => {
      const clamped = Math.max(0, Math.min(totalSteps - 1, nextIdx));
      setStepIndex(clamped);
      const targetStep = TUTORIAL_STEPS[clamped];
      if (targetStep) {
        onChangeViewport?.(targetStep.viewportIndex, targetStep.mobileMode);
      }
    },
    [totalSteps, onChangeViewport]
  );

  const handleClose = useCallback(() => {
    setStepIndex(0);
    onChangeViewport?.(0, "code");
    onClose();
  }, [onClose, onChangeViewport]);

  const handleHideToday = useCallback(() => {
    hideTutorialForToday();
    setStepIndex(0);
    onChangeViewport?.(0, "code");
    onClose();
  }, [onClose, onChangeViewport]);

  const handlePrev = useCallback(() => {
    goToStep(stepIndex - 1);
  }, [goToStep, stepIndex]);

  const handleNext = useCallback(() => {
    if (stepIndex >= totalSteps - 1) {
      handleClose();
    } else {
      goToStep(stepIndex + 1);
    }
  }, [stepIndex, totalSteps, handleClose, goToStep]);

  // 단계 전환 후 모바일 슬라이드 트랙 애니메이션(300ms) 및 모달 마운트 시점에 맞춰 연속 측정
  useEffect(() => {
    if (!visible) return;
    const rafId = window.requestAnimationFrame(measureTargets);
    const t1 = window.setTimeout(measureTargets, 120);
    const t2 = window.setTimeout(measureTargets, 340);
    window.addEventListener("resize", measureTargets);
    window.addEventListener("scroll", measureTargets, true);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", measureTargets);
      window.removeEventListener("scroll", measureTargets, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, stepIndex, measureTargets, handleClose, handleNext, handlePrev]);

  if (!visible) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  // 데스크톱 타깃이 숨겨져 있을 때(모바일 화면) mobileHighlightId 폴백 사용
  const activeRect =
    rects[currentItem.highlightId] ??
    (currentItem.mobileHighlightId ? rects[currentItem.mobileHighlightId] : undefined);
  const isSection = currentItem.placement === "inside-section";

  // 현재 활성 스텝 1개에 대한 말풍선 위치 계산 (모바일 하단 컨트롤은 위쪽에, 상단 컨트롤은 아래쪽에, 섹션은 내부 중앙에 배치)
  const getActiveCardPosition = (): {
    style?: React.CSSProperties;
    arrow?: { dir: "up" | "down"; left: number };
  } => {
    if (!activeRect) return {};

    if (currentItem.placement === "below-button") {
      const width = Math.min(310, vw - 24);
      const idealLeft = activeRect.centerX - width / 2;
      const left = Math.max(12, Math.min(vw - width - 12, idealLeft));
      const arrowLeft = Math.min(
        width - 16,
        Math.max(16, activeRect.centerX - left)
      );

      // 모바일 하단 컨트롤(화면 하단 절반에 위치한 버튼)일 때는 말풍선을 타깃 위쪽에 배치
      if (activeRect.top > vh * 0.55) {
        const bottom = Math.max(12, vh - activeRect.top + 12);
        return {
          style: { bottom, left, width },
          arrow: { dir: "down", left: arrowLeft },
        };
      }

      const top = activeRect.bottom + 12;
      return {
        style: { top, left, width },
        arrow: { dir: "up", left: arrowLeft },
      };
    }

    // 섹션(3, 4, 6~8 뷰포트, 9단계)은 해당 섹션 내부에 깔끔하게 배치 (모바일 폭에도 자동 맞춤)
    const isRightViewportStep = currentItem.highlightId === "right-section";
    const maxCardWidth = isRightViewportStep ? 375 : 320;
    const width = Math.min(
      maxCardWidth,
      vw - 24,
      Math.max(210, activeRect.width - 16)
    );
    const left = Math.max(
      12,
      Math.min(vw - width - 12, activeRect.left + (activeRect.width - width) / 2)
    );
    const estimatedHeight = isRightViewportStep ? 165 : 140;
    const rawTop = activeRect.top + (activeRect.height - estimatedHeight) / 2;
    const top = Math.max(
      54,
      Math.min(vh - estimatedHeight - 108, Math.max(activeRect.top + 10, rawTop))
    );
    return {
      style: { top, left, width },
    };
  };

  const { style: cardStyle, arrow } = getActiveCardPosition();

  const spotTop = activeRect
    ? isSection
      ? activeRect.top + 2
      : Math.max(2, activeRect.top - 3)
    : 0;
  const spotLeft = activeRect
    ? isSection
      ? activeRect.left + 2
      : Math.max(2, activeRect.left - 3)
    : 0;
  const spotWidth = activeRect
    ? isSection
      ? Math.max(0, activeRect.width - 4)
      : activeRect.width + 6
    : 0;
  const spotHeight = activeRect
    ? isSection
      ? Math.max(0, activeRect.height - 4)
      : activeRect.height + 6
    : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ArchReactor 시뮬레이터 사용법 튜토리얼"
      className="fixed inset-0 z-[100] flex flex-col select-none animate-in fade-in duration-150 overflow-hidden"
    >
      {/* 1. 스포트라이트 하이라이트 레이어 (데스크톱 및 모바일 공통 동작) */}
      {activeRect ? (
        <div
          style={{
            top: spotTop,
            left: spotLeft,
            width: spotWidth,
            height: spotHeight,
            boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.62)",
          }}
          className={`block fixed rounded-lg border-2 pointer-events-none z-[101] transition-all duration-200 ease-out ${currentItem.spotBorderColor}`}
        >
          {/* 섹션은 내부 좌상단에, 버튼은 좌상단 모서리에 파스텔 단계 번호 표시 */}
          <span
            className={`absolute ${
              isSection
                ? "top-2 left-2.5 px-2 h-6 text-[11px]"
                : "-top-2.5 -left-2.5 w-5 h-5 text-[10px]"
            } rounded-full font-black flex items-center justify-center shadow-lg ring-2 ring-slate-950 ${currentItem.badgeColor}`}
          >
            {currentItem.step}
          </span>
        </div>
      ) : (
        <div className="fixed inset-0 bg-slate-950/62 backdrop-blur-[1px] pointer-events-none z-[101]" />
      )}

      {/* 2. 최상단 헤더 바 (데스크톱 & 모바일 반응형): 워크플로우 진행 상태 및 제목 표시 */}
      <div className="relative z-[115] shrink-0 h-11 px-3 md:px-4 flex items-center justify-between gap-2 bg-slate-950/85 border-b border-white/15 backdrop-blur-md">
        <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] md:text-[10.5px] font-bold shrink-0 ${currentItem.badgeColor}`}
          >
            STEP {currentItem.step}/{totalSteps}
          </span>
          <h2 className="text-[11px] md:text-xs font-bold text-white truncate">
            {currentItem.title}
          </h2>
        </div>
      </div>

      {/* 3. 현재 워크플로우 단계의 어두운 설명 카드 + 파스텔 포인트 (데스크톱 & 모바일 위치 동기화) */}
      <div className="relative z-[110] flex-1 min-h-0 flex items-center justify-center p-3 md:p-0 pointer-events-none">
        <div
          style={activeRect ? cardStyle : undefined}
          className={`${
            activeRect ? "fixed" : "w-full max-w-sm"
          } pointer-events-auto rounded-xl bg-slate-900/95 text-white border ${
            currentItem.borderColor
          } p-3 md:p-3.5 shadow-2xl backdrop-blur-md transition-all duration-200 ease-out`}
        >
          {/* 상단 버튼을 가리키는 위쪽 세모 화살표(▲) */}
          {arrow?.dir === "up" && (
            <div
              style={{ left: arrow.left }}
              className={`block absolute -top-1.5 -translate-x-1/2 w-3 h-3 rotate-45 bg-slate-900 border-l border-t ${currentItem.borderColor}`}
            />
          )}

          {/* 모바일 하단 바를 가리키는 아래쪽 세모 화살표(▼) */}
          {arrow?.dir === "down" && (
            <div
              style={{ left: arrow.left }}
              className={`block absolute -bottom-1.5 -translate-x-1/2 w-3 h-3 rotate-45 bg-slate-900 border-r border-b ${currentItem.borderColor}`}
            />
          )}

          {/* 카드 상단 타이틀 */}
          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-5 h-5 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0 shadow-xs ${currentItem.badgeColor}`}
              >
                {currentItem.step}
              </span>
              <h4 className="text-xs font-bold text-white leading-tight truncate">
                {currentItem.title}
              </h4>
            </div>
            <span className="text-[10px] font-mono text-slate-400 shrink-0">
              {currentItem.step} / {totalSteps}
            </span>
          </div>

          {/* 버튼별 핵심 설명 리스트 */}
          <ul className="space-y-1.5">
            {currentItem.buttons.map((btn) => (
              <li
                key={btn.label}
                className="text-[10.5px] md:text-[11px] leading-snug flex items-baseline gap-1.5"
              >
                <span
                  className={`px-1.5 py-0.5 rounded font-mono font-bold text-[9.5px] md:text-[10px] border shrink-0 ${currentItem.tagColor}`}
                >
                  {btn.label}
                </span>
                <span className="text-slate-100 break-keep">{btn.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 4. 화면 하단 중앙 고정 컨트롤 바: 진행도 표시 & [이전] / [다음], 그 아래 [오늘 그만 보기] / [닫기] */}
      <div className="fixed bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 z-[120] pointer-events-auto flex flex-col items-center gap-2">
        <div className="flex items-center gap-3 px-3.5 py-2 rounded-full bg-slate-900/95 text-white border border-white/15 shadow-2xl backdrop-blur-md">
          {/* 스텝 점 인디케이터 */}
          <div className="flex items-center gap-1.5">
            {TUTORIAL_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goToStep(idx)}
                aria-label={`${s.step}단계: ${s.title}`}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === stepIndex
                    ? `w-4 ${currentItem.dotColor}`
                    : "w-1.5 bg-white/25 hover:bg-white/50"
                }`}
              />
            ))}
          </div>

          <span className="h-3.5 w-px bg-white/15 shrink-0" aria-hidden="true" />

          {/* 이전 / 다음 워크플로우 이동 버튼 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handlePrev}
              disabled={stepIndex === 0}
              className="h-7 px-2.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-35 disabled:pointer-events-none text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
            >
              이전
            </button>
            <button
              type="button"
              onClick={handleNext}
              className={`h-7 px-3.5 rounded-full text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-sm ${currentItem.nextBtnColor}`}
            >
              <span>{stepIndex === totalSteps - 1 ? "완료" : "다음"}</span>
              {stepIndex < totalSteps - 1 && (
                <span className="text-xs leading-none">→</span>
              )}
            </button>
          </div>
        </div>

        {/* 더 아래에 [오늘 그만 보기] & [닫기] */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleHideToday}
            className="h-6.5 px-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/15 text-[10.5px] font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow-md backdrop-blur-md whitespace-nowrap"
          >
            <span>오늘 그만 보기</span>
          </button>
          <button
            type="button"
            onClick={handleClose}
            aria-label="튜토리얼 닫기"
            className="h-6.5 px-2.5 rounded-full bg-[#BAE6FD] hover:bg-[#7DD3FC] text-slate-900 text-[10.5px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-md whitespace-nowrap"
          >
            <span>닫기</span>
            <span className="text-[11px] leading-none font-extrabold">✕</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
