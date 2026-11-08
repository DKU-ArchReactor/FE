import React from 'react';
import type { SimulationResult, CycleHistoryItem } from '@/type/simulation';

interface HazardDiagnosticsProps {
  simulationData: SimulationResult | null;
  currentCycleData: CycleHistoryItem | null;
  currentCycle: number;
}

export const HazardDiagnostics: React.FC<HazardDiagnosticsProps> = ({
  simulationData,
  currentCycleData,
  currentCycle,
}) => {
  const isSingle =
    simulationData?.simulator?.mode === 'single' ||
    simulationData?.simulator?.pipeline_model === 'single-cycle';

  if (!simulationData || !currentCycleData || (isSingle && currentCycle === 0)) {
    return (
      <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] flex flex-col min-h-0 overflow-hidden select-none transition-colors duration-150">
        <div className="shrink-0 flex items-center justify-between px-3.5 py-1.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 border-l-2 border-l-rose-500">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs">💡</span>
            <h3 className="text-xs font-semibold text-[var(--ar-text-primary)] whitespace-nowrap">
              Hazard & Stall Diagnostics
            </h3>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-[#57606A] dark:text-[#858585] gap-1 bg-[#F8F8F8] dark:bg-[#1E1E1E]">
          <span className="text-sm font-semibold text-[#1F2328] dark:text-[#CCCCCC]">대기 중</span>
          <span className="text-[11px] text-[#57606A] dark:text-[#858585]">
            시뮬레이션을 재생하면 각 사이클별 해저드 원인이 실시간 분석됩니다.
          </span>
        </div>
      </div>
    );
  }

  const { cycle_events, buffers } = currentCycleData;
  const isStall = cycle_events.stall?.has_stall;
  const isForward = cycle_events.forwarding?.has_forwarded;
  const isBranchFlush = cycle_events.control_hazard?.has_flush;

  return (
    <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] flex flex-col min-h-0 overflow-hidden select-none transition-colors duration-150">
      {/* 1. 상단 타이틀 바 (하저드 전용 로즈/오렌지 액센트 바) */}
      <div className="shrink-0 flex items-center justify-between px-3.5 py-1.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 border-l-2 border-l-rose-500">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs">💡</span>
          <h3 className="text-xs font-semibold text-[var(--ar-text-primary)] whitespace-nowrap">
            Hazard & Stall Diagnostics
          </h3>
        </div>
        <span className="text-[10px] font-mono font-semibold text-[#57606A] dark:text-[#858585]">
          Cycle {currentCycle}
        </span>
      </div>

      {/* 2. 실시간 진단 카드 내용 */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2 min-h-0">
        {/* 상태 태그 배지들 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {isStall && (
            <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 text-[10px] font-bold border border-red-200 dark:border-red-800 animate-pulse">
              🔴 Data Hazard (Stall)
            </span>
          )}
          {isForward && (
            <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
              🟡 Forwarding 활성화
            </span>
          )}
          {isBranchFlush && (
            <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 text-[10px] font-bold border border-purple-200 dark:border-purple-800">
              🟣 Control Hazard (Flush)
            </span>
          )}
          {!isStall && !isForward && !isBranchFlush && (
            <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
              🟢 Normal Execution (스톨 없음)
            </span>
          )}
        </div>

        {/* 상세 설명 텍스트 박스 */}
        <div className="p-2.5 rounded-lg bg-[#F6F8FA] dark:bg-[#252526] border border-[#D0D7DE] dark:border-[#3E3E42] text-xs leading-relaxed flex flex-col gap-1.5 text-[#24292F] dark:text-[#CCCCCC]">
          {isStall && (
            <div>
              <p className="font-bold text-red-600 dark:text-red-400">
                [Load-Use Hazard 감지]
              </p>
              <p className="text-[11px] text-[#57606A] dark:text-[#858585] mt-0.5">
                {cycle_events.stall.stall_desc ||
                  '메모리 로드(lw) 명령어의 결과를 바로 다음 명령어가 참조하여 1사이클 버블이 삽입되었습니다.'}
              </p>
            </div>
          )}

          {isForward && (
            <div>
              <p className="font-bold text-amber-700 dark:text-amber-400">
                [하드웨어 데이터 포워딩]
              </p>
              <p className="text-[11px] text-[#57606A] dark:text-[#858585] mt-0.5">
                {cycle_events.forwarding.forwarding_desc ||
                  '이전 명령어의 연산 결과를 레지스터에 기록되기 전에 파이프라인 버퍼에서 직접 당겨와 스톨을 방지했습니다.'}
              </p>
            </div>
          )}

          {isBranchFlush && (
            <div>
              <p className="font-bold text-purple-700 dark:text-purple-400">
                [분기 플러시 발생]
              </p>
              <p className="text-[11px] text-[#57606A] dark:text-[#858585] mt-0.5">
                {cycle_events.control_hazard.flush_reason ||
                  '분기(Branch/Jump) 예측이 실패하거나 점프가 확정되어 잘못 인출된 앞선 명령어들을 파이프라인에서 비웠습니다.'}
              </p>
            </div>
          )}

          {!isStall && !isForward && !isBranchFlush && (
            <p className="text-[11px] text-[#57606A] dark:text-[#858585]">
              현재 사이클에서는 해저드나 분기 지연 없이 모든 파이프라인 스테이지가 원활하게 진행되고 있습니다.
            </p>
          )}
        </div>

        {/* 현재 파이프라인에 물려있는 핵심 명령어 힌트 */}
        <div className="mt-auto pt-1 border-t border-[#E5E5E5] dark:border-[#333333] flex items-center justify-between text-[10px] text-[#8C959F] dark:text-[#6E7681] font-mono">
          <span>EX: {buffers.EX?.assembly || 'bubble'}</span>
          <span>MEM: {buffers.MEM?.assembly || 'bubble'}</span>
          <span>WB: {buffers.WB?.assembly || 'bubble'}</span>
        </div>
      </div>
    </div>
  );
};

export default HazardDiagnostics;

