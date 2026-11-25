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
  playMode?: "continuous" | "singleCycle";
  playbackFinished?: boolean;
  playbackRevision?: number;
  currentCycle?: number;
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
  if (!simulationData || !row || !item) {
    const emptyFlow = buildInstructionFlow(undefined, null, null, null);
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden text-[var(--ar-text-primary)]">
        <SingleInstructionFlow
          flow={emptyFlow}
          duration={context?.flowDurationMs}
          isPlaying={false}
          isCompiled={Boolean(simulationData)}
          playMode={context?.playMode}
          currentCycle={context?.currentCycle ?? currentData?.clock ?? 0}
          playbackRevision={context?.playbackRevision}
          playbackFinished={true}
        />
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden text-[var(--ar-text-primary)]">
      <SingleInstructionFlow
        flow={flow}
        instructionText={row.text}
        duration={context?.flowDurationMs}
        onPause={context?.onPausePlayback}
        isPlaying={context?.isPlaying}
        isCompiled={true}
        playMode={context?.playMode}
        currentCycle={context?.currentCycle ?? currentData?.clock}
        playbackRevision={context?.playbackRevision}
        playbackFinished={flow.actual && context?.playbackFinished}
        executionStatus={
          flow.actual && flow.historyIndex === simulationData.history.length - 1
            ? simulationData.execution_status
            : undefined
        }
      />
    </div>
  );
}
