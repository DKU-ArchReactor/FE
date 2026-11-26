import { useLayoutEffect, useMemo, useRef, useState } from 'react';

export interface CodeSnapshot {
  source: string;
  identity: string;
  language: 'c' | 'asm';
}

/** Share application/undo across desktop and mobile assistants. */
export function useAssistantCode(source: string, identity: string, language: 'c' | 'asm', busy: boolean, onChange: (source: string) => void, appliedIdentity = identity) {
  const snapshot = useMemo(() => ({ source, identity, language }), [source, identity, language]);
  const current = useRef(snapshot);
  const [undo, setUndo] = useState<{ before: string; after: string; identity: string } | null>(null);
  useLayoutEffect(() => { current.current = snapshot; }, [snapshot]);
  useLayoutEffect(() => {
    if (undo && (source !== undo.after || identity !== undo.identity)) setUndo(null);
  }, [source, identity, undo]);
  const apply = (code: string, expected: CodeSnapshot): boolean => {
    if (busy || language !== 'c' || current.current !== expected || !code.trim()) return false;
    if (code === source) return true;
    setUndo({ before: source, after: code, identity: appliedIdentity });
    onChange(code);
    return true;
  };
  const canUndo = !busy && language === 'c' && undo !== null && source === undo.after && identity === undo.identity;
  return {
    snapshot, apply, canUndo, disabled: busy || language !== 'c',
    undo: () => {
      if (!canUndo || !undo) return;
      onChange(undo.before);
      setUndo(null);
    },
  };
}
