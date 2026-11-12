import { useEffect, useLayoutEffect, useRef } from 'react';
import type { editor, IDisposable } from 'monaco-editor';
import type { EditorSelection } from '../utils/assistantSource';

export function useAssistantSelection(language: 'c' | 'asm', onSelection?: (selection: EditorSelection | null) => void) {
  const callback = useRef(onSelection);
  useLayoutEffect(() => { callback.current = onSelection; }, [onSelection]);
  const subscriptions = useRef<IDisposable[]>([]);
  useEffect(() => () => subscriptions.current.forEach(item => item.dispose()), []);
  return (instance: editor.IStandaloneCodeEditor) => {
    subscriptions.current.forEach(item => item.dispose());
    const update = () => {
      const model = instance.getModel();
      const range = instance.getSelection();
      callback.current?.(!model || !range || range.isEmpty() ? null : {
        language, document: model.getValue(),
        start: model.getOffsetAt(range.getStartPosition()),
        end: model.getOffsetAt(range.getEndPosition()),
      });
    };
    subscriptions.current = [instance.onDidChangeCursorSelection(update), instance.onDidChangeModelContent(() => callback.current?.(null))];
  };
}
