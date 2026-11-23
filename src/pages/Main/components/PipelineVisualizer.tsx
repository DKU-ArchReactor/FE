import React, { useState, useEffect } from 'react';
import type { CycleHistoryItem, SimulationResult } from '@/type/simulation';
import SingleCycleDatapath from './SingleCycleDatapath';
import type { InstructionLessonContext } from './InstructionLesson';
import { numericPc } from '../utils/instructionFlow';
import {
  computePipelineWireState,
  isBranch,
} from '../utils/pipelineWireState';
import './PipelineVisualizer.css';

// SVG 경로(M, L, H, V)를 안전하게 파싱하여 진행률(0~1)에 따른 좌표를 산출하는 보간 헬퍼
function parseSvgPathPoints(pathStr: string): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const regex = /([MLHV])\s*([^MLHV]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(pathStr)) !== null) {
    const cmd = match[1].toUpperCase();
    const nums = match[2].trim().split(/[\s,]+/).map(Number);
    const prev = points[points.length - 1] || { x: 0, y: 0 };
    if (cmd === "M" || cmd === "L") {
      for (let i = 0; i < nums.length; i += 2) {
        if (!isNaN(nums[i]) && !isNaN(nums[i + 1])) {
          points.push({ x: nums[i], y: nums[i + 1] });
        }
      }
    } else if (cmd === "H") {
      nums.forEach((x) => { if (!isNaN(x)) points.push({ x, y: prev.y }); });
    } else if (cmd === "V") {
      nums.forEach((y) => { if (!isNaN(y)) points.push({ x: prev.x, y }); });
    }
  }
  return points;
}

// IF 주요 선분 경로 사전 파싱 (불필요한 useMemo 제거 및 모듈 레벨 정적 캐싱)
const PC_TO_IMEM_PTS = parseSvgPathPoints("M 380,136 L 380,174");
const PC_TO_PLUS4_PTS = parseSvgPathPoints("M 500,108 L 756,108");
const PC_TO_ADDR_PTS = parseSvgPathPoints("M 701,108 L 701,283");
const IMEM_TO_IFID_PTS = parseSvgPathPoints("M 380,248 L 380,283");
const PLUS4_LOOPBACK_PTS = parseSvgPathPoints("M 801,128 L 801,168 L 870,168 L 870,-22 L 410,-22 L 410,12");
const MUX_TO_PC_PTS = parseSvgPathPoints("M 380,52 L 380,78");

function getPathTotalLength(points: { x: number; y: number }[]): number {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

// 각 선분의 불변 물리적 길이 사전 계산
const PC_TO_IMEM_LEN = getPathTotalLength(PC_TO_IMEM_PTS); // 38px
const PC_TO_PLUS4_LEN = getPathTotalLength(PC_TO_PLUS4_PTS); // 256px
const PC_TO_ADDR_LEN = getPathTotalLength(PC_TO_ADDR_PTS); // 175px
const IMEM_TO_IFID_LEN = getPathTotalLength(IMEM_TO_IFID_PTS); // 35px
const PLUS4_LOOPBACK_LEN = getPathTotalLength(PLUS4_LOOPBACK_PTS); // 793px
const MUX_TO_PC_LEN = getPathTotalLength(MUX_TO_PC_PTS); // 26px

function interpolatePathPoints(points: { x: number; y: number }[], progress: number): { x: number; y: number } | null {
  if (!points || points.length === 0) return null;
  if (points.length === 1) return points[0];
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    lengths.push(dist);
    total += dist;
  }
  if (total === 0) return points[0];
  const target = Math.max(0, Math.min(1, progress)) * total;
  let acc = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= acc + lengths[i] || i === lengths.length - 1) {
      const segLen = lengths[i];
      const ratio = segLen > 0 ? (target - acc) / segLen : 0;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
        y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
      };
    }
    acc += lengths[i];
  }
  return points[points.length - 1];
}

// 1사이클 진행률(0~1) 내에서 스텝 하위 시간 구간([start, end]) 동안
// 동시 출발하여 스텝 종료 시점에 동시 도착하는 완전 동기화 진행률 헬퍼 (대기 0%)
function getSynchronizedSubstepProgress(
  globalProgress: number,
  start: number,
  end: number,
  persistAfterArrival: boolean = false
): { progress: number; opacity: number } | null {
  if (globalProgress < start) {
    return null; // 아직 시작 전: 미표시
  }

  const stepDuration = end - start;
  if (stepDuration <= 0) return null;

  // 1) 아직 스텝 종료 전 (이동 중: 선 길이에 비례한 속도로 주행하여 정확히 end 시점에 동시 도착)
  if (globalProgress <= end) {
    const ratio = Math.max(0, Math.min(1, (globalProgress - start) / stepDuration));
    const fadeInWindow = 0.05;
    const opacity = ratio < fadeInWindow ? ratio / fadeInWindow : 1.0;
    return { progress: ratio, opacity };
  }

  // 2) 스텝 종료 이후
  if (persistAfterArrival) {
    return { progress: 1.0, opacity: 1.0 };
  }
  // 스텝 종료 직후 0.03 구간 동안 빠르게 페이드아웃 후 다음 단계로 매끄럽게 전달
  const fadeDuration = 0.03;
  if (globalProgress <= end + fadeDuration) {
    const fadeRatio = (globalProgress - end) / fadeDuration;
    return { progress: 1.0, opacity: 1 - fadeRatio };
  }
  return null; // 완전 소멸
}

interface PipelineVisualizerProps {
  lessonContext?: InstructionLessonContext;
  currentData: CycleHistoryItem | null;
  prevData?: CycleHistoryItem | null;
  simulationData?: SimulationResult | null;
  loadingMessage?: string | null;
  mode?: "single" | "pipeline";
}

const MASTER_WIDTH = 1220;
const MASTER_HEIGHT = 1390;

