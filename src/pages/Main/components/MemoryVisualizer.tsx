import React, { useState } from 'react';

interface MemoryVisualizerProps {
  memorySnapshot: Record<string, string>;
  prevMemorySnapshot?: Record<string, string>;
}

const MemoryVisualizer: React.FC<MemoryVisualizerProps> = ({
  memorySnapshot,
  prevMemorySnapshot,
}) => {
  const [search, setSearch] = useState('');

  const entries = Object.entries(memorySnapshot || {}).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const filteredEntries = search
    ? entries.filter(([addr, val]) =>
        addr.toLowerCase().includes(search.toLowerCase()) ||
        val.toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col min-h-0 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-800">Memory Snapshot</h3>
          <span className="text-[11px] text-slate-400 font-mono">({entries.length} words)</span>
        </div>

        <input
          type="text"
          placeholder="주소 검색 (0x...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs px-2 py-0.5 border border-slate-200 rounded-lg w-28 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
        />
      </div>

      {/* 메모리 테이블 */}
      <div className="flex-1 overflow-y-auto pr-1">
        {filteredEntries.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            데이터가 없습니다.
          </div>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-slate-400 border-b border-slate-50 text-[11px]">
                <th className="text-left py-1 font-medium">Address</th>
                <th className="text-right py-1 font-medium">Value (Hex)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEntries.map(([addr, val]) => {
                const prevVal = prevMemorySnapshot ? prevMemorySnapshot[addr] : undefined;
                const isChanged = prevVal !== undefined && prevVal !== val;

                return (
                  <tr
                    key={addr}
                    className={`transition-colors ${
                      isChanged
                        ? 'bg-amber-100/70 text-amber-900 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <td className="py-1 text-slate-500">{addr}</td>
                    <td className="py-1 text-right font-medium">{val}</td>
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
