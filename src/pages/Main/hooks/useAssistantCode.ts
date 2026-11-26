import { useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  const [undo, setUndo] = useState<{ before: string; after: string; language: CodeLanguage; identity: string } | null>(null);
  useLayoutEffect(() => { current.current = snapshot; }, [snapshot]);
  // Invalidate on a source/identity change, including edits later restored to the same text.
  if (undo && (sources[undo.language] !== undo.after || identity !== undo.identity)) setUndo(null);
  const apply = (program: CodeProgram, expected: CodeSnapshot): boolean => {
    if (busy || current.current !== expected || !program.source.trim()) return false;
    const before = sources[program.language];
    if (program.source !== before) {
      setUndo({ before, after: program.source, language: program.language, identity: appliedIdentity });
    }
    onChange(program);
    return true;
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
