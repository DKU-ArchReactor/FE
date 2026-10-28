import React, { useState } from 'react';
import SourceHeader from './SourceHeader';
import SourceViewer from './SourceViewer';

import type { StageBuffer } from '@/type/simulation';
import type { CodeLineSelectInfo } from './SourceViewer';

interface SourceAreaProps {
  onStartSimulation?: () => void;
  stageBuffers?: {
    IF?: StageBuffer | null;
    ID?: StageBuffer | null;
    EX?: StageBuffer | null;
    MEM?: StageBuffer | null;
    WB?: StageBuffer | null;
  };
  selectedLine?: CodeLineSelectInfo | null;
  onSelectLine?: (info: CodeLineSelectInfo) => void;
}

const DEFAULT_C_CODE = `// MIPS / RISC-V Pipeline Simulation Example
#include <stdio.h>

int main() {
    int a = 50;
    int b = 100;
    int c = 500;
    int d = 0;

    int div = c / d; // Zero division test
    if (a == 50 && b == 100) {
        printf("Pipeline Check OK\\n");
    }

    return 0;
}
`;

const DEFAULT_ASM_CODE = `# Disassembled Instructions (from simulation_result.json)
.globl main
main:
  0x00010094:  addi sp, sp, -48
  0x00010098:  lui a5, 65536
  0x0001009c:  sw ra, 44(sp)
  0x000100a0:  addi a5, a5, 388
  0x000100a4:  addi a0, a5, 0
  0x000100a8:  addi a7, zero, 4
  0x000100ac:  ecall
  0x000100b0:  addi a5, zero, 50
  0x000100b4:  sw a5, 16(sp)
  0x000100b8:  sw a5, 24(sp)
  0x000100bc:  addi a5, zero, 100
  0x000100c0:  sw a5, 20(sp)
  0x000100c4:  lw a3, 16(sp)
  0x000100c8:  sw a5, 28(sp)
  0x000100cc:  lw a2, 20(sp)
  0x000100d0:  addi a4, zero, 500
  0x000100d4:  addi a5, zero, 0
  0x000100d8:  div a1, a4, a5
  0x000100dc:  addi a3, a3, -50
  0x000100e0:  addi a2, a2, -100
  0x000100e4:  sltiu a3, a3, 1
  0x000100e8:  sltiu a2, a2, 1
  0x000100ec:  and a3, a3, a2
  0x000100f0:  beq a3, zero, 64
  0x000100f4:  addi a0, zero, 60
  0x000100f8:  sw a1, 12(sp)
  0x000100fc:  jal ra, 128
  0x00010100:  lw a1, 12(sp)
  0x00010104:  addi a1, a1, 1
  0x00010108:  bne a1, zero, 40
  0x0001010c:  addi a0, a0, -1552
  0x00010110:  addi a0, a0, -2048
  0x00010114:  bne a0, zero, 28
  0x00010118:  lui a5, 65536
  0x0001011c:  addi a5, a5, 424
  0x00010120:  addi a0, a5, 0
  0x00010124:  addi a7, zero, 4
  0x00010128:  ecall
  0x0001012c:  jal zero, 24
  0x00010130:  lui a5, 65536
  0x00010134:  addi a5, a5, 456
  0x00010144:  addi a7, zero, 10
  0x00010148:  ecall
  0x0001014c:  lw ra, 44(sp)
  0x00010150:  addi a0, zero, 0
  0x00010154:  addi sp, sp, 48
  0x00010158:  jalr zero, ra, 0
`;

const SourceArea: React.FC<SourceAreaProps> = ({ 
  stageBuffers,
  selectedLine,
  onSelectLine,
}) => {
  const [activeTab, setActiveTab] = useState<'c' | 'asm'>('asm');
  const [cFileName, setCFileName] = useState<string>('sample.c');
  const [cContent, setCContent] = useState<string>(DEFAULT_C_CODE);
  const [asmFileName] = useState<string>('sample.s');
  const [asmContent] = useState<string>(DEFAULT_ASM_CODE);

  const handleFileAdded = (file: File) => {
    setCFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCContent(result);
    };
    reader.readAsText(file);
  };

  const handleCompile = () => {
    // 변환 시 ASM 탭으로 전환만 수행하고 시뮬레이션은 자동 시작하지 않음
    setActiveTab('asm');
  };

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-0">
      <SourceViewer 
        activeTab={activeTab} 
        fileName={activeTab === 'c' ? cFileName : asmFileName}
        content={activeTab === 'c' ? cContent : asmContent}
        stageBuffers={stageBuffers}
        selectedLine={selectedLine}
        onSelectLine={onSelectLine}
      />
      <SourceHeader 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onFileAdded={handleFileAdded}
        onCompile={handleCompile}
      />
    </div>
  );
};

export default SourceArea;
