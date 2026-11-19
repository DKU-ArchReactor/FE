import { useMemo } from "react";
import type { CycleHistoryItem, SimulationResult } from "@/type/simulation";
import type { MappedAssemblyRow } from "../utils/translationCompile";
import { instructionAt } from "../utils/tutorAnalysis";
import {
  buildInstructionFlow,
  instructionPc,
  numericPc,
} from "../utils/instructionFlow";
import SingleInstructionFlow from "./SingleInstructionFlow";
import "./TutorTypography.css";

export interface InstructionLessonContext {
  isPlaying?: boolean;
  flowDurationMs?: number;
  onPausePlayback?: () => void;
  source?: string;
  rows?: MappedAssemblyRow[];
  selectedAsmIndex?: number | null;
  selectedCLine?: number | null;
  onSelectAsm?: (line: number | null, index: number) => void;
  onJumpToCycle?: (cycle: number) => void;
}
export interface InstructionLessonProps {
  currentData: CycleHistoryItem | null;
  prevData?: CycleHistoryItem | null;
  simulationData?: SimulationResult | null;
  context?: InstructionLessonContext;
}

export default function InstructionLesson({
  currentData,
  prevData,
  simulationData,
  context,
}: InstructionLessonProps) {
  const items = simulationData?.tutor?.asm_instructions;
  const fallbackRows = useMemo(
    () =>
      items?.map((item) => ({
        pc: item.pc ?? "",
        text: item.text,
        sourceLine: item.source_line ?? null,
      })) ?? [],
    [items],
  );
  const rows = context?.rows?.length ? context.rows : fallbackRows;
  const currentPc = instructionPc(currentData);
  const currentIndex = rows.findIndex(
    (row) => numericPc(row.pc) === numericPc(currentPc),
  );
  const line = context?.selectedCLine;
  const selectedIndex =
    context?.selectedAsmIndex != null
      ? context.selectedAsmIndex
      : line != null
        ? currentIndex >= 0 && rows[currentIndex].sourceLine === line
          ? currentIndex
          : rows.findIndex((row) => row.sourceLine === line)
        : currentIndex;
  const row = rows[selectedIndex];
  const item = instructionAt(simulationData?.tutor, row?.pc);
  const flow = useMemo(
    () => buildInstructionFlow(item, currentData, prevData, simulationData),
    [item, currentData, prevData, simulationData],
  );
  const occurrences = useMemo(
    () =>
      row
        ? (simulationData?.history.flatMap((frame, index) =>
            numericPc(instructionPc(frame)) === numericPc(row.pc)
              ? [index]
              : [],
          ) ?? [])
        : [],
    [row, simulationData?.history],
  );
  const target =
    occurrences.find((index) => index >= flow.historyIndex) ??
    occurrences[occurrences.length - 1];
  if (!simulationData)
    return (
      <div className="p-6 text-sm leading-7 text-[var(--ar-text-muted)]">
        코드를 컴파일하고 실행하면 C·ASM 줄별 데이터 흐름을 확인할 수 있습니다.
      </div>
    );
  if (!row || !item)
    return (
      <div className="p-6 text-sm leading-7 text-[var(--ar-text-muted)]">
        {line != null && !row
          ? "선택한 C 줄에 연결된 실행 명령어가 없습니다. 선언·주석·최적화 또는 매핑 정보 누락으로 명령어가 없을 수 있습니다."
          : "C 줄이나 ASM 명령어를 선택하거나 한 클록 진행하세요. 선택한 줄의 해설이 제공되지 않으면 실행 경로를 추정하지 않습니다."}
      </div>
    );
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden text-[var(--ar-text-primary)]">
      <div
        className="flex h-14 min-h-14 shrink-0 items-center justify-between gap-x-3 border-b border-[var(--ar-border)] px-3 py-2"
        data-current-instruction="true"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium text-[var(--ar-text-muted)]">
            {flow.actual ? "현재 명령어" : "선택 명령어"} · {row.pc}
            {row.sourceLine != null ? ` · C L${row.sourceLine}` : ""}
          </p>
          <h3
            title={row.text}
            className="truncate font-mono text-base font-bold"
          >
            {row.text}
          </h3>
        </div>
        <span className="shrink-0 whitespace-nowrap text-[10px] text-[var(--ar-text-muted)]">
          {flow.actual
            ? `CORE clock ${currentData?.clock}`
            : "선택 명령어 · 실행값 미표시"}
        </span>
        {!flow.actual && target != null && context?.onJumpToCycle && (
          <button
            type="button"
            className="rounded bg-[var(--ar-accent)] px-2 py-1 text-[11px] text-white"
            onClick={() => context.onJumpToCycle?.(target + 1)}
          >
            이 명령어의 실행 시점으로 이동
          </button>
        )}
      </div>
      <SingleInstructionFlow
        key={`${row.pc}-${flow.historyIndex}-${context?.flowDurationMs}`}
        flow={flow}
        duration={context?.flowDurationMs}
        onPause={context?.onPausePlayback}
        isPlaying={context?.isPlaying}
      />
    </div>
  );
}
