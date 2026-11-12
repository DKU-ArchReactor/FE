// Isolated local fixture: all fetches are mocked, never forwarded to production.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AiAssistantPopup from '../../src/components/AiAssistantPopup';
import '../../src/index.css';

let supportsSource = true;
const requests: Array<{ editor_source?: { language: string; content: string }; messages: unknown[] }> = [];
localStorage.setItem('access_token', 'local-ui-fixture');
window.fetch = async (input, options) => {
  const url = String(input);
  if (url.endsWith('/assistant/status')) return Response.json({ enabled: true, code: 'LOCAL_FIXTURE', editor_source_supported: supportsSource });
  if (url.endsWith('/assistant/chat')) {
    const body = JSON.parse(String(options?.body));
    requests.push(body);
    window.dispatchEvent(new Event('fixture-request'));
    const source = body.editor_source;
    const text = source ? `**${source.language.toUpperCase()} 원문 수신**\n\n코드 ${[...source.content].length}자\n\n\`\`\`${source.language}\n${source.content}\n\`\`\`` : '**원문 미첨부 확인**';
    return new Response(`data: ${JSON.stringify({type:'delta',text})}\n\ndata: ${JSON.stringify({type:'done',stop_reason:'end_turn',usage:{}})}\n\n`, { headers: { 'Content-Type':'text/event-stream' } });
  }
  throw new Error('Local fixture blocks external requests');
};
function RequestEvidence() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(requests.length);
    window.addEventListener('fixture-request', update);
    return () => window.removeEventListener('fixture-request', update);
  }, []);
  return <section><p>전송 횟수: {count}</p><pre className="whitespace-pre-wrap break-all">{JSON.stringify(requests.at(-1), null, 2)}</pre></section>;
}
function Harness() {
  const [language, setLanguage] = useState<'c'|'asm'>('c');
  const [content, setContent] = useState('int main(void) { return 5 + 3; }');
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(true);
  return <main className="p-6 max-w-xl space-y-4">
    <h1 className="font-bold">PR #18 원문 첨부 로컬 검증 · 모의 응답</h1>
    <p>테스트 코드만 사용합니다. 운영 API·SOLID 호출이 없습니다.</p>
    <button onClick={() => { setLanguage('c'); setContent('int main(void) { return 5 + 3; }'); }}>C 작성</button>{' '}
    <button onClick={() => { setLanguage('asm'); setContent('addi a0, zero, 8'); }}>ASM 작성</button>
    <label className="block">작성 중인 코드<textarea className="block w-full border p-2" rows={5} value={content} onChange={e=>setContent(e.target.value)} /></label>
    <button onClick={() => { supportsSource = false; setRevision(x=>x+1); }}>구버전 서버</button>{' '}
    <button onClick={() => { supportsSource = true; setRevision(x=>x+1); }}>지원 서버</button>{' '}
    <button onClick={()=>setOpen(true)}>대화 열기</button>
    <RequestEvidence />
    <AiAssistantPopup key={revision} authenticated simulation={null} currentData={null} mode="single" beforeExecution={true} editorLanguage={language} editorContent={content} isOpen={open} onClose={()=>setOpen(false)} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
