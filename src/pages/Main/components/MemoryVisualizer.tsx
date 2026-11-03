import React, { useState } from 'react';

interface MemoryVisualizerProps {
  memorySnapshot: Record<string, string>;
  prevMemorySnapshot?: Record<string, string>;
}

// 16진수 문자열을 10진수로 변환 (주소는 unsigned, 값은 signed 32-bit)
const formatAddressDec = (hexStr: string): string => {
  const num = parseInt(hexStr, 16);
  if (isNaN(num)) return hexStr;
  return num.toLocaleString();
};

const formatSignedDec = (hexStr: string): string => {
  const num = parseInt(hexStr, 16);
  if (isNaN(num)) return '0';
  const signed = num | 0;
  return signed.toLocaleString();
};

const MemoryVisualizer: React.FC<MemoryVisualizerProps> = ({
  memorySnapshot,
  prevMemorySnapshot,
}) => {
  const [search, setSearch] = useState('');

  const entries = Object.entries(memorySnapshot || {}).sort(([a], [b]) => {
    const numA = parseInt(a, 16);
    const numB = parseInt(b, 16);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  const filteredEntries = search
    ? entries.filter(([addr, val]) => {
        const query = search.toLowerCase();
        const addrDec = formatAddressDec(addr).replace(/,/g, '');
        const valDec = formatSignedDec(val).replace(/,/g, '');
        return (
          addr.toLowerCase().includes(query) ||
          val.toLowerCase().includes(query) ||
          addrDec.includes(query) ||
          valDec.includes(query)
        );
      })
    : entries;

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-xs border border-slate-200/90 p-3 flex flex-col min-h-0 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-1.5">
          <h3 className="text-xs font-bold text-slate-800">Memory</h3>
          <span className="text-[10px] text-slate-400 font-mono">({entries.length})</span>
        </div>

        <input
          type="text"
          placeholder="검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-[10px] px-1.5 py-0.5 border border-slate-200 rounded-md w-20 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
        />
      </div>

      {/* 메모리 테이블 */}
      <div className="flex-1 overflow-y-auto pr-0.5 custom-scrollbar">
        {filteredEntries.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            데이터가 없습니다.
          </div>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100 text-[10px]">
                <th className="text-left py-0.5 font-medium">Addr</th>
                <th className="text-right py-0.5 font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.map(([addr, val]) => {
                const prevVal = prevMemorySnapshot ? prevMemorySnapshot[addr] : undefined;
                const isChanged = prevVal !== undefined && prevVal !== val;

                return (
                  <tr
                    key={addr}
                    className={`transition-colors ${
                      isChanged
                        ? 'bg-amber-100 text-amber-900 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <td
                      title={`Hex: ${addr}`}
                      className="py-0.5 text-slate-500 font-medium cursor-help text-[11px]"
                    >
                      {formatAddressDec(addr)}
                    </td>
                    <td
                      title={`Hex: ${val} (Unsigned: ${parseInt(val, 16) || 0})`}
                      className="py-0.5 text-right font-medium cursor-help text-[11px]"
                    >
                      {formatSignedDec(val)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default MemoryVisualizer;
