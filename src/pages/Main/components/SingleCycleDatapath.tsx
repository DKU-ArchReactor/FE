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
      <header className="flex h-8 shrink-0 items-center gap-1.5 border-b border-l-2 border-[var(--ar-border)] border-l-[var(--ar-mode-single)] bg-[var(--ar-header-bg)] px-3.5">
        <span className="text-[11px] font-bold text-[var(--ar-mode-single)]">◆</span>
        <h2 className="font-sans text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">
          SINGLE-CYCLE DATAPATH
        </h2>
      </header>
      {props.loadingMessage ? (
        <div className="flex-1 p-6 flex flex-col items-center justify-center gap-3 text-center transition-colors duration-150">
          <div className="w-9 h-9 border-3 border-[var(--ar-mode-single)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-[var(--ar-mode-single)]">{props.loadingMessage}</p>
          <p className="text-xs text-[var(--ar-text-muted)]">컴파일 및 싱글 사이클 시뮬레이션 결과를 준비하고 있습니다.</p>
        </div>
      ) : (
        <InstructionLesson {...props} context={props.lessonContext} />
      )}
    </section>
  );
}
export default SingleCycleDatapath;
