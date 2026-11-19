import type {TutorInstruction} from '../utils/tutorAnalysis';

export default function InstructionFormat({format}: {format?: TutorInstruction['instruction_format']}) {
  if (!format) return null;
  return <details className="tutor-disclosure text-xs leading-6">
    <summary className="cursor-pointer font-semibold">{format.name}형 명령어 포맷 <span className="font-mono text-[var(--ar-text-muted)]">32 bit</span></summary>
    <div className="space-y-3">
      <p>{format.description}</p>
      <div className="overflow-x-auto rounded-md border border-[var(--ar-border)]">
        <div className="flex min-w-[540px]" aria-label="기계어 비트 필드">
          {format.fields.map(field => <div key={field.name} style={{flex: field.width, minWidth: 72}} className="border-r border-[var(--ar-border)] p-2 text-center last:border-0" title={`${field.name}: ${field.role}`}>
            <span className="block text-[10px] text-[var(--ar-text-muted)]">{field.high === field.low ? field.high : `${field.high}:${field.low}`}</span>
            <strong className="block font-mono text-[11px]">{field.name.replace('imm[', 'i[')}</strong>
            <span className="block break-all font-mono text-[10px] text-[var(--ar-accent)]">{field.binary}</span>
          </div>)}
        </div>
      </div>
      <dl className="grid gap-2 @sm:grid-cols-2">{format.fields.map(field => <div key={field.name} className="rounded bg-[var(--ar-header-bg)] px-3 py-2">
        <dt className="font-mono font-semibold">{field.name} = {field.value}</dt><dd className="text-[var(--ar-text-muted)]">{field.role}</dd>
      </div>)}</dl>
      {format.immediate != null && <p>재조합한 값: <code>{format.immediate}</code>{format.name === 'B' || format.name === 'J' ? '바이트 (현재 PC 기준 변위)' : format.name === 'U' ? ' (하위 12비트가 0인 값)' : ''}</p>}
      <p className="text-[var(--ar-text-muted)]">기계어 <code>{format.word}</code> · {format.note}</p>
    </div>
  </details>;
}
