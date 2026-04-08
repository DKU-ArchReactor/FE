import React from 'react';
import { SkipBack, SkipForward, Pause } from 'lucide-react';

const StatePanel: React.FC = () => {
  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Registers */}
        <div className="flex-1 flex flex-col bg-gray-50 rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 border-b border-gray-200 flex justify-between items-center">
            <span>Registers (Hex)</span>
          </div>
          <div className="flex-1 p-2 overflow-auto text-xs font-mono">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex justify-between p-1 hover:bg-white rounded transition-colors group">
                <span className="text-gray-500 group-hover:text-gray-700">x0 (zero)</span>
                <span className="text-gray-800 font-medium">0x00000000</span>
              </div>
              <div className="flex justify-between p-1 hover:bg-white rounded transition-colors group">
                <span className="text-gray-500 group-hover:text-gray-700">x1 (ra)</span>
                <span className="text-gray-800 font-medium">0x00000040</span>
              </div>
              <div className="flex justify-between p-1 hover:bg-white rounded bg-cyan-50 border border-cyan-100">
                <span className="text-cyan-700 font-bold">x2 (sp)</span>
                <span className="text-cyan-800 font-bold">0x7FFFFFE0</span>
              </div>
              <div className="flex justify-between p-1 hover:bg-white rounded transition-colors group">
                <span className="text-gray-500 group-hover:text-gray-700">x5 (t0)</span>
                <span className="text-amber-600 font-bold border-b border-amber-300 border-dashed">0x00000005</span>
              </div>
              <div className="flex justify-between p-1 hover:bg-white rounded transition-colors group">
                <span className="text-gray-500 group-hover:text-gray-700">x6 (t1)</span>
                <span className="text-gray-800 font-medium">0x0000000A</span>
              </div>
              <div className="flex justify-between p-1 hover:bg-white rounded transition-colors group">
                <span className="text-gray-500 group-hover:text-gray-700">x7 (t2)</span>
                <span className="text-gray-500 font-medium">0x00000000</span>
              </div>
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="flex-1 flex flex-col bg-gray-50 rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 border-b border-gray-200 flex justify-between items-center">
            <span>Memory Data</span>
          </div>
          <div className="flex-1 p-2 overflow-auto text-xs font-mono">
             <table className="w-full text-left">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200">
                  <th className="pb-1.5 font-semibold">Address</th>
                  <th className="pb-1.5 font-semibold text-center">+0</th>
                  <th className="pb-1.5 font-semibold text-center">+4</th>
                  <th className="pb-1.5 font-semibold text-center">+8</th>
                  <th className="pb-1.5 font-semibold text-center">+C</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr className="border-b border-gray-100/50">
                  <td className="py-2 text-cyan-600 font-medium">0x7FFFFFE0</td>
                  <td className="py-2 text-gray-400 text-center">-</td>
                  <td className="py-2 text-center bg-cyan-50 text-cyan-700 font-bold rounded">0A</td>
                  <td className="py-2 text-center font-medium">05</td>
                  <td className="py-2 text-gray-400 text-center">-</td>
                </tr>
                <tr className="border-b border-gray-100/50">
                  <td className="py-2 text-cyan-600 font-medium">0x7FFFFFE4</td>
                  <td className="py-2 text-gray-400 text-center">-</td>
                  <td className="py-2 text-gray-400 text-center">-</td>
                  <td className="py-2 text-gray-400 text-center">-</td>
                  <td className="py-2 text-gray-400 text-center">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Animation Controls */}
      <div className="h-14 bg-white border border-gray-200 rounded-lg flex items-center px-4 justify-between shadow-sm">
         <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-gray-500">Cycle: <span className="text-cyan-600 ml-1 font-mono text-lg font-black">14</span></span>
         </div>
         <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-full border border-gray-200">
            <button className="p-2 text-gray-500 hover:text-gray-900 hover:bg-white rounded-full transition-all shadow-sm">
                <SkipBack className="w-4 h-4" />
            </button>
            <button className="p-2.5 bg-cyan-500 text-white hover:bg-cyan-600 rounded-full transition-all shadow-md shadow-cyan-500/30">
                <Pause className="w-5 h-5 fill-current" />
            </button>
            <button className="p-2 text-gray-500 hover:text-gray-900 hover:bg-white rounded-full transition-all shadow-sm">
                <SkipForward className="w-4 h-4" />
            </button>
         </div>
         <div className="text-xs text-gray-500 font-medium px-3 py-1 bg-gray-100 rounded-full border border-gray-200">
             Auto-Step (1x)
         </div>
      </div>
    </div>
  );
};

export default StatePanel;
