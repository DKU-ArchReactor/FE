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

const MASTER_WIDTH = 1150;
const MASTER_HEIGHT = 1390;

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

  // 명령어 파싱 및 세부 동작 분류
  const parseOp = (assembly: string | null | undefined): string => {
    if (!assembly) return "";
    const trimmed = assembly.trim().toLowerCase();
    if (trimmed === "bubble" || trimmed === "empty" || trimmed === "flush" || trimmed === "stall") return "";
    const match = trimmed.match(/^([a-z0-9_.]+)/);
    return match ? match[1] : "";
  };

  const isRType = (op: string) =>
    /^(add|sub|and|or|xor|sll|srl|sra|slt|sltu|mul|mulh|mulhsu|mulhu|div|divu|rem|remu)$/.test(op);
  const isITypeAlu = (op: string) =>
    /^(addi|andi|ori|xori|slti|sltiu|slli|srli|srai|li|mv|not|neg|seqz|snez)$/.test(op);
  const isLoad = (op: string) =>
    /^(lw|lh|lb|lhu|lbu)$/.test(op);
  const isStore = (op: string) =>
    /^(sw|sh|sb)$/.test(op);
  const isBranch = (op: string) =>
    /^(beq|bne|blt|bge|bltu|bgeu|beqz|bnez|bltz|bgez|blez|bgtz)$/.test(op);
  const isJump = (op: string) =>
    /^(jal|jalr|j|jr|ret|call|tail)$/.test(op);
  const isLui = (op: string) => op === "lui";
  const isAuipc = (op: string) => op === "auipc";

  const usesRs1 = (op: string) =>
    isRType(op) || isITypeAlu(op) || isLoad(op) || isStore(op) || isBranch(op) || op === "jalr" || op === "jr" || op === "ret" ||
    (!isRType(op) && !isITypeAlu(op) && !isLoad(op) && !isStore(op) && !isBranch(op) && !isJump(op) && !isLui(op) && !isAuipc(op) && Boolean(op));
  const usesRs2 = (op: string) =>
    isRType(op) || isStore(op) || isBranch(op);
  const usesImm = (op: string) =>
    isITypeAlu(op) || isLoad(op) || isStore(op) || isBranch(op) || isLui(op) || isAuipc(op) || isJump(op) ||
    (!isRType(op) && Boolean(op));
  const usesPc = (op: string) =>
    isBranch(op) || isJump(op) || isAuipc(op);
  const writesReg = (op: string) =>
    isRType(op) || isITypeAlu(op) || isLoad(op) || isLui(op) || isAuipc(op) || op === "jal" || op === "jalr" || op === "call" ||
    (!isStore(op) && !isBranch(op) && Boolean(op));

  const ifOp = parseOp(ifInst);
  const idOp = parseOp(idInst);
  const exOp = parseOp(exInst);
  const memOp = parseOp(memInst);
  const wbOp = parseOp(wbInst);

  // [IF 단계 와이어 활성 조건]
  const ifPcMuxToPcActive = isIfActive;
  const ifPcToImemActive = isIfActive;
  const ifPcToPlus4Active = isIfActive;
  const ifPcToIfIdActive = isIfActive && usesPc(ifOp);
  const ifPlus4LoopbackActive = isIfActive && !isBranchFlush;
  const branchLoopbackActive = isBranchFlush || Boolean(cycle_events.control_hazard?.taken);
  const ifImemToIfIdActive = isIfActive;

  // [ID 단계 와이어 활성 조건]
  const idTrunkActive = isIdActive;
  const idControlUnitActive = isIdActive;
  const idToRegsActive = isIdActive && (usesRs1(idOp) || usesRs2(idOp));
  const idToImmGenActive = isIdActive && usesImm(idOp);
  const idRd1ToIdExActive = isIdActive && usesRs1(idOp);
  const idRd2ToIdExActive = isIdActive && usesRs2(idOp);
  const idImmToIdExActive = isIdActive && usesImm(idOp);
  const idPcToIdExActive = isIdActive && usesPc(idOp);

  // [EX 단계 와이어 활성 조건]
  const exRd1ToAluActive = isExActive && usesRs1(exOp);
  const exRd2TrunkActive = isExActive && usesRs2(exOp);
  const exRd2ToAluSrcActive = isExActive && (isRType(exOp) || isBranch(exOp));
  const exRd2ToWriteDataActive = isExActive && isStore(exOp);
  const exImmTrunkActive = isExActive && usesImm(exOp);
  const exImmToAluSrcActive = isExActive && (isITypeAlu(exOp) || isLoad(exOp) || isStore(exOp) || isLui(exOp) || exOp === "jalr");
  const exAluSrcToAluActive = isExActive && (isRType(exOp) || isITypeAlu(exOp) || isLoad(exOp) || isStore(exOp) || isBranch(exOp) || isLui(exOp) || exOp === "jalr");
  const exImmToBranchAddActive = isExActive && (isBranch(exOp) || isJump(exOp) || isAuipc(exOp));
  const exPcToBranchAddActive = isExActive && (isBranch(exOp) || isJump(exOp) || isAuipc(exOp));
  const exAluToExMemActive = isExActive && (isRType(exOp) || isITypeAlu(exOp) || isLoad(exOp) || isStore(exOp) || isLui(exOp) || isAuipc(exOp) || exOp === "jalr");

  // [MEM 단계 와이어 활성 조건]
  const memAluTrunkActive = isMemActive && (isLoad(memOp) || isStore(memOp) || isRType(memOp) || isITypeAlu(memOp) || isLui(memOp) || isAuipc(memOp) || memOp === "jalr");
  const memAluToDmemAddrActive = isMemActive && (isLoad(memOp) || isStore(memOp));
  const memAluBypassActive = isMemActive && (isRType(memOp) || isITypeAlu(memOp) || isLui(memOp) || isAuipc(memOp) || memOp === "jalr");
  const memWriteDataActive = isMemActive && isStore(memOp);
  const memDmemReadDataActive = isMemActive && isLoad(memOp);

  // [WB 단계 와이어 활성 조건]
  const wbAluBypassActive = isWbActive && (isRType(wbOp) || isITypeAlu(wbOp) || isLui(wbOp) || isAuipc(wbOp) || wbOp === "jalr");
  const wbDmemReadDataActive = isWbActive && isLoad(wbOp);
  const wbReverseFeedbackActive = isWbActive && writesReg(wbOp);

  const wireStyle = (active: boolean): React.CSSProperties => ({
    opacity: active ? 1 : 0,
    transition: "opacity 0.25s ease-in-out",
    pointerEvents: active ? "auto" : "none",
  });

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
          <span className="text-[10px] text-[var(--ar-text-muted)] font-mono w-16 shrink-0 tabular-nums">({isSingle ? `STEP:${clock ?? 0}` : `CYCLE:${clock ?? 0}`})</span>
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
          className="m-auto shrink-0 transition-all duration-150 border-2 border-black dark:border-white"
          style={{
            height: `${zoomLevel * 100}%`,
            maxHeight: "100%",
            maxWidth: "100%",
            aspectRatio: `${MASTER_WIDTH} / ${MASTER_HEIGHT}`,
          }}
        >
          <svg
            viewBox="-60 -65 1150 1390"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full select-none block border-2 border-black dark:border-white"
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
            {/* [1열: 좌측 열] 스테이지 + 명령어 2층 일체형 통합 카드 5개   */}
            {/* (규격 20% 축소 조정: x=-40, w=276, h=92, rx=11 / 1층: 헤더 40px, 2층: 명령어 52px) */}
            {/* ============================================================ */}
            {/* 1. IF: Instruction Fetch (Row center: y=142.5 -> card y=96) */}
            <g>
              <rect
                x="-40"
                y="96"
                width="276"
                height="92"
                rx="11"
                fill={isIfActive ? "#FEF2F2" : "#F8FAFC"}
                stroke={isIfActive ? "#EF4444" : "#CBD5E1"}
                strokeWidth="2.2"
              />
              <path
                d="M -40,107 a 11,11 0 0 1 11,-11 h 254 a 11,11 0 0 1 11,11 v 29 h -276 z"
                fill={isIfActive ? "#EF4444" : "#94A3B8"}
              />
              <text
                x="98"
                y="116"
                dominantBaseline="central"
                fill="#FFFFFF"
                fontSize="16"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                IF · Instruction Fetch
              </text>
              <line
                x1="-40"
                y1="136"
                x2="236"
                y2="136"
                stroke={isIfActive ? "#EF4444" : "#CBD5E1"}
                strokeWidth="1.5"
              />
              <text
                x="98"
                y="162"
                dominantBaseline="central"
                fill={isIfActive ? "#991B1B" : "#94A3B8"}
                fontSize="19"
                fontFamily="'D2Coding', Consolas, monospace"
                fontWeight="bold"
                textAnchor="middle"
              >
                {ifInst}
              </text>
            </g>

            {/* 2. ID: Instruction Decode (Row center: y=425.5 -> card y=380) */}
            <g>
              <rect
                x="-40"
                y="380"
                width="276"
                height="92"
                rx="11"
                fill={isIdActive ? "#FFF7ED" : "#F8FAFC"}
                stroke={isIdActive ? "#FB923C" : "#CBD5E1"}
                strokeWidth="2.2"
              />
              <path
                d="M -40,391 a 11,11 0 0 1 11,-11 h 254 a 11,11 0 0 1 11,11 v 29 h -276 z"
                fill={isIdActive ? "#F97316" : "#94A3B8"}
              />
              <text
                x="98"
                y="400"
                dominantBaseline="central"
                fill="#FFFFFF"
                fontSize="16"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                ID · Instruction Decode
              </text>
              <line
                x1="-40"
                y1="420"
                x2="236"
                y2="420"
                stroke={isIdActive ? "#FB923C" : "#CBD5E1"}
                strokeWidth="1.5"
              />
              <text
                x="98"
                y="446"
                dominantBaseline="central"
                fill={isIdActive ? "#C2410C" : "#94A3B8"}
                fontSize="19"
                fontFamily="'D2Coding', Consolas, monospace"
                fontWeight="bold"
                textAnchor="middle"
              >
                {idInst}
              </text>
            </g>

            {/* 3. EX: Execute (Row center: y=738 -> card y=692) */}
            <g>
              <rect
                x="-40"
                y="692"
                width="276"
                height="92"
                rx="11"
                fill={isExActive ? "#F0FDF4" : "#F8FAFC"}
                stroke={isExActive ? "#10B981" : "#CBD5E1"}
                strokeWidth="2.2"
              />
              <path
                d="M -40,703 a 11,11 0 0 1 11,-11 h 254 a 11,11 0 0 1 11,11 v 29 h -276 z"
                fill={isExActive ? "#10B981" : "#94A3B8"}
              />
              <text
                x="98"
                y="712"
                dominantBaseline="central"
                fill="#FFFFFF"
                fontSize="17"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                EX · Execute
              </text>
              <line
                x1="-40"
                y1="732"
                x2="236"
                y2="732"
                stroke={isExActive ? "#10B981" : "#CBD5E1"}
                strokeWidth="1.5"
              />
              <text
                x="98"
                y="758"
                dominantBaseline="central"
                fill={isExActive ? "#15803D" : "#94A3B8"}
                fontSize="19"
                fontFamily="'D2Coding', Consolas, monospace"
                fontWeight="bold"
                textAnchor="middle"
              >
                {exInst}
              </text>
            </g>

            {/* 4. MEM: Memory Access (Row center: y=1046 -> card y=1000) */}
            <g>
              <rect
                x="-40"
                y="1000"
                width="276"
                height="92"
                rx="11"
                fill={isMemActive ? "#F0F9FF" : "#F8FAFC"}
                stroke={isMemActive ? "#0EA5E9" : "#CBD5E1"}
                strokeWidth="2.2"
              />
              <path
                d="M -40,1011 a 11,11 0 0 1 11,-11 h 254 a 11,11 0 0 1 11,11 v 29 h -276 z"
                fill={isMemActive ? "#0EA5E9" : "#94A3B8"}
              />
              <text
                x="98"
                y="1020"
                dominantBaseline="central"
                fill="#FFFFFF"
                fontSize="16"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                MEM · Memory Access
              </text>
              <line
                x1="-40"
                y1="1040"
                x2="236"
                y2="1040"
                stroke={isMemActive ? "#0EA5E9" : "#CBD5E1"}
                strokeWidth="1.5"
              />
              <text
                x="98"
                y="1066"
                dominantBaseline="central"
                fill={isMemActive ? "#0369A1" : "#94A3B8"}
                fontSize="19"
                fontFamily="'D2Coding', Consolas, monospace"
                fontWeight="bold"
                textAnchor="middle"
              >
                {memInst}
              </text>
            </g>

            {/* 5. WB: Write Back */}
            <g>
              <rect
                x="-40"
                y="1221"
                width="276"
                height="92"
                rx="11"
                fill={isWbActive ? "#F5F3FF" : "#F8FAFC"}
                stroke={isWbActive ? "#8B5CF6" : "#CBD5E1"}
                strokeWidth="2.2"
              />
              <path
                d="M -40,1232 a 11,11 0 0 1 11,-11 h 254 a 11,11 0 0 1 11,11 v 29 h -276 z"
                fill={isWbActive ? "#8B5CF6" : "#94A3B8"}
              />
              <text
                x="98"
                y="1241"
                dominantBaseline="central"
                fill="#FFFFFF"
                fontSize="16"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                WB · Write Back
              </text>
              <line
                x1="-40"
                y1="1261"
                x2="236"
                y2="1261"
                stroke={isWbActive ? "#8B5CF6" : "#CBD5E1"}
                strokeWidth="1.5"
              />
              <text
                x="98"
                y="1287"
                dominantBaseline="central"
                fill={isWbActive ? "#6D28D9" : "#94A3B8"}
                fontSize="19"
                fontFamily="'D2Coding', Consolas, monospace"
                fontWeight="bold"
                textAnchor="middle"
              >
                {wbInst}
              </text>
            </g>

            {/* ============================================================ */}
            {/* [2열: 우측 열] 순수 데이터패스 본체 (요소들 우측 30px 이동)    */}
            {/* ============================================================ */}
            <g transform="translate(210, 0)">
            {/* ============================================================ */}
            {/* 부품 0: PC MUX (분기 선택기: 0=PC+4, 1=Branch Target - EX/WB와 규격 통일: 100x38, center 380) */}
            {/* ============================================================ */}
            <rect
              x="330"
              y="14"
              width="100"
              height="38"
              rx="19"
              ry="19"
              fill={ifPcMuxToPcActive ? "#EFF6FF" : "#F8FAFC"}
              stroke={ifPcMuxToPcActive ? "#3B82F6" : "#CBD5E1"}
              strokeWidth="2"
            />
            <text
              x="380"
              y="33"
              dominantBaseline="central"
              fill={ifPcMuxToPcActive ? "#1E40AF" : "#94A3B8"}
              fontSize="18"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              MUX
            </text>

            {/* PC MUX ➔ PC 직하강 화살표 (MUX 하단 y=52 ➔ PC 상단 y=78) */}
            <line
              x1="380"
              y1="52"
              x2="380"
              y2="78"
              stroke={ifPcMuxToPcActive ? "#EF4444" : "transparent"}
              strokeWidth="2.8"
              markerEnd={ifPcMuxToPcActive ? "url(#m-arr-red)" : undefined}
              style={wireStyle(ifPcMuxToPcActive)}
            />

            {/* 부품 1: PC (세로 확장 height=56, y=80..136, center=380) */}
            <rect
              x="260"
              y="80"
              width="240"
              height="56"
              rx="8"
              fill={isIfActive ? "url(#g-pc)" : "#F8FAFC"}
              stroke={isIfActive ? "#EF4444" : "#CBD5E1"}
              strokeWidth="2"
            />
            <text
              x="380"
              y="108"
              dominantBaseline="central"
              textAnchor="middle"
              className="select-none"
              fill={isIfActive ? "#991B1B" : "#94A3B8"}
              fontSize="21"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              PC
            </text>

            {/* PC ➔ Instruction Memory 직하강 화살표 */}
            <line
              x1="380"
              y1="136"
              x2="380"
              y2="174"
              stroke={ifPcToImemActive ? "#EF4444" : "transparent"}
              strokeWidth="2.8"
              className={ifPcToImemActive ? "stream-down-active" : undefined}
              markerEnd={ifPcToImemActive ? "url(#m-arr-red)" : undefined}
              style={wireStyle(ifPcToImemActive)}
            />

            {/* PC ➔ PC + 4 Adder 연결 화살표 (x=500 -> 682, y=108) */}
            <path
              d="M 500,108 L 682,108"
              fill="none"
              stroke={ifPcToPlus4Active ? "#EF4444" : "transparent"}
              strokeWidth="2.8"
              markerEnd={ifPcToPlus4Active ? "url(#m-arr-red)" : undefined}
              style={wireStyle(ifPcToPlus4Active)}
            />
            {/* PC 분기 노드 및 IF/ID BUFFER 직하강 라인 (x=637 일직선 유지, RISC-V 순수 PC 전달) */}
            <circle
              cx="637"
              cy="108"
              r="3.5"
              fill={ifPcToIfIdActive ? "#EF4444" : "transparent"}
              style={wireStyle(ifPcToIfIdActive)}
            />
            <line
              x1="637"
              y1="108"
              x2="637"
              y2="283"
              stroke={ifPcToIfIdActive ? "#EF4444" : "transparent"}
              strokeWidth="2.8"
              strokeDasharray="6 3"
              markerEnd={ifPcToIfIdActive ? "url(#m-arr-red)" : undefined}
              style={wireStyle(ifPcToIfIdActive)}
            />

            {/* PC + 4 가산기 (Control Unit과 동일한 center cx=721로 이동) */}
            <polygon
              points="676,88 766,88 746,128 696,128"
              fill={ifPlus4LoopbackActive ? "#FEF2F2" : "#F8FAFC"}
              stroke={ifPlus4LoopbackActive ? "#EF4444" : "#CBD5E1"}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <text
              x="721"
              y="108"
              dominantBaseline="central"
              fill={ifPlus4LoopbackActive ? "#991B1B" : "#94A3B8"}
              fontSize="18"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              + 4
            </text>

            {/* PC + 4 루프백 ➔ PC MUX 입력 0 (포트 0: 상단 x=410 직하강 인입, 우측 회랑 x=800) */}
            <path
              d="M 721,128 L 721,168 L 800,168 L 800,-22 L 410,-22 L 410,12"
              fill="none"
              stroke={ifPlus4LoopbackActive ? "#EF4444" : "transparent"}
              strokeWidth="2.8"
              strokeDasharray="6 3"
              markerEnd={ifPlus4LoopbackActive ? "url(#m-arr-red)" : undefined}
              style={wireStyle(ifPlus4LoopbackActive)}
            />

            {/* Branch Target Address ➔ PC MUX 입력 1 (포트 1: EX Branch Add ➔ 우측 외곽 회랑 x=835 ➔ 상단 x=350 직하강) */}
            <path
              d="M 590,808 L 590,845 L 835,845 L 835,-50 L 350,-50 L 350,12"
              fill="none"
              stroke={branchLoopbackActive ? "#EF4444" : "transparent"}
              strokeWidth="2.8"
              markerEnd={branchLoopbackActive ? "url(#m-arr-red)" : undefined}
              style={wireStyle(branchLoopbackActive)}
            />

            {/* 부품 2: Instruction Memory (세로 확장 height=72, y=176..248, center=380) */}
            <rect
              x="230"
              y="176"
              width="300"
              height="72"
              rx="8"
              fill={isIfActive ? "url(#g-imem)" : "#F8FAFC"}
              stroke={isIfActive ? "#3B82F6" : "#CBD5E1"}
              strokeWidth="2"
            />
            <text
              x="380"
              y="212"
              dominantBaseline="central"
              fill={isIfActive ? "#1E40AF" : "#94A3B8"}
              fontSize="21"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              Instruction Memory
            </text>

            {/* Instruction Memory ➔ IF/ID BUFFER 직하강 화살표 */}
            <line
              x1="380"
              y1="248"
              x2="380"
              y2="283"
              stroke={ifImemToIfIdActive ? "#DC2626" : "transparent"}
              strokeWidth="2.8"
              className={ifImemToIfIdActive ? "stream-down-active" : undefined}
              markerEnd={ifImemToIfIdActive ? "url(#m-arr-red)" : undefined}
              style={wireStyle(ifImemToIfIdActive)}
            />

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 1: IF / ID BUFFER (가로길이 30% 확장: w=690, x=110) */}
            {/* ============================================================ */}
            <rect
              x="110"
              y="285"
              width="690"
              height="26"
              rx="6"
              fill="url(#g-buffer)"
              stroke="#94A3B8"
              strokeWidth="1.6"
            />
            <text
              x="455"
              y="298"
              dominantBaseline="central"
              fill="#1E293B"
              fontSize="15.5"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
              letterSpacing="2"
            >
              IF / ID BUFFER
            </text>

            {/* ============================================================ */}
            {/* [STAGE 2] INSTRUCTION DECODE (ID) : Y = 311 ~ 540            */}
            {/* ============================================================ */}
            {/* IF/ID BUFFER 직하강 트렁크 (x=380, y=311 -> 336) */}
            <line
              x1="380"
              y1="311"
              x2="380"
              y2="336"
              stroke={idTrunkActive ? "#EA580C" : "transparent"}
              strokeWidth="2.8"
              style={wireStyle(idTrunkActive)}
            />
            {/* IF/ID BUFFER ➔ Register File 분기 버스 */}
            <path
              d="M 380,336 L 280,336 L 280,366"
              fill="none"
              stroke={idToRegsActive ? "#EA580C" : "transparent"}
              strokeWidth="2.8"
              markerEnd={idToRegsActive ? "url(#m-arr-orange)" : undefined}
              style={wireStyle(idToRegsActive)}
            />
            {/* IF/ID BUFFER ➔ Imm Gen 분기 버스 */}
            <path
              d="M 380,336 L 543,336 L 543,374"
              fill="none"
              stroke={idToImmGenActive ? "#EA580C" : "transparent"}
              strokeWidth="2.8"
              markerEnd={idToImmGenActive ? "url(#m-arr-orange)" : undefined}
              style={wireStyle(idToImmGenActive)}
            />
            {/* IF/ID BUFFER ➔ Control Unit 분기 버스 */}
            <path
              d="M 380,336 L 721,336 L 721,374"
              fill="none"
              stroke={idControlUnitActive ? "#EA580C" : "transparent"}
              strokeWidth="2.8"
              strokeDasharray="6 3"
              markerEnd={idControlUnitActive ? "url(#m-arr-orange)" : undefined}
              style={wireStyle(idControlUnitActive)}
            />

            {/* 부품 3: Registers (x=165, width=230, y=368..480, center=280) */}
            <rect
              x="165"
              y="368"
              width="230"
              height="112"
              rx="8"
              fill={idToRegsActive ? "url(#g-regfile)" : "#F8FAFC"}
              stroke={idToRegsActive ? "#16A34A" : "#CBD5E1"}
              strokeWidth="2"
            />
            <text
              x="280"
              y="424"
              dominantBaseline="central"
              fill={idToRegsActive ? "#15803D" : "#94A3B8"}
              fontSize="21"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              Registers
            </text>

            {/* 부품 4: Imm Gen (타원형 rx=50, ry=48, cx=543, 우측 끝=593, 라인 간격=44px) */}
            <ellipse
              cx="543"
              cy="424"
              rx="50"
              ry="48"
              fill={idToImmGenActive ? "#F0F9FF" : "#F8FAFC"}
              stroke={idToImmGenActive ? "#0284C7" : "#CBD5E1"}
              strokeWidth="2"
            />
            <text
              x="543"
              y="424"
              dominantBaseline="central"
              fill={idToImmGenActive ? "#0369A1" : "#94A3B8"}
              fontSize="18"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              Imm Gen
            </text>

            {/* 부품 5: Control Unit (라인 간격 44px 대칭: 좌측 끝=681, cx=721, rx=40, ry=48) */}
            <ellipse
              cx="721"
              cy="424"
              rx="40"
              ry="48"
              fill={idControlUnitActive ? "#FFF7ED" : "#F8FAFC"}
              stroke={idControlUnitActive ? "#EA580C" : "#CBD5E1"}
              strokeWidth="2"
            />
            <text
              x="721"
              y="415"
              fill={idControlUnitActive ? "#C2410C" : "#94A3B8"}
              fontSize="16.5"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              Control
            </text>
            <text
              x="721"
              y="435"
              fill={idControlUnitActive ? "#C2410C" : "#94A3B8"}
              fontSize="16.5"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              Unit
            </text>

            {/* ID 단계 출력 버스 ➔ ID/EX BUFFER (Y = 480 ➔ 538) */}
            {/* 1) Read Data 1 */}
            <line
              x1="240"
              y1="480"
              x2="240"
              y2="538"
              stroke={idRd1ToIdExActive ? "#EA580C" : "transparent"}
              strokeWidth="2.8"
              className={idRd1ToIdExActive ? "stream-down-active" : undefined}
              markerEnd={idRd1ToIdExActive ? "url(#m-arr-orange)" : undefined}
              style={wireStyle(idRd1ToIdExActive)}
            />
            {/* 2) Read Data 2 */}
            <line
              x1="350"
              y1="480"
              x2="350"
              y2="538"
              stroke={idRd2ToIdExActive ? "#EA580C" : "transparent"}
              strokeWidth="2.8"
              className={idRd2ToIdExActive ? "stream-down-active" : undefined}
              markerEnd={idRd2ToIdExActive ? "url(#m-arr-orange)" : undefined}
              style={wireStyle(idRd2ToIdExActive)}
            />
            {/* 3) Imm */}
            <line
              x1="543"
              y1="472"
              x2="543"
              y2="538"
              stroke={idImmToIdExActive ? "#0284C7" : "transparent"}
              strokeWidth="2.8"
              strokeDasharray="6 3"
              markerEnd={idImmToIdExActive ? "url(#m-arr-cyan)" : undefined}
              style={wireStyle(idImmToIdExActive)}
            />
            {/* 4) PC 파이프라인 전달선 (IF/ID ➔ ID/EX, 일직선 수직 라인 x=637) */}
            <line
              x1="637"
              y1="311"
              x2="637"
              y2="538"
              stroke={idPcToIdExActive ? "#EA580C" : "transparent"}
              strokeWidth="2.8"
              strokeDasharray="6 3"
              markerEnd={idPcToIdExActive ? "url(#m-arr-orange)" : undefined}
              style={wireStyle(idPcToIdExActive)}
            />

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 2: ID / EX BUFFER (가로길이 30% 확장: w=690, x=110) */}
            {/* ============================================================ */}
            <rect
              x="110"
              y="540"
              width="690"
              height="26"
              rx="6"
              fill="url(#g-buffer)"
              stroke="#94A3B8"
              strokeWidth="1.6"
            />
            <text
              x="455"
              y="553"
              dominantBaseline="central"
              fill="#1E293B"
              fontSize="15.5"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
              letterSpacing="2"
            >
              ID / EX BUFFER
            </text>

            {/* ============================================================ */}
            {/* [STAGE 3] EXECUTE / ALU (EX) : Y = 566 ~ 910                  */}
            {/* ============================================================ */}
            {/* 1) Read Data 1 (X = 240) ➔ ALU 좌측 입력 포트(X = 240, Y = 739)로 직하강 */}
            <line
              x1="240"
              y1="566"
              x2="240"
              y2="739"
              stroke={exRd1ToAluActive ? "#D97706" : "transparent"}
              strokeWidth="2.8"
              className={exRd1ToAluActive ? "stream-down-active" : undefined}
              markerEnd={exRd1ToAluActive ? "url(#m-arr-amber)" : undefined}
              style={wireStyle(exRd1ToAluActive)}
            />

            {/* 2) Read Data 2 Trunk (X = 350, Y = 566 -> 595) */}
            <line
              x1="350"
              y1="566"
              x2="350"
              y2="595"
              stroke={exRd2TrunkActive ? "#D97706" : "transparent"}
              strokeWidth="2.8"
              style={wireStyle(exRd2TrunkActive)}
            />
            {/* Read Data 2 ➔ ALUSrc MUX 좌측 입력(X = 350, Y = 595 -> 663) */}
            <line
              x1="350"
              y1="595"
              x2="350"
              y2="663"
              stroke={exRd2ToAluSrcActive ? "#D97706" : "transparent"}
              strokeWidth="2.8"
              markerEnd={exRd2ToAluSrcActive ? "url(#m-arr-amber)" : undefined}
              style={wireStyle(exRd2ToAluSrcActive)}
            />
            {/* Read Data 2 분기 ➔ EX/MEM 버퍼 (Data Memory Write Data용, x=480 직하강) */}
            <path
              d="M 350,595 L 480,595 L 480,908"
              fill="none"
              stroke={exRd2ToWriteDataActive ? "#D97706" : "transparent"}
              strokeWidth="2.8"
              strokeDasharray="6 3"
              markerEnd={exRd2ToWriteDataActive ? "url(#m-arr-amber)" : undefined}
              style={wireStyle(exRd2ToWriteDataActive)}
            />
            <circle
              cx="350"
              cy="595"
              r="3.5"
              fill={exRd2ToWriteDataActive ? "#D97706" : "transparent"}
              style={wireStyle(exRd2ToWriteDataActive)}
            />

            {/* 3) Imm Trunk (X = 543, Y = 566 -> 630) */}
            <line
              x1="543"
              y1="566"
              x2="543"
              y2="630"
              stroke={exImmTrunkActive ? "#0284C7" : "transparent"}
              strokeWidth="2.8"
              strokeDasharray="6 3"
              style={wireStyle(exImmTrunkActive)}
            />
            {/* Imm ➔ ALUSrc MUX 우측 입력(X = 410, Y = 663) 분기 */}
            <path
              d="M 543,630 L 410,630 L 410,663"
              fill="none"
              stroke={exImmToAluSrcActive ? "#0284C7" : "transparent"}
              strokeWidth="2.8"
              strokeDasharray="6 3"
              markerEnd={exImmToAluSrcActive ? "url(#m-arr-cyan)" : undefined}
              style={wireStyle(exImmToAluSrcActive)}
            />
            <circle
              cx="543"
              cy="630"
              r="3.5"
              fill={exImmToAluSrcActive ? "#0284C7" : "transparent"}
              style={wireStyle(exImmToAluSrcActive)}
            />

            {/* ALUSrc MUX (알약형 / Stadium Capsule: x=330, y=665, w=100, h=38, rx=19, center 380) */}
            <rect
              x="330"
              y="665"
              width="100"
              height="38"
              rx="19"
              ry="19"
              fill={exAluSrcToAluActive ? "#EFF6FF" : "#F8FAFC"}
              stroke={exAluSrcToAluActive ? "#3B82F6" : "#CBD5E1"}
              strokeWidth="2"
            />
            <text
              x="380"
              y="684"
              dominantBaseline="central"
              fill={exAluSrcToAluActive ? "#1E40AF" : "#94A3B8"}
              fontSize="18"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              MUX
            </text>

            {/* ALUSrc MUX 출력 (X = 380, Y = 703) ➔ ALU 우측 입력 포트(X = 380, Y = 739) */}
            <line
              x1="380"
              y1="703"
              x2="380"
              y2="739"
              stroke={exAluSrcToAluActive ? "#D97706" : "transparent"}
              strokeWidth="2.8"
              markerEnd={exAluSrcToAluActive ? "url(#m-arr-amber)" : undefined}
              style={wireStyle(exAluSrcToAluActive)}
            />

            {/* 부품 6: ALU (center x=310, y=741..869, h=128) */}
            <g className={exAluToExMemActive || (isExActive && isBranch(exOp)) ? "glow-active-ex" : undefined}>
              <polygon
                points="
                  180,741
                  270,741
                  310,783
                  350,741
                  440,741
                  405,869
                  215,869
                "
                fill={exAluToExMemActive || (isExActive && isBranch(exOp)) ? "#FEF9C3" : "#F8FAFC"}
                stroke={exAluToExMemActive || (isExActive && isBranch(exOp)) ? "#D97706" : "#CBD5E1"}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <text
                x="310"
                y="825"
                dominantBaseline="central"
                fill={exAluToExMemActive || (isExActive && isBranch(exOp)) ? "#78350F" : "#94A3B8"}
                fontSize="21"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
                letterSpacing="2"
              >
                ALU
              </text>
            </g>

            {/* 우측 Branch Adder (center 590: 좌측 포트 x=543, 우측 포트 x=637 수직 직하강) */}
            {/* Branch Add 입력 1: Imm (좌측 포트 x=543, y=630 -> 743 수직 직하강) */}
            <line
              x1="543"
              y1="630"
              x2="543"
              y2="743"
              stroke={exImmToBranchAddActive ? "#0284C7" : "transparent"}
              strokeWidth="2.8"
              strokeDasharray="6 3"
              markerEnd={exImmToBranchAddActive ? "url(#m-arr-cyan)" : undefined}
              style={wireStyle(exImmToBranchAddActive)}
            />
            {/* Branch Add 입력 2: PC (우측 포트 x=637 수직 직하강) */}
            <line
              x1="637"
              y1="566"
              x2="637"
              y2="743"
              stroke={exPcToBranchAddActive ? "#D97706" : "transparent"}
              strokeWidth="2.8"
              strokeDasharray="6 3"
              markerEnd={exPcToBranchAddActive ? "url(#m-arr-amber)" : undefined}
              style={wireStyle(exPcToBranchAddActive)}
            />
            <polygon
              points="515,745 665,745 635,808 545,808"
              fill={branchLoopbackActive ? "#FEF2F2" : exPcToBranchAddActive ? "#FEF9C3" : "#F8FAFC"}
              stroke={branchLoopbackActive ? "#EF4444" : exPcToBranchAddActive ? "#D97706" : "#CBD5E1"}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <text
              x="590"
              y="776.5"
              dominantBaseline="central"
              fill={branchLoopbackActive ? "#991B1B" : exPcToBranchAddActive ? "#78350F" : "#94A3B8"}
              fontSize="20"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              Branch Add
            </text>

            {/* ALU 출력(X = 310, Y = 869) ➔ EX/MEM BUFFER (Y = 910) 직하강 */}
            <line
              x1="310"
              y1="869"
              x2="310"
              y2="908"
              stroke={exAluToExMemActive ? "#D97706" : "transparent"}
              strokeWidth="2.8"
              className={exAluToExMemActive ? "stream-down-active" : undefined}
              markerEnd={exAluToExMemActive ? "url(#m-arr-amber)" : undefined}
              style={wireStyle(exAluToExMemActive)}
            />

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 3: EX / MEM BUFFER (가로길이 30% 확장: w=690, x=110) */}
            {/* ============================================================ */}
            <rect
              x="110"
              y="910"
              width="690"
              height="26"
              rx="6"
              fill="url(#g-buffer)"
              stroke="#94A3B8"
              strokeWidth="1.6"
            />
            <text
              x="455"
              y="923"
              dominantBaseline="central"
              fill="#1E293B"
              fontSize="15.5"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
              letterSpacing="2"
            >
              EX / MEM BUFFER
            </text>

            {/* ============================================================ */}
            {/* [STAGE 4] MEMORY ACCESS (MEM) : Y = 936 ~ 1156               */}
            {/* ============================================================ */}
            {/* ALU Result Trunk (X = 310, Y = 936 -> 965) */}
            <line
              x1="310"
              y1="936"
              x2="310"
              y2="965"
              stroke={memAluTrunkActive ? "#16A34A" : "transparent"}
              strokeWidth="2.8"
              style={wireStyle(memAluTrunkActive)}
            />
            {/* 1) ALU Result 분기 ➔ Data Memory Address 입력 (X = 310, Y = 965 -> 994) */}
            <line
              x1="310"
              y1="965"
              x2="310"
              y2="994"
              stroke={memAluToDmemAddrActive ? "#16A34A" : "transparent"}
              strokeWidth="2.8"
              markerEnd={memAluToDmemAddrActive ? "url(#m-arr-green)" : undefined}
              style={wireStyle(memAluToDmemAddrActive)}
            />
            {/* 2) ALU Result Bypass (EX/MEM ➔ MEM/WB 버퍼 직행, X = 225) */}
            <path
              d="M 310,965 L 225,965 L 225,1154"
              fill="none"
              stroke={memAluBypassActive ? "#16A34A" : "transparent"}
              strokeWidth="2.8"
              strokeDasharray="6 3"
              markerEnd={memAluBypassActive ? "url(#m-arr-green)" : undefined}
              style={wireStyle(memAluBypassActive)}
            />
            <circle
              cx="310"
              cy="965"
              r="3.5"
              fill={memAluBypassActive ? "#16A34A" : "transparent"}
              style={wireStyle(memAluBypassActive)}
            />

            {/* 3) Write Data (sw 명령어용: EX/MEM 버퍼 ➔ Data Memory Write Data 포트, X = 480) */}
            <line
              x1="480"
              y1="936"
              x2="480"
              y2="994"
              stroke={memWriteDataActive ? "#16A34A" : "transparent"}
              strokeWidth="2.8"
              className={memWriteDataActive ? "stream-down-active" : undefined}
              markerEnd={memWriteDataActive ? "url(#m-arr-green)" : undefined}
              style={wireStyle(memWriteDataActive)}
            />

            {/* 부품 7: Data Memory (미니멀 라운드 박스, x=270, width=280, y=996..1106, center=410) */}
            <rect
              x="270"
              y="996"
              width="280"
              height="110"
              rx="8"
              fill={memAluToDmemAddrActive ? "url(#g-dmem)" : "#F8FAFC"}
              stroke={memAluToDmemAddrActive ? "#16A34A" : "#CBD5E1"}
              strokeWidth="2"
            />
            <text
              x="410"
              y="1051"
              dominantBaseline="central"
              fill={memAluToDmemAddrActive ? "#14532D" : "#94A3B8"}
              fontSize="21"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              Data Memory
            </text>

            {/* Data Memory 출력 ➔ MEM/WB BUFFER (X = 470) */}
            <line
              x1="470"
              y1="1106"
              x2="470"
              y2="1154"
              stroke={memDmemReadDataActive ? "#16A34A" : "transparent"}
              strokeWidth="2.8"
              className={memDmemReadDataActive ? "stream-down-active" : undefined}
              markerEnd={memDmemReadDataActive ? "url(#m-arr-green)" : undefined}
              style={wireStyle(memDmemReadDataActive)}
            />

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 4: MEM / WB BUFFER (가로길이 30% 확장: w=690, x=110) */}
            {/* ============================================================ */}
            <rect
              x="110"
              y="1156"
              width="690"
              height="26"
              rx="6"
              fill="url(#g-buffer)"
              stroke="#94A3B8"
              strokeWidth="1.6"
            />
            <text
              x="455"
              y="1169"
              dominantBaseline="central"
              fill="#1E293B"
              fontSize="15.5"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
              letterSpacing="2"
            >
              MEM / WB BUFFER
            </text>

            {/* ============================================================ */}
            {/* [STAGE 5] WRITE-BACK (WB) : Y = 1182 ~ 1350                  */}
            {/* ============================================================ */}
            {/* 1) ALU Result Bypass ➔ WB MUX 좌측 입력 (X = 225 -> 410) */}
            <path
              d="M 225,1182 L 225,1218 L 410,1218 L 410,1256"
              fill="none"
              stroke={wbAluBypassActive ? "#2563EB" : "transparent"}
              strokeWidth="2.8"
              strokeDasharray="6 3"
              markerEnd={wbAluBypassActive ? "url(#m-arr-blue)" : undefined}
              style={wireStyle(wbAluBypassActive)}
            />

            {/* 2) Data Memory Read Data ➔ WB MUX 우측 입력 (X = 470 직선 직하강) */}
            <line
              x1="470"
              y1="1182"
              x2="470"
              y2="1256"
              stroke={wbDmemReadDataActive ? "#2563EB" : "transparent"}
              strokeWidth="2.8"
              markerEnd={wbDmemReadDataActive ? "url(#m-arr-blue)" : undefined}
              style={wireStyle(wbDmemReadDataActive)}
            />

            {/* 부품 8: WB MUX (알약형 / Stadium Capsule: x=390, y=1258, w=100, h=38, rx=19, center 440) */}
            <rect
              x="390"
              y="1258"
              width="100"
              height="38"
              rx="19"
              ry="19"
              fill={wbAluBypassActive || wbDmemReadDataActive ? "#DBEAFE" : "#F8FAFC"}
              stroke={wbAluBypassActive || wbDmemReadDataActive ? "#2563EB" : "#CBD5E1"}
              strokeWidth="2"
            />
            <text
              x="440"
              y="1277"
              dominantBaseline="central"
              fill={wbAluBypassActive || wbDmemReadDataActive ? "#1E40AF" : "#94A3B8"}
              fontSize="18"
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              MUX
            </text>

            {/* ============================================================ */}
            {/* ★ 역방향 피드백 버스 (WB MUX ➔ ID RegFile Write Data In)     */}
            {/* ============================================================ */}
            <path
              d="M 440,1296 L 440,1315 L 85,1315 L 85,424 L 165,424"
              fill="none"
              stroke={wbReverseFeedbackActive ? "#2563EB" : "transparent"}
              strokeWidth="2.8"
              strokeDasharray={wbReverseFeedbackActive ? "6 3" : undefined}
              className={wbReverseFeedbackActive ? "stream-feedback-active" : undefined}
              markerEnd={wbReverseFeedbackActive ? "url(#m-arr-blue)" : undefined}
              style={wireStyle(wbReverseFeedbackActive)}
            />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default PipelineVisualizer;