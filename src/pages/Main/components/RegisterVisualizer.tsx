import React, { useState } from 'react';

interface RegisterVisualizerProps {
  registers: Record<string, string>;
  prevRegisters?: Record<string, string>;
}

// 레지스터 메타데이터: ABI 이름, 특수 목적 및 사전 배정 여부
interface RegisterMeta {
  abi: string;
  desc?: string;
  isPreset?: boolean;
  presetTag?: string;
}

const REGISTER_METAS: Record<string, RegisterMeta> = {
  x0: { abi: 'zero', desc: 'Hardwired 0 (항상 0 고정)', isPreset: true, presetTag: 'Fixed 0' },
  x1: { abi: 'ra', desc: 'Return Address (함수 반환 주소)' },
  x2: { abi: 'sp', desc: 'Stack Pointer (초기 스택 포인터: 0x7FFFEFFC)', isPreset: true, presetTag: 'Init SP' },
  x3: { abi: 'gp', desc: 'Global Pointer (전역 포인터)' },
  x4: { abi: 'tp', desc: 'Thread Pointer (스레드 포인터)' },
  x5: { abi: 't0', desc: 'Temporary (임시)' },
  x6: { abi: 't1', desc: 'Temporary (임시)' },
  x7: { abi: 't2', desc: 'Temporary (임시)' },
  x8: { abi: 's0', desc: 'Saved register / Frame Pointer' },
  x9: { abi: 's1', desc: 'Saved register' },
  x10: { abi: 'a0', desc: 'Function argument / Return value' },
  x11: { abi: 'a1', desc: 'Function argument / Return value' },
  x12: { abi: 'a2', desc: 'Function argument' },
  x13: { abi: 'a3', desc: 'Function argument' },
  x14: { abi: 'a4', desc: 'Function argument' },
  x15: { abi: 'a5', desc: 'Function argument / Temp' },
  x16: { abi: 'a6', desc: 'Function argument' },
  x17: { abi: 'a7', desc: 'Function argument' },
  x18: { abi: 's2', desc: 'Saved register' },
  x19: { abi: 's3', desc: 'Saved register' },
  x20: { abi: 's4', desc: 'Saved register' },
  x21: { abi: 's5', desc: 'Saved register' },
  x22: { abi: 's6', desc: 'Saved register' },
  x23: { abi: 's7', desc: 'Saved register' },
  x24: { abi: 's8', desc: 'Saved register' },
  x25: { abi: 's9', desc: 'Saved register' },
  x26: { abi: 's10', desc: 'Saved register' },
  x27: { abi: 's11', desc: 'Saved register' },
  x28: { abi: 't3', desc: 'Temporary' },
  x29: { abi: 't4', desc: 'Temporary' },
  x30: { abi: 't5', desc: 'Temporary' },
  x31: { abi: 't6', desc: 'Temporary' },
};

const RegisterVisualizer: React.FC<RegisterVisualizerProps> = ({
  registers,
  prevRegisters,
}) => {
  const [onlyNonZero, setOnlyNonZero] = useState(false);

  // 0~31 키 생성
  const regKeys = Array.from({ length: 32 }, (_, i) => `x${i}`);

  // 값 유무(0이 아닌 유효 값) 기준 스마트 정렬:
  // 1) 값이 있는 레지스터가 상단으로 이동
  // 2) 동일 그룹 내에서는 x 번호 순서(0, 1, 2...)로 안정적 정렬
  const sortedKeys = [...regKeys].sort((a, b) => {
    const valA = registers[a] || '0x00000000';
    const valB = registers[b] || '0x00000000';
    const hasValA = valA !== '0x00000000';
    const hasValB = valB !== '0x00000000';

    if (hasValA && !hasValB) return -1;
    if (!hasValA && hasValB) return 1;

    // x 뒤의 숫자 기준 오름차순 정렬
    const numA = parseInt(a.slice(1), 10);
    const numB = parseInt(b.slice(1), 10);
    return numA - numB;
  });

  const filteredKeys = onlyNonZero
    ? sortedKeys.filter((k) => registers[k] && registers[k] !== '0x00000000')
    : sortedKeys;

  const activeCount = regKeys.filter(
    (k) => registers[k] && registers[k] !== '0x00000000'
  ).length;

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-3.5 flex flex-col min-h-0 overflow-hidden">
      {/* 상단 헤더 & 필터 안내 */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-800">Registers</h3>
          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold font-mono">
            활성 {activeCount}/32
          </span>
          <span className="text-[10px] text-slate-400">
            (값 있는 레지스터 상단 정렬)
          </span>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyNonZero}
            onChange={(e) => setOnlyNonZero(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-0 w-3.5 h-3.5"
          />
          <span>유효값만</span>
        </label>
      </div>

      {/* 1열 전체 너비 한 줄 리스트 */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 text-xs font-mono custom-scrollbar">
        {filteredKeys.map((regKey) => {
          const val = registers[regKey] || '0x00000000';
          const prevVal = prevRegisters ? prevRegisters[regKey] : undefined;
          const isChanged = prevVal !== undefined && prevVal !== val;
          const hasVal = val !== '0x00000000';
          const meta = REGISTER_METAS[regKey] || { abi: regKey };

          return (
            <div
              key={regKey}
              title={meta.desc || regKey}
              className={`flex items-center justify-between px-3 py-1.5 rounded-xl border transition-all ${
                isChanged
                  ? 'bg-amber-100/90 border-amber-400 text-amber-950 font-bold shadow-xs animate-pulse ring-1 ring-amber-300'
                  : hasVal
                  ? 'bg-blue-50/60 border-blue-200 text-slate-900 font-semibold shadow-2xs'
                  : 'bg-slate-50/40 border-slate-100 text-slate-400'
              }`}
            >
              {/* 좌측: 번호, ABI 이름, 설명 태그, 사전 배정 뱃지 */}
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-8 font-bold ${isChanged ? 'text-amber-900' : hasVal ? 'text-blue-700' : 'text-slate-500'}`}>
                  {regKey}
                </span>

                <span className="text-[11px] text-slate-500 font-medium w-10 truncate">
                  ({meta.abi})
                </span>

                {meta.presetTag && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-sans font-bold bg-purple-100 text-purple-700 shrink-0">
                    {meta.presetTag}
                  </span>
                )}

                {hasVal && !meta.presetTag && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-sans font-semibold bg-blue-100 text-blue-700 shrink-0">
                    Active
                  </span>
                )}
              </div>

              {/* 우측: 16진수 값 전체 표시 (잘림 없음) */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-mono text-xs tracking-wider ${isChanged ? 'text-amber-950 font-extrabold' : hasVal ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                  {val}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RegisterVisualizer;
