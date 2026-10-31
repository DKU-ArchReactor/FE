import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import CToAsmPage from '../src/pages/CToAsm';
import { compileSource } from '../src/pages/CToAsm/compile';

vi.mock('../src/pages/CToAsm/compile', () => ({ compileSource: vi.fn(), compileError: (error: Error) => error.message }));
vi.mock('@monaco-editor/react', () => ({ default: (props: { value: string; onChange: (value: string) => void }) => <textarea aria-label="C 소스 편집기" value={props.value} onChange={event => props.onChange(event.target.value)} /> }));
beforeAll(() => { HTMLElement.prototype.scrollTo = vi.fn(); });
afterEach(cleanup);

describe('compilation page', () => {
  it('hides assembly headings before compilation and connects the compiled source', async () => {
    vi.mocked(compileSource).mockResolvedValue({ assembly: readFileSync('tests/fixtures/arithmetic.s', 'utf8'), log: 'ok' });
    render(<CToAsmPage />);
    expect(screen.getByRole('heading', { name: '컴파일 결과가 여기에 표시됩니다' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /대응 어셈블리/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '컴파일하기 →' }));
    await screen.findByText(/컴파일 완료/);
    fireEvent.click(screen.getByRole('button', { name: 'C 4행: int sum = a + b;' }));
    expect(screen.getByText('선택한 코드: C 4행')).toBeTruthy();
    expect(screen.getByText(/생성된 명령어 4개/)).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'C 소스 편집기' }), { target: { value: 'int main(){return 1;}' } });
    expect(screen.queryByText(/컴파일 완료/)).toBeNull();
    expect(screen.queryByRole('button', { name: /ASM / })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '컴파일하기 →' }));
    await screen.findByText(/컴파일 완료/);
    expect(compileSource).toHaveBeenLastCalledWith('int main(){return 1;}', expect.any(AbortSignal));
  });

  it('opens an uploaded C file and inspects its actual aggregate declarations', async () => {
    render(<CToAsmPage />);
    const fileSource = 'struct Link { int value; struct Link *next; };\nstruct Link head;\nint scores[3];';
    const file = new File([fileSource], 'custom.c', { type: 'text/plain' });
    Object.defineProperty(file, 'text', { value: async () => fileSource });
    fireEvent.change(screen.getByLabelText('C 파일 열기', { selector: 'input' }), { target: { files: [file] } });
    await screen.findByText('custom.c');
    expect(screen.getByText('struct Link')).toBeTruthy();
    expect(screen.getByText('int scores')).toBeTruthy();
    expect(screen.getByText(/실행 중 대상 미확정/)).toBeTruthy();
  });

  it('shows failures and permits retry without keeping a stale result', async () => {
    vi.mocked(compileSource).mockRejectedValue(new Error('source.c: syntax error'));
    render(<CToAsmPage />);
    fireEvent.click(screen.getByRole('button', { name: '컴파일하기 →' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('syntax error');
    await waitFor(() => expect((screen.getByRole('button', { name: '컴파일하기 →' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('disables duplicate compilation until a pending request completes', async () => {
    let finish!: (result: { assembly: string; log: string }) => void;
    vi.mocked(compileSource).mockClear().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<CToAsmPage />);
    fireEvent.click(screen.getByRole('button', { name: '컴파일하기 →' }));
    fireEvent.click(screen.getByRole('button', { name: '컴파일 중…' }));
    expect(compileSource).toHaveBeenCalledTimes(1);
    finish({ assembly: '.text\nret', log: '' });
    await screen.findByText(/컴파일 완료/);
  });
});
