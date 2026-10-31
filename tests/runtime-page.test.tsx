import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import RuntimeInspector from '../src/pages/CToAsm/RuntimeInspector';
import { executeCompilation, loadDebugInfo } from '../src/pages/CToAsm/execution';
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
    fireEvent.click(screen.getByRole('button',{name:'실행 기록 불러오기'}));
    await screen.findByText(/마지막 a0 레지스터: 65/);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider,{target:{value:'25'}});
    expect(screen.getByText(new RegExp(`사이클 ${trace.history[25].clock}`))).toBeTruthy();
    expect(executeCompilation).toHaveBeenCalledWith(expect.objectContaining({simulationToken:'test-only'}),2000,expect.any(AbortSignal));
  });
  it('aborts pending work when the compiled source is discarded', () => {
    let signal: AbortSignal | undefined;
    vi.mocked(loadDebugInfo).mockImplementation((_url, incoming) => {signal=incoming; return new Promise(()=>{});});
    const mounted=render(<RuntimeInspector compilation={{assembly:'',log:'',binaryUrl:'https://example.test/elf',simulationToken:'test-only'}} onSelectLine={vi.fn()} />);
    fireEvent.click(screen.getByRole('button',{name:'실행 기록 불러오기'}));
    mounted.unmount();
    expect(signal?.aborted).toBe(true);
    expect(executeCompilation).not.toHaveBeenCalled();
  });
});
