import React, { useMemo, useEffect, useRef } from 'react';
import type { StageBuffer } from '@/type/simulation';
import type { FileSummary } from '@/type/file';

export interface CodeLineSelectInfo {
  tab: 'c' | 'asm';
  lineIndex: number;
  text: string;
  pc?: string;
  instruction?: string;
}

interface SourceViewerProps {
  activeTab: 'c' | 'asm';
  fileName?: string;
  content?: string;
  isLoggedIn?: boolean;
  savedFiles?: FileSummary[];
  selectedFileId?: string | null;
  onSelectSavedFile?: (fileId: string) => void;
  stageBuffers?: {
    IF?: StageBuffer | null;
    ID?: StageBuffer | null;
    EX?: StageBuffer | null;
    MEM?: StageBuffer | null;
    WB?: StageBuffer | null;
  };
  selectedLine?: CodeLineSelectInfo | null;
  onSelectLine?: (info: CodeLineSelectInfo) => void;
}

interface StageBadgeInfo {
  stage: string;
  badgeBg: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

const STAGES_CONFIG: {
  key: 'IF' | 'ID' | 'EX' | 'MEM' | 'WB';
  name: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
}[] = [
  { key: 'IF', name: 'IF', textColor: 'text-rose-700', bgColor: 'bg-rose-50/90', borderColor: 'border-l-4 border-rose-600', badgeBg: 'bg-rose-600 text-white' },
  { key: 'ID', name: 'ID', textColor: 'text-orange-700', bgColor: 'bg-orange-50/90', borderColor: 'border-l-4 border-orange-500', badgeBg: 'bg-orange-500 text-white' },
  { key: 'EX', name: 'EX', textColor: 'text-yellow-800', bgColor: 'bg-yellow-50/90', borderColor: 'border-l-4 border-yellow-400', badgeBg: 'bg-yellow-400 text-slate-900' },
  { key: 'MEM', name: 'MA', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50/90', borderColor: 'border-l-4 border-emerald-600', badgeBg: 'bg-emerald-600 text-white' },
  { key: 'WB', name: 'WB', textColor: 'text-blue-700', bgColor: 'bg-blue-50/90', borderColor: 'border-l-4 border-blue-600', badgeBg: 'bg-blue-600 text-white' },
];

// PC 주소 ↔ C언어 소스 코드 라인 인덱스(0-based) 매핑 테이블
export const PC_TO_C_LINE_MAP: Record<string, number> = {
  // main 함수 진입 & 스택 프레임 생성 ("int main() {")
  '0x00010094': 3,
  '0x00010098': 3,
  '0x0001009c': 3,
  '0x000100a0': 3,
  '0x000100a4': 3,
  '0x000100a8': 3,
  '0x000100ac': 3,

  // int a = 50;
  '0x000100b0': 4,
  '0x000100b4': 4,
  '0x000100b8': 4,

  // int b = 100;
  '0x000100bc': 5,
  '0x000100c0': 5,
  '0x000100c4': 5,
  '0x000100c8': 5,
  '0x000100cc': 5,

  // int c = 500;
  '0x000100d0': 6,

  // int d = 0;
  '0x000100d4': 7,

  // int div = c / d; (Zero division test)
  '0x000100d8': 9,

  // if (a == 50 && b == 100) {
  '0x000100dc': 10,
  '0x000100e0': 10,
  '0x000100e4': 10,
  '0x000100e8': 10,
  '0x000100ec': 10,
  '0x000100f0': 10,

  // printf("Pipeline Check OK\n");
  '0x000100f4': 11,
  '0x000100f8': 11,
  '0x000100fc': 11,
  '0x00010100': 11,
  '0x00010104': 11,
  '0x00010108': 11,
  '0x0001010c': 11,
  '0x00010110': 11,
  '0x00010114': 11,
  '0x00010118': 11,
  '0x0001011c': 11,
  '0x00010120': 11,
  '0x00010124': 11,
  '0x00010128': 11,
  '0x0001012c': 11,
  '0x00010130': 11,
  '0x00010134': 11,
  '0x00010144': 11,
  '0x00010148': 11,

  // return 0;
  '0x0001014c': 14,
  '0x00010150': 14,
  '0x00010154': 14,
  '0x00010158': 14,
  '0x0001017c': 14,
  '0x00010180': 14,
};

const SourceViewer: React.FC<SourceViewerProps> = ({ 
  activeTab, 
  fileName, 
  content, 
  isLoggedIn = false,
  savedFiles = [],
  selectedFileId = null,
  onSelectSavedFile,
  stageBuffers,
  selectedLine,
  onSelectLine,
}) => {
  const hasContent = !!content;
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // PC별 및 명령어 텍스트별 활성화된 파이프라인 단계 매핑 (어셈블리용)
  const { activeStagesByPc, activeStagesByInst } = useMemo(() => {
    const pcMap: Record<string, StageBadgeInfo[]> = {};
    const instMap: Record<string, StageBadgeInfo[]> = {};
    if (!stageBuffers) return { activeStagesByPc: pcMap, activeStagesByInst: instMap };

    STAGES_CONFIG.forEach(({ key, name, textColor, bgColor, borderColor, badgeBg }) => {
      const buf = stageBuffers[key];
      if (buf && buf.assembly && buf.assembly !== 'bubble' && buf.assembly !== 'empty') {
        const badge: StageBadgeInfo = { stage: name, badgeBg, textColor, bgColor, borderColor };
        if (buf.pc) {
          const pcKey = buf.pc.toLowerCase();
          if (!pcMap[pcKey]) {
            pcMap[pcKey] = [];
          }
          pcMap[pcKey].push(badge);
        }
        const normInst = buf.assembly.replace(/\s+/g, ' ').trim().toLowerCase();
        if (normInst) {
          if (!instMap[normInst]) {
            instMap[normInst] = [];
          }
          instMap[normInst].push(badge);
        }
      }
    });

    return { activeStagesByPc: pcMap, activeStagesByInst: instMap };
  }, [stageBuffers]);

  // C언어 라인 인덱스별 활성화된 파이프라인 단계 매핑 (C언어용)
  const activeStagesByCLine = useMemo(() => {
    const map: Record<number, StageBadgeInfo[]> = {};
    if (!stageBuffers) return map;

    STAGES_CONFIG.forEach(({ key, name, textColor, bgColor, borderColor, badgeBg }) => {
      const buf = stageBuffers[key];
      if (buf && buf.pc && buf.assembly !== 'bubble' && buf.assembly !== 'empty') {
        const pcKey = buf.pc.toLowerCase();
        const lineIdx = PC_TO_C_LINE_MAP[pcKey];
        if (lineIdx !== undefined) {
          if (!map[lineIdx]) {
            map[lineIdx] = [];
          }
          if (!map[lineIdx].some((item) => item.stage === name)) {
            map[lineIdx].push({ stage: name, badgeBg, textColor, bgColor, borderColor });
          }
        }
      }
    });

    return map;
  }, [stageBuffers]);

  // 활성 라인으로 부드러운 스크롤 이동
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeStagesByPc, activeStagesByCLine, activeTab]);

