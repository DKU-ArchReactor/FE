type Props = {
  language: 'c' | 'asm';
  onOpen: () => void;
  onDismiss: () => void;
};

export default function AssistantCompileHint({ language, onOpen, onDismiss }: Props) {
  return (
    <aside id="assistant-compile-hint" aria-label="컴파일 후 어시스턴트 안내"
      className="absolute right-0 top-full mt-3 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--ar-accent)] bg-white dark:bg-[#252526] p-3 shadow-xl text-[#1F2328] dark:text-gray-100">
      <span aria-hidden="true" className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 border-l border-t border-[var(--ar-accent)] bg-white dark:bg-[#252526]" />
      <div className="flex items-start gap-2">
        <p role="status" className="flex-1 text-xs leading-relaxed">
          어시스턴트를 이용해 {language === 'c' ? '컴파일된' : '어셈블된'} 코드의 흐름을 이해해 보세요.
        </p>
        <button type="button" onClick={onDismiss} aria-label="어시스턴트 안내 닫기"
          className="shrink-0 rounded px-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">×</button>
      </div>
      <button type="button" onClick={onOpen}
        className="mt-2 text-xs font-semibold text-[var(--ar-accent)] hover:underline">어시스턴트 열기 →</button>
    </aside>
  );
}
