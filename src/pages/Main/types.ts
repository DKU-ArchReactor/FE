// ========================================================
// 타입 정의: 슬롯 기반 동적 레이아웃 시스템
// ========================================================
export type PanelKey = 'source' | 'tutor' | 'pipeline' | 'state' | 'registers' | 'memory' | 'aiPanel';

export const PANEL_METAS: Record<PanelKey, { label: string; icon: string; fullName: string }> = {
  pipeline: { label: '시각화', icon: '⚡', fullName: '파이프라인 회로도 시각화' },
  source: { label: '코드', icon: '💻', fullName: '소스 코드 뷰어 (C/ASM)' },
  tutor: { label: '튜터', icon: '🎓', fullName: 'AI 튜터 (명령어 실시간 해설)' },
  state: { label: '레지스터·메모리', icon: '🗄️', fullName: '레지스터 & 메모리 아키텍처 통합 뷰' },
  registers: { label: '레지스터', icon: '📋', fullName: '레지스터 상태 테이블' },
  memory: { label: '메모리', icon: '💾', fullName: '메모리 스냅샷 테이블' },
  aiPanel: { label: 'AI', icon: '✨', fullName: '생성형 AI 연동 센터' },
};

export const ALL_PANEL_KEYS: PanelKey[] = ['pipeline', 'source', 'tutor', 'state', 'aiPanel'];

// 한 층(슬롯): 단일 컴포넌트 또는 가로 2개 묶음(Pair)
export type SlotItem = 
  | { type: 'single'; panel: PanelKey; flexRatio?: number }
  | { type: 'pair'; left: PanelKey; right: PanelKey; flexRatio?: number; pairRatio?: number };

// 한 구역(Column / Section): 최대 4개 구역까지 생성 가능
export interface SectionConfig {
  id: string;
  widthPercent: number; // 너비 비율 (%)
  slots: SlotItem[];    // 한 구역당 최대 3개 슬롯(층)
}

// 기본 시작 레이아웃 (코드|시각화|AI, 튜터|레지스터,메모리|)
export const getDefaultSections = (): SectionConfig[] => [
  {
    id: 'sec-1',
    widthPercent: 26,
    slots: [
      { type: 'single', panel: 'source', flexRatio: 1 },
      { type: 'single', panel: 'tutor', flexRatio: 1 },
    ],
  },
  {
    id: 'sec-2',
    widthPercent: 52,
    slots: [
      { type: 'single', panel: 'pipeline', flexRatio: 1.7 },
      { type: 'single', panel: 'state', flexRatio: 1.1 },
    ],
  },
  {
    id: 'sec-3',
    widthPercent: 22,
    slots: [
      { type: 'single', panel: 'aiPanel', flexRatio: 1 },
    ],
  },
];
