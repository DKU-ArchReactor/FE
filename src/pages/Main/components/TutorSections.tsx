import React from "react";
import type { CycleHistoryItem, SimulationResult } from "@/type/simulation";
import type { MappedAssemblyRow } from "../utils/translationCompile";
import {
  analyzeCLine,
  analyzeAsmInstruction,
  analyzeCrtInstruction,
  instructionAt,
} from "../utils/tutorAnalysis";
import { TutorInstructionEvidence, TutorText } from "./TutorEvidence";

export const TutorCrtCard: React.FC<{
  selectedRow: MappedAssemblyRow;
  selectedAsmIndex: number | null | undefined;
  totalRowsCount: number;
  simulationData: SimulationResult | null;
  historyIndex?: number;
}> = ({ selectedRow, selectedAsmIndex, totalRowsCount, simulationData, historyIndex }) => {
  const crtInfo = analyzeCrtInstruction(selectedRow.text, selectedRow.pc);
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-slate-300 bg-slate-50/70 p-3.5 flex flex-col gap-3 shadow-2xs">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200/80 pb-2.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-[#F0F0F0] text-[#8C959F] whitespace-nowrap shrink-0">
                소스 위치 미확인
              </span>
              <strong className="text-xs font-bold text-slate-800">
                {crtInfo.title}
              </strong>
            </div>
          </div>
          {selectedRow.pc && (
            <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap shrink-0">
              PC: {selectedRow.pc}
            </span>
          )}
        </div>

        <div className="font-mono text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 font-semibold flex items-center justify-between shadow-2xs">
          <span>{selectedRow.text}</span>
          <span className="text-[10px] text-slate-400 font-normal">
            ASM L{(selectedAsmIndex ?? 0) + 1}
          </span>
        </div>

        <p className="text-[11px] text-[var(--ar-text-muted)]">
          전체 ASM {totalRowsCount}개 중 소스 위치가 확인되지 않은 선택 명령어 1개를 설명합니다.
        </p>
        <p className="text-[13px] leading-6 text-[var(--ar-text-primary)]">
          <TutorText
            text={
              analyzeAsmInstruction(
                selectedRow.text,
                instructionAt(simulationData?.tutor, selectedRow.pc)?.explanation
              ).explanation
            }
          />
        </p>
        <TutorInstructionEvidence
          item={instructionAt(simulationData?.tutor, selectedRow.pc)}
          bundle={simulationData?.tutor}
          historyIndex={historyIndex}
          focused
        />
        <details className="border-t border-[var(--ar-border)] pt-2">
          <summary className="cursor-pointer py-1 text-xs font-semibold text-[var(--ar-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--ar-accent)]">
            소스 위치와 실행 문맥
          </summary>
          <div className="space-y-2.5 pt-2">
            <div className="flex items-start gap-1.5 text-xs text-slate-800">
              <div>
                <strong className="text-slate-900 font-bold">{crtInfo.role}</strong>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  {crtInfo.summary}
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[13px] text-[var(--ar-text-muted)] leading-7">
              <p>{crtInfo.detail}</p>
            </div>

            <div className="p-2 rounded bg-slate-100/70 border border-slate-200/80 text-[10px] text-slate-500 flex items-start gap-1.5">
              <span className="font-bold text-slate-700 shrink-0">하드웨어 동작:</span>
              <span>{crtInfo.instructionDetail.hardwareDetail}</span>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export const TutorSelectedLineSection: React.FC<{
  activeTarget: "c" | "asm";
  selectedRow: MappedAssemblyRow | null;
  selectedTranslationLine: number | null | undefined;
  selectedAsmLineText: string | null;
  selectedCLineText: string | null;
  cLineAnalysis: ReturnType<typeof analyzeCLine> | null;
  lineExplanation?: { source_line: number; summary: string; detail: string };
  explainedAsmRows: (MappedAssemblyRow & { asmIndex: number })[];
  effectiveRowsCount: number;
  selectedAsmIndex: number | null | undefined;
  currentActiveAsmIndex: number | null | undefined;
  isUserSelected: boolean;
  followsExecution: boolean;
  simulationData: SimulationResult | null;
  historyIndex?: number;
}> = ({
  activeTarget,
  selectedRow,
  selectedTranslationLine,
  selectedAsmLineText,
  selectedCLineText,
  cLineAnalysis,
  lineExplanation,
  explainedAsmRows,
  effectiveRowsCount,
  selectedAsmIndex,
  currentActiveAsmIndex,
  isUserSelected,
  followsExecution,
  simulationData,
  historyIndex,
}) => {
  return (
    <div className="flex flex-col gap-3">
      {activeTarget === "asm" && !selectedRow && selectedTranslationLine && selectedAsmLineText !== null && (() => {
        const trimmed = selectedAsmLineText.trim();
        const noComment = trimmed.replace(/#.*/, "").trim();
        const isCommentOnly = trimmed.startsWith("#");
        const isDirective = noComment.startsWith(".");
        const isLabel = /^[.$\w]+:$/.test(noComment);
        const badgeText = !trimmed
          ? "빈 줄"
          : isCommentOnly
            ? "주석"
            : isDirective
              ? "어셈블러 지시어"
              : isLabel
                ? "심볼 라벨"
                : "어셈블리 구문";
        const descText = !trimmed
          ? "실행 명령어가 없는 공백 줄입니다."
          : isCommentOnly
            ? "코드 설명을 위한 주석이며 CPU가 실행하는 기계어로 변환되지 않습니다."
            : isDirective
              ? "어셈블러에게 섹션 배치나 심볼 공개 범위(.globl 등)를 지시하는 메타 명령어입니다."
              : isLabel
                ? "분기(branch)나 점프(jal/call) 명령어가 이동할 목표 코드 주소를 가리키는 이름표입니다."
                : "선택한 어셈블리 줄입니다.";

        return (
          <div className="rounded-md border border-[var(--ar-border)] border-l-2 border-l-[var(--ar-accent)] bg-[var(--ar-panel-bg)] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-semibold text-[var(--ar-accent)]">
                ASM: L{selectedTranslationLine}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded font-medium shrink-0 bg-slate-100 text-slate-700 border border-slate-200">
                {badgeText}
              </span>
            </div>
            <div className="font-mono text-[13px] leading-6 px-3 py-2 rounded-md bg-[var(--ar-header-bg)] border border-[var(--ar-border)] text-[var(--ar-text-primary)] whitespace-pre-wrap break-all">
              {trimmed || <span className="text-slate-400 italic">빈 줄</span>}
            </div>
            <p className="text-[13px] text-[var(--ar-text-muted)] leading-7">{descText}</p>
          </div>
        );
      })()}

      {activeTarget !== "asm" && cLineAnalysis && (
        <div className="rounded-md border border-[var(--ar-border)] border-l-2 border-l-[var(--ar-accent)] bg-[var(--ar-panel-bg)] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-mono font-semibold text-[var(--ar-accent)]">
                C: L{selectedTranslationLine}
              </span>
              <div className="text-sm leading-6 font-semibold text-[var(--ar-text-primary)] flex items-center gap-2">
                <span>{cLineAnalysis.summary}</span>
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded font-medium shrink-0 ${cLineAnalysis.badgeColor}`}>
              {cLineAnalysis.type}
            </span>
          </div>

          <div className="font-mono text-[13px] leading-6 px-3 py-2 rounded-md bg-[var(--ar-header-bg)] border border-[var(--ar-border)] text-[var(--ar-text-primary)] whitespace-pre-wrap break-all">
            {selectedCLineText?.trim() || <span className="text-slate-400 italic">빈 줄</span>}
          </div>

          <p className="text-[13px] text-[var(--ar-text-muted)] leading-7">{cLineAnalysis.detail}</p>
        </div>
      )}

      {activeTarget !== "asm" && lineExplanation && (
        <div className="border-l-2 border-[var(--ar-border)] pl-3 text-[13px] leading-7 space-y-1">
          <p className="font-semibold text-[var(--ar-text-primary)]">{lineExplanation.summary}</p>
          <p className="text-[var(--ar-text-muted)]">{lineExplanation.detail}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-800">
              {activeTarget === "asm" ? "선택한 ASM:" : "매핑된 ASM:"}
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
              {explainedAsmRows.length > 0 ? explainedAsmRows.map((r) => `L${r.asmIndex}`).join(", ") : "없음"}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              ({explainedAsmRows.length}개 명령어)
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">RV32IM / 컴파일 결과 기준</div>
        </div>

        <p className="text-[11px] text-[var(--ar-text-muted)]">
          전체 ASM {effectiveRowsCount}개 중{" "}
          {activeTarget === "asm"
            ? `선택한 명령어 ${explainedAsmRows.length}개를 설명합니다.`
            : `C ${selectedTranslationLine}줄에 연결된 ${explainedAsmRows.length}개를 모두 설명합니다.`}
          {selectedAsmIndex != null &&
            explainedAsmRows.some((row) => row.asmIndex === selectedAsmIndex + 1) &&
            ` 선택한 명령어는 이 그룹의 ${explainedAsmRows.findIndex((row) => row.asmIndex === selectedAsmIndex + 1) + 1}번째입니다.`}
        </p>

        {explainedAsmRows.length === 0 ? (
          <div className="p-3 rounded-lg bg-white border border-slate-200 text-center text-xs text-slate-400">
            이 줄에 연결된 명령어가 없습니다. 주석·공백·컴파일러 줄 정보의 배치 또는 누락 때문일 수 있습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-6 rounded-lg bg-[var(--ar-canvas-bg)] p-2">
            {explainedAsmRows.map((asmRow, idx) => {
              const instDetail = analyzeAsmInstruction(
                asmRow.text,
                instructionAt(simulationData?.tutor, asmRow.pc)?.explanation
              );
              const rowZeroIndex = asmRow.asmIndex - 1;
              const isRowExecuting = currentActiveAsmIndex === rowZeroIndex;
              const isRowSelectedFocus =
                (isUserSelected || activeTarget === "asm" || followsExecution) &&
                (selectedAsmIndex !== null && selectedAsmIndex !== undefined
                  ? selectedAsmIndex === rowZeroIndex
                  : idx === 0);

              return (
                <article
                  key={`${asmRow.asmIndex}-${idx}`}
                  data-asm-index={rowZeroIndex}
                  aria-label={`ASM L${asmRow.asmIndex} ${asmRow.text}`}
                  className={`rounded-lg bg-[var(--ar-panel-bg)] overflow-clip transition-colors flex flex-col gap-2 border border-l-4 shadow-sm ${
                    isRowSelectedFocus
                      ? "border-[var(--ar-accent)]"
                      : isRowExecuting
                        ? "border-emerald-500"
                        : "border-slate-300"
                  }`}
                >
                  <header className="sticky -top-4 z-10 border-b border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-4 py-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={`shrink-0 rounded px-2 py-1 font-mono text-xs font-semibold ${
                          isRowSelectedFocus
                            ? "bg-[var(--ar-accent)] text-white"
                            : isRowExecuting
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        ASM L{asmRow.asmIndex}
                      </span>
                      <h4 className="font-mono text-sm leading-6 font-medium text-[var(--ar-text-primary)] break-all">
                        {asmRow.text}
                      </h4>
                      <span className="text-[11px] text-[var(--ar-text-muted)]">{instDetail.action}</span>
                      {isRowSelectedFocus && (
                        <span className="text-[10px] font-bold text-[var(--ar-accent)] px-1.5 py-0.5 rounded border border-current">
                          {followsExecution ? "현재 설명" : "선택됨"}
                        </span>
                      )}
                      {isRowExecuting && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.2 rounded border border-emerald-300 animate-pulse">
                          실행 중
                        </span>
                      )}
                    </div>
                  </header>

                  <div className="space-y-3 px-4 pb-3">
                    <p className="text-[13px] text-[var(--ar-text-primary)] leading-6">
                      <TutorText text={instDetail.explanation} />
                    </p>
                    {instDetail.operation && instDetail.operation !== instDetail.explanation && (
                      <p className="rounded-md border border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-3 py-2 font-mono text-xs leading-6 break-all text-[var(--ar-text-primary)]">
                        {instDetail.operation}
                      </p>
                    )}
                    <TutorInstructionEvidence
                      item={instructionAt(simulationData?.tutor, asmRow.pc)}
                      bundle={simulationData?.tutor}
                      historyIndex={historyIndex}
                      focused={isRowSelectedFocus}
                    />

                    {instDetail.hardwareDetail && (
                      <details className="border-t border-[var(--ar-border)] pt-2 text-[13px] leading-7 text-[var(--ar-text-muted)]">
                        <summary className="cursor-pointer py-1 text-xs font-semibold text-[var(--ar-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--ar-accent)]">
                          명령어 원리와 주의사항
                        </summary>
                        <ul className="list-disc space-y-2 pl-5 pt-2 marker:text-[var(--ar-text-muted)]">
                          {instDetail.hardwareDetail.split(/(?<=[.!?])\s+/).map((sentence, sentenceIndex) => (
                            <li key={sentenceIndex} className="pl-1">
                              <TutorText text={sentence} />
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export const TutorCycleOverviewSection: React.FC<{
  activeTarget: "c" | "asm";
  isSingleMode: boolean;
  currentCycleData: CycleHistoryItem | null;
  simulationData: SimulationResult | null;
}> = ({ activeTarget, isSingleMode, currentCycleData, simulationData }) => {
  return (
    <div className="flex flex-col gap-3">
      {activeTarget === "asm" ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <strong className="text-xs text-[#1F2328] font-bold">
              RISC-V 어셈블리 실행 분석
            </strong>
            <p className="text-[13px] text-[var(--ar-text-muted)] leading-7">
              명령어 줄을 선택하면 연산과 레지스터 역할을 설명합니다. 실행하면 선택한 single 또는 pipeline 모드의 클록별
              상태 변화를 확인할 수 있습니다.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <strong className="text-xs text-blue-950 font-bold">
              라인별 실시간 컴파일 해설 지원
            </strong>
            <p className="text-[13px] text-[var(--ar-text-muted)] leading-7">
              상단의 <span className="font-semibold text-[var(--ar-accent)]">C 소스 코드</span>나{" "}
              <span className="font-semibold text-[var(--ar-accent)]">어셈블리 명령어</span> 줄을 클릭하면, 해당 라인의 C
              문법 역할과 대응되는 RISC-V 하드웨어 동작이 이곳에 단계별로 풀이됩니다.
            </p>
          </div>
        </div>
      )}

      {currentCycleData ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col gap-2.5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-800">
                {isSingleMode
                  ? `현재 스텝(${currentCycleData.clock} Step) 실행 분석`
                  : `현재 사이클(${currentCycleData.clock} Cycle) 실행 분석`}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 tabular-nums">
              {isSingleMode
                ? `Step ${currentCycleData.clock} / ${simulationData?.summary?.total_cycles || 0}`
                : `Cycle ${currentCycleData.clock} / ${simulationData?.summary?.total_cycles || 0}`}
            </span>
          </div>

          {(() => {
            const ifBuf =
              currentCycleData.stage_activity?.IF || currentCycleData.buffers?.IF || currentCycleData.if_stage;
            const ifInst = ifBuf?.assembly || "bubble";
            const isIdleStep0 = ifInst === "empty" && currentCycleData.clock === 0;

            if (isIdleStep0) {
              return (
                <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#005FB8] font-sans">
                      [Step 0] 시뮬레이션 준비 완료
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      Entry: {ifBuf?.pc || "0x00010000"}
                    </span>
                  </div>
                  <p className="text-[13px] text-[var(--ar-text-muted)] leading-7">
                    아직 실행된 명령어가 없습니다. 상단의 [PLAY] 또는 [다음 스텝] 버튼을 누르면 첫 번째 명령어부터
                    실행됩니다.
                  </p>
                </div>
              );
            }

            const context = instructionAt(simulationData?.tutor, ifBuf?.pc);
            const isCrtCycle = context?.mapping_status === "unmapped";
            const crtAnalysis = isCrtCycle ? analyzeCrtInstruction(ifInst, ifBuf?.pc) : null;
            const ifAnalysis = analyzeAsmInstruction(ifInst, context?.explanation);
            return (
              <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between flex-wrap gap-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="font-bold text-indigo-700 font-sans">
                      [IF 인출 단계] {ifInst}
                    </span>
                    {isCrtCycle && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium bg-[#F0F0F0] text-[#8C959F] whitespace-nowrap shrink-0">
                        소스 위치 미확인
                      </span>
                    )}
                  </div>
                  {ifBuf?.pc && (
                    <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                      PC: {ifBuf.pc}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-[var(--ar-text-muted)] leading-7">
                  {crtAnalysis ? `${crtAnalysis.role}: ${crtAnalysis.summary}` : ifAnalysis.explanation}
                </p>
              </div>
            );
          })()}
        </div>
      ) : activeTarget === "asm" ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-[#F8F8F8] rounded-md border border-dashed border-[#D0D7DE]">
          <span className="text-xs font-semibold text-[#1F2328]">
            어셈블리 코드를 작성하고 [시뮬레이션]을 실행하세요
          </span>
          <span className="text-[11px] text-[#57606A] mt-1 max-w-xs">
            작성한 명령어의 의미와 실행 모드에 따른 클록별 하드웨어 상태 변화를 확인할 수 있습니다.
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-[#F8F8F8] rounded-md border border-dashed border-[#D0D7DE]">
          <span className="text-xs font-semibold text-[#1F2328]">
            컴파일 후 코드 라인을 클릭해 보세요!
          </span>
          <span className="text-[11px] text-[#57606A] mt-1 max-w-xs">
            C 언어 코드 한 줄이 컴퓨터 CPU에서 구체적으로 어떻게 어셈블리로 번역되고 실행되는지 쉽게 풀어서 설명해 드립니다.
          </span>
        </div>
      )}
    </div>
  );
};
