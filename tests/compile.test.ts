import { afterEach, describe, expect, it, vi } from 'vitest';
import { compileCode } from '../src/api/build';
import { compileSource } from '../src/pages/CToAsm/compile';

vi.mock('../src/api/build', () => ({ compileCode: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const result = { build_id: null, status: 'success', assembly_url: 'https://artifacts.example/assembly.s', binary_url: '', log: '', simulation_token: 'must-not-be-logged' };

describe('compilation transport', () => {
  it('requests real debug mapping and downloads assembly without forwarding credentials', async () => {
    vi.mocked(compileCode).mockResolvedValue(result);
    const fetch = vi.fn().mockResolvedValue(new Response('.text\nmain:\nret'));
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    expect(await compileSource('int main(){return 0;}', signal)).toEqual({ assembly: '.text\nmain:\nret', log: '' });
    expect(compileCode).toHaveBeenCalledWith({ content: 'int main(){return 0;}', lang: 'c', compile_profile: 'rv32im', compiler_opt: '-O0 -g' }, signal);
    expect(fetch).toHaveBeenCalledWith(result.assembly_url, { signal });
  });
  it('surfaces compiler errors even for HTTP success and never downloads an artifact', async () => {
    vi.mocked(compileCode).mockResolvedValue({ ...result, status: 'failed', log: 'source.c:2: expected ;' });
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(compileSource('bad C', new AbortController().signal)).rejects.toThrow('source.c:2: expected ;');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not display an S3 error document as assembly', async () => {
    vi.mocked(compileCode).mockResolvedValue(result);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<Error>Expired</Error>', { status: 403 })));
    await expect(compileSource('C', new AbortController().signal)).rejects.toThrow('HTTP 403');
  });
  it('falls back from a failed development proxy to the presigned URL', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_S3_BUCKET_URL', 'https://artifacts.example');
    vi.mocked(compileCode).mockResolvedValue(result);
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('proxy unavailable')).mockResolvedValueOnce(new Response('assembly'));
    vi.stubGlobal('fetch', fetch);
    await expect(compileSource('C', new AbortController().signal)).resolves.toEqual({ assembly: 'assembly', log: '' });
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/s3-proxy/assembly.s', result.assembly_url]);
  });
  it('does not retry a cancelled artifact request', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_S3_BUCKET_URL', 'https://artifacts.example');
    vi.mocked(compileCode).mockResolvedValue(result);
    const controller = new AbortController();
    const fetch = vi.fn().mockImplementation(() => { controller.abort(); throw new DOMException('Aborted', 'AbortError'); });
    vi.stubGlobal('fetch', fetch);
    await expect(compileSource('C', controller.signal)).rejects.toThrow('Aborted');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
