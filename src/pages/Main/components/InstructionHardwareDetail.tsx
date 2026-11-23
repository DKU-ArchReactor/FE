import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { buildInstructionFlow } from "../utils/instructionFlow";
import { AluDetailView, DecoderDetailView, PcSelectDetailView } from "./HardwareDetailViews";

export default function InstructionHardwareDetail({
  flow,
  unit,
  onClose,
}: {
  flow: ReturnType<typeof buildInstructionFlow>;
  unit: "alu" | "pc-select" | "decoder";
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="hardware-detail-title"
      className="fixed inset-0 m-auto max-h-[90vh] w-[min(960px,94vw)] overflow-auto rounded-2xl border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] p-0 text-[var(--ar-text-primary)] shadow-2xl backdrop:bg-black/45"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--ar-border)] bg-[var(--ar-panel-bg)] px-6 py-4">
        <div>
          <p className="text-sm text-[var(--ar-text-muted)]">
            {flow.op.toUpperCase()} · {flow.pc} ·{" "}
            {flow.actual ? "선택 명령어의 실행 기록" : "실행값 미제공"}
          </p>
          <h2 id="hardware-detail-title" className="mt-1 text-xl font-bold">
            {unit === "alu"
              ? "ALU는 어떻게 계산할까?"
              : unit === "decoder"
                ? "32비트 명령어는 어떻게 해독할까?"
                : "다음 PC를 만드는 구성 요소"}
          </h2>
        </div>
        <button
          autoFocus
          onClick={onClose}
          className="shrink-0 rounded-lg border border-[var(--ar-border)] px-4 py-2 text-base hover:bg-[var(--ar-header-bg)]"
        >
          닫기
        </button>
      </header>
      <div className="space-y-5 p-6 text-base leading-7">
        {unit === "alu" ? (
          <AluDetailView flow={flow} />
        ) : unit === "decoder" ? (
          <DecoderDetailView flow={flow} />
        ) : (
          <PcSelectDetailView flow={flow} />
        )}
        <p className="border-t border-[var(--ar-border)] pt-4 text-sm text-[var(--ar-text-muted)]">
          입력과 CORE 결과는 선택한 실행 기록입니다. 내부 회로는 동작 원리를
          설명하는 교육 모델이며, CORE의 물리 회로나 게이트 전파 기록을 뜻하지
          않습니다.
        </p>
      </div>
    </dialog>,
    document.body
  );
}
