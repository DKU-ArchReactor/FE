import api from '@/api/config';
import type { SimulationResult } from '@/type/simulation';
import type { Compilation } from './compile';
import { parseDebugInfo } from './debug';
export async function loadDebugInfo(url: string, signal: AbortSignal) {
  // Presigned ELF URLs never go through the authenticated API client.
  const bucket = import.meta.env.VITE_S3_BUCKET_URL?.replace(/\/$/, '');
  const proxy = import.meta.env.DEV && bucket && url.startsWith(`${bucket}/`) ? url.replace(bucket, '/s3-proxy') : url;
  let response: Response;
  try { response = await fetch(proxy, { signal }); if (!response.ok && proxy !== url) response = await fetch(url, { signal }); }
  catch (error) { if (signal.aborted || proxy === url) throw error; response = await fetch(url, { signal }); }
  if (!response.ok) throw new Error(`ELF 다운로드 실패 (HTTP ${response.status})`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 256 * 1024) throw new Error('ELF 파일이 지원 크기(256 KiB)를 초과했습니다.');
  return parseDebugInfo(bytes);
}
export type ExecutionTrace = SimulationResult & { console_output?: string; executionStatus: string };
export async function executeCompilation(compilation: Compilation, maxCycles: number, signal: AbortSignal): Promise<ExecutionTrace> {
  const response = await api.post('/api/v1/simulation/run', {
    ...(compilation.simulationToken ? { simulation_token: compilation.simulationToken } : { build_id: compilation.buildId }),
    mode: 'single', max_cycles: maxCycles,
  }, { signal });
  const envelope = response.data, result = envelope?.result;
  if (!result || !Array.isArray(result.history) || result.history.length > 2000 || typeof envelope.execution_status !== 'string') throw new Error('실행 기록 형식이 맞지 않습니다.');
  for (const cycle of result.history) if (!cycle?.global_result?.memory_snapshot || !cycle.global_result.registers || typeof cycle.global_result.current_pc !== 'string') throw new Error('메모리·레지스터 기록이 누락됐습니다.');
  return { ...result, executionStatus: envelope.execution_status };
}
