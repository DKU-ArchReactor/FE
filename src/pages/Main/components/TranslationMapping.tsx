import { useMemo } from "react";
import { mapAssembly } from "./translationCompile";

type Props = { source: string; assembly: string; busy: boolean; error: string };

export default function TranslationMapping({ source, assembly, busy, error }: Props) {
  const sourceLines = source.split(/\r?\n/);
  const rows = useMemo(() => mapAssembly(assembly, sourceLines.length), [assembly, sourceLines.length]);
  const groups = useMemo(() => {
    const result: { line: number; instructions: string[] }[] = [];
    for (const row of rows) {
      const previous = result.at(-1);
      if (previous?.line === row.sourceLine) previous.instructions.push(row.text);
      else result.push({ line: row.sourceLine, instructions: [row.text] });
    }
    return result;
  }, [rows]);

  return <section className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="C 코드와 어셈블리 매핑">
    <header className="grid shrink-0 grid-cols-2 overflow-y-hidden [scrollbar-gutter:stable] border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700"><div className="px-3 py-2">C 코드</div><div className="border-l border-slate-200 px-3 py-2">RISC-V 어셈블리</div></header>
    {!assembly ? <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-xs text-slate-400">{busy ? "컴파일 결과를 불러오는 중…" : error ? "컴파일 결과를 표시할 수 없습니다." : "C 코드를 컴파일하면 줄별 매핑이 여기에 표시됩니다."}</div> : <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]" role="region" aria-label="컴파일 줄 매핑">
      {groups.map((group, index) => <div className="grid grid-cols-2 border-b border-slate-100 text-xs last:border-b-0" key={`${group.line}-${index}`}>
        <div className="min-w-0 bg-slate-50/60 px-2 py-2 font-mono leading-5"><span className="mr-2 select-none text-slate-400">{group.line}</span><code className="whitespace-pre-wrap break-words">{sourceLines[group.line - 1]}</code></div>
        <div className="min-w-0 border-l border-slate-200 px-2 py-2 font-mono leading-5">{group.instructions.map((instruction, instructionIndex) => <div className="whitespace-pre-wrap break-words text-blue-800" key={`${instruction}-${instructionIndex}`}>{instruction}</div>)}</div>
      </div>)}
      {groups.length === 0 && <p className="p-4 text-xs text-slate-500">줄 정보가 포함된 어셈블리 결과가 없습니다.</p>}
    </div>}
  </section>;
}
