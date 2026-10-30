import React, { useState } from 'react';
import type { CycleHistoryItem } from '@/type/simulation';

interface PipelineVisualizerProps {
  currentData: CycleHistoryItem | null;
  loadingMessage?: string | null;
}

const PipelineVisualizer: React.FC<PipelineVisualizerProps> = ({ currentData, loadingMessage }) => {
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
        C 소스 파일을 추가하고 변환 버튼을 눌러 시뮬레이션을 실행해 주세요.
      </div>
    );
  }

  const { buffers, cycle_events } = currentData;
  const isStall = cycle_events.stall?.has_stall;
  const isForward = cycle_events.forwarding?.has_forwarded;
  const isBranchFlush = cycle_events.control_hazard?.has_flush;

  // 각 파이프라인 단계별 명령어 추출
  const ifInst = buffers.IF?.assembly || 'bubble';
  const idInst = buffers.ID?.assembly || 'bubble';
  const exInst = buffers.EX?.assembly || 'bubble';
  const memInst = buffers.MEM?.assembly || 'bubble';
  const wbInst = buffers.WB?.assembly || 'bubble';

  // 활성 상태 판정
  const isIfActive = ifInst !== 'bubble' && ifInst !== 'empty';
  const isIdActive = idInst !== 'bubble' && idInst !== 'empty';
  const isExActive = exInst !== 'bubble' && exInst !== 'empty';
  const isMemActive = memInst !== 'bubble' && memInst !== 'empty' && (memInst.startsWith('lw') || memInst.startsWith('sw'));
  const isWbActive = wbInst !== 'bubble' && wbInst !== 'empty';


  // 줌 조절 핸들러
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(2.5, +(prev + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.5, +(prev - 0.25).toFixed(2)));
  const handleZoomReset = () => setZoomLevel(1.0);

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-3.5 flex flex-col justify-between overflow-hidden relative">
      {/* SVG 애니메이션 전용 스타일 */}
      <style>{`
        @keyframes flowRight {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes flowLeft {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: 24; }
        }
        @keyframes pulseForward {
          0%, 100% { opacity: 0.8; filter: drop-shadow(0 0 2px rgba(6, 182, 212, 0.4)); }
          50% { opacity: 1; filter: drop-shadow(0 0 8px rgba(6, 182, 212, 0.8)); }
        }
        @keyframes pulseStall {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(244, 63, 94, 0.4)); }
          50% { filter: drop-shadow(0 0 8px rgba(244, 63, 94, 0.9)); }
        }
        .anim-flow-main {
          stroke-dasharray: 6 4;
          animation: flowRight 1s linear infinite;
        }
        .anim-flow-wb {
          stroke-dasharray: 8 5;
          animation: flowLeft 1.2s linear infinite;
        }
        .anim-forwarding {
          stroke-dasharray: 6 4;
          animation: flowLeft 0.8s linear infinite, pulseForward 1.5s ease-in-out infinite;
        }
        .anim-stall {
          animation: pulseStall 1.2s ease-in-out infinite;
        }
      `}</style>

      {/* 우측 상단 플로팅 말풍선: 화면 비율 줌 컨트롤러 */}
      <div className="absolute right-3.5 top-3.5 z-20 flex items-center bg-white/90 backdrop-blur-md px-1.5 py-1 rounded-xl border border-slate-200/90 shadow-sm text-slate-700">
        <button
          onClick={handleZoomOut}
          disabled={zoomLevel <= 0.5}
          title="축소"
          className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded-lg hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 transition-colors cursor-pointer"
        >
          −
        </button>
        <button
          onClick={handleZoomReset}
          title="원래 크기로 리셋 (더블클릭/클릭)"
          className="px-2 py-0.5 text-[11px] font-mono font-bold text-slate-800 hover:text-blue-600 transition-colors cursor-pointer"
        >
          {Math.round(zoomLevel * 100)}%
        </button>
        <button
          onClick={handleZoomIn}
          disabled={zoomLevel >= 2.5}
          title="확대"
          className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded-lg hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 transition-colors cursor-pointer"
        >
          +
        </button>
      </div>

      {/* 가로/세로 스크롤 가능한 SVG Datapath 캔버스 영역 */}
      <div className="flex-1 overflow-auto relative w-full h-full min-h-0 py-1 px-1 custom-scrollbar flex items-center justify-center">
        <div
          className="transition-all duration-150 flex items-center justify-center max-w-full max-h-full w-full h-full mx-auto"
          style={{
            transform: zoomLevel !== 1.0 ? `scale(${zoomLevel})` : undefined,
            transformOrigin: 'center center',
          }}
        >
          <svg 
            viewBox="0 0 940 435" 
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full max-h-full max-w-full select-none"
          >
            <defs>
              {/* 화살표 마커들 */}
              <marker id="arr-base" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#94A3B8" />
              </marker>
              <marker id="arr-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#3B82F6" />
              </marker>
              <marker id="arr-cyan" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#06B6D4" />
              </marker>
              <marker id="arr-amber" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#F59E0B" />
              </marker>

              {/* 버전 3 네온 글로우 필터 */}
              <filter id="glow-alu" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#F59E0B" floodOpacity="0.8" />
              </filter>
              <filter id="glow-mem" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#10B981" floodOpacity="0.8" />
              </filter>

              {/* 슬림 파이프라인 레지스터 그라데이션 */}
              <linearGradient id="slimRegGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FEF08A" />
                <stop offset="100%" stopColor="#FACC15" />
              </linearGradient>

              <linearGradient id="aluGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FEF3C7" />
                <stop offset="100%" stopColor="#FDE68A" />
              </linearGradient>

              <linearGradient id="memGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#DCFCE7" />
                <stop offset="100%" stopColor="#BBF7D0" />
              </linearGradient>
            </defs>

            {/* ============================================================ */}
            {/* 1. 하단 영역 세로 점선 가이드선                               */}
            {/* ============================================================ */}
            <g stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 3">
              <line x1="189" y1="330" x2="189" y2="425" />
              <line x1="389" y1="330" x2="389" y2="425" />
              <line x1="589" y1="330" x2="589" y2="425" />
              <line x1="759" y1="330" x2="759" y2="425" />
            </g>

            {/* ============================================================ */}
            {/* 2. 초슬림 파이프라인 레지스터 바 (9px)                         */}
            {/* ============================================================ */}
            <g transform="translate(185, 40)" className={isStall ? "anim-stall" : ""}>
              <rect width="9" height="280" rx="3" fill={isStall ? "#FFE4E6" : isBranchFlush ? "#FEF3C7" : "url(#slimRegGrad)"} stroke={isStall ? "#F43F5E" : isBranchFlush ? "#F59E0B" : "#CA8A04"} strokeWidth="1.2" />
            </g>
            <g transform="translate(385, 40)">
              <rect width="9" height="280" rx="3" fill="url(#slimRegGrad)" stroke="#CA8A04" strokeWidth="1.2" />
            </g>
            <g transform="translate(585, 40)">
              <rect width="9" height="280" rx="3" fill="url(#slimRegGrad)" stroke="#CA8A04" strokeWidth="1.2" />
            </g>
            <g transform="translate(755, 40)">
              <rect width="9" height="280" rx="3" fill="url(#slimRegGrad)" stroke="#CA8A04" strokeWidth="1.2" />
            </g>

            {/* ============================================================ */}
            {/* 3. 기본 버스 배선 (레지스터 인-아웃 직결 연결)                 */}
            {/* ============================================================ */}
            <g stroke="#CBD5E1" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              {/* Fetch */}
              <path d="M 72 165 L 105 165" />
              <path d="M 88 165 L 88 95 L 105 95" />
              <path d="M 145 95 L 185 95" markerEnd="url(#arr-base)" />
              <path d="M 175 165 L 185 165" markerEnd="url(#arr-base)" />

              {/* Decode */}
              <path d="M 194 85 L 245 50" markerEnd="url(#arr-base)" />
              <path d="M 194 115 L 240 115" markerEnd="url(#arr-base)" />
              <path d="M 194 165 L 240 165" markerEnd="url(#arr-base)" />
              <path d="M 194 285 L 240 285" markerEnd="url(#arr-base)" />
              <path d="M 194 95 L 385 95" markerEnd="url(#arr-base)" />
              <path d="M 315 50 L 385 50" markerEnd="url(#arr-base)" />
              <path d="M 310 180 L 385 180" markerEnd="url(#arr-base)" />
              <path d="M 310 220 L 385 220" markerEnd="url(#arr-base)" />
              <path d="M 310 285 L 385 285" markerEnd="url(#arr-base)" />

              {/* Execute */}
              <path d="M 394 50 L 585 50" markerEnd="url(#arr-base)" />
              <path d="M 394 130 L 440 130" markerEnd="url(#arr-base)" />
              <path d="M 394 190 L 440 190" markerEnd="url(#arr-base)" />
              <path d="M 458 130 L 490 135" markerEnd="url(#arr-base)" />
              <path d="M 458 190 L 490 185" markerEnd="url(#arr-base)" />
              <path d="M 520 250 L 520 200" markerEnd="url(#arr-base)" />
              <path d="M 552 160 L 585 160" markerEnd="url(#arr-base)" />
              <path d="M 394 220 L 585 220" markerEnd="url(#arr-base)" />

              {/* Memory */}
              <path d="M 594 160 L 645 160" markerEnd="url(#arr-base)" />
              <path d="M 594 200 L 645 200" markerEnd="url(#arr-base)" />
              <path d="M 594 240 L 755 240" markerEnd="url(#arr-base)" />
              <path d="M 720 175 L 755 175" markerEnd="url(#arr-base)" />

              {/* Write-Back */}
              <path d="M 764 175 L 803 175" markerEnd="url(#arr-base)" />
              <path d="M 764 240 L 803 200" markerEnd="url(#arr-base)" />
            </g>

            {/* ============================================================ */}
            {/* 4. 활성 데이터 흐름 점선 애니메이션                          */}
            {/* ============================================================ */}
            <g fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {isIfActive && !isStall && (
                <path d="M 72 165 L 105 165 M 88 165 L 88 95 L 105 95 M 145 95 L 185 95 M 175 165 L 185 165" stroke="#3B82F6" className="anim-flow-main" markerEnd="url(#arr-blue)" />
              )}
              {isIdActive && (
                <path d="M 194 165 L 240 165 M 194 285 L 240 285 M 310 180 L 385 180 M 310 220 L 385 220 M 310 285 L 385 285" stroke="#6366F1" className="anim-flow-main" markerEnd="url(#arr-blue)" />
              )}
              {isExActive && (
                <path d="M 394 130 L 440 130 M 394 190 L 440 190 M 458 130 L 490 135 M 458 190 L 490 185 M 552 160 L 585 160" stroke="#F59E0B" className="anim-flow-main" markerEnd="url(#arr-amber)" />
              )}
              {isMemActive && (
                <path d="M 594 160 L 645 160 M 594 200 L 645 200 M 720 175 L 755 175" stroke="#10B981" className="anim-flow-main" markerEnd="url(#arr-blue)" />
              )}
            </g>

            {/* ============================================================ */}
            {/* 5. WB 피드백 루프                                            */}
            {/* ============================================================ */}
            <g fill="none">
              <path d="M 822 185 L 855 185 L 855 345 L 225 345 L 225 200 L 240 200" stroke={isWbActive ? "#3B82F6" : "#E2E8F0"} strokeWidth={isWbActive ? "3" : "1.5"} className={isWbActive ? "anim-flow-wb" : ""} markerEnd={isWbActive ? "url(#arr-blue)" : "url(#arr-base)"} />
            </g>
            {isWbActive && (
              <text x="540" y="340" fill="#2563EB" stroke="none" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                ✦ Data Written Back to Register File (Active)
              </text>
            )}

            {/* ============================================================ */}
            {/* 6. 포워딩 버스                                               */}
            {/* ============================================================ */}
            {isForward && (
              <>
                <g fill="none" stroke="#06B6D4" strokeWidth="2.5" markerEnd="url(#arr-cyan)">
                  <path d="M 585 140 L 585 95 L 448 95 L 448 120" className="anim-forwarding" />
                  <path d="M 755 155 L 755 85 L 448 85 L 448 120" className="anim-forwarding" />
                </g>
                <g transform="translate(485, 74)">
                  <rect width="90" height="20" rx="5" fill="#ECFEFF" stroke="#06B6D4" strokeWidth="1" />
                  <text x="45" y="14" fill="#0891B2" stroke="none" fontSize="9" fontWeight="bold" textAnchor="middle">
                    ⚡ Forwarding
                  </text>
                </g>
              </>
            )}

            {/* ============================================================ */}
            {/* 7. 하드웨어 블록들 (버전 3에서는 글로우 필터 적용)            */}
            {/* ============================================================ */}
            {/* Next PC MUX */}
            <polygon points="23,135 41,145 41,185 23,195" fill="#F1F5F9" stroke="#64748B" strokeWidth="1.5" />
            <g fill="#475569" stroke="none" fontSize="8" fontWeight="bold" textAnchor="middle">
              <text x="32" y="156">M</text><text x="32" y="167">U</text><text x="32" y="178">X</text>
            </g>

            {/* PC Register */}
            <g transform="translate(45, 135)" className={isStall ? "anim-stall" : ""}>
              <rect width="27" height="60" rx="4" fill={isStall ? "#FFE4E6" : "#F8FAFC"} stroke={isStall ? "#E11D48" : "#475569"} strokeWidth={isStall ? "2.5" : "1.5"} />
              <text x="13.5" y="34" fill="#0F172A" stroke="none" fontSize="10" fontWeight="bold" textAnchor="middle">PC</text>
              {isStall && <text x="13.5" y="47" fill="#E11D48" stroke="none" fontSize="7" fontWeight="bold" textAnchor="middle">FREEZE</text>}
            </g>

            {/* +4 Adder */}
            <g transform="translate(105, 80)">
              <rect width="40" height="30" rx="4" fill="#DBEAFE" stroke="#2563EB" strokeWidth="1.5" />
              <text x="20" y="19" fill="#1D4ED8" stroke="none" fontSize="11" fontWeight="bold" textAnchor="middle">+4</text>
            </g>

            {/* Instruction Memory */}
            <g transform="translate(105, 135)">
              <rect width="70" height="60" rx="6" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="2" className={isIfActive && !isStall ? "shadow-md" : ""} />
              <text x="35" y="28" fill="#1E40AF" stroke="none" fontSize="10" fontWeight="bold" textAnchor="middle">Instruction</text>
              <text x="35" y="42" fill="#1E40AF" stroke="none" fontSize="10" fontWeight="bold" textAnchor="middle">Memory</text>
            </g>

            {/* Control Unit */}
            <g transform="translate(280, 50)">
              <ellipse rx="35" ry="24" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
              <text x="0" y="-3" fill="#3730A3" stroke="none" fontSize="10" fontWeight="bold" textAnchor="middle">Control</text>
              <text x="0" y="11" fill="#3730A3" stroke="none" fontSize="10" fontWeight="bold" textAnchor="middle">Unit</text>
            </g>

            {/* Branch Unit */}
            <g transform="translate(240, 95)">
              <rect width="55" height="35" rx="5" fill="#F0FDF4" stroke="#16A34A" strokeWidth="1.5" />
              <text x="27.5" y="18" fill="#15803D" stroke="none" fontSize="9" fontWeight="bold" textAnchor="middle">Branch</text>
              <text x="27.5" y="28" fill="#15803D" stroke="none" fontSize="9" fontWeight="bold" textAnchor="middle">Unit</text>
            </g>

            {/* Register File */}
            <g transform="translate(240, 145)">
              <rect width="70" height="85" rx="6" fill={isWbActive ? "#EFF6FF" : "#F8FAFC"} stroke={isWbActive ? "#2563EB" : "#475569"} strokeWidth="1.5" />
              <text x="35" y="24" fill="#0F172A" stroke="none" fontSize="11" fontWeight="bold" textAnchor="middle">Register</text>
              <text x="35" y="38" fill="#0F172A" stroke="none" fontSize="11" fontWeight="bold" textAnchor="middle">File</text>
              <text x="35" y="58" fill="#64748B" stroke="none" fontSize="8" textAnchor="middle">x0 ~ x31</text>
            </g>

            {/* Immediate Generation */}
            <g transform="translate(240, 265)">
              <rect width="70" height="40" rx="5" fill="#FAF5FF" stroke="#9333EA" strokeWidth="1.5" />
              <text x="35" y="18" fill="#6B21A8" stroke="none" fontSize="9" fontWeight="bold" textAnchor="middle">Immediate</text>
              <text x="35" y="30" fill="#6B21A8" stroke="none" fontSize="9" fontWeight="bold" textAnchor="middle">Generator</text>
            </g>

            {/* Hazard Detection */}
            <g transform="translate(325, 295)" className={isStall ? "anim-stall" : ""}>
              <rect width="50" height="30" rx="12" fill={isStall ? "#FFE4E6" : "#F0FDFA"} stroke={isStall ? "#F43F5E" : "#0D9488"} strokeWidth="2" />
              <text x="25" y="13" fill={isStall ? "#E11D48" : "#0F766E"} stroke="none" fontSize="7" fontWeight="bold" textAnchor="middle">Hazard</text>
              <text x="25" y="22" fill={isStall ? "#E11D48" : "#0F766E"} stroke="none" fontSize="7" fontWeight="bold" textAnchor="middle">Detection</text>
            </g>

            {/* Forwarding MUX A & B */}
            <polygon points="440,115 455,122 455,142 440,150" fill={isForward ? "#CFFAFE" : "#F1F5F9"} stroke={isForward ? "#06B6D4" : "#64748B"} strokeWidth="1.5" />
            <polygon points="440,175 455,182 455,202 440,210" fill={isForward ? "#CFFAFE" : "#F1F5F9"} stroke={isForward ? "#06B6D4" : "#64748B"} strokeWidth="1.5" />

            {/* ALU */}
            <g transform="translate(490, 120)">
              <polygon
                points="0,0 60,25 60,55 0,80 0,50 15,40 0,30"
                fill={isExActive ? "url(#aluGrad)" : "#F8FAFC"}
                stroke={isExActive ? "#D97706" : "#64748B"}
                strokeWidth={isExActive ? "2.5" : "1.5"}
              />
              <text x="35" y="44" fill={isExActive ? "#92400E" : "#334155"} stroke="none" fontSize="13" fontWeight="extrabold" textAnchor="middle">ALU</text>
            </g>

            {/* ALU Control */}
            <g transform="translate(520, 265)">
              <ellipse rx="30" ry="20" fill="#FFFBEB" stroke="#D97706" strokeWidth="1.5" />
              <text x="0" y="-1" fill="#92400E" stroke="none" fontSize="9" fontWeight="bold" textAnchor="middle">ALU</text>
              <text x="0" y="11" fill="#92400E" stroke="none" fontSize="9" fontWeight="bold" textAnchor="middle">Control</text>
            </g>

            {/* Data Memory */}
            <g transform="translate(645, 135)">
              <rect
                width="75"
                height="75"
                rx="6"
                fill={isMemActive ? "url(#memGrad)" : "#EFF6FF"}
                stroke={isMemActive ? "#16A34A" : "#3B82F6"}
                strokeWidth={isMemActive ? "2.5" : "1.5"}
              />
              <text x="37.5" y="32" fill="#1E40AF" stroke="none" fontSize="11" fontWeight="bold" textAnchor="middle">Data</text>
              <text x="37.5" y="47" fill="#1E40AF" stroke="none" fontSize="11" fontWeight="bold" textAnchor="middle">Memory</text>
            </g>

            {/* Write-Back MUX */}
            <polygon points="803,160 821,170 821,210 803,220" fill={isWbActive ? "#DBEAFE" : "#F1F5F9"} stroke={isWbActive ? "#2563EB" : "#64748B"} strokeWidth="1.5" />
            <g fill="#1E3A8A" stroke="none" fontSize="8" fontWeight="bold" textAnchor="middle">
              <text x="812" y="181">M</text><text x="812" y="192">U</text><text x="812" y="203">X</text>
            </g>


            {/* ============================================================ */}
            {/* 8. 하단 단계 레이블 + 바로 아래 명령어 카드 (일체형 통합 배치) */}
            {/* ============================================================ */}
            {/* 1) FETCH 단계 (IF - 빨강) */}
            <g transform="translate(30, 365)">
              <text x="60" y="14" fill="#DC2626" stroke="none" fontSize="11" fontWeight="extrabold" textAnchor="middle">
                Instruction Fetch (IF)
              </text>
              <rect x="5" y="22" width="110" height="26" rx="6" fill={ifInst === 'bubble' ? '#F8FAFC' : '#FEF2F2'} stroke={ifInst === 'bubble' ? '#CBD5E1' : '#F87171'} strokeWidth="1.2" />
              <text x="60" y="39" fill={ifInst === 'bubble' ? '#94A3B8' : '#B91C1C'} stroke="none" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                {ifInst}
              </text>
            </g>

            {/* 2) DECODE 단계 (ID - 주황) */}
            <g transform="translate(225, 365)">
              <text x="60" y="14" fill="#EA580C" stroke="none" fontSize="11" fontWeight="extrabold" textAnchor="middle">
                Instruction Decode (ID)
              </text>
              <rect x="5" y="22" width="110" height="26" rx="6" fill={idInst === 'bubble' ? '#F8FAFC' : '#FFF7ED'} stroke={idInst === 'bubble' ? '#CBD5E1' : '#FB923C'} strokeWidth="1.2" />
              <text x="60" y="39" fill={idInst === 'bubble' ? '#94A3B8' : '#C2410C'} stroke="none" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                {idInst}
              </text>
            </g>

            {/* 3) EXECUTE 단계 (EX - 노랑) */}
            <g transform="translate(425, 365)">
              <text x="60" y="14" fill="#CA8A04" stroke="none" fontSize="11" fontWeight="extrabold" textAnchor="middle">
                Execute / ALU (EX)
              </text>
              <rect x="5" y="22" width="110" height="26" rx="6" fill={exInst === 'bubble' ? '#F8FAFC' : '#FEFCE8'} stroke={exInst === 'bubble' ? '#CBD5E1' : '#FACC15'} strokeWidth="1.2" />
              <text x="60" y="39" fill={exInst === 'bubble' ? '#94A3B8' : '#854D0E'} stroke="none" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                {exInst}
              </text>
            </g>

            {/* 4) MEMORY 단계 (MA - 초록) */}
            <g transform="translate(610, 365)">
              <text x="60" y="14" fill="#16A34A" stroke="none" fontSize="11" fontWeight="extrabold" textAnchor="middle">
                Memory Access (MA)
              </text>
              <rect x="5" y="22" width="110" height="26" rx="6" fill={memInst === 'bubble' ? '#F8FAFC' : '#F0FDF4'} stroke={memInst === 'bubble' ? '#CBD5E1' : '#4ADE80'} strokeWidth="1.2" />
              <text x="60" y="39" fill={memInst === 'bubble' ? '#94A3B8' : '#15803D'} stroke="none" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                {memInst}
              </text>
            </g>

            {/* 5) WRITE-BACK 단계 (WB - 파랑) */}
            <g transform="translate(780, 365)">
              <text x="60" y="14" fill="#2563EB" stroke="none" fontSize="11" fontWeight="extrabold" textAnchor="middle">
                Write-Back (WB)
              </text>
              <rect x="5" y="22" width="110" height="26" rx="6" fill={wbInst === 'bubble' ? '#F8FAFC' : '#EFF6FF'} stroke={wbInst === 'bubble' ? '#CBD5E1' : '#60A5FA'} strokeWidth="1.2" />
              <text x="60" y="39" fill={wbInst === 'bubble' ? '#94A3B8' : '#1D4ED8'} stroke="none" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                {wbInst}
              </text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default PipelineVisualizer;
