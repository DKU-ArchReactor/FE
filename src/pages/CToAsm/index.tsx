import { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { arithmeticSource } from './examples';
import { compileError, compileSource } from './compile';
import type { Compilation } from './compile';
import CodeComparison from './CodeComparison';
import StructureInspector from './StructureInspector';
import { analyzeCStructures } from './structure';
import type { SourceSelection } from './mapping';
import './compile.css';

export default function CToAsmPage() {
  const [source, setSource] = useState(arithmeticSource);
  const [fileName, setFileName] = useState('main.c');
  const [result, setResult] = useState<Compilation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState<SourceSelection | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const structure = useMemo(() => analyzeCStructures(source), [source]);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (selection) {
      const lastLine = Math.max(selection.start, selection.end);
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [{
        range: { startLineNumber: selection.start, startColumn: 1, endLineNumber: lastLine, endColumn: 1 },
        options: { isWholeLine: true, className: 'compile-monaco-line-highlight', glyphMarginClassName: 'compile-monaco-line-glyph' },
      }]);
      editor.revealLineInCenterIfOutsideViewport(selection.start);
      editor.setPosition({ lineNumber: selection.start, column: 1 });
    } else if (decorationsRef.current.length) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    }
  }, [selection]);

  function replaceSource(text: string, name: string) {
    setSource(text.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, ''));
    setFileName(name);
    setResult(null);
    setError('');
    setSelection(null);
  }

  function editSource(value?: string) {
    const nextSource = value ?? '';
    setSource(nextSource);
    setResult(null);
    setError('');
    setSelection(null);
  }

  async function openFile(file?: File) {
    if (!file) return;
    if (!/\.c$/i.test(file.name)) { setError('.c 파일을 선택해 주세요.'); return; }
    if (file.size > 64 * 1024) { setError('C 파일은 64 KiB 이하로 열어 주세요.'); return; }
    setBusy(true);
    try { replaceSource(await file.text(), file.name); }
    catch { setError('파일을 읽지 못했습니다. UTF-8 C 파일을 다시 선택해 주세요.'); }
    finally { setBusy(false); }
  }

  async function compile() {
    if (requestRef.current || !source.trim()) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError('');
    setResult(null);
    setSelection(null);
    try {
      const compiled = await compileSource(source, controller.signal);
      if (!controller.signal.aborted) setResult(compiled);
    } catch (failure) {
      if (!controller.signal.aborted) setError(compileError(failure));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  return (
    <main className="compile-page">
      <div className="compile-heading">
        <div>
          <p className="compile-eyebrow">ARCHREACTOR / COMPILE</p>
          <h1>C와 RISC-V 어셈블리 대응</h1>
          <p>편집한 C 코드와 컴파일 결과를 줄 단위로 비교해 보세요.</p>
        </div>
        <span className="compile-profile">RV32IM · 최적화 없음 (-O0)</span>
      </div>
      <div className="compile-toolbar">
        <button disabled={busy} onClick={() => inputRef.current?.click()}>C 파일 불러오기</button>
        <span className="compile-filename">{fileName}</span>
        <button className="compile-primary" disabled={busy || !source.trim()} onClick={compile}>{busy ? '컴파일 중…' : '컴파일하기 →'}</button>
        <input ref={inputRef} type="file" accept=".c" aria-label="C 파일 열기" hidden onChange={event => {
          void openFile(event.target.files?.[0]); event.target.value = '';
        }} />
      </div>
      <p className="compile-status" role="status">{busy ? '편집기 내용을 RV32IM으로 컴파일하고 있습니다.' : result ? '컴파일 완료 · C 코드 옆에서 생성된 명령어를 확인하세요.' : `컴파일 대상: ${fileName} · 아래 편집기에 보이는 내용이 컴파일됩니다.`}</p>
      {error && <pre className="compile-error" role="alert">{error}</pre>}
      <div className="compile-editor-layout">
        <section className="compile-editor-panel" aria-label="C 웹 IDE">
          <div className="compile-panel-heading"><h2>C 소스 편집</h2><span>{source.split('\n').length}줄</span></div>
          <Editor
            height="280px"
            language="c"
            theme="vs-dark"
            path={fileName}
            value={source}
            onChange={editSource}
            onMount={editor => { editorRef.current = editor; }}
            loading={<div className="compile-editor-loading">C 편집기를 불러오는 중…</div>}
            options={{
              automaticLayout: true,
              fontSize: 14,
              fontFamily: "'D2Coding', Consolas, monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'off',
              tabSize: 4,
              insertSpaces: true,
              lineNumbers: 'on',
              padding: { top: 12, bottom: 12 },
              readOnly: busy,
            }}
          />
        </section>
      </div>
      {(structure.structs.length + structure.arrays.length > 0) && <StructureInspector structure={structure} onSelectLine={line => setSelection({ start: line, end: line })} />}
      {result ? <div className="compile-result-layout">
        <CodeComparison key={`${fileName}-${source}`} source={source} assembly={result.assembly} selection={selection} onSelectionChange={setSelection} />
      </div> : <section className="compile-output-placeholder" aria-label="컴파일 대기">
        <span>컴파일 결과</span>
        <h2>{busy ? '컴파일 중입니다' : '컴파일 결과가 여기에 표시됩니다'}</h2>
        <p>현재 C 코드를 컴파일하면 실제 생성된 RISC-V 명령어와 소스 줄 연결을 보여줍니다.</p>
      </section>}
      <p className="compile-footnote">소스의 수정 내용이 컴파일 요청에 그대로 전달됩니다. CPU 실행 흐름은 데이터패스 페이지에서 볼 수 있습니다.</p>
    </main>
  );
}
