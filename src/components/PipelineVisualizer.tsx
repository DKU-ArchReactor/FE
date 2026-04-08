import React, { useState } from 'react';
import { AlertCircle, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PipelineVisualizer: React.FC = () => {
  const [showHazard, setShowHazard] = useState(false);
  const [scale, setScale] = useState(1);

  // Zoom handlers
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2.0));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setScale(1);

  // SVG Helper styles
  const wireBase = "stroke-gray-400 stroke-2 fill-transparent";
  const wireHazard = "stroke-rose-500 stroke-[4px] fill-transparent";
  
  const compBase = "fill-white stroke-gray-400 stroke-2";
  const compDark = "fill-gray-100 stroke-gray-400 stroke-[1.5px]";
  const textTitle = "fill-gray-800 text-sm font-bold font-sans";

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-800">Pipeline Architecture Viewer</h2>
            <div className="px-2 py-0.5 bg-cyan-50 border border-cyan-200 text-cyan-700 rounded text-xs font-medium">Full Circuit Map</div>
        </div>
        <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 rounded-lg p-1 mr-2 border border-gray-200 shadow-sm">
                <button 
                  onClick={handleZoomOut}
                  className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-white rounded-md transition-all active:scale-95"
                  title="Zoom Out"
                >
                    <ZoomOut className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleResetZoom}
                  className="px-2 text-[11px] font-bold text-gray-600 hover:text-gray-900 min-w-[50px] text-center hover:bg-white rounded-md py-1 transition-all"
                  title="Reset Zoom (100%)"
                >
                    {Math.round(scale * 100)}%
                </button>
                <button 
                  onClick={handleZoomIn}
                  className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-white rounded-md transition-all active:scale-95"
                  title="Zoom In"
                >
                    <ZoomIn className="w-4 h-4" />
                </button>
            </div>
            
            <button
            onClick={() => setShowHazard(!showHazard)}
            className={`text-sm px-4 py-1.5 rounded-md font-medium transition-all border shadow-sm ${
                showHazard 
                ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            >
            {showHazard ? 'Resolve Hazard' : 'Inject Hazard (RAW)'}
            </button>
            <button className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md border border-transparent hover:border-gray-200 transition-colors">
                <Maximize2 className="w-5 h-5" />
            </button>
        </div>
      </div>

      <AnimatePresence>
        {showHazard && (
            <motion.div 
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="overflow-hidden"
            >
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 shadow-sm">
                    <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-rose-800">
                        <strong>Data Hazard (RAW) / Forwarding Activated:</strong> 
                        <br/>
                        ALU는 EX 단계에서 <code>t0</code> 레지스터가 필요하지만, 이전 명령어 <code>lw t0, 8(sp)</code>가 아직 MEM 단계에 있어 레지스터 파일에 쓰이지 않았습니다. 
                        <strong>Forwarding Unit</strong>이 이를 감지하여 MEM/WB 레지스터에서 ALU 입력으로 데이터를 우회(Bypass/Forwarding)시키고, <strong>Hazard Detection Unit</strong>이 PC 갱신을 멈춰(Stall) 파이프라인 버블을 생성합니다. (붉은 선 참조)
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 w-full overflow-auto border border-gray-200 rounded-xl bg-gray-50/50 relative shadow-inner touch-pan-x touch-pan-y cursor-grab active:cursor-grabbing">
        <div 
          className="min-w-[1250px] min-h-[550px] p-8 absolute inset-0 flex items-center justify-center pt-24 transition-transform duration-200 ease-out"
          style={{ 
            transform: `scale(${scale})`,
            transformOrigin: 'center center'
          }}
        >
            <svg 
                viewBox="0 -140 1400 740" 
                className="w-full h-full max-h-[850px] overflow-visible"
                style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.05))' }}
            >
                {/* ---------- Dotted Pipeline State Dividers ---------- */}
                <g stroke="#CBD5E1" strokeWidth="2" strokeDasharray="6,6">
                    <line x1="280" y1="-140" x2="280" y2="600" />
                    <line x1="580" y1="-140" x2="580" y2="600" />
                    <line x1="900" y1="-140" x2="900" y2="600" />
                    <line x1="1200" y1="-140" x2="1200" y2="600" />
                </g>
                <g className="fill-gray-400 text-xs font-bold font-sans tracking-widest text-center" textAnchor="middle">
                    <text x="140" y="-120">INSTRUCTION FETCH</text>
                    <text x="430" y="-120">INSTRUCTION DECODE</text>
                    <text x="740" y="-120">EXECUTE</text>
                    <text x="1050" y="-120">MEMORY</text>
                    <text x="1300" y="-120">WRITE BACK</text>
                </g>

                {/* ---------- Active Instructions ---------- */}
                <foreignObject x="30" y="-105" width="220" height="60">
                    <div className="bg-cyan-50 border border-cyan-200 rounded-md flex flex-col items-center justify-center shadow-sm w-full h-full">
                        <span className="text-[10px] text-cyan-600 font-bold mb-0.5">IF Stage</span>
                        <code className="text-xs font-mono font-bold text-cyan-800">sub t3, t2, t1</code>
                    </div>
                </foreignObject>
                <foreignObject x="320" y="-105" width="220" height="60">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-md flex flex-col items-center justify-center shadow-sm w-full h-full">
                        <span className="text-[10px] text-emerald-600 font-bold mb-0.5">ID Stage</span>
                        <code className="text-xs font-mono font-bold text-emerald-800">sw t1, 4(sp)</code>
                    </div>
                </foreignObject>
                <foreignObject x="630" y="-105" width="220" height="60">
                    <div className={`rounded-md flex flex-col items-center justify-center shadow-sm w-full h-full transition-colors ${showHazard ? 'bg-rose-50 border border-rose-300' : 'bg-blue-50 border border-blue-200'}`}>
                        <span className={`text-[10px] font-bold mb-0.5 ${showHazard ? 'text-rose-500' : 'text-blue-500'}`}>EX Stage</span>
                        <code className={`text-xs font-mono font-bold ${showHazard ? 'text-rose-800' : 'text-blue-800'}`}>add t2, t0, t1</code>
                    </div>
                </foreignObject>
                <foreignObject x="940" y="-105" width="220" height="60">
                    <div className={`rounded-md flex flex-col items-center justify-center shadow-sm w-full h-full transition-colors ${showHazard ? 'bg-amber-50 border border-amber-300' : 'bg-purple-50 border border-purple-200'}`}>
                        <span className={`text-[10px] font-bold mb-0.5 ${showHazard ? 'text-amber-600' : 'text-purple-500'}`}>MEM Stage</span>
                        <code className={`text-xs font-mono font-bold ${showHazard ? 'text-amber-800' : 'text-purple-800'}`}>lw t0, 8(sp)</code>
                    </div>
                </foreignObject>
                <foreignObject x="1230" y="-105" width="140" height="60">
                    <div className="bg-gray-100 border border-gray-300 rounded-md flex flex-col items-center justify-center shadow-sm w-full h-full">
                        <span className="text-[10px] text-gray-500 font-bold mb-0.5">WB Stage</span>
                        <code className="text-xs font-mono font-bold text-gray-700">li t1, 10</code>
                    </div>
                </foreignObject>

                {/* ---------- Main Data Paths (Wires) ---------- */}
                {/* PC to I-Cache */}
                <polyline points="90,350 120,350" className={wireBase} />
                
                {/* PC + 4 Adder loop */}
                <polyline points="70,325 70,250 130,250" className={wireBase} />
                <polyline points="150,230 150,210 30,210 30,350 50,350" className={wireBase} />

                {/* I-Cache to IF/ID Register */}
                <polyline points="240,350 270,350" className={wireBase} />
                
                {/* IF/ID to Register File */}
                <polyline points="290,320 400,320" className={wireBase} />
                <polyline points="290,350 400,350" className={wireBase} />
                <polyline points="290,380 400,380" className={wireBase} />

                {/* IF/ID to Imm Gen */}
                <polyline points="290,440 370,440" className={wireBase} />
                <polyline points="470,440 570,440" className={wireBase} />

                {/* Registers to ID/EX */}
                <polyline points="520,335 570,335" className={wireBase} />
                <polyline points="520,365 570,365" className={wireBase} />

                {/* Forwarding Wires (Hazard Highlights) */}
                <polyline points="1070,350 1070,120 730,120 730,300 750,300" className={showHazard ? wireHazard : wireBase} />
                <polyline points="1230,350 1230,90 700,90 700,380 750,380" className={showHazard ? wireHazard : wireBase} />

                {/* ID/EX to ALU MUXes */}
                <polyline points="590,335 750,335" className={wireBase} />
                <polyline points="590,365 750,365" className={wireBase} />
                <polyline points="590,440 730,440 730,380 750,380" className={wireBase} />

                {/* ALU Control Wire */}
                <polyline points="590,520 820,520 820,490" className="stroke-indigo-300 stroke-[1.5px] stroke-dasharray-[4,4] fill-transparent" />
                <polyline points="820,450 805,390" className="stroke-indigo-300 stroke-[1.5px] fill-transparent" />

                {/* ALU to EX/MEM */}
                <polyline points="850,350 890,350" className={wireBase} />

                {/* EX/MEM to D-Cache & MUX */}
                <polyline points="910,350 1000,350" className={wireBase} />
                <polyline points="910,350 910,480 1150,480 1150,370" className={wireBase} />

                {/* D-Cache to MEM/WB */}
                <polyline points="1120,350 1190,350" className={wireBase} />

                {/* WB to Register File (Write Back line) */}
                <polyline points="1270,360 1270,550 430,550 430,400" className={wireBase} />
                {/* Control unit signals */}
                <polyline points="470,150 580,150" className="stroke-blue-200 stroke-2 fill-transparent" />
                <polyline points="580,150 900,150" className="stroke-blue-200 stroke-2 fill-transparent" />
                <polyline points="580,100 290,100" className="stroke-rose-300 stroke-2 fill-transparent stroke-dasharray-[4,4]" />

                {/* ---------- Components ---------- */}
                {/* PC MUX */}
                <polygon points="30,330 50,340 50,360 30,370" className={compBase} />
                <text x="50" y="325" fill="#64748B" fontSize="10" className="font-mono" textAnchor="middle">MUX</text>

                {/* PC */}
                <rect x="50" y="325" width="40" height="50" rx="4" className={compBase} />
                <text x="70" y="355" className={textTitle} textAnchor="middle" dominantBaseline="middle">PC</text>

                {/* PC + 4 Adder */}
                <polygon points="130,230 150,240 150,260 130,270 130,255 135,250 130,245" className="fill-purple-50 stroke-purple-300 stroke-2" />
                <text x="142" y="250" className="fill-purple-700 font-bold text-[10px]" textAnchor="middle" dominantBaseline="middle">+</text>
                <text x="142" y="220" className="fill-gray-500 font-bold text-[10px]" textAnchor="middle">PC+4</text>

                {/* Instruction Cache */}
                <rect x="120" y="280" width="120" height="140" rx="6" className="fill-blue-50 stroke-blue-200 stroke-[2.5px]" />
                <text x="180" y="340" className="fill-blue-800 font-bold" textAnchor="middle" dominantBaseline="middle">Instruction</text>
                <text x="180" y="360" className="fill-blue-800 font-bold" textAnchor="middle" dominantBaseline="middle">Memory</text>

                {/* Pipeline Registers (Vertical Blocks) */}
                <rect x="270" y="100" width="20" height="420" rx="4" className={compDark} />
                <rect x="570" y="90" width="20" height="460" rx="4" className={compDark} />
                <rect x="890" y="90" width="20" height="460" rx="4" className={compDark} />
                <rect x="1190" y="90" width="20" height="460" rx="4" className={compDark} />

                {/* Hazard Detection Unit */}
                <ellipse cx="400" cy="100" rx="60" ry="30" className={showHazard ? "fill-rose-50 stroke-rose-400 stroke-[3px]" : "fill-white stroke-gray-400 stroke-2"} />
                <text x="400" y="100" className={showHazard ? "fill-rose-700 font-bold text-xs" : "fill-gray-700 font-bold text-xs"} textAnchor="middle" dominantBaseline="middle">Hazard Detect</text>
                
                {/* Forwarding Unit */}
                <ellipse cx="750" cy="70" rx="65" ry="30" className={showHazard ? "fill-amber-50 stroke-amber-400 stroke-[3px]" : "fill-white stroke-gray-400 stroke-2"} />
                <text x="750" y="70" className={showHazard ? "fill-amber-700 font-bold text-xs" : "fill-gray-700 font-bold text-xs"} textAnchor="middle" dominantBaseline="middle">Forwarding</text>

                {/* Control Unit */}
                <ellipse cx="470" cy="150" rx="45" ry="25" className="fill-blue-50 stroke-blue-300 stroke-2" />
                <text x="470" y="150" className="fill-blue-800 text-sm font-bold font-sans" textAnchor="middle" dominantBaseline="middle">Control</text>

                {/* Register File */}
                <rect x="400" y="300" width="120" height="100" rx="6" className="fill-emerald-50 stroke-emerald-300 stroke-[2.5px]" />
                <text x="460" y="350" className="fill-emerald-800 font-bold text-sm" textAnchor="middle">Registers</text>
                {/* Register Ports */}
                <text x="410" y="325" className="fill-emerald-600 text-[9px] font-bold">RR1</text>
                <text x="410" y="355" className="fill-emerald-600 text-[9px] font-bold">RR2</text>
                <text x="410" y="385" className="fill-emerald-600 text-[9px] font-bold">WR</text>
                
                <text x="500" y="340" className="fill-emerald-600 text-[9px] font-bold">RD1</text>
                <text x="500" y="370" className="fill-emerald-600 text-[9px] font-bold">RD2</text>
                <text x="430" y="390" className="fill-emerald-600 text-[9px] font-bold">WD</text>

                {/* Imm Gen */}
                <ellipse cx="420" cy="440" rx="50" ry="20" className={compBase} />
                <text x="420" y="440" className="fill-gray-700 text-[11px] font-bold" textAnchor="middle" dominantBaseline="middle">Imm Gen</text>

                {/* ALU Control */}
                <ellipse cx="820" cy="470" rx="40" ry="20" className="fill-indigo-50 stroke-indigo-300 stroke-2" />
                <text x="820" y="470" className="fill-indigo-800 text-[10px] font-bold" textAnchor="middle" dominantBaseline="middle">ALU Ctrl</text>

                {/* ALU MUX 1 */}
                <polygon points="750,290 770,300 770,330 750,340" className={compBase} />
                <text x="760" y="285" fill="#64748B" fontSize="10" className="font-mono" textAnchor="middle">MUX</text>

                {/* ALU MUX 2 */}
                <polygon points="750,360 770,370 770,400 750,410" className={compBase} />
                <text x="760" y="420" fill="#64748B" fontSize="10" className="font-mono" textAnchor="middle">MUX</text>

                {/* ALU */}
                <polygon points="780,310 830,330 830,370 780,390 780,360 795,350 780,340" className="fill-indigo-50 stroke-indigo-400 stroke-[2.5px]" />
                <text x="812" y="350" className="fill-indigo-900 font-black text-lg" textAnchor="middle" dominantBaseline="middle">ALU</text>

                {/* Data Cache */}
                <rect x="1000" y="280" width="120" height="140" rx="6" className="fill-amber-50 stroke-amber-300 stroke-[2.5px]" />
                <text x="1060" y="340" className="fill-amber-800 font-bold" textAnchor="middle" dominantBaseline="middle">Data</text>
                <text x="1060" y="360" className="fill-amber-800 font-bold" textAnchor="middle" dominantBaseline="middle">Memory</text>

                {/* WB MUX */}
                <polygon points="1240,340 1260,350 1260,380 1240,390" className={compBase} />
                <text x="1250" y="335" fill="#64748B" fontSize="10" className="font-mono" textAnchor="middle">MUX</text>


                {/* Animated Data Pulses for Effect (Optional) */}
                <g>
                    <circle r="4" fill="#06B6D4">
                        <animateMotion dur="3s" repeatCount="indefinite" path="M 90 350 L 120 350 M 240 350 L 270 350 M 290 320 L 400 320 M 520 335 L 570 335 M 590 335 L 750 335 M 850 350 L 890 350 M 910 350 L 1000 350" />
                    </circle>
                    {showHazard && (
                        <circle r="6" fill="#F43F5E">
                            <animateMotion dur="1.5s" repeatCount="indefinite" path="M 1070 350 L 1070 120 L 730 120 L 730 300 L 750 300" />
                        </circle>
                    )}
                </g>

            </svg>
        </div>
      </div>
    </div>
  );
};

export default PipelineVisualizer;
