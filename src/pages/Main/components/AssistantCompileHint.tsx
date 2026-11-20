import { useEffect, useRef, useState } from 'react';

type Props = {
  language: 'c' | 'asm';
  onOpen: () => void;
  onDismiss: () => void;
};

export default function AssistantCompileHint({ language, onOpen, onDismiss }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const fadeTimerRef = useRef<number | null>(null);
  const dismissTimerRef = useRef<number | null>(null);

  const clearAllTimers = () => {
    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  };

  const startTimers = () => {
    clearAllTimers();
    // 5초간 표시 후 부드럽게 페이드아웃 (500ms)
    fadeTimerRef.current = window.setTimeout(() => {
      setIsVisible(false);
      dismissTimerRef.current = window.setTimeout(() => {
        onDismiss();
      }, 500);
    }, 5000);
  };

  useEffect(() => {
    // 마운트 후 자연스러운 페이드인 트랜지션 (500ms)
    const animFrame = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    startTimers();

    return () => {
      cancelAnimationFrame(animFrame);
      clearAllTimers();
    };
  }, [onDismiss]);

  const handleMouseEnter = () => {
    clearAllTimers();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    startTimers();
  };

  return (
    <aside
      id="assistant-compile-hint"
      aria-label="컴파일 후 어시스턴트 안내"
      onClick={onOpen}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`absolute right-0 top-full mt-4 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--ar-accent)] bg-white dark:bg-[#252526] px-3 py-2.5 shadow-xl text-[#1F2328] dark:text-gray-100 cursor-pointer select-none transition-all duration-500 ease-in-out ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
      }`}
    >
      <span aria-hidden="true" className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 border-l border-t border-[var(--ar-accent)] bg-white dark:bg-[#252526]" />
      <p role="status" className="text-xs leading-relaxed text-[#1F2328] dark:text-gray-200">
        어시스턴트를 이용해 {language === 'c' ? '컴파일된' : '어셈블된'} 코드의 흐름을 이해해 보세요.
      </p>
    </aside>
  );
}
