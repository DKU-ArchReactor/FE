// ========================================================
// 타입 정의: Split-Sliding 워크스페이스 레이아웃 시스템
// ========================================================
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
// - sec-4 (2번 뷰 - Timing): 상단 멀티사이클 다이어그램 / 중단 성능 지표(CPI) / 하단 해저드 진단
// - sec-5 (3번 뷰 - Pipeline): 파이프라인 데이터패스 회로도 시각화
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
      { type: 'single', panel: 'multiCycle', flexRatio: 1.8 },
      { type: 'single', panel: 'metrics', flexRatio: 0.7 },
      { type: 'single', panel: 'hazardDiag', flexRatio: 1.0 },
    ],
  },
  {
    id: 'sec-5',
    widthPercent: 100,
    slots: [
      { type: 'single', panel: 'pipeline', flexRatio: 1 },
    ],
  },
];
