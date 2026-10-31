import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CodeComparison from '../src/pages/CToAsm/CodeComparison';

beforeAll(() => { HTMLElement.prototype.scrollTo = vi.fn(); });
afterEach(cleanup);
const source = 'int main() {\n  int a = 1;\n  return a;\n}';
const assembly = '.file 1 "source.c"\n.text\nmain:\n.loc 1 2 0\nli a0,1\nsw a0,0(sp)\n.loc 1 3 0\nlw a0,0(sp)\n.loc 1 0 0\nret';

describe('source / assembly interaction', () => {
  it('selects multiple instructions from C and selects the C line back from assembly', () => {
    render(<CodeComparison source={source} assembly={assembly} />);
    fireEvent.click(screen.getByRole('button', { name: 'C 2행: int a = 1;' }));
    expect(screen.getByRole('button', { name: /ASM 5행/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /ASM 6행/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /ASM 8행/ }));
    expect(screen.getByRole('button', { name: 'C 3행: return a;' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'C 2행: int a = 1;' }).getAttribute('aria-pressed')).toBe('false');
  });
  it('supports a block selection and clears C highlights for unmapped instructions', () => {
    render(<CodeComparison source={source} assembly={assembly} />);
    fireEvent.click(screen.getByRole('button', { name: 'C 2행: int a = 1;' }));
    fireEvent.click(screen.getByRole('button', { name: 'C 3행: return a;' }), { shiftKey: true });
    expect(screen.getByText('선택한 코드: C 2–3행')).toBeTruthy();
    expect(screen.getByText(/생성된 명령어 3개/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ASM 10행/ }));
    expect(screen.getByText('C 위치가 없는 명령어')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'C 3행: return a;' }).getAttribute('aria-pressed')).toBe('false');
  });
});
