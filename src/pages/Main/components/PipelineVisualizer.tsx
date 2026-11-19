import React, { useState } from 'react';
import type { CycleHistoryItem, SimulationResult } from '@/type/simulation';
import SingleCycleDatapath from './SingleCycleDatapath';

interface PipelineVisualizerProps {
  currentData: CycleHistoryItem | null;
  prevData?: CycleHistoryItem | null;
  simulationData?: SimulationResult | null;
  loadingMessage?: string | null;
  mode?: "single" | "pipeline";
}

const MASTER_WIDTH = 1060;
const MASTER_HEIGHT = 1290;

const PipelineVisualizer: React.FC<PipelineVisualizerProps> = ({
  currentData,
  prevData,
  simulationData,
  loadingMessage,
  mode = "pipeline",
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const isSingle = mode === "single";

  // Single-Cycle 모드에서는 온칩(ALU + 레지스터) ↔ 시스템 버스 ↔ DRAM 데이터패스 다이어그램 렌더링
  if (isSingle) {
    return (
      <SingleCycleDatapath
        currentData={currentData}
        prevData={prevData}
        simulationData={simulationData}
        loadingMessage={loadingMessage}
      />
    );
  }

  if (loadingMessage) {
    return (
      <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] p-6 flex flex-col items-center justify-center gap-3 text-center transition-colors duration-150">
        <div className="w-9 h-9 border-3 border-[var(--ar-accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-[var(--ar-accent)]">{loadingMessage}</p>
        <p className="text-xs text-[var(--ar-text-muted)]">컴파일 및 파이프라인 시뮬레이션 결과를 준비하고 있습니다.</p>
      </div>
    );
  }

  if (!currentData) {
    return (
      <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] p-6 flex items-center justify-center text-[var(--ar-text-muted)] text-sm transition-colors duration-150">
        C 소스 코드를 작성하고 [⚡ 컴파일]을 누르면 파이프라인 데이터패스가 활성화됩니다.
      </div>
    );
  }

  const { buffers, cycle_events, clock } = currentData;
  const isStall = !isSingle && cycle_events.stall?.has_stall;
  const isForward = !isSingle && cycle_events.forwarding?.has_forwarded;
  const isBranchFlush = !isSingle && cycle_events.control_hazard?.has_flush;

  // Single-cycle 모드: 1클럭에 1개 명령어 전체가 IF~WB 전 단계를 한 번에 통과
  // Pipeline 모드: 각 스테이지 버퍼에 개별 명령어가 순차적으로 위치
  const singleCycleInst = isSingle
    ? (buffers.IF?.assembly || currentData.stage_activity?.IF?.assembly || currentData.if_stage?.assembly || 'bubble')
    : null;
  const singleCyclePc = isSingle
    ? (buffers.IF?.pc || currentData.stage_activity?.IF?.pc || currentData.if_stage?.pc || currentData.global_result?.current_pc)
    : null;

  // PC 10진수 주소 변환
  const rawPc = isSingle
    ? (singleCyclePc || "0x00000000")
    : (buffers.IF?.pc ? buffers.IF.pc : "0x00000000");
  const parseDecimalPc = (pcVal?: string | number | null): string => {
    if (pcVal === null || pcVal === undefined) return "0";
    const str = String(pcVal).trim();
    if (!str || str === "bubble" || str === "empty") return "0";
    const num = str.startsWith("0x") || str.startsWith("0X")
      ? parseInt(str, 16)
      : parseInt(str, 10);
    return Number.isNaN(num) ? str : String(num);
  };
  const decimalPc = parseDecimalPc(rawPc);

  // 5단계별 명령어
  const ifInst = isSingle ? (singleCycleInst || 'bubble') : (buffers.IF?.assembly || 'bubble');
  const idInst = isSingle ? (singleCycleInst || 'bubble') : (buffers.ID?.assembly || 'bubble');
  const exInst = isSingle ? (singleCycleInst || 'bubble') : (buffers.EX?.assembly || 'bubble');
  const memInst = isSingle ? (singleCycleInst || 'bubble') : (buffers.MEM?.assembly || 'bubble');
  const wbInst = isSingle ? (singleCycleInst || 'bubble') : (buffers.WB?.assembly || 'bubble');

  // 활성 여부
  const isIfActive = ifInst !== 'bubble' && ifInst !== 'empty';
  const isIdActive = idInst !== 'bubble' && idInst !== 'empty';
  const isExActive = exInst !== 'bubble' && exInst !== 'empty';
  const isMemActive = memInst !== 'bubble' && memInst !== 'empty';
  const isWbActive = wbInst !== 'bubble' && wbInst !== 'empty';

  // 줌 조절
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(2.5, +(prev + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.5, +(prev - 0.15).toFixed(2)));
  const handleZoomReset = () => setZoomLevel(1.0);

  return (
    <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] flex flex-col justify-between overflow-hidden relative select-none min-h-0 transition-colors duration-150">
      {/* 동적 CSS 애니메이션 및 정밀 스트리밍 스타일 */}
      <style>{`
        @keyframes streamDown {
          from { stroke-dashoffset: 28; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes streamUp {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: 28; }
        }
        .stream-down-active {
          stroke-dasharray: 8 5;
          animation: streamDown 0.8s linear infinite;
        }
        .stream-feedback-active {
          stroke-dasharray: 9 5;
          animation: streamUp 1.1s linear infinite;
        }
        @keyframes pulseGlowAmber {
          0%, 100% { filter: drop-shadow(0 0 3px rgba(245, 158, 11, 0.35)); }
          50% { filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.8)); }
        }
        .glow-active-ex {
          animation: pulseGlowAmber 1.6s ease-in-out infinite;
        }
      `}</style>

      {/* 1. 상단 헤더 & 컨트롤러 */}
      <div className={`h-8 shrink-0 flex items-center justify-between px-3.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 border-l-2 ${isSingle ? "border-l-amber-500" : "border-l-blue-500"}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[11px] font-bold ${isSingle ? "text-amber-500" : "text-blue-500"}`}>◆</span>
          <h3 className="font-sans text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wide whitespace-nowrap">
            {isSingle ? "SINGLE-CYCLE DATAPATH" : "PIPELINE DATAPATH"}
          </h3>
          <span className="text-[10px] text-[var(--ar-text-muted)] font-mono">(CLK:{clock ?? 0})</span>
        </div>

        {/* 이벤트 뱃지 & 줌 컨트롤 */}
        <div className="flex items-center gap-1.5">
          {/* CRT 런타임 진입/초기화 식별 뱃지 */}
          {((ifInst && (ifInst.startsWith("auipc") || ifInst.startsWith("jal") || ifInst.startsWith("li") || ifInst.startsWith("csrw"))) ||
            (clock !== undefined && clock < 10 && !cycle_events.stall?.has_stall && !cycle_events.forwarding?.has_forwarded)) && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/30"
              title="C main() 진입 전 또는 종료 후 런타임 시스템 코드"
            >
              Runtime/CRT
            </span>
          )}
          {isSingle ? (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              Single-Cycle (No Hazard)
            </span>
          ) : (
            <>
              {isStall && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white animate-pulse shadow-2xs">
                  ⚠️ Stall
                </span>
              )}
              {isForward && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-600 text-white shadow-2xs">
                  ⇄ FWD
                </span>
              )}
              {isBranchFlush && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-white shadow-2xs">
                  🔄 Flush
                </span>
              )}
            </>
          )}
          <div className="flex items-center bg-[#F6F8FA] dark:bg-[#252526] border border-[#D0D7DE] dark:border-[#3E3E42] rounded px-1 py-0.5 text-[#57606A] dark:text-[#CCCCCC] text-[10px]">
            <button
              onClick={handleZoomOut}
              className="px-1 hover:text-[#005FB8] dark:hover:text-[#007ACC] font-bold cursor-pointer"
              title="축소"
            >
              −
            </button>
            <button
              onClick={handleZoomReset}
              className="px-1 font-mono font-semibold hover:text-[#005FB8] dark:hover:text-[#007ACC] cursor-pointer"
              title="100% (세로 맞춤)"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="px-1 hover:text-[#005FB8] dark:hover:text-[#007ACC] font-bold cursor-pointer"
              title="확대"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* 2. 고해상도 마스터 SVG 뷰포트:
           - 100%일 때 세로(height: 100%)를 꽉 채우고, SVG 고유 비율에 맞춰 가로 폭 자동 결정
           - overflow: "scroll"로 가로/세로 스크롤바 트랙 여백을 상시 100% 예약하여,
             스크롤바가 활성화되거나 비활성화되어도 다이어그램 크기가 일체 덜컹거리지 않음
           - transform: scale() 대신 실제 레이아웃 크기(height %)와 m-auto를 사용하여 확대 시 상하좌우 잘림 없이 스크롤 가능 */}
      <div
        className="flex-1 relative w-full min-h-0 p-1 custom-scrollbar flex overflow-x-scroll overflow-y-scroll"
        style={{ scrollbarGutter: "stable both-edges" }}
      >
        <div
          className="m-auto shrink-0 transition-[height] duration-150"
          style={{
            height: `${zoomLevel * 100}%`,
            aspectRatio: `${MASTER_WIDTH} / ${MASTER_HEIGHT}`,
          }}
        >
          <svg
            viewBox="-60 0 1060 1290"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full select-none block"
          >
            <defs>
              {/* 정밀 화살표 마커 (끝점 refX=8.5로 선 끝이 박스 경계에 정확히 닿도록 설정) */}
              <marker id="m-arr-def" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#94A3B8" />
              </marker>
              <marker id="m-arr-red" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#DC2626" />
              </marker>
              <marker id="m-arr-orange" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#EA580C" />
              </marker>
              <marker id="m-arr-amber" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#D97706" />
              </marker>
              <marker id="m-arr-green" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#16A34A" />
              </marker>
              <marker id="m-arr-blue" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#2563EB" />
              </marker>
              <marker id="m-arr-cyan" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#0891B2" />
              </marker>

              {/* 하드웨어 부품 그라데이션 */}
              <linearGradient id="g-pc" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FEE2E2" />
                <stop offset="100%" stopColor="#FECACA" />
              </linearGradient>
              <linearGradient id="g-imem" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#EFF6FF" />
                <stop offset="100%" stopColor="#DBEAFE" />
              </linearGradient>
              <linearGradient id="g-regfile" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F0FDF4" />
                <stop offset="100%" stopColor="#DCFCE7" />
              </linearGradient>
              <linearGradient id="g-dmem" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ECFDF5" />
                <stop offset="100%" stopColor="#D1FAE5" />
              </linearGradient>
              <linearGradient id="g-buffer" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F1F5F9" />
                <stop offset="50%" stopColor="#E2E8F0" />
                <stop offset="100%" stopColor="#F1F5F9" />
              </linearGradient>
            </defs>

            {/* ============================================================ */}
            {/* [좌측 레인] 스테이지 풀네임 뱃지 5개 (확대 규격: x=-52, w=122, h=54) */}
            {/* ============================================================ */}
            {/* IF: Instruction Fetch */}
            <rect x="-52" y="105" width="122" height="54" rx="8" fill="#EF4444" />
            <text x="9" y="126" fill="#FFFFFF" fontSize="15.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Instruction
            </text>
            <text x="9" y="146" fill="#FFFFFF" fontSize="15.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Fetch
            </text>

            {/* ID: Instruction Decode */}
            <rect x="-52" y="375" width="122" height="54" rx="8" fill="#F97316" />
            <text x="9" y="396" fill="#FFFFFF" fontSize="15.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Instruction
            </text>
            <text x="9" y="416" fill="#FFFFFF" fontSize="15.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Decode
            </text>

            {/* EX: Execute (1단어 중앙 정렬) */}
            <rect x="-52" y="670" width="122" height="54" rx="8" fill="#10B981" />
            <text x="9" y="697" dominantBaseline="central" fill="#FFFFFF" fontSize="18.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Execute
            </text>

            {/* MEM: Memory Access */}
            <rect x="-52" y="973" width="122" height="54" rx="8" fill="#0EA5E9" />
            <text x="9" y="994" fill="#FFFFFF" fontSize="15.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Memory
            </text>
            <text x="9" y="1014" fill="#FFFFFF" fontSize="15.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Access
            </text>

            {/* WB: Write Back */}
            <rect x="-52" y="1199" width="122" height="54" rx="8" fill="#8B5CF6" />
            <text x="9" y="1220" fill="#FFFFFF" fontSize="15.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Write
            </text>
            <text x="9" y="1240" fill="#FFFFFF" fontSize="15.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Back
            </text>

            {/* ============================================================ */}
            {/* [우측 레인] 어셈블리 명령어 뱃지 5개 (수직 1자 정렬: x=714, w=273) */}
            {/* ============================================================ */}
            {/* IF Inst */}
            <rect
              x="714"
              y="115"
              width="273"
              height="34"
              rx="6"
              fill={isIfActive ? "#FEF2F2" : "#F8FAFC"}
              stroke={isIfActive ? "#F87171" : "#E2E8F0"}
              strokeWidth="1.5"
            />
            <text
              x="850.5"
              y="137"
              fill={isIfActive ? "#991B1B" : "#94A3B8"}
              fontSize="14"
              fontFamily="'D2Coding', Consolas, monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {ifInst}
            </text>

            {/* ID Inst */}
            <rect
              x="714"
              y="385"
              width="273"
              height="34"
              rx="6"
              fill={isIdActive ? "#FFF7ED" : "#F8FAFC"}
              stroke={isIdActive ? "#FB923C" : "#E2E8F0"}
              strokeWidth="1.5"
            />
            <text
              x="850.5"
              y="407"
              fill={isIdActive ? "#C2410C" : "#94A3B8"}
              fontSize="14"
              fontFamily="'D2Coding', Consolas, monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {idInst}
            </text>

            {/* EX Inst */}
            <rect
              x="714"
              y="680"
              width="273"
              height="34"
              rx="6"
              fill={isExActive ? "#FEFCE8" : "#F8FAFC"}
              stroke={isExActive ? "#FACC15" : "#E2E8F0"}
              strokeWidth="1.5"
            />
            <text
              x="850.5"
              y="702"
              fill={isExActive ? "#854D0E" : "#94A3B8"}
              fontSize="14"
              fontFamily="'D2Coding', Consolas, monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {exInst}
            </text>

            {/* MEM Inst */}
            <rect
              x="714"
              y="983"
              width="273"
              height="34"
              rx="6"
              fill={isMemActive ? "#F0FDF4" : "#F8FAFC"}
              stroke={isMemActive ? "#4ADE80" : "#E2E8F0"}
              strokeWidth="1.5"
            />
            <text
              x="850.5"
              y="1005"
              fill={isMemActive ? "#15803D" : "#94A3B8"}
              fontSize="14"
              fontFamily="'D2Coding', Consolas, monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {memInst}
            </text>

            {/* WB Inst */}
            <rect
              x="714"
              y="1209"
              width="273"
              height="34"
              rx="6"
              fill={isWbActive ? "#EFF6FF" : "#F8FAFC"}
              stroke={isWbActive ? "#60A5FA" : "#E2E8F0"}
              strokeWidth="1.5"
            />
            <text
              x="850.5"
              y="1231"
              fill={isWbActive ? "#1D4ED8" : "#94A3B8"}
              fontSize="14"
              fontFamily="'D2Coding', Consolas, monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {wbInst}
            </text>

            {/* ============================================================ */}
            {/* [중앙 레인] 순수 데이터패스 본체                              */}
            {/* ============================================================ */}
            <g transform="translate(15, 0)">
            {/* 부품 1: PC (가로 확장 width=240, x=230, center=350, 가로 한 줄 10진수 표기) */}
            <rect
              x="230"
              y="68"
              width="240"
              height="52"
              rx="8"
              fill={isIfActive ? "url(#g-pc)" : "#FFFFFF"}
              stroke={isIfActive ? "#EF4444" : "#94A3B8"}
              strokeWidth="2"
            />
            <text
              x="260"
              y="94"
              dominantBaseline="central"
              className="select-none"
              fill={isIfActive ? "#991B1B" : "#1E293B"}
              fontSize="16"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              PC
            </text>
            <text
              x="300"
              y="94"
              dominantBaseline="central"
              textAnchor="middle"
              className="select-none"
              fill={isIfActive ? "#EF4444" : "#94A3B8"}
              fontSize="15"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              ➔
            </text>
            <text
              x="330"
              y="94"
              dominantBaseline="central"
              className="select-none"
              fill={isIfActive ? "#B91C1C" : "#0F172A"}
              fontSize="16"
              fontFamily="'D2Coding', Consolas, monospace"
              fontWeight="bold"
            >
              {decimalPc}
            </text>

            {/* PC ➔ Instruction Memory 직하강 화살표 */}
            <line
              x1="350"
              y1="120"
              x2="350"
              y2="148"
              stroke={isIfActive ? "#EF4444" : "#94A3B8"}
              strokeWidth="3.2"
              className={isIfActive ? "stream-down-active" : undefined}
              markerEnd={isIfActive ? "url(#m-arr-red)" : "url(#m-arr-def)"}
            />

            {/* PC ➔ PC + 4 Adder 분기 화살표 */}
            <path
              d="M 470,94 L 522,94"
              fill="none"
              stroke={isIfActive ? "#EF4444" : "#94A3B8"}
              strokeWidth="2.2"
              markerEnd={isIfActive ? "url(#m-arr-red)" : "url(#m-arr-def)"}
            />
            {/* PC + 4 가산기 */}
            <polygon
              points="525,74 615,74 595,114 545,114"
              fill="#F8FAFC"
              stroke="#94A3B8"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <text x="570" y="94" dominantBaseline="central" fill="#1E293B" fontSize="14" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              + 4
            </text>
            {/* PC + 4 루프백 피드백 화살표: 상단 y=28, 수직낙하 38px로 세로길이 최적화 */}
            <path
              d="M 570,114 L 570,134 L 635,134 L 635,28 L 350,28 L 350,66"
              fill="none"
              stroke="#94A3B8"
              strokeWidth="1.8"
              strokeDasharray="5 3"
              markerEnd="url(#m-arr-def)"
            />

            {/* 부품 2: Instruction Memory */}
            <rect
              x="200"
              y="150"
              width="300"
              height="64"
              rx="8"
              fill={isIfActive ? "url(#g-imem)" : "#FFFFFF"}
              stroke={isIfActive ? "#3B82F6" : "#94A3B8"}
              strokeWidth="2"
            />
            <text x="350" y="182" dominantBaseline="central" fill={isIfActive ? "#1E40AF" : "#1E293B"} fontSize="16" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Instruction Memory
            </text>

            {/* Instruction Memory ➔ IF/ID BUFFER 직하강 화살표 */}
            <line
              x1="350"
              y1="214"
              x2="350"
              y2="238"
              stroke={isIfActive ? "#DC2626" : "#94A3B8"}
              strokeWidth="3.2"
              className={isIfActive ? "stream-down-active" : undefined}
              markerEnd={isIfActive ? "url(#m-arr-red)" : "url(#m-arr-def)"}
            />

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 1: IF / ID BUFFER (Y = 240 ~ 266)             */}
            {/* ============================================================ */}
            <rect
              x="130"
              y="240"
              width="530"
              height="26"
              rx="6"
              fill="url(#g-buffer)"
              stroke="#94A3B8"
              strokeWidth="1.6"
            />
            <text
              x="395"
              y="258"
              fill="#1E293B"
              fontSize="13"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
              letterSpacing="2"
            >
              IF / ID BUFFER
            </text>

            {/* ============================================================ */}
            {/* [STAGE 2] INSTRUCTION DECODE (ID) : Y = 280 ~ 505            */}
            {/* ============================================================ */}
            {/* IF/ID BUFFER에서 Register File / Imm Gen / Control Unit으로 분기되는 명령어 버스 (중간점 y=306에서 꺾임) */}
            <path
              d="M 350,266 L 350,306 L 250,306 L 250,344"
              fill="none"
              stroke={isIdActive ? "#EA580C" : "#94A3B8"}
              strokeWidth="2.6"
              markerEnd={isIdActive ? "url(#m-arr-orange)" : "url(#m-arr-def)"}
            />
            <path
              d="M 350,306 L 490,306 L 490,344"
              fill="none"
              stroke={isIdActive ? "#EA580C" : "#94A3B8"}
              strokeWidth="2.2"
              markerEnd={isIdActive ? "url(#m-arr-orange)" : "url(#m-arr-def)"}
            />
            <path
              d="M 490,306 L 600,306 L 600,354"
              fill="none"
              stroke={isIdActive ? "#EA580C" : "#94A3B8"}
              strokeWidth="1.8"
              strokeDasharray="4 2"
              markerEnd={isIdActive ? "url(#m-arr-orange)" : "url(#m-arr-def)"}
            />

            {/* 부품 3: Registers (x=135, width=230) */}
            <rect
              x="135"
              y="346"
              width="230"
              height="112"
              rx="8"
              fill={isIdActive ? "url(#g-regfile)" : "#FFFFFF"}
              stroke={isIdActive ? "#16A34A" : "#94A3B8"}
              strokeWidth="2"
            />
            <text x="250" y="402" dominantBaseline="central" fill={isIdActive ? "#15803D" : "#1E293B"} fontSize="16" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Registers
            </text>

            {/* 부품 4: Imm Gen (타원형 rx=50, ry=48, cx=490) */}
            <ellipse
              cx="490"
              cy="402"
              rx="50"
              ry="48"
              fill={isIdActive ? "#F0F9FF" : "#FFFFFF"}
              stroke={isIdActive ? "#0284C7" : "#94A3B8"}
              strokeWidth="2"
            />
            <text x="490" y="402" dominantBaseline="central" fill={isIdActive ? "#0369A1" : "#1E293B"} fontSize="14" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Imm Gen
            </text>

            {/* 부품 5: Control Unit (cx=600, rx=40, ry=48) */}
            <ellipse
              cx="600"
              cy="402"
              rx="40"
              ry="48"
              fill="#F8FAFC"
              stroke="#94A3B8"
              strokeWidth="2"
            />
            <text x="600" y="394" fill="#1E293B" fontSize="14" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Control
            </text>
            <text x="600" y="412" fill="#1E293B" fontSize="14" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Unit
            </text>

            {/* ID 단계 출력 3개 버스 ➔ ID/EX BUFFER (Y = 458 ➔ 515) */}
            <line
              x1="210"
              y1="458"
              x2="210"
              y2="513"
              stroke={isIdActive ? "#EA580C" : "#94A3B8"}
              strokeWidth="3.2"
              className={isIdActive ? "stream-down-active" : undefined}
              markerEnd={isIdActive ? "url(#m-arr-orange)" : "url(#m-arr-def)"}
            />
            <line
              x1="320"
              y1="458"
              x2="320"
              y2="513"
              stroke={isIdActive ? "#EA580C" : "#94A3B8"}
              strokeWidth="3.2"
              className={isIdActive ? "stream-down-active" : undefined}
              markerEnd={isIdActive ? "url(#m-arr-orange)" : "url(#m-arr-def)"}
            />
            <path
              d="M 490,458 L 490,486 L 440,486 L 440,513"
              fill="none"
              stroke={isIdActive ? "#0284C7" : "#94A3B8"}
              strokeWidth="2.4"
              strokeDasharray="5 3"
              markerEnd={isIdActive ? "url(#m-arr-cyan)" : "url(#m-arr-def)"}
            />

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 2: ID / EX BUFFER (Y = 515 ~ 539)             */}
            {/* ============================================================ */}
            <rect
              x="130"
              y="515"
              width="530"
              height="26"
              rx="6"
              fill="url(#g-buffer)"
              stroke="#94A3B8"
              strokeWidth="1.6"
            />
            <text
              x="395"
              y="533"
              fill="#1E293B"
              fontSize="13"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
              letterSpacing="2"
            >
              ID / EX BUFFER
            </text>

            {/* ============================================================ */}
            {/* [STAGE 3] EXECUTE / ALU (EX) : Y = 555 ~ 830                 */}
            {/* ============================================================ */}
            {/* 1) Read Data 1 (X = 210) ➔ ALU 좌측 입력 포트(X = 210, Y = 668)로 직하강 */}
            <line
              x1="210"
              y1="541"
              x2="210"
              y2="666"
              stroke={isExActive ? "#D97706" : "#94A3B8"}
              strokeWidth="3.2"
              className={isExActive ? "stream-down-active" : undefined}
              markerEnd={isExActive ? "url(#m-arr-amber)" : "url(#m-arr-def)"}
            />

            {/* 2) Read Data 2 (X = 320) ➔ ALUSrc MUX 좌측 입력(X = 320, Y = 600) */}
            <line
              x1="320"
              y1="541"
              x2="320"
              y2="600"
              stroke={isExActive ? "#D97706" : "#94A3B8"}
              strokeWidth="2.8"
              markerEnd={isExActive ? "url(#m-arr-amber)" : "url(#m-arr-def)"}
            />

            {/* 3) Imm (X = 440) ➔ ALUSrc MUX 우측 입력(X = 380, Y = 600) 및 Branch Adder 분기 (중간점 y=570에서 꺾임) */}
            <path
              d="M 440,541 L 440,570 L 380,570 L 380,600"
              fill="none"
              stroke={isExActive ? "#0284C7" : "#94A3B8"}
              strokeWidth="2.4"
              strokeDasharray="5 3"
              markerEnd={isExActive ? "url(#m-arr-cyan)" : "url(#m-arr-def)"}
            />

            {/* ALUSrc MUX (알약형 / Stadium Capsule: x=300, y=600, w=100, h=36, rx=18) */}
            <rect
              x="300"
              y="600"
              width="100"
              height="36"
              rx="18"
              ry="18"
              fill={isExActive ? "#EFF6FF" : "#FFFFFF"}
              stroke={isExActive ? "#3B82F6" : "#94A3B8"}
              strokeWidth="2"
            />
            <text x="350" y="618" dominantBaseline="central" fill={isExActive ? "#1E40AF" : "#1E293B"} fontSize="14" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              MUX
            </text>

            {/* ALUSrc MUX 출력 (X = 350, Y = 636) ➔ ALU 우측 입력 포트(X = 350, Y = 668) */}
            <line
              x1="350"
              y1="636"
              x2="350"
              y2="666"
              stroke={isExActive ? "#D97706" : "#94A3B8"}
              strokeWidth="3.2"
              markerEnd={isExActive ? "url(#m-arr-amber)" : "url(#m-arr-def)"}
            />

            {/* 부품 6: ALU (교과서 완만한 V홈 사다리꼴 실루엣, center x=280) */}
            <g className={isExActive ? "glow-active-ex" : undefined}>
              <polygon
                points="
                  150,668
                  240,668
                  280,708
                  320,668
                  410,668
                  375,788
                  185,788
                "
                fill={isExActive ? "#FEF9C3" : "#FFFFFF"}
                stroke={isExActive ? "#D97706" : "#94A3B8"}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <text x="280" y="745" dominantBaseline="central" fill={isExActive ? "#78350F" : "#1E293B"} fontSize="16" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle" letterSpacing="2">
                ALU
              </text>
            </g>

            {/* 우측 Branch Adder */}
            <path
              d="M 440,570 L 440,605 L 560,605 L 560,683"
              fill="none"
              stroke="#94A3B8"
              strokeWidth="2"
              strokeDasharray="5 3"
              markerEnd="url(#m-arr-def)"
            />
            <polygon
              points="510,685 610,685 590,725 530,725"
              fill="#F8FAFC"
              stroke="#94A3B8"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <text x="560" y="705" dominantBaseline="central" fill="#1E293B" fontSize="14" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Branch Add
            </text>
            <line
              x1="560"
              y1="725"
              x2="560"
              y2="838"
              stroke="#94A3B8"
              strokeWidth="2"
              strokeDasharray="5 3"
              markerEnd="url(#m-arr-def)"
            />

            {/* ALU 출력(X = 280, Y = 788) ➔ EX/MEM BUFFER (Y = 840) 직하강 */}
            <line
              x1="280"
              y1="788"
              x2="280"
              y2="838"
              stroke={isExActive ? "#D97706" : "#94A3B8"}
              strokeWidth="3.4"
              className={isExActive ? "stream-down-active" : undefined}
              markerEnd={isExActive ? "url(#m-arr-amber)" : "url(#m-arr-def)"}
            />

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 3: EX / MEM BUFFER (Y = 840 ~ 864)            */}
            {/* ============================================================ */}
            <rect
              x="130"
              y="840"
              width="530"
              height="26"
              rx="6"
              fill="url(#g-buffer)"
              stroke="#94A3B8"
              strokeWidth="1.6"
            />
            <text
              x="395"
              y="858"
              fill="#1E293B"
              fontSize="13"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
              letterSpacing="2"
            >
              EX / MEM BUFFER
            </text>

            {/* ============================================================ */}
            {/* [STAGE 4] MEMORY ACCESS (MEM) : Y = 880 ~ 1095               */}
            {/* ============================================================ */}
            {/* EX/MEM 버퍼에서 내려온 ALU Result 분기 */}
            <path
              d="M 280,866 L 280,943"
              fill="none"
              stroke={isMemActive ? "#16A34A" : "#94A3B8"}
              strokeWidth="3.2"
              markerEnd={isMemActive ? "url(#m-arr-green)" : "url(#m-arr-def)"}
            />
            {/* EX/MEM 버퍼와 Data Memory 중간 위치(y=905)에서 분기되는 ALU Result Bypass */}
            <path
              d="M 280,905 L 195,905 L 195,1103"
              fill="none"
              stroke={isMemActive ? "#16A34A" : "#94A3B8"}
              strokeWidth="2.6"
              strokeDasharray="6 3"
              markerEnd={isMemActive ? "url(#m-arr-green)" : "url(#m-arr-def)"}
            />

            {/* 부품 7: Data Memory (미니멀 라운드 박스, x=240, width=280) */}
            <rect
              x="240"
              y="945"
              width="280"
              height="110"
              rx="8"
              fill={isMemActive ? "url(#g-dmem)" : "#FFFFFF"}
              stroke={isMemActive ? "#16A34A" : "#94A3B8"}
              strokeWidth="2"
            />
            <text x="380" y="1000" dominantBaseline="central" fill={isMemActive ? "#14532D" : "#1E293B"} fontSize="16" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              Data Memory
            </text>

            {/* Data Memory 출력 ➔ MEM/WB BUFFER */}
            <line
              x1="440"
              y1="1055"
              x2="440"
              y2="1103"
              stroke={isMemActive ? "#16A34A" : "#94A3B8"}
              strokeWidth="3.2"
              className={isMemActive ? "stream-down-active" : undefined}
              markerEnd={isMemActive ? "url(#m-arr-green)" : "url(#m-arr-def)"}
            />

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 4: MEM / WB BUFFER (Y = 1105 ~ 1131)          */}
            {/* ============================================================ */}
            <rect
              x="130"
              y="1105"
              width="530"
              height="26"
              rx="6"
              fill="url(#g-buffer)"
              stroke="#94A3B8"
              strokeWidth="1.6"
            />
            <text
              x="395"
              y="1123"
              fill="#1E293B"
              fontSize="13"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
              letterSpacing="2"
            >
              MEM / WB BUFFER
            </text>

            {/* ============================================================ */}
            {/* [STAGE 5] WRITE-BACK (WB) : Y = 1145 ~ 1320                  */}
            {/* ============================================================ */}
            {/* 1) ALU Result Bypass ➔ WB MUX 좌측 입력 (중간점 y=1168에서 꺾임) */}
            <path
              d="M 195,1131 L 195,1168 L 345,1168 L 345,1206"
              fill="none"
              stroke={isWbActive ? "#2563EB" : "#94A3B8"}
              strokeWidth="2.6"
              strokeDasharray="6 3"
              markerEnd={isWbActive ? "url(#m-arr-blue)" : "url(#m-arr-def)"}
            />

            {/* 2) Data Memory Read Data ➔ WB MUX 우측 입력 (중간점 y=1168에서 꺾임) */}
            <path
              d="M 440,1131 L 440,1168 L 405,1168 L 405,1206"
              fill="none"
              stroke={isWbActive ? "#2563EB" : "#94A3B8"}
              strokeWidth="3"
              markerEnd={isWbActive ? "url(#m-arr-blue)" : "url(#m-arr-def)"}
            />

            {/* 부품 8: WB MUX (알약형 / Stadium Capsule: x=325, y=1208, w=100, h=36, rx=18) */}
            <rect
              x="325"
              y="1208"
              width="100"
              height="36"
              rx="18"
              ry="18"
              fill={isWbActive ? "#DBEAFE" : "#FFFFFF"}
              stroke={isWbActive ? "#2563EB" : "#94A3B8"}
              strokeWidth="2"
            />
            <text x="375" y="1226" dominantBaseline="central" fill={isWbActive ? "#1E40AF" : "#1E293B"} fontSize="14" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              MUX
            </text>

            {/* ============================================================ */}
            {/* ★ 역방향 피드백 버스 (WB MUX ➔ ID RegFile Write Data In)     */}
            {/* ============================================================ */}
            <path
              d="M 375,1244 L 375,1275 L 85,1275 L 85,402 L 135,402"
              fill="none"
              stroke={isWbActive ? "#2563EB" : "#CBD5E1"}
              strokeWidth={isWbActive ? "3.4" : "2.2"}
              strokeDasharray={isWbActive ? "9 5" : undefined}
              className={isWbActive ? "stream-feedback-active" : undefined}
              markerEnd={isWbActive ? "url(#m-arr-blue)" : "url(#m-arr-def)"}
            />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default PipelineVisualizer;