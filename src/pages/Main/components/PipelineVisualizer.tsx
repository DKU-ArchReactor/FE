import React, { useState } from 'react';
import type { CycleHistoryItem } from '@/type/simulation';

interface PipelineVisualizerProps {
  currentData: CycleHistoryItem | null;
  loadingMessage?: string | null;
  mode?: "single" | "pipeline";
}

const MASTER_WIDTH = 900;
const MASTER_HEIGHT = 1350;

const PipelineVisualizer: React.FC<PipelineVisualizerProps> = ({ currentData, loadingMessage, mode = "pipeline" }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const isSingle = mode === "single";

  // Single-Cycle 모드에서는 파이프라인 5단계 분할 회로도가 맞지 않으므로 싱글모드 전용 다이어그램 개발 전까지 숨김/안내 처리
  if (isSingle) {
    return (
      <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] p-8 flex flex-col items-center justify-center gap-3 text-center transition-colors duration-150 select-none">
        <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-2xl shadow-xs">
          📐
        </div>
        <div className="flex flex-col gap-1 max-w-md">
          <h3 className="text-sm font-bold text-[var(--ar-text-primary)]">
            Single-Cycle 전용 데이터패스 다이어그램 준비 중
          </h3>
          <p className="text-xs text-[var(--ar-text-muted)] leading-relaxed">
            단일 사이클 모드에서는 5단계 파이프라인 레지스터가 없는 전용 단일 사이클 하드웨어 다이어그램이 적용될 예정입니다.
          </p>
        </div>
      </div>
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
           - 100%일 때 세로(height: 100%)를 꽉 채우고, SVG 고유 비율(900:1350 = 2:3)에 맞춰 가로 폭 자동 결정
           - transform: scale() 대신 실제 레이아웃 크기(height %)와 m-auto를 사용하여 확대 시 상하좌우 잘림 없이 스크롤 가능 */}
      <div className="flex-1 overflow-auto relative w-full min-h-0 p-1 custom-scrollbar flex">
        <div
          className="m-auto shrink-0 transition-[height] duration-150"
          style={{
            height: `${zoomLevel * 100}%`,
            aspectRatio: `${MASTER_WIDTH} / ${MASTER_HEIGHT}`,
          }}
        >
          <svg
            viewBox={`0 0 ${MASTER_WIDTH} ${MASTER_HEIGHT}`}
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
            {/* [STAGE 1] INSTRUCTION FETCH (IF) : Y = 20 ~ 215               */}
            {/* ============================================================ */}
            {/* 스테이지 헤더 & 명령어 뱃지 (전 스테이지 공통 규격: X=570, W=260, H=30) */}
            <text x="115" y="42" fill="#DC2626" fontSize="16" fontWeight="800">
              1. IF (Instruction Fetch)
            </text>
            <rect
              x="570"
              y="22"
              width="260"
              height="30"
              rx="8"
              fill={isIfActive ? "#FEF2F2" : "#F8FAFC"}
              stroke={isIfActive ? "#F87171" : "#CBD5E1"}
              strokeWidth="1.8"
            />
            <text
              x="700"
              y="42"
              fill={isIfActive ? "#991B1B" : "#94A3B8"}
              fontSize="13"
              fontFamily="'D2Coding', Consolas, monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {ifInst}
            </text>

            {/* 부품 1: PC (중심 X = 430, Y = 72 ~ 116) */}
            <rect
              x="355"
              y="72"
              width="150"
              height="44"
              rx="8"
              fill={isIfActive ? "url(#g-pc)" : "#FFFFFF"}
              stroke={isIfActive ? "#EF4444" : "#94A3B8"}
              strokeWidth="2.2"
            />
            <text x="430" y="92" fill="#991B1B" fontSize="14" fontWeight="800" textAnchor="middle">
              PC
            </text>
            <text x="430" y="109" fill="#B91C1C" fontSize="11.5" fontFamily="monospace" fontWeight="600" textAnchor="middle">
              {isSingle ? (singleCyclePc || "0x00000000") : (buffers.IF?.pc ? buffers.IF.pc : "0x00000000")}
            </text>

            {/* PC ➔ Instruction Memory 직하강 화살표 (X = 430, Y = 116 ➔ 148) */}
            <line
              x1="430"
              y1="116"
              x2="430"
              y2="146"
              stroke={isIfActive ? "#EF4444" : "#94A3B8"}
              strokeWidth="3.2"
              className={isIfActive ? "stream-down-active" : undefined}
              markerEnd={isIfActive ? "url(#m-arr-red)" : "url(#m-arr-def)"}
            />

            {/* PC ➔ PC + 4 Adder 분기 화살표 (X = 505 ➔ 645, Y = 94) */}
            <path
              d="M 505,94 L 642,94"
              fill="none"
              stroke={isIfActive ? "#EF4444" : "#94A3B8"}
              strokeWidth="2.2"
              markerEnd={isIfActive ? "url(#m-arr-red)" : "url(#m-arr-def)"}
            />
            {/* PC + 4 가산기 (중심 X = 695, Y = 76 ~ 112) */}
            <polygon
              points="645,76 745,76 725,112 665,112"
              fill="#F8FAFC"
              stroke="#94A3B8"
              strokeWidth="1.8"
            />
            <text x="695" y="99" fill="#475569" fontSize="12" fontWeight="800" textAnchor="middle">
              PC + 4
            </text>
            {/* PC + 4 루프백 피드백 화살표 (우측 위로 돌아 PC 상단으로 진입) */}
            <path
              d="M 695,112 L 695,128 L 785,128 L 785,60 L 430,60 L 430,70"
              fill="none"
              stroke="#94A3B8"
              strokeWidth="1.6"
              strokeDasharray="5 3"
              markerEnd="url(#m-arr-def)"
            />
            <text x="792" y="98" fill="#64748B" fontSize="10.5" fontWeight="600">
              Next PC
            </text>

            {/* 부품 2: Instruction Memory (중심 X = 430, Y = 148 ~ 208) */}
            <rect
              x="290"
              y="148"
              width="280"
              height="60"
              rx="10"
              fill={isIfActive ? "url(#g-imem)" : "#FFFFFF"}
              stroke={isIfActive ? "#3B82F6" : "#94A3B8"}
              strokeWidth="2.5"
            />
            <text x="430" y="175" fill="#1E40AF" fontSize="15.5" fontWeight="800" textAnchor="middle">
              Instruction Memory
            </text>
            <text x="430" y="196" fill="#64748B" fontSize="11.5" fontFamily="monospace" textAnchor="middle">
              Read Inst [31:0] @ PC
            </text>

            {/* Instruction Memory ➔ IF/ID BUFFER 직하강 화살표 (X = 430, Y = 208 ➔ 240) */}
            <line
              x1="430"
              y1="208"
              x2="430"
              y2="238"
              stroke={isIfActive ? "#DC2626" : "#94A3B8"}
              strokeWidth="3.2"
              className={isIfActive ? "stream-down-active" : undefined}
              markerEnd={isIfActive ? "url(#m-arr-red)" : "url(#m-arr-def)"}
            />

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 1: IF / ID BUFFER (Y = 240 ~ 264)             */}
            {/* ============================================================ */}
            <rect
              x="115"
              y="240"
              width="715"
              height="24"
              rx="5"
              fill="url(#g-buffer)"
              stroke="#94A3B8"
              strokeWidth="1.5"
            />
            <text
              x="472"
              y="256"
              fill="#334155"
              fontSize="12"
              fontWeight="800"
              textAnchor="middle"
              letterSpacing="2.5"
            >
              IF / ID PIPELINE REGISTER
            </text>

            {/* ============================================================ */}
            {/* [STAGE 2] INSTRUCTION DECODE (ID) : Y = 280 ~ 505            */}
            {/* ============================================================ */}
            <text x="115" y="304" fill="#EA580C" fontSize="16" fontWeight="800">
              2. ID (Instruction Decode)
            </text>
            <rect
              x="570"
              y="284"
              width="260"
              height="30"
              rx="8"
              fill={isIdActive ? "#FFF7ED" : "#F8FAFC"}
              stroke={isIdActive ? "#FB923C" : "#CBD5E1"}
              strokeWidth="1.8"
            />
            <text
              x="700"
              y="304"
              fill={isIdActive ? "#C2410C" : "#94A3B8"}
              fontSize="13"
              fontFamily="'D2Coding', Consolas, monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {idInst}
            </text>

            {/* IF/ID BUFFER에서 Register File / Imm Gen / Control Unit으로 분기되는 명령어 버스 */}
            {/* 메인 분기점: (430, 264) ➔ (430, 326) 에서 좌(350), 우(610, 775)로 분기 (명령어 박스 Y=284~316 아래쪽) */}
            <path
              d="M 430,264 L 430,326 L 350,326 L 350,346"
              fill="none"
              stroke={isIdActive ? "#EA580C" : "#94A3B8"}
              strokeWidth="2.5"
              markerEnd={isIdActive ? "url(#m-arr-orange)" : "url(#m-arr-def)"}
            />
            <path
              d="M 430,326 L 610,326 L 610,346"
              fill="none"
              stroke={isIdActive ? "#EA580C" : "#94A3B8"}
              strokeWidth="2.2"
              markerEnd={isIdActive ? "url(#m-arr-orange)" : "url(#m-arr-def)"}
            />
            <path
              d="M 610,326 L 775,326 L 775,356"
              fill="none"
              stroke={isIdActive ? "#EA580C" : "#94A3B8"}
              strokeWidth="1.8"
              strokeDasharray="4 2"
              markerEnd={isIdActive ? "url(#m-arr-orange)" : "url(#m-arr-def)"}
            />

            {/* 부품 3: Registers (Register File) : X = 190 ~ 510, Y = 348 ~ 458 */}
            <rect
              x="190"
              y="348"
              width="320"
              height="110"
              rx="10"
              fill={isIdActive ? "url(#g-regfile)" : "#FFFFFF"}
              stroke={isIdActive ? "#16A34A" : "#94A3B8"}
              strokeWidth="2.5"
            />
            {/* 좌측 옆구리 Write Data In 포트 핀 (X = 176 ~ 190, 중심 Y = 403)
                - 글씨(Write Data / rd In)를 모두 화살표(Y = 403) 위쪽(Y = 374, 390)으로 배치하여 겹침 방지 */}
            <rect x="176" y="391" width="14" height="24" fill="#2563EB" rx="3" />
            <text x="170" y="374" fill="#1D4ED8" fontSize="11.5" fontWeight="800" textAnchor="end">
              Write Data
            </text>
            <text x="170" y="389" fill="#2563EB" fontSize="10.5" fontFamily="monospace" fontWeight="bold" textAnchor="end">
              (rd In)
            </text>

            <text x="350" y="376" fill="#15803D" fontSize="16" fontWeight="800" textAnchor="middle">
              Registers (Register File)
            </text>
            <text x="215" y="402" fill="#475569" fontSize="12" fontFamily="monospace" fontWeight="600">
              ▸ rs1 (Read Reg 1)
            </text>
            <text x="215" y="424" fill="#475569" fontSize="12" fontFamily="monospace" fontWeight="600">
              ▸ rs2 (Read Reg 2)
            </text>
            {/* 출력 포트 라벨 (Data 1: X=290, Data 2: X=440) */}
            <text x="290" y="448" fill="#15803D" fontSize="12" fontWeight="800" textAnchor="middle">
              Read Data 1 ⬇
            </text>
            <text x="440" y="448" fill="#15803D" fontSize="12" fontWeight="800" textAnchor="middle">
              Read Data 2 ⬇
            </text>

            {/* 부품 4: Imm Gen (X = 550 ~ 670, 중심 X = 610, Y = 348 ~ 458) */}
            <rect
              x="550"
              y="348"
              width="120"
              height="110"
              rx="16"
              fill="#FFFFFF"
              stroke={isIdActive ? "#0284C7" : "#94A3B8"}
              strokeWidth="2.2"
            />
            <text x="610" y="384" fill="#1E293B" fontSize="14.5" fontWeight="800" textAnchor="middle">
              Imm Gen
            </text>
            <text x="610" y="406" fill="#64748B" fontSize="11" textAnchor="middle">
              32-bit Sign
            </text>
            <text x="610" y="422" fill="#64748B" fontSize="11" textAnchor="middle">
              Extension
            </text>
            <text x="610" y="448" fill="#0284C7" fontSize="12" fontWeight="800" textAnchor="middle">
              Imm [31:0] ⬇
            </text>

            {/* 부품 5: Control Unit (중심 X = 775, Y = 358 ~ 448) */}
            <ellipse
              cx="775"
              cy="403"
              rx="42"
              ry="45"
              fill="#F8FAFC"
              stroke="#64748B"
              strokeWidth="1.8"
            />
            <text x="775" y="398" fill="#334155" fontSize="12.5" fontWeight="800" textAnchor="middle">
              Control
            </text>
            <text x="775" y="415" fill="#64748B" fontSize="11" fontWeight="600" textAnchor="middle">
              Unit
            </text>

            {/* ID 단계 출력 3개 버스 ➔ ID/EX BUFFER (Y = 458 ➔ 515) */}
            {/* 1) Read Data 1 (X = 290) */}
            <line
              x1="290"
              y1="458"
              x2="290"
              y2="513"
              stroke={isIdActive ? "#EA580C" : "#94A3B8"}
              strokeWidth="3.2"
              className={isIdActive ? "stream-down-active" : undefined}
              markerEnd={isIdActive ? "url(#m-arr-orange)" : "url(#m-arr-def)"}
            />
            {/* 2) Read Data 2 (X = 440) */}
            <line
              x1="440"
              y1="458"
              x2="440"
              y2="513"
              stroke={isIdActive ? "#EA580C" : "#94A3B8"}
              strokeWidth="3.2"
              className={isIdActive ? "stream-down-active" : undefined}
              markerEnd={isIdActive ? "url(#m-arr-orange)" : "url(#m-arr-def)"}
            />
            {/* 3) Imm [31:0] (X = 610에서 내려와 ID/EX 버퍼의 X = 545 지점으로 진입하여 EX 우측 명령어 박스와 완전 분리) */}
            <path
              d="M 610,458 L 610,486 L 545,486 L 545,513"
              fill="none"
              stroke={isIdActive ? "#0284C7" : "#94A3B8"}
              strokeWidth="2.5"
              strokeDasharray="5 3"
              markerEnd={isIdActive ? "url(#m-arr-cyan)" : "url(#m-arr-def)"}
            />

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 2: ID / EX BUFFER (Y = 515 ~ 539)             */}
            {/* ============================================================ */}
            <rect
              x="115"
              y="515"
              width="715"
              height="24"
              rx="5"
              fill="url(#g-buffer)"
              stroke="#94A3B8"
              strokeWidth="1.5"
            />
            <text
              x="472"
              y="531"
              fill="#334155"
              fontSize="12"
              fontWeight="800"
              textAnchor="middle"
              letterSpacing="2.5"
            >
              ID / EX PIPELINE REGISTER
            </text>

            {/* ============================================================ */}
            {/* [STAGE 3] EXECUTE / ALU (EX) : Y = 555 ~ 830                 */}
            {/* ============================================================ */}
            <text x="115" y="579" fill="#CA8A04" fontSize="16" fontWeight="800">
              3. EX (Execute / ALU)
            </text>
            {/* EX 명령어 뱃지 박스: 전 스테이지 공통 X=570, W=260, H=30 */}
            <rect
              x="570"
              y="557"
              width="260"
              height="30"
              rx="8"
              fill={isExActive ? "#FEFCE8" : "#F8FAFC"}
              stroke={isExActive ? "#FACC15" : "#CBD5E1"}
              strokeWidth="1.8"
            />
            <text
              x="700"
              y="577"
              fill={isExActive ? "#854D0E" : "#94A3B8"}
              fontSize="13"
              fontFamily="'D2Coding', Consolas, monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {exInst}
            </text>

            {/* 1) Read Data 1 (X = 290) ➔ ALU 좌측 입력 포트(X = 290, Y = 668)로 직하강 */}
            <line
              x1="290"
              y1="539"
              x2="290"
              y2="666"
              stroke={isExActive ? "#D97706" : "#94A3B8"}
              strokeWidth="3.2"
              className={isExActive ? "stream-down-active" : undefined}
              markerEnd={isExActive ? "url(#m-arr-amber)" : "url(#m-arr-def)"}
            />
            <text x="278" y="615" fill="#B45309" fontSize="11" fontWeight="700" textAnchor="end">
              Operand A (rs1)
            </text>

            {/* 2) Read Data 2 (X = 440) ➔ ALUSrc MUX 좌측 입력(X = 440, Y = 602) */}
            <line
              x1="440"
              y1="539"
              x2="440"
              y2="600"
              stroke={isExActive ? "#D97706" : "#94A3B8"}
              strokeWidth="2.8"
              markerEnd={isExActive ? "url(#m-arr-amber)" : "url(#m-arr-def)"}
            />

            {/* 3) Imm (X = 545) ➔ ALUSrc MUX 우측 입력(X = 498, Y = 602) 및 Branch Adder 분기 */}
            <path
              d="M 545,539 L 545,582 L 498,582 L 498,600"
              fill="none"
              stroke={isExActive ? "#0284C7" : "#94A3B8"}
              strokeWidth="2.4"
              strokeDasharray="5 3"
              markerEnd={isExActive ? "url(#m-arr-cyan)" : "url(#m-arr-def)"}
            />

            {/* ALUSrc MUX (중심 X = 470, Y = 602 ~ 634) */}
            <polygon
              points="415,602 525,602 505,634 435,634"
              fill="#EFF6FF"
              stroke="#3B82F6"
              strokeWidth="2"
            />
            <text x="470" y="623" fill="#1E40AF" fontSize="11.5" fontWeight="800" textAnchor="middle">
              ALUSrc MUX
            </text>

            {/* ALUSrc MUX 출력 (X = 470, Y = 634) ➔ ALU 우측 입력 포트(X = 470, Y = 668) */}
            <line
              x1="470"
              y1="634"
              x2="470"
              y2="666"
              stroke={isExActive ? "#D97706" : "#94A3B8"}
              strokeWidth="3.2"
              markerEnd={isExActive ? "url(#m-arr-amber)" : "url(#m-arr-def)"}
            />
            <text x="482" y="656" fill="#B45309" fontSize="11" fontWeight="700">
              Operand B
            </text>

            {/* 부품 6: 모던 ALU (좌측 입력 중심 X=290, 우측 입력 중심 X=470, 전체 중앙 X=380, Y=668 ~ 788) */}
            <g className={isExActive ? "glow-active-ex" : undefined}>
              <polygon
                points="
                  230,668
                  335,668
                  380,712
                  425,668
                  530,668
                  480,715
                  480,750
                  425,788
                  335,788
                  280,750
                  280,715
                "
                fill={isExActive ? "#FEF9C3" : "#FFFFFF"}
                stroke={isExActive ? "#D97706" : "#64748B"}
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {/* 내부 기하학적 인셋 라인 */}
              <polygon
                points="
                  252,680
                  328,680
                  380,726
                  432,680
                  508,680
                  466,720
                  466,745
                  418,776
                  342,776
                  294,745
                  294,720
                "
                fill="none"
                stroke={isExActive ? "#F59E0B" : "#E2E8F0"}
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <text x="380" y="746" fill="#78350F" fontSize="22" fontWeight="900" textAnchor="middle" letterSpacing="2">
                ALU
              </text>
              <text x="380" y="766" fill="#92400E" fontSize="11.5" fontWeight="700" textAnchor="middle">
                (Arithmetic &amp; Logic Unit)
              </text>
            </g>

            {/* 우측 Branch Adder (EX 명령어 박스 Y=555~587 보다 아래쪽인 Y=605에서 우측 X=700으로 분기) */}
            <path
              d="M 545,582 L 545,605 L 700,605 L 700,683"
              fill="none"
              stroke="#94A3B8"
              strokeWidth="1.8"
              strokeDasharray="5 3"
              markerEnd="url(#m-arr-def)"
            />
            <polygon
              points="640,685 760,685 740,725 660,725"
              fill="#F8FAFC"
              stroke="#94A3B8"
              strokeWidth="1.8"
            />
            <text x="700" y="710" fill="#475569" fontSize="12" fontWeight="800" textAnchor="middle">
              Branch Add
            </text>
            <line
              x1="700"
              y1="725"
              x2="700"
              y2="838"
              stroke="#94A3B8"
              strokeWidth="1.8"
              strokeDasharray="5 3"
              markerEnd="url(#m-arr-def)"
            />
            <text x="710" y="785" fill="#64748B" fontSize="10.5" fontWeight="600">
              Branch Target
            </text>

            {/* ALU 출력(X = 380, Y = 788) ➔ EX/MEM BUFFER (Y = 840) 직하강 */}
            <line
              x1="380"
              y1="788"
              x2="380"
              y2="838"
              stroke={isExActive ? "#D97706" : "#94A3B8"}
              strokeWidth="3.6"
              className={isExActive ? "stream-down-active" : undefined}
              markerEnd={isExActive ? "url(#m-arr-amber)" : "url(#m-arr-def)"}
            />
            <text x="392" y="820" fill="#B45309" fontSize="11.5" fontWeight="800">
              ALU Result
            </text>

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 3: EX / MEM BUFFER (Y = 840 ~ 864)            */}
            {/* ============================================================ */}
            <rect
              x="115"
              y="840"
              width="715"
              height="24"
              rx="5"
              fill="url(#g-buffer)"
              stroke="#94A3B8"
              strokeWidth="1.5"
            />
            <text
              x="472"
              y="856"
              fill="#334155"
              fontSize="12"
              fontWeight="800"
              textAnchor="middle"
              letterSpacing="2.5"
            >
              EX / MEM PIPELINE REGISTER
            </text>

            {/* ============================================================ */}
            {/* [STAGE 4] MEMORY ACCESS (MEM) : Y = 880 ~ 1095               */}
            {/* ============================================================ */}
            <text x="115" y="904" fill="#16A34A" fontSize="16" fontWeight="800">
              4. MEM (Memory Access)
            </text>
            <rect
              x="570"
              y="884"
              width="260"
              height="30"
              rx="8"
              fill={isMemActive ? "#F0FDF4" : "#F8FAFC"}
              stroke={isMemActive ? "#4ADE80" : "#CBD5E1"}
              strokeWidth="1.8"
            />
            <text
              x="700"
              y="904"
              fill={isMemActive ? "#15803D" : "#94A3B8"}
              fontSize="13"
              fontFamily="'D2Coding', Consolas, monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {memInst}
            </text>

            {/* EX/MEM 버퍼에서 내려온 ALU Result(X = 380)가 두 갈래로 분기:
                1) Data Memory의 Address 포트(X = 380, Y = 945)로 직하강
                2) 스테이지 제목(4. MEM, 5. WB)과 절대 겹치지 않도록 Y=926(제목 아래)에서 X=285 통로를 타고 내려감 */}
            <path
              d="M 380,864 L 380,943"
              fill="none"
              stroke={isMemActive ? "#16A34A" : "#94A3B8"}
              strokeWidth="3.2"
              markerEnd={isMemActive ? "url(#m-arr-green)" : "url(#m-arr-def)"}
            />
            <path
              d="M 380,926 L 285,926 L 285,1103"
              fill="none"
              stroke={isMemActive ? "#16A34A" : "#94A3B8"}
              strokeWidth="2.5"
              strokeDasharray="6 3"
              markerEnd={isMemActive ? "url(#m-arr-green)" : "url(#m-arr-def)"}
            />
            <text
              x="270"
              y="1015"
              fill="#15803D"
              fontSize="11.5"
              fontWeight="800"
              transform="rotate(-90, 270, 1015)"
              textAnchor="middle"
            >
              ALU Result Bypass ⬇
            </text>

            {/* 부품 7: Data Memory (X = 320 ~ 620, 중심 X = 470, Y = 945 ~ 1055) */}
            <rect
              x="320"
              y="945"
              width="300"
              height="110"
              rx="10"
              fill={isMemActive ? "url(#g-dmem)" : "#FFFFFF"}
              stroke={isMemActive ? "#16A34A" : "#94A3B8"}
              strokeWidth="2.5"
            />
            <text x="470" y="974" fill="#14532D" fontSize="16" fontWeight="800" textAnchor="middle">
              Data Memory
            </text>
            <text x="345" y="1002" fill="#374151" fontSize="12" fontFamily="monospace" fontWeight="600">
              ▸ Address (from ALU)
            </text>
            <text x="345" y="1024" fill="#374151" fontSize="12" fontFamily="monospace" fontWeight="600">
              ▸ Write Data (Store)
            </text>
            <text x="530" y="1044" fill="#15803D" fontSize="12" fontWeight="800" textAnchor="middle">
              Read Data ⬇
            </text>

            {/* Data Memory 출력(X = 530, Y = 1055) ➔ MEM/WB BUFFER (Y = 1105) */}
            <line
              x1="530"
              y1="1055"
              x2="530"
              y2="1103"
              stroke={isMemActive ? "#16A34A" : "#94A3B8"}
              strokeWidth="3.2"
              className={isMemActive ? "stream-down-active" : undefined}
              markerEnd={isMemActive ? "url(#m-arr-green)" : "url(#m-arr-def)"}
            />

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 4: MEM / WB BUFFER (Y = 1105 ~ 1129)          */}
            {/* ============================================================ */}
            <rect
              x="115"
              y="1105"
              width="715"
              height="24"
              rx="5"
              fill="url(#g-buffer)"
              stroke="#94A3B8"
              strokeWidth="1.5"
            />
            <text
              x="472"
              y="1121"
              fill="#334155"
              fontSize="12"
              fontWeight="800"
              textAnchor="middle"
              letterSpacing="2.5"
            >
              MEM / WB PIPELINE REGISTER
            </text>

            {/* ============================================================ */}
            {/* [STAGE 5] WRITE-BACK (WB) : Y = 1145 ~ 1320                  */}
            {/* ============================================================ */}
            <text x="115" y="1169" fill="#2563EB" fontSize="16" fontWeight="800">
              5. WB (Write-Back)
            </text>
            <rect
              x="570"
              y="1149"
              width="260"
              height="30"
              rx="8"
              fill={isWbActive ? "#EFF6FF" : "#F8FAFC"}
              stroke={isWbActive ? "#60A5FA" : "#CBD5E1"}
              strokeWidth="1.8"
            />
            <text
              x="700"
              y="1169"
              fill={isWbActive ? "#1D4ED8" : "#94A3B8"}
              fontSize="13"
              fontFamily="'D2Coding', Consolas, monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {wbInst}
            </text>

            {/* 1) ALU Result Bypass (X = 285, 5. WB 제목 우측 끝 X=260 바깥쪽) ➔ MemtoReg MUX 좌측 입력(X = 400, Y = 1205) */}
            <path
              d="M 285,1129 L 285,1186 L 400,1186 L 400,1203"
              fill="none"
              stroke={isWbActive ? "#2563EB" : "#94A3B8"}
              strokeWidth="2.6"
              strokeDasharray="6 3"
              markerEnd={isWbActive ? "url(#m-arr-blue)" : "url(#m-arr-def)"}
            />

            {/* 2) Data Memory Read Data (X = 530) ➔ MemtoReg MUX 우측 입력(X = 530, Y = 1205) */}
            <line
              x1="530"
              y1="1129"
              x2="530"
              y2="1203"
              stroke={isWbActive ? "#2563EB" : "#94A3B8"}
              strokeWidth="2.8"
              markerEnd={isWbActive ? "url(#m-arr-blue)" : "url(#m-arr-def)"}
            />

            {/* 부품 8: MemtoReg MUX (중심 X = 465, Y = 1205 ~ 1245) */}
            <polygon
              points="375,1205 555,1205 525,1245 405,1245"
              fill={isWbActive ? "#DBEAFE" : "#FFFFFF"}
              stroke={isWbActive ? "#2563EB" : "#94A3B8"}
              strokeWidth="2.5"
            />
            <text x="465" y="1230" fill="#1E40AF" fontSize="13.5" fontWeight="800" textAnchor="middle">
              MemtoReg MUX
            </text>

            {/* ============================================================ */}
            {/* ★ 역방향 피드백 버스 (WB MemtoReg MUX ➔ ID RegFile Write Data In) */}
            {/* MUX 하단(X=465, Y=1245) ➔ 아래(Y=1305) ➔ 좌측 레일(X=68) ➔ ID RegFile 핀(X=174, Y=403) */}
            {/* ============================================================ */}
            <path
              d="M 465,1245 L 465,1305 L 68,1305 L 68,403 L 174,403"
              fill="none"
              stroke={isWbActive ? "#2563EB" : "#CBD5E1"}
              strokeWidth={isWbActive ? "3.4" : "2.2"}
              strokeDasharray={isWbActive ? "9 5" : undefined}
              className={isWbActive ? "stream-feedback-active" : undefined}
              markerEnd={isWbActive ? "url(#m-arr-blue)" : "url(#m-arr-def)"}
            />
            <text x="479" y="1285" fill="#1D4ED8" fontSize="12.5" fontWeight="800">
              Write Data to rd
            </text>
            {/* 좌측 세로 피드백 버스 안내 라벨 */}
            <text
              x="46"
              y="850"
              fill={isWbActive ? "#2563EB" : "#64748B"}
              fontSize="13"
              fontWeight="800"
              transform="rotate(-90, 46, 850)"
              textAnchor="middle"
              letterSpacing="1"
            >
              ▲ RegFile Write-Back Feedback Bus (rd)
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default PipelineVisualizer;
