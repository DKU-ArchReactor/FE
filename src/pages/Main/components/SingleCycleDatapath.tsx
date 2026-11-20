import type { CycleHistoryItem, SimulationResult } from "@/type/simulation";
import InstructionLesson, {
  type InstructionLessonContext,
} from "./InstructionLesson";

interface SingleCycleDatapathProps {
  lessonContext?: InstructionLessonContext;
  currentData: CycleHistoryItem | null;
  prevData?: CycleHistoryItem | null;
  simulationData?: SimulationResult | null;
  loadingMessage?: string | null;
}

export function SingleCycleDatapath(props: SingleCycleDatapathProps) {
  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] text-[var(--ar-text-primary)] shadow-sm"
      aria-label="싱글 사이클 데이터패스"
    >
      <header className="flex h-8 shrink-0 items-center border-b border-l-2 border-[var(--ar-border)] border-l-[var(--ar-mode-single)] bg-[var(--ar-header-bg)] px-3.5">
        <h2 className="text-[11px] font-semibold">싱글 사이클 · 하드웨어 구조</h2>
      </header>
      {props.loadingMessage ? (
        <p className="p-6 text-sm">{props.loadingMessage}</p>
      ) : (
        <InstructionLesson {...props} context={props.lessonContext} />
      )}
    </section>
  );
}
export default SingleCycleDatapath;
