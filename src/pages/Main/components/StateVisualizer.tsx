import type { CycleHistoryItem, SimulationResult } from '@/type/simulation';
import RegisterVisualizer from './RegisterVisualizer';
import MemorySegmentVisualizer from './MemorySegmentVisualizer';

interface Props {
  currentData: CycleHistoryItem | null;
  prevData: CycleHistoryItem | null;
  simulationData: SimulationResult | null;
  defaultLayout?: 'auto' | 'horizontal' | 'vertical';
}

const EMPTY_REGISTERS: Record<string, string> = {};

export default function StateVisualizer({ currentData, prevData, simulationData, defaultLayout = 'auto' }: Props) {
  return <div className={`flex-1 min-h-0 grid gap-2 ${defaultLayout === 'horizontal' ? 'grid-cols-2' : 'grid-rows-2'}`}>
    <RegisterVisualizer registers={currentData?.global_result.registers ?? EMPTY_REGISTERS} prevRegisters={prevData?.global_result.registers} cycle={currentData?.clock} />
    <MemorySegmentVisualizer currentData={currentData} prevData={prevData} simulationData={simulationData} />
  </div>;
}
