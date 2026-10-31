import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import CToAsmPage from '../src/pages/CToAsm';
import { compileSource } from '../src/pages/CToAsm/compile';

vi.mock('../src/pages/CToAsm/compile', () => ({ compileSource: vi.fn(), compileError: (error: Error) => error.message }));
beforeAll(() => { HTMLElement.prototype.scrollTo = vi.fn(); });
afterEach(cleanup);

describe('compilation page', () => {
  it('compiles once, connects the result, and clears stale results when the example changes', async () => {
    vi.mocked(compileSource).mockResolvedValue({ assembly: readFileSync('tests/fixtures/arithmetic.s', 'utf8'), log: 'ok' });
    render(<CToAsmPage />);
    fireEvent.click(screen.getByRole('button', { name: '컴파일하기 →' }));
    await screen.findByText(/컴파일 완료/);
    fireEvent.click(screen.getByRole('button', { name: 'C 4행: int sum = a + b;' }));
    expect(screen.getByText('C 4행 → 4개 어셈블리 명령')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: '학습 예제' }), { target: { value: 'list' } });
    expect(screen.queryByText(/컴파일 완료/)).toBeNull();
    expect(screen.queryByRole('button', { name: /ASM / })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'head: C 10행 선택' }));
    expect(screen.getByRole('button', { name: 'C 10행: node = node->next;' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'middle: C 11행 선택' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('opens an uploaded C file and removes curated structure diagrams', async () => {
    render(<CToAsmPage />);
    fireEvent.change(screen.getByRole('combobox', { name: '학습 예제' }), { target: { value: 'tree' } });
    const file = new File(['int main(){return 42;}'], 'custom.c', { type: 'text/plain' });
    Object.defineProperty(file, 'text', { value: async () => 'int main(){return 42;}' });
    fireEvent.change(screen.getByLabelText('C 파일 열기', { selector: 'input' }), { target: { files: [file] } });
    await screen.findByText('custom.c');
    expect(screen.queryByLabelText('자료구조 설명')).toBeNull();
    expect(screen.getByRole('button', { name: 'C 1행: int main(){return 42;}' })).toBeTruthy();
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
    fireEvent.click(screen.getByRole('button', { name: '처리 중…' }));
    expect(compileSource).toHaveBeenCalledTimes(1);
    finish({ assembly: '.text\nret', log: '' });
    await screen.findByText(/컴파일 완료/);
  });
});
