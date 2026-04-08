import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Sparkles, AlertTriangle, Activity, Clock, Cpu } from 'lucide-react';

const mockCyclesData = [
  { name: 'IF', cycles: 120 },
  { name: 'ID', cycles: 98 },
  { name: 'EX', cycles: 86 },
  { name: 'MEM', cycles: 154 },
  { name: 'WB', cycles: 80 },
];

const mockInstructionMix = [
  { name: 'ALU', value: 45, color: '#06b6d4' },
  { name: 'Memory', value: 30, color: '#f59e0b' },
  { name: 'Branch', value: 15, color: '#8b5cf6' },
  { name: 'Jump', value: 10, color: '#10b981' },
];

const Analytics: React.FC = () => {
  return (
    <div className="h-full w-full p-6 bg-slate-950 overflow-y-auto">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-slate-200">Execution Analysis</h1>
        
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">Total Cycles</p>
              <h3 className="text-3xl font-bold text-slate-200 mt-1">14,204</h3>
            </div>
            <div className="p-3 bg-cyan-500/10 rounded-lg text-cyan-400">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">CPI (Cycles Per Inst)</p>
              <h3 className="text-3xl font-bold text-slate-200 mt-1">1.42</h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400">
              <Activity className="w-6 h-6" />
            </div>
          </div>
          
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">Hazards (Stalls)</p>
              <h3 className="text-3xl font-bold text-rose-400 mt-1">324</h3>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-lg text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">Instructions Executed</p>
              <h3 className="text-3xl font-bold text-slate-200 mt-1">10,000</h3>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400">
              <Cpu className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Charts & AI Feedback */}
        <div className="grid grid-cols-3 gap-6">
          
          {/* Charts Left */}
          <div className="col-span-2 flex flex-col gap-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col">
              <h3 className="text-lg font-bold text-slate-300 mb-4">Cycles Built-up per Stage</h3>
              <div className="flex-1 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockCyclesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                    <Bar dataKey="cycles" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col">
               <h3 className="text-lg font-bold text-slate-300 mb-4">Instruction Mix</h3>
               <div className="flex-1 h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={mockInstructionMix} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {mockInstructionMix.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                      <Legend verticalAlign="middle" align="right" layout="vertical" />
                    </PieChart>
                  </ResponsiveContainer>
               </div>
            </div>
          </div>

          {/* AI Report Sidebar */}
          <div className="col-span-1 border border-cyan-800/30 bg-gradient-to-b from-slate-900 to-cyan-950/20 rounded-xl p-5 shadow-[0_0_30px_rgba(6,182,212,0.05)] flex flex-col relative overflow-hidden">
             
             <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl" />
             
             <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-6 h-6 text-cyan-400" />
                <h3 className="text-lg font-bold text-cyan-400 tracking-wide">ArchReactor AI Analytics</h3>
             </div>
             
             <p className="text-slate-300 text-sm leading-relaxed mb-6 font-medium">
                코드 분석 및 시뮬레이션 결과 기반 AI 레포트입니다. <br/>
                현재 코드는 최적화할 여지가 매우 많습니다. (CPI = 1.42)
             </p>

             <div className="flex flex-col gap-4 relative z-10">
                
                {/* Issue card */}
                <div className="bg-slate-950/80 border border-rose-500/30 rounded-lg p-4">
                   <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-500 mt-0.5 flex-shrink-0" />
                      <div>
                         <h4 className="font-bold text-rose-400 text-sm">과도한 메모리 접근 및 병목</h4>
                         <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                            이 구간에서 데이터 해저드가 과도하게 발생합니다. 연속적인 Load(lw) 직후에 연산(add)이 있어 Stall이 다수(324번) 누적되었습니다.
                         </p>
                      </div>
                   </div>
                   <div className="mt-3 bg-rose-500/10 p-2 text-rose-300 font-mono text-xs rounded border border-rose-500/20">
                      lw t0, 8(sp)<br/>
                      add t2, t0, t1 // HAZARD!
                   </div>
                </div>

                {/* Recommendation card */}
                <div className="bg-slate-950/80 border border-emerald-500/30 rounded-lg p-4">
                   <div className="flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <div>
                         <h4 className="font-bold text-emerald-400 text-sm">최적화 권장방안 (코드 재배치)</h4>
                         <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                            코드의 순서를 바꾸는 것을 권장합니다 (Instruction Scheduling). 연관 없는 다른 명령어(예: li, j등 다른 연산)를 Load 명령어와 Use 명령어 사이에 끼워 넣으세요.
                         </p>
                      </div>
                   </div>
                </div>

             </div>

             <button className="mt-auto w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-cyan-950 font-bold rounded-lg transition-colors shadow-lg shadow-cyan-500/20">
                코드에 자동 적용해보기
             </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Analytics;
