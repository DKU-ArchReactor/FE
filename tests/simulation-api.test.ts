import { beforeEach, expect, it, vi } from 'vitest';
import apiConfig from '@/api/config';
import { runSimulation } from '@/api/simulation';

vi.mock('@/api/config', () => ({ default: { post: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

it('unwraps the current BE envelope and preserves initial state, instruction metadata, and activity', async () => {
  const activity = { IF: { pc: '0x00020000', assembly: 'ecall' } };
  const result = { simulator: { mode: 'single' }, initial_state: { registers: { x0: '0x00000000' } },
    program: { instructions: [{ pc: '0x00020000' }] }, summary: { total_cycles: 1 },
    history: [{ stage_activity: activity, buffers: { IF: null } }] };
  vi.mocked(apiConfig.post).mockResolvedValue({ data: { execution_status: 'COMPLETED', result } });
  const actual = await runSimulation({ simulation_token: 'guest-token', mode: 'single' });
  expect(apiConfig.post).toHaveBeenCalledWith('/api/v1/simulation/run', { simulation_token: 'guest-token', mode: 'single', max_cycles: 2000 }, { signal: undefined });
  expect(actual).toEqual(result);
});

it.each([
  { simulator: { mode: 'pipeline' }, initial_state: {}, history: [], summary: { total_cycles: 0 } },
  { simulator: { mode: 'single' }, history: [], summary: { total_cycles: 0 } },
  { simulator: { mode: 'single' }, initial_state: {}, history: [], summary: { total_cycles: 2 } },
])('rejects an incompatible engine or malformed history', async (result) => {
  vi.mocked(apiConfig.post).mockResolvedValue({ data: { result } });
  await expect(runSimulation({ build_id: 'saved-build', mode: 'single' })).rejects.toThrow('실행 기록');
});
