import React from 'react';
import { Send, Sparkles } from 'lucide-react';

const AIChat: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="h-14 border-b border-gray-200 flex items-center px-4 gap-2 bg-gray-50">
        <Sparkles className="w-5 h-5 text-cyan-500" />
        <h2 className="font-bold text-gray-800">ArchReactor AI</h2>
      </div>

      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 text-sm bg-gray-50/50">
        
        {/* User Message */}
        <div className="flex justify-end">
            <div className="bg-white border border-gray-200 text-gray-800 px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm">
                현재 코드에서 성능을 저하시키는 요인이 있을까?
            </div>
        </div>

        {/* AI Message */}
        <div className="flex justify-start">
            <div className="bg-gradient-to-br from-white to-blue-50 border border-blue-100 text-gray-800 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[95%] leading-relaxed shadow-md">
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-cyan-500" />
                    <span className="font-bold text-cyan-700">분석 완료</span>
                </div>
                <p className="mb-2">
                    현재 어셈블리 코드 분석 결과, <code>lw t0, 8(sp)</code> 바로 다음에 <code>add t2, t0, t1</code> 명령어가 오면서 <strong className="text-rose-600">데이터 해저드(RAW)</strong>가 과도하게 발생하고 있습니다.
                </p>
                <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg mb-3 text-rose-800 font-mono text-xs shadow-inner">
                    이 구간에서 데이터 해저드가 발생합니다. <br/>
                    Stall이 1 Cycle 추가되어 성능이 저하됩니다.
                </div>
                <p className="text-gray-600 text-xs bg-gray-100/50 p-2 rounded-lg border border-gray-100">
                    💡 <strong className="text-gray-700">해결 권장사항:</strong> 메모리 로컬 변수를 레지스터에 상주시키거나(C언어 최적화 사용), 연관 없는 명령어를 해당 줄 사이에 재배치(Instruction Scheduling) 하는 것을 권장합니다.
                </p>
            </div>
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="relative flex items-center">
            <input 
                type="text" 
                placeholder="코드 최적화에 대해 질문해보세요..." 
                className="w-full bg-gray-50 border border-gray-300 rounded-full py-2.5 pl-4 pr-12 text-sm text-gray-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all placeholder:text-gray-400 shadow-inner"
            />
            <button className="absolute right-1.5 p-2 bg-cyan-500 text-white rounded-full hover:bg-cyan-600 transition-colors shadow-sm">
                <Send className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
