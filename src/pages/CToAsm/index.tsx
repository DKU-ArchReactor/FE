import { useEffect, useRef, useState } from 'react';
import { arithmeticSource, examples } from './examples';
import { compileError, compileSource } from './compile';
import type { Compilation } from './compile';
import CodeComparison from './CodeComparison';
import StructureDiagram from './StructureDiagram';
import type { SourceSelection } from './mapping';
import './compile.css';

export default function CToAsmPage() {
  const [source, setSource] = useState(arithmeticSource);
  const [fileName, setFileName] = useState('arithmetic.c');
  const [result, setResult] = useState<Compilation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [exampleId, setExampleId] = useState('arithmetic');
  const [selection, setSelection] = useState<SourceSelection | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  function replaceSource(text: string, name: string) {
    setSource(text.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, ''));
    setFileName(name);
    setResult(null);
    setError('');
    setSelection(null);
  }

  async function openFile(file?: File) {
    if (!file) return;
    if (!/\.c$/i.test(file.name)) { setError('.c 파일을 선택해 주세요.'); return; }
    if (file.size > 64 * 1024) { setError('학습용 C 파일은 64 KiB 이하로 열어 주세요.'); return; }
    setBusy(true);
    try { replaceSource(await file.text(), file.name); setExampleId(''); }
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
          <h1>C 코드가 명령어가 되는 순간</h1>
          <p>C 한 줄이 어떤 명령어로 바뀌었는지, 연결된 블록으로 읽어 보세요.</p>
        </div>
        <span className="compile-profile">RV32IM · 최적화 없음 (-O0)</span>
      </div>
      <div className="compile-toolbar">
        <button disabled={busy} onClick={() => inputRef.current?.click()}>C 파일 열기</button>
        <select aria-label="학습 예제" disabled={busy} value={exampleId} onChange={event => {
          const example = examples.find(item => item.id === event.target.value);
          if (example) { replaceSource(example.source, `${example.id}.c`); setExampleId(example.id); }
        }}>
          <option value="" disabled>업로드한 파일</option>
          {examples.map(example => <option key={example.id} value={example.id}>{example.name}</option>)}
        </select>
        <span className="compile-filename">{fileName}</span>
        <button className="compile-primary" disabled={busy || !source.trim()} onClick={compile}>{busy ? '처리 중…' : '컴파일하기 →'}</button>
        <input ref={inputRef} type="file" accept=".c" aria-label="C 파일 열기" hidden onChange={event => {
          void openFile(event.target.files?.[0]); event.target.value = '';
        }} />
      </div>
      <p className="compile-status" role="status">{busy ? '파일과 컴파일 결과를 준비하고 있습니다.' : result ? '컴파일 완료 · 아래에서 결과를 확인하세요.' : '예제를 컴파일하거나 UTF-8 C 파일을 열어 시작하세요.'}</p>
      {error && <pre className="compile-error" role="alert">{error}</pre>}
      <CodeComparison key={source + Boolean(result)} source={source} assembly={result?.assembly} selection={selection} onSelectionChange={setSelection} />
      <StructureDiagram example={examples.find(example => example.id === exampleId)} selection={selection} onSelect={setSelection} />
      <p className="compile-footnote">이 페이지는 컴파일 결과를 비교합니다. CPU 내부 실행은 데이터패스 페이지에서 확인할 수 있습니다.</p>
      {result && <details className="compile-log" onToggle={event => setShowDetails(event.currentTarget.open)}><summary>상세 정보</summary>{showDetails && <><details><summary>컴파일 로그</summary><pre>{result.log || '추가 메시지가 없습니다.'}</pre></details><details><summary>원본 어셈블리</summary><pre>{result.assembly}</pre></details></>}</details>}
    </main>
  );
}