  const handleLineDoubleClick = (lineIndex: number, lineText: string) => {
    if (!onSelectLine) return;
    let linePc: string | undefined = undefined;
    let instPart = lineText.trim();

    if (activeTab === 'asm') {
      const pcMatch = lineText.match(/(0x[0-9a-fA-F]+)/);
      linePc = pcMatch ? pcMatch[1].toLowerCase() : undefined;
      const parts = lineText.split(':');
      instPart = parts.length > 1 ? parts.slice(1).join(':').trim() : lineText.trim();
    } else {
      const foundEntry = Object.entries(PC_TO_C_LINE_MAP).find(([_, cLine]) => cLine === lineIndex);
      linePc = foundEntry ? foundEntry[0] : undefined;
    }

    onSelectLine({
      tab: activeTab,
      lineIndex,
      text: lineText,
      pc: linePc,
      instruction: instPart,
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 text-left min-h-0">
      {(isLoggedIn || (hasContent && fileName)) && (
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600 flex items-center justify-between gap-2 shrink-0">
          {isLoggedIn ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <select
                value={selectedFileId || ''}
                onChange={(e) => {
                  if (e.target.value && onSelectSavedFile) {
                    onSelectSavedFile(e.target.value);
                  }
                }}
                className="max-w-full min-w-[160px] flex-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer truncate"
              >
                <option value="" disabled>
                  {fileName && !selectedFileId
                    ? `[로컬 파일] ${fileName}`
                    : savedFiles.length > 0
                    ? '내 저장 파일 선택...'
                    : '저장된 파일 없음'}
                </option>
                {savedFiles.map((f) => (
                  <option key={f.file_id} value={f.file_id}>
                    {activeTab === 'asm' && selectedFileId === f.file_id && fileName
                      ? `${f.title} (${fileName})`
                      : f.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="truncate">{fileName}</span>
          )}
          <span className="text-[10px] text-slate-400 font-normal shrink-0">
            더블클릭 시 튜터 해설 연동
          </span>
        </div>
      )}
      
      <div className="flex-1 py-2 overflow-auto">
        {hasContent ? (
          <div className="text-xs font-mono text-slate-800 whitespace-pre min-w-max">
            {content!.split('\n').map((line, i) => {
              // 탭 종류에 따라 매칭되는 파이프라인 단계 추출
              let activeStages: StageBadgeInfo[] | null = null;

              if (activeTab === 'asm') {
                const pcMatch = line.match(/(0x[0-9a-fA-F]+)/);
                const linePc = pcMatch ? pcMatch[1].toLowerCase() : null;
                if (linePc && activeStagesByPc[linePc]) {
                  activeStages = activeStagesByPc[linePc];
                } else {
                  const trimmedLine = line.replace(/#.*$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
                  if (trimmedLine && !trimmedLine.startsWith('.') && !trimmedLine.endsWith(':')) {
                    activeStages = activeStagesByInst[trimmedLine] || null;
                  }
                }
              } else {
                activeStages = activeStagesByCLine[i] || null;
              }

              const hasActiveStage = !!(activeStages && activeStages.length > 0);
              const primaryStage = activeStages?.[0] || null;
              const isSelected = selectedLine?.tab === activeTab && selectedLine?.lineIndex === i;

              // C 탭일 때는 단일 강조 스타일, ASM 탭일 때는 세부 단계별 스타일 적용
              const isCTab = activeTab === 'c';
              let lineBgClass = hasActiveStage
                ? isCTab
                  ? 'bg-blue-50/85 border-l-4 border-blue-500 shadow-xs'
                  : `${primaryStage?.bgColor} ${primaryStage?.borderColor} shadow-xs`
                : 'hover:bg-slate-100 border-l-4 border-transparent';

              if (isSelected) {
                lineBgClass = 'bg-indigo-50/90 border-l-4 border-indigo-600 shadow-xs ring-1 ring-indigo-400/50';
              }

              const numClass = isSelected
                ? 'text-indigo-600 font-bold'
                : hasActiveStage
                ? isCTab
                  ? 'text-blue-600 font-bold'
                  : `${primaryStage?.textColor} font-bold`
                : 'text-slate-400';

              const textClass = isSelected
                ? 'text-indigo-950 font-bold'
                : hasActiveStage
                ? isCTab
                  ? 'text-blue-900 font-bold'
                  : `${primaryStage?.textColor} font-bold`
                : 'text-slate-700';

              return (
                <div 
                  key={i} 
                  ref={hasActiveStage && activeStages?.some(s => s.stage === 'IF' || s.stage === 'ID') ? activeLineRef : null}
                  onDoubleClick={() => handleLineDoubleClick(i, line)}
                  title="더블클릭하여 튜터에서 상세 해설 보기"
                  className={`flex items-center leading-6 transition-colors duration-150 cursor-pointer select-text ${lineBgClass}`}
                >
                  <span className={`w-8 flex-shrink-0 text-right pr-2 select-none border-r border-slate-200 ${numClass}`}>
                    {i + 1}
                  </span>
                  
                  <span className={`pl-2 pr-4 flex-1 flex items-center justify-between ${textClass}`}>
                    <span>{line || ' '}</span>
                    {isSelected && (
                      <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] bg-indigo-600 text-white font-sans font-semibold tracking-tight shrink-0 shadow-2xs">
                        📌 튜터 연동 중
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 px-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-xs">{activeTab === 'c' ? '+ 버튼을 눌러 C언어 파일을 추가해주세요' : '실행 버튼을 눌러 파일을 변환하세요'}</p>
          </div>
        )}
      </div>

      {/* 하단 파이프라인 단계 색상 범례 (어셈블리 모드에서만 노출) */}
      {hasContent && activeTab === 'asm' && (
        <div className="px-3 py-1.5 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] shrink-0">
          <span className="font-semibold text-slate-500 text-[10px]">단계 색상:</span>
          <div className="flex items-center gap-1 text-[9px] font-bold">
            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">IF</span>
            <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">ID</span>
            <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 border border-yellow-300">EX</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">MA</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">WB</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SourceViewer;
