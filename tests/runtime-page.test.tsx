import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import RuntimeInspector from '../src/pages/CToAsm/RuntimeInspector';
import { executeCompilation, loadDebugInfo } from '../src/pages/CToAsm/execution';
import { memoryTimeline } from '../src/pages/CToAsm/memoryTimeline';
import { parseDebugInfo } from '../src/pages/CToAsm/debug';
vi.mock('../src/pages/CToAsm/execution', () => ({executeCompilation: vi.fn(),loadDebugInfo: vi.fn()}));
afterEach(() => {cleanup(); vi.resetAllMocks();});
describe('runtime inspector', () => {
  it('loads real metadata/trace, permits cycle navigation, and reports completion', async () => {
    const bytes = readFileSync('tests/fixtures/long.elf');
    const metadata = parseDebugInfo(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    const trace = {...JSON.parse(readFileSync('tests/fixtures/long-trace.json','utf8')), executionStatus:'COMPLETED'};
    vi.mocked(loadDebugInfo).mockResolvedValue(metadata);
    vi.mocked(executeCompilation).mockResolvedValue(trace);
    render(<RuntimeInspector compilation={{assembly:'',log:'',binaryUrl:'https://example.test/elf',simulationToken:'test-only'}} onSelectLine={vi.fn()} />);
    fireEvent.click(screen.getByRole('button',{name:'코드 실행하고 변화 보기'}));
    await screen.findByText(/최종 반환값: 65/);
    const slider = screen.getByRole('slider');
    const timeline=memoryTimeline(metadata,trace.history);
    fireEvent.change(slider,{target:{value:'2'}});
    expect(screen.getByText(new RegExp(`CPU 사이클 ${trace.history[timeline[2].index].clock}`),{selector:'.compile-step-guide'})).toBeTruthy();
    expect(screen.getByText('주소·타입과 변수 값 자세히 보기').closest('details')?.open).toBe(false);
    expect(executeCompilation).toHaveBeenCalledWith(expect.objectContaining({simulationToken:'test-only'}),2000,expect.any(AbortSignal));
  });
  it('aborts pending work when the compiled source is discarded', () => {
    let signal: AbortSignal | undefined;
    vi.mocked(loadDebugInfo).mockImplementation((_url, incoming) => {signal=incoming; return new Promise(()=>{});});
    const mounted=render(<RuntimeInspector compilation={{assembly:'',log:'',binaryUrl:'https://example.test/elf',simulationToken:'test-only'}} onSelectLine={vi.fn()} />);
    fireEvent.click(screen.getByRole('button',{name:'코드 실행하고 변화 보기'}));
    mounted.unmount();
    expect(signal?.aborted).toBe(true);
    expect(executeCompilation).not.toHaveBeenCalled();
  });
});
