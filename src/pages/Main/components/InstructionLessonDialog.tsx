import {useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import InstructionLesson, {type InstructionLessonProps} from './InstructionLesson';

export default function InstructionLessonDialog({onClose, ...props}: InstructionLessonProps & {onClose: () => void}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      queueMicrotask(() => {if (opener instanceof HTMLElement && opener.isConnected) opener.focus({preventScroll: true});});
    };
  }, []);
  return createPortal(<dialog ref={dialogRef} onCancel={event => {event.preventDefault(); onClose();}}
    className="m-auto h-[94dvh] max-h-[94dvh] w-[min(1400px,96vw)] max-w-[96vw] overflow-hidden rounded-xl border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] p-0 text-[var(--ar-text-primary)] shadow-2xl backdrop:bg-black/40"
    aria-labelledby="instruction-lesson-title">
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-5 py-3">
        <div><h2 id="instruction-lesson-title" className="text-sm font-semibold">C·ASM 통합 설명</h2><p className="mt-1 text-xs text-[var(--ar-text-muted)]">한 줄의 코드에서 명령어와 실제 데이터 흐름까지</p></div>
        <button type="button" onClick={onClose} aria-label="통합 설명 닫기" className="shrink-0 whitespace-nowrap rounded-md border border-[var(--ar-border)] px-3 py-2 text-xs">닫기</button>
      </header>
      <InstructionLesson {...props} includeTutor/>
    </div>
  </dialog>, document.body);
}
