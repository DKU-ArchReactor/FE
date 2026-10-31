import axios from 'axios';
import { compileCode } from '@/api/build';

export type Compilation = { assembly: string; log: string };

export async function compileSource(source: string, signal: AbortSignal): Promise<Compilation> {
  const result = await compileCode({
    content: source, lang: 'c', compile_profile: 'rv32im', compiler_opt: '-O0 -g',
  }, signal);
  if (result.status !== 'success') {
    throw new Error(result.log || '컴파일에 실패했습니다. C 소스 코드를 확인해 주세요.');
  }
  if (!result.assembly_url) {
    throw new Error('컴파일 결과에 어셈블리 파일이 없습니다. 다시 컴파일해 주세요.');
  }
  // Presigned artifact requests must not receive the API Authorization header.
  const artifactUrl = result.assembly_url;
  const bucket = import.meta.env.VITE_S3_BUCKET_URL;
  const proxyUrl = import.meta.env.DEV && bucket && artifactUrl.startsWith(`${bucket.replace(/\/$/, '')}/`)
    ? artifactUrl.replace(bucket.replace(/\/$/, ''), '/s3-proxy') : artifactUrl;
  let response: Response;
  try {
    response = await fetch(proxyUrl, { signal });
    if (!response.ok && proxyUrl !== artifactUrl) response = await fetch(artifactUrl, { signal });
  } catch (error) {
    if (signal.aborted || proxyUrl === artifactUrl) throw error;
    response = await fetch(artifactUrl, { signal });
  }
  if (!response.ok) {
    throw new Error(`어셈블리 파일을 읽지 못했습니다 (HTTP ${response.status}). 다시 컴파일해 주세요.`);
  }
  return { assembly: await response.text(), log: result.log || '' };
}

export function compileError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail: unknown = error.response?.data?.detail;
    return typeof detail === 'string' ? detail : '컴파일 서버에 연결하지 못했습니다. API 설정과 네트워크를 확인해 주세요.';
  }
  return error instanceof Error ? error.message : '컴파일 중 오류가 발생했습니다.';
}
