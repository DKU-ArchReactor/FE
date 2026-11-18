import { useEffect, useRef, useState } from 'react';
import { getBuildLog } from '@/api/build';
import type { BuildCompileResponse, BuildLog } from '@/type/build';

export default function BuildStatusBar({ result, busy, hasSimulation }: {
  result: BuildCompileResponse | null; busy: boolean; hasSimulation: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [savedLog, setSavedLog] = useState<BuildLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    request.current?.abort();
    setSavedLog(null); setError(''); setLoading(false); setOpen(false);
    return () => request.current?.abort();
  }, [result]);
  async function loadLog() {
    if (!result?.build_id) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError('');
    try {
      const log = await getBuildLog(result.build_id, controller.signal);
      if (!controller.signal.aborted) setSavedLog(log);
    } catch {
      if (!controller.signal.aborted) setError('저장된 로그를 불러오지 못했습니다. 로그인과 빌드 접근 권한을 확인해 주세요.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  return <section aria-label="빌드 결과" className="shrink-0 border-b border-[var(--ar-border)] bg-[var(--ar-panel-bg)] px-4 py-2 text-xs text-[var(--ar-text-primary)]">
    <div className="flex flex-wrap items-center gap-3">
      <strong>{busy ? (result?.status === 'success' ? '컴파일 완료 · 실행 결과를 불러오는 중' : '컴파일 중')
        : !result ? '빌드 대기' : result.status === 'success' ? '컴파일 완료' : '컴파일 실패'}</strong>
      <span className="text-[var(--ar-text-muted)]">{hasSimulation ? '실행 결과 기준 매핑' : result?.analysis ? '실행 전 명령어 미리보기' : '컴파일하면 명령어 매핑과 로그를 확인할 수 있습니다.'}</span>
      <button type="button" disabled={!result} onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="ml-auto rounded border border-[var(--ar-border)] px-3 py-1 disabled:opacity-40">빌드 로그 {open ? '닫기' : '보기'}</button>
    </div>
    {result?.analysis_error && <p role="status" className="mt-2 text-amber-700 dark:text-amber-300">컴파일은 완료됐지만 명령어 미리보기를 만들지 못했습니다. 실행 결과의 매핑은 별도로 확인할 수 있습니다.</p>}
    {result?.analysis && !result.analysis.mapping_available && <p className="mt-2 text-[var(--ar-text-muted)]">대응하는 C 소스 줄 정보가 없습니다. 최적화로 제거된 줄이나 시작 코드는 연결되지 않을 수 있습니다.</p>}
    {open && result && <div className="mt-2 rounded border border-[var(--ar-border)] p-3">
      {result.build_id ? <button type="button" disabled={loading} onClick={loadLog} className="mb-2 text-blue-600 disabled:opacity-50">{loading ? '불러오는 중…' : '저장된 로그 다시 불러오기'}</button>
        : <p className="mb-2 text-[var(--ar-text-muted)]">이번 컴파일의 로그입니다. 저장된 파일로 컴파일하면 나중에도 조회할 수 있습니다.</p>}
      {error && <p role="alert" className="text-rose-600">{error}</p>}
      {savedLog?.streams_available ? <div className="grid gap-2 md:grid-cols-2">
        <div><strong>표준 출력</strong><pre className="max-h-40 overflow-auto whitespace-pre-wrap">{savedLog.stdout || '(없음)'}</pre></div>
        <div><strong>오류·경고</strong><pre className="max-h-40 overflow-auto whitespace-pre-wrap">{savedLog.stderr || '(없음)'}</pre></div>
      </div> : <><p className="text-[var(--ar-text-muted)]">{savedLog ? '이전 빌드의 통합 로그입니다. 출력과 오류가 분리되어 있지 않습니다.' : '컴파일 통합 로그'}</p>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap">{savedLog?.log ?? result.log ?? '(없음)'}</pre></>}
    </div>}
  </section>;
}
