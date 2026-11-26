import { useEffect, useState } from "react";

// ========================================================
// 타입 정의: Split-Sliding 워크스페이스 레이아웃 시스템
// ========================================================

/** 모바일 뷰포트 분기 기준 너비 (이 픽셀 미만일 때 모바일 뷰 레이아웃 및 인터랙션 적용) */
export const MOBILE_VIEW_BREAKPOINT = 1024;

/** 현재 브라우저 뷰포트가 모바일 기준(MOBILE_VIEW_BREAKPOINT 미만)인지 판별 */
export const isMobileViewport = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.innerWidth === "number" &&
  window.innerWidth < MOBILE_VIEW_BREAKPOINT;

/** 창 크기 변경에 실시간 반응하여 MOBILE_VIEW_BREAKPOINT 기반 모바일 뷰 여부를 반환하는 훅 */
export const useIsMobileViewport = (): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(() => isMobileViewport());

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function"
    ) {
      return;
    }
    const handleResize = () => {
      setIsMobile(isMobileViewport());
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
};

export type PanelKey =
  | 'cSource'
  | 'source'
  | 'tutor'
  | 'pipeline'
  | 'registers'
  | 'memory'
  | 'multiCycle'
  | 'metrics'
  | 'hazardDiag';

// 한 층(슬롯): 단일 컴포넌트 또는 가로 2개 묶음(Pair)
export type SlotItem =
  | { type: 'single'; panel: PanelKey; flexRatio?: number }
  | { type: 'pair'; left: PanelKey; right: PanelKey; flexRatio?: number; pairRatio?: number };

// 우측 슬라이딩 뷰포트 구역 (총 3개 뷰포트: State / Timing / Pipeline)
export interface SectionConfig {
  id: string;
  widthPercent: number;
  slots: SlotItem[];
}

// 우측 슬라이딩 뷰포트 3개 섹션 기본 레이아웃:
// - sec-3 (1번 뷰 - State): 좌측 Registers / 우측 Memory (Pair 좌우 분할 구조)
// - sec-4 (2번 뷰 - Pipeline): 파이프라인 데이터패스 회로도 시각화
// - sec-5 (3번 뷰 - Timing): 상단 멀티사이클 다이어그램 / 하단 고정 높이 성능 지표(CPI)
export const getDefaultSections = (): SectionConfig[] => [
  {
    id: 'sec-3',
    widthPercent: 100,
    slots: [
      { type: 'pair', left: 'registers', right: 'memory', flexRatio: 1, pairRatio: 50 },
    ],
  },
  {
    id: 'sec-4',
    widthPercent: 100,
    slots: [
      { type: 'single', panel: 'pipeline', flexRatio: 1 },
    ],
  },
  {
    id: 'sec-5',
    widthPercent: 100,
    slots: [
      { type: 'single', panel: 'multiCycle', flexRatio: 1 },
      { type: 'single', panel: 'metrics' },
    ],
  },
];
