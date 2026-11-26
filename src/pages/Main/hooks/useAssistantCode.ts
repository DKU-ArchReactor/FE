import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { validateBasicC } from '@/api/build';
import type { CodeLanguage, CodeProgram } from '../utils/assistantCode';

export interface CodeSnapshot {
  sources: Record<CodeLanguage, string>;
  identity: string;
  language: CodeLanguage;
}

/** Capture both documents, and share application/undo across desktop and mobile. */
export function useAssistantCode(sources: Record<CodeLanguage, string>, identity: string, language: CodeLanguage, busy: boolean, onChange: (program: CodeProgram) => void, appliedIdentity = identity) {
  const { c, asm } = sources;
  const snapshot = useMemo(() => ({ sources: { c, asm }, identity, language }), [c, asm, identity, language]);
  const current = useRef(snapshot);
  const busyRef = useRef(busy);
  const validation = useRef<AbortController | null>(null);
  const [undo, setUndo] = useState<{ before: string; after: string; language: CodeLanguage; identity: string } | null>(null);
  useLayoutEffect(() => {
    current.current = snapshot;
    busyRef.current = busy;
    if (busy) validation.current?.abort();
  }, [snapshot, busy]);
  useEffect(() => () => validation.current?.abort(), []);
  // Invalidate on a source/identity change, including edits later restored to the same text.
  if (undo && (sources[undo.language] !== undo.after || identity !== undo.identity)) setUndo(null);
  const apply = async (program: CodeProgram, expected: CodeSnapshot, signal?: AbortSignal): Promise<boolean> => {
    if (signal?.aborted || busyRef.current || current.current !== expected || !program.source.trim()) return false;
    validation.current?.abort();
    const controller = new AbortController();
    validation.current = controller;
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      if (program.language === 'c') {
        const result = await validateBasicC(program.source, controller.signal);
        if (!result.valid) {
          const diagnostic = result.diagnostics[0];
          throw new Error(diagnostic
            ? `${diagnostic.line}행 ${diagnostic.column}열: ${diagnostic.message} C 코드에 적용하지 않았습니다.`
            : '기초 C 지원 범위를 벗어나 적용하지 않았습니다. main 하나와 입출력 없는 예제로 다시 요청하세요.');
        }
      }
      // An edit, mode/file switch, compile, or newer application can win the race.
      if (controller.signal.aborted || busyRef.current || current.current !== expected) return false;
      const before = sources[program.language];
      if (program.source !== before) {
        setUndo({ before, after: program.source, language: program.language, identity: appliedIdentity });
      }
      onChange(program);
      return true;
    } finally {
      signal?.removeEventListener('abort', cancel);
      if (validation.current === controller) validation.current = null;
    }
  };
  const canUndo = !busy && undo !== null && sources[undo.language] === undo.after && identity === undo.identity;
  return {
    snapshot, apply, canUndo, disabled: busy,
    undo: () => {
      if (!canUndo || !undo) return;
      onChange({ language: undo.language, source: undo.before });
      setUndo(null);
    },
  };
}