const PipelineVisualizer: React.FC<PipelineVisualizerProps> = ({
  currentData,
  prevData,
  simulationData,
  loadingMessage,
  mode = "pipeline",
  lessonContext,
}) => {
  // [모든 훅은 React Rules of Hooks에 따라 조건문이나 조기 반환보다 먼저 최상단에서 무조건 실행]
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [animProgress, setAnimProgress] = useState<number>(0.5);
  const [isSubstepLooping, setIsSubstepLooping] = useState<boolean>(true);
  const flowDuration = lessonContext?.flowDurationMs ?? 3000;
  const animSec = `${(flowDuration / 1000).toFixed(2)}s`;

  useEffect(() => {
    if (!isSubstepLooping) {
      return;
    }

    let frameId: number;
    const start = performance.now();

    const loop = (now: number) => {
      const elapsed = (now - start) % flowDuration;
      setAnimProgress(elapsed / flowDuration);
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isSubstepLooping, flowDuration, currentData]);

  const isSingle = mode === "single";

  // Single-Cycle 모드에서는 온칩(ALU + 레지스터) ↔ 시스템 버스 ↔ DRAM 데이터패스 다이어그램 렌더링
  if (isSingle) {
    return (
      <SingleCycleDatapath
        lessonContext={lessonContext}
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

  const {
    buffers,
    cycle_events,
    clock,
    isStall,
    isForward,
    isBranchFlush,
    ifInst,
    idInst,
    exInst,
    memInst,
    wbInst,
    isIfActive,
    isIdActive,
    isExActive,
    isMemActive,
    isWbActive,
    exOp,
    isInitialEmpty,
    inactiveStroke,
    inactiveMarker,
    ifPcMuxToPcActive,
    ifPcToImemActive,
    ifPcToPlus4Active,
    ifPcToIfIdActive,
    ifPlus4LoopbackActive,
    branchLoopbackActive,
    ifImemToIfIdActive,
    idTrunkActive,
    idControlUnitActive,
    idToRegsActive,
    idToImmGenActive,
    idRd1ToIdExActive,
    idRd2ToIdExActive,
    idImmToIdExActive,
    idPcToIdExActive,
    exRd1ToAluActive,
    exRd2TrunkActive,
    exRd2ToAluSrcActive,
    exRd2ToWriteDataActive,
    exImmTrunkActive,
    exImmToAluSrcActive,
    exAluSrcToAluActive,
    exBranchAddActive,
    exImmToBranchAddActive,
    exPcToBranchAddActive,
    exAluToExMemActive,
    memAluTrunkActive,
    memAluToDmemAddrActive,
    memAluBypassActive,
    memWriteDataActive,
    memDmemReadDataActive,
    wbAluBypassActive,
    wbDmemReadDataActive,
    wbReverseFeedbackActive,
  } = computePipelineWireState(currentData, isSingle);

  const wireStyle = (active: boolean): React.CSSProperties => ({
    opacity: (isInitialEmpty || active) ? 1 : 0,
    transition: "opacity 0.25s ease-in-out",
    pointerEvents: (isInitialEmpty || active) ? "auto" : "none",
  });

  // 10진수 PC 주소값 계산
  const ifPcStr = buffers?.IF?.pc || currentData?.global_result?.current_pc;
  const ifPcNum = numericPc(ifPcStr);
  const ifPcDec = Number.isFinite(ifPcNum) ? String(ifPcNum) : (ifPcStr || "0");
  const ifPcPlus4Dec = Number.isFinite(ifPcNum) ? String(ifPcNum + 4) : "";

  // [명령어별 활성 와이어 최장 길이 기반 동적 스텝 타임라인 계산]
  // 1) Step 1 최장 선분 (PC -> +4: 256px, PC -> Addr: 175px, PC -> IM: 38px)
  const step1MaxLen = Math.max(
    ifPcToImemActive ? PC_TO_IMEM_LEN : 0,
    ifPcToPlus4Active ? PC_TO_PLUS4_LEN : 0,
    ifPcToIfIdActive ? PC_TO_ADDR_LEN : 0
  ) || PC_TO_PLUS4_LEN;

  // 2) Step 2 최장 선분 (+4 Adder 루프백: 793px, 분기 루프백: 905px, IM -> IF/ID: 35px)
  const step2MaxLen = Math.max(
    ifImemToIfIdActive ? IMEM_TO_IFID_LEN : 0,
    ifPlus4LoopbackActive ? PLUS4_LOOPBACK_LEN : 0,
    branchLoopbackActive ? 905 : 0
  ) || PLUS4_LOOPBACK_LEN;

  // 3) Step 3 최장 선분 (MUX -> PC: 26px)
  // Step 3는 MUX 판단 및 PC 래치 동작의 최소 가시성(8%)을 보장하고, 남은 92%를 Step 1, 2 최장 길이에 비례 배분
  const step3MaxLen = ifPcMuxToPcActive ? MUX_TO_PC_LEN : 26;
  const MIN_STEP3_RATIO = Math.max(0.08, step3MaxLen / (step1MaxLen + step2MaxLen + step3MaxLen));
  const step12Sum = step1MaxLen + step2MaxLen;
  const step1Ratio = step12Sum > 0 ? (1 - MIN_STEP3_RATIO) * (step1MaxLen / step12Sum) : 0.22;
  const step2Ratio = step12Sum > 0 ? (1 - MIN_STEP3_RATIO) * (step2MaxLen / step12Sum) : 0.70;

  const step1End = step1Ratio;
  const step2End = step1Ratio + step2Ratio;

  // [1사이클 내부 단계별 동기화 진행률: 모든 선이 동시 출발 -> 동시 도착 (대기 0%)]
  // Step 1 (0.0 ~ step1End): PC에서 주소 출력 (IM, +4 가산기, Addr 버퍼로 동시 전파 -> step1End에 동시 골인)
  const pcToImemState = getSynchronizedSubstepProgress(animProgress, 0.0, step1End);
  const pcToPlus4State = getSynchronizedSubstepProgress(animProgress, 0.0, step1End);
  const pcToAddrState = getSynchronizedSubstepProgress(animProgress, 0.0, step1End);

  // Step 2 (step1End ~ step2End): 소자 연산 결과 전달 (IM -> IF/ID 버퍼, +4 Adder 루프백 -> step2End에 동시 골인)
  const imemToIfIdState = getSynchronizedSubstepProgress(animProgress, step1End, step2End);
  const plus4LoopbackState = getSynchronizedSubstepProgress(animProgress, step1End, step2End);

  // Step 3 (step2End ~ 1.00): 다음 PC 주소 결정 (PC MUX -> PC 레지스터 입력)
  const muxToPcState = getSynchronizedSubstepProgress(animProgress, step2End, 1.00, true);

  const pcToImemPoint = pcToImemState ? interpolatePathPoints(PC_TO_IMEM_PTS, pcToImemState.progress) : null;
  const pcToPlus4Point = pcToPlus4State ? interpolatePathPoints(PC_TO_PLUS4_PTS, pcToPlus4State.progress) : null;
  const pcToAddrPoint = pcToAddrState ? interpolatePathPoints(PC_TO_ADDR_PTS, pcToAddrState.progress) : null;
  const imemToIfIdPoint = imemToIfIdState ? interpolatePathPoints(IMEM_TO_IFID_PTS, imemToIfIdState.progress) : null;
  const plus4LoopbackPoint = plus4LoopbackState ? interpolatePathPoints(PLUS4_LOOPBACK_PTS, plus4LoopbackState.progress) : null;
  const muxToPcPoint = muxToPcState ? interpolatePathPoints(MUX_TO_PC_PTS, muxToPcState.progress) : null;

  // 순차 전파 애니메이션 헬퍼 (실선: wire-solid-step, 점선: wire-dashed-step)
  const wireStepClass = (active: boolean, step: 0 | 1 | 2 | 3, isDashed = false) =>
    (active ? (isDashed ? `wire-dashed-step-${step}` : `wire-solid-step-${step}`) : undefined);
  const dotStepClass = (active: boolean, step: 0 | 1 | 2 | 3) => (active ? `dot-step-${step}` : undefined);
  const boxStepClass = (active: boolean, step: 0 | 1 | 2 | 3) => (active ? `box-step-${step}` : undefined);

  // 줌 조절
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(2.5, +(prev + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.5, +(prev - 0.15).toFixed(2)));
  const handleZoomReset = () => setZoomLevel(1.0);

  return (
    <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-sm border border-[var(--ar-border)] flex flex-col justify-between overflow-hidden relative select-none min-h-0 transition-colors duration-150">
      {/* 동적 CSS 애니메이션 및 정밀 스트리밍 스타일: 2.0초 주기로 Step 0 -> 1 -> 2 -> 3 순차 전파 */}
      <style>{`
        /* 1) 실선 펄스 애니메이션 (dash 없음, 굵기와 투명도만 펄스 전파 - 동적 타임라인 동기화) */
        @keyframes solidPulseStep0 {
          0%       { opacity: 0.35; stroke-width: 2.8; }
          6%, 16%  { opacity: 1.0;  stroke-width: 4.0; }
          22%      { opacity: 0.85; stroke-width: 2.8; }
          100%     { opacity: 0.35; stroke-width: 2.8; }
        }
        @keyframes solidPulseStep1 {
          0%       { opacity: 0.25; stroke-width: 2.8; }
          6%, 16%  { opacity: 1.0;  stroke-width: 4.0; }
          22%      { opacity: 0.85; stroke-width: 2.8; }
          100%     { opacity: 0.25; stroke-width: 2.8; }
        }
        @keyframes solidPulseStep2 {
          0%, 20%  { opacity: 0.25; stroke-width: 2.8; }
          35%, 82% { opacity: 1.0;  stroke-width: 4.0; }
          90%      { opacity: 0.85; stroke-width: 2.8; }
          100%     { opacity: 0.25; stroke-width: 2.8; }
        }
        @keyframes solidPulseStep3 {
          0%, 88%  { opacity: 0.25; stroke-width: 2.8; }
          93%, 99% { opacity: 1.0;  stroke-width: 4.0; }
          100%     { opacity: 0.35; stroke-width: 2.8; }
        }

        .wire-solid-step-0 {
          animation: solidPulseStep0 ${animSec} linear infinite;
        }
        .wire-solid-step-1 {
          animation: solidPulseStep1 ${animSec} linear infinite;
        }
        .wire-solid-step-2 {
          animation: solidPulseStep2 ${animSec} linear infinite;
        }
        .wire-solid-step-3 {
          animation: solidPulseStep3 ${animSec} linear infinite;
        }

        /* 2) 점선 제어선 애니메이션 (strokeDasharray 6 3 유지, dashoffset 행진 및 펄스) */
        @keyframes dashedPulseStep0 {
          0%       { stroke-dashoffset: 36; opacity: 0.35; stroke-width: 2.8; }
          6%, 16%  { stroke-dashoffset: 18; opacity: 1.0;  stroke-width: 3.6; }
          22%      { stroke-dashoffset: 0;  opacity: 0.85; stroke-width: 2.8; }
          100%     { stroke-dashoffset: -54; opacity: 0.35; stroke-width: 2.8; }
        }
        @keyframes dashedPulseStep1 {
          0%       { stroke-dashoffset: 36; opacity: 0.25; stroke-width: 2.8; }
          6%, 16%  { stroke-dashoffset: 18; opacity: 1.0;  stroke-width: 3.6; }
          22%      { stroke-dashoffset: 0;  opacity: 0.85; stroke-width: 2.8; }
          100%     { stroke-dashoffset: -54; opacity: 0.25; stroke-width: 2.8; }
        }
        @keyframes dashedPulseStep2 {
          0%, 20%  { stroke-dashoffset: 36; opacity: 0.25; stroke-width: 2.8; }
          35%, 82% { stroke-dashoffset: 18; opacity: 1.0;  stroke-width: 3.6; }
          90%      { stroke-dashoffset: 0;  opacity: 0.85; stroke-width: 2.8; }
          100%     { stroke-dashoffset: -36; opacity: 0.25; stroke-width: 2.8; }
        }
        @keyframes dashedPulseStep3 {
          0%, 88%  { stroke-dashoffset: 36; opacity: 0.25; stroke-width: 2.8; }
          93%, 99% { stroke-dashoffset: 18; opacity: 1.0;  stroke-width: 3.6; }
          100%     { stroke-dashoffset: -18; opacity: 0.35; stroke-width: 2.8; }
        }

        .wire-dashed-step-0 {
          stroke-dasharray: 6 3;
          animation: dashedPulseStep0 ${animSec} linear infinite;
        }
        .wire-dashed-step-1 {
          stroke-dasharray: 6 3;
          animation: dashedPulseStep1 ${animSec} linear infinite;
        }
        .wire-dashed-step-2 {
          stroke-dasharray: 6 3;
          animation: dashedPulseStep2 ${animSec} linear infinite;
        }
        .wire-dashed-step-3 {
          stroke-dasharray: 6 3;
          animation: dashedPulseStep3 ${animSec} linear infinite;
        }

        @keyframes dotPulse0 {
          0%, 100% { r: 3.5; opacity: 0.5; }
          15%      { r: 5.5; opacity: 1.0; }
          35%      { r: 3.5; opacity: 0.85; }
        }
        @keyframes dotPulse1 {
          0%, 15%, 100% { r: 3.5; opacity: 0.5; }
          35%           { r: 5.5; opacity: 1.0; }
          55%           { r: 3.5; opacity: 0.85; }
        }
        @keyframes dotPulse2 {
          0%, 38%, 100% { r: 3.5; opacity: 0.5; }
          58%           { r: 5.5; opacity: 1.0; }
          78%           { r: 3.5; opacity: 0.85; }
        }
        @keyframes dotPulse3 {
          0%, 62%, 100% { r: 3.5; opacity: 0.5; }
          82%           { r: 5.5; opacity: 1.0; }
          98%           { r: 3.5; opacity: 0.85; }
        }
        .dot-step-0 { animation: dotPulse0 ${animSec} ease-in-out infinite; }
        .dot-step-1 { animation: dotPulse1 ${animSec} ease-in-out infinite; }
        .dot-step-2 { animation: dotPulse2 ${animSec} ease-in-out infinite; }
        .dot-step-3 { animation: dotPulse3 ${animSec} ease-in-out infinite; }

        @keyframes boxPulse0 {
          0%, 100% { stroke-width: 2px; }
          15%      { stroke-width: 3.2px; }
          35%      { stroke-width: 2px; }
        }
        @keyframes boxPulse1 {
          0%, 15%, 100% { stroke-width: 2px; }
          35%           { stroke-width: 3.2px; }
          55%           { stroke-width: 2px; }
        }
        @keyframes boxPulse2 {
          0%, 38%, 100% { stroke-width: 2px; }
          58%           { stroke-width: 3.2px; }
          78%           { stroke-width: 2px; }
        }
        @keyframes boxPulse3 {
          0%, 62%, 100% { stroke-width: 2px; }
          82%           { stroke-width: 3.2px; }
          98%           { stroke-width: 2px; }
        }
        .box-step-0 { animation: boxPulse0 ${animSec} ease-in-out infinite; }
        .box-step-1 { animation: boxPulse1 ${animSec} ease-in-out infinite; }
        .box-step-2 { animation: boxPulse2 ${animSec} ease-in-out infinite; }
        .box-step-3 { animation: boxPulse3 ${animSec} ease-in-out infinite; }
      `}</style>

      {/* 1. 상단 헤더 & 컨트롤러 */}
      <div className={`h-8 shrink-0 flex items-center justify-between px-3.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 border-l-2 ${isSingle ? "border-l-amber-500" : "border-l-blue-500"}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[11px] font-bold ${isSingle ? "text-amber-500" : "text-blue-500"}`}>◆</span>
          <h3 className="font-sans text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wide whitespace-nowrap">
            {isSingle ? "SINGLE-CYCLE DATAPATH" : "PIPELINE DATAPATH"}
          </h3>
          <span className="text-[10px] text-[var(--ar-text-muted)] font-mono w-16 shrink-0 tabular-nums">
            ({isSingle ? `STEP:${clock ?? "—"}` : `CYCLE:${clock ?? "—"}`})
          </span>
        </div>

        {/* 이벤트 뱃지 & 줌 컨트롤 */}
        <div className="flex items-center gap-1.5">
          {/* CRT 런타임 진입/초기화 식별 뱃지 */}
          {((ifInst && (ifInst.startsWith("auipc") || ifInst.startsWith("jal") || ifInst.startsWith("li") || ifInst.startsWith("csrw"))) ||
            (clock !== undefined && clock < 10 && !cycle_events?.stall?.has_stall && !cycle_events?.forwarding?.has_forwarded)) && (
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
          className="m-auto shrink-0 transition-all duration-150"
          style={{
            height: `${zoomLevel * 100}%`,
            maxHeight: "100%",
            maxWidth: "100%",
            aspectRatio: `${MASTER_WIDTH} / ${MASTER_HEIGHT}`,
          }}
        >
          <svg
            viewBox="-75 -65 1220 1390"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full select-none block"
          >
            <defs>
              {/* 정밀 화살표 마커 (끝점 refX=8.5로 선 끝이 박스 경계에 정확히 닿도록 설정) */}
              <marker id="m-arr-def" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#94A3B8" />
              </marker>
              <marker id="m-arr-red" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#EF4444" />
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
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#0284C7" />
              </marker>
              <marker id="m-arr-purple" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#8B5CF6" />
              </marker>
              <marker id="m-arr-cyan" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 1.2 L 9 5 L 0 8.8 z" fill="#0891B2" />
              </marker>
              {/* 5대 스테이지 무지개 대각선 그라데이션 (파스텔 톤: IF 빨 -> ID 주 -> EX 초 -> MEM 파 -> WB 보) */}
              <linearGradient id="stage-rainbow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F87171" />
                <stop offset="25%" stopColor="#FB923C" />
                <stop offset="50%" stopColor="#34D399" />
                <stop offset="75%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#A78BFA" />
              </linearGradient>
              {/* 알약 슬라이더 노브 그림자 */}
              <filter id="pill-knob-shadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#0F172A" floodOpacity="0.2" />
              </filter>
              {/* 펄스 글로우 및 쉐도우 필터 */}
              <filter id="token-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#EF4444" floodOpacity="0.45" />
              </filter>
            </defs>

            {/* ============================================================ */}
            {/* [1열: 좌측 열] 스테이지 + 명령어 2층 일체형 통합 카드 5개   */}
            {/* (규격 20% 축소 조정: x=-40, w=276, h=92, rx=11 / 1층: 헤더 40px, 2층: 명령어 52px) */}
            {/* ============================================================ */}

            {/* [이미지 최상단] 1개 사이클 내부 스테이지 시뮬레이션 제어 알약 토글 버튼 (Play ▶ / Pause ❚❚) */}
            <g
              className="select-none cursor-pointer transition-opacity hover:opacity-95"
              onClick={() => setIsSubstepLooping((prev) => !prev)}
            >
              {/* 1. 알약 외곽 트랙 (x=43, y=-48, w=110, h=36, rx=18) */}
              <rect
                x="43"
                y="-48"
                width="110"
                height="36"
                rx="18"
                fill="#F1F5F9"
                stroke="#CBD5E1"
                strokeWidth="1.5"
                className="transition-colors duration-150"
              />

              {/* 2. 좌우 슬라이딩 알약 노브 (x=46, y=-45, w=50, h=30, rx=15 / 좌우 이동거리: 54px) */}
              <g
                style={{
                  transform: isSubstepLooping ? "translateX(0px)" : "translateX(54px)",
                  transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                filter="url(#pill-knob-shadow)"
              >
                {/* 재생 모드 시: 빨주초파보 대각선 그라데이션 노브 */}
                <rect
                  x="46"
                  y="-45"
                  width="50"
                  height="30"
                  rx="15"
                  fill="url(#stage-rainbow-grad)"
                  style={{
                    opacity: isSubstepLooping ? 1 : 0,
                    transition: "opacity 0.22s ease",
                  }}
                />
                {/* 일시정지 모드 시: 소프트 슬레이트 노브 */}
                <rect
                  x="46"
                  y="-45"
                  width="50"
                  height="30"
                  rx="15"
                  fill="#64748B"
                  style={{
                    opacity: !isSubstepLooping ? 1 : 0,
                    transition: "opacity 0.22s ease",
                  }}
                />
              </g>

              {/* 3. 좌측: 재생 (▶) 아이콘 (재생 활성 시 노브 위 흰색, 비활성 시 트랙 위 그라데이션) */}
              <polygon
                points="66,-36 66,-24 77,-30"
                fill={isSubstepLooping ? "#FFFFFF" : "url(#stage-rainbow-grad)"}
                style={{ transition: "fill 0.2s ease" }}
                className="pointer-events-none"
              />

              {/* 4. 우측: 일시정지 (❚❚) 아이콘 (일시정지 활성 시 노브 위 흰색, 비활성 시 트랙 위 연회색) */}
              <g
                style={{ transition: "fill 0.2s ease" }}
                className="pointer-events-none"
              >
                <rect
                  x="120.5"
                  y="-36.5"
                  width="3.5"
                  height="13"
                  rx="1.5"
                  fill={!isSubstepLooping ? "#FFFFFF" : "#94A3B8"}
                />
                <rect
                  x="127.5"
                  y="-36.5"
                  width="3.5"
                  height="13"
                  rx="1.5"
                  fill={!isSubstepLooping ? "#FFFFFF" : "#94A3B8"}
                />
              </g>

              <title>
                {isSubstepLooping
                  ? "클릭하여 사이클 내부 시뮬레이션 일시정지"
                  : "클릭하여 사이클 내부 시뮬레이션 반복 재생"}
              </title>
            </g>

            {/* 1. IF: Instruction Fetch (Row center: y=142.5 -> card y=96) */}
            <g>
              <rect
                x="-40"
                y="96"
                width="276"
                height="92"
                rx="11"
                fill={isIfActive ? "#FEF2F2" : "#F8FAFC"}
                stroke={isIfActive ? "#EF4444" : "#94A3B8"}
                strokeWidth="2.8"
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
                stroke={isIfActive ? "#EF4444" : "#94A3B8"}
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
                stroke={isIdActive ? "#EA580C" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <path
                d="M -40,391 a 11,11 0 0 1 11,-11 h 254 a 11,11 0 0 1 11,11 v 29 h -276 z"
                fill={isIdActive ? "#EA580C" : "#94A3B8"}
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
                stroke={isIdActive ? "#EA580C" : "#94A3B8"}
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
                stroke={isExActive ? "#16A34A" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <path
                d="M -40,703 a 11,11 0 0 1 11,-11 h 254 a 11,11 0 0 1 11,11 v 29 h -276 z"
                fill={isExActive ? "#16A34A" : "#94A3B8"}
              />
              <text
                x="98"
                y="712"
                dominantBaseline="central"
                fill="#FFFFFF"
                fontSize="16"
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
                stroke={isExActive ? "#16A34A" : "#94A3B8"}
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
                stroke={isMemActive ? "#0284C7" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <path
                d="M -40,1011 a 11,11 0 0 1 11,-11 h 254 a 11,11 0 0 1 11,11 v 29 h -276 z"
                fill={isMemActive ? "#0284C7" : "#94A3B8"}
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
                stroke={isMemActive ? "#0284C7" : "#94A3B8"}
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
                stroke={isWbActive ? "#8B5CF6" : "#94A3B8"}
                strokeWidth="2.8"
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
                stroke={isWbActive ? "#8B5CF6" : "#94A3B8"}
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
            <g key={clock ?? 0} transform="translate(210, 0)">
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
                className={boxStepClass(ifPcMuxToPcActive, 0)}
                fill={ifPcMuxToPcActive ? "#FEF2F2" : "#F8FAFC"}
                stroke={ifPcMuxToPcActive ? "#EF4444" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="380"
                y="33"
                dominantBaseline="central"
                fill={ifPcMuxToPcActive ? "#991B1B" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                MUX
              </text>

              {/* PC MUX ➔ PC 직하강 화살표 (MUX 하단 y=52 ➔ PC 상단 y=78: 최종 Step 3에서 래치 전파) */}
              <line
                x1="380"
                y1="52"
                x2="380"
                y2="78"
                stroke={ifPcMuxToPcActive ? "#EF4444" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(ifPcMuxToPcActive, 3)}
                markerEnd={ifPcMuxToPcActive ? "url(#m-arr-red)" : inactiveMarker}
                style={wireStyle(ifPcMuxToPcActive)}
              />

              {/* 부품 1: PC (세로 확장 height=56, y=80..136, center=380: Step 1 주소 출력) */}
              <rect
                x="260"
                y="80"
                width="240"
                height="56"
                rx="8"
                className={boxStepClass(isIfActive, 1)}
                fill={isIfActive ? "#FEF2F2" : "#F8FAFC"}
                stroke={isIfActive ? "#EF4444" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="380"
                y="108"
                dominantBaseline="central"
                textAnchor="middle"
                className="select-none"
                fill={isIfActive ? "#991B1B" : "#94A3B8"}
                fontSize="18"
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
                stroke={ifPcToImemActive ? "#EF4444" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(ifPcToImemActive, 1)}
                markerEnd={ifPcToImemActive ? "url(#m-arr-red)" : inactiveMarker}
                style={wireStyle(ifPcToImemActive)}
              />

              {/* PC ➔ PC + 4 Adder 연결 화살표 (x=500 -> 756, y=108) */}
              <path
                d="M 500,108 L 756,108"
                fill="none"
                stroke={ifPcToPlus4Active ? "#EF4444" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(ifPcToPlus4Active, 1)}
                markerEnd={ifPcToPlus4Active ? "url(#m-arr-red)" : inactiveMarker}
                style={wireStyle(ifPcToPlus4Active)}
              />
              {/* PC 분기 노드 및 IF/ID BUFFER 직하강 라인 (x=701 Addr 버퍼 센터로 직하강, RISC-V 순수 PC 전달) */}
              <circle
                cx="701"
                cy="108"
                r="3.5"
                className={dotStepClass(ifPcToIfIdActive, 1)}
                fill={ifPcToIfIdActive ? "#EF4444" : inactiveStroke}
                style={wireStyle(ifPcToIfIdActive)}
              />
              <line
                x1="701"
                y1="108"
                x2="701"
                y2="283"
                stroke={ifPcToIfIdActive ? "#EF4444" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(ifPcToIfIdActive, 1)}
                markerEnd={ifPcToIfIdActive ? "url(#m-arr-red)" : inactiveMarker}
                style={wireStyle(ifPcToIfIdActive)}
              />

              {/* PC + 4 가산기 (Control Unit과 동일한 center cx=801로 이동) */}
              <polygon
                points="756,88 846,88 826,128 776,128"
                className={boxStepClass(ifPlus4LoopbackActive, 1)}
                fill={ifPlus4LoopbackActive ? "#FEF2F2" : "#F8FAFC"}
                stroke={ifPlus4LoopbackActive ? "#EF4444" : "#94A3B8"}
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              <text
                x="801"
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

              {/* PC + 4 루프백 ➔ PC MUX 입력 0 (포트 0: 상단 x=410 직하강 인입, 우측 회랑 x=870) */}
              <path
                d="M 801,128 L 801,168 L 870,168 L 870,-22 L 410,-22 L 410,12"
                fill="none"
                stroke={ifPlus4LoopbackActive ? "#EF4444" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(ifPlus4LoopbackActive, 2)}
                markerEnd={ifPlus4LoopbackActive ? "url(#m-arr-red)" : inactiveMarker}
                style={wireStyle(ifPlus4LoopbackActive)}
              />

              {/* Branch Target Address ➔ PC MUX 입력 1 (포트 1: EX Branch Add ➔ 우측 외곽 회랑 x=905 ➔ 상단 x=350 직하강: Step 2 루프백) */}
              <path
                d="M 615,808 L 615,845 L 905,845 L 905,-50 L 350,-50 L 350,12"
                fill="none"
                stroke={branchLoopbackActive ? "#16A34A" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(branchLoopbackActive, 2)}
                markerEnd={branchLoopbackActive ? "url(#m-arr-green)" : inactiveMarker}
                style={wireStyle(branchLoopbackActive)}
              />

              {/* 부품 2: Instruction Memory (세로 확장 height=72, y=176..248, center=380) */}
              <rect
                x="230"
                y="176"
                width="300"
                height="72"
                rx="8"
                className={boxStepClass(isIfActive, 1)}
                fill={isIfActive ? "#FEF2F2" : "#F8FAFC"}
                stroke={isIfActive ? "#EF4444" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="380"
                y="212"
                dominantBaseline="central"
                fill={isIfActive ? "#991B1B" : "#94A3B8"}
                fontSize="18"
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
                stroke={ifImemToIfIdActive ? "#EF4444" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(ifImemToIfIdActive, 2)}
                markerEnd={ifImemToIfIdActive ? "url(#m-arr-red)" : inactiveMarker}
                style={wireStyle(ifImemToIfIdActive)}
              />

              {/* ============================================================ */}
              {/* 파이프라인 버퍼 1: IF / ID BUFFER (메인 데이터 560px + Addr 버퍼 46px, 간격 8px) */}
              {/* ============================================================ */}
              {/* 메인 데이터 버퍼 (X = 110 ~ 670) */}
              <rect
                x="110"
                y="285"
                width="560"
                height="26"
                rx="6"
                fill={isIfActive ? "#FEF9C3" : "#F1F5F9"}
                stroke={isIfActive ? "#EAB308" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="390"
                y="298"
                dominantBaseline="central"
                fill={isIfActive ? "#A16207" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                IF / ID BUFFER
              </text>

              {/* Addr 버퍼 1 (X = 678 ~ 724, W = 46) */}
              <rect
                x="678"
                y="285"
                width="46"
                height="26"
                rx="6"
                fill={ifPcToIfIdActive ? "#FEF9C3" : "#F1F5F9"}
                stroke={ifPcToIfIdActive ? "#EAB308" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="701"
                y="298"
                dominantBaseline="central"
                fill={ifPcToIfIdActive ? "#A16207" : "#94A3B8"}
                fontSize="16"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Addr
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
                stroke={idTrunkActive ? "#EA580C" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(idTrunkActive, 0)}
                style={wireStyle(idTrunkActive)}
              />
              {/* IF/ID BUFFER ➔ Register File 분기 버스 */}
              <path
                d="M 380,336 L 280,336 L 280,366"
                fill="none"
                stroke={idToRegsActive ? "#EA580C" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(idToRegsActive, 1)}
                markerEnd={idToRegsActive ? "url(#m-arr-orange)" : inactiveMarker}
                style={wireStyle(idToRegsActive)}
              />
              {/* IF/ID BUFFER ➔ Imm Gen 분기 버스 */}
              <path
                d="M 380,336 L 578,336 L 578,366"
                fill="none"
                stroke={idToImmGenActive ? "#EA580C" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(idToImmGenActive, 1)}
                markerEnd={idToImmGenActive ? "url(#m-arr-orange)" : inactiveMarker}
                style={wireStyle(idToImmGenActive)}
              />
              {/* IF/ID BUFFER ➔ Control Unit 분기 버스 */}
              <path
                d="M 380,336 L 801,336 L 801,366"
                fill="none"
                stroke={idControlUnitActive ? "#EA580C" : inactiveStroke}
                strokeWidth="2.8"
                strokeDasharray="6 3"
                className={wireStepClass(idControlUnitActive, 1, true)}
                markerEnd={idControlUnitActive ? "url(#m-arr-orange)" : inactiveMarker}
                style={wireStyle(idControlUnitActive)}
              />

              {/* 부품 3: Registers (x=165, width=230, y=368..480, center=280) */}
              <rect
                x="165"
                y="368"
                width="230"
                height="112"
                rx="8"
                className={boxStepClass(idToRegsActive, 1)}
                fill={idToRegsActive ? "#FFF7ED" : "#F8FAFC"}
                stroke={idToRegsActive ? "#EA580C" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="280"
                y="424"
                dominantBaseline="central"
                fill={idToRegsActive ? "#C2410C" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Registers
              </text>

              {/* 부품 4: Imm Gen (세로형 타원 rx=44, ry=58, cx=578, cy=424) */}
              <ellipse
                cx="578"
                cy="424"
                rx="44"
                ry="58"
                className={boxStepClass(idToImmGenActive, 1)}
                fill={idToImmGenActive ? "#FFF7ED" : "#F8FAFC"}
                stroke={idToImmGenActive ? "#EA580C" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="578"
                y="412"
                dominantBaseline="central"
                fill={idToImmGenActive ? "#C2410C" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Imm
              </text>
              <text
                x="578"
                y="436"
                dominantBaseline="central"
                fill={idToImmGenActive ? "#C2410C" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Gen
              </text>

              {/* 부품 5: Control Unit (세로형 타원 rx=44, ry=58, cx=801, cy=424) */}
              <ellipse
                cx="801"
                cy="424"
                rx="44"
                ry="58"
                className={boxStepClass(idControlUnitActive, 1)}
                fill={idControlUnitActive ? "#FFF7ED" : "#F8FAFC"}
                stroke={idControlUnitActive ? "#EA580C" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="801"
                y="412"
                dominantBaseline="central"
                fill={idControlUnitActive ? "#C2410C" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Control
              </text>
              <text
                x="801"
                y="436"
                dominantBaseline="central"
                fill={idControlUnitActive ? "#C2410C" : "#94A3B8"}
                fontSize="18"
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
                stroke={idRd1ToIdExActive ? "#EA580C" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(idRd1ToIdExActive, 2)}
                markerEnd={idRd1ToIdExActive ? "url(#m-arr-orange)" : inactiveMarker}
                style={wireStyle(idRd1ToIdExActive)}
              />
              {/* 2) Read Data 2 */}
              <line
                x1="350"
                y1="480"
                x2="350"
                y2="538"
                stroke={idRd2ToIdExActive ? "#EA580C" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(idRd2ToIdExActive, 2)}
                markerEnd={idRd2ToIdExActive ? "url(#m-arr-orange)" : inactiveMarker}
                style={wireStyle(idRd2ToIdExActive)}
              />
              {/* 3) Imm */}
              <line
                x1="578"
                y1="482"
                x2="578"
                y2="538"
                stroke={idImmToIdExActive ? "#EA580C" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(idImmToIdExActive, 2)}
                markerEnd={idImmToIdExActive ? "url(#m-arr-orange)" : inactiveMarker}
                style={wireStyle(idImmToIdExActive)}
              />
              {/* 4) PC 파이프라인 전달선 (IF/ID Addr ➔ ID/EX Addr, 일직선 수직 라인 x=701) */}
              <line
                x1="701"
                y1="311"
                x2="701"
                y2="538"
                stroke={idPcToIdExActive ? "#EA580C" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(idPcToIdExActive, 1)}
                markerEnd={idPcToIdExActive ? "url(#m-arr-orange)" : inactiveMarker}
                style={wireStyle(idPcToIdExActive)}
              />
              {/* 5) Control Unit ➔ ID/EX SIGNAL BUFFER [EX, M, WB] 3분기 제어 버스 */}
              <path
                d="M 801,482 L 801,508 M 755,508 L 847,508"
                fill="none"
                stroke={idControlUnitActive ? "#EA580C" : inactiveStroke}
                strokeWidth="2.8"
                strokeDasharray="6 3"
                className={wireStepClass(idControlUnitActive, 2, true)}
                style={wireStyle(idControlUnitActive)}
              />
              {/* 분기 1: EX 셀 인입 (X = 755) */}
              <line
                x1="755"
                y1="508"
                x2="755"
                y2="538"
                stroke={idControlUnitActive ? "#EA580C" : inactiveStroke}
                strokeWidth="2.8"
                strokeDasharray="6 3"
                className={wireStepClass(idControlUnitActive, 2, true)}
                markerEnd={idControlUnitActive ? "url(#m-arr-orange)" : inactiveMarker}
                style={wireStyle(idControlUnitActive)}
              />
              {/* 분기 2: M 셀 인입 (X = 801) */}
              <line
                x1="801"
                y1="508"
                x2="801"
                y2="538"
                stroke={idControlUnitActive ? "#EA580C" : inactiveStroke}
                strokeWidth="2.8"
                strokeDasharray="6 3"
                className={wireStepClass(idControlUnitActive, 2, true)}
                markerEnd={idControlUnitActive ? "url(#m-arr-orange)" : inactiveMarker}
                style={wireStyle(idControlUnitActive)}
              />
              {/* 분기 3: WB 셀 인입 (X = 847) */}
              <line
                x1="847"
                y1="508"
                x2="847"
                y2="538"
                stroke={idControlUnitActive ? "#EA580C" : inactiveStroke}
                strokeWidth="2.8"
                strokeDasharray="6 3"
                className={wireStepClass(idControlUnitActive, 2, true)}
                markerEnd={idControlUnitActive ? "url(#m-arr-orange)" : inactiveMarker}
                style={wireStyle(idControlUnitActive)}
              />

              {/* ============================================================ */}
              {/* 파이프라인 버퍼 2: ID / EX BUFFER (데이터 560px + Addr 46px + 시그널 138px) */}
              {/* ============================================================ */}
              {/* 데이터 버퍼 (X = 110 ~ 670) */}
              <rect
                x="110"
                y="540"
                width="560"
                height="26"
                rx="6"
                fill={isIdActive ? "#FEF9C3" : "#F1F5F9"}
                stroke={isIdActive ? "#EAB308" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="390"
                y="553"
                dominantBaseline="central"
                fill={isIdActive ? "#A16207" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                ID / EX BUFFER
              </text>

              {/* Addr 버퍼 2 (X = 678 ~ 724, W = 46) */}
              <rect
                x="678"
                y="540"
                width="46"
                height="26"
                rx="6"
                fill={idPcToIdExActive ? "#FEF9C3" : "#F1F5F9"}
                stroke={idPcToIdExActive ? "#EAB308" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="701"
                y="553"
                dominantBaseline="central"
                fill={idPcToIdExActive ? "#A16207" : "#94A3B8"}
                fontSize="16"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Addr
              </text>

              {/* 시그널 버퍼 (X = 732 ~ 870) : [ EX | M | WB ] */}
              <g>
                <rect
                  x="732"
                  y="540"
                  width="138"
                  height="26"
                  rx="6"
                  fill="#F1F5F9"
                  stroke="#94A3B8"
                  strokeWidth="2.8"
                />
                <line x1="778" y1="540" x2="778" y2="566" stroke="#94A3B8" strokeWidth="1" />
                <line x1="824" y1="540" x2="824" y2="566" stroke="#94A3B8" strokeWidth="1" />

                {/* EX 셀 (X = 732 ~ 778) */}
                <rect
                  x="733"
                  y="541"
                  width="44"
                  height="24"
                  rx="5"
                  fill={isExActive ? "#F0FDF4" : "transparent"}
                />
                <text
                  x="755"
                  y="553"
                  dominantBaseline="central"
                  fill={isExActive ? "#15803D" : "#94A3B8"}
                  fontSize="18"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  EX
                </text>

                {/* M 셀 (X = 778 ~ 824) */}
                <rect
                  x="779"
                  y="541"
                  width="44"
                  height="24"
                  rx="5"
                  fill={isMemActive ? "#F0F9FF" : "transparent"}
                />
                <text
                  x="801"
                  y="553"
                  dominantBaseline="central"
                  fill={isMemActive ? "#0369A1" : "#94A3B8"}
                  fontSize="18"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  M
                </text>

                {/* WB 셀 (X = 824 ~ 870) */}
                <rect
                  x="825"
                  y="541"
                  width="44"
                  height="24"
                  rx="5"
                  fill={isWbActive ? "#F5F3FF" : "transparent"}
                />
                <text
                  x="847"
                  y="553"
                  dominantBaseline="central"
                  fill={isWbActive ? "#6D28D9" : "#94A3B8"}
                  fontSize="18"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  WB
                </text>
              </g>

              {/* EX 제어선: ID/EX EX셀 ➔ ALUSrc MUX 우측면 인입 */}
              <path
                d="M 755,566 L 755,684 L 430,684"
                fill="none"
                stroke={exAluSrcToAluActive ? "#16A34A" : inactiveStroke}
                strokeWidth="2.8"
                strokeDasharray="6 3"
                className={wireStepClass(exAluSrcToAluActive, 1, true)}
                markerEnd={exAluSrcToAluActive ? "url(#m-arr-green)" : inactiveMarker}
                style={wireStyle(exAluSrcToAluActive)}
              />
              {/* 컨트롤 신호 전달선 1: M ➔ M (ID/EX M셀 ➔ EX/MEM M셀 수직 직하강) */}
              <line
                x1="801"
                y1="566"
                x2="801"
                y2="908"
                stroke={isExActive ? "#16A34A" : inactiveStroke}
                strokeWidth="2.8"
                strokeDasharray="6 3"
                className={wireStepClass(isExActive, 1, true)}
                markerEnd={isExActive ? "url(#m-arr-green)" : inactiveMarker}
                style={wireStyle(isExActive)}
              />
              {/* 컨트롤 신호 전달선 2: WB ➔ WB (ID/EX WB셀 ➔ EX/MEM WB셀 수직 직하강) */}
              <line
                x1="847"
                y1="566"
                x2="847"
                y2="908"
                stroke={isExActive ? "#16A34A" : inactiveStroke}
                strokeWidth="2.8"
                strokeDasharray="6 3"
                className={wireStepClass(isExActive, 1, true)}
                markerEnd={isExActive ? "url(#m-arr-green)" : inactiveMarker}
                style={wireStyle(isExActive)}
              />

              {/* ============================================================ */}
              {/* [STAGE 3] EXECUTE / ALU (EX) : Y = 566 ~ 910                  */}
              {/* ============================================================ */}
              {/* 1) Read Data 1 (X = 240) ➔ ALU 좌측 입력 포트(X = 240, Y = 739)로 직하강 */}
              <line
                x1="240"
                y1="566"
                x2="240"
                y2="739"
                stroke={exRd1ToAluActive ? "#16A34A" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(exRd1ToAluActive, 0)}
                markerEnd={exRd1ToAluActive ? "url(#m-arr-green)" : inactiveMarker}
                style={wireStyle(exRd1ToAluActive)}
              />

              {/* 2) Read Data 2 Trunk (X = 350, Y = 566 -> 595) */}
              <line
                x1="350"
                y1="566"
                x2="350"
                y2="595"
                stroke={exRd2TrunkActive ? "#16A34A" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(exRd2TrunkActive, 0)}
                style={wireStyle(exRd2TrunkActive)}
              />
              {/* Read Data 2 ➔ ALUSrc MUX 좌측 입력(X = 350, Y = 595 -> 663) */}
              <line
                x1="350"
                y1="595"
                x2="350"
                y2="663"
                stroke={exRd2ToAluSrcActive ? "#16A34A" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(exRd2ToAluSrcActive, 1)}
                markerEnd={exRd2ToAluSrcActive ? "url(#m-arr-green)" : inactiveMarker}
                style={wireStyle(exRd2ToAluSrcActive)}
              />
              {/* Read Data 2 분기 ➔ EX/MEM 버퍼 (Data Memory Write Data용, x=480 직하강) */}
              <path
                d="M 350,595 L 480,595 L 480,908"
                fill="none"
                stroke={exRd2ToWriteDataActive ? "#16A34A" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(exRd2ToWriteDataActive, 1)}
                markerEnd={exRd2ToWriteDataActive ? "url(#m-arr-green)" : inactiveMarker}
                style={wireStyle(exRd2ToWriteDataActive)}
              />
              <circle
                cx="350"
                cy="595"
                r="3.5"
                className={dotStepClass(exRd2ToWriteDataActive, 1)}
                fill={exRd2ToWriteDataActive ? "#16A34A" : inactiveStroke}
                style={wireStyle(exRd2ToWriteDataActive)}
              />

              {/* 3) Imm Trunk (X = 578, Y = 566 -> 630) */}
              <line
                x1="578"
                y1="566"
                x2="578"
                y2="630"
                stroke={exImmTrunkActive ? "#16A34A" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(exImmTrunkActive, 0)}
                style={wireStyle(exImmTrunkActive)}
              />
              {/* Imm ➔ ALUSrc MUX 우측 입력(X = 410, Y = 663) 분기 */}
              <path
                d="M 578,630 L 410,630 L 410,663"
                fill="none"
                stroke={exImmToAluSrcActive ? "#16A34A" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(exImmToAluSrcActive, 1)}
                markerEnd={exImmToAluSrcActive ? "url(#m-arr-green)" : inactiveMarker}
                style={wireStyle(exImmToAluSrcActive)}
              />
              <circle
                cx="578"
                cy="630"
                r="3.5"
                className={dotStepClass(exImmToAluSrcActive, 1)}
                fill={exImmToAluSrcActive ? "#16A34A" : inactiveStroke}
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
                className={boxStepClass(exAluSrcToAluActive, 1)}
                fill={exAluSrcToAluActive ? "#F0FDF4" : "#F8FAFC"}
                stroke={exAluSrcToAluActive ? "#16A34A" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="380"
                y="684"
                dominantBaseline="central"
                fill={exAluSrcToAluActive ? "#15803D" : "#94A3B8"}
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
                stroke={exAluSrcToAluActive ? "#16A34A" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(exAluSrcToAluActive, 2)}
                markerEnd={exAluSrcToAluActive ? "url(#m-arr-green)" : inactiveMarker}
                style={wireStyle(exAluSrcToAluActive)}
              />

              {/* 부품 6: ALU (center x=310, y=741..869, h=128) */}
              <g>
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
                  className={boxStepClass(exAluToExMemActive || (isExActive && isBranch(exOp)), 2)}
                  fill={exAluToExMemActive || (isExActive && isBranch(exOp)) ? "#F0FDF4" : "#F8FAFC"}
                  stroke={exAluToExMemActive || (isExActive && isBranch(exOp)) ? "#16A34A" : "#94A3B8"}
                  strokeWidth="2.8"
                  strokeLinejoin="round"
                />
                <text
                  x="310"
                  y="825"
                  dominantBaseline="central"
                  fill={exAluToExMemActive || (isExActive && isBranch(exOp)) ? "#15803D" : "#94A3B8"}
                  fontSize="18"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  ALU
                </text>
              </g>

              {/* 우측 Branch Adder (center 615: 좌측 포트 x=578, 우측 포트 x=652 수직 직하강) */}
              {/* Branch Add 입력 1: Imm (좌측 포트 x=578, y=630 -> 743 수직 직하강) */}
              <line
                x1="578"
                y1="630"
                x2="578"
                y2="743"
                stroke={exImmToBranchAddActive ? "#16A34A" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(exImmToBranchAddActive, 1)}
                markerEnd={exImmToBranchAddActive ? "url(#m-arr-green)" : inactiveMarker}
                style={wireStyle(exImmToBranchAddActive)}
              />
              {/* Branch Add 입력 2: PC (우측 포트 x=701 수직 직하강 ➔ x=652 포트 인입) */}
              <path
                d="M 701,566 L 701,720 L 652,720 L 652,743"
                fill="none"
                stroke={exPcToBranchAddActive ? "#16A34A" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(exPcToBranchAddActive, 1)}
                markerEnd={exPcToBranchAddActive ? "url(#m-arr-green)" : inactiveMarker}
                style={wireStyle(exPcToBranchAddActive)}
              />
              <polygon
                points="550,745 680,745 650,808 580,808"
                className={boxStepClass(exBranchAddActive, 2)}
                fill={exBranchAddActive ? "#F0FDF4" : "#F8FAFC"}
                stroke={exBranchAddActive ? "#16A34A" : "#94A3B8"}
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              <text
                x="615"
                y="765"
                dominantBaseline="central"
                fill={exBranchAddActive ? "#15803D" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Branch
              </text>
              <text
                x="615"
                y="789"
                dominantBaseline="central"
                fill={exBranchAddActive ? "#15803D" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                Add
              </text>

              {/* ALU 출력(X = 310, Y = 869) ➔ EX/MEM BUFFER (Y = 910) 직하강 */}
              <line
                x1="310"
                y1="869"
                x2="310"
                y2="908"
                stroke={exAluToExMemActive ? "#16A34A" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(exAluToExMemActive, 3)}
                markerEnd={exAluToExMemActive ? "url(#m-arr-green)" : inactiveMarker}
                style={wireStyle(exAluToExMemActive)}
              />

              {/* ============================================================ */}
              {/* 파이프라인 버퍼 3: EX / MEM BUFFER (데이터 660px + 시그널 92px) */}
              {/* ============================================================ */}
              {/* 데이터 버퍼 (X = 110 ~ 770) */}
              <rect
                x="110"
                y="910"
                width="660"
                height="26"
                rx="6"
                fill={isExActive ? "#FEF9C3" : "#F1F5F9"}
                stroke={isExActive ? "#EAB308" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="440"
                y="923"
                dominantBaseline="central"
                fill={isExActive ? "#A16207" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                EX / MEM BUFFER
              </text>

              {/* 시그널 버퍼 (X = 778 ~ 870) : [ M | WB ] */}
              <g>
                <rect
                  x="778"
                  y="910"
                  width="92"
                  height="26"
                  rx="6"
                  fill="#F1F5F9"
                  stroke="#94A3B8"
                  strokeWidth="2.8"
                />
                <line x1="824" y1="910" x2="824" y2="936" stroke="#94A3B8" strokeWidth="1" />

                {/* M 셀 (X = 778 ~ 824) */}
                <rect
                  x="779"
                  y="911"
                  width="44"
                  height="24"
                  rx="5"
                  fill={isMemActive ? "#F0F9FF" : "transparent"}
                />
                <text
                  x="801"
                  y="923"
                  dominantBaseline="central"
                  fill={isMemActive ? "#0369A1" : "#94A3B8"}
                  fontSize="18"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  M
                </text>

                {/* WB 셀 (X = 824 ~ 870) */}
                <rect
                  x="825"
                  y="911"
                  width="44"
                  height="24"
                  rx="5"
                  fill={isWbActive ? "#F5F3FF" : "transparent"}
                />
                <text
                  x="847"
                  y="923"
                  dominantBaseline="central"
                  fill={isWbActive ? "#6D28D9" : "#94A3B8"}
                  fontSize="18"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  WB
                </text>
              </g>

              {/* MEM 제어선: EX/MEM M셀 ➔ Data Memory 우측면 중간 인입 */}
              <path
                d="M 801,936 L 801,1051 L 550,1051"
                fill="none"
                stroke={memAluToDmemAddrActive ? "#0284C7" : inactiveStroke}
                strokeWidth="2.8"
                strokeDasharray="6 3"
                className={wireStepClass(memAluToDmemAddrActive, 1, true)}
                markerEnd={memAluToDmemAddrActive ? "url(#m-arr-blue)" : inactiveMarker}
                style={wireStyle(memAluToDmemAddrActive)}
              />
              {/* 컨트롤 신호 전달선: WB ➔ WB (EX/MEM WB셀 ➔ MEM/WB WB셀 수직 직하강) */}
              <line
                x1="847"
                y1="936"
                x2="847"
                y2="1154"
                stroke={isMemActive ? "#0284C7" : inactiveStroke}
                strokeWidth="2.8"
                strokeDasharray="6 3"
                className={wireStepClass(isMemActive, 1, true)}
                markerEnd={isMemActive ? "url(#m-arr-blue)" : inactiveMarker}
                style={wireStyle(isMemActive)}
              />

              {/* ============================================================ */}
              {/* [STAGE 4] MEMORY ACCESS (MEM) : Y = 936 ~ 1156               */}
              {/* ============================================================ */}
              {/* ALU Result Trunk (X = 310, Y = 936 -> 965) */}
              <line
                x1="310"
                y1="936"
                x2="310"
                y2="965"
                stroke={memAluTrunkActive ? "#0284C7" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(memAluTrunkActive, 0)}
                style={wireStyle(memAluTrunkActive)}
              />
              {/* 1) ALU Result 분기 ➔ Data Memory Address 입력 (X = 310, Y = 965 -> 994) */}
              <line
                x1="310"
                y1="965"
                x2="310"
                y2="994"
                stroke={memAluToDmemAddrActive ? "#0284C7" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(memAluToDmemAddrActive, 1)}
                markerEnd={memAluToDmemAddrActive ? "url(#m-arr-blue)" : inactiveMarker}
                style={wireStyle(memAluToDmemAddrActive)}
              />
              {/* 2) ALU Result Bypass (EX/MEM ➔ MEM/WB 버퍼 직행, X = 225) */}
              <path
                d="M 310,965 L 225,965 L 225,1154"
                fill="none"
                stroke={memAluBypassActive ? "#0284C7" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(memAluBypassActive, 1)}
                markerEnd={memAluBypassActive ? "url(#m-arr-blue)" : inactiveMarker}
                style={wireStyle(memAluBypassActive)}
              />
              <circle
                cx="310"
                cy="965"
                r="3.5"
                className={dotStepClass(memAluBypassActive, 1)}
                fill={memAluBypassActive ? "#0284C7" : inactiveStroke}
                style={wireStyle(memAluBypassActive)}
              />

              {/* 3) Write Data (sw 명령어용: EX/MEM 버퍼 ➔ Data Memory Write Data 포트, X = 480) */}
              <line
                x1="480"
                y1="936"
                x2="480"
                y2="994"
                stroke={memWriteDataActive ? "#0284C7" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(memWriteDataActive, 0)}
                markerEnd={memWriteDataActive ? "url(#m-arr-blue)" : inactiveMarker}
                style={wireStyle(memWriteDataActive)}
              />

              {/* 부품 7: Data Memory (미니멀 라운드 박스, x=270, width=280, y=996..1106, center=410) */}
              <rect
                x="270"
                y="996"
                width="280"
                height="110"
                rx="8"
                className={boxStepClass(memAluToDmemAddrActive, 1)}
                fill={memAluToDmemAddrActive ? "#F0F9FF" : "#F8FAFC"}
                stroke={memAluToDmemAddrActive ? "#0284C7" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="410"
                y="1051"
                dominantBaseline="central"
                fill={memAluToDmemAddrActive ? "#0369A1" : "#94A3B8"}
                fontSize="18"
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
                stroke={memDmemReadDataActive ? "#0284C7" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(memDmemReadDataActive, 2)}
                markerEnd={memDmemReadDataActive ? "url(#m-arr-blue)" : inactiveMarker}
                style={wireStyle(memDmemReadDataActive)}
              />

              {/* ============================================================ */}
              {/* 파이프라인 버퍼 4: MEM / WB BUFFER (데이터 706px + 시그널 46px) */}
              {/* ============================================================ */}
              {/* 데이터 버퍼 (X = 110 ~ 816) */}
              <rect
                x="110"
                y="1156"
                width="706"
                height="26"
                rx="6"
                fill={isMemActive ? "#FEF9C3" : "#F1F5F9"}
                stroke={isMemActive ? "#EAB308" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="463"
                y="1169"
                dominantBaseline="central"
                fill={isMemActive ? "#A16207" : "#94A3B8"}
                fontSize="18"
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                MEM / WB BUFFER
              </text>

              {/* 시그널 버퍼 (X = 824 ~ 870) : [ WB ] */}
              <g>
                <rect
                  x="824"
                  y="1156"
                  width="46"
                  height="26"
                  rx="6"
                  fill={isWbActive ? "#F5F3FF" : "#F1F5F9"}
                  stroke={isWbActive ? "#8B5CF6" : "#94A3B8"}
                  strokeWidth="2.8"
                />
                <text
                  x="847"
                  y="1169"
                  dominantBaseline="central"
                  fill={isWbActive ? "#6D28D9" : "#94A3B8"}
                  fontSize="18"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  WB
                </text>
              </g>

              {/* WB 제어선: MEM/WB WB셀 ➔ WB MUX 우측면 인입 */}
              <path
                d="M 847,1182 L 847,1277 L 490,1277"
                fill="none"
                stroke={wbAluBypassActive || wbDmemReadDataActive ? "#8B5CF6" : inactiveStroke}
                strokeWidth="2.8"
                strokeDasharray="6 3"
                className={wireStepClass(wbAluBypassActive || wbDmemReadDataActive, 1, true)}
                markerEnd={wbAluBypassActive || wbDmemReadDataActive ? "url(#m-arr-purple)" : inactiveMarker}
                style={wireStyle(wbAluBypassActive || wbDmemReadDataActive)}
              />

              {/* ============================================================ */}
              {/* [STAGE 5] WRITE-BACK (WB) : Y = 1182 ~ 1350                  */}
              {/* ============================================================ */}
              {/* 1) ALU Result Bypass ➔ WB MUX 좌측 입력 (X = 225 -> 410) */}
              <path
                d="M 225,1182 L 225,1218 L 410,1218 L 410,1256"
                fill="none"
                stroke={wbAluBypassActive ? "#8B5CF6" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(wbAluBypassActive, 0)}
                markerEnd={wbAluBypassActive ? "url(#m-arr-purple)" : inactiveMarker}
                style={wireStyle(wbAluBypassActive)}
              />

              {/* 2) Data Memory Read Data ➔ WB MUX 우측 입력 (X = 470 직선 직하강) */}
              <line
                x1="470"
                y1="1182"
                x2="470"
                y2="1256"
                stroke={wbDmemReadDataActive ? "#8B5CF6" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(wbDmemReadDataActive, 0)}
                markerEnd={wbDmemReadDataActive ? "url(#m-arr-purple)" : inactiveMarker}
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
                className={boxStepClass(wbAluBypassActive || wbDmemReadDataActive, 1)}
                fill={wbAluBypassActive || wbDmemReadDataActive ? "#F5F3FF" : "#F8FAFC"}
                stroke={wbAluBypassActive || wbDmemReadDataActive ? "#8B5CF6" : "#94A3B8"}
                strokeWidth="2.8"
              />
              <text
                x="440"
                y="1277"
                dominantBaseline="central"
                fill={wbAluBypassActive || wbDmemReadDataActive ? "#6D28D9" : "#94A3B8"}
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
                stroke={wbReverseFeedbackActive ? "#8B5CF6" : inactiveStroke}
                strokeWidth="2.8"
                className={wireStepClass(wbReverseFeedbackActive, 2)}
                markerEnd={wbReverseFeedbackActive ? "url(#m-arr-purple)" : inactiveMarker}
                style={wireStyle(wbReverseFeedbackActive)}
              />

              {/* ============================================================ */}
              {/* [최상단 오버레이 레이어] 실시간 이동 데이터/주소 토큰 (Floating Data Tokens & Chips) */}
              {/* 버퍼 및 기타 소자들보다 항상 위에 렌더링되어 가려지지 않습니다. */}
              {/* ============================================================ */}
              {/* [Step 1: 0.0 ~ 0.40] PC 출력 ➔ IM, +4 가산기, Addr 버퍼 분기 */}
              {ifPcToImemActive && pcToImemPoint && pcToImemState && (
                <g className="cursor-pointer" style={{ opacity: pcToImemState.opacity, transition: "opacity 0.08s ease-out" }}>
                  <rect
                    x={pcToImemPoint.x - 36}
                    y={pcToImemPoint.y - 12}
                    width="72"
                    height="24"
                    rx="12"
                    fill="#1E293B"
                    stroke="#EF4444"
                    strokeWidth="2"
                    filter="url(#token-glow)"
                  />
                  <text
                    x={pcToImemPoint.x}
                    y={pcToImemPoint.y}
                    dominantBaseline="central"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="D2Coding, monospace"
                  >
                    {ifPcDec}
                  </text>
                  <title>{`PC 주소 (10진수): ${ifPcDec}`}</title>
                </g>
              )}

              {ifPcToPlus4Active && pcToPlus4Point && pcToPlus4State && (
                <g className="cursor-pointer" style={{ opacity: pcToPlus4State.opacity, transition: "opacity 0.08s ease-out" }}>
                  <rect
                    x={pcToPlus4Point.x - 36}
                    y={pcToPlus4Point.y - 12}
                    width="72"
                    height="24"
                    rx="12"
                    fill="#1E293B"
                    stroke="#EF4444"
                    strokeWidth="2"
                    filter="url(#token-glow)"
                  />
                  <text
                    x={pcToPlus4Point.x}
                    y={pcToPlus4Point.y}
                    dominantBaseline="central"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="D2Coding, monospace"
                  >
                    {ifPcDec}
                  </text>
                  <title>{`PC 주소 (10진수): ${ifPcDec}`}</title>
                </g>
              )}

              {ifPcToIfIdActive && pcToAddrPoint && pcToAddrState && (
                <g className="cursor-pointer" style={{ opacity: pcToAddrState.opacity, transition: "opacity 0.08s ease-out" }}>
                  <rect
                    x={pcToAddrPoint.x - 36}
                    y={pcToAddrPoint.y - 12}
                    width="72"
                    height="24"
                    rx="12"
                    fill="#1E293B"
                    stroke="#EF4444"
                    strokeWidth="2"
                    filter="url(#token-glow)"
                  />
                  <text
                    x={pcToAddrPoint.x}
                    y={pcToAddrPoint.y}
                    dominantBaseline="central"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="D2Coding, monospace"
                  >
                    {ifPcDec}
                  </text>
                  <title>{`보존되는 PC 주소 (10진수): ${ifPcDec}`}</title>
                </g>
              )}

              {/* [Step 2: 0.40 ~ 0.85] +4 Adder 결과 ➔ PC MUX 루프백 & IM ➔ IF/ID 버퍼 명령어 칩 */}
              {ifPlus4LoopbackActive && plus4LoopbackPoint && plus4LoopbackState && (
                <g className="cursor-pointer" style={{ opacity: plus4LoopbackState.opacity, transition: "opacity 0.08s ease-out" }}>
                  <rect
                    x={plus4LoopbackPoint.x - 36}
                    y={plus4LoopbackPoint.y - 12}
                    width="72"
                    height="24"
                    rx="12"
                    fill="#1E293B"
                    stroke="#EF4444"
                    strokeWidth="2"
                    filter="url(#token-glow)"
                  />
                  <text
                    x={plus4LoopbackPoint.x}
                    y={plus4LoopbackPoint.y}
                    dominantBaseline="central"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="D2Coding, monospace"
                  >
                    {ifPcPlus4Dec}
                  </text>
                  <title>{`PC + 4 (10진수): ${ifPcPlus4Dec}`}</title>
                </g>
              )}

              {ifImemToIfIdActive && imemToIfIdPoint && imemToIfIdState && (() => {
                const textLen = (ifInst || '—').length;
                const chipWidth = Math.max(90, Math.min(220, textLen * 9 + 24));
                return (
                  <g className="cursor-pointer" style={{ opacity: imemToIfIdState.opacity, transition: "opacity 0.08s ease-out" }}>
                    <rect
                      x={imemToIfIdPoint.x - chipWidth / 2}
                      y={imemToIfIdPoint.y - 12}
                      width={chipWidth}
                      height="24"
                      rx="12"
                      fill="#1E293B"
                      stroke="#EF4444"
                      strokeWidth="2"
                      filter="url(#token-glow)"
                    />
                    <text
                      x={imemToIfIdPoint.x}
                      y={imemToIfIdPoint.y}
                      dominantBaseline="central"
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="12"
                      fontWeight="bold"
                      fontFamily="D2Coding, monospace"
                    >
                      {ifInst || '—'}
                    </text>
                    <title>{`반환된 명령어: ${ifInst}`}</title>
                  </g>
                );
              })()}

              {/* [Step 3: 0.85 ~ 1.00] PC MUX ➔ PC 레지스터 입력 (다음 PC 주소 래치 준비) */}
              {ifPcMuxToPcActive && muxToPcPoint && muxToPcState && (
                <g className="cursor-pointer" style={{ opacity: muxToPcState.opacity, transition: "opacity 0.08s ease-out" }}>
                  <rect
                    x={muxToPcPoint.x - 36}
                    y={muxToPcPoint.y - 12}
                    width="72"
                    height="24"
                    rx="12"
                    fill="#1E293B"
                    stroke="#EF4444"
                    strokeWidth="2"
                    filter="url(#token-glow)"
                  />
                  <text
                    x={muxToPcPoint.x}
                    y={muxToPcPoint.y}
                    dominantBaseline="central"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="D2Coding, monospace"
                  >
                    {branchLoopbackActive ? "Branch" : ifPcPlus4Dec}
                  </text>
                  <title>{`다음 PC 입력 (10진수): ${branchLoopbackActive ? "Branch Target" : ifPcPlus4Dec}`}</title>
                </g>
              )}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PipelineVisualizer);
