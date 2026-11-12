import type { EditorSource } from '@/type/assistant';

export const MAX_EDITOR_SOURCE_CHARS = 12000;

/** Capture only the active editor. Never substitute stale compiled assembly. */
export function captureEditorSource(
  enabled: boolean,
  language: 'c' | 'asm',
  content: string,
  supported: boolean,
): EditorSource | undefined {
  if (!enabled || !content.trim()) return undefined;
  if (!supported) throw new Error('백엔드의 원문 첨부 지원이 아직 준비되지 않았습니다. 연결을 다시 확인하거나 원문 자동 첨부를 끄고 질문해 주세요.');
  if ([...content].length > MAX_EDITOR_SOURCE_CHARS || new TextEncoder().encode(content).length > 48000) {
    throw new Error('작성 중인 코드가 12,000자 한도를 넘습니다. 코드를 줄이거나 원문 자동 첨부를 끄고 필요한 부분만 질문에 붙여 주세요.');
  }
  return { language, content };
}
