import { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { arithmeticSource, quickExamples } from './examples';
import { compileError, compileSource } from './compile';
import type { Compilation } from './compile';
import CodeComparison from './CodeComparison';
import StructureInspector from './StructureInspector';
import RuntimeInspector from './RuntimeInspector';
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
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);
  const [exampleMessage, setExampleMessage] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const examplePickerRef = useRef<HTMLDetailsElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const structure = useMemo(() => analyzeCStructures(source), [source]);
  const selectedExample = quickExamples.find(example => example.id === selectedExampleId);

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
    setAnnouncement('');
  }

  function editSource(value?: string) {
    const nextSource = value ?? '';
    setSource(nextSource);
    setResult(null);
    setError('');
    setSelection(null);
    setAnnouncement('');
  }

  function resetEditor() {
    setSource('');
    setFileName('main.c');
    setResult(null);
    setError('');
    setSelection(null);
    setSelectedExampleId(null);
    setExampleMessage('');
    setAnnouncement('편집기를 비웠습니다. 새 코드를 작성하거나 C 파일을 불러오세요.');
    if (examplePickerRef.current) examplePickerRef.current.open = false;
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
    setAnnouncement('');
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

  function applyExample() {
    if (!selectedExample) return;
    replaceSource(selectedExample.source, selectedExample.fileName);
    setAnnouncement(`${selectedExample.title} 예제를 편집기에 넣었습니다. 컴파일하기를 눌러 실행해 보세요.`);
    if (examplePickerRef.current) examplePickerRef.current.open = false;
  }

  async function copyExample() {
    if (!selectedExample) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(selectedExample.source);
      setExampleMessage(`${selectedExample.title} 코드 복사됨`);
    } catch {
      setExampleMessage('클립보드에 복사하지 못했습니다. 브라우저 복사 권한을 확인해 주세요.');
    }
  }

  return (
    <main className="compile-page">
      <div className="compile-heading">
        <div>
          <p className="compile-eyebrow">ARCHREACTOR / COMPILE</p>
          <h1>C → RISC-V 어셈블리</h1>
          <p>컴파일된 어셈블리를 C 코드와 나란히 확인해 보세요.</p>
        </div>
        <span className="compile-profile">RV32IM · 최적화 없음 (-O0)</span>
      </div>
      <div className="compile-toolbar">
        <button className="compile-file-button" title="컴퓨터에서 C 파일 선택" disabled={busy} onClick={() => inputRef.current?.click()}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 5.5h5l1.5 1.7h6.5v8.3h-13z" /><path d="M10 13V9m-1.8 1.8L10 9l1.8 1.8" /></svg>C 파일 선택</button>
        <button disabled={busy} onClick={resetEditor}>에디터 초기화</button>
        <details className="compile-example-picker" ref={examplePickerRef}>
          <summary>빠른 예제</summary>
          <div className="compile-example-menu">
            <div className="compile-example-menu-heading"><strong>자료구조 예제</strong><button type="button" aria-label="빠른 예제 닫기" title="닫기" onClick={() => { if (examplePickerRef.current) examplePickerRef.current.open = false; }}>닫기</button></div>
            <p>예제를 골라 코드를 확인한 뒤 에디터에 넣거나 복사하세요.</p>
            <div className="compile-example-options">{quickExamples.map(example => <button key={example.id} className={selectedExampleId === example.id ? 'is-active' : ''} aria-pressed={selectedExampleId === example.id} onClick={() => { setSelectedExampleId(example.id); setExampleMessage(''); }}><b>{example.title}</b><span>{example.description}</span></button>)}</div>
            {selectedExample && <section className="compile-example-preview" aria-label={`${selectedExample.title} 예제 코드 미리보기`}>
              <div><strong>{selectedExample.title}</strong><button className="compile-example-copy" aria-label={`${selectedExample.title} 코드 복사`} title="코드 복사" onClick={() => void copyExample()}><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="3" width="10" height="12" rx="1.5" /><path d="M13 16v1H4V6h1" /></svg></button></div>
              <pre>{selectedExample.source}</pre>
              <button className="compile-example-apply" disabled={busy} onClick={applyExample}>에디터에 넣기</button>
              <span className="compile-example-message" role="status" aria-live="polite">{exampleMessage}</span>
            </section>}
          </div>
        </details>
        <span className="compile-filename">{fileName}</span>
        <button className="compile-primary" disabled={busy || !source.trim()} onClick={compile}>{busy ? '컴파일 중…' : '컴파일하기 →'}</button>
        <input ref={inputRef} type="file" accept=".c" aria-label="C 파일 열기" hidden onChange={event => {
          void openFile(event.target.files?.[0]); event.target.value = '';
        }} />
      </div>
      {(busy || announcement || !result) && <p className="compile-status" role="status">{busy ? '편집기 내용을 RV32IM으로 컴파일하고 있습니다.' : announcement || `컴파일 대상: ${fileName} · 편집기에 보이는 내용이 컴파일됩니다.`}</p>}
      {error && <pre className="compile-error" role="alert">{error}</pre>}
      <p className="compile-environment-note">RV32IM용 C → 어셈블리 변환 · 표준 입출력(stdio.h, printf)은 지원되지 않습니다. 컴파일 후 아래에서 CORE 실행 기록을 확인할 수 있습니다.</p>
      <div className="compile-workspace">
        <div className="compile-workspace-editor">
          <section className="compile-editor-panel" aria-label="C 웹 IDE">
            <div className="compile-panel-heading"><h2>C 소스 편집</h2><div className="compile-editor-heading-actions"><span>{source.split('\n').length}줄</span><button type="button" title="에디터 내용을 비우고 새로 작성" disabled={busy} onClick={resetEditor}>초기화</button></div></div>
            {structure.functions.length > 1 && <label className="compile-function-jump">함수 이동<select aria-label="편집기 함수 이동" value="" onChange={event => { const fn = structure.functions.find(fn => fn.line === Number(event.target.value)); if (fn) setSelection({ start: fn.line, end: fn.end }); }}><option value="">함수 선택</option>{structure.functions.map(fn => <option key={`${fn.name}-${fn.line}`} value={fn.line}>{fn.name} · {fn.line}–{fn.end}행</option>)}</select></label>}
            <Editor
              height="var(--compile-editor-height, 360px)"
              language="c"
              theme="vs-dark"
              path={fileName}
              value={source}
              onChange={editSource}
              onMount={editor => { editorRef.current = editor; editor.onDidChangeCursorPosition(event => { if (event.source === 'mouse') setSelection({ start: event.position.lineNumber, end: event.position.lineNumber }); }); }}
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
                stickyScroll: { enabled: false },
              }}
            />
          </section>
          {structure.structs.length + structure.arrays.length + structure.diagnostics.length > 0 && <StructureInspector structure={structure} onSelectLine={line => setSelection({ start: line, end: line })} />}
        </div>
        <section className="compile-output-panel" aria-label="C 코드 컴파일 결과">
          {result ? <CodeComparison key={`${fileName}-${source}`} source={source} assembly={result.assembly} selection={selection} onSelectionChange={setSelection} onOpenMemory={() => document.getElementById('compile-runtime')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} /> : <div className="compile-output-placeholder">
            <span>컴파일 결과</span>
            <h2>{busy ? '컴파일 중입니다' : error ? '컴파일 결과를 만들지 못했습니다' : '명령어가 여기에 표시됩니다'}</h2>
            <p>{error ? '위 오류 안내에 따라 편집기 내용을 수정한 뒤 다시 컴파일해 주세요.' : '편집기의 C 코드를 컴파일하면 각 C 코드에서 생성된 명령어를 확인할 수 있습니다.'}</p>
          </div>}
        </section>
      </div>
      {result && <RuntimeInspector key={result.buildId || result.simulationToken || 'compile'} compilation={result} source={source} onSelectLine={line => { setSelection({ start: line, end: line }); editorRef.current?.getDomNode()?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} />}
      <p className="compile-footnote">소스의 수정 내용이 컴파일 요청에 그대로 전달됩니다. CPU 실행 흐름은 데이터패스 페이지에서 볼 수 있습니다.</p>
    </main>
  );
}
