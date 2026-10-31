import type { ReactNode } from 'react';
import type { CArray, CField, CStructure, CStruct } from './structure';
import StructureGraph from './StructureGraph';

type Props = { structure: CStructure; onSelectLine: (line: number) => void };

function SourceRef({ line, children, onSelectLine }: { line: number; children: ReactNode; onSelectLine: (line: number) => void }) {
  return <button className="compile-source-ref" onClick={() => onSelectLine(line)}><span>C {line}</span>{children}</button>;
}

function StructCard({ type, onSelectLine }: { type: CStruct; onSelectLine: (line: number) => void }) {
  const recursiveFields = type.fields.filter(field => field.pointer && new RegExp(`\\b${type.name}\\b`).test(field.type));
  const topology = recursiveFields.length === 0 ? '포인터 연결 필드 없음' : recursiveFields.map(field => `${field.name} → 실행 중 대상 미확정`).join(' · ');
  return <article className="compile-structure-card">
    <SourceRef line={type.line} onSelectLine={onSelectLine}><strong>struct {type.name}</strong><span>{type.instances.length ? `인스턴스 ${type.instances.join(', ')}` : '인스턴스 선언 없음'}</span></SourceRef>
    <ul>{type.fields.map((field: CField) => <li key={`${field.name}-${field.line}`}><SourceRef line={field.line} onSelectLine={onSelectLine}><code>{field.type} {field.name}{field.array}</code></SourceRef></li>)}</ul>
    {recursiveFields.length > 0 && <p className="compile-structure-topology">자기 참조 포인터: {topology}</p>}
  </article>;
}

function ArrayCard({ array, onSelectLine }: { array: CArray; onSelectLine: (line: number) => void }) {
  const size = array.dimensions[0];
  const numericSize = Number(size);
  const unknownSize = size === '?';
  const indices = Number.isInteger(numericSize) && numericSize >= 0
    ? numericSize <= 8 ? Array.from({ length: numericSize }, (_, index) => String(index)) : ['0', '1', '2', '3', '…', String(numericSize - 1)]
    : ['0', '1', '…', `${size}-1`];
  return <article className="compile-structure-card">
    <SourceRef line={array.line} onSelectLine={onSelectLine}><strong>{array.type} {array.name}</strong><span>{array.dimensions.map(dimension => `[${dimension}]`).join('')}</span></SourceRef>
    {unknownSize ? <p className="compile-structure-topology">선언에 길이가 생략됐습니다. 실제 크기는 컴파일 후 실행 정보에서 확인하세요.</p> : <div className="compile-array-indices" aria-label={`${array.name} 배열 원소`}>{indices.map((index, position) => <span key={`${position}-${index}`}>{index === '…' ? '…' : `${array.name}[${index}]`}</span>)}</div>}
    {array.dimensions.length > 1 && <p className="compile-structure-topology">첫 번째 차원의 인덱스를 표시합니다.</p>}
  </article>;
}

export default function StructureInspector({ structure, onSelectLine }: Props) {
  const summary = [structure.structs.length ? `struct ${structure.structs.length}개` : '', structure.arrays.length ? `배열 ${structure.arrays.length}개` : ''].filter(Boolean).join(' · ');
  return <details className="compile-structure" aria-label="현재 C 코드의 자료구조">
    <summary className="compile-structure-summary"><span>코드에서 찾은 구조</span><span>{summary}</span></summary>
    <div className="compile-structure-list">
      {structure.diagnostics.map(message => <p className="compile-warning" key={message}>{message}</p>)}
      <StructureGraph nodes={structure.structs.flatMap(type => type.instances.map(name => ({ id: `${type.name}:${name}`, title: name, subtitle: `struct ${type.name} · 선언 기준`, line: type.line, fields: type.fields.map(field => ({ name: field.name, value: field.type })) })))} edges={structure.links.flatMap(link => {
        const type = structure.structs.find(candidate => candidate.instances.includes(link.from) && candidate.instances.includes(link.to));
        return type ? [{ from: `${type.name}:${link.from}`, to: `${type.name}:${link.to}`, label: link.field }] : [];
      })} onSelectLine={onSelectLine} />
      {structure.structs.map(type => <StructCard key={type.name} type={type} onSelectLine={onSelectLine} />)}
      {structure.arrays.map((array, index) => <ArrayCard key={`${array.name}-${array.line}-${index}`} array={array} onSelectLine={onSelectLine} />)}
      {structure.links.length > 0 && <section className="compile-structure-links" aria-label="선언 초기값의 포인터 연결">
        <h3>초기값에 적힌 포인터 연결</h3>
        {structure.links.map((link, index) => <SourceRef key={`${link.from}-${link.field}-${link.to}-${index}`} line={link.line} onSelectLine={onSelectLine}><code>{link.from}.{link.field}</code><span className="compile-link-arrow">→</span><code>{link.to}</code></SourceRef>)}
        <p>소스의 초기화 표현을 읽은 결과입니다. 이후 대입이나 반복 실행에 따른 연결 상태는 보여주지 않습니다.</p>
      </section>}
    </div>
    <p className="compile-structure-note">선언에 적힌 구조만 표시합니다. 실제 주소와 실행 중 값은 추측하지 않습니다.</p>
  </details>;
}
