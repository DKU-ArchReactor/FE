import React, { useState } from 'react';
import type { CycleHistoryItem } from '@/type/simulation';

interface PipelineVisualizerProps {
  mode?: "single" | "pipeline";
  currentData: CycleHistoryItem | null;
  loadingMessage?: string | null;
}

const PipelineVisualizer: React.FC<PipelineVisualizerProps> = ({ currentData, loadingMessage, mode = "pipeline" }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  if (loadingMessage) {
    return (
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-blue-700">{loadingMessage}</p>
        <p className="text-xs text-slate-400">컴파일 및 파이프라인 시뮬레이션 결과를 준비하고 있습니다.</p>
      </div>
    );
  }

  if (!currentData) {
    return (
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center justify-center text-slate-400 text-sm">
        C 소스 코드를 작성하고 [⚡ 컴파일]을 누르면 파이프라인 데이터패스가 활성화됩니다.
      </div>
    );
  }

  const { cycle_events, clock } = currentData;
  const activity = currentData.stage_activity;
  const isStall = cycle_events.stall?.has_stall;
  const isForward = cycle_events.forwarding?.has_forwarded;
  const isBranchFlush = cycle_events.control_hazard?.has_flush;

  // 5단계별 명령어
  const ifInst = activity?.IF?.assembly || 'bubble';
  const idInst = activity?.ID?.assembly || 'bubble';
  const exInst = activity?.EX?.assembly || 'bubble';
  const memInst = activity?.MEM?.assembly || 'bubble';
  const wbInst = activity?.WB?.assembly || 'bubble';

  // 활성 여부
  const isIfActive = ifInst !== 'bubble' && ifInst !== 'empty';
  const isIdActive = idInst !== 'bubble' && idInst !== 'empty';
  const isExActive = exInst !== 'bubble' && exInst !== 'empty';
  const isMemActive = activity?.MEM.status !== 'error' && ['load', 'store'].includes(activity?.MEM.memory_operation ?? 'none');
  const isWbActive = activity?.WB.will_write_reg === true;

  // 줌 조절
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(2.0, +(prev + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.5, +(prev - 0.15).toFixed(2)));
  const handleZoomReset = () => setZoomLevel(1.0);

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-xs border border-slate-200/90 p-3 flex flex-col justify-between overflow-hidden relative select-none">
      {/* 동적 CSS 애니메이션 및 정밀 스트리밍 스타일 */}
      <style>{`
        @keyframes streamDown {
          from { stroke-dashoffset: 20; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes streamUp {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: 20; }
        }
        .stream-down-active {
          stroke-dasharray: 5 3;
          animation: streamDown 0.75s linear infinite;
        }
        .stream-feedback-active {
          stroke-dasharray: 6 3;
          animation: streamUp 1.1s linear infinite;
        }
        @keyframes pulseGlowAmber {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.4)); }
          50% { filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.85)); }
        }
        .glow-active-ex {
          animation: pulseGlowAmber 1.6s ease-in-out infinite;
        }
      `}</style>

      {/* 1. 상단 헤더 & 컨트롤러 */}
      <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <h3 className="text-xs font-bold text-slate-800">{mode === 'single' ? 'Single-Cycle Datapath' : '5-Stage Pipeline Datapath'}</h3>
          <span className="text-[10px] text-slate-400 font-mono">(완료 클록 {clock + 1})</span>
        </div>

        {/* 이벤트 뱃지 & 줌 컨트롤 */}
        <div className="flex items-center gap-1.5">
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
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-1 py-0.5 text-slate-600 text-[10px]">
            <button
              onClick={handleZoomOut}
              className="px-1 hover:text-blue-600 font-bold cursor-pointer"
              title="축소"
            >
              −
            </button>
            <button
              onClick={handleZoomReset}
              className="px-1 font-mono font-semibold hover:text-blue-600 cursor-pointer"
              title="100% 리셋"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="px-1 hover:text-blue-600 font-bold cursor-pointer"
              title="확대"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* 2. 세로형 정밀 SVG 캔버스 (타이트한 뷰박스 560 x 925 및 불필요한 스크롤 방지) */}
      <div className="flex-1 overflow-auto relative w-full min-h-0 py-1 px-1 custom-scrollbar flex items-start justify-center">
        <div
          className="transition-all duration-150 flex flex-col items-center justify-start w-full mx-auto"
          style={{
            maxWidth: '680px',
            transform: zoomLevel !== 1.0 ? `scale(${zoomLevel})` : undefined,
            transformOrigin: 'top center',
          }}
        >
          <svg
            viewBox="0 0 560 925"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-auto select-none block"
            style={{ minWidth: '460px' }}
          >
            <defs>
              {/* 표준 SVG 자동 회전(orient="auto") 화살표 마커 */}
              <marker id="m-arr-def" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94A3B8" />
              </marker>
              <marker id="m-arr-red" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#DC2626" />
              </marker>
              <marker id="m-arr-orange" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#EA580C" />
              </marker>
              <marker id="m-arr-amber" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#D97706" />
              </marker>
              <marker id="m-arr-green" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#16A34A" />
              </marker>
              <marker id="m-arr-blue" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563EB" />
              </marker>
              <marker id="m-arr-cyan" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0891B2" />
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
            </defs>

            {/* ============================================================ */}
            {/* [STAGE 1] INSTRUCTION FETCH (IF) : y=15 ~ y=150              */}
            {/* ============================================================ */}
            <g transform="translate(60, 15)">
              {/* 스테이지 제목 라벨 & 명령어 뱃지 */}
              <text x="0" y="16" fill="#DC2626" fontSize="11" fontWeight="bold">
                1. IF (Instruction Fetch)
              </text>
              <g transform="translate(250, 0)">
                <rect
                  x="0"
                  y="0"
                  width="220"
                  height="22"
                  rx="6"
                  fill={isIfActive ? "#FEF2F2" : "#F8FAFC"}
                  stroke={isIfActive ? "#F87171" : "#CBD5E1"}
                  strokeWidth="1.2"
                />
                <text
                  x="110"
                  y="15"
                  fill={isIfActive ? "#991B1B" : "#94A3B8"}
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {ifInst}
                </text>
              </g>

              {/* 부품 1: PC */}
              <g transform="translate(195, 38)">
                <rect
                  x="0"
                  y="0"
                  width="90"
                  height="28"
                  rx="6"
                  fill={isIfActive ? "url(#g-pc)" : "#FFFFFF"}
                  stroke={isIfActive ? "#EF4444" : "#94A3B8"}
                  strokeWidth="1.5"
                />
                <text x="45" y="13" fill="#991B1B" fontSize="9.5" fontWeight="bold" textAnchor="middle">
                  PC
                </text>
                <text x="45" y="24" fill="#B91C1C" fontSize="7.5" fontFamily="monospace" textAnchor="middle">
                  {activity?.IF?.pc ? activity.IF.pc.slice(-6) : "0x0000"}
                </text>
              </g>

              {/* PC ➔ Instruction Memory 직하강 선 (x=240, ⬇) */}
              <line
                x1="240"
                y1="66"
                x2="240"
                y2="90"
                stroke={isIfActive ? "#EF4444" : "#94A3B8"}
                strokeWidth="2.5"
                className={isIfActive ? "stream-down-active" : undefined}
                markerEnd={isIfActive ? "url(#m-arr-red)" : "url(#m-arr-def)"}
              />

              {/* 부품 2: Instruction Memory */}
              <g transform="translate(150, 90)">
                <rect
                  x="0"
                  y="0"
                  width="180"
                  height="36"
                  rx="7"
                  fill={isIfActive ? "url(#g-imem)" : "#FFFFFF"}
                  stroke={isIfActive ? "#3B82F6" : "#94A3B8"}
                  strokeWidth="2"
                />
                <text x="90" y="17" fill="#1E40AF" fontSize="10.5" fontWeight="bold" textAnchor="middle">
                  Instruction Memory
                </text>
                <text x="90" y="29" fill="#64748B" fontSize="7.5" textAnchor="middle">
                  Read Inst [31:0] @ PC
                </text>
              </g>

              {/* PC+4 보조 가산기 (우측 x=385, y=40) */}
              <path
                d="M 285,52 L 380,52"
                fill="none"
                stroke="#94A3B8"
                strokeWidth="1.5"
                markerEnd="url(#m-arr-def)"
              />
              <g transform="translate(385, 40)">
                <polygon
                  points="0,0 55,0 42,24 13,24"
                  fill="#F8FAFC"
                  stroke="#94A3B8"
                  strokeWidth="1.2"
                />
                <text x="27" y="15" fill="#475569" fontSize="8" fontWeight="bold" textAnchor="middle">
                  PC + 4 ⬇
                </text>
              </g>
            </g>

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 1: IF / ID BUFFER (y=165)                     */}
            {/* ============================================================ */}
            <line
              x1="240"
              y1="141"
              x2="240"
              y2="163"
              stroke={isIfActive ? "#DC2626" : "#94A3B8"}
              strokeWidth="2.5"
              className={isIfActive ? "stream-down-active" : undefined}
              markerEnd={isIfActive ? "url(#m-arr-red)" : "url(#m-arr-def)"}
            />

            <g transform="translate(50, 165)">
              <rect x="0" y="0" width="480" height="14" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1" />
              <text x="240" y="10.5" fill="#334155" fontSize="8.5" fontWeight="bold" textAnchor="middle" letterSpacing="1.5">
                {mode === 'single' ? 'IF / ID 조합 경로' : 'IF / ID BUFFER ⬇'}
              </text>
            </g>

            {/* ============================================================ */}
            {/* [STAGE 2] INSTRUCTION DECODE (ID) : y=190 ~ y=340            */}
            {/* ============================================================ */}
            <g transform="translate(60, 190)">
              {/* 스테이지 제목 라벨 & 명령어 뱃지 */}
              <text x="0" y="16" fill="#EA580C" fontSize="11" fontWeight="bold">
                2. ID (Instruction Decode)
              </text>
              <g transform="translate(250, 0)">
                <rect
                  x="0"
                  y="0"
                  width="220"
                  height="22"
                  rx="6"
                  fill={isIdActive ? "#FFF7ED" : "#F8FAFC"}
                  stroke={isIdActive ? "#FB923C" : "#CBD5E1"}
                  strokeWidth="1.2"
                />
                <text
                  x="110"
                  y="15"
                  fill={isIdActive ? "#C2410C" : "#94A3B8"}
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {idInst}
                </text>
              </g>

              {/* 부품 3: Register File (Registers) */}
              <g transform="translate(50, 38)">
                <rect
                  x="0"
                  y="0"
                  width="260"
                  height="70"
                  rx="8"
                  fill={isIdActive ? "url(#g-regfile)" : "#FFFFFF"}
                  stroke={isIdActive ? "#16A34A" : "#94A3B8"}
                  strokeWidth="2"
                />
                {/* 좌측 옆구리 Write Data 포트 핀 (center y = 27 + 8 = 35) */}
                <rect x="-10" y="27" width="10" height="16" fill="#2563EB" rx="2" />
                <text x="-14" y="39" fill="#2563EB" fontSize="8" fontWeight="bold" textAnchor="end">
                  Write Data In
                </text>

                <text x="130" y="17" fill="#15803D" fontSize="11" fontWeight="bold" textAnchor="middle">
                  Registers (Register File)
                </text>
                <text x="14" y="36" fill="#4B5563" fontSize="8" fontFamily="monospace">
                  rs1 (Read Reg 1)
                </text>
                <text x="14" y="53" fill="#4B5563" fontSize="8" fontFamily="monospace">
                  rs2 (Read Reg 2)
                </text>
                <text x="100" y="61" fill="#15803D" fontSize="8.5" fontWeight="bold">
                  Data 1 ⬇
                </text>
                <text x="200" y="61" fill="#15803D" fontSize="8.5" fontWeight="bold">
                  Data 2 ⬇
                </text>
              </g>

              {/* IF/ID 버퍼에서 ImmGen으로 직하강(⬇) 입력선 */}
              <line
                x1="382"
                y1="-11"
                x2="382"
                y2="36"
                stroke={isIdActive ? "#EA580C" : "#94A3B8"}
                strokeWidth="2"
                markerEnd={isIdActive ? "url(#m-arr-orange)" : "url(#m-arr-def)"}
              />

              {/* 부품 4: Imm Gen (즉시값 생성기 - 우측 x=345, y=38) */}
              <g transform="translate(345, 38)">
                <rect
                  x="0"
                  y="0"
                  width="75"
                  height="70"
                  rx="12"
                  fill="#FFFFFF"
                  stroke="#94A3B8"
                  strokeWidth="1.5"
                />
                <text x="37" y="24" fill="#334155" fontSize="9.5" fontWeight="bold" textAnchor="middle">
                  Imm Gen
                </text>
                <text x="37" y="41" fill="#64748B" fontSize="7.5" textAnchor="middle">
                  Sign Extend
                </text>
                <text x="37" y="58" fill="#0284C7" fontSize="8" fontWeight="bold" textAnchor="middle">
                  Imm ⬇
                </text>
              </g>

              {/* 제어장치 (Control Unit - 극우측) */}
              <line
                x1="420"
                y1="73"
                x2="435"
                y2="73"
                stroke="#94A3B8"
                strokeWidth="1.2"
                markerEnd="url(#m-arr-def)"
              />
              <g transform="translate(435, 48)">
                <ellipse cx="18" cy="25" rx="16" ry="25" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.2" />
                <text x="18" y="23" fill="#475569" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                  Control
                </text>
                <text x="18" y="33" fill="#64748B" fontSize="6.5" textAnchor="middle">
                  Unit
                </text>
              </g>

              {/* ID 바닥에서 ID/EX 버퍼로 내려가는 3개 버스선 (⬇) */}
              <line
                x1="150"
                y1="108"
                x2="150"
                y2="163"
                stroke={isIdActive ? "#EA580C" : "#94A3B8"}
                strokeWidth="2.5"
                className={isIdActive ? "stream-down-active" : undefined}
                markerEnd={isIdActive ? "url(#m-arr-orange)" : "url(#m-arr-def)"}
              />
              <line
                x1="250"
                y1="108"
                x2="250"
                y2="163"
                stroke={isIdActive ? "#EA580C" : "#94A3B8"}
                strokeWidth="2.5"
                className={isIdActive ? "stream-down-active" : undefined}
                markerEnd={isIdActive ? "url(#m-arr-orange)" : "url(#m-arr-def)"}
              />
              <line
                x1="382"
                y1="108"
                x2="382"
                y2="163"
                stroke={isIdActive ? "#0284C7" : "#94A3B8"}
                strokeWidth="2"
                strokeDasharray="4 2"
                markerEnd={isIdActive ? "url(#m-arr-cyan)" : "url(#m-arr-def)"}
              />
            </g>

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 2: ID / EX BUFFER (y=355)                     */}
            {/* ============================================================ */}
            <g transform="translate(50, 355)">
              <rect x="0" y="0" width="480" height="14" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1" />
              <text x="240" y="10.5" fill="#334155" fontSize="8.5" fontWeight="bold" textAnchor="middle" letterSpacing="1.5">
                {mode === 'single' ? 'ID / EX 조합 경로' : 'ID / EX BUFFER ⬇'}
              </text>
            </g>

            {/* ============================================================ */}
            {/* [STAGE 3] EXECUTE / ALU (EX) : y=380 ~ y=575                 */}
            {/* ============================================================ */}
            <g transform="translate(60, 380)">
              {/* 스테이지 제목 라벨 & 명령어 뱃지 */}
              <text x="0" y="16" fill="#CA8A04" fontSize="11" fontWeight="bold">
                3. EX (Execute / ALU)
              </text>
              <g transform="translate(250, 0)">
                <rect
                  x="0"
                  y="0"
                  width="220"
                  height="22"
                  rx="6"
                  fill={isExActive ? "#FEFCE8" : "#F8FAFC"}
                  stroke={isExActive ? "#FACC15" : "#CBD5E1"}
                  strokeWidth="1"
                />
                <text
                  x="110"
                  y="15"
                  fill={isExActive ? "#854D0E" : "#94A3B8"}
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {exInst}
                </text>
              </g>

              {/* 1) Read Data 1은 ALU 왼쪽 입력구로 직진 (x=150) */}
              <line
                x1="150"
                y1="-11"
                x2="150"
                y2="82"
                stroke={isExActive ? "#D97706" : "#94A3B8"}
                strokeWidth="2.5"
                markerEnd={isExActive ? "url(#m-arr-amber)" : "url(#m-arr-def)"}
              />

              {/* Read Data 2 (x=250) 와 Imm (x=382)가 ALUSrc MUX로 결합 */}
              <line
                x1="250"
                y1="-11"
                x2="250"
                y2="36"
                stroke={isExActive ? "#D97706" : "#94A3B8"}
                strokeWidth="2"
                markerEnd={isExActive ? "url(#m-arr-amber)" : "url(#m-arr-def)"}
              />
              <path
                d="M 382,-11 L 382,38 L 290,38"
                fill="none"
                stroke={isExActive ? "#0284C7" : "#94A3B8"}
                strokeWidth="1.5"
                strokeDasharray="4 2"
                markerEnd={isExActive ? "url(#m-arr-cyan)" : "url(#m-arr-def)"}
              />

              {/* ALUSrc MUX (x=235, y=38 - 정밀 사다리꼴) */}
              <g transform="translate(235, 38)">
                <polygon
                  points="0,0 70,0 55,20 15,20"
                  fill="#EFF6FF"
                  stroke="#3B82F6"
                  strokeWidth="1.2"
                />
                <text x="35" y="13" fill="#1E40AF" fontSize="8" fontWeight="bold" textAnchor="middle">
                  ALUSrc MUX ⬇
                </text>
              </g>

              {/* ALUSrc MUX 출력 ➔ ALU 오른쪽 입력구로 연결 (x=270, ⬇) */}
              <line
                x1="270"
                y1="58"
                x2="270"
                y2="82"
                stroke={isExActive ? "#D97706" : "#94A3B8"}
                strokeWidth="2.5"
                markerEnd={isExActive ? "url(#m-arr-amber)" : "url(#m-arr-def)"}
              />

              {/* 리모델링된 모던 ALU (Clean Chamfered V-Datapath) */}
              <g transform="translate(120, 84)" className={isExActive ? "glow-active-ex" : undefined}>
                <polygon
                  points="
                    0,0 
                    60,0 
                    90,32 
                    120,0 
                    180,0 
                    145,28 
                    145,56 
                    110,82 
                    70,82 
                    35,56 
                    35,28
                  "
                  fill={isExActive ? "#FEF9C3" : "#FFFFFF"}
                  stroke={isExActive ? "#D97706" : "#64748B"}
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                {/* 내부 기하학적 인셋 라인 */}
                <polygon
                  points="
                    15,9 
                    55,9 
                    90,38 
                    125,9 
                    165,9 
                    135,32 
                    135,52 
                    105,74 
                    75,74 
                    45,52 
                    45,32
                  "
                  fill="none"
                  stroke={isExActive ? "#F59E0B" : "#E2E8F0"}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />

                {/* 중앙 ALU 메인 타이포 */}
                <text x="90" y="52" fill="#78350F" fontSize="15" fontWeight="900" textAnchor="middle" letterSpacing="1">
                  ALU
                </text>
                <text x="90" y="66" fill="#92400E" fontSize="8" fontWeight="bold" textAnchor="middle">
                  (Arithmetic / Logic)
                </text>
              </g>

              {/* Branch Adder 점선 */}
              <path
                d="M 382,38 L 415,38 L 415,99"
                fill="none"
                stroke="#94A3B8"
                strokeWidth="1.2"
                strokeDasharray="4 2"
                markerEnd="url(#m-arr-def)"
              />
              <g transform="translate(385, 102)">
                <polygon
                  points="0,0 60,0 48,24 12,24"
                  fill="#F8FAFC"
                  stroke="#94A3B8"
                  strokeWidth="1.2"
                />
                <text x="30" y="15" fill="#475569" fontSize="8" fontWeight="bold" textAnchor="middle">
                  Branch Add ⬇
                </text>
              </g>

              {/* ALU 바닥 뾰족한 곳에서 아래로 나오는 결과 화살표 (x=210, ⬇) */}
              <line
                x1="210"
                y1="166"
                x2="210"
                y2="213"
                stroke={isExActive ? "#D97706" : "#94A3B8"}
                strokeWidth="3"
                className={isExActive ? "stream-down-active" : undefined}
                markerEnd={isExActive ? "url(#m-arr-amber)" : "url(#m-arr-def)"}
              />
            </g>

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 3: EX / MEM BUFFER (y=595)                    */}
            {/* ============================================================ */}
            <g transform="translate(50, 595)">
              <rect x="0" y="0" width="480" height="14" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1" />
              <text x="240" y="10.5" fill="#334155" fontSize="8.5" fontWeight="bold" textAnchor="middle" letterSpacing="1.5">
                {mode === 'single' ? 'EX / MEM 조합 경로' : 'EX / MEM BUFFER ⬇'}
              </text>
            </g>

            {/* ============================================================ */}
            {/* [STAGE 4] MEMORY ACCESS (MEM) : y=620 ~ y=765                */}
            {/* ============================================================ */}
            <g transform="translate(60, 620)">
              {/* 스테이지 제목 라벨 & 명령어 뱃지 */}
              <text x="0" y="16" fill="#16A34A" fontSize="11" fontWeight="bold">
                4. MEM (Memory Access)
              </text>
              <g transform="translate(250, 0)">
                <rect
                  x="0"
                  y="0"
                  width="220"
                  height="22"
                  rx="6"
                  fill={isMemActive ? "#F0FDF4" : "#F8FAFC"}
                  stroke={isMemActive ? "#4ADE80" : "#CBD5E1"}
                  strokeWidth="1.2"
                />
                <text
                  x="110"
                  y="15"
                  fill={isMemActive ? "#15803D" : "#94A3B8"}
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {memInst}
                </text>
              </g>

              {/* 부품 6: Data Memory (D-Mem - 중앙 x=140, y=38) */}
              <g transform="translate(140, 38)">
                <rect
                  x="0"
                  y="0"
                  width="200"
                  height="70"
                  rx="8"
                  fill={isMemActive ? "url(#g-dmem)" : "#FFFFFF"}
                  stroke={isMemActive ? "#16A34A" : "#94A3B8"}
                  strokeWidth="2"
                />
                <text x="100" y="19" fill="#14532D" fontSize="11" fontWeight="bold" textAnchor="middle">
                  Data Memory
                </text>
                <text x="14" y="36" fill="#374151" fontSize="8" fontFamily="monospace">
                  ⬇ Address (from ALU)
                </text>
                <text x="14" y="52" fill="#374151" fontSize="8" fontFamily="monospace">
                  ⬇ Write Data (sw)
                </text>
                <text x="186" y="58" fill="#15803D" fontSize="8.5" fontWeight="bold" textAnchor="end">
                  Read Data ⬇
                </text>
              </g>

              {/* ALU 바닥에서 Data Memory 주소 입력으로 직통하는 선 (x=210, ⬇) */}
              <line
                x1="210"
                y1="-11"
                x2="210"
                y2="36"
                stroke={isMemActive ? "#16A34A" : "#94A3B8"}
                strokeWidth="2.5"
                markerEnd={isMemActive ? "url(#m-arr-green)" : "url(#m-arr-def)"}
              />

              {/* ALU Bypass 선을 좌측 x=35로 분리 */}
              <path
                d="M 35,-11 L 35,163"
                fill="none"
                stroke={isMemActive ? "#16A34A" : "#94A3B8"}
                strokeWidth="2"
                strokeDasharray="4 2"
                markerEnd={isMemActive ? "url(#m-arr-green)" : "url(#m-arr-def)"}
              />
              <text x="22" y="85" fill="#64748B" fontSize="8" fontWeight="bold" transform="rotate(-90, 22, 85)">
                ALU Bypass ⬇
              </text>

              {/* Data Memory 바닥에서 아래로 출력되는 신호선 (x=240, ⬇) */}
              <line
                x1="240"
                y1="108"
                x2="240"
                y2="163"
                stroke={isMemActive ? "#16A34A" : "#94A3B8"}
                strokeWidth="2.5"
                className={isMemActive ? "stream-down-active" : undefined}
                markerEnd={isMemActive ? "url(#m-arr-green)" : "url(#m-arr-def)"}
              />
            </g>

            {/* ============================================================ */}
            {/* 파이프라인 버퍼 4: MEM / WB BUFFER (y=785)                    */}
            {/* ============================================================ */}
            <g transform="translate(50, 785)">
              <rect x="0" y="0" width="480" height="14" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1" />
              <text x="240" y="10.5" fill="#334155" fontSize="8.5" fontWeight="bold" textAnchor="middle" letterSpacing="1.5">
                {mode === 'single' ? 'MEM / WB 조합 경로' : 'MEM / WB BUFFER ⬇'}
              </text>
            </g>

            {/* ============================================================ */}
            {/* [STAGE 5] WRITE-BACK (WB) : y=810 ~ y=925                    */}
            {/* ============================================================ */}
            <g transform="translate(60, 810)">
              {/* 스테이지 제목 라벨 & 명령어 뱃지 */}
              <text x="0" y="16" fill="#2563EB" fontSize="11" fontWeight="bold">
                5. WB (Write-Back)
              </text>
              <g transform="translate(250, 0)">
                <rect
                  x="0"
                  y="0"
                  width="220"
                  height="22"
                  rx="6"
                  fill={isWbActive ? "#EFF6FF" : "#F8FAFC"}
                  stroke={isWbActive ? "#60A5FA" : "#CBD5E1"}
                  strokeWidth="1"
                />
                <text
                  x="110"
                  y="15"
                  fill={isWbActive ? "#1D4ED8" : "#94A3B8"}
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {wbInst}
                </text>
              </g>

              {/* ALU Bypass 선이 헤더 아래(y=38)로 진입 */}
              <path
                d="M 35,-11 L 35,38 L 180,38"
                fill="none"
                stroke={isWbActive ? "#2563EB" : "#94A3B8"}
                strokeWidth="2"
                strokeDasharray="4 2"
                markerEnd={isWbActive ? "url(#m-arr-blue)" : "url(#m-arr-def)"}
              />

              {/* Data Memory Read Data가 MUX 오른쪽으로 진입 (x=240) */}
              <line
                x1="240"
                y1="-11"
                x2="240"
                y2="36"
                stroke={isWbActive ? "#2563EB" : "#94A3B8"}
                strokeWidth="2"
                markerEnd={isWbActive ? "url(#m-arr-blue)" : "url(#m-arr-def)"}
              />

              {/* 부품 7: MemtoReg MUX (중앙 x=170, y=38 - ⬇) */}
              <g transform="translate(170, 38)">
                <polygon
                  points="0,0 120,0 95,26 25,26"
                  fill={isWbActive ? "#DBEAFE" : "#FFFFFF"}
                  stroke={isWbActive ? "#2563EB" : "#94A3B8"}
                  strokeWidth="2"
                />
                <text x="60" y="17" fill="#1E40AF" fontSize="9.5" fontWeight="bold" textAnchor="middle">
                  MemtoReg MUX ⬇
                </text>
              </g>

              {/* MUX 출력 결과 (아래로 직하강 x=230, ⬇) */}
              <line
                x1="230"
                y1="64"
                x2="230"
                y2="108"
                stroke={isWbActive ? "#2563EB" : "#94A3B8"}
                strokeWidth="2.5"
                className={isWbActive ? "stream-down-active" : undefined}
                markerEnd={isWbActive ? "url(#m-arr-blue)" : "url(#m-arr-def)"}
              />
              <text x="240" y="98" fill="#1D4ED8" fontSize="8.5" fontWeight="bold">
                Write Data to rd ⬇
              </text>
            </g>

            {/* ============================================================ */}
            {/* ★ 역방향 피드백 버스 (WB ➔ ID 단계 RegFile Write Data In 핀) ★    */}
            {/* ============================================================ */}
            <path
              d="M 230,915 L 18,915 L 18,263 L 98,263"
              fill="none"
              stroke={isWbActive ? "#2563EB" : "#CBD5E1"}
              strokeWidth={isWbActive ? "2.5" : "1.5"}
              strokeDasharray={isWbActive ? "6 3" : undefined}
              className={isWbActive ? "stream-feedback-active" : undefined}
              markerEnd={isWbActive ? "url(#m-arr-blue)" : "url(#m-arr-def)"}
            />
            {/* 세로 피드백 안내 라벨 */}
            <text
              x="10"
              y="589"
              fill="#2563EB"
              fontSize="8.5"
              fontWeight="extrabold"
              transform="rotate(-90, 10, 589)"
              textAnchor="middle"
            >
              ▲ RegFile Write Feedback Bus (rd)
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default PipelineVisualizer;
