import { useMemo } from 'react';
import type { CycleHistoryItem, SimulationResult } from '@/type/simulation';
import { getCodeMap, getMemoryRegion } from './simulationView';

interface Props {
  currentData: CycleHistoryItem | null;
  prevData: CycleHistoryItem | null;
  simulationData: SimulationResult | null;
  translationAssembly?: string | null;
  playSpeed?: number;
  cycle?: number;
}

export default function MemorySegmentVisualizer({ currentData, prevData, simulationData }: Props) {
  const codeMap = useMemo(() => getCodeMap(simulationData), [simulationData]);
  const memory = currentData?.global_result.memory_snapshot ?? {};
  const previous = prevData?.global_result.memory_snapshot;
  const groups = new Map<string, [string, string][]>();
  Object.entries(memory).sort(([a], [b]) => Number.parseInt(b, 16) - Number.parseInt(a, 16)).forEach(entry => {
    const region = getMemoryRegion(entry[0], simulationData);
    groups.set(region, [...(groups.get(region) ?? []), entry]);
  });
  const mem = currentData?.stage_activity?.MEM;
  const transfer = mem?.status !== 'error' && (mem?.memory_operation === 'load' || mem?.memory_operation === 'store') ? mem : null;
  const nextPc = currentData?.global_result.current_pc;
  const fetchedPc = currentData?.stage_activity?.IF?.pc;

  return (
    <section className="flex-1 bg-white rounded-2xl border border-slate-200 p-3 flex flex-col min-h-0 overflow-hidden text-xs">
      <h3 className="font-bold mb-2">Memory · 실제 주소</h3>
      <p className="text-[10px] text-slate-500 mb-2">다음 인출 PC: {nextPc ?? '—'}</p>
      {transfer && (
        <p className="p-2 mb-2 rounded bg-sky-50 text-sky-900">
          MEM {transfer.assembly}<br />
          {transfer.memory_operation} {transfer.target_address} · {transfer.memory_operation === 'load' ? transfer.read_data : transfer.write_data}
        </p>
      )}
      <div className="overflow-auto min-h-0 space-y-3">
        <details open>
          <summary className="font-semibold cursor-pointer">Code · 확인된 기계어 {Object.keys(codeMap).length}개</summary>
          {!Object.keys(codeMap).length && <p className="text-slate-400 py-2">기계어 주소 정보 없음</p>}
          {Object.entries(codeMap).sort(([a], [b]) => Number.parseInt(a, 16) - Number.parseInt(b, 16)).map(([address, info]) => (
            <div key={address} className={`font-mono text-[10px] py-1 border-b border-slate-100 ${fetchedPc?.toLowerCase() === address ? 'bg-amber-100' : ''}`}>
              <span>{address}</span> · <span>{info.raw}</span><br /><span>{info.asm}</span>
            </div>
          ))}
        </details>
        {[...groups].map(([region, entries]) => (
          <div key={region}>
            <h4 className="font-semibold mb-1">{region}</h4>
            {entries.map(([address, value]) => {
              const before = previous ? Object.entries(previous).find(([key]) => key.toLowerCase() === address.toLowerCase())?.[1] : undefined;
              const changed = Boolean(previous) && before !== value;
              return <div key={address} className={`font-mono text-[10px] flex justify-between gap-2 py-1 ${changed ? 'bg-amber-100' : ''}`}>
                <span>{address}</span><span title={`부호 있는 10진수: ${Number.parseInt(value, 16) | 0}`}>{value}</span>
              </div>;
            })}
          </div>
        ))}
        {!groups.size && <p className="text-slate-400">현재 데이터 메모리 항목 없음</p>}
        <p className="text-[10px] text-slate-500">영역 이름은 ELF 메타데이터를 사용합니다. 정보가 없는 주소는 영역 미확인으로 표시합니다. 값이 0이라고 BSS로 분류하지 않습니다.</p>
      </div>
    </section>
  );
}
