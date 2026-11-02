import { useRef } from "react";
import Editor from "@monaco-editor/react";

type Props = {
  source: string;
  onChange: (source: string) => void;
  onCompile: () => void;
  onFile: (file: File) => void;
  onReset: () => void;
  busy: boolean;
  error: string;
};

export default function TranslationEditor({ source, onChange, onCompile, onFile, onReset, busy, error }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return <section className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Translation C 편집기">
    <header className="shrink-0 flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
      <strong className="text-xs text-slate-700">C 소스</strong>
      <div className="flex items-center gap-1.5">
        <button type="button" className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50" onClick={() => input.current?.click()} disabled={busy}>파일 열기</button>
        <input ref={input} hidden type="file" accept=".c,text/x-c,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ""; }} />
        <button type="button" className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50" onClick={onReset} disabled={busy}>초기화</button>
        <button type="button" className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50" onClick={onCompile} disabled={busy || !source.trim()}>{busy ? "컴파일 중…" : "컴파일"}</button>
      </div>
    </header>
    <div className="min-h-0 flex-1"><Editor height="100%" language="c" theme="vs-dark" value={source} onChange={(value) => onChange(value ?? "")} options={{ automaticLayout: true, fontSize: 13, fontFamily: "'D2Coding', Consolas, monospace", minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: "off", tabSize: 4, insertSpaces: true, lineNumbers: "on", padding: { top: 10, bottom: 10 }, readOnly: busy, stickyScroll: { enabled: false } }} /></div>
    {error && <pre role="alert" className="max-h-24 shrink-0 overflow-auto border-t border-rose-200 bg-rose-50 px-3 py-2 text-[11px] whitespace-pre-wrap text-rose-700">{error}</pre>}
  </section>;
}
