// ========================================================
// 타입 정의: 가로 5섹션 슬롯 기반 슬라이드 레이아웃 시스템
// ========================================================
export type PanelKey =
  | 'cSource'
  | 'fileList'
  | 'source'
  | 'tutor'
  | 'pipeline'
  | 'state'
  | 'registers'
  | 'memory'
  | 'queues'
  | 'ioDevice'
  | 'aiPanel';

export const PANEL_METAS: Record<PanelKey, { label: string; icon: string; fullName: string }> = {
  cSource: { label: 'C 코드', icon: '📄', fullName: 'C 언어 소스 코드 뷰어' },
  fileList: { label: '파일 목록', icon: '📁', fullName: 'File List' },
  source: { label: 'ASM/코드', icon: '💻', fullName: '어셈블리 / 소스 코드 뷰어' },
  tutor: { label: '튜터', icon: '🎓', fullName: 'AI 튜터 (명령어 실시간 해설)' },
  pipeline: { label: '시각화', icon: '⚡', fullName: '파이프라인 회로도 시각화' },
  state: { label: '레지스터·메모리', icon: '🗄️', fullName: '레지스터 & 메모리 아키텍처 통합 뷰' },
  registers: { label: '레지스터', icon: '📋', fullName: '레지스터 상태 테이블' },
  memory: { label: '메모리', icon: '💾', fullName: '메모리 스냅샷 테이블' },
  queues: { label: 'Queues', icon: '📥', fullName: 'Queues' },
  ioDevice: { label: 'IO Device', icon: '🔌', fullName: 'IO Device' },
  aiPanel: { label: 'AI', icon: '✨', fullName: '생성형 AI 연동 센터' },
};

export const ALL_PANEL_KEYS: PanelKey[] = [
  'cSource',
  'fileList',
  'source',
  'tutor',
  'pipeline',
  'state',
  'queues',
  'ioDevice',
  'aiPanel',
];

// 한 층(슬롯): 단일 컴포넌트 또는 가로 2개 묶음(Pair)
export type SlotItem = 
  | { type: 'single'; panel: PanelKey; flexRatio?: number }
  | { type: 'pair'; left: PanelKey; right: PanelKey; flexRatio?: number; pairRatio?: number };

// 한 구역(Column / Section): 총 5개 구역 (한 화면에 3개 구역씩 노출)
export interface SectionConfig {
  id: string;
  widthPercent: number; // 뷰포트 대비 너비 비율 (%) - 기본 33.33% (3개 섹션 = 100%)
  slots: SlotItem[];    // 한 구역당 세로 슬롯(층)
}

// 5개 섹션 기본 레이아웃:
// 1섹션: 상단 C언어 / 하단 File List
// 2섹션: 상단 ASM(Execution에선 C/ASM 전환) / 하단 튜터
// 3섹션: 상단 레지스터 / 가운데 브릿지 / 하단 메모리 (StateVisualizer 아키텍처 상태)
// 4섹션: 파이프라인 시각화 (회로도 및 5단계 스테이지)
// 5섹션: 상단 Queues / 하단 IO Device
export const getDefaultSections = (): SectionConfig[] => [
  {
    id: 'sec-1',
    widthPercent: 28,
    slots: [
      { type: 'single', panel: 'cSource', flexRatio: 1.2 },
      { type: 'single', panel: 'fileList', flexRatio: 0.8 },
    ],
  },
  {
    id: 'sec-2',
    widthPercent: 28,
    slots: [
      { type: 'single', panel: 'source', flexRatio: 1.1 },
      { type: 'single', panel: 'tutor', flexRatio: 0.9 },
    ],
  },
  {
    id: 'sec-3',
    widthPercent: 38,
    slots: [
      { type: 'single', panel: 'state', flexRatio: 1 },
    ],
  },
  {
    id: 'sec-4',
    widthPercent: 34,
    slots: [
      { type: 'single', panel: 'pipeline', flexRatio: 1 },
    ],
  },
  {
    id: 'sec-5',
    widthPercent: 28,
    slots: [
      { type: 'single', panel: 'queues', flexRatio: 1 },
      { type: 'single', panel: 'ioDevice', flexRatio: 1 },
    ],
  },
];
