import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AiAssistantPopup from '../../src/components/AiAssistantPopup';
import { useAssistantCode } from '../../src/pages/Main/hooks/useAssistantCode';
import '../../src/index.css';
function Harness() {
  const [source, setSource] = useState('int main(void) { return 0; }');
  const [language, setLanguage] = useState<'c' | 'asm'>('c');
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState('file-one');
  const [open, setOpen] = useState(true);
  const editor = useAssistantCode(source, identity, language, busy, setSource);
  return <>
    <textarea aria-label="C 원문" value={source} onChange={e => setSource(e.target.value)} />
    <button onClick={() => setLanguage(language === 'c' ? 'asm' : 'c')}>switch editor</button>
    <button onClick={() => setBusy(!busy)}>toggle busy</button>
    <button onClick={() => setIdentity('file-two')}>switch file</button>
    <button onClick={() => setOpen(true)}>open chat</button>
    <div style={{ width: 440, height: 700 }}>
      <AiAssistantPopup inline codeEditor={editor} editorContent={source} editorLanguage={language}
        authenticated simulation={null} currentData={null} mode="pipeline" beforeExecution
        isOpen={open} onClose={() => setOpen(false)} />
    </div>
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Harness /></React.StrictMode>);
